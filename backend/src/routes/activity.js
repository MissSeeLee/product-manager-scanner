import express from "express";

import pool from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query?.limit) || 100, 1), 250);

  try {
    const result = await pool.query(
      `
        SELECT *
        FROM (
          SELECT
            'MOVEMENT'::text AS source,
            sm.id::bigint AS source_id,
            sm.inventory_item_id::bigint AS entity_id,
            sm.movement_type::text AS action,
            sm.performed_by::text AS actor,
            sm.note::text AS note,
            sm.movement_date AS occurred_at,
            i.serial_number::text AS serial_number,
            p.product_name::text AS context_name,
            sm.from_location::text AS from_location,
            sm.to_location::text AS to_location,
            NULL::text AS reason
          FROM stock_movements sm
          LEFT JOIN inventory_items i
            ON i.id = sm.inventory_item_id
          LEFT JOIN products p
            ON p.id = i.product_id

          UNION ALL

          SELECT
            'CHANGE'::text AS source,
            log.id::bigint AS source_id,
            log.entity_id::bigint AS entity_id,
            log.action::text AS action,
            COALESCE(log.display_name, log.username)::text AS actor,
            NULL::text AS note,
            log.created_at AS occurred_at,
            CASE
              WHEN log.entity_type = 'INVENTORY_ITEM'
              THEN COALESCE(
                log.after_data->>'serial_number',
                log.before_data->>'serial_number'
              )
              ELSE NULL
            END::text AS serial_number,
            log.entity_type::text AS context_name,
            NULL::text AS from_location,
            NULL::text AS to_location,
            log.reason::text AS reason
          FROM record_change_log log
        ) activity
        ORDER BY occurred_at DESC, source_id DESC
        LIMIT $1
      `,
      [limit],
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    console.error("Activity feed failed:", error);
    return res.status(500).json({
      code: "ACTIVITY_GET_FAILED",
      message: "ไม่สามารถโหลดประวัติกิจกรรมได้",
    });
  }
});

export default router;
