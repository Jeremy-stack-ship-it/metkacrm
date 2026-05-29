# Changelog — Metka Field Ops CRM

All notable changes to this project are documented here. Format: [Date] v[Version] — [Theme]

v3.21 — Sequence Engine Reporting: sequence_runs Supabase table, process-sequence edge function writes cron run summary on each execution, sbLoadSeqStats added to supabaseSync.js, seqStats state wired through App.jsx.
v3.22 — Nav cleanup + SEQ consolidation: TODAY removed from nav, ACT→ACC, DATA→LEADS, RUNS removed from nav. SequenceRunsTab embedded as 🤖 Engine sub-tab inside SequenceTab. 📞 Due Today default sub-tab. TODAY'S SEQUENCE DIALS panel removed from Dashboard.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

— App.jsx Refactor Sprint (Session — May 23, 2026)
Goal: Reduce App.jsx from 1,345 lines toward a maintainable ceiling by extracting stateful logic into custom hooks. Zero functional changes — all behavior identical.
Commits shipped:
5dd65cf — Extract useSettingsConfig (src/lib/useSettingsConfig.js)
Centralizes all Settings panel state: Financial, Gmail, SeqEngine, Twilio, Callback Presets, Calendly. Uses lazy useState initializers so localStorage is read exactly once on mount — eliminates a separate load useEffect. Removes ~46 lines from App.jsx.
3a4bcb7 — Extract useSupabaseHydration (src/lib/useSupabaseHydration.js)
Pulls the entire Supabase cloud-sync block out of the startup useEffect: tombstone prune (60-day TTL), per-lead _ts merge, remote-empty seed, activity repair. Removes ~80 lines from App.jsx.
3bb4a34 — Hoist inline lambdas as named useCallbacks
handleTodayDispose and startDialSession were anonymous arrow functions passed as JSX props — React recreated them every render. Hoisted both as stable useCallback refs. DashboardTab and TodaysBlock now receive named callbacks. Deferred AppRouter extraction until React Context is available (60+ props make a plain lift pointless).
626ab18 — Extract useImportHandlers + remove dead state (src/lib/useImportHandlers.js)
Owns all CSV import/field-mapping/backup state and handlers (handleFile, confirmFieldMapping, confirmImport, restoreBackup). savedMapping lazy-loaded inside the hook via useState(loadSavedMapping). Dead state removed: healthOpen, commsCache, commsLoading (declared, never used). Removes ~77 lines from App.jsx.
Net result: App.jsx 1,345 → 1,143 lines (−202 lines, −15%). Build clean at 158 modules.
Pending: Tailwind install (dedicated session), mobile layout pass, React Context (prerequisite for AppRouter extraction).

VERSION: v3.18 | DATE: May 22, 2026 | SESSION: Sequence Engine UI + Infrastructure

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CHANGE: Sequence Engine — core logic + SMS/email infrastructure
FILE: src/lib/sequenceEngine.js (new), src/lib/sequenceTemplates.js (new)
WHAT: Full sequence automation engine built.
  - Three tracks: new (8 steps), re-engage (4 steps), ghost (2 steps)
  - Exports: getSequenceStatus, getSequenceBadgeColor, getNextTouchDate,
    pauseSequence, resumeSequence, advanceSequence, getTodayCallList,
    isSeqDueToday, initSequence
  - sequenceTemplates.js: all SMS + email copy per track and lead type
REVERT: Remove both files, remove seq field imports from ContactDetail/Dashboard.

────────────────────────────────────────────────────────

CHANGE: Sequence control panel — ContactDetail.jsx UW card
FILE: src/components/ContactDetail.jsx (lines 342–500)
WHAT: Full sequence control panel injected above the Underwriting card.
  - Status badge (red/amber/green/blue based on state)
  - Track + Step display (New Lead / Re-Engage / Ghost)
  - Next touch date display with pause-aware messaging
  - Pause / Resume / Skip buttons
  - Change Track buttons (New / Re-Engage / Ghost) — resets step + startDate
  - Exit Sequence dropdown (Not Interested / DNC / Sold / Manual Hold)
  - Re-Enter Sequence button when exited
  - Panel background tints: yellow when paused, red-tint when overdue
REVERT: Remove the (() => { ... })() IIFE block from ContactDetail.jsx (lines 341–489).

────────────────────────────────────────────────────────

CHANGE: Today's Sequence Dials panel — DashboardTab.jsx
FILE: src/components/DashboardTab.jsx (Today panel section)
WHAT: "Today's Sequence Dials" widget added to dashboard.
  - Pulls getTodayCallList() from sequenceEngine — leads due today
  - Each card shows name, phone, track badge, step number, next touch date
  - Color-coded borders (red = overdue, amber = due today, green = upcoming)
  - Empty state when no dials due
REVERT: Remove the Today's Sequence Dials section from DashboardTab.jsx.

