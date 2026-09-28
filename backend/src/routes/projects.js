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

function parseDateOnly(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

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

function validateDateRange(startDate, expectedEndDate) {
  if (!startDate || !expectedEndDate) {
    return true;
  }

  return expectedEndDate >= startDate;
}

router.get("/", async (req, res) => {
  const status = cleanText(req.query?.status);
  const values = [];
  const conditions = [];

  if (status) {
    if (!["ACTIVE", "CLOSED", "CANCELLED"].includes(status)) {
      return res.status(400).json({
        code: "INVALID_PROJECT_STATUS",
        message: "สถานะโครงการไม่ถูกต้อง",
      });
    }

    values.push(status);
    conditions.push(`projects.status = $${values.length}`);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const result = await pool.query(
      `
        SELECT
          projects.*,
          COUNT(inventory_items.id) FILTER (
            WHERE inventory_items.current_status IN ('IN_USE', 'CLAIM')
          )::bigint AS active_asset_count,
          COUNT(inventory_items.id) FILTER (
            WHERE inventory_items.current_status = 'IN_USE'
              AND inventory_items.expected_return_date < CURRENT_DATE
          )::bigint AS overdue_asset_count
        FROM projects
        LEFT JOIN inventory_items
          ON inventory_items.current_project_id = projects.id
        ${whereSql}
        GROUP BY projects.id
        ORDER BY
          CASE projects.status WHEN 'ACTIVE' THEN 0 WHEN 'CLOSED' THEN 1 ELSE 2 END,
          projects.created_at DESC
      `,
      values,
    );

    return res.status(200).json({
      data: result.rows.map((row) => ({
        ...row,
        active_asset_count: Number(row.active_asset_count || 0),
        overdue_asset_count: Number(row.overdue_asset_count || 0),
      })),
    });
  } catch (error) {
    console.error("Get projects failed:", error);

    return res.status(500).json({
      code: "PROJECTS_GET_FAILED",
      message: "ไม่สามารถโหลดรายการโครงการได้",
    });
  }
});

router.post("/", async (req, res) => {
  const projectName = cleanText(req.body?.projectName);
  const projectCode = cleanText(req.body?.projectCode);
  const responsiblePerson = cleanText(req.body?.responsiblePerson);
  const defaultLocation = cleanText(req.body?.defaultLocation);
  const startDate = parseDateOnly(req.body?.startDate);
  const expectedEndDate = parseDateOnly(req.body?.expectedEndDate);

  if (!projectName) {
    return res.status(400).json({
      code: "PROJECT_NAME_REQUIRED",
      message: "กรุณาระบุชื่อโครงการหรืองาน",
    });
  }

  if (startDate === undefined || expectedEndDate === undefined) {
    return res.status(400).json({
      code: "INVALID_PROJECT_DATE",
      message: "วันที่ของโครงการไม่ถูกต้อง",
    });
  }

  if (!validateDateRange(startDate, expectedEndDate)) {
    return res.status(400).json({
      code: "INVALID_PROJECT_DATE_RANGE",
      message: "วันสิ้นสุดโครงการต้องไม่มาก่อนวันเริ่มต้น",
    });
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO projects (
          project_code,
          project_name,
          responsible_person,
          default_location,
          start_date,
          expected_end_date
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        projectCode,
        projectName,
        responsiblePerson,
        defaultLocation,
        startDate,
        expectedEndDate,
      ],
    );

    return res.status(201).json({
      message: "สร้างโครงการเรียบร้อย",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        code: "PROJECT_CODE_ALREADY_EXISTS",
        message: "รหัสโครงการนี้มีอยู่แล้ว",
      });
    }

    console.error("Create project failed:", error);

    return res.status(500).json({
      code: "PROJECT_CREATE_FAILED",
      message: "ไม่สามารถสร้างโครงการได้",
    });
  }
});

