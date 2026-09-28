import { randomUUID } from "node:crypto";
import express from "express";

import pool from "../db.js";

const router = express.Router();

const OPERATION_RULES = {
  ISSUE: {
    allowedStatuses: new Set(["IN_STOCK"]),
    failureMessage: "เบิกได้เฉพาะอุปกรณ์ที่อยู่ในคลัง",
  },
  RETURN: {
    allowedStatuses: new Set(["IN_USE"]),
    failureMessage: "รับคืนได้เฉพาะอุปกรณ์ที่กำลังใช้งาน",
  },
  MOVE: {
    allowedStatuses: new Set(["IN_STOCK", "IN_USE", "CLAIM"]),
    failureMessage: "สถานะปัจจุบันไม่อนุญาตให้ย้ายตำแหน่ง",
  },
};

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

function parseAssetIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(parseId).filter(Boolean))].sort((a, b) => a - b);
}

function operationRule(type) {
  return OPERATION_RULES[type] || null;
}

async function loadAssets(client, assetIds, { lock = false } = {}) {
  if (assetIds.length === 0) {
    return [];
  }

  const result = await client.query(
    `
      SELECT
        inventory_items.id,
        inventory_items.product_id,
        inventory_items.serial_number,
        inventory_items.current_status,
        inventory_items.current_location,
        inventory_items.current_project_id,
        inventory_items.current_responsible_person,
        inventory_items.expected_return_date,
        inventory_items.current_issue_operation_id,
        products.product_name,
        products.brand,
        products.part_number,
        projects.project_name AS current_project_name,
        projects.project_code AS current_project_code
      FROM inventory_items
      JOIN products ON products.id = inventory_items.product_id
      LEFT JOIN projects ON projects.id = inventory_items.current_project_id
      WHERE inventory_items.id = ANY($1::bigint[])
      ORDER BY inventory_items.id ASC
      ${lock ? "FOR UPDATE OF inventory_items" : ""}
    `,
    [assetIds],
  );

  return result.rows;
}

function validationRows(type, requestedIds, assets) {
  const rule = operationRule(type);
  const found = new Map(assets.map((item) => [Number(item.id), item]));

  return requestedIds.map((id) => {
    const item = found.get(id);

    if (!item) {
      return {
        id,
        eligible: false,
        code: "INVENTORY_NOT_FOUND",
        reason: "ไม่พบอุปกรณ์นี้ในระบบ",
      };
    }

    if (!rule.allowedStatuses.has(item.current_status)) {
      return {
        ...item,
        eligible: false,
        code: "INVALID_INVENTORY_STATE",
        reason: rule.failureMessage,
      };
    }

    return {
      ...item,
      eligible: true,
      code: null,
      reason: null,
    };
  });
}

async function resolveProject(client, projectId) {
  if (!projectId) {
    return null;
  }

  const result = await client.query(
    `
      SELECT *
      FROM projects
      WHERE id = $1
        AND status = 'ACTIVE'
    `,
    [projectId],
  );

  return result.rows[0] || null;
}

async function createOperationCode(client) {
  const sequenceResult = await client.query(`
    SELECT
      nextval('operations_code_seq')::bigint AS seq,
      TO_CHAR(
        CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok',
        'YYYYMMDD'
      ) AS operation_day
  `);
  const sequence = Number(sequenceResult.rows[0].seq);
  const operationDay = sequenceResult.rows[0].operation_day;

  return `OP-${operationDay}-${String(sequence).padStart(5, "0")}`;
}

function commonValue(items, selector) {
  if (items.length === 0) {
    return null;
  }

  const values = items.map(selector);
  const first = values[0];

  return values.every((value) => value === first) ? first : null;
}

async function loadSourceOperation(client, sourceOperationId) {
  if (!sourceOperationId) {
    return null;
  }

  const result = await client.query(
    `
      SELECT
        id,
        operation_type,
        project_id,
        project_name_snapshot,
        reference_code
      FROM operations
      WHERE id = $1
    `,
    [sourceOperationId],
  );

  return result.rows[0] || null;
}

