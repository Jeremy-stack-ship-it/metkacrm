# Changelog — Metka Field Ops CRM

All notable changes to this project are documented here. Format: [Date] v[Version] — [Theme]

[2026-06-20] v3.96 — White-label: all branding flows from src/config.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHY: To hand a clean, independent copy to another agent (Derick) and any future
  downline, every "Jeremy Metka", NPN, Calendly, hihello card, business name, and
  Twilio number is now read from ONE file (src/config.js BRAND) instead of being
  hardcoded across ~10 files. Jeremy's instance is byte-for-byte unchanged (config
  holds his current values).
FILES: NEW src/config.js (BRAND). Wired: SmsThread, App.jsx, ContactDetail, AIPanel,
  LoginGate, DashboardTab (5 R's), defaultScripts, seqSmsBodies, sequenceTemplates
  (27 email signatures), SettingsView (genericized placeholder).
WHAT:
  - Backtick templates -> ${BRAND.name} / ${BRAND.npn} / ${BRAND.business}.
  - Double/single-quoted strings -> " + BRAND.name + " concatenation.
  - SMS const CALENDLY/HIHELLO -> BRAND.calendly/BRAND.card. NUM_CHANGE number ->
    BRAND.phoneDisplay. ContactDetail calendly -> BRAND.calendly. LoginGate footer.
  - Supabase keys stay in .env (VITE_SUPABASE_*), one per agent.
  - Email/SMS Calendly + phone were already runtime-injected from Settings.
VERIFY: 0 'Jeremy Metka' left in src except config.js source; 0 residual hardcoded
  calendly/hihello/npn/number; vite build clean (4 checkpoints).
RUNBOOK: ../SETUP_WHITELABEL.md — full new-agent standup (Supabase, Twilio, config, run).
REVERT: git revert; or each agent's instance is just their own config.js + .env.[2026-06-20] v3.95 — Fix dialer Lead Data pane: Gender + coverage band show
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROBLEM: Dialer's read-only Lead Data pane showed blanks for RR leads. Field-name
  mismatch: pane read open.sex but RR stores open.gender; "Coverage" only rendered
  for numeric values but RR sends a text band ("$100,001 - $250,000").
FILE: src/components/DialView.jsx (left Lead Data pairs)
WHAT:
  - "Sex" -> "Gender", reads open.gender || open.sex.
  - Coverage now falls back to the raw requestedCoverage string (shows the band).
  - Added Employment row (open.employment) under Beneficiary.
NOTE: Beneficiary/Employment still blank on leads imported BEFORE the updated RR
  script is re-pasted — those values live only in the intake note until then.
TEST: vite build clean.
REVERT: restore ["Sex",open.sex]; restore the reqCoverageRange-only fallback; remove Employment row.[2026-06-20] v3.94 — Duplicates view + merge (DUPES nav)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEED: No way to see or resolve duplicate leads in-app; SQL deletes don't stick
  (app re-syncs local copies). In-app delete tombstones (LS metka-deleted-ids-v1),
  so it's the ONLY reliable way to kill a dupe permanently.
FILES: src/components/DuplicatesView.jsx (new), src/App.jsx (import+route+VALID x2),
  src/components/NavSidebar.jsx (DUPES nav item), src/lib/leads.js (deleteLead skipConfirm).
WHAT:
  - New 🔀 DUPES view (DATA nav group): groups leads by 10-digit phone; shows each
    group with the most-history lead marked KEEPER, RR badge, notes/disp/date.
  - Per lead: Open + Delete (Delete uses deleteLead -> tombstone -> sticks).
  - Per group: "🔗 Merge & keep [keeper]" — pulls the others' notes into the keeper,
    fills any blank keeper fields from them, then deletes the duplicates (one confirm).
  - leads.js deleteLead(id, skipConfirm) — merge deletes silently after its own confirm.
TEST: vite build clean.
REVERT: remove DuplicatesView + its import/route/VALID/nav entries; revert deleteLead sig.[2026-06-19] v3.93 — Manual appointment setter in lead view
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROBLEM: Lead view (ContactDetail) only offered "BOOK -> CALENDLY" — no way to
  set an appointment manually by date/time, even though the dialer has one.
FILE: src/components/ContactDetail.jsx (Disposition card)
WHAT: Added a datetime-local input + "📅 Set Manually" button under the Calendly
  button. Sets disposition=appointment_booked, stage=appointment_set,
  nextCallback=chosen time, apptConfirmed=false, and logs an appointment note.
  Mirrors the dialer's manual-appt flow (functional updater for fresh notes).
TEST: vite build clean.
REVERT: remove the apptTs state + the manual-appt React.createElement block.[2026-06-19] v3.92 — Fix: search clients by phone number (any format)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROBLEM: Contact search compared typed text against the stored phone literally.
  Numbers are stored "(405) 225-4455" but you type "4052254455" -> never matched.
FILE: src/App.jsx (filteredContacts search predicate)
WHAT: Strip non-digits from BOTH the query and l.phone before comparing
  (qDigits.length >= 3 guard avoids name-with-stray-digit noise). Name/email/city
  search unchanged. Now "4052254455", "405225", "(405) 225" all find the lead.
TEST: vite build clean.
REVERT: restore l.phone.includes(q).[2026-06-19] v3.91 — Surface lead fields: Gender, Zip, Req. Coverage, Beneficiary, Employment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHY: Razor Ridge data (gender/zip/coverage already in lead data; beneficiary/
  employment note-only) had no display field on the lead page, so it looked like
  it was missing — buried in the intake note.
FILES: src/components/ContactDetail.jsx, RazorRidge_LeadIntake.gs (workspace)
WHAT:
  - ContactDetail editable grid: added Gender, Zip, Req. Coverage, Beneficiary,
    Employment as proper editable fields (gender/zip/requestedCoverage were already
    populated — now visible; beneficiary/employment newly surfaced).
  - RazorRidge_LeadIntake.gs: now writes beneficiary + employment as structured
    fields (not just the note), so the new lead-page fields auto-fill on future
    RR imports. (Jeremy must re-paste the updated .gs.)
  - Campaign/Motivation stay in the intake note as context.
TEST: vite build clean.
REVERT: remove the 5 grid entries; remove beneficiary/employment from the .gs object.


[2026-06-17] v3.90 — Lead view uses the shared SMS panel (fixes missing templates)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROBLEM: The No-Answer rotation, 🔥 intro+card, and ⚠️ INTRO buttons only existed
  in DialView (shared SmsThread.jsx). The lead view (ContactDetail) had its OWN
  older inline panel (SmsThreadTab) that lacked all of them — so the INTRO/templates
  were missing when you opened a lead. Same split-brain as the sequence engine.
FILE: src/components/ContactDetail.jsx
WHAT:
  - cdTab 'sms' now renders the shared <SmsThread/> (open, sendSms, upd, height 560px)
    instead of the inline SmsThreadTab.
  - Verified SmsThread is a strict SUPERSET: same sequence-category template picker
    (cat1/2/3, SMS_SEQUENCES) + selfApply, PLUS No-Answer rotation, 🔥 intro+card,
    ⚠️ INTRO. Nothing lost; lead view gains everything.
  - Bonus: the v3.89 dashboard 💬 quick-text opens this tab, so it now lands on the
    full panel too.
ORPHAN: the old SmsThreadTab function in ContactDetail.jsx is now dead code — left
  in place to keep this change minimal; safe to delete in a later cleanup pass.
TEST: vite build clean.
REVERT: render SmsThreadTab again; remove the SmsThread import.


[2026-06-17] v3.89 — Dashboard: Newest Leads card + one-tap quick text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILES: src/components/DashboardTab.jsx, src/components/ContactDetail.jsx
WHAT:
  - New "🆕 Newest Leads" block in the Lead Intake card: 10 most recent leads by
    assignDate (newest first), each showing name + RR badge (source razor_ridge)
    + state + "Xh/Xd ago".
  - Tap the name → opens the full contact. Tap 💬 → opens the contact straight to
    the SMS tab (your 🔥 intro is one tap away). Manual send preserved.
  - ContactDetail: useEffect honors a localStorage 'metka-cd-tab'=sms signal to
    auto-open the SMS tab, then clears it.
TEST: vite build clean.
REVERT: remove the Newest Leads block in DashboardTab + the cd-tab useEffect.


[2026-06-17] v3.88 — 🔥 intro asks for best callback time
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE: src/components/SmsThread.jsx
WHAT: Added "What's the best time to reach you?" to the 🔥 intro cardMsg — a
  question invites a reply. Build clean.


[2026-06-17] v3.87 — 🔥 button = intro + living-benefits + business card
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE: Repurpose the 🔥 Card chip into a first-touch intro that leads with
  Living Benefits and drops the hihello business card. Built for Razor Ridge
  (and any) fresh leads.
FILE: src/components/SmsThread.jsx
WHAT:
  - New cardMsg: "Hey {first}, Jeremy Metka — got your request about life
    insurance with living benefits. Here's my card so you know who's calling:
    {hihello}. Reply STOP to opt out."
  - Removed the 48h email-opener gate (was: hidden unless opened email <48h).
    Now shows on ANY lead that hasn't texted STOP — so it works on brand-new
    leads who've never opened anything.
  - Still manual (fills composer, agent sends), still hidden for smsOptOut.
KEPT: the separate plain INTRO button (no card) left in place.
TEST: vite build clean.
RELATED: see NEXT_SESSION.md backlog — Razor Ridge email→CRM Apps Script + phone
  notification (not started).
REVERT: restore 48h gate + old coverage-options cardMsg.


[2026-06-17] v3.86 — No Answer → confirm-to-send text (per-person rotation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE: Clicking No Answer now offers to text the lead the next rotation message.
FILES: src/components/SmsThread.jsx, src/components/DialView.jsx
WHAT:
  - SmsThread.jsx: 5 NO_ANSWER_TEMPLATES rewritten (casual, name + purpose, no
    cheese, no premature closeout). Array now EXPORTED (single source of truth).
  - DialView.jsx: No Answer button → handleNoAnswerText():
      * picks template by per-lead naStep (0-4, wraps)
      * window.confirm shows the rendered text; OK = send + advance naStep,
        Cancel = no text. EITHER way the no_answer disposition is logged + PD advances.
      * opted-out (smsOptOut) or no-phone leads skip the prompt, just log no_answer.
  - Sends through existing sendSmsGuarded (STOP/opt-out block + landline handling).
ROTATION: per-person — naStep stored on the lead, so each family cycles through all
  5 across repeated no-answers (matches the ~30-dial-before-ghost cadence).
COMPLIANCE: manual confirm per send (agent-initiated, TCPA-safe). Does NOT touch the
  automated sequence engine or the (disabled) SMS cron.
TEST: node 4/4 (export, 5 templates, rotation wrap, firstName merge). vite build clean.
REVERT: restore old NO_ANSWER_TEMPLATES (un-export); revert DialView import+handler+onClick.


[2026-06-16] v3.85 — REVERT v3.83 call-path experiment (hangup regression)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE: Roll Twilio Device config back to known-good — calls were immediately
  hanging up on dial after v3.83 went live (commit 3687d12).
FILE: src/lib/useTwilioDevice.js
WHAT: Removed BOTH v3.83 call-path additions:
  - codecPreferences: ['opus','pcmu']
  - device.audio.setAudioConstraints({noiseSuppression,echoCancellation,autoGainControl})
  Device is back to `new Device(token, { logLevel: 1 })` — the exact config that
  ran clean through v3.73-3.79.
WHY: v3.83 made the ANC audioConstraints actually fire for the first time (it was
  silently dropped before the v3.83 fix) AND prioritized opus. Both are global
  call-setup changes and the only things that touched the dial path in that
  window. Isolating by reverting to known-good rather than guessing.
NOTE: v3.84 (sequence engine) does NOT touch calling — not implicated.
NEXT: confirm dialing is stable, then reintroduce ANC ALONE (codec untouched),
  tested on a live call in isolation, so we know which of the two caused it.
REVERT-OF: v3.83 useTwilioDevice.js block.


[2026-06-16] v3.84 — Sequence engine: client/server nurture-handoff parity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE: Stop leads going dark at end of a short email track
FILE: src/lib/sequenceEngine.js  (function: advanceSequence)
WHY: At the end of new/re-engage/ghost, advanceSequence stamped
  seqExitReason:'exhausted' + seqPaused:true — emails halted permanently.
  The nurture catch-track existed and the process-sequence Edge Function
  re-enrolled into it, but the CLIENT engine had no handoff (split-brain).
  Result: 423 leads email-dead, 418 of them not actually resolved.
WHAT:
  - End of a NON-nurture track (past last step OR an archive step) now returns a
    nurture enrollment: seqTrack:'nurture', seqStep:0, seqPaused:false,
    seqExitReason:null, seqStartDate held at lead.assignDate (offsets align).
  - seqExitReason:'exhausted' is now reserved for nurture's own 2-year archive.
    Terminal dispositions (dnc/not_interested/withdrawn/chargeback) still pause
    via seqPatchForDisposition — unchanged.
  - Mirrors process-sequence/index.ts lines 763-784 field-for-field.
SCOPE: only advanceSequence changed. shouldAutoArchive, seqPatchForDisposition,
  display/badge logic untouched. Sole client caller = ContactDetail Advance button.
TEST: node assertion 7/7 (new@7/@8, re-engage@3, ghost@1 -> nurture; nurture@6 ->
  exhausted; mid-track normal; seqStartDate fallback). vite build clean, 169 modules.
DOES NOT: rescue the existing 423 already-exhausted (needs the one-time nurture
  backfill — pending Jeremy go); does not touch cron exhausted-filter or re-enable.
REVERT: restore the two-branch exhausted return in advanceSequence.


[2026-06-16] v3.83 — ANC (Active Noise Cancellation) — corrected wiring
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE: Make microphone noise suppression / echo cancellation actually engage
FILE: src/lib/useTwilioDevice.js
WHAT:
  - audioConstraints was being passed to the new Device(token, {...}) constructor.
    In @twilio/voice-sdk v2.18.2 audioConstraints is NOT a Device.Options key
    (verified against device.d.ts) — the constructor silently dropped it, so
    noise suppression never turned on. No error was thrown.
  - FIX: apply via the AudioHelper after the device is built:
    device.audio?.setAudioConstraints({ noiseSuppression, echoCancellation,
    autoGainControl }).catch(() => {}).
  - codecPreferences ['opus','pcmu'] kept on the constructor (valid, working) —
    opus gives higher-quality call audio.
NOTE: setAudioConstraints applies to the NEXT mic stream acquired, i.e. the next
  dial after device registration — not retroactively on a call already ringing.
TEST: Code/build verified (vite build clean, 169 modules). Audio quality itself
  must be confirmed by Jeremy on one live outbound call — cannot be tested in-sandbox.
REVERT: restore the single new Device(...) block with audioConstraints inline.
(Part of the uncommitted v3.83 batch alongside landline/unreachable SMS error
 handling and first-dial email auto-enroll in App.jsx.)


[2026-06-15] v3.81 — Month Queue Filter
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE: Month queue filter — dial leads from a specific assign month
FILES: src/components/DialView.jsx, src/components/DialQueuePanel.jsx
WHAT:
  - New dialMonthFilter state (default '' = all months) in DialView.jsx
  - Passed to DialQueuePanel as dialMonthFilter / setDialMonthFilter
  - MONTH select dropdown added below SORT in the queue sidebar
  - Dropdown auto-populates from leads.assignDate — unique YYYY-MM values, newest first
  - Each option shows "Jan 2026 (142)" — month label + queue count
  - Purple highlight when a month is active (distinct from TODAY/ALL/🔥)
  - Month filter STACKS on top of today/all/hot — phase priority preserved within month
  - Progress counter text appended with selected month when filter active
  - Build clean: 169 modules, 1,034 kB


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

## [3.50] — 2026-06-13

### Fixed
- **Contact Attempted → no_answer** (`csvParser.js`): Funnel status "Contact Attempted" was incorrectly mapped to `callback` disposition + re-engage track. A dial attempt with no contact is *not* a callback promise. Corrected to `no_answer` + ghost track. Also fixed "Active/Contacting" → `follow_up` (was: callback).
- **Database repair** (Supabase): 67 leads with phantom `callback` disposition — set solely by the bad "Contact Attempted" Funnel sync note, no real call-type notes — reset to `no_answer`. Surgical: leaves any lead with actual call notes untouched.
- **EXIT sweep**: Shamsuddin Thalho had `interested` disposition parked in EXIT (assigned 2026-03-16, ~88 days old). Corrected phase to M2.
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

## v3.43 — 2026-06-10 — Session 1: Correctness Fixes (audit-driven)
**Source:** tasks/AUDIT-2026-06-10.md + tasks/SPEC-M1-M2-M3-BUILD.md (Session 1). All five fixes verified by 16 automated behavior checks + clean vite build.

- **F1 — lastContact UTC/local split (HIGH).** leads.js addNote/logDial wrote UTC dates (`toISOString`) while every reader compares local. After ~7PM CT a dial stamped *tomorrow* — lead could resurface same evening, then was wrongly suppressed all next day. Both call sites now use `dayKey()` (local). Wednesday Late session no longer corrupts Thursday's queue.
- **F3 — Unified disposition logic.** New `src/lib/dispositionEngine.js` — `buildDispositionPatch()` is the single source of truth (stage map, phase transition, auto-callbacks, disposition notes, direct-VM counter). Both handleDisposition (dial view) and handleTodayDispose (TodaysBlock) consume it. TodaysBlock dispositions now get the no-show 24-hr recovery callback, SMS flag, follow-up 96-hr window, notes, and direct-VM handling they silently lost. Also fixes stale `open` read on directVmCount.
- **F5 — Queue tiebreaker inverted.** masterQueueSort sorted later-due first within a phase; most-overdue leads dialed LAST. Now next_dial ascending per the Lead Strategy docs; leads with no schedule sort last (Infinity sentinel).
- **F6 — deleteLead/addLead stale closures.** Both converted to functional updaters + persistLeads (single-row upsert for adds). Deleting/adding mid-dial-burst can no longer persist a pre-disposition snapshot of the whole database.
- **F9 — Plain notes stamped contacted-today.** addNote now stamps lastContact only for call/appointment note types — journaling a note no longer hides the lead from today's queue.

Files: src/lib/leads.js, src/lib/phaseEngine.js, src/lib/dispositionEngine.js (new), src/App.jsx (handlers + imports).

## v3.44 — 2026-06-10 — Session 2: Calendar Phase Engine (M2/M3 machinery)
**Source:** tasks/SPEC-M1-M2-M3-BUILD.md Session 2. Doctrine locked 2026-06-10. 40/40 behavior checks + clean build.

- **effectivePhase() — phase is now CALENDAR-DERIVED** (audit F4 / gap G1): 0-14 P1, 15-30 P2, 31-60 P3, 61-180 M2, 181+ M3. Floor rule preserves deliberate placements (no_sale → P3 stays P3). getPhasePriority ranks on derived phase — a day-50 lead can no longer hold P1 priority. M3 priority = 45.
- **M2 entry (day 61+):** startup migration wipes remaining schedule slots (docs: M2 has no structured cadence), derives m2_tier (T1 no_sale/no_show/positive · T2 engaged · T3 cold · T4 excluded), sets m2_next_eligible (lastContact+14d, or now if never reached).
- **M3 entry (day 181+):** Jeremy's extension — NO age-kill, ever. m3_next_eligible = lastContact+30d. Leads stop going silently dark after p3_5; the 1,711-lead Bucket C inventory becomes phase-visible.
- **Missed-block auto-log** (Jeremy's decision): slots >24h past are consumed as no-answer dials with `[auto-logged: block missed]`; schedule marches on. First run consumes historical slots silently (no activity-log flood); thereafter only blocks missed since last app open log events.
- **spreadOverdueLeads DELETED** — invented future dial dates without contact, violating schedule-rules-all doctrine. Jobs replaced by missed-slot processor + session capacity caps.
- **backfillLead:** M2-bound leads (old Bucket B) get tier + eligibility instead of a contradictory fresh P1 schedule.
- **isDueToday:** M2/M3 leads excluded from Today queue (Session 3 wires spillover fill) — EXCEPT due callbacks always surface.
- **F7 fix:** migration-changed leads get fresh _ts and push to Supabase immediately — cloud never drifts from local migrations.
- PHASE_DEFS gains M3 (both copies — phaseEngine + TodaysBlock; dedup flagged for cleanup).

Files: src/lib/phaseEngine.js, src/App.jsx (startup), src/components/TodaysBlock.jsx (PHASE_DEFS).
Expected on real data: most of the 2,440 migrate to M2/M3 with tiers on first launch — check console for `[CRM v3.44] Phase migration:` summary.

## v3.45 — 2026-06-10 — Session 2.5: Funnel CSV Sync (import mode 3)
**Source:** tasks/CSV-SYNC-ANALYSIS-2026-06-10.md. 30/30 behavior checks incl. dry-run on the real 2,589-row Funnel export.

- **New import mode: "Sync from Funnel"** (green button in ImportModal when matches exist). Matches by LeadCode (Funnel's unique vendor ID) with phone fallback — permanently fixes spouse/shared-phone collisions.
- **Conflict doctrine (locked with Jeremy):** the export has no status timestamps, so the sync NEVER DOWNGRADES — Funnel statuses only apply if they advance the lead on the progress ladder. DNC always wins (compliance). "Not Interested" is fenced — cannot kill live CRM work. All skipped conflicts reported (console + alert summary).
- **mapFunnelStatus exported + fixed:** Issue Paid → submitted/stage issued (4 PAYING CLIENTS no longer import as never-called), Call Again → callback, Not Taken → no_sale, sold statuses now carry stage app_submitted.
- **9 new columns captured** at parse: leadCode, leadAssignmentId, sex, street, leadSource, leadSubSource, exclusivityEndDate, purchaseAmount (lead COST — feeds Session 5 economics), birthday. Plus funnelAssignDate (TRUE lead age, stored for the post-S3 re-base — assignDate/phase_start deliberately untouched), funnelStatusRaw, inFunnel:true (SMS deconfliction flag).
- **Sync never touches:** existing notes (sync note prepends), schedule slots, phase (except terminal EXIT wipe), nextCallback, lastContact. No slot consumption — a sync is not a dial.
- **Churn guard:** unchanged leads get no _ts bump — no pointless 2,400-row Supabase re-upserts.
- Field backfill fills holes only, never overwrites CRM values. CSV-only leads (~150) import via the normal backfill path. CRM-only leads reported, untouched.

Files: src/lib/csvParser.js, src/lib/funnelSync.js (new), src/lib/useImportHandlers.js, src/components/ImportModal.jsx.
To run: Contacts → Import CSV → map fields → green "Sync from Funnel" button.

## v3.46 — Session 3: M2/M3 Queue Spillover
**Source:** SPEC-M1-M2-M3-BUILD.md Session 3 (detailed spec). 23/23 behavior checks + clean build.

- **buildSpillover()** (phaseEngine): fills SPARE dial-block capacity with aged leads. M1 never interrupted — zero-capacity guard proven by test. M2 first (tier ascending, never-reached → longest-silent first, T4 excluded, 14-day spacing respected), M3 only after M2 exhausts (30-day spacing, oldest first). Same-day re-dial blocked.
- **Aged disposition outcomes** (dispositionEngine): callback/follow_up_needed on an M2/M3 lead → **PROMOTED to Machine 1** — full P1 schedule from today, phase_start_reason='m2_reactivation'. no_answer/vm_left/direct_vm/hung_up → re-spaced +14d (M2) / +30d (M3); hung_up deliberately re-spaces rather than promotes (negative answer ≠ momentum — Jeremy may veto). no_show/no_sale/terminal flow through unchanged (P1 rebuild / P3 weekly / EXIT wipe).
- **phase_start_reason** now stamped on every dispositional rebuild (no_show, no_sale, m2_reactivation) — Session 3b's age re-base depends on it to distinguish event-date aging from legacy backfill stamps.
- **TodaysBlock UI:** spillover sections render below M1 work — "M2 REACTIVATION — BONUS WORK" with T1/T2/T3 badges + "M3 DEEP WAVE", dashed-border compact cards with last-contact date, open + quick-disposition actions. Header shows M2/M3 fill counts; legend gains M3.

Files: src/lib/phaseEngine.js, src/lib/dispositionEngine.js, src/components/TodaysBlock.jsx.
NEXT GATE (3b): age re-base dry-run — projected P1/P2/P3/M2/M3 distribution logged for approval BEFORE applying.

## v3.47 — Session 3b: Age Re-base (SHIPS INACTIVE — dry-run projection only)
13/13 checks + clean build. NOTHING CHANGES until Jeremy approves the projection and the flag flips.

- **AGE_REBASE_ACTIVE = false** (phaseEngine). While off, aging works exactly as v3.44-46.
- When flipped ON: leadAgeDays derives from TRUE lead age — funnelAssignDate (v3.45 sync) else assignDate — EXCEPT event-aged leads (phase_start_reason set, or legacy no_sale/no_show inference) which keep event-date aging per docs. Floor rule unchanged.
- **dryRunAgeRebase()** — pure read; App startup logs `[CRM v3.47] AGE RE-BASE PROJECTION` every launch: current vs projected P1/P2/P3/M2/M3 counts + how many leads shift basis.
- Activation path: Jeremy reads projection → approves → one-constant flip commit → next startup, migrateAgedPhases (v3.44) moves the database into its true M2/M3 waves with tiers, spillover (v3.46) works them.

Files: src/lib/phaseEngine.js, src/App.jsx.

## v3.48 — Session 3c: Age Re-base FLIPPED ON + Bucket C Resurrection (dry-run)
18/18 checks + clean build.

- **AGE_REBASE_ACTIVE = true** — Jeremy approved projection 2026-06-11 (current P1:64/P2:53/P3:151/M2:477/M3:0 → projected P1:57/P2:39/P3:62/M2:521/M3:66, 726 leads shift). Next launch: migrateAgedPhases settles the database into true waves. Event-aged leads (no_sale/no_show/m2_reactivation) keep event-date aging.
- **Bucket C Resurrection built, ships OFF (RESURRECTION_ACTIVE = false).** Diagnosis: 1,701 leads sit in EXIT from the v3.11 backfill's "Bucket C → EXIT" mapping — EXIT they never earned (doctrine: EXIT = terminal disposition only). classifyExitLead splits them: candidates (non-terminal, non-client) → M3 with tier + 30-day eligibility + phase_start_reason='resurrection'; true terminals (dnc/not_interested/withdrawn/chargeback) stay dead; clients (submitted/issued/underwriting — 5 R's track) excluded from the dial wave.
- Startup logs `[CRM v3.48] BUCKET C RESURRECTION (dry-run)`: candidates/terminals/clients split. Activation = same one-constant protocol after Jeremy approves the split.

Files: src/lib/phaseEngine.js, src/App.jsx.

## v3.49 — Resurrection FLIPPED ON
Jeremy approved the split (1,594 candidates → M3 · 91 true terminals stay EXIT · 16 clients → 5 R's track; sums to 1,701 exactly). RESURRECTION_ACTIVE = true. Next launch: non-terminal EXIT leads enter M3 with tier + 30-day eligibility + phase_start_reason='resurrection', _ts-bumped and pushed to Supabase. The graveyard becomes inventory.

## v3.50 — Session 4-lite: Lifetime Flags + Set Rate wiring + Write Order
6/6 behavior checks + clean build. (Session shrank after Jeremy caught that the Audit Held button + Set Rate already shipped in v3.42 — backlog entry was stale.)

- **apptSetEver / satEver lifetime flags** — facts that never revert (per Derick's handoff: status = current state, flags = permanent facts). apptSetEver stamps on first booking (disposition path + stage-transition path + manual appointment note); satEver stamps on Audit Held (dialer button + meeting log).
- **Set Rate denominator fixed:** the stage→appointment_set activity event is now gated on !apptSetEver — rebooks and reschedules no longer inflate appointments-set counts.
- **Set Rate numerator unblocked from ContactDetail:** meeting log outcome "Held" now fires audit_ran + stamps satEver (was note-only — audits logged there never reached the metric). No Show / Reschedule stay note-only.
- **G10 write order (Derick handoff):** activity events append BEFORE the lead row persists in upd() — a crash can no longer eat an attempt record the lead claims happened.

Files: src/lib/leads.js, src/lib/dispositionEngine.js, src/components/ContactDetail.jsx, src/components/DialView.jsx, src/App.jsx (prop).

## v3.51 — Session 5: Lead Order Economics ("the Derick dashboard")
17/17 math checks + clean build. "Never blend DLHA numbers with aged analog."

- **leadOrderId on every lead.** One-time startup backfill clusters historical leads by source + level + assign-week (deterministic, idempotent — flag metka-order-backfill-v1). Every CSV import (append AND sync modes) stamps its batch as a new order.
- **💰 App Economics card** (ContactDetail, shows for app_submitted/underwriting/issued or when data exists): APV, commission paid, advance paid, payment date, app status (submitted/issued/paid/chargeback/cancelled). Chargeback status subtracts that lead's money from its order P&L — with a red warning strip.
- **💰 ORDERS view** (nav → DATA): per-order table — source, level, start, leads, spend (Σ Funnel PurchaseAmount — captured on 2,407 leads by v3.45 sync), appointments (apptSetEver), sat (satEver), apps, APV, collected, NET (green/red), ROI multiple, **break-even date** (first payment date where cumulative collections ≥ spend) and days-to-BE. Header totals across all orders.
- **Median days-to-break-even per lead level** — chips at the top: "DLHA: median 11d to break even." Derick's exact projection use case, live.
- Fix during build: heredoc escape bug briefly injected an import inside a CC alert string — caught by immediate grep verify, repaired before anything shipped. (Lesson: verify every blind insert.)

Files: src/lib/leadOrders.js (new), src/components/LeadOrdersView.jsx (new), src/components/ContactDetail.jsx, src/components/NavSidebar.jsx, src/lib/useImportHandlers.js, src/App.jsx.

## v3.52 — BUG FIX: field-map whitelist was stripping all v3.45 sync fields
Jeremy's ORDERS screenshot showed every source "—", labels UNKNOWN, spend $0. Root cause: confirmFieldMapping's allKeys whitelist (useImportHandlers) never got the 9 v3.45 keys — every modal-confirmed import/sync silently dropped leadCode, purchaseAmount, leadSource, sex, street, etc. (leadLevel survived because it was on the OLD list — which is why levels rendered.)
- allKeys extended with all 9 fields.
- assignLeadOrders now re-clusters leads whose order id contains _UNKNOWN_ once leadSource exists; import-stamped orders untouched.
- Order backfill flag bumped to v2 — re-cluster runs once after Jeremy re-runs the Funnel sync.
RECOVERY STEPS (Jeremy): 1) relaunch CRM, 2) re-run Sync from Funnel with the same CSV (idempotent — fills the holes), 3) relaunch again → re-cluster fires → ORDERS shows real sources + spend.

## v3.54 — SMS Guard Session (incident response — five locks + UI hard lock)
process-sequence type-checked clean (deno check); quiet-hours logic 5/5 node tests incl. lead-local nuance (CA blocked at 9AM CT run). DEPLOY = Jeremy via CLI; cron stays OFF until deploy confirmed.

- **Guard 1 — KILL-SWITCH:** SMS fires only if Supabase secret SMS_ENABLED === "true". Unset (current state) = email-only mode, permanently, by default.
- **Guard 2 — OPT-OUT:** smsOptOut leads never texted (15 flagged from the 6/11 incident).
- **Guard 3 — QUIET HOURS:** 8AM–9PM in the LEAD'S timezone (state→tz map for all 16 licensed states), enforced in code at send time.
- **Guard 4 — DECONFLICTION:** inFunnel leads never get automated SMS (Funnel owns automated texting — 2yr sequences).
- **Guard 5 — CAP:** SMS_RUN_CAP per run (default 50).
- Blocked sends counted per-guard in sequence_runs (smsBlocked breakdown) — visibility without sends.
- **UI hard lock (SmsThread):** opted-out leads get a red ⛔ OPTED OUT banner INSTEAD of the composer — manual texting physically removed. START re-opens (receive-sms handles opt-in).
- Cron plan: re-enable at 0 14 * * * UTC (9AM CDT — was 9 UTC/4AM, the incident hour) AFTER Jeremy deploys.

Files: supabase/functions/process-sequence/index.ts, src/components/SmsThread.jsx.

## v3.55 — Session 6: SMS Filter Tabs + F8 Spouse-Recovery Check
- **MessagesView filter tabs:** All · Unread · 📥 Awaiting (family spoke last, no reply yet — the money filter) · ⛔ (opted-out, calls only). Live count badges, tab-aware empty states. Pure filtering on existing data.
- **F8 CLOSED — zero spouses lost.** Forensic: only 4 shared-phone/different-name groups in the full Funnel export; 3 were typo-duplicates of one person; the one real household (Scott + Quentin Dressler) both survive in M3 on distinct numbers. v3.38 dedup harmed nobody.
- Finding: leadCode null across checked leads → post-v3.52 Funnel re-sync NOT yet run — Jeremy must re-run sync to load costs/sources/leadCodes (ORDERS still $0 until then).

Files: src/components/MessagesView.jsx.

## v3.56 — Audit v2 Patch Session (5 fixes, 2 deploys)
Tests: 5/5 funnelSync arm/disarm + beacon strip + clean builds (vite + deno check).

- **V2-2 (HIGH):** Funnel sync may DISARM sequences (DNC/terminal must stop the drip — cron filters on seqPaused only) but NEVER ARMS one. Re-arming with stale clocks was the 6/11 barrage shape. Doctrine (Jeremy): enrollment is deliberate, never a sync side effect.
- **V2-1+V2-5 (HIGH):** single `sendSmsGuarded` in App.jsx replaces 3 pasted wrappers — opted-out leads blocked with alert at the one chokepoint every view uses.
- **V2-3b:** send-sms v10 DEPLOYED — server-side opt-out rejection (403 OPTED_OUT) for every caller, forever.
- **V2-3a:** receive-sms v12 DEPLOYED — signature validation now MANDATORY and fail-closed (missing secret or invalid/erroring signature → 403). Forged-STOP attack closed.
- **V2-8:** sbBeaconFlush strips notes to latest-1 — close-the-laptop flush no longer capped at ~6 fat leads.

⚠ Verify inbound still works: text the Twilio number, confirm it lands in Messages (signature validation is URL-sensitive — if 403s appear in receive-sms logs, the webhook URL needs exact-match alignment).
Files: src/lib/funnelSync.js, src/App.jsx, src/lib/supabaseSync.js, supabase/functions/send-sms, supabase/functions/receive-sms.

## v3.57 — Session 7a: DialView adopts the queue brain
12/12 tests + clean build. DialView's CALL FLOW untouched — all changes land around it.

- **buildTodayQueue() in phaseEngine** — the Block's queue logic, now pure + shared: ghosts out → isDueToday → slot → masterQueueSort → recovery cap → capacity.
- **All session launch paths now phase-engine fed:** startDialSession default, refreshQueueOrder (legacy priority() retired from queue building), dashboard slot tiles.
- **HIDDEN BUG FIXED:** DialView's slot-launch filter referenced isDueToday WITHOUT importing it — the try/catch swallowed the ReferenceError, so slot tiles had been silently launching unfiltered queues. Now they launch the doctrine queue with caps.
- **Spillover continuation:** M1 list completes mid-session → one confirm ("N aged reactivation leads ready — keep dialing?") → same session rolls into M2/M3 (extendSessionWithSpillover in lib).
- **SessionStrip in the dial sidebar:** ● LIVE / ⏸ PAUSED · real session label · worked X/Y · ticking elapsed. Renders only during a locked session.
- App.jsx: +7 lines (session-extension UX next to setSession; math in lib). 7b demolition takes App.jsx net negative.

Files: src/lib/phaseEngine.js, src/App.jsx, src/components/DialView.jsx, src/components/DialQueuePanel.jsx.

## v3.58 — Session 7b: Full adoption + DEMOLITION
Clean builds throughout. App.jsx 1391 → 1384 (net −7, Session 7 promise honored).

- **SMS ladder, fully alive in every thread:** SmsThread's drawer now carries position memory — sent steps show ✓ dimmed, the next step glows NEXT, and a REAL successful send of a ladder step auto-advances smsSeq/smsStep (TodaysBlock's manual "mark sent" made obsolete by actual sending). Works in the dialer SMS tab, Messages view, and contact card alike.
- **Dead code excised:** DialRightPanel's SmsTab component (9.6KB) was never rendered — the SMS tab renders SmsThread. Deleted.
- **Truth chips:** DialView's phase pill now shows CALENDAR-derived phase + day count ("P3 · Day 41 · Due today"); queue sidebar rows swap the legacy bucket badge for the derived-phase chip (M2 rows show tier: "M2·T1"). Buckets retired from queue UI per doctrine.
- **Toasts replace alerts in the dial flow:** session complete, empty queue, SMS blocked (⛔ STOP), SMS failure — all non-blocking bottom toasts (lib/toast.js, framework-free). Delete confirm stays a confirm (destructive).
- **DEMOLITION:** TodaysBlock import, render block, and handleTodayDispose removed from App.jsx. File fully orphaned — ⚠ JEREMY: `del src\components\TodaysBlock.jsx` (sandbox can't delete Windows-owned files), then the git ritual.
- Sidebar last-contact stamps: already existed (recencyLabel) — verified, no work needed.

Files: src/components/SmsThread.jsx, DialRightPanel.jsx, DialView.jsx, DialQueuePanel.jsx, src/lib/toast.js (new), src/App.jsx.

## v3.59 — Session 7c: Promise Window + 🔥 Hot Queue
11/11 tests + clean build. Opens change VISIBILITY only — never schedules (doctrine intact).

- **Promise window = priority 105.** A callback due within the next hour (or earlier today, unhandled) outranks everything — above no-sale. ⏰ time chip on queue rows in the window.
- **GAP FIX:** a due callback now ALWAYS surfaces in the Today queue regardless of phase or a future next_dial — previously a P-phase lead's "call me at 2" vanished behind its own schedule.
- **🔥 Hot Queue (on demand, never auto-merged):** new 🔥 filter in the dial sidebar — email openers from the last 48h, freshest first, terminal/booked/contacted-today excluded, M2/M3 included (heat beats spacing for VISIBILITY only). Count badge live; power-dial START runs the hot list when the filter's active. Jeremy summons it when he chooses — e.g., the half-hour after a morning send.
- 🔥 chips on normal queue rows for recent openers + "🔥 Opened Xh ago" pill on the open lead in DialView.

Files: src/lib/phaseEngine.js, src/components/DialQueuePanel.jsx, src/components/DialView.jsx.

## v3.60 — Unsubscribe Fix (COMPLIANCE) + Screenshot-Audit Patch Batch
- **🚨 UNSUBSCRIBE WAS A 404 SINCE LAUNCH.** Every sequence email's footer linked /functions/v1/unsubscribe — never built, never deployed (CAN-SPAM exposure; Mary G Davis clicked twice on 6/11 and got error pages). FIXED: unsubscribe fn v1 DEPLOYED (public, branded confirmation page, sets emailOptOut + seqPaused + note + in-blob _ts — and because the live cron already respects seqPaused, unsubscribes take effect IMMEDIATELY, before any redeploy). Lloyd Davis (Mary's household) opted out retroactively via SQL. process-sequence patched locally with belt-and-suspenders emailOptOut skip — ⚠ JEREMY: CLI deploy process-sequence.
- **Pipeline lag (Jeremy report):** per-column render cap of 30 cards (+N more footer) — the 2,233-card New Lead column was the lag. True counts still in headers.
- **Stale A2P banner (Jeremy report):** Templates view now says A2P Approved · Live + accurate description (manual sends live, automation off per deconfliction).
- **ORDERS "UNKNOWN" labels:** order clustering now runs EVERY startup (idempotent) — labels re-cluster the moment sources arrive instead of freezing behind a one-time flag.
- **Settings legacy phase panel DISARMED:** Activate/Reset buttons removed (they'd fight the v3.44 calendar engine); panel now documents that phases run automatically. Balance AM/PM kept.

Files: supabase/functions/unsubscribe (new, deployed), supabase/functions/process-sequence, src/App.jsx, src/components/PipelineView.jsx, TemplatesView.jsx, SettingsView.jsx.

## v3.61 — BUG: Sold clients stayed in the dial machine (the Lori Mills bug) + PD SKIP
8/8 tests + clean build. Reported live by Jeremy mid-block: Lori Mills (sold 6/4, Issue Paid synced 6/10) showed "P2 · Day 16 · Due today" and got power-dialed.

- **Root cause:** SOLD was never terminal to the dial engine. DNC wipes a schedule; buying a policy didn't. Her P2 schedule kept marching after the sync.
- **retireSoldSchedule():** submitted disposition or client stages (app_submitted/underwriting/issued) → schedule wiped, phase EXIT. Fires at disposition time, at sync time (Issue Paid promote now wipes), and as an idempotent startup pass (retires Lori + every existing client on next refresh).
- **UW check-ins preserved:** isDueToday reordered — a due nextCallback (promise) now beats the EXIT guard, so retired clients' 14-day UW check-in callbacks still surface. Terminal dispositions still excluded first (dnc + stale callback ≠ due).
- **Clients excluded everywhere:** buildTodayQueue ghosts, hot queue, spillover — sold = served by appointments + 5 R's, never dial waves.
- **PD SKIP button (Jeremy: "Lori is on screen and I can't move the queue forward"):** STOP and SKIP→ now sit side-by-side during power dial — skip advances without logging anything.
- Email side confirmed safe: her sequence was already Paused (sync did that right); Jeremy CLI-deployed process-sequence so emailOptOut guard is live for tomorrow's 9AM run.

Files: src/lib/phaseEngine.js, dispositionEngine.js, funnelSync.js, usePowerDialer.js, src/App.jsx, src/components/DialView.jsx, DialQueuePanel.jsx.

## v3.62 — END-while-ringing fix + 🔥 Card Touch
- **BUG (Jeremy report): no hang-up outside power dial.** END button armed only on 'connected' — ringing/misdialed manual calls had no way to end (PD's auto-hang masked it). Now arms on connecting OR connected.
- **🔥 Card Touch chip (Jeremy: "opener sms is fire"):** in any SMS thread where the family opened an email ≤48h ago (and isn't opted out), a one-tap 🔥 Card chip fills the composer: warm intro + hihello digital business card + STOP language. Manual send only — deconfliction intact. Workflow: card → 2 min → dial, your name already on their screen. Auto version parked until Funnel cancels.
- **Logged for design conversation (NOT built):** Jeremy's PD redesign — power dial should be an auto-advance TOGGLE over the one visible queue, not a mode that locks its own differently-filtered list. Touches usePowerDialer core; conversation first.

Files: src/components/DialQueuePanel.jsx, src/components/SmsThread.jsx.

## v3.63 — Session 8a: Truth Dashboard + Day/Night + Font Pass + Contact Attempted Fix
Build clean: 168 modules. DB surgical via Supabase MCP.

**Supabase data repairs:**
- **67 phantom callback leads repaired:** `mapFunnelStatus` in csvParser.js was returning `{disposition:"callback"}` for Funnel's "Contact Attempted" status — which means a dial attempt with no answer, NOT a callback promise. Fixed: "contact attempted" now maps to `{disposition:"no_answer", seqTrack:"ghost", seqStep:0, seqPaused:false}`. The 67 leads that had only a Funnel "Contact Attempted" sync note (no real call-type notes) were reset to `no_answer` via surgical SQL UPDATE.
- **EXIT sweep — Shamsuddin Thalho:** Had `interested` disposition trapped in EXIT phase (assigned 2026-03-16, ~88 days old). Promoted to M2 via SQL UPDATE.

**DashboardTab.jsx — Truth KPI strip + Odds Meter:**
- 5 truth KPI cards inserted before TODAY'S ACTIVITY: MACHINE DIALS (7d) | AUDITS HELD (week) | AWAITING REPLY | 🔥 OPENERS | APPS/WEEK
- Odds Meter widget: rolling 7-day dials-per-app ratio. Shows "You book every ~N dials · You're on X since last app." Blue border turns green with "🎯 Statistically due" when dialsSinceApp ≥ oddsRate.
- `awaitingReply`: leads where latest SMS is sms_inbound (someone replied, hasn't been answered)
- `openersNow`: leads where hoursSinceOpen ≤ 48h and not smsOptOut
- 3 dashboard code artifacts fixed: escaped apostrophe in TODAY'S PACE, stray dollar sign in weeklyDialGoal chip, missing JSX braces on /weeklyDialGoal

**index.css — Night theme:**
- Full `[data-theme="night"]` token block: dark bg (#0D1117), surface layers, border shades, text tiers, sidebar variants, status rgba dims

**AppHeader.jsx + App.jsx — Day/Night toggle:**
- ☀️/🌙 toggle button in header (before + ADD)
- Theme state in App.jsx persisted to localStorage (`metka-theme`), applied via `data-theme` on `document.documentElement`
- `theme, setTheme` props wired from App → AppHeader

**DialView.jsx — ISO date chip fix:**
- `fmtAssignDate(raw)` helper: formats raw ISO assign date to "Jun 3" style. Chip previously showed raw ISO string.

**Quiet ring — App.jsx:**
- useEffect fires on `leads` change; finds any lead where `nextCallback` is within ±60s of now
- One-ring-per-session guard via sessionStorage (`metka-rung-cbs` Set)
- Web Audio API: two-tone soft ping (880Hz + 1108Hz), 0.18 gain, exponential fade — no file dependency

**Font pass — 41 sizes raised across 4 files:**
- DialView.jsx (1), DashboardTab.jsx (28), MessagesView.jsx (3), DialQueuePanel.jsx (9)
- Minimum floor: 0.688rem / 11px. No sub-11px font sizes remain in these files.

Files: src/components/DashboardTab.jsx, DialView.jsx, MessagesView.jsx, DialQueuePanel.jsx, AppHeader.jsx, App.jsx, src/index.css, src/lib/csvParser.js, Supabase leads table (SQL direct).


# Session 8b — Weekly Campaign RPG + Settings Toggle (2026-06-12)
- [x] WeeklyCampaignView.jsx (new, 360 lines) — Campaign Ledger RPG weekly production view
  - Week structure: Sat→Fri (Symmetry week), per-day field log table
  - Mission card: X/5 apps progress bar, status (COMPLETE / ON TRACK / BEHIND)
  - XP system: dial=1, contact=5, appt=15, audit_ran=25, app=100
  - Rank ladder: RECRUIT → FIELD AGENT → UNDERWRITER → SR. UNDERWRITER → PROTECTIVE STEWARD (LV.1–5)
  - Rank XP progress bar (purple gradient)
  - Streak: consecutive days with ≥1 dial (rolling backward up to 60 days)
  - Odds Meter: same 7-day dials-per-app logic as DashboardTab; "STATISTICALLY DUE" badge
  - Last week comparison strip with directional arrows
- [x] NavSidebar.jsx — 📋 WEEK added to INTEL group (above ACC)
- [x] App.jsx — WeeklyCampaignView import, 'campaign' added to both VALID sets, render block, theme/setTheme passed to SettingsView
- [x] SettingsView.jsx — theme/setTheme props wired; Appearance card at top of Settings (☀️ DAY / 🌙 NIGHT toggle button group)
- [x] 169 modules, 0 errors, build clean

## v3.64 — Full font pass + TODAY nav + effectivePhase chips + Dial Sessions settings
Build clean.

- **Full app font pass:** 119 sub-11px sizes raised to 11px minimum across 22 remaining components (AIPanel, ActivityDashboard, AppHeader, AppointmentsView, CCTab, CallbackQueue, ContactDetail, ContactsView, DialRightPanel, FieldMapModal, HourlyStats, ImportModal, LeadOrdersView, LoginGate, NavSidebar, PipelineView, ScriptsView, SequenceRunsTab, SequenceTab, SettingsView, SmsThread, TemplatesView). All screens now meet the ≥11px readability floor.
- **⚡ TODAY nav entry:** Added as first item in WORK group (NavSidebar.jsx). The primary operational screen now has a direct nav shortcut.
- **effectivePhase chip in ContactDetail:** Header now shows derived phase + day count ("M2 · Day 88") alongside bucket badge. Import: effectivePhase, leadAgeDays, PHASE_DEFS from phaseEngine.
- **Dial Sessions card in Settings:** After Appearance card. Shows all 11 configured block times (default 9:00 AM–10:30 AM for all AM slots). Each row is editable (hour/minute inputs). Changes persist to localStorage (`metka-dial-sessions-v1`). Reset defaults button. Reference display — phaseEngine queue logic uses its own SESSIONS table (already correct at 9:00–10:30).
- **Hooks crash fixed (v3.63 regression):** Quiet ring useEffect was placed after `if(loading) return` early exit — React saw hook count mismatch between loading/loaded renders. Moved to before the loading guard.

Files: src/components/* (22 files font pass), NavSidebar.jsx, ContactDetail.jsx, SettingsView.jsx, src/App.jsx (hooks fix).

## v3.65 — 2026-06-13
### Fixed
- TODAY nav tab was blank (no view router branch existed for `view==="today"`). Aliased to DialView: `(view==="dial" || view==="today")` — TODAY now lands on the dial queue as intended.

## v3.66 — 2026-06-13
### Removed
- TODAY nav tab removed from NavSidebar (duplicated DIAL). Alias and VALID set entry cleaned from App.jsx.

## v3.67 — 2026-06-13
### Fixed
- Assign date chip in DialView now shows full date + time (e.g. "Jun 3, 2025 9:41 AM") instead of month/day only.

## v3.68 — 2026-06-13
### Fixed
- Lead type chip now shows with fallback chain: leadType → leadSubSource → leadSource (existing leads with empty leadType now display something)
- Color-coded by type: EPA=orange, RLGL/GL=green, DLHA=blue, MP=purple, FE=red
- Assign date chip now shows full date + time (v3.67 — included here for completeness)

## v3.69 — 2026-06-13
### Added
- Lead info row 2 in DialView header: email (mailto link), sex, loan amount, lead source/subsource chips
- Quick Capture expanded to two-column Household Profile: 🩺 HEALTH (left — existing fields) + 👨‍👩‍👧 HOUSEHOLD (right — Spouse Name, Spouse Age, Spouse DOB, Dependents, Req. Coverage); all new fields save on blur

## v3.70 — 2026-06-13
### Added
- csvParser: maps HomeValue, HouseholdIncome, RequestedCoverageAmount, SpouseName, SpouseAge, SpouseDob, Dependents from CSV on import
- DialView row 2: home value (🏡) and household income (💰) chips now display when populated
- Household Profile right column fields pre-fill from CSV data on next import

## v3.71 — 2026-06-13
### Added
- csvParser: LeadLevel/LeadLevelAlias (EPA, DLHA, LHGL), BeneficiaryRelationship, RequestedCoverageAmountRange now mapped
- DialView row 1: LeadLevel chip (orange/bold) between lead type and location
- DialView row 2: Requested coverage (green 🛡), beneficiary relationship (👨‍👩‍👧), tobacco flag (🚬 amber) now show when populated
- Tobacco chip in row 2 appears automatically when checkbox is checked — visible at a glance without scrolling down

## v3.72 — 2026-06-13
### Redesigned
- Center panel card: 3 clear sections — LEAD DATA (read-only grid, populated fields only), HEALTH CAPTURE (4-field row + bold tobacco + meds), HOUSEHOLD (blank capture inputs)
- No more fake placeholder values showing as data
- Tobacco checkbox full-width, bold, TABLE RATING badge

## v3.73 — 2026-06-15
### Redesigned
- Center panel card: Option A sidebar strip layout — 35% | 65% horizontal split
- Left pane: vertical stacked label/value list (populated fields only, borderRight divider). Shows: Age, Sex, Coverage+range, Beneficiary, Loan, Home Value, Income, Lead Level, Source, Zip. Falls back to "No data on file" when empty.
- Right pane: Health Capture (Ht/Wt/DOB/Age grid + tobacco toggle + meds textarea) + Household Capture (Spouse Name/Age/Dependents + Spouse DOB/Req Coverage) + Living Benefits badge
- Removed placeholder values from all capture inputs (blank until filled on call)

## v3.74 — 2026-06-15
### Fixed
- Left pane pairs: added Location (city+state combined), Email, Lead Type
- $0/$null loan/homeValue/income no longer show as data (Number() > 0 guard)
- Zip moved under Location for logical grouping

## v3.75 — 2026-06-15
### Added
- SMS is now the default right panel tab (was Script — click Script when they pick up)
- Left pane: Address now combines Street + City/State + Zip into one row
- Left pane: County added (98% populated)
- Left pane: Alt Phones shows Cell/Home/Work when different from primary phone (deduped)
- Left pane: 📄 LEAD SHEET button links to PDFURL when available (100% populated)
- csvParser: cellPhone, homePhone, workPhone mapped as separate fields

## v3.76 — 2026-06-15
### Cleaned
- Removed row 2 info chips — all data now lives in the left pane card (no duplicates)
- Kept tobacco as a standalone flag chip above the phase strip (quick visual on hot leads)

## v3.77 — 2026-06-15
### Added
- SMS panel: 📵 1/5 button in toolbar pre-fills composer with rotating no-answer template
- 5 templates cycle on each tap (1→2→3→4→5→1): intro, Living Benefits angle, qualify spouse, Ghost Protocol, final close
- Counter shows current position (e.g. "📵 2/5") — resets when lead changes
- Templates personalized with {firstName}. One tap to fill, one tap to send. Honors smsOptOut.

## v3.78 — 2026-06-15
### Compliance
- TCPA: No-answer button shows ⚠️ INTRO on first text to any lead (no prior SMS history)
- Intro template includes "Reply STOP to opt out." — required for initial contact from this number
- After intro is sent (or any prior SMS exists in notes), button switches to 📵 1/5 cycling templates
- hasBeenTexted derived from notes — no new field needed, works retroactively for leads already texted

## v3.79 — 2026-06-15
### Added
- SMS panel: 📲 # Change button fills composer with number-change broadcast template
- Message: "Hey {firstName}, Jeremy Metka here — I changed my number. Please save (580) 263-5409 as my new contact. I'll be in touch soon. Reply STOP to opt out."
- 151 chars / 1 segment. Per-lead manual send via existing SMS panel.

## v3.80 — 2026-06-15
### Redesigned
- SMS toolbar: INTRO + No Answer dropdown replace the cycling buttons
- ⚠️ INTRO button: only shows when lead has no prior SMS history (TCPA gate)
- 📵 No Answer ▾: dropdown with T1–T5 templates + # Change below a divider
- Each dropdown item shows template label + first 80 chars of personalized preview
- Dropdown closes on selection
