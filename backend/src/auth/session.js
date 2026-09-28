import crypto from "node:crypto";

import pool from "../db.js";

export const SESSION_COOKIE_NAME = "assetops_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseCookies(cookieHeader = "") {
  const cookies = {};

  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (!key) continue;

    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }

  return cookies;
}

function cookieOptions() {
  const secure =
    process.env.ASSETOPS_SECURE_COOKIES === "1" ||
    process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}

export function readSessionToken(req) {
  return parseCookies(req.headers.cookie || "")[SESSION_COOKIE_NAME] || null;
}

export async function createSession({ userId, req, res }) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await pool.query(
    `
      INSERT INTO auth_sessions (
        user_id,
        token_hash,
        expires_at,
        user_agent,
        ip_address
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      userId,
      tokenHash,
      expiresAt,
      String(req.get("user-agent") || "").slice(0, 500) || null,
      req.ip || null,
    ],
  );

  res.cookie(SESSION_COOKIE_NAME, token, cookieOptions());
  return expiresAt;
}

export async function destroySession(req, res) {
  const token = readSessionToken(req);

  if (token) {
    await pool.query("DELETE FROM auth_sessions WHERE token_hash = $1", [
      hashToken(token),
    ]);
  }

  const options = cookieOptions();
  delete options.maxAge;
  res.clearCookie(SESSION_COOKIE_NAME, options);
}

export async function resolveSessionUser(req) {
  const token = readSessionToken(req);
  if (!token) return null;

  const result = await pool.query(
    `
      SELECT
        auth_sessions.id AS session_id,
        auth_sessions.expires_at,
        app_users.id,
        app_users.username,
        app_users.display_name,
        app_users.role,
        app_users.is_active,
        app_users.last_login_at,
        app_users.password_changed_at
      FROM auth_sessions
      JOIN app_users ON app_users.id = auth_sessions.user_id
      WHERE auth_sessions.token_hash = $1
        AND auth_sessions.expires_at > NOW()
        AND app_users.is_active = TRUE
      LIMIT 1
    `,
    [hashToken(token)],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

export async function revokeUserSessions(userId) {
  await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [userId]);
}

export async function cleanupExpiredSessions() {
  await pool.query("DELETE FROM auth_sessions WHERE expires_at <= NOW()");
}
