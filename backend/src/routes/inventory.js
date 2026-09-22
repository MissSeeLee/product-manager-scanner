import express from "express";

import pool from "../db.js";

const router = express.Router();

const VALID_STATUSES = new Set([
  "IN_STOCK",
  "IN_USE",
  "CLAIM",
  "REPLACED",
  "RETIRED",
]);

const SORT_COLUMNS = {
  serial_number: "inventory_items.serial_number",
  product_name: "products.product_name",
  brand: "products.brand",
  part_number: "products.part_number",
  current_status: "inventory_items.current_status",
  current_location: "inventory_items.current_location",
  received_at: "received.received_at",
  warranty_end: "inventory_items.warranty_end",
  created_at: "inventory_items.created_at",
  updated_at: "inventory_items.updated_at",
};

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parsePositiveInt(value, fallback, max = 100) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const clean = value.trim();
  return clean || null;
}

function parseTimezoneOffsetMinutes(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < -840 || parsed > 840) {
    return null;
  }

  return parsed;
}

function normalizeReceivedAt(value, timezoneOffsetMinutes = 0) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const utcMidnight = Date.UTC(year, month - 1, day);
    const check = new Date(utcMidnight);

    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      return undefined;
    }

    return new Date(
      utcMidnight - timezoneOffsetMinutes * 60_000,
    ).toISOString();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function validateWarranty(warrantyStart, warrantyEnd) {
  if (!warrantyStart || !warrantyEnd) {
    return true;
  }

  return warrantyEnd >= warrantyStart;
}

function inventorySelectSql() {
  return `
    SELECT
      inventory_items.id,
      inventory_items.product_id,
      inventory_items.serial_number,
      inventory_items.current_status,
      inventory_items.current_location,
      inventory_items.warranty_start,
      inventory_items.warranty_end,
      inventory_items.created_at,
      inventory_items.updated_at,
      products.product_name,
      products.brand,
      products.part_number,
      products.category,
      received.received_at
    FROM inventory_items
    JOIN products
      ON inventory_items.product_id = products.id
    LEFT JOIN LATERAL (
      SELECT stock_movements.movement_date AS received_at
      FROM stock_movements
      WHERE stock_movements.inventory_item_id = inventory_items.id
        AND stock_movements.movement_type = 'RECEIVE'
      ORDER BY stock_movements.movement_date ASC, stock_movements.id ASC
      LIMIT 1
    ) AS received ON TRUE
  `;
}

