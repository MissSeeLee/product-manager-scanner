import express from "express";

import pool from "../db.js";
import { hashPassword, validatePassword } from "../auth/password.js";
import { revokeUserSessions } from "../auth/session.js";

const router = express.Router();
const VALID_ROLES = new Set(["ADMIN", "OPERATOR", "VIEWER"]);
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanUsername(value) {
  return String(value || "").trim();
}

function cleanDisplayName(value) {
  return String(value || "").trim();
}

async function activeAdminCount(excludingId = null) {
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM app_users
      WHERE role = 'ADMIN'
        AND is_active = TRUE
        AND ($1::bigint IS NULL OR id <> $1)
    `,
    [excludingId],
  );
  return Number(result.rows[0]?.count || 0);
}

function audit(req, action, targetUserId, details = {}) {
  pool
    .query(
      `
        INSERT INTO auth_audit_log (user_id, username_attempted, action, success, ip_address, details)
        VALUES ($1, $2, $3, TRUE, $4, $5::jsonb)
      `,
      [req.user.id, req.user.username, action, req.ip || null, JSON.stringify({ targetUserId, ...details })],
    )
    .catch((error) => console.error("User management audit failed:", error));
}

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          username,
          display_name,
          role,
          is_active,
          failed_login_count,
          locked_until,
          last_login_at,
          password_changed_at,
          created_at,
          updated_at
        FROM app_users
        ORDER BY is_active DESC, role, display_name, id
      `,
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    console.error("List users failed:", error);
    return res.status(500).json({ code: "USER_LIST_FAILED", message: "ไม่สามารถโหลดรายชื่อผู้ใช้ได้" });
  }
});

router.post("/", async (req, res) => {
  const username = cleanUsername(req.body?.username);
  const normalized = normalizeUsername(username);
  const displayName = cleanDisplayName(req.body?.displayName);
  const role = String(req.body?.role || "VIEWER").trim().toUpperCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const passwordError = validatePassword(password);

  if (!USERNAME_PATTERN.test(username)) {
    return res.status(400).json({
      code: "USERNAME_INVALID",
      message: "ชื่อผู้ใช้ต้องมี 3–50 ตัว และใช้ได้เฉพาะ a-z, A-Z, 0-9, จุด, ขีดกลาง และขีดล่าง",
    });
  }

  if (!displayName || !VALID_ROLES.has(role) || passwordError) {
    return res.status(400).json({
      code: "USER_FIELDS_INVALID",
      message: passwordError || "กรุณากรอกชื่อแสดงผลและเลือกสิทธิ์ให้ถูกต้อง",
    });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `
        INSERT INTO app_users (
          username,
          username_normalized,
          password_hash,
          display_name,
          role
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, username, display_name, role, is_active, created_at
      `,
      [username, normalized, passwordHash, displayName, role],
    );

    audit(req, "CREATE_USER", result.rows[0].id, { role });
    return res.status(201).json({ message: "สร้างผู้ใช้สำเร็จ", data: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ code: "USERNAME_EXISTS", message: "ชื่อผู้ใช้นี้มีอยู่แล้ว" });
    }

    console.error("Create user failed:", error);
    return res.status(500).json({ code: "USER_CREATE_FAILED", message: "ไม่สามารถสร้างผู้ใช้ได้" });
  }
});

router.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const displayName = cleanDisplayName(req.body?.displayName);
  const role = String(req.body?.role || "").trim().toUpperCase();
  const isActive = req.body?.isActive;

  if (!id || !displayName || !VALID_ROLES.has(role) || typeof isActive !== "boolean") {
    return res.status(400).json({ code: "USER_UPDATE_INVALID", message: "ข้อมูลผู้ใช้ไม่ถูกต้อง" });
  }

  try {
    const existingResult = await pool.query("SELECT * FROM app_users WHERE id = $1", [id]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return res.status(404).json({ code: "USER_NOT_FOUND", message: "ไม่พบผู้ใช้" });
    }

    if (id === req.user.id && !isActive) {
      return res.status(400).json({ code: "CANNOT_DEACTIVATE_SELF", message: "ไม่สามารถปิดใช้งานบัญชีที่กำลังใช้อยู่ได้" });
    }

    const removesActiveAdmin = existing.role === "ADMIN" && existing.is_active && (role !== "ADMIN" || !isActive);
    if (removesActiveAdmin && (await activeAdminCount(id)) === 0) {
      return res.status(409).json({ code: "LAST_ADMIN_REQUIRED", message: "ระบบต้องมีผู้ดูแลระบบที่เปิดใช้งานอย่างน้อย 1 บัญชี" });
    }

    const result = await pool.query(
      `
        UPDATE app_users
        SET display_name = $2, role = $3, is_active = $4, updated_at = NOW()
        WHERE id = $1
        RETURNING id, username, display_name, role, is_active, last_login_at, updated_at
      `,
      [id, displayName, role, isActive],
    );

    if (!isActive || existing.role !== role) {
      await revokeUserSessions(id);
    }

    audit(req, "UPDATE_USER", id, { role, isActive });
    return res.status(200).json({ message: "บันทึกผู้ใช้สำเร็จ", data: result.rows[0] });
  } catch (error) {
    console.error("Update user failed:", error);
    return res.status(500).json({ code: "USER_UPDATE_FAILED", message: "ไม่สามารถบันทึกผู้ใช้ได้" });
  }
});

router.post("/:id/reset-password", async (req, res) => {
  const id = parseId(req.params.id);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const passwordError = validatePassword(password);

  if (!id || passwordError) {
    return res.status(400).json({ code: "PASSWORD_INVALID", message: passwordError || "รหัสผู้ใช้ไม่ถูกต้อง" });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `
        UPDATE app_users
        SET
          password_hash = $2,
          password_changed_at = NOW(),
          failed_login_count = 0,
          locked_until = NULL,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, username
      `,
      [id, passwordHash],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ code: "USER_NOT_FOUND", message: "ไม่พบผู้ใช้" });
    }

    await revokeUserSessions(id);
    audit(req, "RESET_PASSWORD", id);
    return res.status(200).json({ message: "ตั้งรหัสผ่านใหม่สำเร็จ" });
  } catch (error) {
    console.error("Reset password failed:", error);
    return res.status(500).json({ code: "PASSWORD_RESET_FAILED", message: "ไม่สามารถตั้งรหัสผ่านใหม่ได้" });
  }
});

export default router;
