BEGIN;

CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    product_name VARCHAR(200) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    part_number VARCHAR(150) NOT NULL,

    description TEXT NOT NULL DEFAULT '',
    category VARCHAR(100) NOT NULL DEFAULT 'ทั่วไป',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT products_name_not_blank
        CHECK (LENGTH(BTRIM(product_name)) > 0),

    CONSTRAINT products_brand_not_blank
        CHECK (LENGTH(BTRIM(brand)) > 0),

    CONSTRAINT products_part_number_not_blank
        CHECK (LENGTH(BTRIM(part_number)) > 0),

    CONSTRAINT products_brand_part_number_unique
        UNIQUE (brand, part_number)
);


CREATE TABLE inventory_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    product_id BIGINT NOT NULL,

    serial_number VARCHAR(150) NOT NULL,

    current_status VARCHAR(30) NOT NULL DEFAULT 'IN_STOCK',

    current_location VARCHAR(200),

    warranty_start DATE,
    warranty_end DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT inventory_items_product_fk
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT inventory_serial_not_blank
        CHECK (LENGTH(BTRIM(serial_number)) > 0),

    CONSTRAINT inventory_serial_unique
        UNIQUE (serial_number),

    CONSTRAINT inventory_status_valid
        CHECK (
            current_status IN (
                'IN_STOCK',
                'IN_USE',
                'CLAIM',
                'REPLACED',
                'RETIRED'
            )
        ),

    CONSTRAINT inventory_warranty_dates_valid
        CHECK (
            warranty_end IS NULL
            OR warranty_start IS NULL
            OR warranty_end >= warranty_start
        )
);


CREATE TABLE stock_movements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    inventory_item_id BIGINT NOT NULL,

    movement_type VARCHAR(30) NOT NULL,

    movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    performed_by VARCHAR(150),

    distributor VARCHAR(200),

    from_location VARCHAR(200),
    to_location VARCHAR(200),

    note TEXT NOT NULL DEFAULT '',

    related_inventory_item_id BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT stock_movements_item_fk
        FOREIGN KEY (inventory_item_id)
        REFERENCES inventory_items(id)
        ON DELETE RESTRICT,

    CONSTRAINT stock_movements_related_item_fk
        FOREIGN KEY (related_inventory_item_id)
        REFERENCES inventory_items(id)
        ON DELETE RESTRICT,

    CONSTRAINT stock_movements_type_valid
        CHECK (
            movement_type IN (
                'RECEIVE',
                'ISSUE',
                'CLAIM',
                'CLAIM_RETURN',
                'MOVE',
                'REPLACED',
                'RETIRE'
            )
        )
);


CREATE INDEX inventory_items_product_id_idx
ON inventory_items (product_id);

CREATE INDEX inventory_items_status_idx
ON inventory_items (current_status);

CREATE INDEX stock_movements_inventory_item_id_idx
ON stock_movements (inventory_item_id);

CREATE INDEX stock_movements_related_inventory_item_id_idx
ON stock_movements (related_inventory_item_id);

CREATE INDEX stock_movements_date_idx
ON stock_movements (movement_date DESC);


COMMIT;