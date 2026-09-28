import express from "express";

import pool from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { hashPassword, validatePassword, verifyPassword } from "../auth/password.js";
import {
  cleanupExpiredSessions,
  createSession,
  destroySession,
  revokeUserSessions,
} from "../auth/session.js";

const router = express.Router();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_IP = 20;
const ACCOUNT_MAX_FAILURES = 5;
const ACCOUNT_LOCK_MINUTES = 15;
const ipAttempts = new Map();

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

function logAudit({ userId = null, username = null, action, success, req, details = {} }) {
  pool
    .query(
      `
        INSERT INTO auth_audit_log (
          user_id,
          username_attempted,
          action,
          success,
          ip_address,
          details
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [userId, username, action, success, clientIp(req), JSON.stringify(details)],
    )
    .catch((error) => console.error("Auth audit write failed:", error));
}

function checkIpRateLimit(req) {
  const key = clientIp(req) || "unknown";
  const now = Date.now();
  const current = ipAttempts.get(key);

  if (!current || current.resetAt <= now) {
    ipAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }

  current.count += 1;
  return current.count <= LOGIN_MAX_PER_IP;
}

function publicUser(user) {
  return {
    id: Number(user.id),
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    lastLoginAt: user.last_login_at,
    passwordChangedAt: user.password_changed_at,
  };
}

router.post("/login", async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!username || !password) {
    return res.status(400).json({
      code: "LOGIN_FIELDS_REQUIRED",
      message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน",
    });
  }

  if (!checkIpRateLimit(req)) {
    return res.status(429).json({
      code: "TOO_MANY_LOGIN_ATTEMPTS",
      message: "มีการพยายามเข้าสู่ระบบมากเกินไป กรุณารอสักครู่แล้วลองใหม่",
    });
  }

  try {
    const result = await pool.query(
      `
        SELECT *
        FROM app_users
        WHERE username_normalized = $1
        LIMIT 1
      `,
      [username],
    );

    const user = result.rows[0] || null;

    if (!user || !user.is_active) {
      logAudit({ username, action: "LOGIN", success: false, req, details: { reason: "invalid_credentials" } });
      return res.status(401).json({
        code: "INVALID_CREDENTIALS",
        message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
      });
    }

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      logAudit({ userId: user.id, username, action: "LOGIN", success: false, req, details: { reason: "account_locked" } });
      return res.status(429).json({
        code: "ACCOUNT_TEMPORARILY_LOCKED",
        message: "บัญชีถูกล็อกชั่วคราวจากการใส่รหัสผ่านผิดหลายครั้ง กรุณาลองใหม่ภายหลัง",
      });
    }

    const valid = await verifyPassword(password, user.password_hash);

    if (!valid) {
      const nextFailures = Number(user.failed_login_count || 0) + 1;
      const shouldLock = nextFailures >= ACCOUNT_MAX_FAILURES;

      await pool.query(
        `
          UPDATE app_users
          SET
            failed_login_count = $2,
            locked_until = CASE
              WHEN $3::boolean THEN NOW() + ($4::text || ' minutes')::interval
              ELSE NULL
            END,
            updated_at = NOW()
          WHERE id = $1
        `,
        [user.id, shouldLock ? 0 : nextFailures, shouldLock, String(ACCOUNT_LOCK_MINUTES)],
      );

      logAudit({
        userId: user.id,
        username,
        action: "LOGIN",
        success: false,
        req,
        details: { reason: shouldLock ? "locked_after_failures" : "invalid_credentials" },
      });

      return res.status(401).json({
        code: "INVALID_CREDENTIALS",
        message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
      });
    }

    await pool.query(
      `
        UPDATE app_users
        SET
          failed_login_count = 0,
          locked_until = NULL,
          last_login_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `,
      [user.id],
    );

    cleanupExpiredSessions().catch(() => {});
    const expiresAt = await createSession({ userId: user.id, req, res });

    const refreshed = await pool.query("SELECT * FROM app_users WHERE id = $1", [user.id]);
    logAudit({ userId: user.id, username, action: "LOGIN", success: true, req });

    return res.status(200).json({
      message: "เข้าสู่ระบบสำเร็จ",
      data: {
        user: publicUser(refreshed.rows[0]),
        expiresAt,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({
      code: "LOGIN_FAILED",
      message: "ไม่สามารถเข้าสู่ระบบได้",
    });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  try {
    await destroySession(req, res);
    logAudit({ userId: req.user.id, username: req.user.username, action: "LOGOUT", success: true, req });
    return res.status(200).json({ message: "ออกจากระบบแล้ว" });
  } catch (error) {
    console.error("Logout failed:", error);
    return res.status(500).json({
      code: "LOGOUT_FAILED",
      message: "ไม่สามารถออกจากระบบได้",
    });
  }
});

router.get("/me", requireAuth, (req, res) => {
  return res.status(200).json({ data: req.user });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const validationError = validatePassword(newPassword);

  if (!currentPassword || validationError) {
    return res.status(400).json({
      code: "PASSWORD_INVALID",
      message: validationError || "กรุณากรอกรหัสผ่านปัจจุบัน",
    });
  }

  try {
    const result = await pool.query("SELECT * FROM app_users WHERE id = $1", [req.user.id]);
    const user = result.rows[0];

    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      return res.status(401).json({
        code: "CURRENT_PASSWORD_INCORRECT",
        message: "รหัสผ่านปัจจุบันไม่ถูกต้อง",
      });
    }

    const passwordHash = await hashPassword(newPassword);

    await pool.query(
      `
        UPDATE app_users
        SET password_hash = $2, password_changed_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [req.user.id, passwordHash],
    );

    await revokeUserSessions(req.user.id);
    const expiresAt = await createSession({ userId: req.user.id, req, res });
    logAudit({ userId: req.user.id, username: req.user.username, action: "CHANGE_PASSWORD", success: true, req });

    return res.status(200).json({
      message: "เปลี่ยนรหัสผ่านสำเร็จ",
      data: { expiresAt },
    });
  } catch (error) {
    console.error("Change password failed:", error);
    return res.status(500).json({
      code: "CHANGE_PASSWORD_FAILED",
      message: "ไม่สามารถเปลี่ยนรหัสผ่านได้",
    });
  }
});

export default router;
