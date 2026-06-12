// ── FUNNEL SYNC ENGINE (v3.45) ───────────────────────────────────────────────
// Import mode 3: "Sync from Funnel". Reconciles a Funnel CSV export against the
// CRM without destroying CRM-side work. Spec: tasks/CSV-SYNC-ANALYSIS-2026-06-10.md
//
// MATCHING:  leadCode (Funnel vendor unique ID) first — phone digits fallback.
//            LeadCode matching permanently fixes the spouse/shared-phone collision.
//
// CONFLICT DOCTRINE (locked with Jeremy 2026-06-10):
//   The Funnel export carries NO status timestamps, so the sync NEVER DOWNGRADES.
//   A Funnel status applies only if it advances the lead on the progress ladder.
//   - DNC always wins, both directions (compliance, not data hygiene).
//   - "Not Interested" is fenced: terminal-negative, applies only to barely-touched
//     leads — it can never kill live CRM work (callback/follow-up/appointment).
//   - Skipped conflicts are REPORTED, never silently resolved.
//
// NEVER TOUCHED on matched leads: existing notes (sync note prepends), schedule
// slots, phase, nextCallback, lastContact. A sync is not a dial — no slot is
// consumed. Terminal statuses go through the EXIT wipe per doctrine.

import { mapFunnelStatus } from './csvParser.js';
import { SCHED_COLS } from './phaseEngine.js';
import { dayKey } from './activityLog.js';

// Progress ladder — higher = further along. Sync applies Funnel status only if
// rank(funnel) > rank(crm).
export const DISP_RANK = {
  not_called: 0,
  no_answer: 1,
  vm_left: 1,
  direct_vm: 1,
  hung_up: 2,
  callback: 3,
  follow_up_needed: 4,
  interested: 5,
  appointment_booked: 5,
  no_show: 6,
  no_sale: 7,
  not_interested: 7,   // terminal-negative — fenced separately below
  withdrawn: 7,
  chargeback: 7,
  submitted: 8,
  dnc: 9,              // always applies regardless of rank (compliance)
};

const FENCE_NOT_INTERESTED_ABOVE = 2; // CRM rank > 2 (callback+) blocks Funnel "Not Interested"

// Funnel-sync new-field backfill — only fills holes, never overwrites CRM values.
const FIELD_KEYS = ['leadCode','leadAssignmentId','sex','street','leadSource',
  'leadSubSource','exclusivityEndDate','purchaseAmount','birthday','funnelAssignDate'];

const phoneDigits = p => (p || '').replace(/\D/g, '');

