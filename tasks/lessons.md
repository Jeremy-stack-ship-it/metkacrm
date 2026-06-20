
## 2026-06-11 — Specced from stale backlog instead of reading code
**What happened:** Wrote the full S4 spec (Audit Held button + Set Rate) from a 2026-05-29 backlog memory entry. Jeremy said "I thought this existed already" — he was right: the button shipped in v3.42, Set Rate is fully wired in DashboardTab. The backlog entry was never marked done.
**Why it matters:** BUILD.md "Read Before Touching" applies to SPECS too, not just edits. Memory entries are point-in-time; features ship after them.
**How to apply:** Before speccing any feature, grep the codebase for it FIRST (30 seconds). Mark backlog entries done at session closeout. Trust Jeremy's product memory — he uses the app.

## 2026-06-11 — Heredoc escape corrupted an insert (caught same-minute)
**What happened:** Python-in-heredoc used s.find('\\n') — found a LITERAL backslash-n inside an alert string, not a newline; the LeadOrdersView import got injected mid-string in App.jsx.
**How caught:** immediate grep verify after the insert (BUILD.md read-verify rule). Repaired before build.
**How to apply:** in << 'EOF' heredocs, python escapes are literal — use chr(10) or regex re.search(r"...\n") for newlines. ALWAYS grep-verify any positional insert immediately.

## 2026-06-11 — New parser fields must be added to the field-map whitelist
**What happened:** v3.45 added 9 fields to autoDetectMapping + parseCSV, but confirmFieldMapping's allKeys whitelist in useImportHandlers rebuilds the idxMap from scratch — unlisted keys are silently dropped on every modal-confirmed import. All money/source data lost until Jeremy's ORDERS screenshot exposed it.
**How to apply:** parseCSV fields have THREE registration points: autoDetectMapping, the lead object in parseCSV, AND allKeys in useImportHandlers. Touch all three or the field doesn't exist. End-to-end test imports must go through the MODAL path (customIdxMap), not bare parseCSV — my S2.5 tests called parseCSV directly and missed this.

## 2026-06-12 — Proposed merging the tool Jeremy loves into the tool he doesn't use for dialing
**What happened:** Specced "Block absorbs DialView" + mockup. Jeremy: scared, then veto — "I like my DialView far more for seamless dialer uses." He was right: DialView is a refined cockpit (Twilio, scripts, auto-advance) shaped by real use; the Block is a planner that drifted.
**How to apply:** When two surfaces overlap, the one shaped by daily USE wins; feed it data, don't replace it. Never propose retiring a tool the user reaches for under pressure. Mock up BEFORE speccing retirement language — "DialView retires" caused the fear, not the architecture.


---

## 2026-06-17 — Split-Brain Recurred: SMS panel (v3.90)

**Pattern (2nd occurrence — see the 2026-06-16 sequence-engine entry):** Two copies
of the same UI drifted. The SMS thread exists as the shared `SmsThread.jsx` (used by
DialView) AND as an inline `SmsThreadTab` inside ContactDetail. We kept adding
templates/buttons to the shared one (No-Answer rotation, 🔥 intro, INTRO) and the
inline lead-view copy silently fell behind — Jeremy noticed the INTRO/templates
missing when opening a lead.

**Fix:** Point ContactDetail's SMS tab at the shared `<SmsThread/>`. Confirmed superset
before swapping so nothing regressed.

**Rule:** When a feature lives in a shared component, do NOT leave a parallel inline
copy in another view. If you find a duplicate panel/engine, unify on the shared one.
Before swapping, verify the shared version is a superset (grep both feature sets).
Known remaining duplicates to watch: the old SmsThreadTab is now orphaned (delete later).
