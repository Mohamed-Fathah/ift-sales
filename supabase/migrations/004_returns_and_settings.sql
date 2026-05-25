-- IFT ERP — Migration 004
-- 1. Fix purchase_returns: rename FK column + add notes + make supplier_id nullable
-- 2. Fix sales_returns: rename FK column + add notes
-- 3. Add settings columns to organizations table
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run

-- ── purchase_returns ─────────────────────────────────────────────────────────

ALTER TABLE purchase_returns
  RENAME COLUMN purchase_inv_id TO purchase_invoice_id;

ALTER TABLE purchase_returns
  ADD COLUMN notes TEXT;

-- supplier_id was NOT NULL but the insert path doesn't always supply it
ALTER TABLE purchase_returns
  ALTER COLUMN supplier_id DROP NOT NULL;

-- ── sales_returns ─────────────────────────────────────────────────────────────

ALTER TABLE sales_returns
  RENAME COLUMN sales_inv_id TO sales_invoice_id;

ALTER TABLE sales_returns
  ADD COLUMN notes TEXT;

-- ── organizations — settings-specific columns ─────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS invoice_prefix      TEXT    DEFAULT 'IFT-BILL-',
  ADD COLUMN IF NOT EXISTS purchase_prefix     TEXT    DEFAULT 'IFT-PUR-',
  ADD COLUMN IF NOT EXISTS receipt_footer      TEXT    DEFAULT 'Thank you for your purchase!',
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10;
