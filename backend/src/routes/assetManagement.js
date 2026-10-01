import express from "express";

import pool from "../db.js";

const router = express.Router();

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cleanText(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function parseDateOnly(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return value;
}

function normalizeTimestamp(value, timezoneOffsetMinutes = 0) {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const midnightUtc = Date.UTC(year, month - 1, day);
    const check = new Date(midnightUtc);
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      return undefined;
    }
    const offset = Number(timezoneOffsetMinutes) || 0;
    return new Date(midnightUtc - offset * 60_000).toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function actor(req) {
  return {
    userId: Number(req.user?.id) || null,
    username: cleanText(req.user?.username),
    displayName:
      cleanText(req.user?.displayName) || cleanText(req.user?.username),
  };
}

async function writeAudit(
  client,
  req,
  { entityType, entityId, action, reason, beforeData, afterData },
) {
  const who = actor(req);
  await client.query(
    `
      INSERT INTO record_change_log (
        entity_type,
        entity_id,
        action,
        reason,
        before_data,
        after_data,
        user_id,
        username,
        display_name
      )
      VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)
    `,
    [
      entityType,
      entityId,
      action,
      cleanText(reason),
      beforeData == null ? null : JSON.stringify(beforeData),
      afterData == null ? null : JSON.stringify(afterData),
      who.userId,
      who.username,
      who.displayName,
    ],
  );
}

async function resolveProduct(client, payload) {
  const productId = parseId(payload?.productId);
  if (productId) {
    const result = await client.query(
      `SELECT * FROM products WHERE id = $1`,
      [productId],
    );
    if (result.rowCount === 0) {
      const error = new Error("PRODUCT_NOT_FOUND");
      error.publicCode = "PRODUCT_NOT_FOUND";
      error.publicMessage = "ไม่พบรุ่นสินค้าที่เลือก";
      error.httpStatus = 404;
      throw error;
    }
    if (result.rows[0].is_active === false) {
      const error = new Error("PRODUCT_INACTIVE");
      error.publicCode = "PRODUCT_INACTIVE";
      error.publicMessage = "รุ่นสินค้านี้ถูก Archive แล้ว กรุณาเลือกรุ่นที่เปิดใช้งาน";
      error.httpStatus = 409;
      throw error;
    }
    return productId;
  }

  const product = payload?.product || {};
  const productName = cleanText(product.productName);
  const brand = cleanText(product.brand);
  const partNumber = cleanText(product.partNumber);
  const description = cleanText(product.description) || "";
  const category = cleanText(product.category) || "ทั่วไป";

  if (!productName || !brand || !partNumber) {
    const error = new Error("PRODUCT_REQUIRED_FIELDS_MISSING");
    error.publicCode = "PRODUCT_REQUIRED_FIELDS_MISSING";
    error.publicMessage = "กรุณากรอกชื่อรุ่น ยี่ห้อ และ Part Number ให้ครบ";
    error.httpStatus = 400;
    throw error;
  }

  const existing = await client.query(
    `
      SELECT *
      FROM products
      WHERE brand = $1
        AND part_number = $2
      LIMIT 1
    `,
    [brand, partNumber],
  );

  if (existing.rowCount > 0) {
    const error = new Error("PRODUCT_ALREADY_EXISTS");
    error.publicCode = "PRODUCT_ALREADY_EXISTS";
    error.publicMessage =
      "Brand + Part Number นี้มีอยู่แล้ว กรุณาเลือกรุ่นเดิมจาก Product Master";
    error.httpStatus = 409;
    throw error;
  }

  const created = await client.query(
    `
      INSERT INTO products (
        product_name,
        brand,
        part_number,
        description,
        category,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,true)
      RETURNING *
    `,
    [productName, brand, partNumber, description, category],
  );

  return Number(created.rows[0].id);
}

function sendKnownError(res, error) {
  if (!error?.publicCode) return false;
  res.status(error.httpStatus || 400).json({
    code: error.publicCode,
    message: error.publicMessage || "ข้อมูลไม่ถูกต้อง",
  });
  return true;
}

// Atomic Product + Physical Asset + RECEIVE.
// The Location Master guard runs before this route.
router.post("/intake-v2", async (req, res) => {
  const inventory = req.body?.inventory || {};
  const serialNumber = cleanText(inventory.serialNumber);
  const currentLocation = cleanText(inventory.currentLocation);
  const warrantyStart = parseDateOnly(inventory.warrantyStart);
  const warrantyEnd = parseDateOnly(inventory.warrantyEnd);
  const receivedAt = normalizeTimestamp(
    inventory.receivedAt,
    inventory.timezoneOffsetMinutes,
  );
  const receivedBy = cleanText(inventory.performedBy);
  const distributor = cleanText(inventory.distributor);
  const note =
    typeof inventory.note === "string" ? inventory.note.trim() : "";

  if (!serialNumber) {
    return res.status(400).json({
      code: "SERIAL_NUMBER_REQUIRED",
      message: "กรุณากรอก Serial Number",
    });
  }
  if (!currentLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาเลือกตำแหน่งเริ่มต้น",
    });
  }
  if (warrantyStart === undefined || warrantyEnd === undefined) {
    return res.status(400).json({
      code: "INVALID_WARRANTY_DATE",
      message: "วันที่รับประกันไม่ถูกต้อง",
    });
  }
  if (warrantyStart && warrantyEnd && warrantyEnd < warrantyStart) {
    return res.status(400).json({
      code: "INVALID_WARRANTY_RANGE",
      message: "วันสิ้นสุดประกันต้องไม่มาก่อนวันเริ่มประกัน",
    });
  }
  if (receivedAt === undefined) {
    return res.status(400).json({
      code: "INVALID_RECEIVED_DATE",
      message: "วันที่รับเข้าไม่ถูกต้อง",
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const productId = await resolveProduct(client, req.body);

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
        VALUES ($1,$2,'IN_STOCK',$3,$4,$5)
        RETURNING *
      `,
      [productId, serialNumber, currentLocation, warrantyStart, warrantyEnd],
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
        receivedAt,
        receivedBy,
        distributor,
        currentLocation,
        note,
      ],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "ลงทะเบียนอุปกรณ์และบันทึก RECEIVE เรียบร้อย",
      data: {
        item,
        movement: movementResult.rows[0],
      },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    if (sendKnownError(res, error)) return;

    if (error.code === "23505") {
      return res.status(409).json({
        code: "SERIAL_NUMBER_ALREADY_EXISTS",
        message: "Serial Number นี้มีอยู่ในระบบแล้ว",
      });
    }

    console.error("Atomic intake failed:", error);
    return res.status(500).json({
      code: "ATOMIC_INTAKE_FAILED",
      message: "ไม่สามารถลงทะเบียนอุปกรณ์ได้",
    });
  } finally {
    client?.release();
  }
});

router.get("/:id/intake", async (req, res) => {
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
        SELECT
          i.id,
          i.product_id,
          i.serial_number,
          i.current_status,
          i.current_location,
          i.warranty_start,
          i.warranty_end,
          p.product_name,
          p.brand,
          p.part_number,
          r.id AS receive_movement_id,
          r.movement_date AS received_at,
          r.performed_by AS received_by,
          r.distributor,
          r.to_location AS received_location,
          r.note AS receive_note,
          (
            SELECT COUNT(*)::int
            FROM stock_movements later
            WHERE later.inventory_item_id = i.id
              AND later.id <> r.id
          ) AS later_movement_count
        FROM inventory_items i
        JOIN products p ON p.id = i.product_id
        LEFT JOIN LATERAL (
          SELECT sm.*
          FROM stock_movements sm
          WHERE sm.inventory_item_id = i.id
            AND sm.movement_type = 'RECEIVE'
          ORDER BY sm.movement_date ASC, sm.id ASC
          LIMIT 1
        ) r ON TRUE
        WHERE i.id = $1
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
    console.error("Get intake correction data failed:", error);
    return res.status(500).json({
      code: "INTAKE_GET_FAILED",
      message: "ไม่สามารถโหลดข้อมูลรับเข้าได้",
    });
  }
});

router.get("/:id/change-history", async (req, res) => {
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
        SELECT *
        FROM record_change_log
        WHERE entity_type = 'INVENTORY_ITEM'
          AND entity_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT 100
      `,
      [id],
    );
    return res.status(200).json({ data: result.rows });
  } catch (error) {
    console.error("Get change history failed:", error);
    return res.status(500).json({
      code: "CHANGE_HISTORY_GET_FAILED",
      message: "ไม่สามารถโหลดประวัติการแก้ไขข้อมูลได้",
    });
  }
});

