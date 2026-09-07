import express from "express";
import pool from "./db.js";

const app = express();

app.use(express.json());

const PORT = Number(process.env.BACKEND_PORT || 3001);

// รูปแบบ Response ของโปรเจกต์:
// - code = รหัสภาษาอังกฤษสำหรับ Frontend/โปรแกรม
// - message = ข้อความภาษาไทยสำหรับผู้ใช้
// - data = ข้อมูลที่ API ส่งกลับ
// - HTTP / PostgreSQL / Status ภายในระบบยังคงใช้รหัสมาตรฐานเดิม

app.get("/api/health", (req, res) => {
  res.json({
    code: "SERVER_OK",
    message: "เซิร์ฟเวอร์ทำงานปกติ",
  });
});

app.get("/api/db-health", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS user
    `);

    res.json({
      code: "DATABASE_OK",
      message: "เชื่อมต่อฐานข้อมูลสำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(503).json({
      code: "DATABASE_UNAVAILABLE",
      message: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
    });
  }
});

app.post("/api/products", async (req, res) => {
  const {
    productName,
    brand,
    partNumber,
    description = "",
    category = "ทั่วไป",
  } = req.body;

  if (!productName?.trim()) {
    return res.status(400).json({
      code: "PRODUCT_NAME_REQUIRED",
      message: "กรุณากรอกชื่อสินค้า",
    });
  }

  if (!brand?.trim()) {
    return res.status(400).json({
      code: "BRAND_REQUIRED",
      message: "กรุณากรอกยี่ห้อสินค้า",
    });
  }

  if (!partNumber?.trim()) {
    return res.status(400).json({
      code: "PART_NUMBER_REQUIRED",
      message: "กรุณากรอก Part Number",
    });
  }

  const cleanProductName = productName.trim();
  const cleanBrand = brand.trim();
  const cleanPartNumber = partNumber.trim();
  const cleanDescription = description.trim();
  const cleanCategory = category.trim() || "ทั่วไป";

  try {
    const result = await pool.query(
      `
      INSERT INTO products (
        product_name,
        brand,
        part_number,
        description,
        category
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        cleanProductName,
        cleanBrand,
        cleanPartNumber,
        cleanDescription,
        cleanCategory,
      ],
    );

    res.status(201).json({
      code: "PRODUCT_CREATED",
      message: "เพิ่มสินค้าสำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        code: "PRODUCT_ALREADY_EXISTS",
        message: "มีสินค้ายี่ห้อและ Part Number นี้อยู่ในระบบแล้ว",
      });
    }

    console.error("Create product failed:", error.message);

    res.status(500).json({
      code: "PRODUCT_CREATE_FAILED",
      message: "ไม่สามารถเพิ่มสินค้าได้ กรุณาลองใหม่อีกครั้ง",
    });
  }
});

app.get("/api/products", async (req, res) => {
  const search = req.query.search?.trim() || "";

  try {
    let result;

    if (search) {
      result = await pool.query(
        `
        SELECT *
        FROM products
        WHERE product_name ILIKE $1
           OR brand ILIKE $1
           OR part_number ILIKE $1
        ORDER BY created_at DESC
        `,
        [`%${search}%`],
      );
    } else {
      result = await pool.query(`
        SELECT *
        FROM products
        ORDER BY created_at DESC
      `);
    }

    res.json({
      code: "PRODUCT_LIST_LOADED",
      message: "โหลดรายการสินค้าสำเร็จ",
      data: result.rows,
    });
  } catch (error) {
    console.error("Get products failed:", error.message);

    res.status(500).json({
      code: "PRODUCT_LIST_LOAD_FAILED",
      message: "ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง",
    });
  }
});

app.get("/api/products/:id", async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      code: "INVALID_PRODUCT_ID",
      message: "รหัสสินค้าไม่ถูกต้อง",
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM products
      WHERE id = $1
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: "PRODUCT_NOT_FOUND",
        message: "ไม่พบสินค้าที่ต้องการ",
      });
    }

    res.json({
      code: "PRODUCT_LOADED",
      message: "โหลดข้อมูลสินค้าสำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get product failed:", error.message);

    res.status(500).json({
      code: "PRODUCT_LOAD_FAILED",
      message: "ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง",
    });
  }
});