async function loadOperationDetail(client, id) {
  const operationResult = await client.query(
    `
      SELECT
        operations.*,
        projects.project_code,
        projects.project_name
      FROM operations
      LEFT JOIN projects ON projects.id = operations.project_id
      WHERE operations.id = $1
    `,
    [id],
  );

  if (operationResult.rowCount === 0) {
    return null;
  }

  const itemsResult = await client.query(
    `
      SELECT
        stock_movements.id AS movement_id,
        stock_movements.movement_type,
        stock_movements.from_location,
        stock_movements.to_location,
        stock_movements.movement_date,
        inventory_items.id,
        inventory_items.serial_number,
        inventory_items.current_status,
        inventory_items.current_location,
        inventory_items.current_project_id,
        inventory_items.current_responsible_person,
        inventory_items.expected_return_date,
        inventory_items.current_issue_operation_id,
        products.product_name,
        products.brand,
        products.part_number
      FROM stock_movements
      JOIN inventory_items
        ON inventory_items.id = stock_movements.inventory_item_id
      JOIN products
        ON products.id = inventory_items.product_id
      WHERE stock_movements.operation_id = $1
      ORDER BY stock_movements.id ASC
    `,
    [id],
  );

  return {
    operation: operationResult.rows[0],
    items: itemsResult.rows,
  };
}

