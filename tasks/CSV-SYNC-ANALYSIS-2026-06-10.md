# FUNNEL CSV → METKA CRM SYNC ANALYSIS — 2026-06-10
Source: Export_Leads Export_38201 (2,589 rows × 57 cols) vs src/lib/csvParser.js + useImportHandlers.js

## HEADLINE FINDINGS
1. **The CSV has NO last-contact-date column.** "Getting ahold of someone" is signaled ONLY by LeadStatus changing (New Lead → Contact Attempted / Active Lead). Sync must be status-diff based.
2. **Re-import today silently drops every existing lead** (append mode skips phone matches) — so status changes in Funnel NEVER reach the CRM. Confirmed in useImportHandlers (newLeads vs dupes split; dupes unused on append).
3. **Row delta: 2,589 in Funnel export vs ~2,440 in CRM** — at least ~150 leads exist only in Funnel.
4. **LeadCode (100% filled, unique vendor ID) is the correct sync key — not phone.** Phone matching collides on spouses sharing a number (= audit F8 root cause). LeadCode is currently UNMAPPED and discarded.

## STATUS MAPPING — what survives parseCSV.mapStatus
| Funnel LeadStatus | Count | Maps to | OK? |
|---|---|---|---|
| New Lead / New | 1,960 | not_called / new track | ✓ |
| No Contact (Unreachable) / Unreachable | 172 | no_answer / ghost | ✓ |
| Contact Attempted | 145 | callback / re-engage | ✓ |
| Active Lead / Contacting | 138 | callback / re-engage step 1 | ✓ |
| No Interest / Not Interested | 86 | not_interested | ✓ |
| Appointment / Appointment Set | 33 | interested / booked | ✓ |
| Application Taken MP/FE, Sold/App Taken, App Submitted | 36 | submitted / sold | ✓ |
| Credit Approved / Credit Denied / Declined | 5 | interested / not_interested | ✓ |
| Do Not Call (DNC) | 1 | dnc | ✓ |
| **Call Again** | **8** | **not_called — WRONG** (should be callback) | ✗ |
| **Issue Paid** | **4** | **not_called — WRONG** (sold & paying client → issued, 5 R's list!) | ✗ |
| **Not Taken** | **1** | **not_called — WRONG** (post-decision → no_sale-type) | ✗ |
13 unmapped souls total — 4 of them are PAYING CLIENTS the CRM thinks were never dialed.

## COLUMN COVERAGE — auto-mapping vs the real export
**Captured today (header match confirmed):** FirstName/LastName, CellPhone→Phone→HomePhone/WorkPhone fallback, State, City, County, Zip, Email (33%), Age (96%), LoanAmount (99%), LeadType, LeadLevel, LeadStatus, AssignDate, PDFURL, Comments→note.
**Filled but DISCARDED:**
- **LeadCode (100%)** — vendor unique ID. THE sync key. Also dedup-safe (spouses).
- **LeadAssignmentID (100%)** — secondary stable ID.
- **Sex (94%)** — Derick's dial PDFs show age/sex; scripts/product fit use it.
- **LeadSource (100%) + LeadSubSource (99%)** — VENDOR/Lighthouse/ADS/SFG/Referral split; needed for ROI-by-source and 50/50 lead-partnership accounting (John/Michelle splits).
- **Street (70%)** — mortgage protection = address matters (the home IS the subject).
- **ExclusivityEndDate (46%)** — when exclusivity lapses, vendor may resell the lead; urgency signal.
- **PurchaseAmount (100%)** — lead cost! Enables true CPA / ROI per lead and per source.
- **Birthday (7%)**, ExtPartnerID (71%), AgentID.
**Empty in this export (ignore):** HealthQuestions, income fields, mortgage detail fields, Consent, LeadIntent, beneficiary fields (47 rows), Weight, etc.

## DATA QUALITY FLAGS
- 1 lead in **DE — not licensed** (16 licensed states exclude DE). Exclude from dial queue or refer out.
- CA(2)/WA(1)/MO(1) — licensed ✓ but tiny out-of-core volume.
- Comments max length 30 chars, no dates — they're labels, not notes. Import as-is is fine; today's-timestamp issue is moot here.
- Bucket fallback works: no bucket/tier/days cols → assignDate rule (≥2026→A, ≥2025-10→B, else C). AssignDate spans 2025-01→2026-06.

## SYNC MODE SPEC (new import mode 3 — "Sync from Funnel")
1. Match on **LeadCode** first (store it on lead as `leadCode`); fall back to phone for legacy rows; tag matches.
2. For matched leads: diff LeadStatus → if changed, apply mapStatus patch THROUGH buildDispositionPatch (so phase doctrine applies), append note "🔁 Funnel sync: <old> → <new> (sync date)". NEVER touch notes/schedule/phase otherwise. _ts bumps.
3. For CSV-only leads (~150): import as new (current path).
4. For CRM-only leads: report list (possible Funnel deletes) — no auto-action.
5. Fix mapStatus: Call Again→callback, Issue Paid→issued+stage issued (5 R's), Not Taken→no_sale-equivalent.
6. Capture new fields on ALL imports: leadCode, leadAssignmentId, sex, leadSource, leadSubSource, street, exclusivityEndDate, purchaseAmount, birthday.
7. Sync report on completion: X updated, Y new, Z unchanged, N CRM-only, status-change list.
8. **Funnel-active flag:** any lead whose status changed in Funnel within export window = active in Funnel → SMS deconfliction boundary uses this.
Build slot: insert as SESSION 2.5 in SPEC-M1-M2-M3-BUILD.md (after calendar engine, before queue integration) — or pull forward if Jeremy wants sync sooner.
