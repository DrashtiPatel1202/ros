-- Management: staff, devices, accounting, wallet, and an append-only audit log.
-- Money is paise. Outlet-scoped. Log pages are filtered views of audit_events.

CREATE TABLE IF NOT EXISTS staff_users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  name text NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('billing', 'delivery', 'waiter', 'captain', 'online')),
  user_name text NOT NULL,
  user_code text NOT NULL,
  password_hash text NOT NULL,
  phone text NOT NULL DEFAULT '',
  passcode text NOT NULL,
  swipe_code text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outlet_id, user_name),
  UNIQUE (outlet_id, user_code)
);

CREATE TABLE IF NOT EXISTS devices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('billing', 'feedback', 'scan_qr', 'android_pos', 'kds', 'captain')),
  mapping_code text NOT NULL UNIQUE,
  last_seen_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devices_outlet ON devices (outlet_id, is_active);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  actor_name text NOT NULL,
  source text NOT NULL DEFAULT 'web',
  category text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_outlet_cat_time
  ON audit_events (outlet_id, category, created_at DESC);

CREATE TABLE IF NOT EXISTS gst_profiles (
  outlet_id bigint PRIMARY KEY REFERENCES outlets (id),
  has_gst boolean NOT NULL DEFAULT true,
  gstin text NOT NULL DEFAULT '',
  legal_name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  pan text NOT NULL DEFAULT '',
  cin text NOT NULL DEFAULT '',
  zip text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  account_name text NOT NULL,
  bank_name text NOT NULL,
  account_no text NOT NULL,
  ifsc text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_accounts_outlet ON bank_accounts (outlet_id);

CREATE TABLE IF NOT EXISTS cash_heads (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  kind text NOT NULL CHECK (kind IN ('expense', 'withdrawal', 'topup')),
  title text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (outlet_id, kind, title)
);

CREATE TABLE IF NOT EXISTS cash_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  head_id bigint NOT NULL REFERENCES cash_heads (id),
  kind text NOT NULL CHECK (kind IN ('expense', 'withdrawal', 'topup')),
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  note text NOT NULL DEFAULT '',
  business_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz
);

CREATE INDEX IF NOT EXISTS cash_entries_outlet_kind
  ON cash_entries (outlet_id, kind, business_date DESC);

CREATE TABLE IF NOT EXISTS denominations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  label text NOT NULL,
  value_paise integer NOT NULL CHECK (value_paise > 0),
  is_available boolean NOT NULL DEFAULT true,
  UNIQUE (outlet_id, value_paise)
);

CREATE TABLE IF NOT EXISTS wallet_cards (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  phone text NOT NULL,
  card_no text NOT NULL,
  holder_name text NOT NULL DEFAULT '',
  balance_paise bigint NOT NULL DEFAULT 0 CHECK (balance_paise >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'block')),
  exclude_reset boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outlet_id, card_no),
  UNIQUE (outlet_id, phone)
);

CREATE TABLE IF NOT EXISTS wallet_txns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  card_id bigint NOT NULL REFERENCES wallet_cards (id),
  kind text NOT NULL CHECK (kind IN ('issue', 'topup', 'redeem', 'refund', 'return', 'reset')),
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_txns_card ON wallet_txns (card_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_settlements (
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  order_id bigint NOT NULL REFERENCES orders (id),
  status text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (outlet_id, order_id)
);

CREATE TABLE IF NOT EXISTS recon_disputes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  order_ref text NOT NULL,
  channel text NOT NULL,
  from_email text NOT NULL,
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  tab text NOT NULL CHECK (tab IN ('pg', 'swipe', 'mdr', 'hardware', 'deposit', 'monthly', 'ledger')),
  title text NOT NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),
  payment_type text NOT NULL DEFAULT 'online' CHECK (payment_type IN ('online', 'manual')),
  proforma_no text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'cancelled')),
  cancel_reason text NOT NULL DEFAULT '',
  issued_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_invoices_outlet ON service_invoices (outlet_id, tab, issued_on DESC);

CREATE TABLE IF NOT EXISTS loans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  title text NOT NULL,
  principal_paise bigint NOT NULL CHECK (principal_paise > 0),
  outstanding_paise bigint NOT NULL CHECK (outstanding_paise >= 0),
  started_on date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed'))
);

CREATE TABLE IF NOT EXISTS loan_invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  loan_id bigint NOT NULL REFERENCES loans (id),
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  note text NOT NULL DEFAULT '',
  issued_on date NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS support_notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  support_no text NOT NULL,
  category text NOT NULL,
  note text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_outlet ON notifications (outlet_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_services (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  blurb text NOT NULL,
  category text NOT NULL
);

CREATE TABLE IF NOT EXISTS outlet_services (
  outlet_id bigint NOT NULL REFERENCES outlets (id),
  service_id bigint NOT NULL REFERENCES marketplace_services (id),
  enabled boolean NOT NULL DEFAULT false,
  store_id text NOT NULL DEFAULT '',
  PRIMARY KEY (outlet_id, service_id)
);

INSERT INTO marketplace_services (code, name, blurb, category) VALUES
  ('zomato', 'Zomato', 'Receive Zomato orders on the POS', 'Online orders'),
  ('swiggy', 'Swiggy', 'Receive Swiggy orders on the POS', 'Online orders'),
  ('paytm_qr', 'Paytm QR', 'UPI QR on the bill and payout tracking', 'Payments'),
  ('captain', 'Captain Ordering', 'Table-side ordering app', 'Operations'),
  ('kds', 'Kitchen Display', 'Send KOTs to a kitchen screen', 'Operations'),
  ('website', 'Website', 'Outlet website and online menu', 'Online orders'),
  ('loyalty', 'Loyalty', 'Points on settled bills', 'CRM'),
  ('recon', 'Online Order Reconciliation', 'Match aggregator payouts to bills', 'Accounting')
ON CONFLICT (code) DO NOTHING;