async function createInventoryItemWithReceive(client, payload) {
  const {
    productId,
    serialNumber,
    currentLocation,
    warrantyStart = null,
    warrantyEnd = null,
    receivedAt = null,
    timezoneOffsetMinutes = 0,
    performedBy = null,
    distributor = null,
    note = "",
  } = payload;

  const cleanProductId = parseId(productId);
  const cleanSerialNumber = normalizeOptionalString(serialNumber);
  const cleanLocation = normalizeOptionalString(currentLocation);
  const cleanPerformedBy = normalizeOptionalString(performedBy);
  const cleanDistributor = normalizeOptionalString(distributor);
  const cleanNote = typeof note === "string" ? note.trim() : "";
  const cleanTimezoneOffset = parseTimezoneOffsetMinutes(timezoneOffsetMinutes);
  const normalizedReceivedAt =
    cleanTimezoneOffset === null
      ? undefined
      : normalizeReceivedAt(receivedAt, cleanTimezoneOffset);

  if (!cleanProductId) {
    const error = new Error("INVALID_PRODUCT_ID");
    error.publicCode = "INVALID_PRODUCT_ID";
    error.publicMessage = "รหัสรุ่นสินค้าไม่ถูกต้อง";
    error.httpStatus = 400;
    throw error;
  }

  if (!cleanSerialNumber) {
    const error = new Error("SERIAL_NUMBER_REQUIRED");
    error.publicCode = "SERIAL_NUMBER_REQUIRED";
    error.publicMessage = "กรุณากรอก Serial Number";
    error.httpStatus = 400;
    throw error;
  }

  if (!cleanLocation) {
    const error = new Error("LOCATION_REQUIRED");
    error.publicCode = "LOCATION_REQUIRED";
    error.publicMessage = "กรุณากรอกตำแหน่งเริ่มต้นของอุปกรณ์";
    error.httpStatus = 400;
    throw error;
  }

  if (normalizedReceivedAt === undefined) {
    const error = new Error("INVALID_RECEIVED_AT");
    error.publicCode = "INVALID_RECEIVED_AT";
    error.publicMessage = "วันที่รับเข้าไม่ถูกต้อง";
    error.httpStatus = 400;
    throw error;
  }

  if (!validateWarranty(warrantyStart, warrantyEnd)) {
    const error = new Error("INVALID_WARRANTY_RANGE");
    error.publicCode = "INVALID_WARRANTY_RANGE";
    error.publicMessage = "วันสิ้นสุดประกันต้องไม่มาก่อนวันเริ่มประกัน";
    error.httpStatus = 400;
    throw error;
  }

  const itemResult = await client.query(
    `
      INSERT INTO inventory_items (
        product_id,
        serial_number,
        current_status,
        current_location,
        warranty_start,
        warranty_end
      )
      VALUES ($1, $2, 'IN_STOCK', $3, $4, $5)
      RETURNING *
    `,
    [
      cleanProductId,
      cleanSerialNumber,
      cleanLocation,
      warrantyStart || null,
      warrantyEnd || null,
    ],
  );

  const item = itemResult.rows[0];

  const movementResult = await client.query(
    `
      INSERT INTO stock_movements (
        inventory_item_id,
        movement_type,
        movement_date,
        performed_by,
        distributor,
        to_location,
        note
      )
      VALUES (
        $1,
        'RECEIVE',
        COALESCE($2::timestamptz, NOW()),
        $3,
        $4,
        $5,
        $6
      )
      RETURNING *
    `,
    [
      item.id,
      normalizedReceivedAt,
      cleanPerformedBy,
      cleanDistributor,
      cleanLocation,
      cleanNote,
    ],
  );

  return {
    item,
    movement: movementResult.rows[0],
  };
}

async function resolveProductForBulk(client, row) {
  const productId = parseId(row.productId);

  if (productId) {
    const result = await client.query(
      `SELECT id FROM products WHERE id = $1`,
      [productId],
    );

    if (result.rowCount === 0) {
      const error = new Error("PRODUCT_NOT_FOUND");
      error.publicCode = "PRODUCT_NOT_FOUND";
      error.publicMessage = "ไม่พบรุ่นสินค้าที่เลือก";
      error.httpStatus = 404;
      throw error;
    }

    return productId;
  }

  const product = row.product ?? {};
  const productName = normalizeOptionalString(product.productName);
  const brand = normalizeOptionalString(product.brand);
  const partNumber = normalizeOptionalString(product.partNumber);
  const category = normalizeOptionalString(product.category) || "ทั่วไป";
  const description = normalizeOptionalString(product.description) || "";

  if (!productName || !brand || !partNumber) {
    const error = new Error("MODEL_DATA_REQUIRED");
    error.publicCode = "MODEL_DATA_REQUIRED";
    error.publicMessage = "กรุณาระบุชื่อรุ่น ยี่ห้อ และ Part Number";
    error.httpStatus = 400;
    throw error;
  }

  const created = await client.query(
    `
      INSERT INTO products (
        product_name,
        brand,
        part_number,
        category,
        description
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (brand, part_number) DO NOTHING
      RETURNING id
    `,
    [productName, brand, partNumber, category, description],
  );

  if (created.rowCount > 0) {
    return created.rows[0].id;
  }

  const existing = await client.query(
    `
      SELECT id
      FROM products
      WHERE brand = $1 AND part_number = $2
      LIMIT 1
    `,
    [brand, partNumber],
  );

  if (existing.rowCount > 0) {
    return existing.rows[0].id;
  }

  const error = new Error("MODEL_RESOLUTION_FAILED");
  error.publicCode = "MODEL_RESOLUTION_FAILED";
  error.publicMessage = "ไม่สามารถจับคู่รุ่นสินค้าได้";
  error.httpStatus = 409;
  throw error;
}

