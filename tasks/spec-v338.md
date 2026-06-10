# v3.38 Build Spec — Expandable Dialer Panel + Disposition Automation
Last updated: 2026-05-29

## Mission
Make the Phase Engine the star of the show. Two builds:
1. Expandable dialer right panel (goal: never lose your place in a script)
2. Disposition → auto-scheduling triggers (goal: you never think about when to follow up)

---

## BUILD 1: Expandable Dialer Panel

### What it does
Toggle that collapses the left queue panel and gives the right panel (scripts, disposition, lead card) full screen width. One button, one click, remembers your preference.

### Current layout (DialView.jsx line 80)
```
[DialQueuePanel fixed] | [flex:1 → DialRightPanel]
```

### Target layout
```
Standard:   [DialQueuePanel] | [DialRightPanel]
Expanded:   [DialRightPanel — full width]
```

### Implementation

**State** (DialView.jsx, add alongside existing local state ~line 44):
```js
const [panelExpanded, setPanelExpanded] = useState(() => {
  try { return localStorage.getItem('metka-panel-expanded') === 'true'; } catch { return false; }
});
const togglePanel = () => {
  const next = !panelExpanded;
  setPanelExpanded(next);
  try { localStorage.setItem('metka-panel-expanded', String(next)); } catch {}
};
```

**DialQueuePanel wrapper** (DialView.jsx, outer flex container, line 80):
- When `panelExpanded`: wrap DialQueuePanel in `style={{ width:0, overflow:'hidden', flexShrink:0, transition:'width 0.25s ease' }}`
- When standard: `style={{ flexShrink:0 }}` (existing behavior, DialQueuePanel controls its own width)

**Toggle button** — pass `panelExpanded` + `togglePanel` as props to DialRightPanel.
Button lives in the top-right corner of DialRightPanel header bar.
Label: `panelExpanded ? "← Queue" : "⛶ Focus"` (or similar — confirm with Jeremy)

### Files touched
- `src/components/DialView.jsx` — add state, wrap DialQueuePanel, pass props
- `src/components/DialRightPanel.jsx` — accept props, render toggle button in header

### What does NOT change
- DialQueuePanel itself — no internal changes needed
- All existing props/logic — zero behavior change, purely layout

---

## BUILD 2: Disposition → Auto-Scheduling Triggers

### What it does
When you log a disposition, the system automatically schedules the next touch. You never open a calendar. You never set a callback manually for these three flows.

### Target dispositions

#### A. `follow_up_needed` — "I gotta think about it"
**Current behavior:** sets `stage: 'follow_up'`, no callback scheduled.
**New behavior:** sets `nextCallback` to +4 days from now. Adds note with the call-back date.

```js
const AUTO_CALLBACKS = {
  follow_up_needed: 96,   // 4 days in hours
  no_show:          24,   // 24 hours — recovery window
};
const autoHours = AUTO_CALLBACKS[dispId];
const autoCallbackPatch = autoHours
  ? { nextCallback: new Date(Date.now() + autoHours * 3_600_000).toISOString() }
  : {};
```

Note auto-added: `"🔄 Follow-Up — next call in 4 days ([date])"`

#### B. `no_show` — Missed appointment
**Current behavior:** sets `stage: 'contacted'`. Nothing else.
**New behavior:**
- Sets `nextCallback` to +24 hours from now
- Queues a no-show SMS to be sent via Twilio (when A2P/Twilio SMS is active)
- Adds note: `"❌ No-Show — SMS queued, recovery call in 24hrs"`

**SMS behavior:** Checks `useTwilioSms` flag (same gate as existing SMS sends). If SMS not yet active (A2P pending), logs a note indicating SMS was skipped but callback is still set. No silent failures.

SMS template (added to `SMS_SEQUENCES` or inline constant):
> "Hi [firstName], I noticed we missed our appointment today. I want to make sure your family is protected — I'll give you a call tomorrow. – Jeremy, Ministry of Protection"

#### C. Stage → `app_submitted` — UW check-in
**Trigger:** inside `upd()` in `leads.js`, existing `if (patch.stage === "app_submitted" && !cur.submittedDate)` block.
**New behavior:** sets `nextCallback` to +14 days from submission.
- ALWAYS sets `nextCallback` to +14 days — overrides any existing value
- Adds note: `"📋 UW Check-In scheduled — 14 days ([date])"`

```js
patch.nextCallback = new Date(Date.now() + 14 * 86_400_000).toISOString();
baseNotes.unshift({ ts: nowIso, type: "note", text: "📋 UW Check-In scheduled — 14 days" });
```

Same rule applies to 2A and 2B: if a callback is already set, replace it. The disposition always wins.

### Files touched
- `src/App.jsx` — `handleDisposition`: add `AUTO_CALLBACKS` map, `autoCallbackPatch`, no-show SMS trigger
- `src/lib/leads.js` — `upd()`: inside `app_submitted` stage block, conditional `nextCallback` + note
- `src/constants.js` — add no-show SMS template string (or inline in handleDisposition)
- `src/lib/sequenceEngine.js` — NO changes

### What does NOT change
- `follow_up_needed` stage mapping (`follow_up`) — unchanged
- `no_show` stage mapping (`contacted`) — unchanged
- Phase engine — `nextCallback` set here feeds `isDueToday` automatically, no other changes
- Manual callback flow — unchanged; auto only fires if dispId is in AUTO_CALLBACKS
- `app_submitted` auto-callback: skipped if `nextCallback` already exists on the lead

---

## Build order
1. Build 1 (expandable panel) — smaller, zero logic risk, instant UX win
2. Build 2A + 2B (follow_up_needed + no_show triggers) — additive, low blast radius
3. Build 2C (app_submitted UW check-in) — touches upd() in leads.js, verify carefully

## ✅ All confirmations received — READY TO BUILD
- Build 1: button labels confirmed ("⛶ Focus" / "← Queue")
- 2A: 4 days (96h) ✓
- 2B: SMS on no-show + 24h callback ✓ (SMS gated on A2P/Twilio active)
- 2C: 14 days, does not override existing nextCallback ✓

---

## Out of scope for v3.38
- Zustand / React Query refactor — not needed at current scale
- Supabase RPC for Phase Engine — adds network dependency to dialer, worse for field use
- Database-driven DISPS/STAGES — complexity without benefit for single-user tool
