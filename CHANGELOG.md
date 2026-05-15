# Changelog — Metka Field Ops CRM

All notable changes to this project are documented here. Format: [Date] v[Version] — [Theme]

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

**Last Updated**: 2026-05-13
**Current Version**: v3.6
**Status**: ✅ Complete — App.jsx fully refactored. All inline functions extracted to lib/ modules. Factory instantiation live (lines 786–795).
