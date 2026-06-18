// ── SEQUENCE ENGINE v1.0 ─────────────────────────────────────────────────────
// Core sequence logic — pure functions, no React, no side effects.
// Works with lead objects that have: seqTrack, seqStep, seqStartDate,
// seqPaused, seqExitReason fields (backfillLead stamps these on all leads).
//
// Called by:
//   leads.js upd() — auto-pause on terminal dispositions
//   process-sequence Edge Function — daily cron
//   ContactDetail.jsx — manual controls
//   DashboardTab.jsx — today's call list
// ─────────────────────────────────────────────────────────────────────────────

import { TRACK_SCHEDULES, getScheduleEntry, getTrackLength } from './sequenceTemplates.js';

// Dispositions that immediately exit the sequence
const TERMINAL_DISPS = new Set(['dnc', 'not_interested', 'withdrawn', 'chargeback']);
const PAUSE_DISPS    = new Set(['submitted', 'interested']); // booked / sold — pause but keep

// ── INIT ─────────────────────────────────────────────────────────────────────
// Stamps sequence fields on a lead that doesn't have them yet.
// seqTrack is determined by incoming disposition/status at import;
// for manually added leads it defaults to "new".
export const initSequence = (lead) => {
  if (lead.seqStartDate) return {}; // already initialised
  const track = lead.seqTrack || 'new';
  return {
    seqTrack:      track,
    seqStep:       0,
    seqStartDate:  new Date().toISOString(),
    seqPaused:     false,
    seqExitReason: null,
  };
};

// ── NEXT TOUCH DATE ──────────────────────────────────────────────────────────
// Returns Date object for when the next touch should fire.
// Returns null if sequence is paused, exhausted, or track is unknown.
export const getNextTouchDate = (lead) => {
  if (!lead) return null;
  if (lead.seqPaused) return null;
  if (lead.seqExitReason) return null;
  const track = lead.seqTrack || 'new';
  const sched = TRACK_SCHEDULES[track];
  if (!sched) return null;
  const step = lead.seqStep ?? 0;
  const entry = sched.find(s => s.step === step);
  if (!entry) return null;
  if (entry.channels.includes('archive')) return null;
  const start = new Date(lead.seqStartDate || lead.assignDate || new Date());
  const target = new Date(start);
  target.setDate(target.getDate() + entry.day);
  target.setHours(9, 0, 0, 0); // fire at 9 AM local
  return target;
};

// ── IS DUE TODAY ─────────────────────────────────────────────────────────────
// Returns true if this lead's current sequence step should fire today.
export const isSeqDueToday = (lead) => {
  if (!lead) return false;
  if (lead.seqPaused) return false;
  if (lead.seqExitReason) return false;
  const next = getNextTouchDate(lead);
  if (!next) return false;
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return next <= endOfDay;
};

// ── SHOULD ARCHIVE ───────────────────────────────────────────────────────────
// Returns true if the current step is the archive step.
export const shouldAutoArchive = (lead) => {
  if (!lead) return false;
  const track = lead.seqTrack || 'new';
  const sched = TRACK_SCHEDULES[track];
  if (!sched) return false;
  const step = lead.seqStep ?? 0;
  const entry = sched.find(s => s.step === step);
  return !!(entry && entry.channels.includes('archive'));
};

// ── ADVANCE ─────────────────────────────────────────────────────────────────
// Returns patch object to increment seqStep.
// Caller must apply via upd(id, advanceSequence(lead)).
export const advanceSequence = (lead) => {
  if (!lead) return {};
  const track = lead.seqTrack || 'new';
  const sched = TRACK_SCHEDULES[track];
  if (!sched) return {};
  const nextStep = (lead.seqStep ?? 0) + 1;
  const nextEntry = sched.find(s => s.step === nextStep);
  // v3.84 — end of a non-nurture track (past last step OR an archive step) hands
  // off to the email-only nurture drip instead of going dark. Mirrors the
  // process-sequence Edge Function (lines 763-784). seqExitReason 'exhausted' is
  // now reserved for nurture's true 2-year archive (and terminal dispositions,
  // which are set in seqPatchForDisposition).
  const atEnd = !nextEntry || nextEntry.channels.includes('archive');
  if (atEnd) {
    if (track !== 'nurture') {
      return {
        seqTrack:      'nurture',
        seqStep:       0,
        seqPaused:     false,
        seqExitReason: null,
        seqStartDate:  lead.assignDate || lead.seqStartDate || new Date().toISOString(),
      };
    }
    // Nurture's own archive step is the only genuine exhaustion.
    return { seqStep: nextStep, seqPaused: true, seqExitReason: 'exhausted' };
  }
  return { seqStep: nextStep };
};

// ── PAUSE ────────────────────────────────────────────────────────────────────
export const pauseSequence = (reason) => ({
  seqPaused: true,
  seqExitReason: reason || 'manual',
});

