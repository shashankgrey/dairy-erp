-- ================== USERS ==================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================== CUSTOMERS ==================
CREATE SEQUENCE IF NOT EXISTS customer_code_seq START 1;

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  customer_code TEXT UNIQUE,             -- auto-generated, e.g. CUST-0001
  full_name TEXT NOT NULL,
  mobile_number TEXT UNIQUE NOT NULL,
  address TEXT,
  email TEXT,
  outstanding_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,   -- archive flag: customers with history are
                                          -- archived, not deleted
  created_at TIMESTAMP DEFAULT NOW()
);

-- auto-generate customer_code on insert
CREATE OR REPLACE FUNCTION generate_customer_code() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_code IS NULL THEN
    NEW.customer_code := 'CUST-' || LPAD(nextval('customer_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_code ON customers;
CREATE TRIGGER trg_customer_code
  BEFORE INSERT ON customers
  FOR EACH ROW EXECUTE FUNCTION generate_customer_code();

-- ================== PRODUCTS (now with full inventory tracking) ==================
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL,
  default_price NUMERIC(10,2) NOT NULL,
  available_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(10,2) NOT NULL DEFAULT 10,
  supplier TEXT,
  expiry_date DATE,             -- most recent batch's expiry, kept current by restock
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'discontinued')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration: add these columns if this table already existed without them (older installs)
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_stock NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(10,2) NOT NULL DEFAULT 10;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- ================== STOCK MOVEMENTS (the inventory ledger) ==================
-- quantity is SIGNED: positive = stock added (restock), negative = stock removed
-- (disposal). 'adjustment' also uses a signed quantity for correcting count errors
-- in either direction. Sales deduct stock too, but through the purchases table +
-- a separate trigger below -- this table is for stock coming IN or removed by hand.
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('restock', 'disposal', 'adjustment')),
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity <> 0),
  expiry_date DATE,          -- only meaningful for restock entries
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);

-- Keep products.available_stock in sync with every stock movement. Fresh stock arriving
-- adds to whatever is already there (cumulative), exactly as requested; a restock also
-- refreshes the product's expiry-date snapshot to the new batch's date.
CREATE OR REPLACE FUNCTION apply_stock_movement() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE products SET available_stock = available_stock + NEW.quantity WHERE id = NEW.product_id;
    IF NEW.movement_type = 'restock' AND NEW.expiry_date IS NOT NULL THEN
      UPDATE products SET expiry_date = NEW.expiry_date WHERE id = NEW.product_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE products SET available_stock = available_stock - OLD.quantity WHERE id = OLD.product_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_movement ON stock_movements;
CREATE TRIGGER trg_stock_movement
  AFTER INSERT OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

-- ================== PURCHASES (daily register / purchase history) ==================
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),      -- NULL for a one-time/"temporary" customer
  product_id INTEGER REFERENCES products(id),         -- NULL for a one-off/"temporary" item
  walk_in_customer_name TEXT,                          -- only used when customer_id IS NULL
  custom_product_name TEXT,                            -- only used when product_id IS NULL
  custom_unit TEXT,                                    -- only used when product_id IS NULL
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  purchase_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT customer_or_walkin CHECK (customer_id IS NOT NULL OR walk_in_customer_name IS NOT NULL),
  CONSTRAINT product_or_custom CHECK (product_id IS NOT NULL OR custom_product_name IS NOT NULL)
);

-- Migration: relax old NOT NULL constraints and add new columns for existing installs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='customer_id' AND is_nullable='NO') THEN
    ALTER TABLE purchases ALTER COLUMN customer_id DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='product_id' AND is_nullable='NO') THEN
    ALTER TABLE purchases ALTER COLUMN product_id DROP NOT NULL;
  END IF;
END $$;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS walk_in_customer_name TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS custom_product_name TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS custom_unit TEXT;
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS customer_or_walkin;
ALTER TABLE purchases ADD CONSTRAINT customer_or_walkin CHECK (customer_id IS NOT NULL OR walk_in_customer_name IS NOT NULL);
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS product_or_custom;
ALTER TABLE purchases ADD CONSTRAINT product_or_custom CHECK (product_id IS NOT NULL OR custom_product_name IS NOT NULL);

-- ================== PAYMENTS (reduces outstanding balance) ==================
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================== TRIGGERS: keep outstanding_balance always in sync ==================
CREATE OR REPLACE FUNCTION apply_purchase_to_balance() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_id IS NOT NULL THEN
      UPDATE customers SET outstanding_balance = outstanding_balance + NEW.total_amount WHERE id = NEW.customer_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL THEN
      UPDATE customers SET outstanding_balance = outstanding_balance - OLD.total_amount WHERE id = OLD.customer_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purchase_balance ON purchases;
CREATE TRIGGER trg_purchase_balance
  AFTER INSERT OR DELETE ON purchases
  FOR EACH ROW EXECUTE FUNCTION apply_purchase_to_balance();

-- A customer purchase also automatically deducts from that product's stock
-- (and deleting a purchase entry correctly gives the stock back).
CREATE OR REPLACE FUNCTION apply_purchase_to_stock() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.product_id IS NOT NULL THEN
      UPDATE products SET available_stock = available_stock - NEW.quantity WHERE id = NEW.product_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.product_id IS NOT NULL THEN
      UPDATE products SET available_stock = available_stock + OLD.quantity WHERE id = OLD.product_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purchase_stock ON purchases;
CREATE TRIGGER trg_purchase_stock
  AFTER INSERT OR DELETE ON purchases
  FOR EACH ROW EXECUTE FUNCTION apply_purchase_to_stock();

