# BUILD SPEC — Machine Doctrine Implementation (M1 hardening + M2 + M3)
Locked: 2026-06-10 · Inputs: AUDIT-2026-06-10.md + DESIGN-RECONCILIATION-2026-06-10.md + Jeremy's decisions
Prereq for every session: read BUILD.md. CRM src writes = Python via bash ONLY.

## DOCTRINE (one paragraph, memorize)
Pre-made schedule rules all; only contacted dispositions rebuild it. Calendar drives phase: Day 15→P2, 31→P3, 61→M2 (≤180d), 181→M3. M2/M3 are spillover-only. Missed blocks auto-log as no-answer and the schedule marches on. No-sale stays weekly (deliberate deviation) with agreement-based one-time trigger. Status wins over phase. No lead ever goes silently dark.

## SESSION 1 — Correctness (audit fixes, no new features)
1. F1: add `localDateKey()` (one helper, local YYYY-MM-DD); replace 2 UTC call sites in leads.js. Audit all lastContact comparisons compile against it.
2. F5/G4: masterQueueSort tiebreaker → next_dial ASCENDING, then lead_date ascending.
3. F3: extract `buildDispositionPatch(lead, dispId)` — single source for stage map, phase transition, auto-callbacks, notes, direct_vm logic. handleDisposition + handleTodayDispose both call it.
4. F6: deleteLead/addLead → functional updaters.
5. F9: addNote stamps lastContact only for type 'call'/'appointment', not plain notes.
Exit test: dial after 7PM → lead correctly suppressed today, surfaces tomorrow. Same disposition from DialView and TodaysBlock → identical patch.

