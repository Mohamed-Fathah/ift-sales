-- ============================================================
-- IFT ERP — MASTER DATABASE SCHEMA
-- Supabase PostgreSQL
-- Version: 1.0.0
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 1. ORGANIZATIONS
-- ============================================================
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL DEFAULT 'Islamic Foundation Trust',
  address     TEXT,
  city        TEXT DEFAULT 'Chennai',
  state       TEXT DEFAULT 'Tamil Nadu',
  pincode     TEXT DEFAULT '600012',
  phone       TEXT,
  whatsapp    TEXT,
  email       TEXT,
  website     TEXT,
  gstin       TEXT,
  logo_url    TEXT,
  currency    TEXT DEFAULT 'INR',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default IFT org
INSERT INTO organizations (name, address, city, pincode, phone, email, website)
VALUES (
  'Islamic Foundation Trust',
  '138, IFT Lane, Perambur High Road',
  'Chennai', '600012',
  '+91-44-2662 4401',
  'iftchennai12@gmail.com',
  'www.iftchennai.in'
);


-- ============================================================
-- 2. USERS & ROLES
-- ============================================================
CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'manager', 'billing', 'viewer');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');

CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       UUID REFERENCES organizations(id),
  full_name    TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  phone        TEXT,
  role         user_role NOT NULL DEFAULT 'billing',
  status       user_status NOT NULL DEFAULT 'active',
  avatar_url   TEXT,
  created_by   UUID REFERENCES profiles(id),
  last_login   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 3. AUDIT TRAIL / VERSION CONTROL
