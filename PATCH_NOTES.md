# Metka Field Ops CRM — Patch Notes

---

## v3.6 — Modular Architecture Refactor (May 13, 2026)

### NEW: src/lib/ Extraction — Clean Separation of Concerns
Extracted core business logic from monolithic App.jsx into discrete, testable modules:

**src/lib/supabaseSync.js** — Cloud data layer
- Lead CRUD: `sbUpsertLead`, `sbUpsertAll`, `sbDeleteLead`, `sbLoadAll`
- Delete reconciliation: `sbReconcileDeletes` (orphan cleanup on startup)
- Activity log: `sbSaveActivity`, `sbAppendActivity`, `sbLoadActivity`
- Pagination: 1000-row batching to bypass PostgREST caps
- Fallback: Activity schema v3.5 (individual event rows) + v1.0 legacy blob fallback

**src/lib/phaseEngine.js** — Phase lifecycle + dial scheduling
- `phaseFromBucket`: Bucket→Phase assignment (A→P1, B→P2, C→P3/M2)
- `buildSchedule`: Generates 17 future dial dates per phase cadence
- `applyPhaseTransition`: Disposition→Phase logic (no_sale resets to P1, dnc→EXIT)
- `backfillLead`: Auto-assigns phase + schedule to new/imported leads
- `SMS_SEQUENCES`: Ministry-voice templates with STOP language
- Terminal condition detection: EXIT phase removal logic

**src/lib/activityLog.js** — Event logging + aggregation
- Constants: `DEFAULT_GOALS` (30 dials, 10 contacts, 3 appointments), `CONTACT_DISPS`, `ACTIVITY_TYPES`
- Time helpers: `dayKey()` (local YYYY-MM-DD), `lastNDays()`, `weekKeys()`, `monthKeys()`
- Aggregation: `aggregateActivity()` counts dials/contacts/appointments by day
- Goal visualization: `goalTone()` returns color codes for progress bars
- Factory: `makeActivityManager()` returns {undoLastActivity, logActivity}
- Queue utilities: `computeActivityQueue()`, `makeActivityEvent()` for disposition/stage triggers
- Append-only pattern: v3.5 uses individual Supabase rows per event (never rewrites history)

**src/lib/leads.js** — Lead CRUD with activity queuing
- Factory: `makeLeadManager()` returns bound mutations {upd, addNote, logDial, lockCB, deleteLead, addLead}
- `upd()`: Single-lead update with auto-stamping (submittedDate, policyIssueDate) and queued activity logging
- `addNote()`: Appends note to lead.notes and optionally fires appointment activity
- `logDial()`: Auto-logs click-to-call dial, updates lastContact
- `lockCB()`: Schedule callback with stage auto-advance (new→contacted)
- `deleteLead()`: Soft-delete with confirmation dialog
- `addLead()`: Create lead with dupe checking, phase backfill, firstName/lastName parsing

### REFACTOR: App.jsx Lines Reduced — COMPLETE
**Extraction Complete (May 13, 2026)**
- Removed inline activity logging constants (DEFAULT_GOALS, CONTACT_DISPS, ACTIVITY_TYPES, time helpers)
- Removed all 8 inline lead management functions (upd, addNote, logDial, lockCB, deleteLead, addLead)
- Added factory instantiation at lines 786–795:
  - `makeActivityManager(setActivity, leads, saveActivity)` → returns {undoLastActivity, logActivity}
  - `makeLeadManager(leads, activity, ...)` → returns {upd, addNote, logDial, lockCB, deleteLead, addLead}
- All imports verified: lines 73–76 + line 81 (supabase client)
- App.jsx now focuses on React component lifecycle and UI rendering
- No logic extraction has changed behavior — all original v2.3–v3.5 algorithms preserved

