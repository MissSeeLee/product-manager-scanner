import express from "express";

import pool from "../db.js";

const router = express.Router();

function parseId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

// --------------------------------------------------
// CREATE INVENTORY ITEM + RECEIVE
// POST /api/inventory-items
// --------------------------------------------------

router.post("/", async (req, res) => {
  const {
    productId,
    serialNumber,
    currentLocation,
    warrantyStart = null,
    warrantyEnd = null,
    performedBy = null,
    distributor = null,
    note = "",
  } = req.body;

  const cleanProductId = parseId(productId);

  if (!cleanProductId) {
    return res.status(400).json({
      code: "INVALID_PRODUCT_ID",
      message: "รหัสสินค้าไม่ถูกต้อง",
    });
  }

  const cleanSerialNumber = serialNumber?.trim();
  const cleanLocation = currentLocation?.trim();

  if (!cleanSerialNumber) {
    return res.status(400).json({
      code: "SERIAL_NUMBER_REQUIRED",
      message: "กรุณากรอก Serial Number",
    });
  }

  if (!cleanLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณากรอกตำแหน่งของอุปกรณ์",
    });
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

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
      [productId, cleanSerialNumber, cleanLocation, warrantyStart, warrantyEnd],
    );

    const item = itemResult.rows[0];

    const movementResult = await client.query(
      `
        INSERT INTO stock_movements (
          inventory_item_id,
          movement_type,
          performed_by,
          distributor,
          to_location,
          note
        )
        VALUES ($1, 'RECEIVE', $2, $3, $4, $5)
        RETURNING *
      `,
      [
        item.id,
        performedBy?.trim() || null,
        distributor?.trim() || null,
        cleanLocation,
        note?.trim() || "",
      ],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "เพิ่มอุปกรณ์เข้าคลังสำเร็จ",
      data: {
        item,
        movement: movementResult.rows[0],
      },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Inventory create rollback failed:",
          rollbackError.message,
        );
      }
    }

    if (error.code === "23505") {
      return res.status(409).json({
        code: "SERIAL_NUMBER_ALREADY_EXISTS",
        message: "Serial Number นี้มีอยู่ในระบบแล้ว",
      });
    }

    if (error.code === "23503") {
      return res.status(404).json({
        code: "PRODUCT_NOT_FOUND",
        message: "ไม่พบสินค้าที่เลือก",
      });
    }

    if (error.code === "23514") {
      return res.status(400).json({
        code: "INVALID_INVENTORY_DATA",
        message: "ข้อมูลอุปกรณ์ไม่ถูกต้อง",
      });
    }

    console.error("Create inventory item failed:", error);

    return res.status(500).json({
      code: "INVENTORY_CREATE_FAILED",
      message: "ไม่สามารถเพิ่มอุปกรณ์เข้าคลังได้",
    });
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// GET INVENTORY ITEMS
// GET /api/inventory-items
// --------------------------------------------------

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `
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
          products.category

        FROM inventory_items

        JOIN products
          ON inventory_items.product_id = products.id

        ORDER BY
          inventory_items.created_at DESC,
          inventory_items.id DESC
      `,
    );

    return res.status(200).json({
      data: result.rows,
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
// GET INVENTORY ITEM BY SERIAL
// GET /api/inventory-items/serial/:serial
// --------------------------------------------------

router.get("/serial/:serial", async (req, res) => {
  const serial = req.params.serial?.trim();

  if (!serial) {
    return res.status(400).json({
      code: "SERIAL_NUMBER_REQUIRED",
      message: "กรุณาระบุ Serial Number",
    });
  }

  try {
    const result = await pool.query(
      `
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
          products.category

        FROM inventory_items

        JOIN products
          ON inventory_items.product_id = products.id

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

    return res.status(200).json({
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get inventory item by serial failed:", error);

    return res.status(500).json({
      code: "INVENTORY_GET_FAILED",
      message: "ไม่สามารถโหลดข้อมูลอุปกรณ์ได้",
    });
  }
});

// --------------------------------------------------
// GET INVENTORY ITEM BY ID
// GET /api/inventory-items/:id
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
          products.category

        FROM inventory_items

        JOIN products
          ON inventory_items.product_id = products.id

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

    return res.status(200).json({
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get inventory item failed:", error);

    return res.status(500).json({
      code: "INVENTORY_GET_FAILED",
      message: "ไม่สามารถโหลดข้อมูลอุปกรณ์ได้",
    });
  }
});

// --------------------------------------------------
// UPDATE INVENTORY METADATA
// PUT /api/inventory-items/:id
//
// IMPORTANT:
// Status and location are NOT edited here.
// They must use Movement commands.
// --------------------------------------------------

router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const { serialNumber, warrantyStart = null, warrantyEnd = null } = req.body;

  const cleanSerialNumber = serialNumber?.trim();

  if (!cleanSerialNumber) {
    return res.status(400).json({
      code: "SERIAL_NUMBER_REQUIRED",
      message: "กรุณากรอก Serial Number",
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
      message: "แก้ไขข้อมูลอุปกรณ์สำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        code: "SERIAL_NUMBER_ALREADY_EXISTS",
        message: "Serial Number นี้มีอยู่ในระบบแล้ว",
      });
    }

    if (error.code === "23514") {
      return res.status(400).json({
        code: "INVALID_INVENTORY_DATA",
        message: "ข้อมูลอุปกรณ์ไม่ถูกต้อง",
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
