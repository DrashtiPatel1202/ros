CREATE TABLE IF NOT EXISTS menu_variants (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  name text NOT NULL,
  price_paise integer NOT NULL DEFAULT 0 CHECK (price_paise >= 0),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (outlet_id, name)
);

CREATE TABLE IF NOT EXISTS item_variants (
  item_id bigint NOT NULL REFERENCES menu_items (id) ON DELETE CASCADE,
  variant_id bigint NOT NULL REFERENCES menu_variants (id) ON DELETE CASCADE,
  price_paise integer CHECK (price_paise IS NULL OR price_paise >= 0),
  PRIMARY KEY (item_id, variant_id)
);

CREATE TABLE IF NOT EXISTS addon_groups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  name text NOT NULL,
  min_select integer NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select integer NOT NULL DEFAULT 1 CHECK (max_select >= 1),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (outlet_id, name)
);

CREATE TABLE IF NOT EXISTS addon_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id bigint NOT NULL REFERENCES addon_groups (id) ON DELETE CASCADE,
  name text NOT NULL,
  price_paise integer NOT NULL DEFAULT 0 CHECK (price_paise >= 0),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS item_addon_groups (
  item_id bigint NOT NULL REFERENCES menu_items (id) ON DELETE CASCADE,
  group_id bigint NOT NULL REFERENCES addon_groups (id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, group_id)
);

CREATE TABLE IF NOT EXISTS online_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  client text NOT NULL,
  client_order_id text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'waiting', 'accepted', 'preparing_kot', 'preparing_bill', 'food_ready', 'dispatched', 'delivered', 'cancelled'
  )),
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  rider_name text NOT NULL DEFAULT '',
  otp text NOT NULL DEFAULT '',
  total_paise integer NOT NULL CHECK (total_paise >= 0),
  items jsonb NOT NULL DEFAULT '[]',
  note text NOT NULL DEFAULT '',
  order_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outlet_id, client, client_order_id)
);

CREATE TABLE IF NOT EXISTS day_ends (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  business_date date NOT NULL,
  biller_name text NOT NULL,
  order_count integer NOT NULL,
  total_paise bigint NOT NULL,
  cash_paise bigint NOT NULL,
  card_paise bigint NOT NULL,
  upi_paise bigint NOT NULL,
  other_paise bigint NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outlet_id, business_date)
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_provider text;