────────────────────────────────────────────────────────

CHANGE: Supabase Edge Functions — SMS proxy + daily cron
FILE: supabase/functions/send-sms/index.ts (new),
      supabase/functions/process-sequence/index.ts (new),
      supabase/functions/send-sms/DEPLOY_INSTRUCTIONS.md (new)
WHAT: Backend sequence automation infrastructure.
  - send-sms: Twilio proxy Edge Function — credentials NEVER in frontend
  - process-sequence: daily cron job that evaluates seq fields + fires touches
  - Full deploy instructions in DEPLOY_INSTRUCTIONS.md
REVERT: Delete supabase/functions/send-sms/ and supabase/functions/process-sequence/

────────────────────────────────────────────────────────

CHANGE: Google Apps Script email web app
FILE: supabase/apps-script/Code.gs (new)
WHAT: Full Apps Script deployment for sequence email sends.
  - All email templates per track + lead type
  - Deployed as web app; URL stored in Settings → Sequence Engine
REVERT: Delete supabase/apps-script/Code.gs

────────────────────────────────────────────────────────

CHANGE: Truncation fixes — 6 files restored (OneDrive sync divergence)
FILE: src/components/ContactDetail.jsx, DashboardTab.jsx, ContactsView.jsx,
      SettingsView.jsx, src/lib/csvParser.js, src/lib/leads.js, src/App.jsx
WHAT: All files were truncated at bash mount layer due to OneDrive sync
      divergence. Restored via head + heredoc append. Added missing
      export default MetkaCRM to App.jsx.
REVERT: N/A — restores correct content.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSION: v3.13 | DATE: May 19–20, 2026 | SESSION: Constant Contact OAuth Integration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CHANGE: Constant Contact OAuth2 integration — full build
FILE: src/lib/ccIntegration.js (new file, v1.2), supabase/functions/cc-token/index.ts (new), .env (added CC vars)
WHAT: Complete CC integration built from scratch. Settings tab now shows "Connect Constant Contact" button.
  OAuth flow: ccAuthorize() → CC login page → redirect to /cc-callback → ccExchangeCode() → tokens stored.
  Once connected: list selector appears, "Sync Bucket A Leads" bulk pushes leads to CC contact list via /activities/contacts.

ARCHITECTURE — Edge Function Proxy:
  CC's Okta OAuth server rejects browser token requests (Origin header triggers PKCE enforcement).
  Solution: Supabase Edge Function (cc-token) acts as server-to-server proxy.
  Browser sends auth code → Edge Function uses Basic auth (clientId:clientSecret) → CC returns tokens → passed back to browser.
  No PKCE anywhere — not needed for confidential client app type.

KEY DISCOVERIES (hard-won, do not forget):
  - CC_CLIENT_ID  = UUID format: a69afa05-1c37-4db4-9db5-9dc4b06dcd75  (labeled "API Key (Client Id)" in CC portal)
  - CC_CLIENT_SECRET = short alphanumeric: mhOHPXHQRl75w48NAKSWMg
  - These were backwards in earlier attempts — UUID is always the client_id
  - Real Okta auth server ID: aus1lm3ry9mF7x2Ja0h8 (discovered by watching CC redirect URL)
  - Authorize URL: https://authz.constantcontact.com/oauth2/default/v1/authorize  (this is correct as-is)
  - Token URL (in Edge Function): https://identity.constantcontact.com/oauth2/aus1lm3ry9mF7x2Ja0h8/v1/token
  - Scope: contact_data campaign_data
  - PKCE must NOT be added to authorize URL — CC confidential clients reject it with 400

SUPABASE PROJECT: brskbcdaefmkcgctlhlb
EDGE FUNCTION: cc-token (deployed v3)
SECRETS SET IN SUPABASE DASHBOARD:
  CC_CLIENT_ID=a69afa05-1c37-4db4-9db5-9dc4b06dcd75
  CC_CLIENT_SECRET=mhOHPXHQRl75w48NAKSWMg

ENV VARS ADDED (.env — do not commit):
  VITE_CC_CLIENT_ID=a69afa05-1c37-4db4-9db5-9dc4b06dcd75
  VITE_CC_CLIENT_SECRET=mhOHPXHQRl75w48NAKSWMg
  VITE_CC_REDIRECT_URI=http://localhost:5173/cc-callback
  VITE_CC_TOKEN_PROXY_URL=https://brskbcdaefmkcgctlhlb.supabase.co/functions/v1/cc-token

COMMITS: c2caf94 (integration build), d4c0ce2 (cleanup — removed PKCE remnants, restored both scopes)
STATUS: CONFIRMED WORKING — Jeremy: "it is connected great workl"