function publicErrorFrom(error) {
  if (error.publicCode) {
    return {
      status: error.httpStatus || 400,
      code: error.publicCode,
      message: error.publicMessage || "ข้อมูลไม่ถูกต้อง",
    };
  }

  if (error.code === "23505") {
    return {
      status: 409,
      code: "SERIAL_NUMBER_ALREADY_EXISTS",
      message: "Serial Number นี้มีอยู่ในระบบแล้ว",
    };
  }

  if (error.code === "23503") {
    return {
      status: 404,
      code: "PRODUCT_NOT_FOUND",
      message: "ไม่พบรุ่นสินค้าที่เลือก",
    };
  }

  if (error.code === "23514") {
    return {
      status: 400,
      code: "INVALID_INVENTORY_DATA",
      message: "ข้อมูลอุปกรณ์ไม่ถูกต้อง",
    };
  }

  return null;
}

async function validateBulkRows(rows) {
  const serials = rows
    .map((row) => normalizeOptionalString(row.serialNumber))
    .filter(Boolean);

  const serialCounts = new Map();

  for (const serial of serials) {
    serialCounts.set(serial, (serialCounts.get(serial) || 0) + 1);
  }

  const requestedProductIds = [
    ...new Set(
      rows
        .map((row) => parseId(row.productId))
        .filter(Boolean),
    ),
  ];

  const [existingSerialResult, existingProductsResult] = await Promise.all([
    serials.length
      ? pool.query(
          `
            SELECT serial_number
            FROM inventory_items
            WHERE serial_number = ANY($1::text[])
          `,
          [serials],
        )
      : Promise.resolve({ rows: [] }),
    requestedProductIds.length
      ? pool.query(
          `
            SELECT id
            FROM products
            WHERE id = ANY($1::bigint[])
          `,
          [requestedProductIds],
        )
      : Promise.resolve({ rows: [] }),
  ]);

  const existingSerials = new Set(
    existingSerialResult.rows.map((row) => row.serial_number),
  );
  const existingProductIds = new Set(
    existingProductsResult.rows.map((row) => String(row.id)),
  );

  const results = rows.map((row, index) => {
    const errors = [];
    const warnings = [];
    const serial = normalizeOptionalString(row.serialNumber);
    const location = normalizeOptionalString(row.currentLocation);
    const rawProductId = row.productId;
    const productId = parseId(rawProductId);
    const product = row.product ?? {};

    if (!serial) {
      errors.push("ไม่มี Serial Number");
    } else {
      if ((serialCounts.get(serial) || 0) > 1) {
        errors.push("Serial Number ซ้ำภายในชุดข้อมูล");
      }

      if (existingSerials.has(serial)) {
        errors.push("Serial Number มีอยู่ในระบบแล้ว");
      }
    }

    if (!location) {
      errors.push("ไม่มีตำแหน่งเริ่มต้น");
    }

    if (rawProductId !== undefined && rawProductId !== null && rawProductId !== "") {
      if (!productId) {
        errors.push("รหัสรุ่นสินค้าไม่ถูกต้อง");
      } else if (!existingProductIds.has(String(productId))) {
        errors.push("ไม่พบรุ่นสินค้าที่เลือก");
      }
    } else if (
      !normalizeOptionalString(product.productName) ||
      !normalizeOptionalString(product.brand) ||
      !normalizeOptionalString(product.partNumber)
    ) {
      errors.push("ข้อมูลรุ่นสินค้าไม่ครบ");
    }

    if (!validateWarranty(row.warrantyStart, row.warrantyEnd)) {
      errors.push("ช่วงวันที่รับประกันไม่ถูกต้อง");
    }

    const rowTimezoneOffset = parseTimezoneOffsetMinutes(row.timezoneOffsetMinutes);

    if (rowTimezoneOffset === null) {
      errors.push("Timezone ของวันที่รับเข้าไม่ถูกต้อง");
    } else if (
      row.receivedAt &&
      normalizeReceivedAt(row.receivedAt, rowTimezoneOffset) === undefined
    ) {
      errors.push("วันที่รับเข้าไม่ถูกต้อง");
    }

    if (!normalizeOptionalString(row.performedBy)) {
      warnings.push("ไม่ระบุผู้รับเข้า");
    }

    return {
      index,
      serialNumber: serial,
      valid: errors.length === 0,
      errors,
      warnings,
    };
  });

  return {
    rows: results,
    summary: {
      total: results.length,
      valid: results.filter((row) => row.valid).length,
      invalid: results.filter((row) => !row.valid).length,
      warnings: results.filter((row) => row.warnings.length > 0).length,
    },
  };
}

