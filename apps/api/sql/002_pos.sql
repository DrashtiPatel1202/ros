-- POS parity: Petpooja order statuses, payments, KOTs, dine-in tables.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('saved', 'printed', 'settled', 'cancelled', 'complimentary', 'sales_return', 'open'));

UPDATE orders SET status = 'saved' WHERE status = 'open';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('saved', 'printed', 'settled', 'cancelled', 'complimentary', 'sales_return'));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pax integer NOT NULL DEFAULT 1 CHECK (pax BETWEEN 1 AND 99);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'not_paid'
  CHECK (payment_type IN ('not_paid', 'cash', 'card', 'upi', 'due', 'other', 'wallet', 'online', 'part'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_paise integer NOT NULL DEFAULT 0 CHECK (paid_paise >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS change_paise integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_paise integer NOT NULL DEFAULT 0 CHECK (discount_paise >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS biller_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS printed_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS settled_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kot_no integer;

CREATE INDEX IF NOT EXISTS orders_outlet_live
  ON orders (outlet_id, status, updated_at DESC)
  WHERE status IN ('saved', 'printed');

CREATE TABLE IF NOT EXISTS pos_tables (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  area_name text NOT NULL DEFAULT 'Main',
  table_no text NOT NULL,
  seats integer NOT NULL DEFAULT 4,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (outlet_id, table_no)
);

CREATE TABLE IF NOT EXISTS kots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  order_id bigint NOT NULL REFERENCES orders (id),
  kot_no integer NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'used_in_bill', 'cancelled', 'shifted')),
  punched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outlet_id, order_id, kot_no)
);

CREATE TABLE IF NOT EXISTS kot_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kot_id bigint NOT NULL REFERENCES kots (id),
  order_item_id bigint REFERENCES order_items (id),
  item_name text NOT NULL,
  qty integer NOT NULL,
  note text
);

CREATE TABLE IF NOT EXISTS kot_counters (
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  business_date date NOT NULL,
  last_no integer NOT NULL,
  PRIMARY KEY (outlet_id, business_date)
);

ALTER TABLE kots ADD COLUMN IF NOT EXISTS is_modified boolean NOT NULL DEFAULT false;

ALTER TABLE pos_tables ADD COLUMN IF NOT EXISTS pos_x integer NOT NULL DEFAULT 48;
ALTER TABLE pos_tables ADD COLUMN IF NOT EXISTS pos_y integer NOT NULL DEFAULT 48;
ALTER TABLE pos_tables ADD COLUMN IF NOT EXISTS width integer NOT NULL DEFAULT 80;
ALTER TABLE pos_tables ADD COLUMN IF NOT EXISTS height integer NOT NULL DEFAULT 80;
ALTER TABLE pos_tables ADD COLUMN IF NOT EXISTS shape text NOT NULL DEFAULT 'square';
ALTER TABLE pos_tables ADD COLUMN IF NOT EXISTS text_size integer NOT NULL DEFAULT 14;
ALTER TABLE pos_tables ADD COLUMN IF NOT EXISTS placed boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS floor_barriers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  pos_x integer NOT NULL,
  pos_y integer NOT NULL,
  width integer NOT NULL DEFAULT 16,
  height integer NOT NULL DEFAULT 140
);
