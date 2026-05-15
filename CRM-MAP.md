# Metka Field Ops CRM — Master Map
**File:** `metka-crm/src/App.jsx` (~3,174 lines) + component files in `src/components/`
**Live:** app.metkasolutions.com | **Local:** `cd metka-crm && npm run dev`

---

## SIDEBAR NAV — 10 Views

| Icon | Label | view ID | What it is |
|------|-------|---------|------------|
| 🏠 | DASH | `dashboard` | KPI overview, pipeline summary, quick-start dial session |
| ⚡ | TODAY | `today` | Today's dial block; becomes the QUEUE when session is active |
| 📅 | CB | `callbacks` | All leads with overdue or upcoming callbacks (`CallbackQueue` component) |
| 🎙 | DIAL | `powerdial` | **New 3-column power dial view** — queue list / lead + actions / script (built this session, separate from queue) |
| 🎯 | ACT | `activity` | Activity dashboard — dials/contacts/appts vs goals, 7-day chart |
| 📇 | DATA | `contacts` | Full lead database, filters, import CSV (`ContactsView` component) |
| 📊 | PIPE | `pipeline` | Kanban-style pipeline by stage (`PipelineView` component) |
| 📝 | SCRIPT | `scripts` | Script library editor (`ScriptsView` component) |
| 💬 | SMS | `templates` | SMS/text templates (`TemplatesView` component) |
| ⚙️ | SET | `settings` | Twilio, Calendly, financial config, backup/restore (`SettingsView` component) |

---

## THE QUEUE / LIVE DIAL FLOW (Most important)

When a session is active, `view="today"` becomes the queue view. Layout:

```
LEFT PANEL (queue list)          RIGHT PANEL (lead detail)
─────────────────────────        ─────────────────────────────────────────
Session: 1/17 [progress bar]     [Lead Name]  [Phone]  [TCPA safe/unsafe]
[Pause] [Stop] [Re-sort]         [Skip →]  [HOT]  [Lead Type]
                                 [Received date] [email] [Lead Sheet →]
Lead 1 — Linda Hinerman
Lead 2 — Sean Jones              TABS: [ LIVE ] [ Activity ] [ Messages ] [ Script ]
Lead 3 — Jacqueline Herrera
...                              → Tab content below
```

### LIVE Tab (the main dial tab)
**Left side of LIVE tab:** Interactive script with yellow/green token fields
**Right side of LIVE tab (sticky):**

```
┌─────────────────────────────┐
│ CALL RESULT                 │  ← Normal state
│ [📅 BOOK APPOINTMENT → CAL] │
│ [📆 Add to Google Calendar] │  ← Shows when appointment_booked
│ [No Answer] [VM Left] [CB]  │
│ [Not Interested] [DNC] [HU] │
│ ─────────────────────────── │
│ [No Show] [Follow-Up] [W]   │  ← Only if stage = appointment_set+
└─────────────────────────────┘

┌─────────────────────────────┐
│ 📅 APPOINTMENT CHECK-IN     │  ← Gate state (v3.7)
│ Did [Name] show on [date]?  │  Appears when: disposition=appointment_booked
│                             │  AND nextCallback is in the past
│ [✅ Showed — They Made It]  │  AND apptConfirmed != true
│ [❌ No-Show — They Ghosted] │
│ [🔄 Rescheduled — New Time] │  → opens date/time picker inline
└─────────────────────────────┘
```

**Below the action panel:**
- FUNNEL STAGE tracker (New Lead → Contacted → Appt Booked → Follow-Up → App Submitted → Underwriting → Issue Paid)
- SET CALLBACK (date/time input + Set Callback button)
- HEALTH PROFILE (collapsible — age, height, weight, DOB, tobacco, medications)
- LOG ACTIVITY (Call / Appt / Note tabs + text area)

### Activity Tab
- Full CALL DISPOSITION section (same Calendly button + disposition grid)
- UNDERWRITING CHECKLIST (if stage = app_submitted+)
- Full activity log

### Messages Tab
- SMS template selector + send log

### Script Tab
- Full script panel (read-only reference)

---

## LEAD DATA MODEL