// --------------------------------------------------
// CREATE ONE PHYSICAL ASSET + RECEIVE
// --------------------------------------------------
router.post("/", async (req, res) => {
  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const created = await createInventoryItemWithReceive(client, req.body);

    await client.query("COMMIT");

    return res.status(201).json({
      message: "ลงทะเบียนอุปกรณ์เข้าระบบเรียบร้อย",
      data: created,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Inventory create rollback failed:", rollbackError);
      }
    }

    const publicError = publicErrorFrom(error);

    if (publicError) {
      return res.status(publicError.status).json({
        code: publicError.code,
        message: publicError.message,
      });
    }

    console.error("Create inventory item failed:", error);

    return res.status(500).json({
      code: "INVENTORY_CREATE_FAILED",
      message: "ไม่สามารถลงทะเบียนอุปกรณ์ได้",
    });
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// BULK VALIDATE
// --------------------------------------------------
router.post("/bulk/validate", async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  if (rows.length === 0 || rows.length > 2000) {
    return res.status(400).json({
      code: "INVALID_BULK_ROWS",
      message: "กรุณาส่งข้อมูล 1–2,000 รายการต่อครั้ง",
    });
  }

  try {
    const validation = await validateBulkRows(rows);

    return res.status(200).json({
      data: validation,
    });
  } catch (error) {
    console.error("Bulk validate failed:", error);

    return res.status(500).json({
      code: "BULK_VALIDATE_FAILED",
      message: "ไม่สามารถตรวจสอบข้อมูลนำเข้าได้",
    });
  }
});

// --------------------------------------------------
// BULK IMPORT / QUICK BATCH
// --------------------------------------------------
router.post("/bulk", async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  if (rows.length === 0 || rows.length > 2000) {
    return res.status(400).json({
      code: "INVALID_BULK_ROWS",
      message: "กรุณาส่งข้อมูล 1–2,000 รายการต่อครั้ง",
    });
  }

  try {
    const validation = await validateBulkRows(rows);

    if (validation.summary.invalid > 0) {
      return res.status(400).json({
        code: "BULK_VALIDATION_FAILED",
        message: "ข้อมูลนำเข้ายังมีข้อผิดพลาด กรุณาตรวจสอบก่อนนำเข้า",
        data: validation,
      });
    }
  } catch (error) {
    console.error("Bulk preflight validation failed:", error);

    return res.status(500).json({
      code: "BULK_VALIDATE_FAILED",
      message: "ไม่สามารถตรวจสอบข้อมูลก่อนนำเข้าได้",
    });
  }

  const results = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const productId = await resolveProductForBulk(client, row);
      const created = await createInventoryItemWithReceive(client, {
        ...row,
        productId,
      });

      await client.query("COMMIT");

      results.push({
        index,
        success: true,
        serialNumber: created.item.serial_number,
        itemId: created.item.id,
      });
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Bulk row rollback failed:", rollbackError);
        }
      }

      const publicError = publicErrorFrom(error);

      results.push({
        index,
        success: false,
        serialNumber: normalizeOptionalString(row.serialNumber),
        code: publicError?.code || "IMPORT_ROW_FAILED",
        message: publicError?.message || "นำเข้ารายการนี้ไม่สำเร็จ",
      });
    } finally {
      client?.release();
    }
  }

  const succeeded = results.filter((row) => row.success).length;
  const failed = results.length - succeeded;

  return res.status(failed === 0 ? 201 : 200).json({
    message:
      failed === 0
        ? `นำเข้าอุปกรณ์ ${succeeded} รายการเรียบร้อย`
        : `นำเข้าสำเร็จ ${succeeded} รายการ และไม่สำเร็จ ${failed} รายการ`,
    data: {
      summary: {
        total: results.length,
        succeeded,
        failed,
      },
      rows: results,
    },
  });
});

