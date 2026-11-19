-- Counter MVP schema.
-- Access pattern for a busy outlet is "today, this outlet, newest first".
-- When orders grow past tens of millions, partition `orders` and `order_items`
-- by business_date (monthly). outlet_id is already on both tables so those
-- partitions can be pruned. Do not switch the primary key to a random UUID:
-- sequential bigint keeps the hot index small.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS outlets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  currency char(3) NOT NULL DEFAULT 'INR',
  tax_rate_bps integer NOT NULL DEFAULT 500 CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  menu_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS managers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  display_name text NOT NULL,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS managers_outlet ON managers (outlet_id);

CREATE TABLE IF NOT EXISTS menu_categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  name text NOT NULL,
  sort_rank integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS menu_categories_live
  ON menu_categories (outlet_id, sort_rank)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS menu_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  category_id bigint NOT NULL REFERENCES menu_categories (id),
  name text NOT NULL,
  short_code text,
  price_paise integer NOT NULL CHECK (price_paise BETWEEN 0 AND 10000000),
  dietary text NOT NULL CHECK (dietary IN ('veg', 'non_veg', 'egg')),
  is_available boolean NOT NULL DEFAULT true,
  sort_rank integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS menu_items_live
  ON menu_items (outlet_id, category_id, sort_rank)
  WHERE is_available;

CREATE INDEX IF NOT EXISTS menu_items_name_trgm
  ON menu_items USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS order_counters (
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  business_date date NOT NULL,
  last_no integer NOT NULL,
  PRIMARY KEY (outlet_id, business_date)
);

CREATE TABLE IF NOT EXISTS orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  order_no integer NOT NULL CHECK (order_no > 0),
  business_date date NOT NULL,
  order_type text NOT NULL CHECK (order_type IN ('dine_in', 'pickup', 'delivery')),
  status text NOT NULL CHECK (status IN ('open', 'cancelled')),
  table_label text,
  customer_name text,
  note text,
  item_count integer NOT NULL CHECK (item_count >= 0),
  subtotal_paise integer NOT NULL CHECK (subtotal_paise >= 0),
  tax_paise integer NOT NULL CHECK (tax_paise >= 0),
  total_paise integer NOT NULL CHECK (total_paise >= 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outlet_id, business_date, order_no)
);

CREATE INDEX IF NOT EXISTS orders_outlet_day
  ON orders (outlet_id, business_date, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES orders (id),
  outlet_id bigint NOT NULL,
  menu_item_id bigint NOT NULL,
  item_name text NOT NULL,
  unit_price_paise integer NOT NULL CHECK (unit_price_paise >= 0),
  qty integer NOT NULL CHECK (qty BETWEEN 1 AND 99),
  line_total_paise integer NOT NULL CHECK (line_total_paise >= 0),
  note text,
  sort_rank integer NOT NULL
);

CREATE INDEX IF NOT EXISTS order_items_order
  ON order_items (order_id, sort_rank);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key text PRIMARY KEY,
  outlet_id bigint NOT NULL,
  request_hash text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idempotency_keys_created
  ON idempotency_keys (created_at);
