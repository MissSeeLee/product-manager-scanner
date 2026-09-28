BEGIN;

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS current_issue_operation_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_items_current_issue_operation_fk'
  ) THEN
    ALTER TABLE inventory_items
      ADD CONSTRAINT inventory_items_current_issue_operation_fk
      FOREIGN KEY (current_issue_operation_id)
      REFERENCES operations(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS inventory_items_current_issue_operation_idx
  ON inventory_items (current_issue_operation_id)
  WHERE current_issue_operation_id IS NOT NULL;

-- Backfill only when the latest lifecycle event is a grouped ISSUE and the
-- current snapshot is still IN_USE. This avoids attaching a re-issued asset
-- to an older operation after it has already been returned.
WITH latest_lifecycle AS (
  SELECT DISTINCT ON (stock_movements.inventory_item_id)
    stock_movements.inventory_item_id,
    stock_movements.movement_type,
    stock_movements.operation_id
  FROM stock_movements
  WHERE stock_movements.movement_type IN (
    'ISSUE',
    'RETURN',
    'CLAIM_RETURN',
    'REPLACED',
    'RETIRE'
  )
  ORDER BY
    stock_movements.inventory_item_id,
    stock_movements.movement_date DESC,
    stock_movements.id DESC
)
UPDATE inventory_items
SET current_issue_operation_id = latest_lifecycle.operation_id
FROM latest_lifecycle
WHERE inventory_items.id = latest_lifecycle.inventory_item_id
  AND inventory_items.current_status = 'IN_USE'
  AND inventory_items.current_issue_operation_id IS NULL
  AND latest_lifecycle.movement_type = 'ISSUE'
  AND latest_lifecycle.operation_id IS NOT NULL;

COMMIT;
