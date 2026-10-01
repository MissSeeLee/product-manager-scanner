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

function adminOnly(req, res) {
  if (req.user?.role === "ADMIN") return true;
  res.status(403).json({
    code: "FORBIDDEN",
    message: "เฉพาะ Admin เท่านั้นที่จัดการข้อมูลหลักได้",
  });
  return false;
}

// Product list enriched with usage and Active/Archive state.
router.get("/products", async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          p.*,
          COUNT(i.id)::int AS usage_count
        FROM products p
        LEFT JOIN inventory_items i ON i.product_id = p.id
        WHERE p.is_active = true
        GROUP BY p.id
        ORDER BY LOWER(p.product_name), p.id
      `,
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    console.error("Managed product list failed:", error);
    return res.status(500).json({
      code: "MANAGED_PRODUCT_LIST_FAILED",
      message: "ไม่สามารถโหลด Product Master ได้",
    });
  }
});


router.put("/products/:id", async (req, res) => {
  if (!adminOnly(req, res)) return;

  const id = parseId(req.params.id);
  const productName = cleanText(req.body?.productName);
  const brand = cleanText(req.body?.brand);
  const partNumber = cleanText(req.body?.partNumber);
  const description = cleanText(req.body?.description) || "";
  const category = cleanText(req.body?.category) || "ทั่วไป";
  const reason = cleanText(req.body?.reason);

  if (!id || !productName || !brand || !partNumber || !reason) {
    return res.status(400).json({
      code: "PRODUCT_MANAGEMENT_DATA_REQUIRED",
      message: "กรุณากรอกข้อมูลรุ่นและเหตุผลการแก้ไขให้ครบ",
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const current = await client.query(
      `SELECT * FROM products WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (current.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: "PRODUCT_NOT_FOUND",
        message: "ไม่พบรุ่นสินค้า",
      });
    }

    const updated = await client.query(
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
      [productName, brand, partNumber, description, category, id],
    );

    await writeAudit(client, req, {
      entityType: "PRODUCT",
      entityId: id,
      action: "EDIT_PRODUCT",
      reason,
      beforeData: current.rows[0],
      afterData: updated.rows[0],
    });

    await client.query("COMMIT");
    return res.status(200).json({
      message: "แก้ไข Product Master เรียบร้อย",
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
        code: "PRODUCT_ALREADY_EXISTS",
        message: "Brand + Part Number นี้มีอยู่แล้ว",
      });
    }
    console.error("Managed product update failed:", error);
    return res.status(500).json({
      code: "PRODUCT_MANAGEMENT_UPDATE_FAILED",
      message: "ไม่สามารถแก้ไข Product Master ได้",
    });
  } finally {
    client?.release();
  }
});

router.delete("/products/:id", async (req, res) => {
  if (!adminOnly(req, res)) return;

  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_PRODUCT_ID",
      message: "รหัสรุ่นสินค้าไม่ถูกต้อง",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const currentResult = await client.query(
      `SELECT * FROM products WHERE id = $1 FOR UPDATE`,
      [id],
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: "PRODUCT_NOT_FOUND",
        message: "ไม่พบรุ่นสินค้า",
      });
    }

    const current = currentResult.rows[0];

    const usageResult = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM inventory_items
        WHERE product_id = $1
      `,
      [id],
    );

    const usageCount = Number(usageResult.rows[0]?.count || 0);

    if (usageCount === 0) {
      await writeAudit(client, req, {
        entityType: "PRODUCT",
        entityId: id,
        action: "DELETE_PRODUCT",
        reason: "ลบรุ่นสินค้า",
        beforeData: current,
        afterData: { deleted: true },
      });

      await client.query(
        `DELETE FROM products WHERE id = $1`,
        [id],
      );

      await client.query("COMMIT");
      return res.status(200).json({
        message: "ลบรุ่นสินค้าเรียบร้อย",
        data: { id, preservedHistory: false },
      });
    }

    const updatedResult = await client.query(
      `
        UPDATE products
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id],
    );

    await writeAudit(client, req, {
      entityType: "PRODUCT",
      entityId: id,
      action: "DELETE_PRODUCT",
      reason: "ลบรุ่นสินค้า",
      beforeData: current,
      afterData: {
        ...updatedResult.rows[0],
        preserved_history: true,
      },
    });

    await client.query("COMMIT");
    return res.status(200).json({
      message: "ลบรุ่นสินค้าเรียบร้อย",
      data: { id, preservedHistory: true },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    console.error("Delete product failed:", error);
    return res.status(500).json({
      code: "PRODUCT_DELETE_FAILED",
      message: "ไม่สามารถลบรุ่นสินค้าได้",
    });
  } finally {
    client?.release();
  }
});

