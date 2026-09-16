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
// CREATE PRODUCT
// POST /api/products
// --------------------------------------------------

router.post("/", async (req, res) => {
  const {
    productName,
    brand,
    partNumber,
    description = "",
    category = "ทั่วไป",
  } = req.body;

  const cleanProductName = productName?.trim();
  const cleanBrand = brand?.trim();
  const cleanPartNumber = partNumber?.trim();
  const cleanDescription = description?.trim() || "";
  const cleanCategory = category?.trim() || "ทั่วไป";

  if (!cleanProductName || !cleanBrand || !cleanPartNumber) {
    return res.status(400).json({
      code: "PRODUCT_REQUIRED_FIELDS_MISSING",
      message: "กรุณากรอกชื่อสินค้า ยี่ห้อ และ Part Number ให้ครบ",
    });
  }

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

    return res.status(201).json({
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

    console.error("Create product failed:", error);

    return res.status(500).json({
      code: "PRODUCT_CREATE_FAILED",
      message: "ไม่สามารถเพิ่มสินค้าได้",
    });
  }
});

// --------------------------------------------------
// GET PRODUCTS
// GET /api/products
// GET /api/products?search=...
// --------------------------------------------------

router.get("/", async (req, res) => {
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";

  try {
    let result;

    if (search) {
      const keyword = `%${search}%`;

      result = await pool.query(
        `
          SELECT *
          FROM products
          WHERE
            product_name ILIKE $1
            OR brand ILIKE $1
            OR part_number ILIKE $1
          ORDER BY created_at DESC, id DESC
        `,
        [keyword],
      );
    } else {
      result = await pool.query(
        `
          SELECT *
          FROM products
          ORDER BY created_at DESC, id DESC
        `,
      );
    }

    return res.status(200).json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Get products failed:", error);

    return res.status(500).json({
      code: "PRODUCT_LIST_FAILED",
      message: "ไม่สามารถโหลดรายการสินค้าได้",
    });
  }
});

// --------------------------------------------------
// GET PRODUCT BY ID
// GET /api/products/:id
// --------------------------------------------------

router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
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

    if (result.rowCount === 0) {
      return res.status(404).json({
        code: "PRODUCT_NOT_FOUND",
        message: "ไม่พบสินค้าที่ต้องการ",
      });
    }

    return res.status(200).json({
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get product failed:", error);

    return res.status(500).json({
      code: "PRODUCT_GET_FAILED",
      message: "ไม่สามารถโหลดข้อมูลสินค้าได้",
    });
  }
});

// --------------------------------------------------
// UPDATE PRODUCT
// PUT /api/products/:id
// --------------------------------------------------

router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
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

  const cleanProductName = productName?.trim();
  const cleanBrand = brand?.trim();
  const cleanPartNumber = partNumber?.trim();
  const cleanDescription = description?.trim() || "";
  const cleanCategory = category?.trim() || "ทั่วไป";

  if (!cleanProductName || !cleanBrand || !cleanPartNumber) {
    return res.status(400).json({
      code: "PRODUCT_REQUIRED_FIELDS_MISSING",
      message: "กรุณากรอกชื่อสินค้า ยี่ห้อ และ Part Number ให้ครบ",
    });
  }

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

    if (result.rowCount === 0) {
      return res.status(404).json({
        code: "PRODUCT_NOT_FOUND",
        message: "ไม่พบสินค้าที่ต้องการ",
      });
    }

    return res.status(200).json({
      message: "แก้ไขสินค้าสำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        code: "PRODUCT_ALREADY_EXISTS",
        message: "มีสินค้ายี่ห้อและ Part Number นี้อยู่ในระบบแล้ว",
      });
    }

    console.error("Update product failed:", error);

    return res.status(500).json({
      code: "PRODUCT_UPDATE_FAILED",
      message: "ไม่สามารถแก้ไขสินค้าได้",
    });
  }
});

export default router;