app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      code: "INVALID_PRODUCT_ID",
      message: "รหัสสินค้าไม่ถูกต้อง",
    });
  }

  const {
    productName,
    brand,
    partNumber,
    description = "",
    category = "ทั่วไป",
  } = req.body;

  if (!productName?.trim()) {
    return res.status(400).json({
      code: "PRODUCT_NAME_REQUIRED",
      message: "กรุณากรอกชื่อสินค้า",
    });
  }

  if (!brand?.trim()) {
    return res.status(400).json({
      code: "BRAND_REQUIRED",
      message: "กรุณากรอกยี่ห้อสินค้า",
    });
  }

  if (!partNumber?.trim()) {
    return res.status(400).json({
      code: "PART_NUMBER_REQUIRED",
      message: "กรุณากรอก Part Number",
    });
  }

  const cleanProductName = productName.trim();
  const cleanBrand = brand.trim();
  const cleanPartNumber = partNumber.trim();
  const cleanDescription = description.trim();
  const cleanCategory = category.trim() || "ทั่วไป";

  try {
    const result = await pool.query(
      `
      UPDATE products
      SET
        product_name = $1,
        brand = $2,
        part_number = $3,
        description = $4,
        category = $5,
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
      `,
      [
        cleanProductName,
        cleanBrand,
        cleanPartNumber,
        cleanDescription,
        cleanCategory,
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: "PRODUCT_NOT_FOUND",
        message: "ไม่พบสินค้าที่ต้องการ",
      });
    }

    res.json({
      code: "PRODUCT_UPDATED",
      message: "แก้ไขข้อมูลสินค้าสำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        code: "PRODUCT_ALREADY_EXISTS",
        message: "มีสินค้ายี่ห้อและ Part Number นี้อยู่ในระบบแล้ว",
      });
    }

    console.error("Update product failed:", error.message);

    res.status(500).json({
      code: "PRODUCT_UPDATE_FAILED",
      message: "ไม่สามารถแก้ไขข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง",
    });
  }
});

app.post("/api/inventory-items", async (req, res) => {
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

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({
      code: "INVALID_PRODUCT_ID",
      message: "รหัสสินค้าไม่ถูกต้อง",
    });
  }

  if (!serialNumber?.trim()) {
    return res.status(400).json({
      code: "SERIAL_NUMBER_REQUIRED",
      message: "กรุณากรอก Serial Number",
    });
  }

  if (!currentLocation?.trim()) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งที่จัดเก็บอุปกรณ์",
    });
  }

  const cleanSerialNumber = serialNumber.trim();
  const cleanLocation = currentLocation.trim();

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
        note.trim(),
      ],
    );

    await client.query("COMMIT");

    res.status(201).json({
      code: "INVENTORY_CREATED",
      message: "เพิ่มอุปกรณ์และบันทึกรับเข้าคลังสำเร็จ",
      data: {
        item,
        movement: movementResult.rows[0],
      },
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
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
        message: "ไม่พบสินค้าที่ต้องการ",
      });
    }

    if (error.code === "23514") {
      return res.status(400).json({
        code: "INVALID_INVENTORY_DATA",
        message: "ข้อมูลอุปกรณ์ไม่ถูกต้อง กรุณาตรวจสอบข้อมูลและวันที่รับประกัน",
      });
    }

    console.error("Create inventory item failed:", error.message);

    res.status(500).json({
      code: "INVENTORY_CREATE_FAILED",
      message: "ไม่สามารถเพิ่มอุปกรณ์เข้าระบบได้ กรุณาลองใหม่อีกครั้ง",
    });
  } finally {
    client?.release();
  }
});

