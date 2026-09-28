BEGIN;

CREATE SCHEMA IF NOT EXISTS viewer;

REVOKE ALL ON SCHEMA viewer FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'assetops_viewer_reader'
  ) THEN
    CREATE ROLE assetops_viewer_reader NOLOGIN;
  END IF;
END
$$;

CREATE OR REPLACE VIEW viewer.assets AS
SELECT
  i.id AS asset_id,
  'AST-' || LPAD(i.id::text, 6, '0') AS public_code,
  CASE
    WHEN char_length(i.serial_number) <= 4 THEN '****'
    ELSE
      left(i.serial_number, 2)
      || repeat('*', GREATEST(char_length(i.serial_number) - 6, 2))
      || right(i.serial_number, 4)
  END AS masked_serial,
  p.product_name,
  p.brand,
  p.part_number,
  p.category,
  i.current_status,
  received.received_date,
  latest.last_activity_at
FROM inventory_items i
JOIN products p
  ON p.id = i.product_id
LEFT JOIN LATERAL (
  SELECT sm.movement_date::date AS received_date
  FROM stock_movements sm
  WHERE sm.inventory_item_id = i.id
    AND sm.movement_type = 'RECEIVE'
  ORDER BY sm.movement_date ASC, sm.id ASC
  LIMIT 1
) received
  ON true
LEFT JOIN LATERAL (
  SELECT sm.movement_date AS last_activity_at
  FROM stock_movements sm
  WHERE sm.inventory_item_id = i.id
  ORDER BY sm.movement_date DESC, sm.id DESC
  LIMIT 1
) latest
  ON true;

CREATE OR REPLACE VIEW viewer.asset_history AS
SELECT
  sm.id AS movement_id,
  sm.inventory_item_id AS asset_id,
  a.public_code,
  a.masked_serial,
  a.product_name,
  sm.movement_type,
  sm.movement_date
FROM stock_movements sm
JOIN viewer.assets a
  ON a.asset_id = sm.inventory_item_id;

REVOKE ALL ON ALL TABLES IN SCHEMA viewer FROM PUBLIC;

GRANT USAGE ON SCHEMA viewer TO assetops_viewer_reader;
GRANT SELECT ON viewer.assets TO assetops_viewer_reader;
GRANT SELECT ON viewer.asset_history TO assetops_viewer_reader;

COMMIT;
