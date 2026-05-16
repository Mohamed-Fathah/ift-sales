-- Run these in Supabase SQL Editor to allow purchases module to work
-- (admin client bypasses RLS, but these are needed for row-level safety if direct client is ever used)

CREATE POLICY "purchase_invoices_all" ON purchase_invoices
  FOR ALL USING (true);

CREATE POLICY "purchase_invoice_items_all" ON purchase_invoice_items
  FOR ALL USING (true);

CREATE POLICY "parties_read" ON parties
  FOR SELECT USING (true);

CREATE POLICY "parties_write" ON parties
  FOR ALL USING (true);
