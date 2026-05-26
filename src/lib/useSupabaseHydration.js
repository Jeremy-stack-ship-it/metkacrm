/**
 * useSupabaseHydration — v3.29
 *
 * Boot-time cloud sync + live realtime subscription.
 *
 * Boot-time (runs once on mount):
 *   - Prunes 60-day-old deletion tombstones
 *   - Per-lead _ts merge: newest timestamp wins between local and remote
 *   - Seeds Supabase on first run (empty remote → push local up)
 *   - Activity log repair: union-by-event-ID (replaced array-length comparison)
 *
 * Realtime (active while app is open):
 *   - Subscribes to Postgres changes on `leads` table (INSERT + UPDATE)
 *   - Merges incoming records using same _ts logic — newest wins
 *   - Handles cross-tab and cross-device live updates without page refresh
 *   - Self-updates from this tab's own writes are harmlessly ignored (_ts guard)
 *   - Channel cleaned up on unmount
 *
 * @param {Function} setLeads      React state setter for lead array
 * @param {Function} setActivity   React state setter for activity log
 * @param {Function} setSupaStatus React state setter ('idle'|'syncing'|'ok'|'error')
 */

import { useEffect } from 'react';
import LZString from 'lz-string';
import { assignSlot } from './phaseEngine.js';
import {
  sbLoadAll,
  sbUpsertAll,
  sbReconcileDeletes,
  sbLoadActivity,
  sbSaveActivity,
  supabase,
} from './supabaseSync.js';

// ── localStorage keys (must match App.jsx — never rename) ────────────
const LS_LEADS       = 'metka-crm-leads-v3';
const LS_DELETED_IDS = 'metka-deleted-ids-v1';
const LS_ACTIVITY    = 'metka-activity-v1';

const TOMBSTONE_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

export const useSupabaseHydration = (setLeads, setActivity, setSupaStatus) => {
  useEffect(() => {
    setSupaStatus('syncing');

    // ── Tombstone load + 60-day prune ───────────────────────────────
    let deletedIds = {};
    try {
      const raw = localStorage.getItem(LS_DELETED_IDS);
      if (raw) deletedIds = JSON.parse(raw);
    } catch {}
    const cutoff = Date.now() - TOMBSTONE_TTL_MS;
    let pruned = false;
    Object.keys(deletedIds).forEach(id => {
      if (deletedIds[id] < cutoff) { delete deletedIds[id]; pruned = true; }
    });
    if (pruned) {
      try { localStorage.setItem(LS_DELETED_IDS, JSON.stringify(deletedIds)); } catch {}
    }

    // ── Lead hydration: per-lead _ts merge ─────────────────────────
    sbLoadAll().then(remote => {
      if (!remote) { setSupaStatus('error'); return; }

      setLeads(prev => {
        if (remote.length === 0) {
          // Supabase empty — first run or wiped. Seed from local.
          console.log('[v3.29] Supabase empty — seeding from localStorage');
          sbUpsertAll(prev).then(() => setSupaStatus('ok')).catch(() => setSupaStatus('error'));
          sbReconcileDeletes(prev).catch(() => {});
          return prev;
        }

        // Newest _ts wins per ID
        const merged = new Map();
        prev.forEach(l => merged.set(l.id, l));
        let remoteAdded = 0;
        remote.forEach(r => {
          if (deletedIds[r.id]) return; // locally deleted — skip ghost
          const local = merged.get(r.id);
          if (!local) {
            // New lead from another device — assign slot client-side if Supabase doesn't have it
            merged.set(r.id, r.slot ? r : { ...r, slot: assignSlot(r) });
            remoteAdded++;
          } else if ((r._ts || 0) > (local._ts || 0)) {
            // Remote is newer — take it. v3.33: slot is now a real column so r.slot is populated.
            // Merge promoted columns back into data blob to keep them in sync.
            const promoted = { slot: r.slot || local.slot };
            merged.set(r.id, { ...r, ...promoted });
          }
          // else: local is newer or equal — keep (already in map)
        });

        const result = Array.from(merged.values());
        console.log(
          `[v3.29] Hydration merge: local=${prev.length} remote=${remote.length}` +
          ` result=${result.length} remoteAdded=${remoteAdded}`
        );

        try {
          localStorage.setItem(LS_LEADS, LZString.compressToUTF16(JSON.stringify(result)));
        } catch {}

        if (remoteAdded > 0) sbUpsertAll(result).catch(() => {});

        setSupaStatus('ok');
        sbReconcileDeletes(result).catch(() => {});
        return result;
      });
    }).catch(() => setSupaStatus('error'));

    // ── Activity hydration: union by event ID ──────────────────────
    // v3.29: replaced array-length comparison with event-ID union.
    // Both sides may have events the other lacks (two devices, two tabs).
    // Union is always safe — activity events are append-only and immutable.
    sbLoadActivity().then(remote => {
      if (!remote || !Array.isArray(remote) || remote.length === 0) return;
      setActivity(prev => {
        const localIds = new Set(prev.map(e => e.id));
        const newFromRemote = remote.filter(e => e.id && !localIds.has(e.id));

        if (newFromRemote.length === 0) {
          // Remote added nothing new; push local up if it has events remote lacks
          if (prev.length > remote.length) sbSaveActivity(prev).catch(() => {});
          return prev;
        }

        // Union: merge remote-only events into local, sort chronologically
        const merged = [...prev, ...newFromRemote]
          .sort((a, b) => (a.ts || '') > (b.ts || '') ? 1 : -1);
        try { localStorage.setItem(LS_ACTIVITY, JSON.stringify(merged)); } catch {}
        sbSaveActivity(merged).catch(() => {}); // reconcile complete set back to Supabase
        return merged;
      });
    }).catch(() => {});

    // ── Realtime subscription: live cross-tab / cross-device sync ──
    // v3.29: subscribes to Postgres changes on `leads` table.
    // INSERT  → adds net-new leads from another device immediately.
    // UPDATE  → merges using _ts (newest wins); this tab's own writes
    //           echo back here but are ignored because _ts matches local.
    // DELETE  → not handled here; tombstone system covers intentional deletes.
    const channel = supabase
      .channel('crm-leads-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          const incoming = payload.new?.data;
          if (!incoming?.id) return;
          setLeads(prev => {
            if (prev.some(l => l.id === incoming.id)) return prev; // already have it
            const next = [...prev, incoming];
            try { localStorage.setItem(LS_LEADS, LZString.compressToUTF16(JSON.stringify(next))); } catch {}
            return next;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          const incoming = payload.new?.data;
          if (!incoming?.id) return;
          setLeads(prev => {
            const existing = prev.find(l => l.id === incoming.id);
            // Accept only if remote is strictly newer (this tab's own writes come back
            // with the same _ts, so they're harmlessly skipped here)
            if (existing && (existing._ts || 0) >= (incoming._ts || 0)) return prev;
            const next = existing
              ? prev.map(l => l.id === incoming.id ? incoming : l)
              : [...prev, incoming];
            try { localStorage.setItem(LS_LEADS, LZString.compressToUTF16(JSON.stringify(next))); } catch {}
            return next;
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] crm-leads-rt channel error — live sync unavailable, boot-time sync still active');
        }
      });

    return () => { supabase.removeChannel(channel); };

  // Intentionally no deps — runs once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