-- ============================================================
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES profiles(id),
  user_name    TEXT,
  table_name   TEXT NOT NULL,
  record_id    UUID NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data     JSONB,
  new_data     JSONB,
  changed_fields TEXT[],
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Universal audit trigger function
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  changed TEXT[] := ARRAY[]::TEXT[];
  k TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT key FROM jsonb_each(to_jsonb(NEW)) LOOP
      IF to_jsonb(OLD)->>k IS DISTINCT FROM to_jsonb(NEW)->>k THEN
        changed := array_append(changed, k);
      END IF;
    END LOOP;
    INSERT INTO audit_log(table_name, record_id, action, old_data, new_data, changed_fields)
    VALUES(TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), changed);
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_data)
    VALUES(TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_data)
    VALUES(TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 4. LOCATIONS / WAREHOUSES
-- ============================================================
CREATE TABLE locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID REFERENCES organizations(id),
  name        TEXT NOT NULL,         -- e.g. "Main Office", "Book Fair Stall 1"
  address     TEXT,
  is_default  BOOLEAN DEFAULT FALSE,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO locations (name, is_default, is_active)
VALUES ('Main Office', TRUE, TRUE),
       ('Book Fair', FALSE, TRUE);


-- ============================================================
-- 5. CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categories (name) VALUES
  ('Islamic Education'), ('Quran & Tafseer'), ('Seerah'),
  ('Fiqh'), ('Stories'), ('Prayer & Dua'), ('Children'),
  ('Tamil Islamic'), ('Arabic Learning'), ('General');


-- ============================================================
-- 6. PARTIES (Suppliers & Customers)
-- ============================================================
CREATE TYPE party_type AS ENUM ('supplier', 'customer', 'both');

CREATE TABLE parties (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id),
  party_type      party_type NOT NULL,
  name            TEXT NOT NULL,
  contact_person  TEXT,
  phone           TEXT,
  whatsapp        TEXT,
  email           TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  pincode         TEXT,
  gstin           TEXT,
  credit_limit    NUMERIC(12,2) DEFAULT 0,
  credit_days     INTEGER DEFAULT 0,
  opening_balance NUMERIC(12,2) DEFAULT 0,  -- positive = they owe us, negative = we owe them
  is_active       BOOLEAN DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_parties_audit AFTER INSERT OR UPDATE OR DELETE ON parties
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- ============================================================
-- 7. MATERIALS (Books / Items catalog)
-- ============================================================
CREATE TABLE materials (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id),
  item_code       TEXT UNIQUE,           -- internal code e.g. IFT-001
  isbn            TEXT,
  tracking_id     TEXT,                  -- barcode / QR value
  title           TEXT NOT NULL,
  author          TEXT,
  category_id     UUID REFERENCES categories(id),
  publication     TEXT DEFAULT 'Islamic Foundation Trust',
  language        TEXT DEFAULT 'Tamil',
  mrp             NUMERIC(10,2) NOT NULL DEFAULT 0,   -- selling price
  purchase_rate   NUMERIC(10,2) DEFAULT 0,            -- what we paid
  discount_pct    NUMERIC(5,2) DEFAULT 0,             -- default discount %
  hsn_code        TEXT,
  description     TEXT,
  image_url       TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_materials_audit AFTER INSERT OR UPDATE OR DELETE ON materials
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- ============================================================
-- 8. STOCK LEDGER (per location)
-- ============================================================
CREATE TABLE stock (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id   UUID NOT NULL REFERENCES materials(id),
  location_id   UUID NOT NULL REFERENCES locations(id),
  qty_in_hand   NUMERIC(10,2) NOT NULL DEFAULT 0,
  qty_reserved  NUMERIC(10,2) DEFAULT 0,  -- committed but not billed
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(material_id, location_id)
);

-- Stock movement log
CREATE TYPE stock_movement_type AS ENUM (
  'opening', 'purchase', 'purchase_return',
  'sale', 'sale_return', 'transfer_in', 'transfer_out',
  'adjustment', 'damage', 'loss'
);

CREATE TABLE stock_movements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id   UUID NOT NULL REFERENCES materials(id),
  location_id   UUID NOT NULL REFERENCES locations(id),
  movement_type stock_movement_type NOT NULL,
  qty           NUMERIC(10,2) NOT NULL,   -- positive = in, negative = out
  rate          NUMERIC(10,2),
  ref_type      TEXT,   -- 'purchase_invoice', 'sales_invoice', 'transfer', etc.
  ref_id        UUID,
  notes         TEXT,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 9. PURCHASE INVOICES
-- ============================================================
CREATE TYPE invoice_status AS ENUM ('draft','confirmed','partial','paid','cancelled');

CREATE TABLE purchase_invoices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID REFERENCES organizations(id),
  invoice_no        TEXT UNIQUE NOT NULL,
  supplier_id       UUID NOT NULL REFERENCES parties(id),
  location_id       UUID REFERENCES locations(id),
  invoice_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_inv_no   TEXT,      -- supplier's own invoice number
  due_date          DATE,
  subtotal          NUMERIC(12,2) DEFAULT 0,
  discount_amount   NUMERIC(12,2) DEFAULT 0,
  transport_charge  NUMERIC(12,2) DEFAULT 0,
  unloading_charge  NUMERIC(12,2) DEFAULT 0,
  other_charges     NUMERIC(12,2) DEFAULT 0,
  tax_amount        NUMERIC(12,2) DEFAULT 0,
  total_amount      NUMERIC(12,2) DEFAULT 0,
  paid_amount       NUMERIC(12,2) DEFAULT 0,
  balance_due       NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  status            invoice_status DEFAULT 'draft',
  notes             TEXT,
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_invoice_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  material_id     UUID NOT NULL REFERENCES materials(id),
  qty             NUMERIC(10,2) NOT NULL,
  rate            NUMERIC(10,2) NOT NULL,    -- purchase rate
  mrp             NUMERIC(10,2),
  discount_pct    NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total_amount    NUMERIC(12,2) NOT NULL,
  received_qty    NUMERIC(10,2) DEFAULT 0
);

CREATE TRIGGER trg_purchase_invoices_audit AFTER INSERT OR UPDATE OR DELETE ON purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- ============================================================
-- 10. PURCHASE RETURNS
-- ============================================================
CREATE TABLE purchase_returns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id),
  return_no       TEXT UNIQUE NOT NULL,
  purchase_inv_id UUID REFERENCES purchase_invoices(id),
  supplier_id     UUID NOT NULL REFERENCES parties(id),
  return_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount    NUMERIC(12,2) DEFAULT 0,
  reason          TEXT,
  status          invoice_status DEFAULT 'confirmed',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_return_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id     UUID NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  material_id   UUID NOT NULL REFERENCES materials(id),
  qty           NUMERIC(10,2) NOT NULL,
  rate          NUMERIC(10,2) NOT NULL,
  total_amount  NUMERIC(12,2) NOT NULL
);


