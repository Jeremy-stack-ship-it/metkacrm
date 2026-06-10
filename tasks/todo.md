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
