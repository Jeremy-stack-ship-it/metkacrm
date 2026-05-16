import { createClient } from '@supabase/supabase-js';

// ── SUPABASE CLIENT ──────────────────────────────────────────────
const SUPA_URL  = "https://brskbcdaefmkcgctlhlb.supabase.co";
const SUPA_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyc2tiY2RhZWZta2NnY3RsaGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODExODAsImV4cCI6MjA5Mjk1NzE4MH0.SY8hQHmWKxBjSNNAHGVz7zU0skF8Km98Clbj8ALPamE";
const supabase  = createClient(SUPA_URL, SUPA_KEY);
window.supabase = supabase; // expose for console debugging

// Upsert a single lead to Supabase (non-blocking).
// Returns a promise that rejects on error so callers can update sync status.
export const sbUpsertLead = (lead) =>
  supabase.from('leads')
    .upsert({ id: lead.id, data: lead, updated_at: new Date().toISOString() })
    .then(({ error }) => {
      if (error) throw new Error(error.message);
    });

// Upsert all leads to Supabase (bulk).
// Throws on first batch error so saveLeads .catch() can set supaStatus -> "error".
export const sbUpsertAll = async (leads) => {
  const rows = leads.map(l => ({ id: l.id, data: l, updated_at: new Date().toISOString() }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('leads').upsert(rows.slice(i, i + 500));
    if (error) throw new Error(`[Supabase] bulk upsert batch ${i}–${i+500}: ${error.message}`);
  }
};

// Delete a lead from Supabase
export const sbDeleteLead = (id) => {
  supabase.from('leads').delete().eq('id', id).then(({error}) => {
    if (error) console.warn('[Supabase] delete error:', error.message);
  });
};

// Reconcile: delete Supabase rows that no longer exist locally (runs on startup)
export const sbReconcileDeletes = async (localLeads) => {
  try {
    // Paginate to get ALL remote IDs — don't let the 1000-row cap hide orphans
    const PAGE = 1000;
    let allRemote = [], from = 0, done = false;
    while (!done) {
      const { data, error } = await supabase.from('leads').select('id').range(from, from + PAGE - 1);
      if (error || !data) return;
      allRemote = allRemote.concat(data);
      done = data.length < PAGE;
      from += PAGE;
    }
    const data = allRemote;
    if (!data) return;
    const localIds = new Set(localLeads.map(l => l.id));
    const toDelete = data.map(r => r.id).filter(id => !localIds.has(id));
    if (toDelete.length === 0) return;
    console.log(`[Supabase] Removing ${toDelete.length} orphaned rows`);
    for (let i = 0; i < toDelete.length; i += 500) {
      await supabase.from('leads').delete().in('id', toDelete.slice(i, i + 500));
    }
  } catch(e) { console.warn('[Supabase] reconcile error:', e.message); }
};

// Load all leads from Supabase (paginated — bypasses 1000-row PostgREST cap)
export const sbLoadAll = async () => {
  const PAGE = 1000;
  let all = [], from = 0, done = false;
  while (!done) {
    const { data, error } = await supabase
      .from('leads').select('id, data')
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) { console.warn('[Supabase] load error:', error.message); return null; }
    all = all.concat(data || []);
    done = !data || data.length < PAGE;
    from += PAGE;
  }
  return all.map(r => r.data).filter(Boolean);
};

// Activity log Supabase helpers — requires `activity` table:
//   CREATE TABLE activity (id text PRIMARY KEY, data jsonb, updated_at timestamptz);
//
// v3.5 — individual rows per event (id = event.id). No more single-blob overwrite.
// Each dial/contact/appointment is its own row — append-only, never rewrites history.
export const sbSaveActivity = async (events) => {
  if (!events || events.length === 0) return;
  const rows = events.map(ev => ({
    id: ev.id,
    data: ev,
    updated_at: ev.ts || new Date().toISOString()
  }));
  // Batch in 500s to stay under Supabase limits
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('activity').upsert(rows.slice(i, i + 500));
    if (error) console.warn('[Supabase] activity save error:', error.message);
  }
};

export const sbAppendActivity = async (ev) => {
  // Push a single new event — used by logActivity to avoid rewriting the whole log
  const { error } = await supabase.from('activity')
    .upsert({ id: ev.id, data: ev, updated_at: ev.ts || new Date().toISOString() });
  if (error) console.warn('[Supabase] activity append error:', error.message);
};

export const sbLoadActivity = async () => {
  // Load individual event rows (new schema). Falls back to legacy blob row if none found.
  const { data, error } = await supabase.from('activity').select('data').neq('id', 'log');
  if (error) { console.warn('[Supabase] activity load error:', error.message); return null; }
  if (data && data.length > 0) return data.map(r => r.data).filter(Boolean);
  // Legacy fallback: old schema stored everything in one blob row id='log'
  const { data: blob } = await supabase.from('activity').select('data').eq('id', 'log').single();
  return blob?.data || null;
};

export { supabase };
