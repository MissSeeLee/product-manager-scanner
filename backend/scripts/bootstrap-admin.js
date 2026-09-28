import pool from "../src/db.js";
import { hashPassword, validatePassword } from "../src/auth/password.js";

const username = String(process.env.ASSETOPS_ADMIN_USERNAME || "admin").trim();
const displayName = String(process.env.ASSETOPS_ADMIN_DISPLAY_NAME || "AssetOps Administrator").trim();
const password = String(process.env.ASSETOPS_ADMIN_PASSWORD || "");
const normalized = username.toLowerCase();
const usernamePattern = /^[A-Za-z0-9._-]{3,50}$/;

try {
  if (!usernamePattern.test(username)) {
    throw new Error("Admin username must be 3-50 chars and use only letters, numbers, dot, dash, underscore.");
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  if (!displayName) {
    throw new Error("Admin display name is required.");
  }

  const existing = await pool.query(
    "SELECT id, username, role FROM app_users WHERE username_normalized = $1",
    [normalized],
  );

  if (existing.rowCount > 0) {
    console.log(`Admin bootstrap skipped: user '${existing.rows[0].username}' already exists.`);
    process.exitCode = 0;
  } else {
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `
        INSERT INTO app_users (
          username,
          username_normalized,
          password_hash,
          display_name,
          role,
          is_active
        )
        VALUES ($1, $2, $3, $4, 'ADMIN', TRUE)
        RETURNING id, username, display_name, role
      `,
      [username, normalized, passwordHash, displayName],
    );

    console.log(`Created initial admin: ${result.rows[0].username} (${result.rows[0].display_name})`);
  }
} catch (error) {
  console.error("Admin bootstrap failed:", error.message || error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
