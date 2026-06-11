# Graph Report - metka-crm  (2026-06-10)

## Corpus Check
- 77 files · ~107,708 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 463 nodes · 841 edges · 32 communities (23 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a95696b5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 32|Community 32]]

## God Nodes (most connected - your core abstractions)
1. `MetkaCRM()` - 33 edges
2. `inp()` - 22 edges
3. `isUWStuck()` - 13 edges
4. `dayKey()` - 12 edges
5. `Changelog — Metka Field Ops CRM` - 11 edges
6. `BUILD SPEC — Machine Doctrine Implementation (M1 hardening + M2 + M3)` - 10 edges
7. `applyPhaseTransition()` - 9 edges
8. `isDueToday()` - 9 edges
9. `daysInUW()` - 9 edges
10. `fmt()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `AppointmentConfirmModal()` --calls--> `fmt()`  [INFERRED]
  src/components/AppointmentConfirmModal.jsx → src/constants.js
- `MetkaCRM()` --calls--> `ccExchangeCode()`  [EXTRACTED]
  src/App.jsx → src/lib/ccIntegration.js
- `MetkaCRM()` --calls--> `autoFollowUp()`  [EXTRACTED]
  src/App.jsx → src/lib/leadScoring.js
- `MetkaCRM()` --calls--> `priority()`  [EXTRACTED]
  src/App.jsx → src/lib/leadScoring.js
- `MetkaCRM()` --calls--> `applyPhaseTransition()`  [EXTRACTED]
  src/App.jsx → src/lib/phaseEngine.js

## Communities (32 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (40): StageStepper(), useAuth(), ACTIVITY_TYPES, aggregateActivity(), computeActivityQueue(), CONTACT_DISPS, dayKey(), DEFAULT_GOALS (+32 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (32): AddLeadForm(), AppointmentConfirmModal(), APPT_TYPE_LABELS, inputSt, ContactDetail(), UnderwritingCard(), ContactsView(), DialRightPanel() (+24 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (35): active, activityNotes, allRows, archived, archiveNote, base64urlEncode(), bdayHtml, bdayNote (+27 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (27): INNER_TABS, SequenceTab(), TC, TD_STYLE, TH_STYLE, advanceSequence(), getNextTouchDate(), getSequenceBadgeColor() (+19 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (40): PHASE_DEFS, QUICK_DISPS, SMS_SEQUENCES, AUTO_CALLBACKS, buildDispositionPatch(), DISP_NOTE_TEXT, DISP_STAGE_MAP, addDaysISO() (+32 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (20): dependencies, lz-string, react, react-dom, @supabase/supabase-js, @twilio/voice-sdk, devDependencies, jsdom (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.24
Nodes (14): btn(), card(), CCTab(), sectionLabel(), ccAuthorize(), ccClearTokens(), ccExchangeCode(), ccFetch() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (16): autoDetectMapping(), mapFunnelStatus(), parseBucket(), parseCSV(), parseDisp(), parseStage(), DISP_RANK, FIELD_KEYS (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (12): bodyTrimmed, from10, inboundNote, isOptIn, isOptOut, match, matchedData, numMedia (+4 more)

### Community 9 - "Community 9"
Cohesion: 0.20
Nodes (8): CORS, GIF_BYTES, leadId, newNote, notes, now, sb, url

### Community 10 - "Community 10"
Cohesion: 0.25
Nodes (7): accountSid, authToken, CORS, credentials, digits, form, fromNumber

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (7): DEFAULT_AI, DEFAULT_CB_PRESETS, DEFAULT_FINANCIAL, DEFAULT_GMAIL, DEFAULT_SEQ, DEFAULT_TWILIO, useSettingsConfig()

### Community 12 - "Community 12"
Cohesion: 0.33
Nodes (6): Component Files, Key Functions, Lead Data Model, Sidebar Nav, The Queue / Live Dial Flow, Version History

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (5): clientId, clientSecret, CORS, credentials, params

### Community 14 - "Community 14"
Cohesion: 0.13
Nodes (14): 3.1 — phaseEngine: buildSpillover(leads, remainingCapacity, now), 3.2 — dispositionEngine: M2/M3 outcome branches (inside buildDispositionPatch), 3.3 — UI wiring, 3.4 — Verification, BUILD SPEC — Machine Doctrine Implementation (M1 hardening + M2 + M3), CLOSEOUT EVERY SESSION, DEFERRED (do not build yet), DOCTRINE (one paragraph, memorize) (+6 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (23): [2026-04-01] v1.0.0 — Initial Build, [2026-05-01] v2.0.0 — Ministry Lead Operating System, [2026-05-13] v3.6 — Modular Architecture Refactor, [2026-05-14] v3.6.1 — Power Dialer + Audit Fixes, Added, Added, Added, Added (+15 more)

### Community 17 - "Community 17"
Cohesion: 0.40
Nodes (4): name, organization_id, organization_slug, ref

### Community 18 - "Community 18"
Cohesion: 1.00
Nodes (4): Dashboard Tab, Queue Tab, Settings Tab, Today's Block Tab

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (10): Review, Review S2, Review S2.5, Review S3, Session 1 — Correctness Fixes (2026-06-10), Session 2.5 — Funnel CSV Sync (2026-06-10), Session 2 — Calendar Phase Engine (2026-06-10), Session 3 — M2/M3 Spillover (2026-06-10) (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.19
Nodes (10): DashboardTab(), autoFollowUp(), openCalendlyPopup(), priority(), a, assignDate, b, lead (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.38
Nodes (5): DRAFT_OPTS, draftPrompt(), GEMINI_URL(), geminiCall(), leadCtx()

### Community 32 - "Community 32"
Cohesion: 0.60
Nodes (4): BUSINESS_HOURS, dayKey(), fmtHour(), HourlyStats()

## Knowledge Gaps
- **186 isolated node(s):** `Added`, `Changed`, `Fixed`, `Dependencies`, `Notes` (+181 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `inp()` connect `Community 1` to `Community 0`, `Community 7`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `autoFollowUp()` connect `Community 28` to `Community 0`, `Community 4`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `dayKey()` connect `Community 0` to `Community 28`, `Community 4`, `Community 7`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `Added`, `Changed`, `Fixed` to the rest of the system?**
  _186 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07796610169491526 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.10285714285714286 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._