REVERT: Remove ccIntegration.js import from App.jsx. Remove /cc-callback route handler.
Remove Settings CC card (Connect button + list selector + Sync button). Delete supabase/functions/cc-token/.
Remove VITE_CC_* vars from .env. Delete Supabase secret CC_CLIENT_ID and CC_CLIENT_SECRET.

────────────────────────────────────────────────────────

CHANGE: Update Last Updated header
FILE: CRM Change Log (this doc)
WHAT: Updated "Last Updated" from May 6, 2026 → May 20, 2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
v3.13 — Security Hardening (May 19, 2026)
Moved Supabase credentials and CRM password to .env (removed from source). Removed window.supabase and window.LZString globals. Added CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy headers. Enabled Supabase RLS on leads and activity tables.



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
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSION: v3.12 | DATE: May 18, 2026 | SESSION: Dial Flow + Calendly Fixes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
- App.jsx line 74: Removed duplicate `applyPhaseTransition` import (already imported from TodaysBlock on line 56). Now imports only unique functions: `backfillLead, phaseFromBucket`

### Fixed
- Resolved esbuild parser error on duplicate identifier in phaseEngine.js imports
- Production build now completes successfully (131 modules transformed, bundle size 770.54 kB gzip)

### Dependencies
- All lib/ modules use pure functions and explicit dependency injection
- No new npm packages added; existing stack (React, Supabase, LZ-String) unchanged

### Notes
- Full backward compatibility: v3.5 activity schema with v1.0 legacy blob fallback
- App.jsx now 30% smaller, focused on React component lifecycle
- Original v2.3 → v3.5 algorithms fully preserved in extracted modules
- v3.6 build verified: `npm run build` succeeds with no parser or runtime errors

---

## [2026-05-01] v2.0.0 — Ministry Lead Operating System

### Added
- TODAY block: Structured 30-dial daily work engine with live timer and priority sorting
- Phase Lifecycle Engine: Auto-calculated 17-point forward schedule per phase (P1–P3, M2, EXIT)
- SMS modal: 4 Ministry-voice templates with STOP compliance
- Phase summary: Live lead counts by phase in Settings
- Dashboard: 4 KPI cards (Contact Rate, Show Rate, Close Rate, Week Dials)
- Financial Tracker: Weekly overhead vs. commission tracking
- Ghost Protocol messaging for non-responsive leads
- Click-to-dial via tel: links with auto-logging
- Activity log with dial counter and goal tracking

### Fixed
- vite.config.js: Added .jsx/.js loader for Windows esbuild compatibility

---

## [2026-04-01] v1.0.0 — Initial Build

### Added
- Single-file React CRM with Supabase cloud sync + localStorage dual-write
- Lead queue with stage/disposition tracking
- Activity log with dial counter
- Settings: Supabase config, CSV import/export, manual lead entry
- 2,440 leads pre-loaded across Bucket A (Hot), B (Warm), C (Cold)

---

## [2026-05-14] v3.6.1 — Power Dialer + Audit Fixes

### Added
- **Power Dialer engine** moved from TodaysBlock → DialView (18s attempt 1, 30s attempt 2, auto-hangup)
- **`fireDisp()` wrapper** in DialView: disposition buttons now advance PD to next lead when answered
- **GitHub repository**: https://github.com/Jeremy-stack-ship-it/metkacrm (version control live)

### Changed
- TodaysBlock stripped to read-only planning view — all execution machinery removed
- `TOKEN_FIELDS`, `renderLiveTokens`, `ATTEMPT1_SEC`, `ATTEMPT2_SEC` hoisted to module scope (no per-render redefinition)
- `saveLeads` + `saveActivity` wrapped in `useCallback([])` — stable references
- `makeLeadManager` + `makeActivityManager` wrapped in `useMemo` — downstream components no longer re-render on unrelated state changes
- `todayLeads` moved to `useMemo` in App.jsx (was inline sort on every render)
- Removed Bucket A→B→C and Name A–Z sort options from DialView (not needed in phase-engine workflow)
- Deleted 3 dead source files: `src/TodaysBlock.jsx`, `src/DashboardTab.jsx`, `src/App.jsx.bak`

### Fixed
- `filteredContacts` useMemo missing 3 deps (`exclBucket`, `exclStage`, `exclDisp`)
- Note history React keys using index → now `n.ts || n.id || i` (prevents full re-render on prepend)
- Templates destructuring `[name, text]` → `[key, tpl]` with `tpl.name`/`tpl.text` (was producing `[object Object]`)
- AppHeader null guard: `activityStats?.today` safe default prevents crash before Supabase reconciles
- PD advance-after-disposition: answered calls now auto-advance instead of freezing

### Build
- `npm run build` ✅ 0 errors — 144 modules, 775.68 kB (207.09 kB gzip)

---

**Last Updated**: 2026-05-14
**Current Version**: v3.6.1
**Status**: ✅ Production ready. Power Dialer functional end-to-end. GitHub live.