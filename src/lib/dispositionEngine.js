// ── DISPOSITION ENGINE (v3.43) ────────────────────────────────────────────
// Single source of truth for what a disposition does to a lead.
// Extracted from App.jsx handleDisposition (audit F3, 2026-06-10): previously
// handleDisposition (dial view) and handleTodayDispose (TodaysBlock) diverged —
// TodaysBlock dispositions silently lost auto-callbacks, disposition notes, and
// direct-VM handling. Both now call buildDispositionPatch inside upd()'s
// functional updater, so every field is computed from the FRESHEST lead state
// (also fixes the stale `open` read on directVmCount).
//
// Doctrine (locked 2026-06-10): the pre-made schedule rules all — only
// contacted dispositions rebuild it. applyPhaseTransition enforces this.

import { applyPhaseTransition, effectivePhase, buildSchedule, retireSoldSchedule } from './phaseEngine.js'; // v3.46-61
import { autoFollowUp } from './leadScoring.js';
import { dayKey } from './activityLog.js';

// Stage transitions per disposition (superset of both old inline maps —
// TodaysBlock's map previously lacked direct_vm).
export const DISP_STAGE_MAP = {
  vm_left:            "contacted",
  direct_vm:          "contacted",
  callback:           "contacted",
  hung_up:            "contacted",
  no_show:            "contacted",
  no_sale:            "contacted",
  appointment_booked: "appointment_set",
  follow_up_needed:   "follow_up",
  not_interested:     "removed",
  dnc:                "removed",
  withdrawn:          "removed",
  chargeback:         "removed",
};

// Timed auto-callback windows (hours). Disposition intent is authoritative
// over any prior manual callback (v3.38).
export const AUTO_CALLBACKS = {
  follow_up_needed: 96,  // 4 days — "I gotta think about it" window
  no_show:          24,  // 24 hrs — recovery window after missed appointment
};

export const DISP_NOTE_TEXT = {
  no_answer:      "\u{1F4F5} No Answer — dialed, no response",
  vm_left:        "\u{1F4EC} Voicemail Left",
  follow_up:      "\u{1F504} Follow Up flagged",
  not_interested: "\u{1F6AB} Not Interested",
  hung_up:        "\u{1F4F4} Hung Up",
  dnc:            "\u26D4 Do Not Call — file closed",
  no_show:        "\u274C No-Show — appointment missed",
  no_sale:        "\u{1F4CB} Household Protection Audit held — no application",
};

// buildDispositionPatch(freshLead, dispId) → patch object for upd().
// MUST be called inside a functional updater with the freshest lead state.
export const buildDispositionPatch = (freshLead, dispId) => {
  const ts = new Date().toISOString();

  const stagePatch = DISP_STAGE_MAP[dispId] ? { stage: DISP_STAGE_MAP[dispId] } : {};

  // Scheduling authority (v3.15): autoFollowUp returns null for EXIT disps
  // (clears nextCallback), undefined otherwise (leaves it untouched).
  // 'callback' is handled upstream via lockCB — skipped entirely.
  const followUpDate = dispId !== 'callback' ? autoFollowUp(dispId) : undefined;
  const cbPatch = followUpDate !== undefined ? { nextCallback: followUpDate } : {};

  const autoHours = AUTO_CALLBACKS[dispId];
  const autoCallbackPatch = autoHours
    ? { nextCallback: new Date(Date.now() + autoHours * 3_600_000).toISOString() }
    : {};
  // no-show: flag SMS needed — actual send stays MANUAL (TCPA + Funnel deconfliction)
  const noShowSmsPatch = dispId === 'no_show' ? { noShowSmsQueued: true } : {};

  // Direct VM counter (v3.35) — reads FRESH lead state
  let directVmPatch = {};
  if (dispId === 'direct_vm') {
    const newCount = (freshLead.directVmCount || 0) + 1;
    directVmPatch = { directVmCount: newCount };
    if (newCount >= 5) {
      const bucketMap = { A: 'B', B: 'C', C: 'C' };
      directVmPatch.bucket = bucketMap[freshLead.bucket] || freshLead.bucket;
    }
  }

  // Phase transition computed from freshest lead state (schedule-rules-all)
  // v3.61 — sold retires the dial machine (schedule wiped, EXIT; callbacks kept)
  const phasePatch = dispId === 'submitted'
    ? (retireSoldSchedule({ ...freshLead, disposition: 'submitted' }) || {})
    : applyPhaseTransition(freshLead, dispId);

  // v3.46 — M2/M3 spillover outcomes (Session 3). Overrides slot-consumption
  // patches (aged leads have no slots). no_show/no_sale/terminal pass through
  // untouched — their rebuilds/wipes above are already correct.
  let agedPatch = {};
  const _eff = effectivePhase(freshLead);
  if ((_eff === 'M2' || _eff === 'M3') &&
      !['no_show', 'no_sale', 'dnc', 'not_interested', 'withdrawn', 'chargeback', 'appointment_booked'].includes(dispId)) {
    if (['callback', 'follow_up_needed'].includes(dispId)) {
      // ENGAGEMENT → promote to Machine 1: full P1 schedule from today (docs:
      // "immediately reassign to Machine 1"). Reason flag = event-date aging.
      const sched = buildSchedule(new Date());
      agedPatch = {
        ...sched,
        phase: 'P1',
        phase_start: ts,
        phase_start_reason: 'm2_reactivation',
        next_dial: sched.p1_1,
        m2_next_eligible: null,
        m3_next_eligible: null,
      };
    } else if (['no_answer', 'vm_left', 'direct_vm', 'hung_up'].includes(dispId)) {
      // Non-contact → re-space per docs minimums. hung_up = re-space, not
      // promote (negative answer is not momentum) — Jeremy can veto.
      agedPatch = _eff === 'M2'
        ? { m2_next_eligible: new Date(Date.now() + 14 * 86400000).toISOString() }
        : { m3_next_eligible: new Date(Date.now() + 30 * 86400000).toISOString() };
    }
  }

  const autoNotes = [];
  if (autoHours === 96) autoNotes.push({ ts, type: "note", text: `\u{1F504} Follow-Up — next call in 4 days (${new Date(Date.now() + 96 * 3_600_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` });
  if (autoHours === 24) autoNotes.push({ ts, type: "note", text: `\u274C No-Show — recovery call set for 24hrs. Text family to reschedule.` });
  const dispNote = DISP_NOTE_TEXT[dispId];
  const notes = dispNote
    ? [{ ts, type: "call", text: dispNote }, ...autoNotes, ...(freshLead.notes || [])]
    : [...autoNotes, ...(freshLead.notes || [])];

  return {
    disposition: dispId,
    lastContact: dayKey(),   // v3.43 — F1: LOCAL date key (was UTC in some paths)
    // v3.50 — lifetime flag: first-ever booking, never reverts
    ...(dispId === 'appointment_booked' && !freshLead.apptSetEver ? { apptSetEver: true } : {}),
    ...stagePatch,
    ...phasePatch,
    ...agedPatch,
    ...cbPatch,
    ...autoCallbackPatch,
    ...directVmPatch,
    ...noShowSmsPatch,
    notes,
  };
};