-- ============================================================
-- 11. SALES INVOICES (Billing)
-- ============================================================
CREATE TABLE sales_invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id),
  invoice_no      TEXT UNIQUE NOT NULL,
  customer_id     UUID REFERENCES parties(id),   -- NULL = walk-in
  customer_name   TEXT,
  customer_phone  TEXT,
  location_id     UUID REFERENCES locations(id),
  invoice_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subtotal_mrp    NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  total_amount    NUMERIC(12,2) DEFAULT 0,
  paid_amount     NUMERIC(12,2) DEFAULT 0,
  balance_due     NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  payment_mode    TEXT DEFAULT 'cash',   -- cash, upi, card, cheque, credit
  payment_ref     TEXT,                  -- UPI transaction ID, cheque no etc.
  status          invoice_status DEFAULT 'confirmed',
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales_invoice_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  material_id     UUID NOT NULL REFERENCES materials(id),
  title           TEXT NOT NULL,
  isbn            TEXT,
  qty             NUMERIC(10,2) NOT NULL,
  mrp             NUMERIC(10,2) NOT NULL,
  discount_pct    NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  rate            NUMERIC(10,2) NOT NULL,   -- mrp - discount
  total_amount    NUMERIC(12,2) NOT NULL
);

CREATE TRIGGER trg_sales_invoices_audit AFTER INSERT OR UPDATE OR DELETE ON sales_invoices
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- ============================================================
-- 12. SALES RETURNS
-- ============================================================
CREATE TABLE sales_returns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id),
  return_no       TEXT UNIQUE NOT NULL,
  sales_inv_id    UUID REFERENCES sales_invoices(id),
  customer_name   TEXT,
  customer_phone  TEXT,
  return_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount    NUMERIC(12,2) DEFAULT 0,
  refund_mode     TEXT DEFAULT 'cash',
  reason          TEXT,
  status          invoice_status DEFAULT 'confirmed',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales_return_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id     UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  material_id   UUID NOT NULL REFERENCES materials(id),
  qty           NUMERIC(10,2) NOT NULL,
  rate          NUMERIC(10,2) NOT NULL,
  total_amount  NUMERIC(12,2) NOT NULL
);


-- ============================================================
-- 13. STOCK TRANSFERS
-- ============================================================
CREATE TABLE stock_transfers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id),
  transfer_no     TEXT UNIQUE NOT NULL,
  from_location   UUID NOT NULL REFERENCES locations(id),
  to_location     UUID NOT NULL REFERENCES locations(id),
  transfer_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','in_transit','received','cancelled')),
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  received_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  received_at     TIMESTAMPTZ
);

CREATE TABLE stock_transfer_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id   UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  material_id   UUID NOT NULL REFERENCES materials(id),
  qty_sent      NUMERIC(10,2) NOT NULL,
  qty_received  NUMERIC(10,2) DEFAULT 0
);

CREATE TRIGGER trg_stock_transfers_audit AFTER INSERT OR UPDATE OR DELETE ON stock_transfers
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- ============================================================
-- 14. EXPENSES
-- ============================================================
CREATE TABLE expense_categories (
  id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name  TEXT NOT NULL UNIQUE
);

INSERT INTO expense_categories (name) VALUES
  ('Transport'), ('Unloading'), ('Staff Food / Tea'),
  ('Stationery'), ('Electricity'), ('Printing'),
  ('Event Setup'), ('Miscellaneous');

CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID REFERENCES organizations(id),
  category_id  UUID REFERENCES expense_categories(id),
  location_id  UUID REFERENCES locations(id),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description  TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  payment_mode TEXT DEFAULT 'cash',
  paid_to      TEXT,
  receipt_url  TEXT,
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_expenses_audit AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- ============================================================
-- 15. PAYMENTS (against invoices)
-- ============================================================
CREATE TABLE payments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID REFERENCES organizations(id),
  payment_no    TEXT UNIQUE NOT NULL,
  payment_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  party_id      UUID REFERENCES parties(id),
  payment_type  TEXT NOT NULL CHECK (payment_type IN ('received','paid')),
  amount        NUMERIC(12,2) NOT NULL,
  payment_mode  TEXT DEFAULT 'cash',
  reference_no  TEXT,
  against_type  TEXT,   -- 'sales_invoice', 'purchase_invoice'
  against_id    UUID,
  notes         TEXT,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 16. BILLING DRAFTS (local backup in DB)
-- ============================================================
CREATE TABLE billing_drafts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(id),
  location_id UUID REFERENCES locations(id),
  draft_data  JSONB NOT NULL,   -- entire cart state as JSON
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 17. SEQUENCE COUNTERS (for invoice numbering)
-- ============================================================
CREATE TABLE invoice_sequences (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id    UUID REFERENCES organizations(id),
  type      TEXT UNIQUE NOT NULL,  -- 'sales','purchase','transfer','return_sales','return_purchase','payment','expense'
  prefix    TEXT NOT NULL,
  last_no   INTEGER NOT NULL DEFAULT 0,
  pad_width INTEGER DEFAULT 5
);