// --------------------------------------------------
// FILTER OPTIONS
// --------------------------------------------------
router.get("/filter-options", async (req, res) => {
  try {
    const [locationsResult, brandsResult] = await Promise.all([
      pool.query(`
        SELECT DISTINCT current_location AS value
        FROM inventory_items
        WHERE current_location IS NOT NULL
          AND BTRIM(current_location) <> ''
        ORDER BY value ASC
      `),
      pool.query(`
        SELECT DISTINCT brand AS value
        FROM products
        WHERE brand IS NOT NULL
          AND BTRIM(brand) <> ''
        ORDER BY value ASC
      `),
    ]);

    return res.status(200).json({
      data: {
        statuses: Array.from(VALID_STATUSES),
        locations: locationsResult.rows.map((row) => row.value),
        brands: brandsResult.rows.map((row) => row.value),
      },
    });
  } catch (error) {
    console.error("Get inventory filter options failed:", error);

    return res.status(500).json({
      code: "FILTER_OPTIONS_FAILED",
      message: "ไม่สามารถโหลดตัวเลือกตัวกรองได้",
    });
  }
});

// --------------------------------------------------
// DASHBOARD SUMMARY
// --------------------------------------------------
router.get("/summary", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE current_status = 'IN_STOCK')::bigint AS in_stock,
        COUNT(*) FILTER (WHERE current_status = 'IN_USE')::bigint AS in_use,
        COUNT(*) FILTER (WHERE current_status = 'CLAIM')::bigint AS claim,
        COUNT(*) FILTER (WHERE current_status = 'REPLACED')::bigint AS replaced,
        COUNT(*) FILTER (WHERE current_status = 'RETIRED')::bigint AS retired
      FROM inventory_items
    `);

    const row = result.rows[0];

    return res.status(200).json({
      data: {
        total: Number(row.total || 0),
        IN_STOCK: Number(row.in_stock || 0),
        IN_USE: Number(row.in_use || 0),
        CLAIM: Number(row.claim || 0),
        REPLACED: Number(row.replaced || 0),
        RETIRED: Number(row.retired || 0),
      },
    });
  } catch (error) {
    console.error("Get inventory summary failed:", error);

    return res.status(500).json({
      code: "INVENTORY_SUMMARY_FAILED",
      message: "ไม่สามารถโหลดภาพรวมอุปกรณ์ได้",
    });
  }
});


// --------------------------------------------------
// LIST / SEARCH / FILTER / SORT / PAGINATION
// --------------------------------------------------
router.get("/", async (req, res) => {
  const {
    search,
    status,
    productId,
    location,
    brand,
    partNumber,
    serialPrefix,
    receivedFrom,
    receivedTo,
    warranty,
    timezoneOffsetMinutes,
    sort = "created_at",
    order = "desc",
  } = req.query;

  if (status && !VALID_STATUSES.has(status)) {
    return res.status(400).json({
      code: "INVALID_STATUS_FILTER",
      message: "ตัวกรองสถานะไม่ถูกต้อง",
    });
  }

  const parsedProductId = productId ? parseId(productId) : null;

  if (productId && !parsedProductId) {
    return res.status(400).json({
      code: "INVALID_PRODUCT_FILTER",
      message: "ตัวกรองรุ่นสินค้าไม่ถูกต้อง",
    });
  }

  const queryTimezoneOffset = parseTimezoneOffsetMinutes(timezoneOffsetMinutes);

  if (queryTimezoneOffset === null) {
    return res.status(400).json({
      code: "INVALID_TIMEZONE_OFFSET",
      message: "Timezone สำหรับตัวกรองวันที่ไม่ถูกต้อง",
    });
  }

  const sortColumn = SORT_COLUMNS[sort] || SORT_COLUMNS.created_at;
  const sortOrder = String(order).toLowerCase() === "asc" ? "ASC" : "DESC";
  const limit = Math.max(1, parsePositiveInt(req.query.limit, 50, 100));
  const offset = parsePositiveInt(req.query.offset, 0, 1_000_000);

  const conditions = [];
  const values = [];

  function pushCondition(sql, value) {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  }

  if (normalizeOptionalString(search)) {
    values.push(`%${search.trim()}%`);
    const p = `$${values.length}`;
    conditions.push(`(
      inventory_items.serial_number ILIKE ${p}
      OR products.product_name ILIKE ${p}
      OR products.brand ILIKE ${p}
      OR products.part_number ILIKE ${p}
      OR inventory_items.current_location ILIKE ${p}
    )`);
  }

  if (status) {
    pushCondition("inventory_items.current_status = ?", status);
  }

  if (parsedProductId) {
    pushCondition("inventory_items.product_id = ?", parsedProductId);
  }

  if (normalizeOptionalString(location)) {
    pushCondition("LOWER(inventory_items.current_location) = LOWER(?)", location.trim());
  }

  if (normalizeOptionalString(brand)) {
    pushCondition("LOWER(products.brand) = LOWER(?)", brand.trim());
  }

  if (normalizeOptionalString(partNumber)) {
    pushCondition("products.part_number ILIKE ?", `%${partNumber.trim()}%`);
  }

  if (normalizeOptionalString(serialPrefix)) {
    pushCondition("inventory_items.serial_number ILIKE ?", `${serialPrefix.trim()}%`);
  }

  if (receivedFrom) {
    const parsed = normalizeReceivedAt(receivedFrom, queryTimezoneOffset);

    if (parsed === undefined) {
      return res.status(400).json({
        code: "INVALID_RECEIVED_FROM",
        message: "วันที่เริ่มต้นรับเข้าไม่ถูกต้อง",
      });
    }

    pushCondition("received.received_at >= ?::timestamptz", parsed);
  }

  if (receivedTo) {
    const parsed = normalizeReceivedAt(receivedTo, queryTimezoneOffset);

    if (parsed === undefined) {
      return res.status(400).json({
        code: "INVALID_RECEIVED_TO",
        message: "วันที่สิ้นสุดรับเข้าไม่ถูกต้อง",
      });
    }

    const exclusive = new Date(new Date(parsed).getTime() + 24 * 60 * 60 * 1000);
    pushCondition("received.received_at < ?::timestamptz", exclusive.toISOString());
  }

  if (warranty === "expired") {
    conditions.push("inventory_items.warranty_end < CURRENT_DATE");
  } else if (warranty === "expiring") {
    conditions.push(`
      (inventory_items.warranty_start IS NULL OR inventory_items.warranty_start <= CURRENT_DATE)
      AND inventory_items.warranty_end >= CURRENT_DATE
      AND inventory_items.warranty_end <= CURRENT_DATE + INTERVAL '30 days'
    `);
  } else if (warranty === "active") {
    conditions.push(`
      (inventory_items.warranty_start IS NULL OR inventory_items.warranty_start <= CURRENT_DATE)
      AND inventory_items.warranty_end >= CURRENT_DATE
    `);
  } else if (warranty === "none") {
    conditions.push("inventory_items.warranty_end IS NULL");
  } else if (warranty && warranty !== "all") {
    return res.status(400).json({
      code: "INVALID_WARRANTY_FILTER",
      message: "ตัวกรองการรับประกันไม่ถูกต้อง",
    });
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const fromSql = inventorySelectSql();

  try {
    const countSql = `
      SELECT COUNT(*)::bigint AS total
      FROM inventory_items
      JOIN products
        ON inventory_items.product_id = products.id
      LEFT JOIN LATERAL (
        SELECT stock_movements.movement_date AS received_at
        FROM stock_movements
        WHERE stock_movements.inventory_item_id = inventory_items.id
          AND stock_movements.movement_type = 'RECEIVE'
        ORDER BY stock_movements.movement_date ASC, stock_movements.id ASC
        LIMIT 1
      ) AS received ON TRUE
      ${whereSql}
    `;

    const dataValues = [...values, limit, offset];
    const dataSql = `
      ${fromSql}
      ${whereSql}
      ORDER BY ${sortColumn} ${sortOrder} NULLS LAST, inventory_items.id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const [countResult, overallCountResult, dataResult] = await Promise.all([
      pool.query(countSql, values),
      pool.query("SELECT COUNT(*)::bigint AS total FROM inventory_items"),
      pool.query(dataSql, dataValues),
    ]);

    const total = Number(countResult.rows[0]?.total || 0);
    const overallTotal = Number(overallCountResult.rows[0]?.total || 0);

    return res.status(200).json({
      data: dataResult.rows,
      meta: {
        total,
        overallTotal,
        limit,
        offset,
        sort: SORT_COLUMNS[sort] ? sort : "created_at",
        order: sortOrder.toLowerCase(),
      },
    });
  } catch (error) {
    console.error("Get inventory items failed:", error);

    return res.status(500).json({
      code: "INVENTORY_LIST_FAILED",
      message: "ไม่สามารถโหลดรายการอุปกรณ์ได้",
    });
  }
});

