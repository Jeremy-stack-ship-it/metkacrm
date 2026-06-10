# DESIGN RECONCILIATION — Strategy Docs vs Metka CRM Code — 2026-06-10
Sources: Full Lead Strategy Execution Plan (18pp, incl. no-show/no-sale/M2 addenda) · Lead Strategy Manager System Handoff v2 (Derick Jelley, 2026-05-01) · phaseEngine.js + App.jsx (audited 2026-06-10)

## VOCABULARY (per the docs — authoritative)
- **Machine 1** = the ENTIRE days 0–60 structured dial system: P1 (0–14, every other day) → P2 (15–30, 2x/wk) → P3 (31–60, 1x/wk). Includes Day 0 protocol, no-show/no-sale re-entry, Track A/B.
- **Machine 2** = days 60–180 aged reactivation. NO structured cadence — spillover-only (worked when M1 block work is done), tiered T1–T4, min 10–14 days between contacts, engagement → reassign to M1. Day 181 → dead/exit.
- ⚠️ OPEN: docs kill leads at 181+. Jeremy's database is MOSTLY 181+ (Bucket C = 1,711 leads 12mo+). His "deeper wave" intent extends past the docs. Needs a named third wave.

## WHERE CODE MATCHES DOCS ✓
- 16 forward-schedule columns on the lead (p1_1–p3_5) — same architecture as Sheet cols S–AH
- next_dial = earliest non-empty future slot (computeNextDial ≈ col AK formula)
- Priority order: no_sale → no_show → P1 → P2 → P3 → M2
- Status-wins-over-phase bucketing (CALLBACK_DISPS split in buildSessionQueue)
- Wipe-on-terminal, wipe+rebuild on no-show, freeze on appointment-set
- Callback cap per block (37.5% vs docs' 50% — minor)
- Day-boundary inclusivity mostly right (P1 ≤14, P2 from 15)

## GAPS — DOCS REQUIRE, CODE LACKS
| # | Gap | Docs say | Code does |
|---|-----|----------|-----------|
| G1 | **Calendar phase transitions** | Day 15→P2, Day 31→P3, Day 61→M2 (if ≤180d), Day 181→exit. Checked on every read. | Phase set once, never advances (= audit F4). No M2 entry, no 181 exit — leads go silently dark after p3_5. |
| G2 | **M2 machinery** | phase=M2, m2_tier 1–4 from history, schedule cols wiped, spillover-fill in blocks, 10–14d min spacing, oldest-last-contact first, engagement→back to M1 | Nothing. "M2" is a label with priority 50. |
| G3 | **No-sale two-stage** | Stage 1: agreement-based trigger date (default 3 days). No response → Stage 2: reset to P1 from event date, full rebuild. | no_sale → enters at P3/day 31 ("SMS owns days 1–30"). With SMS automation deferred, no-sale leads — highest value in the system — get weekly dials and no SMS. Direct contradiction. |
| G4 | **Sort within bucket** | next_dial ASCENDING (earliest/most overdue first), then lead_date | masterQueueSort descending (= audit F5 confirmed by spec) |
| G5 | **Lifetime flags** | appointment_set + sat — never revert, hard cap 1, drive Set Rate | Don't exist. (Backlog "Set Rate metric" needs exactly this.) |
| G6 | **Missed-block philosophy** | Full plan: reschedule within 48h same window type. Handoff: Derick chose auto-log-as-no-answer, schedule continues. Explicitly a per-user decision. | Neither — spreadOverdueLeads invents future dates (doctrine violation, slated for removal). OPEN — Jeremy must choose. |
| G7 | **Day 0 protocol** | Immediate contact on arrival, outside blocks | p1_1 = day 0 at 9 AM fixed |
| G8 | **m2_tier derivation** | T1 no_sale/no_show/positive · T2 neutral · T3 no engagement · T4 negative/rejected/>180d | No tier field, no derivation |
| G9 | Day-30 gap | P2 = 15–30 inclusive | p2_5 = day 29, p3_1 = day 31 — day 30 orphaned |
| G10 | Write-order rule | Dial Log FIRST, then lead row (crash-safe reconciliation) | persistLeads first, activity append second (reversed) |

## CODE HAS, DOCS DON'T (Jeremy's extensions — keep)
- AM/PM slot flip on no-answer (never same time twice) — stronger than docs' Track A/B (which is entry-distribution only)
- Direct VM counter w/ auto-retire at 5
- Supabase realtime sync, tombstones, beacon flush
- 3×16-step SMS nurture ladders (content library, automation deferred)
- Sequence engine scaffolding (drip layer docs don't have)

## DEFERRED REFERENCE (not read in depth — for SMS design phase later)
Quility campaign PDFs: Digital/Analog MP, Digital GL, IUL, General Re-Engagement, Funnel Engagement Templates, A2P Best Practices ×2. Use as the content/compliance source when Jeremy is ready to design drips.

## OPEN DECISIONS (blocking M1/M2 build spec)
1. Third wave for 181+ leads (docs exclude; Jeremy's Bucket C lives there) — name, cadence, eligibility
2. Missed-block philosophy: auto-log vs strict reschedule
3. No-sale re-entry: docs' Stage1+Stage2 (recommended while SMS deferred) vs current P3 entry