// syncFromCsv(csvLeads, currentLeads) → { leads, report }
// Pure function — caller persists via saveLeads.
export const syncFromCsv = (csvLeads, currentLeads) => {
  const now = new Date();
  const ts = now.toISOString();
  const syncDay = dayKey(ts);
  const tsNum = Date.now();

  // Index current leads: leadCode → lead, phone → lead
  const byCode = new Map();
  const byPhone = new Map();
  currentLeads.forEach(l => {
    if (l.leadCode) byCode.set(String(l.leadCode), l);
    const pd = phoneDigits(l.phone);
    if (pd && !byPhone.has(pd)) byPhone.set(pd, l);
  });

  const report = {
    statusUpdated: [],   // { name, from, to }
    conflicts: [],       // { name, crm, funnel, reason }
    fieldsBackfilled: 0,
    newLeads: [],        // csv leads not in CRM (caller imports via backfill path)
    crmOnly: [],         // names of CRM leads absent from the export
    unchanged: 0,
  };

  const matchedIds = new Set();
  const patches = new Map(); // leadId → patch

  csvLeads.forEach(c => {
    const match = (c.leadCode && byCode.get(String(c.leadCode)))
               || byPhone.get(phoneDigits(c.phone))
               || null;
    if (!match) { report.newLeads.push(c); return; }
    matchedIds.add(match.id);

    const patch = {};

    // ── field backfill (holes only) ──
    FIELD_KEYS.forEach(k => {
      if ((match[k] == null || match[k] === '') && c[k] != null && c[k] !== '') {
        patch[k] = c[k];
        report.fieldsBackfilled++;
      }
    });
    if (!match.inFunnel) patch.inFunnel = true;
    patch.funnelSyncedAt = ts;

    // ── status diff ──
    const f = mapFunnelStatus(c.funnelStatusRaw);
    const fromDisp = match.disposition || 'not_called';
    const toDisp = f.disposition;
    if (toDisp !== fromDisp) {
      const fromRank = DISP_RANK[fromDisp] ?? 0;
      const toRank = DISP_RANK[toDisp] ?? 0;
      const isDnc = toDisp === 'dnc';
      const fencedNI = toDisp === 'not_interested' && fromRank > FENCE_NOT_INTERESTED_ABOVE;

      if (isDnc || (toRank > fromRank && !fencedNI)) {
        patch.disposition = toDisp;
        if (f.stage) patch.stage = f.stage;
        // v3.56 — AUDIT V2-2: sync may DISARM a sequence (terminal statuses must
        // stop the drip — the cron filters on seqPaused only, not disposition)
        // but NEVER ARM one. Re-arming with stale seqStartDate caused the 6/11
        // barrage shape. Enrollment is a deliberate act in the CRM, never a
        // side effect of a Funnel status. Doctrine: Jeremy, 2026-06-12.
        if (f.seqPaused === true) {
          patch.seqTrack = f.seqTrack; patch.seqStep = f.seqStep;
          patch.seqPaused = true; patch.seqExitReason = f.seqExitReason;
        }
        if (['dnc', 'not_interested'].includes(toDisp)) {
          // terminal → EXIT wipe per doctrine
          patch.phase = 'EXIT';
          patch.next_dial = null;
          SCHED_COLS.forEach(k => { if (match[k]) patch[k] = null; });
          if (toDisp === 'dnc') patch.stage = 'removed';
        }
        // v3.61 — SOLD also retires the dial machine (Lori Mills bug: Issue Paid
        // synced 6/10 but her P2 schedule kept marching → dialed her 6/12)
        if (toDisp === 'submitted') {
          patch.phase = 'EXIT';
          patch.next_dial = null;
          SCHED_COLS.forEach(k => { if (match[k]) patch[k] = null; });
        }
        patch.notes = [{ ts, type: 'note',
          text: `\u{1F501} Funnel sync ${syncDay}: status ${c.funnelStatusRaw || fromDisp} \u2192 ${toDisp}` },
          ...(match.notes || [])];
        report.statusUpdated.push({ name: match.name, from: fromDisp, to: toDisp });
      } else {
        report.conflicts.push({ name: match.name, crm: fromDisp, funnel: toDisp,
          reason: fencedNI ? 'not_interested fenced (CRM has live work)' : 'CRM more advanced — kept' });
      }
    }

    // Churn guard: only patch (and bump _ts → Supabase upsert) when something
    // real changed. funnelSyncedAt alone is not worth re-upserting 2,400 rows.
    const keys = Object.keys(patch).filter(k => k !== 'funnelSyncedAt');
    if (keys.length === 0) { report.unchanged++; return; }
    patches.set(match.id, patch);
  });

  // CRM-only leads (not in export) — report only, never touched
  currentLeads.forEach(l => {
    if (!matchedIds.has(l.id)) report.crmOnly.push(l.name || l.id);
  });

  const leads = currentLeads.map(l => {
    const p = patches.get(l.id);
    if (!p) return l;
    return { ...l, ...p, _ts: tsNum };
  });

  return { leads, report };
};

// One-paragraph human summary for the post-sync alert.
export const summarizeSyncReport = (r) => {
  const lines = [
    `Funnel Sync complete:`,
    `\u2022 ${r.statusUpdated.length} status updates applied`,
    `\u2022 ${r.conflicts.length} conflicts kept CRM (see console)`,
    `\u2022 ${r.fieldsBackfilled} fields backfilled (LeadCode, cost, sex, source...)`,
    `\u2022 ${r.newLeads.length} new leads imported`,
    `\u2022 ${r.crmOnly.length} CRM-only leads untouched (see console)`,
  ];
  return lines.join('\n');
};
