# Graph Report - metka-crm  (2026-06-11)

## Corpus Check
- 78 files · ~108,189 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 466 nodes · 845 edges · 33 communities (23 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f97432e6`
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
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]

## God Nodes (most connected - your core abstractions)
1. `MetkaCRM()` - 34 edges
2. `inp()` - 22 edges
3. `Changelog — Metka Field Ops CRM` - 13 edges
4. `isUWStuck()` - 13 edges
5. `dayKey()` - 12 edges
6. `applyPhaseTransition()` - 9 edges
7. `isDueToday()` - 9 edges
8. `daysInUW()` - 9 edges
9. `fmt()` - 9 edges
10. `UnderwritingCard()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `AppointmentConfirmModal()` --calls--> `fmt()`  [INFERRED]
  src/components/AppointmentConfirmModal.jsx → src/constants.js
- `MetkaCRM()` --calls--> `ccExchangeCode()`  [EXTRACTED]
  src/App.jsx → src/lib/ccIntegration.js
- `MetkaCRM()` --calls--> `buildDispositionPatch()`  [EXTRACTED]
  src/App.jsx → src/lib/dispositionEngine.js
- `MetkaCRM()` --calls--> `autoFollowUp()`  [EXTRACTED]
  src/App.jsx → src/lib/leadScoring.js
- `MetkaCRM()` --calls--> `priority()`  [EXTRACTED]
  src/App.jsx → src/lib/leadScoring.js

## Communities (33 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (41): StageStepper(), useAuth(), ACTIVITY_TYPES, aggregateActivity(), computeActivityQueue(), CONTACT_DISPS, dayKey(), DEFAULT_GOALS (+33 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (34): AddLeadForm(), AppointmentConfirmModal(), ContactDetail(), UnderwritingCard(), ContactsView(), DialRightPanel(), renderLiveTokens(), TOKEN_FIELDS (+26 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (35): active, activityNotes, allRows, archived, archiveNote, base64urlEncode(), bdayHtml, bdayNote (+27 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (23): INNER_TABS, SequenceTab(), TC, TD_STYLE, TH_STYLE, advanceSequence(), getTodayCallList(), initSequence() (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (41): DashboardTab(), PHASE_DEFS, QUICK_DISPS, SMS_SEQUENCES, AUTO_CALLBACKS, buildDispositionPatch(), DISP_NOTE_TEXT, DISP_STAGE_MAP (+33 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (20): dependencies, lz-string, react, react-dom, @supabase/supabase-js, @twilio/voice-sdk, devDependencies, jsdom (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.24
Nodes (14): btn(), card(), CCTab(), sectionLabel(), ccAuthorize(), ccClearTokens(), ccExchangeCode(), ccFetch() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (17): autoDetectMapping(), mapFunnelStatus(), parseBucket(), parseCSV(), parseDisp(), parseStage(), DISP_RANK, FIELD_KEYS (+9 more)

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
Cohesion: 0.15
Nodes (12): 3.1 — phaseEngine: buildSpillover(leads, remainingCapacity, now), 3.2 — dispositionEngine: M2/M3 outcome branches (inside buildDispositionPatch), 3.3 — UI wiring, 3.4 — Verification, BUILD SPEC — Machine Doctrine Implementation (M1 hardening + M2 + M3), DOCTRINE (one paragraph, memorize), SESSION 1 — Correctness (audit fixes, no new features), SESSION 2 — Calendar phase engine (G1, F4) (+4 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (25): [2026-04-01] v1.0.0 — Initial Build, [2026-05-01] v2.0.0 — Ministry Lead Operating System, [2026-05-13] v3.6 — Modular Architecture Refactor, [2026-05-14] v3.6.1 — Power Dialer + Audit Fixes, Added, Added, Added, Added (+17 more)

### Community 17 - "Community 17"
Cohesion: 0.40
Nodes (4): name, organization_id, organization_slug, ref

### Community 18 - "Community 18"
Cohesion: 1.00
Nodes (4): Dashboard Tab, Queue Tab, Settings Tab, Today's Block Tab

### Community 27 - "Community 27"
Cohesion: 0.17
Nodes (11): Review, Review S2, Review S2.5, Review S3, Session 1 — Correctness Fixes (2026-06-10), Session 2.5 — Funnel CSV Sync (2026-06-10), Session 2 — Calendar Phase Engine (2026-06-10), Session 3 — M2/M3 Spillover (2026-06-10) (+3 more)

### Community 28 - "Community 28"
Cohesion: 0.22
Nodes (9): autoFollowUp(), openCalendlyPopup(), priority(), a, assignDate, b, lead, result (+1 more)

### Community 29 - "Community 29"
Cohesion: 0.38
Nodes (5): DRAFT_OPTS, draftPrompt(), GEMINI_URL(), geminiCall(), leadCtx()

### Community 32 - "Community 32"
Cohesion: 0.60
Nodes (4): BUSINESS_HOURS, dayKey(), fmtHour(), HourlyStats()

## Knowledge Gaps
- **188 isolated node(s):** `Added`, `Changed`, `Fixed`, `Dependencies`, `Notes` (+183 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `inp()` connect `Community 1` to `Community 0`, `Community 7`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `priority()` connect `Community 28` to `Community 0`, `Community 1`, `Community 4`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `autoFollowUp()` connect `Community 28` to `Community 0`, `Community 4`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `Added`, `Changed`, `Fixed` to the rest of the system?**
  _188 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07704918032786885 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11054421768707483 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._