// Basic UI: one Edit action for metadata + intake correction.
// The backend keeps the existing lifecycle/history rules and writes one audit row.
router.put("/:id/edit", async (req, res) => {
  const id = parseId(req.params.id);
  const serialNumber = cleanText(req.body?.serialNumber);
  const warrantyStart = parseDateOnly(req.body?.warrantyStart);
  const warrantyEnd = parseDateOnly(req.body?.warrantyEnd);
  const reason = cleanText(req.body?.reason) || "แก้ไขข้อมูลอุปกรณ์";

  const hasIntakeEdit = [
    "productId",
    "currentLocation",
    "receivedAt",
    "receivedBy",
    "distributor",
    "note",
  ].some((key) => Object.prototype.hasOwnProperty.call(req.body || {}, key));

  const productId = hasIntakeEdit ? parseId(req.body?.productId) : null;
  const currentLocation = hasIntakeEdit
    ? cleanText(req.body?.currentLocation)
    : null;
  const receivedAt = hasIntakeEdit
    ? normalizeTimestamp(
        req.body?.receivedAt,
        req.body?.timezoneOffsetMinutes,
      )
    : null;
  const receivedBy = hasIntakeEdit ? cleanText(req.body?.receivedBy) : null;
  const distributor = hasIntakeEdit
    ? cleanText(req.body?.distributor)
    : null;
  const note =
    hasIntakeEdit && typeof req.body?.note === "string"
      ? req.body.note.trim()
      : "";

  if (!id) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  if (!serialNumber) {
    return res.status(400).json({
      code: "SERIAL_NUMBER_REQUIRED",
      message: "กรุณากรอก Serial Number",
    });
  }

  if (warrantyStart === undefined || warrantyEnd === undefined) {
    return res.status(400).json({
      code: "INVALID_WARRANTY_DATE",
      message: "วันที่รับประกันไม่ถูกต้อง",
    });
  }

  if (warrantyStart && warrantyEnd && warrantyEnd < warrantyStart) {
    return res.status(400).json({
      code: "INVALID_WARRANTY_RANGE",
      message: "วันสิ้นสุดประกันต้องไม่มาก่อนวันเริ่มประกัน",
    });
  }

  if (
    hasIntakeEdit &&
    (!productId || !currentLocation || !receivedAt)
  ) {
    return res.status(400).json({
      code: "INVALID_ASSET_EDIT_DATA",
      message: "กรุณากรอกข้อมูลอุปกรณ์ให้ครบ",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const currentResult = await client.query(
      `SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE`,
      [id],
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    const beforeItem = currentResult.rows[0];
    let beforeReceive = null;
    let updatedReceive = null;
    let laterMovementCount = 0;

    if (hasIntakeEdit) {
      const productResult = await client.query(
        `SELECT id, is_active FROM products WHERE id = $1`,
        [productId],
      );

      if (productResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          code: "PRODUCT_NOT_FOUND",
          message: "ไม่พบรุ่นสินค้าที่เลือก",
        });
      }

      if (productResult.rows[0].is_active === false) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          code: "PRODUCT_INACTIVE",
          message: "รุ่นสินค้านี้ถูกปิดใช้งานแล้ว",
        });
      }

      const receiveResult = await client.query(
        `
          SELECT *
          FROM stock_movements
          WHERE inventory_item_id = $1
            AND movement_type = 'RECEIVE'
          ORDER BY movement_date ASC, id ASC
          LIMIT 1
          FOR UPDATE
        `,
        [id],
      );

      if (receiveResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          code: "RECEIVE_HISTORY_MISSING",
          message: "ไม่พบประวัติรับเข้าเดิม",
        });
      }

      beforeReceive = receiveResult.rows[0];

      const laterResult = await client.query(
        `
          SELECT COUNT(*)::int AS count
          FROM stock_movements
          WHERE inventory_item_id = $1
            AND id <> $2
        `,
        [id, beforeReceive.id],
      );

      laterMovementCount = Number(laterResult.rows[0]?.count || 0);

      const receiveUpdate = await client.query(
        `
          UPDATE stock_movements
          SET
            movement_date = $1::timestamptz,
            performed_by = $2,
            distributor = $3,
            to_location = $4,
            note = $5
          WHERE id = $6
          RETURNING *
        `,
        [
          receivedAt,
          receivedBy,
          distributor,
          currentLocation,
          note,
          beforeReceive.id,
        ],
      );

      updatedReceive = receiveUpdate.rows[0];
    }

    const updatedItemResult = await client.query(
      `
        UPDATE inventory_items
        SET
          product_id = COALESCE($1, product_id),
          serial_number = $2,
          current_location = CASE
            WHEN $3::boolean = true AND $4::int = 0 THEN $5
            ELSE current_location
          END,
          warranty_start = $6,
          warranty_end = $7,
          updated_at = NOW()
        WHERE id = $8
        RETURNING *
      `,
      [
        productId,
        serialNumber,
        hasIntakeEdit,
        laterMovementCount,
        currentLocation,
        warrantyStart,
        warrantyEnd,
        id,
      ],
    );

    const updatedItem = updatedItemResult.rows[0];

    await writeAudit(client, req, {
      entityType: "INVENTORY_ITEM",
      entityId: id,
      action: "EDIT_ASSET",
      reason,
      beforeData: {
        item: beforeItem,
        receive: beforeReceive,
      },
      afterData: {
        item: updatedItem,
        receive: updatedReceive,
        later_movement_count: laterMovementCount,
      },
    });

    await client.query("COMMIT");

    return res.status(200).json({
      message: "บันทึกข้อมูลอุปกรณ์เรียบร้อย",
      data: {
        item: updatedItem,
        receive: updatedReceive,
        laterMovementCount,
      },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    if (error.code === "23505") {
      return res.status(409).json({
        code: "SERIAL_NUMBER_ALREADY_EXISTS",
        message: "Serial Number นี้มีอยู่ในระบบแล้ว",
      });
    }

    console.error("Basic asset edit failed:", error);
    return res.status(500).json({
      code: "ASSET_EDIT_FAILED",
      message: "ไม่สามารถบันทึกข้อมูลอุปกรณ์ได้",
    });
  } finally {
    client?.release();
  }
});


