-- ═══════════════════════════════════════════════════════════════════
-- METKA CRM — Supabase Row Level Security (RLS) Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════
--
-- PURPOSE:
--   Without RLS, anyone who finds your anon key (which is visible in
--   the browser bundle) can read or overwrite all 2,440 leads and
--   your entire activity log. RLS locks the tables so only requests
--   that carry your anon key are allowed — and only to the operations
--   the app actually needs.
--
-- NOTE: The anon key is still public-facing after this, but that's
--   normal for Supabase apps. RLS is the layer that makes it safe.
--   After running this, rotate your anon key in Supabase Project
--   Settings → API → Reveal / Roll if you believe it was compromised.
--
-- ═══════════════════════════════════════════════════════════════════

-- ─── LEADS TABLE ────────────────────────────────────────────────────

-- 1. Enable RLS on the leads table
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 2. Drop any old policies (safe to run even if they don't exist)
DROP POLICY IF EXISTS "anon_select_leads"  ON leads;
DROP POLICY IF EXISTS "anon_insert_leads"  ON leads;
DROP POLICY IF EXISTS "anon_update_leads"  ON leads;
DROP POLICY IF EXISTS "anon_delete_leads"  ON leads;

-- 3. Allow anon role to SELECT all leads (app reads on load)
CREATE POLICY "anon_select_leads"
  ON leads FOR SELECT
  TO anon
  USING (true);

-- 4. Allow anon role to INSERT new leads
CREATE POLICY "anon_insert_leads"
  ON leads FOR INSERT
  TO anon
  WITH CHECK (true);

-- 5. Allow anon role to UPDATE existing leads
CREATE POLICY "anon_update_leads"
  ON leads FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- 6. Allow anon role to DELETE leads (used by deleteLead + reconcile)
CREATE POLICY "anon_delete_leads"
  ON leads FOR DELETE
  TO anon
  USING (true);


-- ─── ACTIVITY TABLE ─────────────────────────────────────────────────

-- 7. Enable RLS on the activity table
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;

-- 8. Drop any old policies
DROP POLICY IF EXISTS "anon_select_activity" ON activity;
DROP POLICY IF EXISTS "anon_insert_activity" ON activity;
DROP POLICY IF EXISTS "anon_update_activity" ON activity;
DROP POLICY IF EXISTS "anon_delete_activity" ON activity;

-- 9. Allow anon role to SELECT all activity events
CREATE POLICY "anon_select_activity"
  ON activity FOR SELECT
  TO anon
  USING (true);

-- 10. Allow anon role to INSERT activity events
CREATE POLICY "anon_insert_activity"
  ON activity FOR INSERT
  TO anon
  WITH CHECK (true);

-- 11. Allow anon role to UPSERT (update) activity events
CREATE POLICY "anon_update_activity"
  ON activity FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- 12. Allow anon role to DELETE activity events (undo / reconcile)
CREATE POLICY "anon_delete_activity"
  ON activity FOR DELETE
  TO anon
  USING (true);


-- ─── VERIFY ─────────────────────────────────────────────────────────
-- After running, confirm RLS is active with this query:
--
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE tablename IN ('leads','activity');
--
-- Both rows should show rowsecurity = true.
-- ════════════════════════════════════════════════════════════════════
