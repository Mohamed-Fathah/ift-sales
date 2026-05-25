-- IFT ERP — Migration 003
-- Allow authenticated users to read the organizations table.
-- Without this policy, the Settings page query hangs (RLS blocks all reads)
-- causing infinite loading.
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run

-- Public read on organizations (org name/address/prefixes are not sensitive)
CREATE POLICY "orgs_public_read" ON organizations
  FOR SELECT USING (true);
