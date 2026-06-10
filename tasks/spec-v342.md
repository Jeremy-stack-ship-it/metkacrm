# v3.42 Build Spec — Phase/Email Indicator in Dialer + Appointment Held Metric
Created: 2026-05-29
Status: READY TO BUILD

---

## BUILD 1: Phase + Email Cycle Indicator in DialView

### What it does
While you're dialing a lead, a compact info strip shows:
- Current phase and next scheduled dial date
- Sequence step and next email due date
- Whether sequence is active, paused, or exhausted

You never have to leave the dialer to know where a lead stands in the system.

### Where it lives
Inside `DialView.jsx` — in the center panel (the lead detail / disposition area), just below the lead's name/phone header, above the disposition buttons. One row, always visible during a dial session.

### Current state
DialView receives `open` (the current lead object) which already has all phase and sequence fields: `phase`, `next_dial`, `seqTrack`, `seqStep`, `seqPaused`, `seqExitReason`, `seqStartDate`. The data is there — it's just not surfaced.

### What to display

```
[P1 · Next dial Jun 2]    [Step 2/8 · Email Jun 3]    [⚡ Active]
```

Three pills in a row:

**Pill 1 — Phase:**
- `phase` label (P1/P2/P3/M2/EXIT) + next_dial date formatted as "Next dial [Mon Day]"
- Color: blue=P1, purple=P2, amber=P3, slate=M2, red=EXIT
- If `next_dial` is null: "No schedule"
- If `next_dial` is today or past: "Due today" in green

**Pill 2 — Sequence:**
- "Step [seqStep]/[trackLength] · Email [next touch date]"
- Use `getNextTouchDate(lead)` from sequenceEngine.js for the date
- If no email step due (dial_reminder only): "Step [N]/[total] · Dial reminder"
- If seqPaused: show exit reason instead ("📅 Booked" / "⏸ Paused" / etc.)
- If no seqTrack: "Not enrolled"

**Pill 3 — Status badge:**
- Active sequence + email due today: "🔥 Email today"
- Active sequence: "⚡ Active"
- Paused: "⏸ Paused"
- Exhausted: "📬 Exhausted"
- Not enrolled: "—"

### Files to touch
- `src/components/DialView.jsx` — add indicator strip in center panel
- Import `getNextTouchDate`, `getTrackLength` from `../lib/sequenceEngine.js`
- Import `PHASE_DEFS` from `../lib/phaseEngine.js`
- NO changes to data model, no new state

### What does NOT change
- All existing disposition buttons, callback flow, script panel — untouched
- DialRightPanel — untouched
- DialQueuePanel — untouched

---

## BUILD 2: Appointment Held — Set Rate Metric

### What it does
When an appointment is held (you ran a Household Protection Audit), you click one button in the dialer. This fires an `audit_ran` activity event, which feeds the Set Rate metric (appointments attended ÷ scheduled) on the dashboard.

### Current state
- `weekAuditsRan` is commented out — was always 0 because no `audit_ran` event ever fires
- `showRate` was removed (replaced with `apptRate` in v3.40)
- The data model supports `audit_ran` event type — it just needs a trigger

### The button
In `DialView.jsx`, when a lead has `disposition === 'appointment_booked'`, show an **"✅ Audit Held"** button in the appointment section. Clicking it:
1. Fires `logActivity('audit_ran', open.id, 'manual')` — writes to activity log
2. Calls `upd(open.id, (fresh) => ({ disposition: 'follow_up_needed', ... }))` — or a new `no_sale` disposition depending on outcome (Jeremy decides flow)
3. Logs a note: "✅ Household Protection Audit held"

### Dashboard restoration
Once `audit_ran` events exist:
- Uncomment `weekAuditsRan` and `lastWeekAuditsRan` in DashboardTab.jsx
- Restore `showRate = pct(weekAuditsRan, weekAppts)` as "Set Rate"
- Rename current "Appt Rate" → keep as-is (contacts → appointments, different metric)

### Metric definitions after this build
| Metric | Formula | Meaning |
|--------|---------|---------|
| Contact Rate | contacts ÷ dials | How often you reach someone |
| Appt Rate | appointments ÷ contacts | How often a contact books |
| Set Rate | audits held ÷ appointments booked | How often they show up |
| Close Rate | submissions ÷ contacts | How often a contact becomes an app |

### Files to touch
- `src/components/DialView.jsx` — add "Audit Held" button (conditional on appointment_booked disposition)
- `src/components/DashboardTab.jsx` — uncomment weekAuditsRan, restore Set Rate KpiCard
- `src/lib/activityLog.js` — add `audit_ran` to `ACTIVITY_TYPES` array (for activity dashboard display)

### Confirmed: 2026-05-29
After "Audit Held" fires → disposition = `no_sale`.
Also requires: new `no_sale` sequence track (SMS + email) for leads who sat but didn't buy.
Track content TBD — Jeremy to provide messaging angle or approve generated copy.

---

## Build order
1. Build 1 (phase indicator) — pure UI, zero data model risk, high daily value
2. Build 2 (audit held) — small but needs Jeremy's answer on post-held disposition before building

## Confirmation needed
- Build 2 only: after clicking "Audit Held", what happens to the lead's disposition?