router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_PROJECT_ID",
      message: "รหัสโครงการไม่ถูกต้อง",
    });
  }

  try {
    const [projectResult, assetsResult, operationsResult] = await Promise.all([
      pool.query(`SELECT * FROM projects WHERE id = $1`, [id]),
      pool.query(
        `
          SELECT
            inventory_items.id,
            inventory_items.serial_number,
            inventory_items.current_status,
            inventory_items.current_issue_operation_id,
            inventory_items.current_location,
            inventory_items.current_responsible_person,
            inventory_items.expected_return_date,
            products.product_name,
            products.brand,
            products.part_number
          FROM inventory_items
          JOIN products ON products.id = inventory_items.product_id
          WHERE inventory_items.current_project_id = $1
            AND inventory_items.current_status IN ('IN_USE', 'CLAIM')
          ORDER BY inventory_items.expected_return_date ASC NULLS LAST,
                   inventory_items.serial_number ASC
        `,
        [id],
      ),
      pool.query(
        `
          SELECT
            operations.id,
            operations.operation_code,
            operations.operation_type,
            operations.destination_location,
            operations.performed_by,
            operations.created_at,
            COUNT(stock_movements.id)::bigint AS item_count
          FROM operations
          LEFT JOIN stock_movements
            ON stock_movements.operation_id = operations.id
          WHERE operations.project_id = $1
          GROUP BY operations.id
          ORDER BY operations.created_at DESC
          LIMIT 10
        `,
        [id],
      ),
    ]);

    if (projectResult.rowCount === 0) {
      return res.status(404).json({
        code: "PROJECT_NOT_FOUND",
        message: "ไม่พบโครงการที่ต้องการ",
      });
    }

    return res.status(200).json({
      data: {
        project: projectResult.rows[0],
        assets: assetsResult.rows,
        operations: operationsResult.rows.map((row) => ({
          ...row,
          item_count: Number(row.item_count || 0),
        })),
      },
    });
  } catch (error) {
    console.error("Get project detail failed:", error);

    return res.status(500).json({
      code: "PROJECT_GET_FAILED",
      message: "ไม่สามารถโหลดรายละเอียดโครงการได้",
    });
  }
});

// Project metadata updates are handled by the management route below.

// ASSETOPS-PROJECT-MANAGEMENT-v1

function projectMgmtParseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function projectMgmtText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function projectMgmtDate(value) {
  const text = String(value ?? "").trim();

  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;

  const parsed = new Date(`${text}T00:00:00Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== text
  ) {
    return undefined;
  }

  return text;
}

async function projectMgmtUsage(client, id) {
  // One pg Client must execute its transaction queries sequentially.
  const assetsResult = await client.query(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE current_status = 'IN_USE'
        )::int AS active
      FROM inventory_items
      WHERE current_project_id = $1
    `,
    [id],
  );

  const operationsResult = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM operations
      WHERE project_id = $1
    `,
    [id],
  );

  // stock_movements has operation_id, not project_id.
  // Resolve project ownership through operations.
  const movementsResult = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM stock_movements AS sm
      INNER JOIN operations AS op
        ON op.id = sm.operation_id
      WHERE op.project_id = $1
    `,
    [id],
  );

  const inventory = Number(assetsResult.rows[0]?.total || 0);
  const activeAssets = Number(assetsResult.rows[0]?.active || 0);
  const operations = Number(operationsResult.rows[0]?.count || 0);
  const movements = Number(movementsResult.rows[0]?.count || 0);

  return {
    inventory,
    activeAssets,
    operations,
    movements,
    total: inventory + operations + movements,
  };
}

