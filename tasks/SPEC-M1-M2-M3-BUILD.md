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

## SESSION 3 — Queue integration (G2/M3 fill + caps)
1. buildSessionQueue: fill order = callbacks (cap ~50%, align from 37.5%) → P1 → P2 → P3; if under capacity → M2 (T1→T2→T3, oldest last_contact first, respect m2_next_eligible) → M3 (oldest first, respect m3_next_eligible, monthly spacing).
2. M2/M3 dial outcome: any engagement (contacted/callback/appointment) → reassign to M1: rebuild schedule from today, phase_start=now. Non-contact → next_eligible = now+14d (M2) / +30d (M3).
3. No-sale agreement trigger: optional `nextCallback` date captured at no_sale disposition ("they said Thursday") — surfaces as callback at priority 100 on that day, one-time; weekly P3 cadence otherwise.
4. UI: phase chip shows derived phase (P1 Day 4 · M2 T1 · M3); TodaysBlock sections for M2/M3 spillover, visually below M1 work.
Exit test: 40-cap block with 10 due M1 leads pulls M2 T1 fill; M2 answer → lead reappears in P1 next session.

## SESSION 4 — Flags + metrics (G5)
1. Lifetime flags `appointment_set`, `sat` (never revert, cap 1 per lead). "Audit Held" button fires sat + audit_ran event.
2. Set Rate (ran ÷ set) on dashboard. Write-order: activity event BEFORE lead persist (G10, crash-safe).

## DEFERRED (do not build yet)
- SMS drip automation. REAL constraint (Jeremy, 2026-06-10): A2P is APPROVED and he CAN send — but SFG Switchboard Funnel already runs automated texts on his active leads. Two systems texting one family = spam perception + phone reputation damage. PRECONDITION before any Metka automated SMS: deconfliction rule — Metka sequences may only target leads NOT active in Funnel automations (i.e., the aged M2/M3 database, or leads confirmed exited from Funnel). Need from Jeremy: how long Funnel's automations run / which leads they cover, then scope Metka drips strictly outside that boundary. Content sources ready: 3×16 ladders in code + Quility campaign PDFs in uploads.
- F2 RLS/auth — mandatory gate before ANY public deploy; not needed local-only.
- Inbound SMS pipeline (separate diagnosis: Twilio webhook → receive-sms Edge Function). On backlog.
- Email reply awareness (Gmail sweep brief — can ship as scheduled task anytime, zero CRM code).

## CLOSEOUT EVERY SESSION
Version bump + CHANGELOG.md + Google Doc change log + ARCHIVE.md + lessons.md if corrected.

## SESSION 5 — Lead Order Economics (added 2026-06-10, from Jeremy+Derick convo)
Goal: per-lead-order P&L — never blended averages. "Razor Ridge numbers ≠ DLHA numbers ≠ aged analog."
1. `leadOrderId` on every lead — assigned at import (one import batch = one order by default; UI to name/split: "John DLHA wk 6/2"). Backfill historical orders by clustering (LeadSource + LeadLevel + AssignDate window).
2. Money-in fields per lead (adapted from Derick's Applications tab): apv, commissionPaid, advancePaid, paymentDate, appStatus (submitted/issued/paid/chargeback/cancelled). submittedDate/policyIssueDate auto-stamps already exist in leads.js — extend, don't duplicate.
3. Money-out: purchaseAmount per lead (CSV Session-2.5 capture) → order spend = Σ purchaseAmount.
4. Dashboard "Lead Orders" tab, one row per order: spend · leads · dials · contacts · appts · apps · APV · commission received · **break-even date** (day cumulative commission ≥ spend) · days-to-BE · ROI multiple. Cut by LeadLevel (DLHA vs CIH vs CIB...) and source.
5. Commission calc aware of 85% contract + advance rate; chargebacks subtract (UHL precedent).
6. Projection: median days-to-BE by level/source → forecast for sizing future orders (Derick's exact use case).
Depends on: Session 2.5 sync (cost+provenance fields), Session 4 flags (sat/set for funnel-stage rates).
