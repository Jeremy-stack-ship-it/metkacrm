// ── ACTIVITY TRACKER (v2.3 → v3.5) ──────────────────────────────────
// Append-only event log; aggregations derived on demand.
// Auto-log triggers: dial = click-to-call; contact = disp transitions
// into ACTUAL-CONVERSATION states; appointment = stage→appointment_set OR
// note logged with type=appointment.

import { sbAppendActivity } from './supabaseSync.js';

// ── CONSTANTS ────────────────────────────────────────────────────────
export const DEFAULT_GOALS = { dials: 30, contacts: 10, appointments: 3 };

// Dispositions that mean a real human picked up the phone
export const CONTACT_DISPS = [
  "appointment_booked", "no_show", "callback", "not_interested",
  "dnc", "follow_up", "follow_up_needed", "chargeback", "hung_up"
];

export const ACTIVITY_TYPES = [
  { id: "dial",        label: "Dial",         icon: "📞", color: "var(--blue)",  bg: "var(--blue-dim)",  border: "var(--blue-mid)" },
  { id: "contact",     label: "Contact",      icon: "☎",  color: "var(--sky)",   bg: "var(--sky-dim)",   border: "#BAE6FD" },
  { id: "appointment", label: "Appointment",  icon: "📅", color: "var(--green)", bg: "var(--green-dim)", border: "#6EE7B7" },
  { id: "audit_ran",   label: "Audit Held",   icon: "✅", color: "var(--green)", bg: "var(--green-dim)", border: "#6EE7B7" },
];

// ── DAY & TIME HELPERS ───────────────────────────────────────────────
// Local-day key (NOT UTC) so "today" matches the wall clock.
export const dayKey = (ts) => {
  const d = ts ? new Date(ts) : new Date();
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const TODAY_KEY = () => dayKey(new Date());

// Last N local days, oldest→newest, with day-name labels for charts.
export const lastNDays = (n) => {
  const arr = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    arr.push({
      key: dayKey(d),
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      date: d
    });
  }
  return arr;
};

// Returns YYYY-MM-DD keys for current local week (Mon→Sun) and current month.
// Symmetry production week: Saturday → Friday
export const weekKeys = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0=Sun … 6=Sat
  const daysFromSat = (dow - 6 + 7) % 7; // 0 on Sat, 1 on Sun, …, 6 on Fri
  const saturday = new Date(today);
  saturday.setDate(today.getDate() - daysFromSat);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(saturday);
    d.setDate(saturday.getDate() + i);
    out.push(dayKey(d));
  }
  return out;
};

export const monthKeys = () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const out = [];
  for (let i = 1; i <= last; i++) out.push(dayKey(new Date(y, m, i)));
  return out;
};

// Aggregate an activity[] over a set of local-day keys.
export const aggregateActivity = (events, keys) => {
  const set = new Set(keys);
  const out = { dials: 0, contacts: 0, appointments: 0, total: 0, perDay: {} };
  keys.forEach(k => {
    out.perDay[k] = { dials: 0, contacts: 0, appointments: 0 };
  });
  (events || []).forEach(e => {
    if (!e || !e.date || !set.has(e.date)) return;
    const t = e.type;
    if (t !== "dial" && t !== "contact" && t !== "appointment") return;
    out[t + "s"] += 1;
    out.total += 1;
    if (out.perDay[e.date]) out.perDay[e.date][t + "s"] += 1;
  });
  return out;
};

export const fmtTime = (ts) =>
  ts ? new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

// Tile color for goal progress: green ≥100%, blue ≥66%, amber ≥33%, red <33%, neutral 0.
export const goalTone = (val, goal) => {
  if (!goal || goal <= 0) return { c: "var(--t3)", bg: "var(--surface-2)", border: "var(--border)" };
  const pct = val / goal;
  if (val === 0) return { c: "var(--t3)", bg: "var(--surface-2)", border: "var(--border)" };
  if (pct >= 1) return { c: "var(--green)", bg: "var(--green-dim)", border: "#6EE7B7" };
  if (pct >= 0.66) return { c: "var(--blue)", bg: "var(--blue-dim)", border: "var(--blue-mid)" };
  if (pct >= 0.33) return { c: "var(--amber)", bg: "var(--amber-dim)", border: "#FCD34D" };
  return { c: "var(--red)", bg: "var(--red-dim)", border: "#FCA5A5" };
};

// ── ACTIVITY MANAGEMENT ──────────────────────────────────────────────
// Create activity log management functions. These work with state via callbacks.
// saveActivity and leads must be passed in from the component.

export const makeActivityManager = (setActivity, leads, saveActivity, appendActivity) => {
  const undoLastActivity = (activity) => {
    if (activity.length === 0) return;
    const nextActivity = [...activity];
    const removed = nextActivity.shift();
    if (confirm(`Remove last ${removed.type}: ${removed.leadName || "Manual entry"}?`)) {
      saveActivity(nextActivity);
    }
  };

  // Append a single activity event. source: 'auto' (system-fired) or 'manual' (+1 button).
  // v3.5 — pushes only the new event to Supabase (sbAppendActivity), never rewrites the log.
  // v3.13 — uses appendActivity functional updater; removed stale `activity` param from signature.
  //          Manual +1 button was broken because callers never passed the 4th arg ([ev, ...undefined] throws).
  const logActivity = (type, leadId, source) => {
    if (!type) return;
    const lead = leadId ? leads.find(l => l.id === leadId) : null;
    const ts = new Date().toISOString();
    const ev = {
      id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ts,
      date: dayKey(ts),
      type,
      leadId: leadId || null,
      leadName: lead ? lead.name : null,
      source: source || "auto"
    };
    appendActivity([ev]); // v3.13 — functional updater, no stale activity param needed
    sbAppendActivity(ev).catch(() => {}); // non-blocking, single-event push
  };

  return {
    undoLastActivity,
    logActivity
  };
};

// ── QUEUED ACTIVITY FOR LEAD UPDATES ─────────────────────────────────
// Helper to compute which activity events should fire based on lead state transitions.
// Used by upd() function to queue appointment and contact logging.

export const computeActivityQueue = (cur, patch, id, leadId) => {
  const queued = []; // [{type, leadId}]

  // Stage transition → appointment
  if (cur && patch.stage && patch.stage !== cur.stage) {
    if (patch.stage === "appointment_set" && cur.stage !== "appointment_set") {
      queued.push({ type: "appointment", leadId: id });
    }
  }

  // Disposition transition → contact
  if (cur && patch.disposition && patch.disposition !== cur.disposition) {
    const nowIsContact = CONTACT_DISPS.includes(patch.disposition);
    const wasContact = CONTACT_DISPS.includes(cur.disposition || "");
    if (nowIsContact && !wasContact) {
      queued.push({ type: "contact", leadId: id });
    }
  }

  return queued;
};

// Create an activity event from a queued item (used during upd).
export const makeActivityEvent = (q, next, i) => {
  const ts = new Date().toISOString();
  const lead = next.find(l => l.id === q.leadId);
  return {
    id: `a_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
    ts,
    date: dayKey(ts),
    type: q.type,
    leadId: q.leadId,
    leadName: lead ? lead.name : null,
    source: "auto"
  };
};
