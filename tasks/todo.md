# Session 1 — Correctness Fixes (2026-06-10)
Plan approved by Jeremy ("go"). Spec: tasks/SPEC-M1-M2-M3-BUILD.md Session 1.

- [x] F1: localDateKey() helper; fix 2 UTC call sites in leads.js (addNote, logDial)
- [x] F9: addNote stamps lastContact only for call/appointment note types
- [x] F5: masterQueueSort tiebreaker → aTs - bTs (earliest due first)
- [x] F3: new src/lib/dispositionEngine.js — buildDispositionPatch(); rewire handleDisposition + handleTodayDispose
- [x] F6: deleteLead/addLead → functional updaters
- [x] Verify: vite build clean + behavior checks
- [x] Closeout: commit, changelog paste, ARCHIVE.md, lessons.md if corrected

## Review
All 5 fixes landed, 16/16 behavior checks pass, vite build clean, dist updated.
Design notes: dayKey() reused (already local) instead of new helper. masterQueueSort null-next_dial
gets Infinity sentinel so schedule-less leads keep sorting last under ascending order.
no_sale → P3 entry PRESERVED per Jeremy's deliberate weekly-cadence decision (not the docs' P1 rebuild).
DISP_NOTE_TEXT 'follow_up' key quirk preserved as-is (follow_up_needed gets autoNote, not dispNote) — flag for S2 review.
No corrections this session — lessons.md untouched.


# Session 2 — Calendar Phase Engine (2026-06-10)
- [x] effectivePhase/leadAgeDays/PHASE_ORDER + floor rule
- [x] getPhasePriority derived + M3=45
- [x] migrateAgedPhases (M2 day61+/M3 day181+, tier derivation, eligibility)
- [x] processMissedSlots (auto-log, lastSeen guard, silent first run)
- [x] spreadOverdueLeads DELETED
- [x] backfillLead M2 path fixed
- [x] isDueToday M2/M3 gate + callback exception
- [x] App.jsx startup rewire + F7 supabase push of changed subset
- [x] 40/40 behavior checks, vite build clean, dist updated

## Review S2
Deviation from gate statement: silent first-run consumption logs a console summary, not an activity-log
note event (avoids non-standard event type breaking aggregations). Flagged TodaysBlock PHASE_DEFS
duplication for future dedup. lastSeen key: metka-last-seen-v1.


# Session 2.5 — Funnel CSV Sync (2026-06-10)
- [x] csvParser: 9 new columns, mapFunnelStatus exported + 3 status fixes + sold stages
- [x] funnelSync.js: leadCode matching, never-downgrade ladder, DNC override, NI fence, churn guard
- [x] useImportHandlers 'sync' mode + ImportModal green sync button
- [x] 30/30 checks incl. real-export dry-run (2,589 rows, 4 Issue Paid correctly filed)

## Review S2.5
funnelAssignDate stored but age re-base deferred until after S3 (queue-safety decision).
inFunnel flag = SMS deconfliction source of truth. Conflicts surface in console + alert.


# Session 3 — M2/M3 Spillover (2026-06-10)
- [x] buildSpillover: tier/oldest ordering, capacity + eligibility gates
- [x] dispositionEngine aged branch: promote on engagement, re-space on non-contact
- [x] phase_start_reason stamps (no_show/no_sale/m2_reactivation)
- [x] TodaysBlock spillover UI + header counts + M3 legend
- [x] 23/23 checks, build clean

## Review S3
Deviations from gate: appointment_booked on aged lead keeps freeze behavior (docs-correct) rather than
promoting — post-appointment outcomes (no_show→P1/no_sale→P3) handle re-entry. No App.jsx change needed —
spillover is fully self-contained in TodaysBlock (cleaner than specced).


# Session 3b — Age Re-base dry-run (2026-06-11)
- [x] AGE_REBASE_ACTIVE flag (OFF) + true-age basis + event-aging exceptions (flag/inference)
- [x] dryRunAgeRebase pure projection + startup log
- [x] 13/13 checks, build clean
Awaiting: Jeremy's projection numbers → flip approval.


# Session 3c — Flip + Resurrection dry-run (2026-06-11)
- [x] AGE_REBASE_ACTIVE → true (projection approved)
- [x] classifyExitLead / resurrectBucketC / dryRunResurrection behind RESURRECTION_ACTIVE=false
- [x] startup wiring (apply path + dry-run log), 18/18 checks
Awaiting: Jeremy's resurrection split numbers → flip approval.


# Session 4-lite — Flags patch (2026-06-11)
- [x] apptSetEver: disposition + stage + note paths, gated once-ever
- [x] satEver: DialView button + saveMeeting Held
- [x] saveMeeting Held → audit_ran (logActivity prop chain App→ContactDetail)
- [x] G10 write order: activity before persist
- [x] 6/6 checks, build clean
