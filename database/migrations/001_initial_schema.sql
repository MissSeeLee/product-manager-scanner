-- 001_initial_schema.sql
-- Baseline schema for product-manager-scanner
-- Run on an empty PostgreSQL database.
-- Generated from the verified local schema, with the corrupted Thai default
-- restored to UTF-8: category DEFAULT 'ทั่วไป'.

BEGIN;

CREATE TABLE public.products (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_name varchar(200) NOT NULL,
    brand varchar(100) NOT NULL,
    part_number varchar(150) NOT NULL,
    description text NOT NULL DEFAULT '',
    category varchar(100) NOT NULL DEFAULT 'ทั่วไป',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT products_name_not_blank
        CHECK (length(btrim(product_name)) > 0),

    CONSTRAINT products_brand_not_blank
        CHECK (length(btrim(brand)) > 0),

    CONSTRAINT products_part_number_not_blank
        CHECK (length(btrim(part_number)) > 0),

    CONSTRAINT products_brand_part_number_unique
        UNIQUE (brand, part_number)
);


CREATE TABLE public.inventory_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id bigint NOT NULL,
    serial_number varchar(150) NOT NULL,
    current_status varchar(30) NOT NULL DEFAULT 'IN_STOCK',
    current_location varchar(200),
    warranty_start date,
    warranty_end date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT inventory_serial_not_blank
        CHECK (length(btrim(serial_number)) > 0),

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
        ),

    CONSTRAINT inventory_serial_unique
        UNIQUE (serial_number),

    CONSTRAINT inventory_items_product_fk
        FOREIGN KEY (product_id)
        REFERENCES public.products(id)
        ON DELETE RESTRICT
);


CREATE TABLE public.stock_movements (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    inventory_item_id bigint NOT NULL,
    movement_type varchar(30) NOT NULL,
    movement_date timestamptz NOT NULL DEFAULT now(),
    performed_by varchar(150),
    distributor varchar(200),
    from_location varchar(200),
    to_location varchar(200),
    note text NOT NULL DEFAULT '',
    related_inventory_item_id bigint,
    created_at timestamptz NOT NULL DEFAULT now(),

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
        ),

    CONSTRAINT stock_movements_item_fk
        FOREIGN KEY (inventory_item_id)
        REFERENCES public.inventory_items(id)
        ON DELETE RESTRICT,

    CONSTRAINT stock_movements_related_item_fk
        FOREIGN KEY (related_inventory_item_id)
        REFERENCES public.inventory_items(id)
        ON DELETE RESTRICT
);


CREATE INDEX inventory_items_product_id_idx
    ON public.inventory_items (product_id);

CREATE INDEX inventory_items_status_idx
    ON public.inventory_items (current_status);

CREATE INDEX stock_movements_date_idx
    ON public.stock_movements (movement_date DESC);

CREATE INDEX stock_movements_inventory_item_id_idx
    ON public.stock_movements (inventory_item_id);

CREATE INDEX stock_movements_related_inventory_item_id_idx
    ON public.stock_movements (related_inventory_item_id);

COMMIT;