router.get("/summary", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE current_status = 'IN_USE'
            AND expected_return_date < CURRENT_DATE
        )::bigint AS overdue,
        COUNT(*) FILTER (
          WHERE current_status = 'IN_USE'
            AND expected_return_date = CURRENT_DATE
        )::bigint AS due_today,
        COUNT(*) FILTER (
          WHERE current_status = 'CLAIM'
        )::bigint AS claim
      FROM inventory_items
    `);

    const recentResult = await pool.query(`
      SELECT
        operations.id,
        operations.operation_code,
        operations.operation_type,
        operations.project_name_snapshot,
        operations.destination_location,
        operations.created_at,
        COUNT(stock_movements.id)::bigint AS item_count
      FROM operations
      LEFT JOIN stock_movements ON stock_movements.operation_id = operations.id
      GROUP BY operations.id
      ORDER BY operations.created_at DESC
      LIMIT 5
    `);

    const row = result.rows[0];

    return res.status(200).json({
      data: {
        overdue: Number(row.overdue || 0),
        dueToday: Number(row.due_today || 0),
        claim: Number(row.claim || 0),
        recent: recentResult.rows.map((item) => ({
          ...item,
          item_count: Number(item.item_count || 0),
        })),
      },
    });
  } catch (error) {
    console.error("Get operations summary failed:", error);

    return res.status(500).json({
      code: "OPERATIONS_SUMMARY_FAILED",
      message: "ไม่สามารถโหลดภาพรวมการเบิกคืนได้",
    });
  }
});

router.post("/validate", async (req, res) => {
  const type = cleanText(req.body?.type)?.toUpperCase();
  const assetIds = parseAssetIds(req.body?.assetIds);
  const rule = operationRule(type);

  if (!rule) {
    return res.status(400).json({
      code: "INVALID_OPERATION_TYPE",
      message: "ประเภทการดำเนินการไม่ถูกต้อง",
    });
  }

  if (assetIds.length === 0 || assetIds.length > 500) {
    return res.status(400).json({
      code: "INVALID_OPERATION_ITEMS",
      message: "กรุณาเลือกอุปกรณ์ 1–500 รายการ",
    });
  }

  try {
    const assets = await loadAssets(pool, assetIds);
    const rows = validationRows(type, assetIds, assets);

    return res.status(200).json({
      data: {
        rows,
        summary: {
          total: rows.length,
          eligible: rows.filter((row) => row.eligible).length,
          ineligible: rows.filter((row) => !row.eligible).length,
        },
      },
    });
  } catch (error) {
    console.error("Validate operation failed:", error);

    return res.status(500).json({
      code: "OPERATION_VALIDATE_FAILED",
      message: "ไม่สามารถตรวจสอบรายการอุปกรณ์ได้",
    });
  }
});

router.post("/", async (req, res) => {
  const type = cleanText(req.body?.type)?.toUpperCase();
  const assetIds = parseAssetIds(req.body?.assetIds);
  const rule = operationRule(type);
  const destinationLocation = cleanText(req.body?.destinationLocation);
  const projectId = parseId(req.body?.projectId);
  const referenceCode = cleanText(req.body?.referenceCode);
  const requestedResponsiblePerson = cleanText(req.body?.responsiblePerson);
  const requestedExpectedReturnDate = parseDateOnly(req.body?.expectedReturnDate);
  const performedBy = cleanText(req.body?.performedBy);
  const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
  const clientRequestId = cleanText(req.body?.clientRequestId) || randomUUID();
  const sourceOperationId = parseId(req.body?.sourceOperationId);

  if (!rule) {
    return res.status(400).json({
      code: "INVALID_OPERATION_TYPE",
      message: "ประเภทการดำเนินการไม่ถูกต้อง",
    });
  }

  if (assetIds.length === 0 || assetIds.length > 500) {
    return res.status(400).json({
      code: "INVALID_OPERATION_ITEMS",
      message: "กรุณาเลือกอุปกรณ์ 1–500 รายการ",
    });
  }

  if (!destinationLocation) {
    return res.status(400).json({
      code: "LOCATION_REQUIRED",
      message: "กรุณาระบุสถานที่ปลายทาง",
    });
  }

  if (!performedBy) {
    return res.status(400).json({
      code: "PERFORMED_BY_REQUIRED",
      message: "กรุณาระบุผู้ดำเนินการ",
    });
  }

  if (requestedExpectedReturnDate === undefined) {
    return res.status(400).json({
      code: "INVALID_EXPECTED_RETURN_DATE",
      message: "วันที่กำหนดคืนไม่ถูกต้อง",
    });
  }

  if (sourceOperationId && type !== "RETURN") {
    return res.status(400).json({
      code: "INVALID_SOURCE_OPERATION",
      message: "อ้างอิงรายการต้นทางได้เฉพาะการรับคืนอุปกรณ์",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const duplicateResult = await client.query(
      `SELECT id FROM operations WHERE client_request_id = $1`,
      [clientRequestId],
    );

    if (duplicateResult.rowCount > 0) {
      const existing = await loadOperationDetail(client, duplicateResult.rows[0].id);
      await client.query("COMMIT");

      return res.status(200).json({
        message: "รายการนี้ถูกบันทึกไว้แล้ว ระบบไม่สร้างรายการซ้ำ",
        data: existing,
      });
    }

    const project = type === "ISSUE"
      ? await resolveProject(client, projectId)
      : null;

    if (type === "ISSUE" && projectId && !project) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: "PROJECT_NOT_FOUND",
        message: "ไม่พบโครงการที่เลือก หรือโครงการไม่ได้อยู่ในสถานะใช้งาน",
      });
    }

    const sourceOperation = await loadSourceOperation(client, sourceOperationId);

    if (sourceOperationId && !sourceOperation) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: "SOURCE_OPERATION_NOT_FOUND",
        message: "ไม่พบรายการเบิกต้นทางที่อ้างอิง",
      });
    }

    if (sourceOperation && sourceOperation.operation_type !== "ISSUE") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        code: "INVALID_SOURCE_OPERATION_TYPE",
        message: "รายการต้นทางต้องเป็นรายการเบิกอุปกรณ์",
      });
    }

    const responsiblePerson =
      requestedResponsiblePerson || cleanText(project?.responsible_person);
    const expectedReturnDate =
      requestedExpectedReturnDate || project?.expected_end_date || null;

    if (type === "ISSUE" && !responsiblePerson) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        code: "RESPONSIBLE_PERSON_REQUIRED",
        message: "กรุณาระบุผู้รับผิดชอบอุปกรณ์",
      });
    }

    const assets = await loadAssets(client, assetIds, { lock: true });
    const rows = validationRows(type, assetIds, assets);
    const conflicts = rows.filter((row) => !row.eligible);

    if (conflicts.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        code: "OPERATION_ITEMS_CHANGED",
        message: "มีอุปกรณ์บางรายการไม่พร้อมดำเนินการ กรุณาตรวจสอบรายการอีกครั้ง",
        data: {
          rows,
          summary: {
            total: rows.length,
            eligible: rows.length - conflicts.length,
            ineligible: conflicts.length,
          },
        },
      });
    }

    if (
      sourceOperation &&
      assets.some(
        (item) =>
          Number(item.current_issue_operation_id) !== Number(sourceOperation.id),
      )
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        code: "SOURCE_OPERATION_ASSIGNMENT_CHANGED",
        message:
          "อุปกรณ์บางรายการไม่ได้ค้างอยู่จากใบเบิกนี้แล้ว กรุณาโหลดรายการใหม่",
      });
    }

    const commonProjectId = commonValue(
      assets,
      (item) => (item.current_project_id == null ? null : Number(item.current_project_id)),
    );
    const commonProjectName = commonValue(
      assets,
      (item) => item.current_project_name || null,
    );
    const commonResponsiblePerson = commonValue(
      assets,
      (item) => item.current_responsible_person || null,
    );

    const operationProjectId =
      type === "ISSUE" ? project?.id || null : commonProjectId;
    const operationProjectName =
      type === "ISSUE" ? project?.project_name || null : commonProjectName;
    const operationResponsiblePerson =
      type === "ISSUE" ? responsiblePerson : commonResponsiblePerson;

    const operationCode = await createOperationCode(client);
    const operationResult = await client.query(
      `
        INSERT INTO operations (
          operation_code,
          operation_type,
          project_id,
          project_name_snapshot,
          reference_code,
          responsible_person,
          destination_location,
          expected_return_date,
          performed_by,
          note,
          client_request_id,
          source_operation_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `,
      [
        operationCode,
        type,
        operationProjectId,
        operationProjectName,
        referenceCode || sourceOperation?.reference_code || null,
        operationResponsiblePerson,
        destinationLocation,
        type === "ISSUE" ? expectedReturnDate : null,
        performedBy,
        note,
        clientRequestId,
        sourceOperationId,
      ],
    );

    const operation = operationResult.rows[0];

    for (const item of assets) {
      await client.query(
        `
          INSERT INTO stock_movements (
            inventory_item_id,
            movement_type,
            performed_by,
            from_location,
            to_location,
            note,
            operation_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          item.id,
          type,
          performedBy,
          item.current_location,
          destinationLocation,
          note,
          operation.id,
        ],
      );

      if (type === "ISSUE") {
        await client.query(
          `
            UPDATE inventory_items
            SET
              current_status = 'IN_USE',
              current_location = $1,
              current_project_id = $2,
              current_responsible_person = $3,
              expected_return_date = $4,
              current_issue_operation_id = $5,
              updated_at = NOW()
            WHERE id = $6
          `,
          [
            destinationLocation,
            operationProjectId,
            responsiblePerson,
            expectedReturnDate,
            operation.id,
            item.id,
          ],
        );
      } else if (type === "RETURN") {
        await client.query(
          `
            UPDATE inventory_items
            SET
              current_status = 'IN_STOCK',
              current_location = $1,
              current_project_id = NULL,
              current_responsible_person = NULL,
              expected_return_date = NULL,
              current_issue_operation_id = NULL,
              updated_at = NOW()
            WHERE id = $2
          `,
          [destinationLocation, item.id],
        );
      } else if (type === "MOVE") {
        await client.query(
          `
            UPDATE inventory_items
            SET current_location = $1, updated_at = NOW()
            WHERE id = $2
          `,
          [destinationLocation, item.id],
        );
      }
    }

    const detail = await loadOperationDetail(client, operation.id);
    await client.query("COMMIT");

    const verb = type === "ISSUE" ? "เบิก" : type === "RETURN" ? "รับคืน" : "ย้าย";

    return res.status(201).json({
      message: `${verb}อุปกรณ์ ${assetIds.length} รายการเรียบร้อย`,
      data: detail,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Operation rollback failed:", rollbackError);
      }
    }

    if (error.code === "23505" && error.constraint?.includes("client_request")) {
      try {
        const existingResult = await pool.query(
          `SELECT id FROM operations WHERE client_request_id = $1`,
          [clientRequestId],
        );

        if (existingResult.rowCount > 0) {
          const detail = await loadOperationDetail(pool, existingResult.rows[0].id);
          return res.status(200).json({
            message: "รายการนี้ถูกบันทึกไว้แล้ว ระบบไม่สร้างรายการซ้ำ",
            data: detail,
          });
        }
      } catch (lookupError) {
        console.error("Idempotency lookup failed:", lookupError);
      }
    }

    console.error("Create operation failed:", error);

    return res.status(500).json({
      code: "OPERATION_CREATE_FAILED",
      message: "ไม่สามารถบันทึกรายการเบิกคืนได้",
    });
  } finally {
    client?.release();
  }
});

