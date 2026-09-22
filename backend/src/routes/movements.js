import express from "express";

import pool from "../db.js";

const router = express.Router();

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cleanText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const clean = value.trim();
  return clean || null;
}

async function getLockedItem(client, id) {
  const result = await client.query(
    `
      SELECT *
      FROM inventory_items
      WHERE id = $1
      FOR UPDATE
    `,
    [id],
  );

  return result.rows[0] || null;
}

async function rollbackQuietly(client) {
  try {
    await client.query("ROLLBACK");
  } catch (error) {
    console.error("Movement rollback failed:", error);
  }
}

function invalidId(res) {
  return res.status(400).json({
    code: "INVALID_INVENTORY_ID",
    message: "รหัสอุปกรณ์ไม่ถูกต้อง",
  });
}

function itemNotFound(res) {
  return res.status(404).json({
    code: "INVENTORY_NOT_FOUND",
    message: "ไม่พบอุปกรณ์ที่ต้องการ",
  });
}

function invalidState(res, message) {
  return res.status(409).json({
    code: "INVALID_INVENTORY_STATE",
    message,
  });
}

function movementFailed(res, code, message, error) {
  console.error(code, error);

  return res.status(500).json({
    code,
    message,
  });
}

async function insertMovement(
  client,
  {
    inventoryItemId,
    movementType,
    performedBy,
    distributor = null,
    fromLocation = null,
    toLocation = null,
    note = "",
    relatedInventoryItemId = null,
    movementDate = null,
  },
) {
  const result = await client.query(
    `
      INSERT INTO stock_movements (
        inventory_item_id,
        movement_type,
        movement_date,
        performed_by,
        distributor,
        from_location,
        to_location,
        note,
        related_inventory_item_id
      )
      VALUES (
        $1,
        $2,
        COALESCE($3::timestamptz, NOW()),
        $4,
        $5,
        $6,
        $7,
        $8,
        $9
      )
      RETURNING *
    `,
    [
      inventoryItemId,
      movementType,
      movementDate,
      cleanText(performedBy),
      cleanText(distributor),
      fromLocation,
      toLocation,
      typeof note === "string" ? note.trim() : "",
      relatedInventoryItemId,
    ],
  );

  return result.rows[0];
}

