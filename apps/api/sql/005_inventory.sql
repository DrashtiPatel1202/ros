-- Append-only stock ledger. on_hand is the cached balance, updated in the same transaction.

CREATE TABLE IF NOT EXISTS inv_units (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  name text NOT NULL,
  UNIQUE (outlet_id, name)
);

CREATE TABLE IF NOT EXISTS inv_categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  name text NOT NULL,
  parent_id bigint REFERENCES inv_categories (id),
  UNIQUE (outlet_id, name)
);

CREATE TABLE IF NOT EXISTS inv_materials (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  category_id bigint REFERENCES inv_categories (id),
  name text NOT NULL,
  unit_id bigint NOT NULL REFERENCES inv_units (id),
  min_qty numeric(14, 3) NOT NULL DEFAULT 0,
  at_par_qty numeric(14, 3) NOT NULL DEFAULT 0,
  on_hand numeric(14, 3) NOT NULL DEFAULT 0,
  avg_cost_paise integer NOT NULL DEFAULT 0,
  hsn text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  is_favorite boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS inv_materials_outlet ON inv_materials (outlet_id, is_active);

CREATE TABLE IF NOT EXISTS inv_suppliers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  name text NOT NULL,
  company text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS inv_recipes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  menu_item_id bigint NOT NULL REFERENCES menu_items (id),
  UNIQUE (outlet_id, menu_item_id)
);

CREATE TABLE IF NOT EXISTS inv_recipe_lines (
  recipe_id bigint NOT NULL REFERENCES inv_recipes (id) ON DELETE CASCADE,
  material_id bigint NOT NULL REFERENCES inv_materials (id),
  qty numeric(14, 3) NOT NULL CHECK (qty > 0),
  PRIMARY KEY (recipe_id, material_id)
);

CREATE TABLE IF NOT EXISTS inv_documents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  doc_type text NOT NULL CHECK (doc_type IN ('purchase', 'purchase_order', 'wastage', 'closing')),
  doc_no integer NOT NULL,
  supplier_id bigint REFERENCES inv_suppliers (id),
  status text NOT NULL CHECK (status IN ('saved', 'processed', 'cancelled')),
  note text NOT NULL DEFAULT '',
  total_paise integer NOT NULL DEFAULT 0,
  business_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outlet_id, doc_type, doc_no)
);

CREATE INDEX IF NOT EXISTS inv_documents_outlet ON inv_documents (outlet_id, doc_type, created_at DESC);

CREATE TABLE IF NOT EXISTS inv_document_lines (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id bigint NOT NULL REFERENCES inv_documents (id) ON DELETE CASCADE,
  material_id bigint NOT NULL REFERENCES inv_materials (id),
  qty numeric(14, 3) NOT NULL,
  unit_cost_paise integer NOT NULL DEFAULT 0,
  amount_paise integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inv_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  material_id bigint NOT NULL REFERENCES inv_materials (id),
  qty_delta numeric(14, 3) NOT NULL,
  unit_cost_paise integer NOT NULL DEFAULT 0,
  source_type text NOT NULL,
  source_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS inv_ledger_source
  ON inv_ledger (outlet_id, material_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS inv_ledger_material ON inv_ledger (outlet_id, material_id, created_at);

CREATE TABLE IF NOT EXISTS inv_settings (
  outlet_id bigint PRIMARY KEY REFERENCES outlets (id),
  auto_consumption boolean NOT NULL DEFAULT true,
  revert_on_cancel boolean NOT NULL DEFAULT true,
  avg_costing boolean NOT NULL DEFAULT true
);