router.get("/", async (req, res) => {
  const type = cleanText(req.query?.type)?.toUpperCase();
  const projectId = parseId(req.query?.projectId);
  const limit = Math.min(Math.max(Number(req.query?.limit) || 50, 1), 100);
  const conditions = [];
  const values = [];

  if (type) {
    if (!operationRule(type)) {
      return res.status(400).json({
        code: "INVALID_OPERATION_TYPE",
        message: "ประเภทการดำเนินการไม่ถูกต้อง",
      });
    }

    values.push(type);
    conditions.push(`operations.operation_type = $${values.length}`);
  }

  if (projectId) {
    values.push(projectId);
    conditions.push(`operations.project_id = $${values.length}`);
  }

  values.push(limit);
  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const result = await pool.query(
      `
        SELECT
          operations.id,
          operations.operation_code,
          operations.operation_type,
          operations.project_id,
          operations.project_name_snapshot,
          operations.reference_code,
          operations.responsible_person,
          operations.destination_location,
          operations.expected_return_date,
          operations.performed_by,
          operations.status,
          operations.created_at,
          COUNT(stock_movements.id)::bigint AS item_count
        FROM operations
        LEFT JOIN stock_movements ON stock_movements.operation_id = operations.id
        ${whereSql}
        GROUP BY operations.id
        ORDER BY operations.created_at DESC
        LIMIT $${values.length}
      `,
      values,
    );

    return res.status(200).json({
      data: result.rows.map((row) => ({
        ...row,
        item_count: Number(row.item_count || 0),
      })),
    });
  } catch (error) {
    console.error("Get operations failed:", error);

    return res.status(500).json({
      code: "OPERATIONS_GET_FAILED",
      message: "ไม่สามารถโหลดประวัติการเบิกคืนได้",
    });
  }
});

router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_OPERATION_ID",
      message: "รหัสรายการไม่ถูกต้อง",
    });
  }

  try {
    const detail = await loadOperationDetail(pool, id);

    if (!detail) {
      return res.status(404).json({
        code: "OPERATION_NOT_FOUND",
        message: "ไม่พบรายการที่ต้องการ",
      });
    }

    return res.status(200).json({ data: detail });
  } catch (error) {
    console.error("Get operation detail failed:", error);

    return res.status(500).json({
      code: "OPERATION_GET_FAILED",
      message: "ไม่สามารถโหลดรายละเอียดรายการได้",
    });
  }
});

export default router;