CREATE OR REPLACE FUNCTION apply_payment_to_balance() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE customers SET outstanding_balance = outstanding_balance - NEW.amount WHERE id = NEW.customer_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE customers SET outstanding_balance = outstanding_balance + OLD.amount WHERE id = OLD.customer_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_balance ON payments;
CREATE TRIGGER trg_payment_balance
  AFTER INSERT OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION apply_payment_to_balance();

-- ================== USEFUL INDEXES ==================
CREATE INDEX IF NOT EXISTS idx_purchases_customer ON purchases(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(active);

-- ================== SETTINGS (simple key-value store for app-wide config) ==================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- SUPPLIERS
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS supplier_code_seq START 1;

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  supplier_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  mobile_number TEXT UNIQUE,
  address TEXT,
  email TEXT,
  outstanding_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Auto-generate supplier code
CREATE OR REPLACE FUNCTION generate_supplier_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.supplier_code IS NULL THEN
    NEW.supplier_code :=
      'SUP-' || LPAD(nextval('supplier_code_seq')::text, 4, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplier_code ON suppliers;

CREATE TRIGGER trg_supplier_code
BEFORE INSERT ON suppliers
FOR EACH ROW
EXECUTE FUNCTION generate_supplier_code();


-- ============================================================
-- SUPPLIER PURCHASES / STOCK PURCHASES
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_purchases (
  id SERIAL PRIMARY KEY,

  supplier_id INTEGER NOT NULL
    REFERENCES suppliers(id),

  product_id INTEGER NOT NULL
    REFERENCES products(id),

  quantity NUMERIC(10,2) NOT NULL
    CHECK (quantity > 0),

  unit_cost NUMERIC(10,2) NOT NULL
    CHECK (unit_cost >= 0),

  total_amount NUMERIC(10,2)
    GENERATED ALWAYS AS (quantity * unit_cost) STORED,

  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,

  expiry_date DATE,

  invoice_number TEXT,

  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_purchases_supplier
ON supplier_purchases(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_purchases_date
ON supplier_purchases(purchase_date);

CREATE INDEX IF NOT EXISTS idx_supplier_purchases_product
ON supplier_purchases(product_id);


-- ============================================================
-- SUPPLIER PAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_payments (
  id SERIAL PRIMARY KEY,

  supplier_id INTEGER NOT NULL
    REFERENCES suppliers(id),

  amount NUMERIC(10,2) NOT NULL
    CHECK (amount > 0),

  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,

  payment_method TEXT NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'upi', 'bank', 'other')),

  reference_number TEXT,

  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier
ON supplier_payments(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_date
ON supplier_payments(payment_date);


-- ============================================================
-- PAYMENT METHOD FOR CUSTOMER PAYMENTS
-- ============================================================

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash';

-- Add constraint safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_payment_method_check'
  ) THEN
    ALTER TABLE payments
    ADD CONSTRAINT payments_payment_method_check
    CHECK (payment_method IN ('cash', 'upi', 'bank', 'other'));
  END IF;
END $$;


-- ============================================================
-- SUPPLIER PAYABLE BALANCE
-- ============================================================

CREATE OR REPLACE FUNCTION apply_supplier_purchase_to_balance()
RETURNS TRIGGER AS $$
BEGIN

  IF TG_OP = 'INSERT' THEN

    UPDATE suppliers
    SET outstanding_balance =
      outstanding_balance + NEW.total_amount
    WHERE id = NEW.supplier_id;

  ELSIF TG_OP = 'DELETE' THEN

    UPDATE suppliers
    SET outstanding_balance =
      outstanding_balance - OLD.total_amount
    WHERE id = OLD.supplier_id;

  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplier_purchase_balance
ON supplier_purchases;

CREATE TRIGGER trg_supplier_purchase_balance
AFTER INSERT OR DELETE ON supplier_purchases
FOR EACH ROW
EXECUTE FUNCTION apply_supplier_purchase_to_balance();


-- ============================================================
-- SUPPLIER PAYMENT BALANCE
-- ============================================================

CREATE OR REPLACE FUNCTION apply_supplier_payment_to_balance()
RETURNS TRIGGER AS $$
BEGIN

  IF TG_OP = 'INSERT' THEN

    UPDATE suppliers
    SET outstanding_balance =
      outstanding_balance - NEW.amount
    WHERE id = NEW.supplier_id;

  ELSIF TG_OP = 'DELETE' THEN

    UPDATE suppliers
    SET outstanding_balance =
      outstanding_balance + OLD.amount
    WHERE id = OLD.supplier_id;

  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplier_payment_balance
ON supplier_payments;

CREATE TRIGGER trg_supplier_payment_balance
AFTER INSERT OR DELETE ON supplier_payments
FOR EACH ROW
EXECUTE FUNCTION apply_supplier_payment_to_balance();


-- ============================================================
-- SUPPLIER PURCHASE -> INVENTORY
-- ============================================================
-- When stock is purchased from a supplier, automatically
-- increase the product's available stock.

CREATE OR REPLACE FUNCTION apply_supplier_purchase_to_stock()
RETURNS TRIGGER AS $$
BEGIN

  IF TG_OP = 'INSERT' THEN

    UPDATE products
    SET available_stock = available_stock + NEW.quantity,
        expiry_date = COALESCE(NEW.expiry_date, expiry_date)
    WHERE id = NEW.product_id;

  ELSIF TG_OP = 'DELETE' THEN

    UPDATE products
    SET available_stock = available_stock - OLD.quantity
    WHERE id = OLD.product_id;

  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplier_purchase_stock
ON supplier_purchases;

CREATE TRIGGER trg_supplier_purchase_stock
AFTER INSERT OR DELETE ON supplier_purchases
FOR EACH ROW
EXECUTE FUNCTION apply_supplier_purchase_to_stock();


-- ============================================================
-- USEFUL SUPPLIER INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_suppliers_active
ON suppliers(active);