// --------------------------------------------------
// EXACT SERIAL LOOKUP
// --------------------------------------------------
router.get("/serial/:serial", async (req, res) => {
  const serial = normalizeOptionalString(req.params.serial);

  if (!serial) {
    return res.status(400).json({
      code: "SERIAL_NUMBER_REQUIRED",
      message: "กรุณาระบุ Serial Number",
    });
  }

  try {
    const result = await pool.query(
      `
        ${inventorySelectSql()}
        WHERE inventory_items.serial_number = $1
      `,
      [serial],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    return res.status(200).json({ data: result.rows[0] });
  } catch (error) {
    console.error("Get inventory item by serial failed:", error);

    return res.status(500).json({
      code: "INVENTORY_GET_FAILED",
      message: "ไม่สามารถโหลดข้อมูลอุปกรณ์ได้",
    });
  }
});

// --------------------------------------------------
// GET BY ID
// --------------------------------------------------
router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  try {
    const result = await pool.query(
      `
        ${inventorySelectSql()}
        WHERE inventory_items.id = $1
      `,
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    return res.status(200).json({ data: result.rows[0] });
  } catch (error) {
    console.error("Get inventory item failed:", error);

    return res.status(500).json({
      code: "INVENTORY_GET_FAILED",
      message: "ไม่สามารถโหลดข้อมูลอุปกรณ์ได้",
    });
  }
});

