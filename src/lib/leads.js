// ── LEAD MANAGEMENT (v2.3 → v3.5) ───────────────────────────────────────────────────────
// Single lead operations: update, create, delete, notes with activity logging.
// All state-mutating operations handled through component callbacks for isolation.

import { sbUpsertLead, sbAppendActivity, sbDeleteLead } from './supabaseSync.js';
import { dayKey, CONTACT_DISPS } from './activityLog.js';
import { backfillLead, assignSlot } from './phaseEngine.js';
import { seqPatchForDisposition, initSequence } from './sequenceEngine.js';

// ── CONTACT EVENT DEDUP (v3.36) ─────────────────────────────────────────────────────
// Prevents duplicate contact events (and future duplicate SMS triggers) from double-clicks
// or React batching. 10-second window is longer than any accidental double-fire but shorter
// than any legitimate second answered call (dial → ring → answer → disposition ≈ 2+ min).
const CONTACT_DEDUP_MS = 10_000;
const _contactDedup = new Map(); // leadId → last contact event timestamp (ms)

// ── LEAD MANAGEMENT FACTORY ───────────────────────────────────────────────────────
// Creates bound lead mutation functions. State mutation is delegated to parent component.
// Dependencies: leads array, activity log, state setters for leads/activity/UI state.

export const makeLeadManager = (
  leads,
  activity,
  saveLeads,
  saveActivity,
  setOpenId,
  setView,
  prevView,
  newL,
  setNewL,
  setDupeLead,
  setAddForm,
  cbDate,
  cbTime,
  setCbDate,
  setCbTime,
  noteText,
  setNoteText,
  noteType,
  setLeads,        // v3.12 — functional updater to prevent stale-closure race in PD mode
  persistLeads,    // v3.12 — (next: Lead[]) => void  saves to localStorage + Supabase single row
  appendActivity   // v3.13 — functional updater for activity events (fixes stale closure / 0 contacts bug)
) => {
  // Single-lead update: local save (skip bulk push) then push just this row
  // v2.2 — auto-stamps submittedDate / policyIssueDate on stage transitions
  // v2.3 — auto-logs activity on disp→contact and stage→appointment_set transitions
  // v3.12 — uses setLeads(prev=>) to avoid stale-closure race condition in Power Dialer mode
  const upd = (id, p) => {
    // v3.13 fix — side-effect capture vars live OUTSIDE setLeads but are OVERWRITTEN each invocation.
    // React StrictMode (dev) double-invokes updaters to detect side effects — moving queued INSIDE
    // and setTimeout calls OUTSIDE means side effects fire exactly once in both dev and prod.
    let sfLeads = null;
    let sfUpdated = null;
    let sfEvents = null;

    setLeads(prev => {
      // queued is fresh per invocation — no external array that accumulates across StrictMode runs.
      const queued = [];

      const cur = prev.find(l => l.id === id);
      // patch reset inside updater — prevents StrictMode double-run mutation carryover.
      // v3.36 — functional updater support: callers may pass (curLead) => patch to avoid stale closures.
      const patch = typeof p === 'function' ? { ...(p(cur) || {}) } : { ...p };

      if (cur && patch.stage && patch.stage !== cur.stage) {
        const nowIso = new Date().toISOString();
        const baseNotes = patch.notes ? [...patch.notes] : [...(cur.notes || [])];
        if (patch.stage === "app_submitted" && !cur.submittedDate) {
          patch.submittedDate = nowIso;
          baseNotes.unshift({ ts: nowIso, type: "note", text: "\u{1F4E8} Stage advanced to App Submitted — UW clock started." });
        }
        if (patch.stage === "issued" && !cur.policyIssueDate) {
          patch.policyIssueDate = nowIso;
          baseNotes.unshift({ ts: nowIso, type: "note", text: "\u2705 Policy Issued." });
        }
        if (patch.stage === "appointment_set" && cur.stage !== "appointment_set") {
          queued.push({ type: "appointment", leadId: id });
        }
        patch.notes = baseNotes;
      }

      if (cur && patch.disposition) {
        const nowIsContact = CONTACT_DISPS.includes(patch.disposition);
        // v3.16 — fires on every live-answer disposition (each answered dial = 1 contact).
        // v3.36 — time-window dedup: suppress events fired within CONTACT_DEDUP_MS of the last
        //         contact event for this lead. Prevents double-click / React-batch duplicates
        //         and ensures future SMS triggers fire at most once per answered call.
        if (nowIsContact) {
          const _now = Date.now();
          const _last = _contactDedup.get(id) || 0;
          if (_now - _last > CONTACT_DEDUP_MS) {
            _contactDedup.set(id, _now);
            queued.push({ type: "contact", leadId: id });
          }
        }
        // v3.18 — auto-pause sequence on terminal/booked dispositions
        const seqPatch = seqPatchForDisposition(patch.disposition);
        if (seqPatch && Object.keys(seqPatch).length) {
          Object.assign(patch, seqPatch);
        }
      }

      const next = prev.map(l => l.id === id ? { ...l, ...patch } : l);

      // Overwrite captures every invocation — StrictMode's second (real) run wins.
      sfUpdated = next.find(l => l.id === id) || null;
      sfLeads = next;
      if (queued.length) {
        const ts = new Date().toISOString();
        sfEvents = queued.map((q, i) => {
          const lead = next.find(l => l.id === q.leadId);
          return {
            id: `a_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
            ts, date: dayKey(ts), type: q.type,
            leadId: q.leadId, leadName: lead ? lead.name : null, source: "auto"
          };
        });
      } else {
        sfEvents = null;
      }

      return next;
    });

    // Side effects fire OUTSIDE the updater — exactly once regardless of StrictMode double-runs.
    if (sfUpdated) setTimeout(() => persistLeads(sfLeads, sfUpdated), 0);
    if (sfEvents)  setTimeout(() => appendActivity(sfEvents), 0);
  };

  const addNote = (id) => {
    if (!noteText.trim()) return;
    const lead = leads.find(l => l.id === id);
    // v3.36 — functional update: reads freshest notes from React state, not stale leads closure.
    upd(id, (freshestLead) => ({
      notes: [{
        ts: new Date().toISOString(),
        type: noteType,
        text: noteText.trim()
      }, ...(freshestLead.notes || [])],
      lastContact: new Date().toISOString().split("T")[0]
    }));
    // v2.3 — appointment notes also count as appointment activity
    if (noteType === "appointment") {
      const ts = new Date().toISOString();
      const ev = {
        id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ts,
        date: dayKey(ts),
        type: "appointment",
        leadId: id,
        leadName: lead ? lead.name : null,
        source: "auto"
      };
      appendActivity([ev]); // v3.13 — functional updater
      sbAppendActivity(ev).catch(() => {});
    }
    setNoteText("");
  };

  // ── AUTO-LOG DIALS ────────────────────────────────────────────────────────────────
  const logDial = (id) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    upd(id, {
      notes: [{
        ts: new Date().toISOString(),
        type: "call",
        text: "Outbound Dial (Click-to-Call)"
      }, ...(lead.notes || [])],
      lastContact: new Date().toISOString().split("T")[0]
    });
    // v2.3 — log dial activity
    const ts = new Date().toISOString();
    const ev = {
      id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ts,
      date: dayKey(ts),
      type: "dial",
      leadId: id,
      leadName: lead.name,
      source: "auto"
    };
    appendActivity([ev]); // v3.13 — functional updater
    sbAppendActivity(ev).catch(() => {});
  };

  const lockCB = (id) => {
    if (!cbDate) return;
    const lead = leads.find(l => l.id === id);
    const stageNow = lead?.stage || "new";
    const advanceStage = ["new"].includes(stageNow) ? "contacted" : stageNow;
    upd(id, {
      nextCallback: cbTime ? `${cbDate}T${cbTime}` : cbDate,
      disposition: "callback",
      stage: advanceStage
    });
    setCbDate("");
    setCbTime("");
  };

  const deleteLead = (id) => {
    const lead = leads.find(l => l.id === id);
    if (!window.confirm(`Permanently delete ${lead?.name || "this lead"}?\n\nThis cannot be undone.`)) return;
    const next = leads.filter(l => l.id !== id);
    saveLeads(next);
    sbDeleteLead(id);
    // v3.14 — write tombstone so this lead can't ghost-walk back from Supabase on next hydration
    try {
      const raw = localStorage.getItem('metka-deleted-ids-v1');
      const map = raw ? JSON.parse(raw) : {};
      map[id] = Date.now();
      localStorage.setItem('metka-deleted-ids-v1', JSON.stringify(map));
    } catch {}
    setOpenId(null);
    setView(prevView || "contacts");
  };

  const addLead = () => {
    if (!newL.name || !newL.phone) return;
    const dupeRaw = newL.phone.replace(/\D/g, "");
    const existing = leads.find(l => l.phone.replace(/\D/g, "") === dupeRaw);
    if (existing) {
      setDupeLead(existing);
      return;
    }
    setDupeLead(null);
    const rawL = {
      ...newL,
      id: `u${Date.now()}`,
      stage: "new",
      disposition: "not_called",
      lastContact: null,
      nextCallback: null,
      notes: [],
      firstName: newL.name.split(" ")[0] || "",
            lastName: newL.name.split(" ").slice(1).join(" ") || ""
    };
    const l = { ...backfillLead(rawL), slot: assignSlot(rawL), ...initSequence(rawL) }; // v3.18 + phase + seq fields
    saveLeads([l, ...leads]);
    setNewL({ name: "", phone: "", state: "OK", bucket: "A", leadType: "Mortgage Protection", hobby: "" });
    setAddForm(false);
    setOpenId(l.id);
  };

  return {
    upd,
    addNote,
    logDial,
    lockCB,
    deleteLead,
    addLead,
  };
};
