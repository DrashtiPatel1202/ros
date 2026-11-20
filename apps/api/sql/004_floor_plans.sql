-- Multiple floor layouts per outlet (Petpooja floor listing + designer).

CREATE TABLE IF NOT EXISTS floor_plans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outlet_id, name)
);

ALTER TABLE pos_tables ADD COLUMN IF NOT EXISTS floor_plan_id bigint REFERENCES floor_plans (id);
ALTER TABLE floor_barriers ADD COLUMN IF NOT EXISTS floor_plan_id bigint REFERENCES floor_plans (id);

ALTER TABLE pos_tables DROP CONSTRAINT IF EXISTS pos_tables_outlet_id_table_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS pos_tables_floor_plan_table_no ON pos_tables (floor_plan_id, table_no);