// --------------------------------------------------
// ISSUE: IN_STOCK -> IN_USE
// --------------------------------------------------
router.post("/:id/issue", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return invalidId(res);
  }

  const toLocation = cleanText(req.body?.toLocation);

  if (!toLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งที่นำอุปกรณ์ไปใช้งาน",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const item = await getLockedItem(client, id);

    if (!item) {
      await rollbackQuietly(client);
      return itemNotFound(res);
    }

    if (item.current_status !== "IN_STOCK") {
      await rollbackQuietly(client);
      return invalidState(res, "เบิกใช้งานได้เฉพาะอุปกรณ์ที่อยู่ในคลัง");
    }

    const movement = await insertMovement(client, {
      inventoryItemId: id,
      movementType: "ISSUE",
      performedBy: req.body?.performedBy,
      fromLocation: item.current_location,
      toLocation,
      note: req.body?.note,
    });

    const updated = await client.query(
      `
        UPDATE inventory_items
        SET
          current_status = 'IN_USE',
          current_location = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [toLocation, id],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "เบิกอุปกรณ์ไปใช้งานเรียบร้อย",
      data: {
        item: updated.rows[0],
        movement,
      },
    });
  } catch (error) {
    if (client) {
      await rollbackQuietly(client);
    }

    return movementFailed(
      res,
      "ISSUE_FAILED",
      "ไม่สามารถเบิกอุปกรณ์ไปใช้งานได้",
      error,
    );
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// RETURN: IN_USE -> IN_STOCK
// --------------------------------------------------
router.post("/:id/return", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return invalidId(res);
  }

  const toLocation = cleanText(req.body?.toLocation);

  if (!toLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งที่รับคืนอุปกรณ์",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const item = await getLockedItem(client, id);

    if (!item) {
      await rollbackQuietly(client);
      return itemNotFound(res);
    }

    if (item.current_status !== "IN_USE") {
      await rollbackQuietly(client);
      return invalidState(res, "รับคืนเข้าคลังได้เฉพาะอุปกรณ์ที่กำลังใช้งาน");
    }

    const movement = await insertMovement(client, {
      inventoryItemId: id,
      movementType: "RETURN",
      performedBy: req.body?.performedBy,
      fromLocation: item.current_location,
      toLocation,
      note: req.body?.note,
    });

    const updated = await client.query(
      `
        UPDATE inventory_items
        SET
          current_status = 'IN_STOCK',
          current_location = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [toLocation, id],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "รับคืนอุปกรณ์เข้าคลังเรียบร้อย",
      data: {
        item: updated.rows[0],
        movement,
      },
    });
  } catch (error) {
    if (client) {
      await rollbackQuietly(client);
    }

    return movementFailed(
      res,
      "RETURN_FAILED",
      "ไม่สามารถรับคืนอุปกรณ์เข้าคลังได้",
      error,
    );
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// MOVE: status unchanged
// --------------------------------------------------
router.post("/:id/move", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return invalidId(res);
  }

  const toLocation = cleanText(req.body?.toLocation);

  if (!toLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งปลายทาง",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const item = await getLockedItem(client, id);

    if (!item) {
      await rollbackQuietly(client);
      return itemNotFound(res);
    }

    if (!["IN_STOCK", "IN_USE", "CLAIM"].includes(item.current_status)) {
      await rollbackQuietly(client);
      return invalidState(res, "สถานะปัจจุบันไม่อนุญาตให้ย้ายตำแหน่ง");
    }

    const movement = await insertMovement(client, {
      inventoryItemId: id,
      movementType: "MOVE",
      performedBy: req.body?.performedBy,
      fromLocation: item.current_location,
      toLocation,
      note: req.body?.note,
    });

    const updated = await client.query(
      `
        UPDATE inventory_items
        SET current_location = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [toLocation, id],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "ย้ายตำแหน่งอุปกรณ์เรียบร้อย",
      data: {
        item: updated.rows[0],
        movement,
      },
    });
  } catch (error) {
    if (client) {
      await rollbackQuietly(client);
    }

    return movementFailed(
      res,
      "MOVE_FAILED",
      "ไม่สามารถย้ายตำแหน่งอุปกรณ์ได้",
      error,
    );
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// CLAIM: IN_STOCK / IN_USE -> CLAIM
// --------------------------------------------------
router.post("/:id/claim", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return invalidId(res);
  }

  const toLocation = cleanText(req.body?.toLocation);

  if (!toLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุปลายทางการเคลม",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const item = await getLockedItem(client, id);

    if (!item) {
      await rollbackQuietly(client);
      return itemNotFound(res);
    }

    if (!["IN_STOCK", "IN_USE"].includes(item.current_status)) {
      await rollbackQuietly(client);
      return invalidState(res, "สถานะปัจจุบันไม่อนุญาตให้ส่งเคลม");
    }

    const movement = await insertMovement(client, {
      inventoryItemId: id,
      movementType: "CLAIM",
      performedBy: req.body?.performedBy,
      fromLocation: item.current_location,
      toLocation,
      note: req.body?.note,
    });

    const updated = await client.query(
      `
        UPDATE inventory_items
        SET
          current_status = 'CLAIM',
          current_location = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [toLocation, id],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "ส่งอุปกรณ์เคลมเรียบร้อย",
      data: {
        item: updated.rows[0],
        movement,
      },
    });
  } catch (error) {
    if (client) {
      await rollbackQuietly(client);
    }

    return movementFailed(
      res,
      "CLAIM_FAILED",
      "ไม่สามารถส่งอุปกรณ์เคลมได้",
      error,
    );
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// CLAIM RETURN: CLAIM -> IN_STOCK
// --------------------------------------------------
router.post("/:id/claim-return", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return invalidId(res);
  }

  const toLocation = cleanText(req.body?.toLocation);

  if (!toLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งรับคืนจากเคลม",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const item = await getLockedItem(client, id);

    if (!item) {
      await rollbackQuietly(client);
      return itemNotFound(res);
    }

    if (item.current_status !== "CLAIM") {
      await rollbackQuietly(client);
      return invalidState(res, "รับคืนจากเคลมได้เฉพาะอุปกรณ์ที่อยู่ระหว่างเคลม");
    }

    const movement = await insertMovement(client, {
      inventoryItemId: id,
      movementType: "CLAIM_RETURN",
      performedBy: req.body?.performedBy,
      fromLocation: item.current_location,
      toLocation,
      note: req.body?.note,
    });

    const updated = await client.query(
      `
        UPDATE inventory_items
        SET
          current_status = 'IN_STOCK',
          current_location = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [toLocation, id],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "รับคืนอุปกรณ์จากเคลมเรียบร้อย",
      data: {
        item: updated.rows[0],
        movement,
      },
    });
  } catch (error) {
    if (client) {
      await rollbackQuietly(client);
    }

    return movementFailed(
      res,
      "CLAIM_RETURN_FAILED",
      "ไม่สามารถรับคืนอุปกรณ์จากเคลมได้",
      error,
    );
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// REPLACED: CLAIM -> old REPLACED + new IN_STOCK
// --------------------------------------------------
router.post("/:id/replaced", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return invalidId(res);
  }

  const newSerialNumber = cleanText(req.body?.newSerialNumber);
  const toLocation = cleanText(req.body?.toLocation);
  const warrantyStart = req.body?.warrantyStart || null;
  const warrantyEnd = req.body?.warrantyEnd || null;

  if (!newSerialNumber) {
    return res.status(400).json({
      code: "SERIAL_NUMBER_REQUIRED",
      message: "กรุณาระบุ Serial Number ของอุปกรณ์ทดแทน",
    });
  }

  if (!toLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งของอุปกรณ์ทดแทน",
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

    const oldItem = await getLockedItem(client, id);

    if (!oldItem) {
      await rollbackQuietly(client);
      return itemNotFound(res);
    }

    if (oldItem.current_status !== "CLAIM") {
      await rollbackQuietly(client);
      return invalidState(res, "เปลี่ยนอุปกรณ์ทดแทนได้เฉพาะรายการที่อยู่ระหว่างเคลม");
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
        VALUES ($1, $2, 'IN_STOCK', $3, $4, $5)
        RETURNING *
      `,
      [
        oldItem.product_id,
        newSerialNumber,
        toLocation,
        warrantyStart,
        warrantyEnd,
      ],
    );

    const newItem = newItemResult.rows[0];

    const oldMovement = await insertMovement(client, {
      inventoryItemId: id,
      movementType: "REPLACED",
      performedBy: req.body?.performedBy,
      distributor: req.body?.distributor,
      fromLocation: oldItem.current_location,
      toLocation,
      note: req.body?.note,
      relatedInventoryItemId: newItem.id,
    });

    const newReceiveMovement = await insertMovement(client, {
      inventoryItemId: newItem.id,
      movementType: "RECEIVE",
      performedBy: req.body?.performedBy,
      distributor: req.body?.distributor,
      toLocation,
      note: "รับอุปกรณ์ทดแทนจากการเคลม",
      relatedInventoryItemId: id,
    });

    const updatedOldResult = await client.query(
      `
        UPDATE inventory_items
        SET
          current_status = 'REPLACED',
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "เปลี่ยนอุปกรณ์ทดแทนเรียบร้อย",
      data: {
        item: updatedOldResult.rows[0],
        replacementItem: newItem,
        movement: oldMovement,
        replacementReceiveMovement: newReceiveMovement,
      },
    });
  } catch (error) {
    if (client) {
      await rollbackQuietly(client);
    }

    if (error.code === "23505") {
      return res.status(409).json({
        code: "SERIAL_NUMBER_ALREADY_EXISTS",
        message: "Serial Number ของอุปกรณ์ทดแทนมีอยู่ในระบบแล้ว",
      });
    }

    return movementFailed(
      res,
      "REPLACEMENT_FAILED",
      "ไม่สามารถเปลี่ยนอุปกรณ์ทดแทนได้",
      error,
    );
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// RETIRE: IN_STOCK / IN_USE / CLAIM -> RETIRED
// --------------------------------------------------
router.post("/:id/retire", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return invalidId(res);
  }

  const toLocation = cleanText(req.body?.toLocation);

  if (!toLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งปลดระวาง",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const item = await getLockedItem(client, id);

    if (!item) {
      await rollbackQuietly(client);
      return itemNotFound(res);
    }

    if (!["IN_STOCK", "IN_USE", "CLAIM"].includes(item.current_status)) {
      await rollbackQuietly(client);
      return invalidState(res, "สถานะปัจจุบันไม่อนุญาตให้ปลดระวาง");
    }

    const movement = await insertMovement(client, {
      inventoryItemId: id,
      movementType: "RETIRE",
      performedBy: req.body?.performedBy,
      fromLocation: item.current_location,
      toLocation,
      note: req.body?.note,
    });

    const updated = await client.query(
      `
        UPDATE inventory_items
        SET
          current_status = 'RETIRED',
          current_location = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [toLocation, id],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "ปลดระวางอุปกรณ์เรียบร้อย",
      data: {
        item: updated.rows[0],
        movement,
      },
    });
  } catch (error) {
    if (client) {
      await rollbackQuietly(client);
    }

    return movementFailed(
      res,
      "RETIRE_FAILED",
      "ไม่สามารถปลดระวางอุปกรณ์ได้",
      error,
    );
  } finally {
    client?.release();
  }
});

// --------------------------------------------------
// MOVEMENT HISTORY
// --------------------------------------------------
router.get("/:id/movements", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return invalidId(res);
  }

  try {
    const itemResult = await pool.query(
      `SELECT id FROM inventory_items WHERE id = $1`,
      [id],
    );

    if (itemResult.rowCount === 0) {
      return itemNotFound(res);
    }

    const movementResult = await pool.query(
      `
        SELECT
          stock_movements.*,
          related.serial_number AS related_serial_number
        FROM stock_movements
        LEFT JOIN inventory_items AS related
          ON stock_movements.related_inventory_item_id = related.id
        WHERE stock_movements.inventory_item_id = $1
        ORDER BY
          stock_movements.movement_date ASC,
          stock_movements.id ASC
      `,
      [id],
    );

    return res.status(200).json({
      data: movementResult.rows,
    });
  } catch (error) {
    console.error("Get movement history failed:", error);

    return res.status(500).json({
      code: "MOVEMENT_HISTORY_FAILED",
      message: "ไม่สามารถโหลดประวัติการเคลื่อนไหวได้",
    });
  }
});

export default router;
