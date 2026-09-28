import { resolveSessionUser } from "./session.js";

export async function requireAuth(req, res, next) {
  try {
    const user = await resolveSessionUser(req);

    if (!user) {
      return res.status(401).json({
        code: "AUTH_REQUIRED",
        message: "กรุณาเข้าสู่ระบบ",
      });
    }

    req.user = {
      id: Number(user.id),
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      lastLoginAt: user.last_login_at,
      passwordChangedAt: user.password_changed_at,
    };

    return next();
  } catch (error) {
    console.error("Authentication check failed:", error);
    return res.status(500).json({
      code: "AUTH_CHECK_FAILED",
      message: "ไม่สามารถตรวจสอบสิทธิ์ผู้ใช้ได้",
    });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        code: "FORBIDDEN",
        message: "บัญชีนี้ไม่มีสิทธิ์ดำเนินการนี้",
      });
    }

    return next();
  };
}

export function enforceManagerPermissions(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      code: "AUTH_REQUIRED",
      message: "กรุณาเข้าสู่ระบบ",
    });
  }

  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  if (req.user.role === "ADMIN") {
    return next();
  }

  if (req.user.role === "OPERATOR") {
    const allowedPrefixes = ["/inventory-items", "/operations"];
    if (allowedPrefixes.some((prefix) => req.path.startsWith(prefix))) {
      return next();
    }
  }

  return res.status(403).json({
    code: "READ_ONLY_OR_INSUFFICIENT_ROLE",
    message: "บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลส่วนนี้",
  });
}