```javascript
{
  id, name, firstName, lastName,
  phone, email, state, city, age,
  bucket,        // "A" | "B" | "C"
  stage,         // see FUNNEL STAGES below
  disposition,   // see DISPOSITIONS below
  leadType,      // "Mortgage Protection" | "General Life" | etc.
  loanAmount,
  nextCallback,  // ISO datetime "2026-04-22T10:00"
  lastContact,   // date string
  notes,         // [{ts, type: "call"|"appointment"|"note", text}]
  apptConfirmed, // boolean — v3.7: true after show/noshow confirmed
  tobacco, medications, height, weight, dob,
  pdfUrl,
  pendingReqs,   // UW checklist items
  submittedDate, // for UW stuck timer
}
```

### FUNNEL STAGES (in order)
`new` → `contacted` → `appointment_set` → `follow_up` → `app_submitted` → `underwriting` → `issued` → `delivered`

### DISPOSITIONS
| ID | Label | Color |
|----|-------|-------|
| `not_called` | Not Called | gray |
| `no_answer` | No Answer | slate |
| `vm_left` | VM Left | blue |
| `callback` | Callback Set | sky |
| `hung_up` | Hung Up | red |
| `not_interested` | Not Interested | gray |
| `dnc` | DNC | dark red |
| `appointment_booked` | Appt Booked | purple |
| `no_show` | No Show | amber |
| `follow_up_needed` | Follow-Up Needed | indigo |
| `withdrawn` | Withdrawn | gray |
| `chargeback` | Chargeback | dark red |

---

## COMPONENT FILES

| File | What it owns |
|------|-------------|
| `App.jsx` | Everything — all views, state, logic. ~3,174 lines |
| `components/ContactsView.jsx` | DATA view — filters, table, queue mode start |
| `components/ContactDetail.jsx` | Standalone contact detail page (not the queue inline version) |
| `components/PipelineView.jsx` | PIPE view — kanban cards |
| `components/ScriptsView.jsx` | SCRIPT view — script library editor |
| `components/TemplatesView.jsx` | SMS view — template CRUD |
| `components/SettingsView.jsx` | SET view — all config |
| `components/CallbackQueue.jsx` | CB view — overdue/upcoming callbacks |
| `components/CallBar.jsx` | Floating call control bar (Twilio) |
| `constants.js` | DISPS, STAGES, BC, BL, NC, STATE_TZ, helpers |

---

## KEY FUNCTIONS (all in App.jsx)

| Function | What it does |
|----------|-------------|
| `upd(id, patch)` | Update a lead field and save |
| `handleDisposition(dispId)` | Set disposition, auto-advance stage, schedule follow-up |
| `lockCB(id)` | Save callback date/time to lead |
| `addNote(id)` | Append note from noteText state |
| `logActivity(type, id, src)` | Append to activity log (dials/contacts/appts) |
| `dialLead(lead)` | Trigger dial (tel: link or Twilio) |
| `openCalendlyPopup(lead, url, setter)` | Launch Calendly booking popup |
| `renderLiveTokens(scriptText, lead)` | Render script with yellow/green inline inputs |
| `autoFollowUp(dispId)` | Return next callback datetime based on disposition |
| `refreshQueueOrder()` | Re-sort queue by priority |

---

## HOW TO COMMUNICATE CHANGES

Use this format when requesting a change:

> **View:** LIVE tab  
> **Section:** CALL RESULT block (right side)  
> **Change:** [what you want]

> **View:** Queue left panel  
> **Section:** Lead row  
> **Change:** [what you want]

> **Function:** `handleDisposition`  
> **Change:** [what you want]

> **Component:** `ContactsView.jsx`  
> **Section:** filter bar  
> **Change:** [what you want]

---

## VERSION HISTORY
- v1.0 — Initial build
- v2.2 — UW Tracker (pendingReqs checklist)
- v2.3 — Activity Tracker (dials/contacts/appts log, daily goals)
- v3.4 — Auto follow-up scheduler by disposition
- v3.6 — Delete lead, code cleanup, .gitignore
- v3.7 — Power Dial view (🎙 DIAL), Appointment Check-In gate (LIVE tab), Google Calendar deep link
