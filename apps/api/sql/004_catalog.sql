-- Outlet-scoped catalog extensions. Money stays in paise, rates in basis points.
-- Item-level tax rows are optional: no row means the outlet default tax.

CREATE TABLE IF NOT EXISTS menu_taxes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('gst', 'vat', 'custom')),
  mode text NOT NULL CHECK (mode IN ('forward', 'backward')),
  rate_bps integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  order_types text[] NOT NULL DEFAULT ARRAY['dine_in', 'pickup', 'delivery'],
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS menu_taxes_outlet ON menu_taxes (outlet_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS menu_taxes_one_default
  ON menu_taxes (outlet_id) WHERE is_default AND is_active;

CREATE TABLE IF NOT EXISTS item_taxes (
  item_id bigint NOT NULL REFERENCES menu_items (id) ON DELETE CASCADE,
  tax_id bigint NOT NULL REFERENCES menu_taxes (id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tax_id)
);

CREATE TABLE IF NOT EXISTS menu_discounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('percentage', 'fixed', 'bogo', 'bxgy', 'freebie', 'flat_rate', 'dish', 'fixed_price')),
  rate_bps integer CHECK (rate_bps IS NULL OR rate_bps BETWEEN 0 AND 10000),
  amount_paise integer CHECK (amount_paise IS NULL OR amount_paise >= 0),
  max_paise integer CHECK (max_paise IS NULL OR max_paise >= 0),
  applies_to text NOT NULL DEFAULT 'core' CHECK (applies_to IN ('core', 'total')),
  order_types text[] NOT NULL DEFAULT ARRAY['dine_in', 'pickup', 'delivery'],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS menu_discounts_outlet ON menu_discounts (outlet_id, is_active);

INSERT INTO menu_taxes (outlet_id, title, kind, mode, rate_bps, is_default)
SELECT o.id, 'GST ' || (o.tax_rate_bps / 100) || '%', 'gst', 'forward', o.tax_rate_bps, true
FROM outlets o
WHERE NOT EXISTS (SELECT 1 FROM menu_taxes t WHERE t.outlet_id = o.id);