// ── RESUME ───────────────────────────────────────────────────────────────────
// Resets start date to now so day offsets recalculate from today.
export const resumeSequence = () => ({
  seqPaused: false,
  seqExitReason: null,
  seqStartDate: new Date().toISOString(),
});

// ── AUTO-PAUSE ON DISPOSITION ─────────────────────────────────────────────────
// Called from leads.js upd() when disposition changes.
// Returns a patch object (may be empty {}) to merge into the lead update.
export const seqPatchForDisposition = (disposition) => {
  if (TERMINAL_DISPS.has(disposition)) {
    return pauseSequence(disposition); // dnc / not_interested / etc.
  }
  if (PAUSE_DISPS.has(disposition)) {
    return pauseSequence('booked');    // appointment booked / app submitted
  }
  if (disposition === 'no_sale') {
    // Auto-enroll in no_sale sequence track — sequence owns days 1-30 follow-up
    return {
      seqTrack: 'no_sale',
      seqStep: 0,
      seqStartDate: new Date().toISOString(),
      seqPaused: false,
      seqExitReason: null,
    };
  }
  return {};
};

// ── STATUS LABEL ─────────────────────────────────────────────────────────────
// Returns human-readable status string for UI badges.
export const getSequenceStatus = (lead) => {
  if (!lead) return 'No Sequence';
  if (lead.seqExitReason === 'sold')           return '✅ Sold';
  if (lead.seqExitReason === 'booked')         return '📅 Booked';
  if (lead.seqExitReason === 'not_interested') return '🚫 Not Interested';
  if (lead.seqExitReason === 'dnc')            return '⛔ DNC';
  if (lead.seqExitReason === 'credit_denied')  return '❌ Credit Denied';
  if (lead.seqExitReason === 'exhausted')      return '📬 Dormant';
  if (lead.seqExitReason === 'manual')         return '⏸ Paused';
  if (lead.seqPaused)                          return '⏸ Paused';
  const track = lead.seqTrack || 'new';
  const step  = lead.seqStep  ?? 0;
  const next  = getNextTouchDate(lead);
  const trackLabel = track === 'new' ? 'New' : track === 're-engage' ? 'Re-Engage' : track === 'nurture' ? 'Nurture' : 'Ghost';
  if (!next) return `${trackLabel} · Step ${step}`;
  const today = new Date(); today.setHours(0,0,0,0);
  const nextDay = new Date(next); nextDay.setHours(0,0,0,0);
  const diff = Math.round((nextDay - today) / 86400000);
  if (diff <= 0) return `🔥 Due Today · Step ${step}`;
  if (diff === 1) return `⏰ Tomorrow · Step ${step}`;
  return `${trackLabel} · Day +${diff} · Step ${step}`;
};

// ── BADGE COLOR ──────────────────────────────────────────────────────────────
export const getSequenceBadgeColor = (lead) => {
  if (!lead) return 'var(--t4)';
  if (lead.seqExitReason === 'sold' || lead.seqExitReason === 'booked') return 'var(--green)';
  if (lead.seqExitReason) return 'var(--t4)';
  if (lead.seqPaused)     return 'var(--amber)';
  const next = getNextTouchDate(lead);
  if (!next) return 'var(--t4)';
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((new Date(next).setHours(0,0,0,0) - today.getTime()) / 86400000);
  if (diff <= 0) return 'var(--red)';
  return 'var(--blue)';
};

// ── TODAY'S CALL LIST ────────────────────────────────────────────────────────
// Returns leads that need a dial today, sorted by priority.
// "dial_reminder" steps are the ones that require a human call.
export const getTodayCallList = (leads, maxResults = 25) => {
  if (!leads) return [];
  const today = new Date(); today.setHours(0,0,0,0);

  return leads
    .filter(lead => {
      if (!lead) return false;
      if (lead.seqPaused) return false;
      if (lead.seqExitReason) return false;
      const track = lead.seqTrack || 'new';
      const sched = TRACK_SCHEDULES[track];
      if (!sched) return false;
      const step  = lead.seqStep ?? 0;
      const entry = sched.find(s => s.step === step);
      if (!entry) return false;
      // Must have a dial_reminder channel OR be due today with any channel
      if (!entry.channels.includes('dial_reminder') && !entry.channels.includes('sms')) return false;
      const next = getNextTouchDate(lead);
      if (!next) return false;
      const nextDay = new Date(next); nextDay.setHours(0,0,0,0);
      return nextDay <= today;
    })
    .sort((a, b) => {
      // Priority: ghost track first (shortest window), then re-engage, then new
      const trackPri = { ghost: 3, 're-engage': 2, new: 1 };
      const ap = trackPri[a.seqTrack] || 0;
      const bp = trackPri[b.seqTrack] || 0;
      if (bp !== ap) return bp - ap;
      // Earlier assign date = higher priority
      return new Date(a.assignDate || 0) - new Date(b.assignDate || 0);
    })
    .slice(0, maxResults);
};
