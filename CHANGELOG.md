# Changelog — Metka Field Ops CRM

All notable changes to this project are documented here. Format: [Date] v[Version] — [Theme]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSION: v3.14 | DATE: May 19, 2026 | SESSION: Security Hardening + PM Slot Fix
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CHANGE: Security — credentials to .env, remove window globals, CSP headers, Supabase RLS
FILES: metka-crm/.env (new), src/lib/supabaseSync.js, src/components/LoginGate.jsx,
  src/App.jsx, vite.config.js, index.html, rls-setup.sql (new)
WHAT: Full security audit and remediation.
  1. VITE_SUPABASE_URL, VITE_SUPABASE_KEY, VITE_CRM_PASSWORD moved to .env (env vars)
  2. window.supabase and window.LZString globals removed from App.jsx + supabaseSync.js
  3. CSP meta tag added to index.html (single-line, covers Supabase + Calendly + fonts)
  4. Security headers added to vite.config.js dev server (X-Frame-Options, nosniff, etc.)
  5. RLS policies generated (rls-setup.sql) — Jeremy ran in Supabase SQL Editor
BEFORE: Credentials in source code, window globals, no CSP, no RLS.
REVERT: Remove meta CSP tag from index.html, restore hardcoded keys in supabaseSync.js
  and LoginGate.jsx, restore window globals in App.jsx. RLS stays.
COMMIT: 02261be

────────────────────────────────────────────────────────

CHANGE: CSP widened to cover all Twilio Voice SDK endpoints
FILE: index.html (connect-src directive)
WHAT: Twilio Voice SDK + Functions hit *.twilio.com and *.twil.io subdomains.
  Original CSP only allowed api.twilio.com and voice.twilio.com — blocked token
  fetch from Twilio Function URL (.twil.io domain) and SDK WSS connections.
  Widened to: https://*.twilio.com wss://*.twilio.com https://*.twil.io
BEFORE: Browser calling failed silently — token fetch blocked by CSP.
REVERT: Narrow connect-src back to specific Twilio subdomains (not recommended).
COMMIT: ab97f41

────────────────────────────────────────────────────────

CHANGE: PM slot always shows 0 — removed next_dial time inference from assignSlot
FILE: src/lib/phaseEngine.js (assignSlot), src/lib/leads.js (addLead)
WHAT: Root cause: buildSchedule hardcodes 9 AM for all next_dial times, so the
  old time-based inference (hour < 12 → AM) always returned AM. assignSlot now
  uses ID hash only (hash % 2 === 0 ? AM : PM) for unslotted leads.
  addLead fixed to call assignSlot() instead of hardcoding slot:'AM'.
BEFORE: All new leads got slot:'AM'. PM count was permanently 0.
REVERT: Restore next_dial time inference block in assignSlot; restore slot:'AM'
  hardcode in addLead.
COMMIT: e6fd522

────────────────────────────────────────────────────────

CHANGE: Balance AM/PM button now rebalances ALL active leads, not just unscheduled
FILE: src/components/SettingsView.jsx (Balance AM/PM Slots button handler)
WHAT: Previous fix skipped leads with next_dial (i.e., everyone phase-scheduled),
  so existing leads with slot:'AM' stamped were never touched — PM stayed 0.
  Button now strips slot from ALL non-removed, non-EXIT leads and hash-assigns.
  Schedule dates, phases, and all other fields preserved — only slot changes.
BEFORE: Button redistributed 0 leads (all had next_dial). PM count unchanged.
REVERT: Restore if(l.next_dial) return l guard in the rebalanced map.
COMMIT: 2d4c0c9

────────────────────────────────────────────────────────

VERSION: v3.12 | DATE: May 18, 2026 | SESSION: Dial Flow + Calendly Fixes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CHANGE: Today Panel — two-block AM/PM session overview in Dial Queue
FILE: src/components/DialQueuePanel.jsx (Section 1.5 replacement)
WHAT: Replaced compact banner with full two-card Today Panel showing both
  AM and PM sessions side by side. Each card: slot label (⚡ AM/PM), time
  range, live lead count, callback count, and status button (▶ START /
  ⏹ STOP / — DONE — / — NEXT —). isPast computed from current time vs
  session end. Lead/callback counts filtered by slot from live queue.
BEFORE: Compact single-line Section 1.5 banner.
REVERT: Restore previous Section 1.5 banner block in DialQueuePanel.jsx.
COMMIT: b76bf53

────────────────────────────────────────────────────────

CHANGE: Calendly booking writes structured note to lead's notes array
FILE: src/App.jsx (Calendly postMessage listener, ~line 922)
WHAT: When Calendly fires calendly.event_scheduled, a formatted note is
  now appended to the lead's notes array:
  "📅 Calendly booked — [Event Name] · [Day, Mon D, H:MM AM/PM]"
  Note type is 'appointment' so it renders with 📅 Appt label in activity feed.
BEFORE: Calendly booking set disposition/stage/nextCallback but wrote no note.
REVERT: Remove newNote block and notes spread from the upd() call in the
  Calendly listener (~line 930).
COMMIT: 6e9a32c

────────────────────────────────────────────────────────

CHANGE: Add "Appt Booked" disposition button + fix PD auto-advance
FILE: src/components/DialView.jsx (secondaryDisps array, ~line 339)
      src/lib/usePowerDialer.js (KEEP_CALL_DISPS, line 21)
WHAT:
  - Added 📅 Appt Booked button as first item in secondary disposition row.
    Active state renders purple (#6d28d9). Uses activeColor pattern so
    each secondary button can have its own active color going forward.
  - Removed 'appointment_booked' from KEEP_CALL_DISPS in usePowerDialer.js.
    Previously it blocked PD auto-advance — leads with this disposition
    would not move to the next lead in the queue.
  - Removed dead code from DialView.jsx: KEEP_CALL_DISPS, ATTEMPT1_SEC,
    ATTEMPT2_SEC (all defined but never used — leftover from before PD
    logic was extracted to usePowerDialer.js).
NOTE: Calendly auto-booking (postMessage) only calls upd() — it does NOT
  call fireDisp(), so it does not disconnect or advance. The Appt Booked
  button is a manual trigger: call disconnects + PD advances only when
  the agent clicks it.
BEFORE: No Appt Booked button in disposition bar. appointment_booked in
  KEEP_CALL_DISPS blocked PD from moving to next lead.
REVERT: Remove appointment_booked entry from secondaryDisps. Add
  'appointment_booked' back to KEEP_CALL_DISPS in usePowerDialer.js.
COMMIT: 2db7fcc

## [2026-05-13] v3.6 — Modular Architecture Refactor

### Added
- **src/lib/supabaseSync.js**: Cloud data layer (leads, activity, reconciliation, pagination)
- **src/lib/phaseEngine.js**: Phase lifecycle + forward scheduling (extracted previously)
- **src/lib/activityLog.js**: Event logging, aggregation, goal visualization
- **src/lib/leads.js**: Lead CRUD with activity queuing (upd, addNote, logDial, lockCB, deleteLead, addLead)
- **PATCH_NOTES.md**: Detailed feature and fix documentation
- **CHANGELOG.md**: This file — version tracking

### Changed
- Extracted core business logic from App.jsx to lib/ modules (no behavior change, pure refactor)
- Activity logging now uses append-only pattern (v3.5 schema: individual event rows, never rewrites)
- Lead creation and updates now centralized in makeLeadManager factory
- App.jsx line 74: Removed duplicate `applyP