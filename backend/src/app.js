import express from "express";

import pool from "./db.js";

import productRoutes from "./routes/products.js";
import inventoryRoutes from "./routes/inventory.js";
import movementRoutes from "./routes/movements.js";

const app = express();

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(express.json());

// --------------------------------------------------
// HEALTH
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    data: {
      status: "ok",
    },
  });
});

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

// --------------------------------------------------
// ROUTES
// --------------------------------------------------

app.use("/api/products", productRoutes);

app.use("/api/inventory-items", inventoryRoutes);

app.use("/api/inventory-items", movementRoutes);

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