router.put("/:id/metadata", async (req, res) => {
  const id = parseId(req.params.id);
  const serialNumber = cleanText(req.body?.serialNumber);
  const warrantyStart = parseDateOnly(req.body?.warrantyStart);
  const warrantyEnd = parseDateOnly(req.body?.warrantyEnd);
  const reason = cleanText(req.body?.reason);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }
  if (!serialNumber) {
    return res.status(400).json({
      code: "SERIAL_NUMBER_REQUIRED",
      message: "กรุณากรอก Serial Number",
    });
  }
  if (!reason) {
    return res.status(400).json({
      code: "CHANGE_REASON_REQUIRED",
      message: "กรุณาระบุเหตุผลการแก้ไข",
    });
  }
  if (warrantyStart === undefined || warrantyEnd === undefined) {
    return res.status(400).json({
      code: "INVALID_WARRANTY_DATE",
      message: "วันที่รับประกันไม่ถูกต้อง",
    });
  }
  if (warrantyStart && warrantyEnd && warrantyEnd < warrantyStart) {
    return res.status(400).json({
      code: "INVALID_WARRANTY_RANGE",
      message: "วันสิ้นสุดประกันต้องไม่มาก่อนวันเริ่มประกัน",
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const current = await client.query(
      `SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (current.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    const before = current.rows[0];
    const updated = await client.query(
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
      [serialNumber, warrantyStart, warrantyEnd, id],
    );

    await writeAudit(client, req, {
      entityType: "INVENTORY_ITEM",
      entityId: id,
      action: "EDIT_METADATA",
      reason,
      beforeData: {
        serial_number: before.serial_number,
        warranty_start: before.warranty_start,
        warranty_end: before.warranty_end,
      },
      afterData: {
        serial_number: updated.rows[0].serial_number,
        warranty_start: updated.rows[0].warranty_start,
        warranty_end: updated.rows[0].warranty_end,
      },
    });

    await client.query("COMMIT");
    return res.status(200).json({
      message: "แก้ไขข้อมูลอุปกรณ์เรียบร้อย",
      data: updated.rows[0],
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    if (error.code === "23505") {
      return res.status(409).json({
        code: "SERIAL_NUMBER_ALREADY_EXISTS",
        message: "Serial Number นี้มีอยู่ในระบบแล้ว",
      });
    }

    console.error("Edit asset metadata failed:", error);
    return res.status(500).json({
      code: "ASSET_METADATA_UPDATE_FAILED",
      message: "ไม่สามารถแก้ไขข้อมูลอุปกรณ์ได้",
    });
  } finally {
    client?.release();
  }
});

router.put("/:id/intake-correction", async (req, res) => {
  const id = parseId(req.params.id);
  const productId = parseId(req.body?.productId);
  const currentLocation = cleanText(req.body?.currentLocation);
  const receivedAt = normalizeTimestamp(
    req.body?.receivedAt,
    req.body?.timezoneOffsetMinutes,
  );
  const receivedBy = cleanText(req.body?.receivedBy);
  const distributor = cleanText(req.body?.distributor);
  const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
  const reason = cleanText(req.body?.reason);

  if (!id || !productId) {
    return res.status(400).json({
      code: "INVALID_CORRECTION_DATA",
      message: "ข้อมูลอุปกรณ์หรือรุ่นสินค้าไม่ถูกต้อง",
    });
  }
  if (!currentLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาเลือกสถานที่รับเข้า",
    });
  }
  if (!reason) {
    return res.status(400).json({
      code: "CHANGE_REASON_REQUIRED",
      message: "กรุณาระบุเหตุผลการแก้ข้อมูลรับเข้า",
    });
  }
  if (receivedAt === undefined) {
    return res.status(400).json({
      code: "INVALID_RECEIVED_DATE",
      message: "วันที่รับเข้าไม่ถูกต้อง",
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const itemResult = await client.query(
      `SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (itemResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    const productResult = await client.query(
      `SELECT id, is_active FROM products WHERE id = $1`,
      [productId],
    );
    if (productResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: "PRODUCT_NOT_FOUND",
        message: "ไม่พบรุ่นสินค้าที่เลือก",
      });
    }

    const receiveResult = await client.query(
      `
        SELECT *
        FROM stock_movements
        WHERE inventory_item_id = $1
          AND movement_type = 'RECEIVE'
        ORDER BY movement_date ASC, id ASC
        LIMIT 1
        FOR UPDATE
      `,
      [id],
    );
    if (receiveResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        code: "RECEIVE_HISTORY_MISSING",
        message: "ไม่พบประวัติ RECEIVE เดิม",
      });
    }

    const receive = receiveResult.rows[0];
    const laterResult = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM stock_movements
        WHERE inventory_item_id = $1
          AND id <> $2
      `,
      [id, receive.id],
    );
    const laterMovementCount = Number(laterResult.rows[0]?.count || 0);
    const beforeItem = itemResult.rows[0];

    const updatedReceive = await client.query(
      `
        UPDATE stock_movements
        SET
          movement_date = COALESCE($1::timestamptz, movement_date),
          performed_by = $2,
          distributor = $3,
          to_location = $4,
          note = $5
        WHERE id = $6
        RETURNING *
      `,
      [
        receivedAt,
        receivedBy,
        distributor,
        currentLocation,
        note,
        receive.id,
      ],
    );

    const updatedItem = await client.query(
      `
        UPDATE inventory_items
        SET
          product_id = $1,
          current_location = CASE
            WHEN $2::int = 0 THEN $3
            ELSE current_location
          END,
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `,
      [productId, laterMovementCount, currentLocation, id],
    );

    await writeAudit(client, req, {
      entityType: "INVENTORY_ITEM",
      entityId: id,
      action: "CORRECT_INTAKE",
      reason,
      beforeData: {
        product_id: beforeItem.product_id,
        current_location: beforeItem.current_location,
        receive: {
          movement_date: receive.movement_date,
          performed_by: receive.performed_by,
          distributor: receive.distributor,
          to_location: receive.to_location,
          note: receive.note,
        },
      },
      afterData: {
        product_id: updatedItem.rows[0].product_id,
        current_location: updatedItem.rows[0].current_location,
        later_movement_count: laterMovementCount,
        receive: {
          movement_date: updatedReceive.rows[0].movement_date,
          performed_by: updatedReceive.rows[0].performed_by,
          distributor: updatedReceive.rows[0].distributor,
          to_location: updatedReceive.rows[0].to_location,
          note: updatedReceive.rows[0].note,
        },
      },
    });

    await client.query("COMMIT");

    return res.status(200).json({
      message:
        laterMovementCount === 0
          ? "แก้ข้อมูล RECEIVE และตำแหน่งปัจจุบันเรียบร้อย"
          : "แก้ข้อมูล RECEIVE เรียบร้อย โดยคงตำแหน่งปัจจุบันจาก Movement ล่าสุด",
      data: {
        item: updatedItem.rows[0],
        receive: updatedReceive.rows[0],
        laterMovementCount,
      },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }
    console.error("Correct intake failed:", error);
    return res.status(500).json({
      code: "INTAKE_CORRECTION_FAILED",
      message: "ไม่สามารถแก้ข้อมูลรับเข้าได้",
    });
  } finally {
    client?.release();
  }
});

// Safe-delete equivalent: only a never-used mistaken registration.
// Global middleware allows OPERATOR writes under /inventory-items, so this route
// explicitly narrows void to ADMIN.
router.delete("/:id/void", async (req, res) => {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({
      code: "FORBIDDEN",
      message: "เฉพาะ Admin เท่านั้นที่ยกเลิกการลงทะเบียนได้",
    });
  }

  const id = parseId(req.params.id);
  const reason = cleanText(req.body?.reason);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }
  if (!reason) {
    return res.status(400).json({
      code: "VOID_REASON_REQUIRED",
      message: "กรุณาระบุเหตุผลการยกเลิกการลงทะเบียน",
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const itemResult = await client.query(
      `SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (itemResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    const item = itemResult.rows[0];
    const movementResult = await client.query(
      `
        SELECT *
        FROM stock_movements
        WHERE inventory_item_id = $1
        ORDER BY id ASC
        FOR UPDATE
      `,
      [id],
    );

    const safe =
      item.current_status === "IN_STOCK" &&
      item.current_project_id == null &&
      item.current_issue_operation_id == null &&
      movementResult.rowCount === 1 &&
      movementResult.rows[0].movement_type === "RECEIVE";

    if (!safe) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        code: "ASSET_VOID_NOT_ALLOWED",
        message:
          "อุปกรณ์นี้มีประวัติใช้งานแล้ว จึงยกเลิกการลงทะเบียนไม่ได้ กรุณาใช้ RETIRE/REPLACED",
      });
    }

    await writeAudit(client, req, {
      entityType: "INVENTORY_ITEM",
      entityId: id,
      action: "VOID_REGISTRATION",
      reason,
      beforeData: {
        item,
        receive: movementResult.rows[0],
      },
      afterData: { voided: true },
    });

    await client.query(
      `DELETE FROM stock_movements WHERE inventory_item_id = $1`,
      [id],
    );
    await client.query(
      `DELETE FROM inventory_items WHERE id = $1`,
      [id],
    );

    await client.query("COMMIT");
    return res.status(200).json({
      message: "ยกเลิกการลงทะเบียนที่บันทึกผิดเรียบร้อย",
      data: { id },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }
    console.error("Void registration failed:", error);
    return res.status(500).json({
      code: "ASSET_VOID_FAILED",
      message: "ไม่สามารถยกเลิกการลงทะเบียนได้",
    });
  } finally {
    client?.release();
  }
});

export default router;
