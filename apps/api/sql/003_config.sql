CREATE TABLE IF NOT EXISTS outlet_settings (
  outlet_id bigint PRIMARY KEY REFERENCES outlets (id),
  document jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sub_order_types (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (outlet_id, name)
);

CREATE TABLE IF NOT EXISTS delivery_distances (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  from_km numeric(6,1) NOT NULL,
  to_km numeric(6,1) NOT NULL,
  charge_paise integer NOT NULL CHECK (charge_paise >= 0)
);

CREATE TABLE IF NOT EXISTS area_delivery_charges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  area_name text NOT NULL,
  charge_paise integer NOT NULL CHECK (charge_paise >= 0),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (outlet_id, area_name)
);
