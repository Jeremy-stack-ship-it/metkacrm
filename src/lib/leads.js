// ── LEAD MANAGEMENT (v2.3 → v3.5) ───────────────────────────────────
// Single lead operations: update, create, delete, notes with activity logging.
// All state-mutating operations handled through component callbacks for isolation.

import { sbUpsertLead, sbAppendActivity, sbDeleteLead } from './supabaseSync.js';
import { dayKey, CONTACT_DISPS, computeActivityQueue, makeActivityEvent } from './activityLog.js';
import { backfillLead } from './phaseEngine.js';

// ── LEAD MANAGEMENT FACTORY ──────────────────────────────────────────
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
  noteType
) => {
  // Single-lead update: local save (skip bulk push) then push just this row
  // v2.2 — auto-stamps submittedDate / policyIssueDate on stage transitions
  // v2.3 — auto-logs activity on disp→contact and stage→appointment_set transitions
  const upd = (id, p) => {
    const cur = leads.find(l => l.id === id);
    let patch = { ...p };

    // Track which activity events to fire AFTER state has been saved
    const queued = []; // [{type, leadId}]

    if (cur && patch.stage && patch.stage !== cur.stage) {
      const nowIso = new Date().toISOString();
      const baseNotes = patch.notes ? [...patch.notes] : [...(cur.notes || [])];
      if (patch.stage === "app_submitted" && !cur.submittedDate) {
        patch.submittedDate = nowIso;
        baseNotes.unshift({ ts: nowIso, type: "note", text: "📨 Stage advanced to App Submitted — UW clock started." });
      }
      if (patch.stage === "issued" && !cur.policyIssueDate) {
        patch.policyIssueDate = nowIso;
        baseNotes.unshift({ ts: nowIso, type: "note", text: "✅ Policy Issued." });
      }
      // v2.3: stage entering appointment_set = an appointment was set
      if (patch.stage === "appointment_set" && cur.stage !== "appointment_set") {
        queued.push({ type: "appointment", leadId: id });
      }
      patch.notes = baseNotes;
    }

    // v2.3: disposition transition INTO a real-conversation state = a contact
    if (cur && patch.disposition && patch.disposition !== cur.disposition) {
      const nowIsContact = CONTACT_DISPS.includes(patch.disposition);
      const wasContact = CONTACT_DISPS.includes(cur.disposition || "");
      if (nowIsContact && !wasContact) {
        queued.push({ type: "contact", leadId: id });
      }
    }

    const next = leads.map(l => l.id === id ? { ...l, ...patch } : l);
    saveLeads(next, { skipSupa: true });
    // v2.6 — push single updated lead to Supabase instantly
    const updated = next.find(l => l.id === id);
    if (updated) sbUpsertLead(updated);

    // v2.3 — fire queued activity events (after lead update so leadName resolves)
    if (queued.length) {
      const ts = new Date().toISOString();
      const evs = queued.map((q, i) => {
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
      });
      saveActivity([...evs, ...activity]);
    }
  };

  const addNote = (id) => {
    if (!noteText.trim()) return;
    const lead = leads.find(l => l.id === id);
    upd(id, {
      notes: [{
        ts: new Date().toISOString(),
        type: noteType,
        text: noteText.trim()
      }, ...(lead.notes || [])],
      lastContact: new Date().toISOString().split("T")[0]
    });
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
      saveActivity([ev, ...activity]);
      sbAppendActivity(ev).catch(() => {});
    }
    setNoteText("");
  };

  // ── AUTO-LOG DIALS ──────────────────────────────────────────────
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
    saveActivity([ev, ...activity]);
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
    const l = backfillLead(rawL); // v3.1 — assign phase + forward schedule on creation
    saveLeads([l, ...leads]);
    setNewL({ name: "", phone: "", state: "OK", bucket: "A", leadType: "Mortgage Protection" });
    setAddForm(false);
    setOpenId(l.id);
  };

  return {
    upd,
    addNote,
    logDial,
    lockCB,
    deleteLead,
    addLead
  };
};
