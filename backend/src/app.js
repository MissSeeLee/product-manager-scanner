import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pool from "./db.js";
import {
  enforceManagerPermissions,
  requireAuth,
  requireRole,
} from "./auth/middleware.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import productRoutes from "./routes/products.js";
import inventoryRoutes from "./routes/inventory.js";
import movementRoutes from "./routes/movements.js";
import operationsRoutes from "./routes/operations.js";
import projectRoutes from "./routes/projects.js";
import locationRoutes from "./routes/locations.js";
import publicRoutes from "./routes/public.js";

const app = express();

if (process.env.ASSETOPS_TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

// --------------------------------------------------
// PATHS
// --------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(self)");
  return next();
});

// --------------------------------------------------
// PUBLIC HEALTH / AUTH / VIEWER API
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    data: {
      status: "ok",
    },
  });
});

app.use("/api/auth", authRoutes);

// Public Viewer must remain unauthenticated and read-only by its own router.
app.use("/api/public", publicRoutes);

// --------------------------------------------------
// MANAGER AUTHORIZATION BOUNDARY
// --------------------------------------------------

app.use("/api", requireAuth, enforceManagerPermissions);

app.get("/api/db-health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    return res.status(200).json({
      data: {
        status: "ok",
        database: "connected",
      },
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return res.status(503).json({
      code: "DATABASE_UNAVAILABLE",
      message: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้",
    });
  }
});

// User administration is ADMIN-only, including reads.
app.use("/api/users", requireRole("ADMIN"), userRoutes);

// --------------------------------------------------
// MANAGER API ROUTES
// --------------------------------------------------

app.use("/api/products", productRoutes);
app.use("/api/inventory-items", inventoryRoutes);
app.use("/api/inventory-items", movementRoutes);
app.use("/api/operations", operationsRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/locations", locationRoutes);

// --------------------------------------------------
// API 404
// --------------------------------------------------

app.use("/api", (req, res) => {
  return res.status(404).json({
    code: "API_ROUTE_NOT_FOUND",
    message: "ไม่พบ API ที่ต้องการ",
  });
});

// --------------------------------------------------
// FRONTEND
// --------------------------------------------------

app.use(
  express.static(frontendDistPath, {
    index: false,
  }),
);

// React Router SPA fallback
app.get("/{*splat}", (req, res, next) => {
  res.sendFile(frontendIndexPath, (error) => {
    if (error) {
      next(error);
    }
  });
});

// --------------------------------------------------
// FALLBACK ERROR HANDLER
// --------------------------------------------------

app.use((error, req, res, next) => {
  console.error("Unhandled application error:", error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "เซิร์ฟเวอร์เกิดข้อผิดพลาด",
  });
});

export default app;