INSERT INTO invoice_sequences (type, prefix, last_no) VALUES
  ('sales',            'IFT-SALE-', 0),
  ('purchase',         'IFT-PUR-',  0),
  ('transfer',         'IFT-TRF-',  0),
  ('return_sales',     'IFT-SR-',   0),
  ('return_purchase',  'IFT-PR-',   0),
  ('payment',          'IFT-PAY-',  0),
  ('expense',          'IFT-EXP-',  0);

-- Function to get next invoice number
CREATE OR REPLACE FUNCTION fn_next_invoice_no(p_type TEXT)
RETURNS TEXT AS $$
DECLARE
  v_rec invoice_sequences%ROWTYPE;
  v_no  INTEGER;
BEGIN
  SELECT * INTO v_rec FROM invoice_sequences WHERE type = p_type FOR UPDATE;
  v_no := v_rec.last_no + 1;
  UPDATE invoice_sequences SET last_no = v_no WHERE type = p_type;
  RETURN v_rec.prefix || LPAD(v_no::TEXT, v_rec.pad_width, '0');
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 18. VIEWS — for fast reporting
-- ============================================================

-- Outstanding payables (we owe suppliers)
CREATE VIEW v_payables AS
SELECT
  p.id AS party_id, p.name AS supplier_name, p.phone,
  COALESCE(SUM(pi.balance_due), 0) AS total_outstanding,
  COUNT(pi.id) AS invoice_count
FROM parties p
LEFT JOIN purchase_invoices pi ON pi.supplier_id = p.id AND pi.status != 'cancelled'
WHERE p.party_type IN ('supplier','both')
GROUP BY p.id, p.name, p.phone;

-- Outstanding receivables (customers owe us)
CREATE VIEW v_receivables AS
SELECT
  p.id AS party_id, p.name AS customer_name, p.phone,
  COALESCE(SUM(si.balance_due), 0) AS total_outstanding,
  COUNT(si.id) AS invoice_count
FROM parties p
LEFT JOIN sales_invoices si ON si.customer_id = p.id AND si.status != 'cancelled'
WHERE p.party_type IN ('customer','both')
GROUP BY p.id, p.name, p.phone;

-- Current stock with material details
CREATE VIEW v_stock_summary AS
SELECT
  m.id, m.item_code, m.isbn, m.title, m.author,
  c.name AS category,
  m.mrp, m.purchase_rate,
  l.name AS location,
  s.qty_in_hand,
  s.qty_reserved,
  (s.qty_in_hand - s.qty_reserved) AS qty_available,
  (s.qty_in_hand * m.purchase_rate) AS stock_value
FROM stock s
JOIN materials m ON m.id = s.material_id
JOIN locations l ON l.id = s.location_id
LEFT JOIN categories c ON c.id = m.category_id
WHERE m.is_active = TRUE;

-- Daily sales summary
CREATE VIEW v_daily_sales AS
SELECT
  DATE(invoice_date) AS sale_date,
  COUNT(*) AS bill_count,
  SUM(subtotal_mrp) AS gross_mrp,
  SUM(discount_amount) AS total_discount,
  SUM(total_amount) AS net_revenue,
  SUM(CASE WHEN payment_mode='cash' THEN total_amount ELSE 0 END) AS cash_amount,
  SUM(CASE WHEN payment_mode='upi'  THEN total_amount ELSE 0 END) AS upi_amount,
  SUM(CASE WHEN payment_mode='card' THEN total_amount ELSE 0 END) AS card_amount
FROM sales_invoices
WHERE status != 'cancelled'
GROUP BY DATE(invoice_date)
ORDER BY sale_date DESC;


-- ============================================================
-- 19. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials         ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock             ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log         ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_self_read" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can read all profiles in their org
CREATE POLICY "profiles_admin_read" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

-- Authenticated users can read materials
CREATE POLICY "materials_read" ON materials
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin/manager can write materials
CREATE POLICY "materials_write" ON materials
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin','manager'))
  );

-- Billing users can read stock
CREATE POLICY "stock_read" ON stock
  FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can read/write sales invoices
CREATE POLICY "sales_invoices_read" ON sales_invoices
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "sales_invoices_write" ON sales_invoices
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Only admins can see audit log
CREATE POLICY "audit_log_admin_only" ON audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );


-- ============================================================
-- 20. UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at    BEFORE UPDATE ON profiles           FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_materials_updated_at   BEFORE UPDATE ON materials          FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_parties_updated_at     BEFORE UPDATE ON parties            FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_sales_upd_at          BEFORE UPDATE ON sales_invoices      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_purchase_upd_at       BEFORE UPDATE ON purchase_invoices   FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