### FIXED: Duplicate Import Identifier (App.jsx Line 74)
**Error**: "Identifier 'buildSchedule' has already been declared" (May 13, 2026)
- **Root cause**: Line 74 attempted to import `applyPhaseTransition` from phaseEngine.js with alias, but this function was already imported from TodaysBlock (line 56). Dual imports of the same identifier created parser conflict.
- **Solution**: Removed problematic import alias. Line 74 now imports only unique functions:
  ```javascript
  import { backfillLead, phaseFromBucket } from './lib/phaseEngine.js';
  ```
- **Result**: `applyPhaseTransition` continues sourced from TodaysBlock (line 56); backfillLead and phaseFromBucket acquired from phaseEngine.js. No duplicate bindings.
- **Verification**: `npm run build` now succeeds. All 131 modules transform, production bundle generated (770.54 kB gzip).

### WHY THIS MATTERS
- **Testability**: Core logic now lives in pure functions with explicit dependencies
- **Reusability**: Phase engine, activity log, and lead mutations can be consumed by CLI, Zapier, or batch jobs
- **Maintainability**: 50-line functions in App.jsx are now 20-line focused operations in lib/
- **Performance**: Append-only activity logging (v3.5) no longer rewrites the entire log on every dial

---

## v2.0.0 — Ministry Lead Operating System (May 1, 2026)

### NEW: ⚡ TODAY Tab — Today's Block Dial Engine
The core of the new system. A structured 30-dial daily work block that tells you exactly who to call and in what order — no thinking required.

- **START/END BLOCK button** with live elapsed timer
- **Progress bar** tracking dials against your 30-dial daily target
- **Priority-sorted lead list** — highest urgency at the top, automatically
- **DIAL button** opens your phone app via click-to-dial (tel: link) and auto-logs the contact
- **Inline disposition** appears immediately after DIAL — log the outcome in one tap
- **50% recovery cap** — no_sale and no_show leads are capped at 15 of your 30 slots so they don't flood your block
- **SMS modal** with 4 pre-written Ministry-voice templates (see below)

### NEW: Phase Lifecycle Engine
Every lead is now assigned a phase with its own contact cadence. The engine auto-calculates all 17 future dial dates from the moment a lead enters the system.

| Phase | Window | Cadence | Total Dials |
|-------|--------|---------|-------------|
| P1 | Days 0–14 | Every other day | 7 |
| P2 | Days 15–29 | 2x/week | 5 |
| P3 | Days 31–59 | 1x/week | 5 |
| M2 | 60+ days aged | Reactivation | — |
| EXIT | Terminal | No further contact | — |

**Phase transitions on disposition:**
- `appointment_booked` → schedule freezes, lead removed from rotation
- `no_sale` / `no_show` → resets to P1 from today (full 7-call restart)
- `no_answer` / `vm_left` / `callback` → advances to next scheduled slot
- `dnc` / `not_interested` → EXIT, schedule wiped permanently

**Priority sort order inside Today's Block:**
no_sale (100) → no_show (90) → P1 (80) → P2 (70) → P3 (60) → M2 (50)

### NEW: SMS Modal — 4 Ministry-Voice Templates
Accessible from Today's Block after clicking DIAL. All messages include STOP opt-out language (A2P compliant).

1. **Initial Outreach** (Day 0) — First contact after lead submits form
2. **Verification** (Day 2) — Confirm they're the right person, build rapport
3. **Ghost Protocol** (Day 12) — "Wrapping up regional files / closing the household file" — forces a response
4. **Scheduling Ask** (any) — Direct booking push with Calendly link

Click a template → it auto-copies to your clipboard → tap "Open SMS" to launch your native messaging app.

### NEW: Phase System Settings Panel
In Settings → Phase Lifecycle Engine:

- **Activate Phase System** — One-click backfill of all 2,440 leads with their correct phase and forward schedule. Run this once.
- **Reset All Phases** — Wipes all phase data and reschedules from today. Use to restart the system.
- **Phase Summary bar** — Live count of leads in each phase (P1 / P2 / P3 / M2 / EXIT / Unphased)

### UPDATED: Disposition Handling (Queue View)
Logging a disposition from the lead detail view 