// --------------------------------------------------
// UPDATE NON-LIFECYCLE METADATA
// --------------------------------------------------
router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const {
    serialNumber,
    warrantyStart = null,
    warrantyEnd = null,
  } = req.body;

  const cleanSerialNumber = normalizeOptionalString(serialNumber);

  if (!cleanSerialNumber) {
    return res.status(400).json({
      code: "SERIAL_NUMBER_REQUIRED",
      message: "กรุณากรอก Serial Number",
    });
  }

  if (!validateWarranty(warrantyStart, warrantyEnd)) {
    return res.status(400).json({
      code: "INVALID_WARRANTY_RANGE",
      message: "วันสิ้นสุดประกันต้องไม่มาก่อนวันเริ่มประกัน",
    });
  }

  try {
    const result = await pool.query(
      `
        UPDATE inventory_items
        SET
          serial_number = $1,
          warranty_start = $2,
          warranty_end = $3,
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `,
      [cleanSerialNumber, warrantyStart, warrantyEnd, id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    return res.status(200).json({
      message: "แก้ไขข้อมูลอุปกรณ์เรียบร้อย",
      data: result.rows[0],
    });
  } catch (error) {
    const publicError = publicErrorFrom(error);

    if (publicError) {
      return res.status(publicError.status).json({
        code: publicError.code,
        message: publicError.message,
      });
    }

    console.error("Update inventory item failed:", error);

    return res.status(500).json({
      code: "INVENTORY_UPDATE_FAILED",
      message: "ไม่สามารถแก้ไขข้อมูลอุปกรณ์ได้",
    });
  }
});

export default router;
