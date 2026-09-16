import express from "express";

import pool from "../db.js";

const router = express.Router();

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function parseId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function cleanOptionalText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function cleanNote(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

async function rollbackQuietly(client) {
  if (!client) {
    return;
  }

  try {
    await client.query("ROLLBACK");
  } catch (error) {
    console.error("Transaction rollback failed:", error.message);
  }
}

async function getLockedInventoryItem(client, id) {
  const result = await client.query(
    `
      SELECT *
      FROM inventory_items
      WHERE id = $1
      FOR UPDATE
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

// --------------------------------------------------
// ISSUE
// POST /api/inventory-items/:id/issue
//
// IN_STOCK → IN_USE
// --------------------------------------------------

router.post("/:id/issue", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const { performedBy, toLocation, note = "" } = req.body;

  const cleanToLocation = toLocation?.trim();

  if (!cleanToLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งปลายทาง",
    });
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    const item = await getLockedInventoryItem(client, id);

    if (!item) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    if (item.current_status !== "IN_STOCK") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "INVENTORY_NOT_IN_STOCK",
        message: "อุปกรณ์ต้องอยู่ในคลังก่อนจึงจะสามารถเบิกใช้งานได้",
      });
    }

    const movementResult = await client.query(
      `
        INSERT INTO stock_movements (
          inventory_item_id,
          movement_type,
          performed_by,
          from_location,
          to_location,
          note
        )
        VALUES ($1, 'ISSUE', $2, $3, $4, $5)
        RETURNING *
      `,
      [
        id,
        cleanOptionalText(performedBy),
        item.current_location,
        cleanToLocation,
        cleanNote(note),
      ],
    );

    const itemResult = await client.query(
      `
        UPDATE inventory_items
        SET
          current_status = 'IN_USE',
          current_location = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [cleanToLocation, id],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "เบิกอุปกรณ์สำเร็จ",
      data: {
        item: itemResult.rows[0],
        movement: movementResult.rows[0],
      },
    });
  } catch (error) {
    await rollbackQuietly(client);

    console.error("Issue inventory item failed:", error);

    return res.status(500).json({
      code: "INVENTORY_ISSUE_FAILED",
      message: "ไม่สามารถเบิกอุปกรณ์ได้",
    });
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// MOVE
// POST /api/inventory-items/:id/move
//
// Allowed:
// IN_STOCK
// IN_USE
// CLAIM
//
// Status does NOT change.
// --------------------------------------------------

router.post("/:id/move", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const { performedBy, toLocation, note = "" } = req.body;

  const cleanToLocation = toLocation?.trim();

  if (!cleanToLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งปลายทาง",
    });
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    const item = await getLockedInventoryItem(client, id);

    if (!item) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    if (!["IN_STOCK", "IN_USE", "CLAIM"].includes(item.current_status)) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "INVENTORY_MOVE_NOT_ALLOWED",
        message: "สถานะปัจจุบันของอุปกรณ์ไม่อนุญาตให้ย้ายตำแหน่ง",
      });
    }

    if (item.current_location === cleanToLocation) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "INVENTORY_ALREADY_AT_LOCATION",
        message: "อุปกรณ์อยู่ที่ตำแหน่งนี้แล้ว",
      });
    }

    const movementResult = await client.query(
      `
        INSERT INTO stock_movements (
          inventory_item_id,
          movement_type,
          performed_by,
          from_location,
          to_location,
          note
        )
        VALUES ($1, 'MOVE', $2, $3, $4, $5)
        RETURNING *
      `,
      [
        id,
        cleanOptionalText(performedBy),
        item.current_location,
        cleanToLocation,
        cleanNote(note),
      ],
    );

    const itemResult = await client.query(
      `
        UPDATE inventory_items
        SET
          current_location = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [cleanToLocation, id],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "ย้ายตำแหน่งอุปกรณ์สำเร็จ",
      data: {
        item: itemResult.rows[0],
        movement: movementResult.rows[0],
      },
    });
  } catch (error) {
    await rollbackQuietly(client);

    console.error("Move inventory item failed:", error);

    return res.status(500).json({
      code: "INVENTORY_MOVE_FAILED",
      message: "ไม่สามารถย้ายตำแหน่งอุปกรณ์ได้",
    });
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// CLAIM
// POST /api/inventory-items/:id/claim
//
// IN_STOCK → CLAIM
// IN_USE   → CLAIM
// --------------------------------------------------

router.post("/:id/claim", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const { performedBy, toLocation, note = "" } = req.body;

  const cleanToLocation = toLocation?.trim();

  if (!cleanToLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุสถานที่ส่งเคลม",
    });
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    const item = await getLockedInventoryItem(client, id);

    if (!item) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    if (!["IN_STOCK", "IN_USE"].includes(item.current_status)) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "INVENTORY_CLAIM_NOT_ALLOWED",
        message: "สถานะปัจจุบันของอุปกรณ์ไม่สามารถส่งเคลมได้",
      });
    }

    const movementResult = await client.query(
      `
        INSERT INTO stock_movements (
          inventory_item_id,
          movement_type,
          performed_by,
          from_location,
          to_location,
          note
        )
        VALUES ($1, 'CLAIM', $2, $3, $4, $5)
        RETURNING *
      `,
      [
        id,
        cleanOptionalText(performedBy),
        item.current_location,
        cleanToLocation,
        cleanNote(note),
      ],
    );

    const itemResult = await client.query(
      `
        UPDATE inventory_items
        SET
          current_status = 'CLAIM',
          current_location = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [cleanToLocation, id],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "ส่งอุปกรณ์เคลมสำเร็จ",
      data: {
        item: itemResult.rows[0],
        movement: movementResult.rows[0],
      },
    });
  } catch (error) {
    await rollbackQuietly(client);

    console.error("Claim inventory item failed:", error);

    return res.status(500).json({
      code: "INVENTORY_CLAIM_FAILED",
      message: "ไม่สามารถส่งอุปกรณ์เคลมได้",
    });
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// CLAIM RETURN
// POST /api/inventory-items/:id/claim-return
//
// CLAIM → IN_STOCK
//
// Same Serial Number returns.
// --------------------------------------------------

router.post("/:id/claim-return", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const { performedBy, toLocation, note = "" } = req.body;

  const cleanToLocation = toLocation?.trim();

  if (!cleanToLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งที่รับอุปกรณ์กลับ",
    });
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    const item = await getLockedInventoryItem(client, id);

    if (!item) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    if (item.current_status !== "CLAIM") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "INVENTORY_NOT_IN_CLAIM",
        message: "อุปกรณ์ไม่ได้อยู่ในสถานะเคลม",
      });
    }

    const movementResult = await client.query(
      `
          INSERT INTO stock_movements (
            inventory_item_id,
            movement_type,
            performed_by,
            from_location,
            to_location,
            note
          )
          VALUES (
            $1,
            'CLAIM_RETURN',
            $2,
            $3,
            $4,
            $5
          )
          RETURNING *
        `,
      [
        id,
        cleanOptionalText(performedBy),
        item.current_location,
        cleanToLocation,
        cleanNote(note),
      ],
    );

    const itemResult = await client.query(
      `
          UPDATE inventory_items
          SET
            current_status = 'IN_STOCK',
            current_location = $1,
            updated_at = NOW()
          WHERE id = $2
          RETURNING *
        `,
      [cleanToLocation, id],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "รับอุปกรณ์กลับจากการเคลมสำเร็จ",
      data: {
        item: itemResult.rows[0],
        movement: movementResult.rows[0],
      },
    });
  } catch (error) {
    await rollbackQuietly(client);

    console.error("Claim return inventory item failed:", error);

    return res.status(500).json({
      code: "INVENTORY_CLAIM_RETURN_FAILED",
      message: "ไม่สามารถรับอุปกรณ์กลับจากการเคลมได้",
    });
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// REPLACED
// POST /api/inventory-items/:id/replaced
//
// Old item:
// CLAIM → REPLACED
//
// New item:
// new Serial → IN_STOCK
//
// Request:
// {
//   "newSerialNumber": "...",
//   "currentLocation": "...",
//   "warrantyStart": null,
//   "warrantyEnd": null,
//   "performedBy": "...",
//   "distributor": "...",
//   "note": "..."
// }
// --------------------------------------------------

router.post("/:id/replaced", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const {
    newSerialNumber,
    currentLocation,
    warrantyStart = null,
    warrantyEnd = null,
    performedBy = null,
    distributor = null,
    note = "",
  } = req.body;

  const cleanSerialNumber = newSerialNumber?.trim();

  const cleanLocation = currentLocation?.trim();

  if (!cleanSerialNumber) {
    return res.status(400).json({
      code: "SERIAL_NUMBER_REQUIRED",
      message: "กรุณากรอก Serial Number ของอุปกรณ์ทดแทน",
    });
  }

  if (!cleanLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งของอุปกรณ์ทดแทน",
    });
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    const oldItem = await getLockedInventoryItem(client, id);

    if (!oldItem) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    if (oldItem.current_status !== "CLAIM") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "INVENTORY_REPLACE_NOT_ALLOWED",
        message: "อุปกรณ์ต้องอยู่ในสถานะเคลมก่อนจึงจะสามารถเปลี่ยนทดแทนได้",
      });
    }

    const newItemResult = await client.query(
      `
          INSERT INTO inventory_items (
            product_id,
            serial_number,
            current_status,
            current_location,
            warranty_start,
            warranty_end
          )
          VALUES (
            $1,
            $2,
            'IN_STOCK',
            $3,
            $4,
            $5
          )
          RETURNING *
        `,
      [
        oldItem.product_id,
        cleanSerialNumber,
        cleanLocation,
        warrantyStart,
        warrantyEnd,
      ],
    );

    const newItem = newItemResult.rows[0];

    const replacedMovementResult = await client.query(
      `
            INSERT INTO stock_movements (
              inventory_item_id,
              movement_type,
              performed_by,
              from_location,
              to_location,
              note,
              related_inventory_item_id
            )
            VALUES (
              $1,
              'REPLACED',
              $2,
              $3,
              $4,
              $5,
              $6
            )
            RETURNING *
          `,
      [
        oldItem.id,
        cleanOptionalText(performedBy),
        oldItem.current_location,
        cleanLocation,
        cleanNote(note),
        newItem.id,
      ],
    );

    const receiveMovementResult = await client.query(
      `
            INSERT INTO stock_movements (
              inventory_item_id,
              movement_type,
              performed_by,
              distributor,
              to_location,
              note,
              related_inventory_item_id
            )
            VALUES (
              $1,
              'RECEIVE',
              $2,
              $3,
              $4,
              $5,
              $6
            )
            RETURNING *
          `,
      [
        newItem.id,
        cleanOptionalText(performedBy),
        cleanOptionalText(distributor),
        cleanLocation,
        cleanNote(note),
        oldItem.id,
      ],
    );

    const oldItemResult = await client.query(
      `
          UPDATE inventory_items
          SET
            current_status = 'REPLACED',
            updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
      [oldItem.id],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "เปลี่ยนอุปกรณ์ทดแทนสำเร็จ",
      data: {
        replacedItem: oldItemResult.rows[0],
        newItem,
        replacedMovement: replacedMovementResult.rows[0],
        receiveMovement: receiveMovementResult.rows[0],
      },
    });
  } catch (error) {
    await rollbackQuietly(client);

    if (error.code === "23505") {
      return res.status(409).json({
        code: "SERIAL_NUMBER_ALREADY_EXISTS",
        message: "Serial Number ของอุปกรณ์ทดแทนมีอยู่ในระบบแล้ว",
      });
    }

    if (error.code === "23514") {
      return res.status(400).json({
        code: "INVALID_REPLACEMENT_DATA",
        message: "ข้อมูลอุปกรณ์ทดแทนไม่ถูกต้อง",
      });
    }

    console.error("Replace inventory item failed:", error);

    return res.status(500).json({
      code: "INVENTORY_REPLACE_FAILED",
      message: "ไม่สามารถเปลี่ยนอุปกรณ์ทดแทนได้",
    });
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// RETIRE
// POST /api/inventory-items/:id/retire
//
// IN_STOCK
// IN_USE
// CLAIM
//
// → RETIRED
// --------------------------------------------------

router.post("/:id/retire", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const { performedBy, toLocation, note = "" } = req.body;

  const cleanToLocation = toLocation?.trim();

  if (!cleanToLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งที่จัดเก็บอุปกรณ์ปลดระวาง",
    });
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    const item = await getLockedInventoryItem(client, id);

    if (!item) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    if (!["IN_STOCK", "IN_USE", "CLAIM"].includes(item.current_status)) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "INVENTORY_RETIRE_NOT_ALLOWED",
        message: "สถานะปัจจุบันของอุปกรณ์ไม่สามารถปลดระวางได้",
      });
    }

    const movementResult = await client.query(
      `
          INSERT INTO stock_movements (
            inventory_item_id,
            movement_type,
            performed_by,
            from_location,
            to_location,
            note
          )
          VALUES (
            $1,
            'RETIRE',
            $2,
            $3,
            $4,
            $5
          )
          RETURNING *
        `,
      [
        id,
        cleanOptionalText(performedBy),
        item.current_location,
        cleanToLocation,
        cleanNote(note),
      ],
    );

    const itemResult = await client.query(
      `
          UPDATE inventory_items
          SET
            current_status = 'RETIRED',
            current_location = $1,
            updated_at = NOW()
          WHERE id = $2
          RETURNING *
        `,
      [cleanToLocation, id],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "ปลดระวางอุปกรณ์สำเร็จ",
      data: {
        item: itemResult.rows[0],
        movement: movementResult.rows[0],
      },
    });
  } catch (error) {
    await rollbackQuietly(client);

    console.error("Retire inventory item failed:", error);

    return res.status(500).json({
      code: "INVENTORY_RETIRE_FAILED",
      message: "ไม่สามารถปลดระวางอุปกรณ์ได้",
    });
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// MOVEMENT HISTORY
// GET /api/inventory-items/:id/movements
// --------------------------------------------------

router.get("/:id/movements", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  try {
    const itemResult = await pool.query(
      `
          SELECT
            inventory_items.id,
            inventory_items.product_id,
            inventory_items.serial_number,
            inventory_items.current_status,
            inventory_items.current_location,

            products.product_name,
            products.brand,
            products.part_number

          FROM inventory_items

          JOIN products
            ON inventory_items.product_id =
               products.id

          WHERE inventory_items.id = $1
        `,
      [id],
    );

    if (itemResult.rowCount === 0) {
      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    const movementResult = await pool.query(
      `
          SELECT
            stock_movements.id,
            stock_movements.inventory_item_id,
            stock_movements.movement_type,
            stock_movements.movement_date,
            stock_movements.performed_by,
            stock_movements.distributor,
            stock_movements.from_location,
            stock_movements.to_location,
            stock_movements.note,
            stock_movements.related_inventory_item_id,

            related_item.serial_number
              AS related_serial_number

          FROM stock_movements

          LEFT JOIN inventory_items AS related_item
            ON stock_movements.related_inventory_item_id =
               related_item.id

          WHERE stock_movements.inventory_item_id = $1

          ORDER BY
            stock_movements.movement_date ASC,
            stock_movements.id ASC
        `,
      [id],
    );

    return res.status(200).json({
      data: {
        item: itemResult.rows[0],
        movements: movementResult.rows,
      },
    });
  } catch (error) {
    console.error("Get inventory movement history failed:", error);

    return res.status(500).json({
      code: "MOVEMENT_HISTORY_FAILED",
      message: "ไม่สามารถโหลดประวัติการเคลื่อนไหวของอุปกรณ์ได้",
    });
  }
});

export default router;
