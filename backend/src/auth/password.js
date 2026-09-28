import crypto from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 10) {
    return "รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร";
  }

  if (password.length > 200) {
    return "รหัสผ่านยาวเกินไป";
  }

  return null;
}

export async function hashPassword(password) {
  const validationError = validatePassword(password);
  if (validationError) {
    throw new Error(validationError);
  }

  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH);

  return `scrypt$${salt.toString("hex")}$${Buffer.from(derivedKey).toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== "string") {
    return false;
  }

  const [algorithm, saltHex, hashHex] = storedHash.split("$");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) {
    return false;
  }

  let expected;
  let salt;

  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }

  if (expected.length !== KEY_LENGTH) {
    return false;
  }

  const actual = Buffer.from(await scryptAsync(password, salt, KEY_LENGTH));
  return crypto.timingSafeEqual(actual, expected);
}
