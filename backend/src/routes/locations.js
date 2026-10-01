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

function cleanOptional(value) {
  const clean = String(value ?? "").trim();
  return clean || null;
}

async function getLocationUsage(client, locationName) {
  const [inventoryResult, movementResult, projectResult] = await Promise.all([
    client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM inventory_items
        WHERE current_location = $1
      `,
      [locationName],
    ),
    client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM stock_movements
        WHERE from_location = $1
           OR to_location = $1
      `,
      [locationName],
    ),
    client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM projects
        WHERE default_location = $1
      `,
      [locationName],
    ),
  ]);

  const inventory = Number(inventoryResult.rows[0]?.count || 0);
  const movements = Number(movementResult.rows[0]?.count || 0);
  const projects = Number(projectResult.rows[0]?.count || 0);

  return {
    inventory,
    movements,
    projects,
    total: inventory + movements + projects,
  };
}

router.get("/", async (req, res) => {
  const includeInactive = ["1", "true", "all"].includes(
    String(req.query.includeInactive || "").toLowerCase(),
  );

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          location_code,
          location_name,
          is_active,
          created_at,
          updated_at
        FROM locations
        ${includeInactive ? "" : "WHERE is_active = TRUE"}
        ORDER BY
          is_active DESC,
          lower(location_name),
          id
      `,
    );

    return res.status(200).json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Get locations failed:", error);

    return res.status(500).json({
      code: "LOCATION_LIST_FAILED",
      message: "ไม่สามารถโหลดรายการสถานที่ได้",
    });
  }
});

router.post("/", async (req, res) => {
  const locationName = String(req.body?.locationName ?? "").trim();
  const locationCode = cleanOptional(req.body?.locationCode);

  if (!locationName) {
    return res.status(400).json({
      code: "LOCATION_NAME_REQUIRED",
      message: "กรุณากรอกชื่อสถานที่",
    });
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO locations (
          location_name,
          location_code,
          is_active
        )
        VALUES ($1, $2, TRUE)
        RETURNING *
      `,
      [locationName, locationCode],
    );

    return res.status(201).json({
      message: "เพิ่มสถานที่เรียบร้อย",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        code: "LOCATION_ALREADY_EXISTS",
        message: "ชื่อหรือรหัสสถานที่นี้มีอยู่ในระบบแล้ว",
      });
    }

    console.error("Create location failed:", error);

    return res.status(500).json({
      code: "LOCATION_CREATE_FAILED",
      message: "ไม่สามารถเพิ่มสถานที่ได้",
    });
  }
});

router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_LOCATION_ID",
      message: "รหัสสถานที่ไม่ถูกต้อง",
    });
  }

  const locationName = String(req.body?.locationName ?? "").trim();
  const locationCode = cleanOptional(req.body?.locationCode);

  if (!locationName) {
    return res.status(400).json({
      code: "LOCATION_NAME_REQUIRED",
      message: "กรุณากรอกชื่อสถานที่",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const currentResult = await client.query(
      `
        SELECT *
        FROM locations
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        code: "LOCATION_NOT_FOUND",
        message: "ไม่พบสถานที่ที่ต้องการ",
      });
    }

    const current = currentResult.rows[0];
    const nameChanged = current.location_name !== locationName;

    if (nameChanged) {
      const usage = await getLocationUsage(client, current.location_name);

      if (usage.total > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          code: "LOCATION_NAME_IN_USE",
          message:
            "สถานที่นี้เคยถูกใช้งานแล้ว จึงไม่สามารถเปลี่ยนชื่อได้ กรุณาปิดใช้งานและสร้างสถานที่ใหม่แทน",
          data: { usage },
        });
      }
    }

    const updatedResult = await client.query(
      `
        UPDATE locations
        SET
          location_name = $1,
          location_code = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `,
      [locationName, locationCode, id],
    );

    await client.query("COMMIT");

    return res.status(200).json({
      message: "แก้ไขสถานที่เรียบร้อย",
      data: updatedResult.rows[0],
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Location update rollback failed:", rollbackError);
      }
    }

    if (error.code === "23505") {
      return res.status(409).json({
        code: "LOCATION_ALREADY_EXISTS",
        message: "ชื่อหรือรหัสสถานที่นี้มีอยู่ในระบบแล้ว",
      });
    }

    console.error("Update location failed:", error);

    return res.status(500).json({
      code: "LOCATION_UPDATE_FAILED",
      message: "ไม่สามารถแก้ไขสถานที่ได้",
    });
  } finally {
    client?.release();
  }
});

router.patch("/:id/status", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_LOCATION_ID",
      message: "รหัสสถานที่ไม่ถูกต้อง",
    });
  }

  if (typeof req.body?.isActive !== "boolean") {
    return res.status(400).json({
      code: "INVALID_LOCATION_STATUS",
      message: "สถานะสถานที่ไม่ถูกต้อง",
    });
  }

  try {
    const result = await pool.query(
      `
        UPDATE locations
        SET
          is_active = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [req.body.isActive, id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        code: "LOCATION_NOT_FOUND",
        message: "ไม่พบสถานที่ที่ต้องการ",
      });
    }

    return res.status(200).json({
      message: req.body.isActive
        ? "เปิดใช้งานสถานที่เรียบร้อย"
        : "ปิดใช้งานสถานที่เรียบร้อย",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Change location status failed:", error);

    return res.status(500).json({
      code: "LOCATION_STATUS_UPDATE_FAILED",
      message: "ไม่สามารถเปลี่ยนสถานะสถานที่ได้",
    });
  }
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      code: "INVALID_LOCATION_ID",
      message: "รหัสสถานที่ไม่ถูกต้อง",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const currentResult = await client.query(
      `
        SELECT *
        FROM locations
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: "LOCATION_NOT_FOUND",
        message: "ไม่พบสถานที่ที่ต้องการ",
      });
    }

    const current = currentResult.rows[0];
    const usage = await getLocationUsage(client, current.location_name);

    if (usage.total > 0) {
      await client.query(
        `
          UPDATE locations
          SET is_active = FALSE, updated_at = NOW()
          WHERE id = $1
        `,
        [id],
      );

      await client.query("COMMIT");
      return res.status(200).json({
        message: "ลบสถานที่เรียบร้อย",
        data: { id, preservedHistory: true },
      });
    }

    await client.query(
      `
        DELETE FROM locations
        WHERE id = $1
      `,
      [id],
    );

    await client.query("COMMIT");
    return res.status(200).json({
      message: "ลบสถานที่เรียบร้อย",
      data: { id, preservedHistory: false },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Location delete rollback failed:", rollbackError);
      }
    }

    console.error("Delete location failed:", error);
    return res.status(500).json({
      code: "LOCATION_DELETE_FAILED",
      message: "ไม่สามารถลบสถานที่ได้",
    });
  } finally {
    client?.release();
  }
});

export default router;