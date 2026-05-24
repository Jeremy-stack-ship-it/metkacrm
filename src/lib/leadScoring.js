/**
 * leadScoring.js — Priority scoring, auto follow-up scheduling, Calendly popup
 * Extracted from App.jsx v3.7
 */
import { isUWStuck } from '../constants.js';

/**
 * Priority score for a lead. Higher = dial first.
 * Returns -9999 for hard-terminal disps (dnc, not_interested).
 * Returns -100 for soft-sink stages (issued, underwriting, etc.).
 */
export function priority(lead) {
  if (!lead) return 0;
  const now = new Date();
  const leadDate = new Date(lead.assignDate || 0);
  const sevenDaysAgo    = new Date(now.getTime() - (7  * 24 * 60 * 60 * 1000));
  const twentyOneDaysAgo = new Date(now.getTime() - (21 * 24 * 60 * 60 * 1000));
  const currentDisp  = lead.disposition || "";
  const currentStage = lead.stage || "";

  const hardTerminalDisps = ['dnc', 'not_interested'];
  if (hardTerminalDisps.includes(currentDisp)) return -9999;

  const softSinkDisps  = ['invalid', 'archive', 'appointment_booked'];
  const softSinkStages = ['invalid', 'archive', 'issued', 'delivered', 'app_submitted', 'underwriting'];
  if (softSinkDisps.includes(currentDisp) || softSinkStages.includes(currentStage)) return -100;

  let score = 0;
  if (lead.nextCallback) {
    const cb = new Date(lead.nextCallback);
    if (cb <= now) score += 1000;
    else if (cb.toDateString() === now.toDateString()) score += 800;
  }
  if (lead.aiScore && lead.aiScore > 0) {
    score += lead.aiScore * 60;
  } else {
    if (leadDate >= sevenDaysAgo)     score += 500;
    else if (leadDate >= twentyOneDaysAgo) score += 250;
  }
  if (typeof isUWStuck === 'function' && isUWStuck(lead)) score += 400;
  if (lead.bucket === "A") score += 100;
  if (lead.bucket === "B") score += 50;
  return score;
}

/**
 * Returns the next ISO callback datetime for a given disposition.
 * Returns null  → clear the callback (terminal disps).
 * Returns undefined → don't touch existing nextCallback.
 * Always sets time to 9 AM local — never midnight UTC.
 */
/**
 * autoFollowUp — Scheduling Authority Rules (v3.15)
 *
 * The Phase Engine owns the call schedule. This function ONLY overrides
 * nextCallback in three specific cases:
 *
 *   APPOINTMENT BOOKED  → nextCallback already set to appt time by Calendly flow.
 *                         Return undefined here so we don't touch it.
 *   CALLBACK REQUESTED  → Handled upstream via lockCB/handleCbPreset.
 *                         'callback' dispId never reaches this function (App.jsx guard).
 *   EXIT DISPOSITIONS   → null clears nextCallback — lead exits all flows.
 *
 * Everything else (vm_left, no_answer, hung_up, follow_up_needed, no_show) →
 * returns undefined. nextCallback is NOT touched. Phase Engine keeps its schedule.
 */
export function autoFollowUp(dispId) {
  switch (dispId) {
    // ── EXIT FLOWS: clear nextCallback ──────────────────────────────
    case 'dnc':
    case 'not_interested':
    case 'withdrawn':
    case 'chargeback':
    case 'invalid':
    case 'archive':          return null;

    // ── APPOINTMENT: nextCallback already set by Calendly flow ──────
    case 'appointment_booked': return undefined;

    // ── NO CONTACT & ALL OTHERS: Phase Engine owns the schedule ─────
    // vm_left, no_answer, hung_up, follow_up_needed, no_show, callback, etc.
    default:                 return undefined;
  }
}

/**
 * Opens the Calendly inline popup pre-filled with lead info.
 * Requires the Calendly widget script to be loaded on the page.
 */
export function openCalendlyPopup(lead, url, setTargetId) {
  if (!url) { alert("No Calendly URL set. Go to Settings → Calendly to add it."); return; }
  if (!window.Calendly) { alert("Calendly is still loading. Try again in a moment."); return; }
  setTargetId(lead.id);
  const n = encodeURIComponent(lead.name  || '');
  const e = encodeURIComponent(lead.email || '');
  const p = encodeURIComponent((lead.phone || '').replace(/\D/g, ''));
  const prefillUrl = `${url}?name=${n}${e ? `&email=${e}` : ''}&a1=${p}`;
  window.Calendly.initPopupWidget({ url: prefillUrl });
}
