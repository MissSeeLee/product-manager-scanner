BEGIN;

CREATE TABLE IF NOT EXISTS locations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  location_code VARCHAR(80),
  location_name VARCHAR(160) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT locations_name_not_blank CHECK (BTRIM(location_name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS locations_name_unique_ci
  ON locations (LOWER(location_name));

CREATE UNIQUE INDEX IF NOT EXISTS locations_code_unique_ci
  ON locations (LOWER(location_code))
  WHERE location_code IS NOT NULL AND BTRIM(location_code) <> '';

INSERT INTO locations (location_name)
SELECT DISTINCT BTRIM(current_location)
FROM inventory_items
WHERE current_location IS NOT NULL
  AND BTRIM(current_location) <> ''
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS projects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_code VARCHAR(80),
  project_name VARCHAR(200) NOT NULL,
  responsible_person VARCHAR(160),
  default_location VARCHAR(160),
  start_date DATE,
  expected_end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT projects_name_not_blank CHECK (BTRIM(project_name) <> ''),
  CONSTRAINT projects_status_valid CHECK (status IN ('ACTIVE', 'CLOSED', 'CANCELLED')),
  CONSTRAINT projects_date_range_valid CHECK (
    expected_end_date IS NULL OR start_date IS NULL OR expected_end_date >= start_date
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS projects_code_unique_ci
  ON projects (LOWER(project_code))
  WHERE project_code IS NOT NULL AND BTRIM(project_code) <> '';

CREATE SEQUENCE IF NOT EXISTS operations_code_seq START WITH 1;

CREATE TABLE IF NOT EXISTS operations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operation_code VARCHAR(40) NOT NULL UNIQUE,
  operation_type VARCHAR(20) NOT NULL,
  project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  project_name_snapshot VARCHAR(200),
  reference_code VARCHAR(120),
  responsible_person VARCHAR(160),
  destination_location VARCHAR(160) NOT NULL,
  expected_return_date DATE,
  performed_by VARCHAR(160),
  note TEXT NOT NULL DEFAULT '',
  client_request_id VARCHAR(120) NOT NULL UNIQUE,
  source_operation_id BIGINT REFERENCES operations(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operations_type_valid CHECK (operation_type IN ('ISSUE', 'RETURN', 'MOVE')),
  CONSTRAINT operations_status_valid CHECK (status IN ('COMPLETED', 'CANCELLED')),
  CONSTRAINT operations_destination_not_blank CHECK (BTRIM(destination_location) <> '')
);

CREATE INDEX IF NOT EXISTS operations_created_at_idx
  ON operations (created_at DESC);

CREATE INDEX IF NOT EXISTS operations_project_id_idx
  ON operations (project_id, created_at DESC);

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS current_project_id BIGINT,
  ADD COLUMN IF NOT EXISTS current_responsible_person VARCHAR(160),
  ADD COLUMN IF NOT EXISTS expected_return_date DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_items_current_project_fk'
  ) THEN
    ALTER TABLE inventory_items
      ADD CONSTRAINT inventory_items_current_project_fk
      FOREIGN KEY (current_project_id)
      REFERENCES projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS inventory_items_current_project_idx
  ON inventory_items (current_project_id);

CREATE INDEX IF NOT EXISTS inventory_items_expected_return_idx
  ON inventory_items (expected_return_date)
  WHERE expected_return_date IS NOT NULL;

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS operation_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_movements_operation_fk'
  ) THEN
    ALTER TABLE stock_movements
      ADD CONSTRAINT stock_movements_operation_fk
      FOREIGN KEY (operation_id)
      REFERENCES operations(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS stock_movements_operation_idx
  ON stock_movements (operation_id, id);

COMMIT;
