-- IFT ERP — Migration 005
-- Bootstrap the first user as superadmin to break the chicken-and-egg deadlock.
--
-- Scenario: fresh system has auth.users rows but no profiles rows (or profiles
-- with default role='billing'). Settings and User Management both require
-- superadmin/admin role, so nobody can set up the system.
--
-- This migration finds the earliest-created auth user and either:
--   • INSERT a new profile row with role='superadmin', or
--   • UPDATE an existing profile row to role='superadmin'
--
-- After running this, the user must log out and log back in so the app
-- loads the updated role from the database.
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run

INSERT INTO public.profiles (id, full_name, email, role, status)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'full_name', email, 'Admin') AS full_name,
  COALESCE(email, '') AS email,
  'superadmin'::user_role,
  'active'::user_status
FROM auth.users
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (id) DO UPDATE
  SET role   = 'superadmin'::user_role,
      status = 'active'::user_status;
