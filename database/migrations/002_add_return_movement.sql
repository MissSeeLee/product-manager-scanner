BEGIN;

ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_type_valid;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_type_valid
  CHECK (
    movement_type IN (
      'RECEIVE',
      'ISSUE',
      'RETURN',
      'MOVE',
      'CLAIM',
      'CLAIM_RETURN',
      'REPLACED',
      'RETIRE'
    )
  );

COMMIT;
