/**
 * useSupabaseHydration — v3.14
 *
 * Handles the one-time Supabase cloud sync that runs on app mount:
 *   - Prunes 60-day-old deletion tombstones
 *   - Per-lead _ts merge: newest timestamp wins between local and remote
 *   - Seeds Supabase on first run (empty remote → push local up)
 *   - Activity log repair: local wins if it has more events
 *
 * Extracted from App.jsx v3.14 to keep the main init useEffect focused
 * on synchronous localStorage hydration only.
 *
 * @param {Function} setLeads      React state setter for lead array
 * @param {Function} setActivity   React state setter for activity log
 * @param {Function} setSupaStatus React state setter for sync indicator ('idle'|'syncing'|'ok'|'error')
 */

import { useEffect } from 'react';
import LZString from 'lz-string';
import {
  sbLoadAll,
  sbUpsertAll,
  sbReconcileDeletes,
  sbLoadActivity,
  sbSaveActivity,
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
          console.log('[v3.14] Supabase empty — seeding from localStorage');
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
            merged.set(r.id, r); // new lead from another device
            remoteAdded++;
          } else if ((r._ts || 0) > (local._ts || 0)) {
            merged.set(r.id, r); // remote is newer — take it
          }
          // else: local is newer or equal — keep (already in map)
        });

        const result = Array.from(merged.values());
        console.log(
          `[v3.14] Hydration merge: local=${prev.length} remote=${remote.length}` +
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

    // ── Activity hydration: local wins if it has more events ────────
    sbLoadActivity().then(remote => {
      if (!remote || !Array.isArray(remote) || remote.length === 0) return;
      setActivity(prev => {
        if (remote.length >= prev.length) {
          try { localStorage.setItem(LS_ACTIVITY, JSON.stringify(remote)); } catch {}
          return remote;
        }
        // Local has more — repair Supabase
        sbSaveActivity(prev).catch(() => {});
        return prev;
      });
    }).catch(() => {});

  // Intentionally no deps — runs once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