app.get("/api/inventory-items", async (req, res) => {
  try {
    const result = await pool.query(`
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
      ORDER BY inventory_items.created_at DESC
    `);

    res.json({
      code: "INVENTORY_LIST_LOADED",
      message: "โหลดรายการอุปกรณ์สำเร็จ",
      data: result.rows,
    });
  } catch (error) {
    console.error("Get inventory items failed:", error.message);

    res.status(500).json({
      code: "INVENTORY_LIST_LOAD_FAILED",
      message: "ไม่สามารถโหลดรายการอุปกรณ์ได้ กรุณาลองใหม่อีกครั้ง",
    });
  }
});

app.get("/api/inventory-items/serial/:serial", async (req, res) => {
  const serial = req.params.serial.trim();

  if (!serial) {
    return res.status(400).json({
      code: "SERIAL_NUMBER_REQUIRED",
      message: "กรุณากรอก Serial Number",
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

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่มี Serial Number นี้",
      });
    }

    res.json({
      code: "INVENTORY_LOADED",
      message: "โหลดข้อมูลอุปกรณ์สำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get inventory item by serial failed:", error.message);

    res.status(500).json({
      code: "INVENTORY_LOAD_FAILED",
      message: "ไม่สามารถโหลดข้อมูลอุปกรณ์ได้ กรุณาลองใหม่อีกครั้ง",
    });
  }
});

app.get("/api/inventory-items/:id", async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
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

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    res.json({
      code: "INVENTORY_LOADED",
      message: "โหลดข้อมูลอุปกรณ์สำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get inventory item failed:", error.message);

    res.status(500).json({
      code: "INVENTORY_LOAD_FAILED",
      message: "ไม่สามารถโหลดข้อมูลอุปกรณ์ได้ กรุณาลองใหม่อีกครั้ง",
    });
  }
});

app.put("/api/inventory-items/:id", async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const { serialNumber, warrantyStart = null, warrantyEnd = null } = req.body;

  if (!serialNumber?.trim()) {
    return res.status(400).json({
      code: "SERIAL_NUMBER_REQUIRED",
      message: "กรุณากรอก Serial Number",
    });
  }

  const cleanSerialNumber = serialNumber.trim();

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

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    res.json({
      code: "INVENTORY_UPDATED",
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
        message: "ข้อมูลอุปกรณ์ไม่ถูกต้อง กรุณาตรวจสอบข้อมูลและวันที่รับประกัน",
      });
    }

    console.error("Update inventory item failed:", error.message);

    res.status(500).json({
      code: "INVENTORY_UPDATE_FAILED",
      message: "ไม่สามารถแก้ไขข้อมูลอุปกรณ์ได้ กรุณาลองใหม่อีกครั้ง",
    });
  }
});

