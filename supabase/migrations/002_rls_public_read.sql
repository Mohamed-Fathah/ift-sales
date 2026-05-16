-- IFT ERP — Migration 002
-- Allow unauthenticated / anonymous reads on catalog tables.
-- The billing search and barcode scanner need to query materials and stock
-- before a user session is fully established.
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run

-- Public read on materials (book catalog is not sensitive)
CREATE POLICY "materials_public_read" ON materials
  FOR SELECT USING (true);

-- Public read on stock (stock levels are displayed in search results)
CREATE POLICY "stock_public_read" ON stock
  FOR SELECT USING (true);

-- Public read on categories (needed for material joins)
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT USING (true);

-- Public read on locations (needed for billing page init)
CREATE POLICY "locations_public_read" ON locations
  FOR SELECT USING (true);