router.patch("/products/:id/status", async (req, res) => {
  if (!adminOnly(req, res)) return;

  const id = parseId(req.params.id);
  const isActive = req.body?.isActive;
  const reason =
    cleanText(req.body?.reason) ||
    (isActive === false ? "ลบรุ่นสินค้า" : "เปลี่ยนสถานะรุ่นสินค้า");

  if (!id || typeof isActive !== "boolean") {
    return res.status(400).json({
      code: "PRODUCT_STATUS_DATA_REQUIRED",
      message: "กรุณาระบุสถานะและเหตุผล",
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const current = await client.query(
      `SELECT * FROM products WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (current.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: "PRODUCT_NOT_FOUND",
        message: "ไม่พบรุ่นสินค้า",
      });
    }

    const updated = await client.query(
      `
        UPDATE products
        SET is_active = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [isActive, id],
    );

    await writeAudit(client, req, {
      entityType: "PRODUCT",
      entityId: id,
      action: isActive ? "ACTIVATE_PRODUCT" : "ARCHIVE_PRODUCT",
      reason,
      beforeData: current.rows[0],
      afterData: updated.rows[0],
    });

    await client.query("COMMIT");
    return res.status(200).json({
      message: isActive
        ? "เปิดใช้งานรุ่นสินค้าเรียบร้อย"
        : "Archive รุ่นสินค้าเรียบร้อย รุ่นนี้จะไม่แสดงใน Intake ใหม่",
      data: updated.rows[0],
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }
    console.error("Product status update failed:", error);
    return res.status(500).json({
      code: "PRODUCT_STATUS_UPDATE_FAILED",
      message: "ไม่สามารถเปลี่ยนสถานะ Product Master ได้",
    });
  } finally {
    client?.release();
  }
});

// Location management read model: tell UI what is safe before the user clicks.
router.get("/locations", async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          l.*,
          (
            SELECT COUNT(*)::int
            FROM inventory_items i
            WHERE i.current_location = l.location_name
          ) AS current_asset_count,
          (
            SELECT COUNT(*)::int
            FROM stock_movements sm
            WHERE sm.from_location = l.location_name
               OR sm.to_location = l.location_name
          ) AS movement_usage_count,
          (
            SELECT COUNT(*)::int
            FROM projects p
            WHERE p.default_location = l.location_name
          ) AS project_usage_count
        FROM locations l
        WHERE l.is_active = true
        ORDER BY l.is_active DESC, LOWER(l.location_name), l.id
      `,
    );

    return res.status(200).json({
      data: result.rows.map((row) => {
        const totalUsage =
          Number(row.current_asset_count || 0) +
          Number(row.movement_usage_count || 0) +
          Number(row.project_usage_count || 0);

        return {
          ...row,
          total_usage_count: totalUsage,
          can_rename: totalUsage === 0,
          can_delete: true,
        };
      }),
    });
  } catch (error) {
    console.error("Managed location list failed:", error);
    return res.status(500).json({
      code: "MANAGED_LOCATION_LIST_FAILED",
      message: "ไม่สามารถโหลดสถานที่พร้อมข้อมูลการใช้งานได้",
    });
  }
});

// Project management read model: one coherent page, no duplicated panel.
router.get("/projects", async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          p.*,
          COUNT(i.id) FILTER (
            WHERE i.current_status = 'IN_USE'
          )::int AS active_asset_count,
          COUNT(i.id) FILTER (
            WHERE i.current_status = 'IN_USE'
              AND i.expected_return_date < CURRENT_DATE
          )::int AS overdue_asset_count,
          (
            SELECT COUNT(*)::int
            FROM operations op
            WHERE op.project_id = p.id
          ) AS operation_count
        FROM projects p
        LEFT JOIN inventory_items i
          ON i.current_project_id = p.id
        GROUP BY p.id
        ORDER BY
          CASE p.status
            WHEN 'ACTIVE' THEN 0
            WHEN 'CLOSED' THEN 1
            ELSE 2
          END,
          p.created_at DESC
      `,
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    console.error("Managed project list failed:", error);
    return res.status(500).json({
      code: "MANAGED_PROJECT_LIST_FAILED",
      message: "ไม่สามารถโหลดข้อมูลโครงการได้",
    });
  }
});

// Officially complete the existing status model: ACTIVE/CLOSED/CANCELLED.
router.patch("/projects/:id/status", async (req, res) => {
  if (!adminOnly(req, res)) return;

  const id = parseId(req.params.id);
  const status = String(req.body?.status || "").trim().toUpperCase();
  const reason = cleanText(req.body?.reason);

  if (!id || !["ACTIVE", "CLOSED", "CANCELLED"].includes(status) || !reason) {
    return res.status(400).json({
      code: "PROJECT_STATUS_DATA_REQUIRED",
      message: "กรุณาระบุสถานะและเหตุผล",
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const current = await client.query(
      `SELECT * FROM projects WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (current.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: "PROJECT_NOT_FOUND",
        message: "ไม่พบโครงการ",
      });
    }

    if (status !== "ACTIVE") {
      const active = await client.query(
        `
          SELECT COUNT(*)::int AS count
          FROM inventory_items
          WHERE current_project_id = $1
            AND current_status = 'IN_USE'
        `,
        [id],
      );

      if (Number(active.rows[0]?.count || 0) > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          code: "PROJECT_HAS_ACTIVE_ASSETS",
          message:
            "ยังมีอุปกรณ์ IN_USE อยู่ในโครงการ กรุณารับคืน/ย้ายออกก่อนปิดหรือยกเลิกงาน",
        });
      }
    }

    const updated = await client.query(
      `
        UPDATE projects
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [status, id],
    );

    await writeAudit(client, req, {
      entityType: "PROJECT",
      entityId: id,
      action: "CHANGE_PROJECT_STATUS",
      reason,
      beforeData: current.rows[0],
      afterData: updated.rows[0],
    });

    await client.query("COMMIT");

    return res.status(200).json({
      message:
        status === "ACTIVE"
          ? "เปิดโครงการอีกครั้งเรียบร้อย"
          : status === "CLOSED"
            ? "ปิดโครงการเรียบร้อย"
            : "ยกเลิกโครงการเรียบร้อย",
      data: updated.rows[0],
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }
    console.error("Managed project status update failed:", error);
    return res.status(500).json({
      code: "PROJECT_STATUS_UPDATE_FAILED",
      message: "ไม่สามารถเปลี่ยนสถานะโครงการได้",
    });
  } finally {
    client?.release();
  }
});

export default router;