app.post("/api/inventory-items/:id/issue", async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const { performedBy, toLocation, note = "" } = req.body;

  if (!toLocation?.trim()) {
    return res.status(400).json({
      code: "DESTINATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งปลายทาง",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const itemResult = await client.query(
      `
      SELECT *
      FROM inventory_items
      WHERE id = $1
      FOR UPDATE
      `,
      [id],
    );

    if (itemResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    const item = itemResult.rows[0];

    if (item.current_status !== "IN_STOCK") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "INVENTORY_NOT_IN_STOCK",
        message:
          "ไม่สามารถเบิกอุปกรณ์ได้ เพราะอุปกรณ์ไม่ได้อยู่ในสถานะพร้อมเบิก (IN_STOCK)",
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
        performedBy?.trim() || null,
        item.current_location,
        toLocation.trim(),
        note.trim(),
      ],
    );

    const updatedItemResult = await client.query(
      `
      UPDATE inventory_items
      SET
        current_status = 'IN_USE',
        current_location = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [toLocation.trim(), id],
    );

    await client.query("COMMIT");

    res.status(201).json({
      code: "INVENTORY_ISSUED",
      message: "เบิกอุปกรณ์ออกไปใช้งานสำเร็จ",
      data: {
        item: updatedItemResult.rows[0],
        movement: movementResult.rows[0],
      },
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }

    console.error("Issue inventory item failed:", error.message);

    res.status(500).json({
      code: "INVENTORY_ISSUE_FAILED",
      message: "ไม่สามารถเบิกอุปกรณ์ได้ กรุณาลองใหม่อีกครั้ง",
    });
  } finally {
    client?.release();
  }
});

app.post("/api/inventory-items/:id/move", async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const { performedBy, toLocation, note = "" } = req.body;

  if (!toLocation?.trim()) {
    return res.status(400).json({
      code: "DESTINATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งปลายทาง",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const itemResult = await client.query(
      `
      SELECT *
      FROM inventory_items
      WHERE id = $1
      FOR UPDATE
      `,
      [id],
    );

    if (itemResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    const item = itemResult.rows[0];
    const cleanToLocation = toLocation.trim();

    if (!["IN_STOCK", "IN_USE", "CLAIM"].includes(item.current_status)) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "INVENTORY_MOVE_NOT_ALLOWED",
        message:
          "ไม่สามารถย้ายอุปกรณ์ได้ เนื่องจากสถานะปัจจุบันไม่อนุญาตให้ย้าย",
      });
    }

    if (item.current_location === cleanToLocation) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "INVENTORY_ALREADY_AT_LOCATION",
        message:
          "ไม่สามารถย้ายอุปกรณ์ได้ เพราะอุปกรณ์อยู่ที่ตำแหน่งนี้อยู่แล้ว",
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
        performedBy?.trim() || null,
        item.current_location,
        cleanToLocation,
        note.trim(),
      ],
    );

    const updatedItemResult = await client.query(
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

    res.status(201).json({
      code: "INVENTORY_MOVED",
      message: "ย้ายตำแหน่งอุปกรณ์สำเร็จ",
      data: {
        item: updatedItemResult.rows[0],
        movement: movementResult.rows[0],
      },
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }

    console.error("Move inventory item failed:", error.message);

    res.status(500).json({
      code: "INVENTORY_MOVE_FAILED",
      message: "ไม่สามารถย้ายอุปกรณ์ได้ กรุณาลองใหม่อีกครั้ง",
    });
  } finally {
    client?.release();
  }
});

app.post("/api/inventory-items/:id/claim", async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const { performedBy, toLocation, note = "" } = req.body;

  if (!toLocation?.trim()) {
    return res.status(400).json({
      code: "CLAIM_DESTINATION_REQUIRED",
      message: "กรุณาระบุสถานที่หรือศูนย์บริการที่ส่งเคลม",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const itemResult = await client.query(
      `
      SELECT *
      FROM inventory_items
      WHERE id = $1
      FOR UPDATE
      `,
      [id],
    );

    if (itemResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    const item = itemResult.rows[0];

    if (!["IN_STOCK", "IN_USE"].includes(item.current_status)) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "INVENTORY_CLAIM_NOT_ALLOWED",
        message:
          "ไม่สามารถส่งเคลมอุปกรณ์ได้ เนื่องจากสถานะปัจจุบันไม่อนุญาตให้ส่งเคลม",
      });
    }

    const cleanToLocation = toLocation.trim();

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
        performedBy?.trim() || null,
        item.current_location,
        cleanToLocation,
        note.trim(),
      ],
    );

    const updatedItemResult = await client.query(
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

    res.status(201).json({
      code: "INVENTORY_CLAIMED",
      message: "ส่งอุปกรณ์เคลมสำเร็จ",
      data: {
        item: updatedItemResult.rows[0],
        movement: movementResult.rows[0],
      },
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }

    console.error("Claim inventory item failed:", error.message);

    res.status(500).json({
      code: "INVENTORY_CLAIM_FAILED",
      message: "ไม่สามารถส่งอุปกรณ์เคลมได้ กรุณาลองใหม่อีกครั้ง",
    });
  } finally {
    client?.release();
  }
});

app.post("/api/inventory-items/:id/claim-return", async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const { performedBy, toLocation, note = "" } = req.body;

  if (!toLocation?.trim()) {
    return res.status(400).json({
      code: "CLAIM_RETURN_LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งที่จะรับอุปกรณ์กลับ",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const itemResult = await client.query(
      `
      SELECT *
      FROM inventory_items
      WHERE id = $1
      FOR UPDATE
      `,
      [id],
    );

    if (itemResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    const item = itemResult.rows[0];

    if (item.current_status !== "CLAIM") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "INVENTORY_NOT_UNDER_CLAIM",
        message:
          "ไม่สามารถรับคืนจากการเคลมได้ เพราะอุปกรณ์ไม่ได้อยู่ในสถานะเคลม (CLAIM)",
      });
    }

    const cleanToLocation = toLocation.trim();

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
      VALUES ($1, 'CLAIM_RETURN', $2, $3, $4, $5)
      RETURNING *
      `,
      [
        id,
        performedBy?.trim() || null,
        item.current_location,
        cleanToLocation,
        note.trim(),
      ],
    );

    const updatedItemResult = await client.query(
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

    res.status(201).json({
      code: "CLAIM_RETURNED",
      message: "รับอุปกรณ์เดิมกลับจากการเคลมสำเร็จ",
      data: {
        item: updatedItemResult.rows[0],
        movement: movementResult.rows[0],
      },
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }

    console.error("Claim return inventory item failed:", error.message);

    res.status(500).json({
      code: "CLAIM_RETURN_FAILED",
      message: "ไม่สามารถรับอุปกรณ์กลับจากการเคลมได้ กรุณาลองใหม่อีกครั้ง",
    });
  } finally {
    client?.release();
  }
});

app.post("/api/inventory-items/:id/replaced", async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const {
    newSerialNumber,
    performedBy,
    distributor = null,
    toLocation,
    warrantyStart = null,
    warrantyEnd = null,
    note = "",
  } = req.body;

  if (!newSerialNumber?.trim()) {
    return res.status(400).json({
      code: "NEW_SERIAL_NUMBER_REQUIRED",
      message: "กรุณากรอก Serial Number ของอุปกรณ์ทดแทน",
    });
  }

  if (!toLocation?.trim()) {
    return res.status(400).json({
      code: "CLAIM_RETURN_LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งที่จะรับอุปกรณ์ทดแทน",
    });
  }

  const cleanSerialNumber = newSerialNumber.trim();
  const cleanLocation = toLocation.trim();

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const oldItemResult = await client.query(
      `
      SELECT *
      FROM inventory_items
      WHERE id = $1
      FOR UPDATE
      `,
      [id],
    );

    if (oldItemResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์เดิมที่ต้องการเปลี่ยนทดแทน",
      });
    }

    const oldItem = oldItemResult.rows[0];

    if (oldItem.current_status !== "CLAIM") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "INVENTORY_REPLACE_NOT_ALLOWED",
        message:
          "ไม่สามารถเปลี่ยนอุปกรณ์ทดแทนได้ เพราะอุปกรณ์เดิมไม่ได้อยู่ในสถานะเคลม (CLAIM)",
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
      VALUES ($1, $2, 'IN_STOCK', $3, $4, $5)
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
        note,
        related_inventory_item_id
      )
      VALUES ($1, 'REPLACED', $2, $3, $4, $5)
      RETURNING *
      `,
      [
        id,
        performedBy?.trim() || null,
        oldItem.current_location,
        note.trim(),
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
      VALUES ($1, 'RECEIVE', $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        newItem.id,
        performedBy?.trim() || null,
        distributor?.trim() || null,
        cleanLocation,
        "รับอุปกรณ์ทดแทนจากการเคลม",
        id,
      ],
    );

    const updatedOldItemResult = await client.query(
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

    res.status(201).json({
      code: "INVENTORY_REPLACED",
      message: "บันทึกการเปลี่ยนอุปกรณ์ทดแทนสำเร็จ",
      data: {
        oldItem: updatedOldItemResult.rows[0],
        newItem,
        replacedMovement: replacedMovementResult.rows[0],
        receiveMovement: receiveMovementResult.rows[0],
      },
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }

    if (error.code === "23505") {
      return res.status(409).json({
        code: "SERIAL_NUMBER_ALREADY_EXISTS",
        message: "Serial Number ของอุปกรณ์ทดแทนมีอยู่ในระบบแล้ว",
      });
    }

    if (error.code === "23514") {
      return res.status(400).json({
        code: "INVALID_INVENTORY_DATA",
        message:
          "ข้อมูลอุปกรณ์ทดแทนไม่ถูกต้อง กรุณาตรวจสอบข้อมูลและวันที่รับประกัน",
      });
    }

    console.error("Replace inventory item failed:", error.message);

    res.status(500).json({
      code: "INVENTORY_REPLACE_FAILED",
      message: "ไม่สามารถบันทึกการเปลี่ยนอุปกรณ์ทดแทนได้ กรุณาลองใหม่อีกครั้ง",
    });
  } finally {
    client?.release();
  }
});

app.post("/api/inventory-items/:id/retire", async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      code: "INVALID_INVENTORY_ID",
      message: "รหัสอุปกรณ์ไม่ถูกต้อง",
    });
  }

  const { performedBy, toLocation, note = "" } = req.body;

  if (!toLocation?.trim()) {
    return res.status(400).json({
      code: "RETIRE_LOCATION_REQUIRED",
      message: "กรุณาระบุตำแหน่งจัดเก็บอุปกรณ์ที่ปลดระวาง",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const itemResult = await client.query(
      `
      SELECT *
      FROM inventory_items
      WHERE id = $1
      FOR UPDATE
      `,
      [id],
    );

    if (itemResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        code: "INVENTORY_NOT_FOUND",
        message: "ไม่พบอุปกรณ์ที่ต้องการ",
      });
    }

    const item = itemResult.rows[0];

    if (!["IN_STOCK", "IN_USE", "CLAIM"].includes(item.current_status)) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "INVENTORY_RETIRE_NOT_ALLOWED",
        message:
          "ไม่สามารถปลดระวางอุปกรณ์ได้ เนื่องจากสถานะปัจจุบันไม่อนุญาตให้ปลดระวาง",
      });
    }

    const cleanToLocation = toLocation.trim();

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
      VALUES ($1, 'RETIRE', $2, $3, $4, $5)
      RETURNING *
      `,
      [
        id,
        performedBy?.trim() || null,
        item.current_location,
        cleanToLocation,
        note.trim(),
      ],
    );

    const updatedItemResult = await client.query(
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

    res.status(201).json({
      code: "INVENTORY_RETIRED",
      message: "ปลดระวางอุปกรณ์สำเร็จ",
      data: {
        item: updatedItemResult.rows[0],
        movement: movementResult.rows[0],
      },
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }

    console.error("Retire inventory item failed:", error.message);

    res.status(500).json({
      code: "INVENTORY_RETIRE_FAILED",
      message: "ไม่สามารถปลดระวางอุปกรณ์ได้ กรุณาลองใหม่อีกครั้ง",
    });
  } finally {
    client?.release();
  }
});

app.get("/api/inventory-items/:id/movements", async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
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
        ON inventory_items.product_id = products.id
      WHERE inventory_items.id = $1
      `,
      [id],
    );

    if (itemResult.rows.length === 0) {
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
        related_item.serial_number AS related_serial_number
      FROM stock_movements
      LEFT JOIN inventory_items AS related_item
        ON stock_movements.related_inventory_item_id = related_item.id
      WHERE stock_movements.inventory_item_id = $1
      ORDER BY stock_movements.movement_date ASC
      `,
      [id],
    );

    res.json({
      code: "MOVEMENT_HISTORY_LOADED",
      message: "โหลดประวัติการเคลื่อนไหวของอุปกรณ์สำเร็จ",
      data: {
        item: itemResult.rows[0],
        movements: movementResult.rows,
      },
    });
  } catch (error) {
    console.error("Get inventory movement history failed:", error.message);

    res.status(500).json({
      code: "MOVEMENT_HISTORY_LOAD_FAILED",
      message:
        "ไม่สามารถโหลดประวัติการเคลื่อนไหวของอุปกรณ์ได้ กรุณาลองใหม่อีกครั้ง",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