router.put("/:id", async (req, res) => {
  const id = projectMgmtParseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_PROJECT_ID",
      message: "รหัสโครงการไม่ถูกต้อง",
    });
  }

  const projectName = String(req.body?.projectName ?? "").trim();
  const projectCode = projectMgmtText(req.body?.projectCode);
  const responsiblePerson = projectMgmtText(req.body?.responsiblePerson);
  const defaultLocation = projectMgmtText(req.body?.defaultLocation);
  const startDate = projectMgmtDate(req.body?.startDate);
  const expectedEndDate = projectMgmtDate(req.body?.expectedEndDate);

  if (!projectName) {
    return res.status(400).json({
      code: "PROJECT_NAME_REQUIRED",
      message: "กรุณากรอกชื่อโครงการ / งาน",
    });
  }

  if (startDate === undefined || expectedEndDate === undefined) {
    return res.status(400).json({
      code: "INVALID_PROJECT_DATE",
      message: "วันที่ไม่ถูกต้อง",
    });
  }

  if (startDate && expectedEndDate && expectedEndDate < startDate) {
    return res.status(400).json({
      code: "INVALID_PROJECT_DATE_RANGE",
      message: "กำหนดเสร็จต้องไม่ก่อนวันเริ่มงาน",
    });
  }

  try {
    const result = await pool.query(
      `
        UPDATE projects
        SET
          project_code = $1,
          project_name = $2,
          responsible_person = $3,
          default_location = $4,
          start_date = $5,
          expected_end_date = $6,
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `,
      [
        projectCode,
        projectName,
        responsiblePerson,
        defaultLocation,
        startDate,
        expectedEndDate,
        id,
      ],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        code: "PROJECT_NOT_FOUND",
        message: "ไม่พบโครงการ / งานที่ต้องการ",
      });
    }

    return res.status(200).json({
      message: "แก้ไขโครงการ / งานเรียบร้อย",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        code: "PROJECT_CODE_ALREADY_EXISTS",
        message: "รหัสโครงการนี้มีอยู่ในระบบแล้ว",
      });
    }

    console.error("Update project failed:", error);

    return res.status(500).json({
      code: "PROJECT_UPDATE_FAILED",
      message: "ไม่สามารถแก้ไขโครงการ / งานได้",
    });
  }
});

router.patch("/:id/status", async (req, res) => {
  const id = projectMgmtParseId(req.params.id);
  const status = String(req.body?.status ?? "").trim().toUpperCase();

  if (!id) {
    return res.status(400).json({
      code: "INVALID_PROJECT_ID",
      message: "รหัสโครงการไม่ถูกต้อง",
    });
  }

  if (!["ACTIVE", "CLOSED"].includes(status)) {
    return res.status(400).json({
      code: "INVALID_PROJECT_STATUS",
      message: "สถานะโครงการไม่ถูกต้อง",
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
        message: "ไม่พบโครงการ / งานที่ต้องการ",
      });
    }

    if (status === "CLOSED") {
      const usage = await projectMgmtUsage(client, id);

      if (usage.activeAssets > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          code: "PROJECT_HAS_ACTIVE_ASSETS",
          message:
            "ยังมีอุปกรณ์ใช้งานอยู่ในโครงการนี้ กรุณารับคืนหรือย้ายอุปกรณ์ออกก่อนปิดงาน",
          data: { usage },
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

    await client.query("COMMIT");

    return res.status(200).json({
      message:
        status === "ACTIVE"
          ? "เปิดงานอีกครั้งเรียบร้อย"
          : "ปิดงานเรียบร้อย",
      data: updated.rows[0],
    });
  } catch (error) {
    if (client) {
      try { await client.query("ROLLBACK"); } catch {}
    }

    console.error("Update project status failed:", error);

    return res.status(500).json({
      code: "PROJECT_STATUS_UPDATE_FAILED",
      message: "ไม่สามารถเปลี่ยนสถานะโครงการได้",
    });
  } finally {
    client?.release();
  }
});

router.delete("/:id", async (req, res) => {
  const id = projectMgmtParseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_PROJECT_ID",
      message: "รหัสโครงการไม่ถูกต้อง",
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
        message: "ไม่พบโครงการ / งานที่ต้องการ",
      });
    }

    const usage = await projectMgmtUsage(client, id);

    if (usage.total > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        code: "PROJECT_IN_USE",
        message:
          "โครงการนี้เคยถูกใช้งานแล้ว จึงลบถาวรไม่ได้ กรุณาใช้ “ปิดงาน” เพื่อรักษาประวัติเดิม",
        data: { usage },
      });
    }

    await client.query(`DELETE FROM projects WHERE id = $1`, [id]);
    await client.query("COMMIT");

    return res.status(200).json({
      message: "ลบโครงการ / งานถาวรเรียบร้อย",
      data: { id },
    });
  } catch (error) {
    if (client) {
      try { await client.query("ROLLBACK"); } catch {}
    }

    console.error("Delete project failed:", error);

    return res.status(500).json({
      code: "PROJECT_DELETE_FAILED",
      message: "ไม่สามารถลบโครงการ / งานได้",
    });
  } finally {
    client?.release();
  }
});

export default router;