## SESSION 2 — Calendar phase engine (G1, F4)
1. `effectivePhase(lead, now)`: derive from phase_start/lead_date age — 0-14 P1, 15-30 P2, 31-60 P3, 61-180 M2, 181+ M3. Stored `phase` becomes a cache, recomputed on startup + on read in getPhasePriority.
2. Day-61 M2 entry: wipe remaining sched cols, derive m2_tier (T1 no_sale/no_show/positive note history · T2 neutral contact history · T3 never engaged · T4 negative/dnc-adjacent → excluded), set m2_next_eligible = lastContact+14d (or now if none).
3. Day-181 M3 entry: m3_next_eligible = lastContact+30d. EXIT only via terminal disposition — no age-kill (Jeremy's M3 decision).
4. DELETE spreadOverdueLeads. Keep normalizePhaseSchedule (pointer repair within pre-made slots only).
5. Missed-block auto-log: on startup, slots whose datetime passed >24h ago without a logged dial → log activity event `[auto-logged: block missed]` outcome no-answer, consume slot, advance pointer. Counts as dial+attempt, 0 contacts (per handoff counting rule).
Exit test: lead seeded 90 days ago lands in M2 with correct tier; 200-day lead lands M3; nobody dark.

## SESSION 3 — Queue Spillover Integration (DETAILED SPEC — written 2026-06-10 pre-session)
**Goal:** M2/M3 leads fill spare dial-block capacity. M1 is NEVER interrupted (docs: spillover is bonus work, zero guaranteed time). Engagement promotes back to M1.

### 3.1 — phaseEngine: buildSpillover(leads, remainingCapacity, now)
- M2 pool: effectivePhase==='M2' AND m2_next_eligible <= now AND m2_tier <= 3 AND not EXIT/removed/terminal-disp/appointment_booked AND not contacted today (dayKey check).
- Sort: m2_tier ASC, then longest-since-contact first (null lastContact = never reached = first).
- M3 pool (only after M2 exhausted): m3_next_eligible <= now, same exclusions, oldest-contact first.
- Returns { m2: [...], m3: [...] } capped to remainingCapacity. Pure function.

### 3.2 — dispositionEngine: M2/M3 outcome branches (inside buildDispositionPatch)
When effectivePhase(freshLead) is M2/M3:
- Non-contact (no_answer, vm_left, direct_vm): patch m2_next_eligible = now+14d / m3_next_eligible = now+30d. NO slot consumption (no slots exist). AM/PM flip still applies.
- hung_up: same re-spacing as non-contact (human answered but negative — not momentum). ⚠ Jeremy may veto at gate → promote instead.
- Engagement (callback, follow_up_needed, appointment_booked): PROMOTE TO M1 — buildSchedule(now), phase='P1', phase_start=now, phase_start_reason='m2_reactivation'. Docs: "immediately reassign to Machine 1."
- no_show / no_sale: existing rebuilds work unchanged (no_show→P1, no_sale→P3 weekly per Jeremy).
- Terminal: existing EXIT wipe unchanged. DNC compliance unchanged.

### 3.3 — UI wiring
- TodaysBlock: spillover section BELOW M1 work — "M2 Reactivation (bonus)" amber + "M3 Deep Wave" grey, tier badges (T1/T2/T3), only renders when M1 list < session capacity. Header counts: "M1 due: x · M2 fill: y · M3 fill: z".
- DialQueuePanel session tiles: include spillover counts in capacity display.
- Phase chip: derived phase via effectivePhase (DialView already reads PHASE_DEFS — M3 def shipped v3.44).

### 3.4 — Verification
Node checks: tier-then-oldest ordering · capacity respected (M1 first, M2 only with room, M3 only after M2) · 14d/30d eligibility gates · promotion patch (callback on M2 lead → full P1 schedule + reason flag) · non-contact re-spacing · no_show/no_sale behavior unchanged · contacted-today exclusion · M1-never-interrupted invariant (spillover length === 0 when M1 fills capacity).
Exit test: 40-cap block with 10 due M1 leads pulls 30 spillover (T1 first); M2 answer + callback → lead holds full P1 schedule next render.

## SESSION 3b — AGE RE-BASE (separate gate, AFTER S3 verified live)
Flip leadAgeDays to prefer funnelAssignDate || assignDate (true age) over phase_start, EXCEPT when phase_start_reason is set (no_show/no_sale/m2_reactivation resets keep event-date aging — docs rule).
- dispositionEngine: stamp phase_start_reason on every rebuild (no_show, no_sale, m2_reactivation) starting Session 3.
- DRY-RUN FIRST: console-log projected phase distribution (P1/P2/P3/M2/M3 counts) WITHOUT applying — Jeremy approves the numbers, then the flip applies next startup. Expected: most of 2,440 → M2/M3 waves; Today queue unaffected (M1 due + spillover fill).
Exit test: lead with funnelAssignDate 2025-03, backfill phase_start 2026-05, no reason flag → M3. Lead with no_sale reset 10 days ago → P3 (floor) regardless of 2025 funnelAssignDate.

## SESSION 4-LITE — Flag Patch (REVISED 2026-06-11 after code verification)
Jeremy was right: Audit Held button (DialView v3.42, gated on apptConfirmed+booked → fires audit_ran → no_sale enroll) and Set Rate (DashboardTab, auditsRan/appts weekly) ALREADY EXIST. Backlog entry was stale. Remaining gaps only:
1. ContactDetail saveMeeting outcome 'Held' → also fire audit_ran (+ satEver). Today it writes a note only — Set Rate never hears about audits logged there.
2. Lifetime flags: apptSetEver (first booking; gate the stage→appointment_set activity event on !apptSetEver — rebooks currently re-fire and inflate the Set Rate denominator), satEver (first audit held; Audit Held button + saveMeeting both stamp it).
3. G10 write-order: appendActivity BEFORE persistLeads in leads.js upd()/logDial/addNote.
Half-session. Files: ContactDetail.jsx, leads.js, DialView.jsx (satEver stamp), dispositionEngine.js (apptSetEver on appointment_booked).

## SESSION 5 — Lead Order Economics (added 2026-06-10, from Jeremy+Derick convo)
Goal: per-lead-order P&L — never blended averages. "Razor Ridge numbers ≠ DLHA numbers ≠ aged analog."
1. `leadOrderId` on every lead — assigned at import (one import batch = one order by default; UI to name/split: "John DLHA wk 6/2"). Backfill historical orders by clustering (LeadSource + LeadLevel + AssignDate window).
2. Money-in fields per lead (adapted from Derick's Applications tab): apv, commissionPaid, advancePaid, paymentDate, appStatus (submitted/issued/paid/chargeback/cancelled). submittedDate/policyIssueDate auto-stamps already exist in leads.js — extend, don't duplicate.
3. Money-out: purchaseAmount per lead (CSV Session-2.5 capture) → order spend = Σ purchaseAmount.
4. Dashboard "Lead Orders" tab, one row per order: spend · leads · dials · contacts · appts · apps · APV · commission received · **break-even date** (day cumulative commission ≥ spend) · days-to-BE · ROI multiple. Cut by LeadLevel (DLHA vs CIH vs CIB...) and source.
5. Commission calc aware of 85% contract + advance rate; chargebacks subtract (UHL precedent).
6. Projection: median days-to-BE by level/source → forecast for sizing future orders (Derick's exact use case).
Depends on: Session 2.5 sync (cost+provenance fields), Session 4 flags (sat/set for funnel-stage rates).
