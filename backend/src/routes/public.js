import express from "express";

import { getPublicPool } from "../publicDb.js";

const router = express.Router();

const VALID_STATUSES = new Set([
  "IN_STOCK",
  "IN_USE",
  "CLAIM",
  "REPLACED",
  "RETIRED",
]);

function parsePositiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function cleanSearch(value) {
  return String(value || "").trim().slice(0, 120);
}

function getPoolOr503(res) {
  try {
    return getPublicPool();
  } catch (error) {
    if (error.code === "PUBLIC_DATABASE_NOT_CONFIGURED") {
      res.status(503).json({
        code: "PUBLIC_VIEWER_DATABASE_NOT_CONFIGURED",
        message: "Public Viewer ยังไม่พร้อมใช้งาน",
      });
      return null;
    }

    throw error;
  }
}

function setReadOnlyCache(res, seconds = 30) {
  res.set(
    "Cache-Control",
    `public, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`,
  );
}

router.use((req, res, next) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    return res.status(405).json({
      code: "PUBLIC_VIEWER_READ_ONLY",
      message: "Public Viewer อนุญาตให้ดูข้อมูลเท่านั้น",
    });
  }

  return next();
});

router.get("/summary", async (req, res, next) => {
  const pool = getPoolOr503(res);
  if (!pool) return;

  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE current_status = 'IN_STOCK')::int AS in_stock,
        COUNT(*) FILTER (WHERE current_status = 'IN_USE')::int AS in_use,
        COUNT(*) FILTER (WHERE current_status = 'CLAIM')::int AS claim,
        COUNT(*) FILTER (WHERE current_status = 'REPLACED')::int AS replaced,
        COUNT(*) FILTER (WHERE current_status = 'RETIRED')::int AS retired
      FROM viewer.assets
    `);

    setReadOnlyCache(res, 30);

    return res.status(200).json({
      data: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/assets", async (req, res, next) => {
  const pool = getPoolOr503(res);
  if (!pool) return;

  const page = parsePositiveInt(req.query.page, 1);
  const limit = parsePositiveInt(req.query.limit, 20, 50);
  const offset = (page - 1) * limit;
  const search = cleanSearch(req.query.search);
  const status = String(req.query.status || "").trim().toUpperCase();

  if (status && !VALID_STATUSES.has(status)) {
    return res.status(400).json({
      code: "INVALID_STATUS_FILTER",
      message: "ตัวกรองสถานะไม่ถูกต้อง",
    });
  }

  const values = [];
  const conditions = [];

  if (search) {
    values.push(`%${search}%`);
    const index = values.length;

    conditions.push(`
      (
        public_code ILIKE $${index}
        OR masked_serial ILIKE $${index}
        OR product_name ILIKE $${index}
        OR COALESCE(brand, '') ILIKE $${index}
        OR COALESCE(part_number, '') ILIKE $${index}
        OR COALESCE(category, '') ILIKE $${index}
      )
    `);
  }

  if (status) {
    values.push(status);
    conditions.push(`current_status = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM viewer.assets ${whereClause}`,
      values,
    );

    const listValues = [...values, limit, offset];
    const limitParam = listValues.length - 1;
    const offsetParam = listValues.length;

    const result = await pool.query(
      `
        SELECT
          asset_id,
          public_code,
          masked_serial,
          product_name,
          brand,
          part_number,
          category,
          current_status,
          received_date,
          last_activity_at
        FROM viewer.assets
        ${whereClause}
        ORDER BY asset_id ASC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      listValues,
    );

    const total = countResult.rows[0].total;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    setReadOnlyCache(res, 20);

    return res.status(200).json({
      data: result.rows,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/assets/:id", async (req, res, next) => {
  const pool = getPoolOr503(res);
  if (!pool) return;

  const id = parsePositiveInt(req.params.id, null);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_ASSET_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          asset_id,
          public_code,
          masked_serial,
          product_name,
          brand,
          part_number,
          category,
          current_status,
          received_date,
          last_activity_at
        FROM viewer.assets
        WHERE asset_id = $1
      `,
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        code: "PUBLIC_ASSET_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    setReadOnlyCache(res, 20);

    return res.status(200).json({
      data: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/assets/:id/history", async (req, res, next) => {
  const pool = getPoolOr503(res);
  if (!pool) return;

  const id = parsePositiveInt(req.params.id, null);
  const limit = parsePositiveInt(req.query.limit, 100, 200);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_ASSET_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          movement_id,
          asset_id,
          movement_type,
          movement_date
        FROM viewer.asset_history
        WHERE asset_id = $1
        ORDER BY movement_date DESC, movement_id DESC
        LIMIT $2
      `,
      [id, limit],
    );

    setReadOnlyCache(res, 20);

    return res.status(200).json({
      data: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/history", async (req, res, next) => {
  const pool = getPoolOr503(res);
  if (!pool) return;

  const page = parsePositiveInt(req.query.page, 1);
  const limit = parsePositiveInt(req.query.limit, 30, 100);
  const offset = (page - 1) * limit;

  try {
    const countResult = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM viewer.asset_history
    `);

    const result = await pool.query(
      `
        SELECT
          movement_id,
          asset_id,
          public_code,
          masked_serial,
          product_name,
          movement_type,
          movement_date
        FROM viewer.asset_history
        ORDER BY movement_date DESC, movement_id DESC
        LIMIT $1
        OFFSET $2
      `,
      [limit, offset],
    );

    const total = countResult.rows[0].total;

    setReadOnlyCache(res, 20);

    return res.status(200).json({
      data: result.rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/recent", async (req, res, next) => {
  const pool = getPoolOr503(res);
  if (!pool) return;

  const limit = parsePositiveInt(req.query.limit, 8, 20);

  try {
    const result = await pool.query(
      `
        SELECT
          asset_id,
          public_code,
          masked_serial,
          product_name,
          current_status,
          last_activity_at
        FROM viewer.assets
        ORDER BY last_activity_at DESC NULLS LAST, asset_id DESC
        LIMIT $1
      `,
      [limit],
    );

    setReadOnlyCache(res, 20);

    return res.status(200).json({
      data: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
