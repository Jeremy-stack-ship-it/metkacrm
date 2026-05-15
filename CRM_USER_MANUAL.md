# Metka Field Ops CRM — User Manual
**Senior Field Underwriter: Jeremy Metka | Metka Solutions**
**Version 2.0 | May 1, 2026**

---

## FIRST TIME SETUP

### Step 1 — Activate the Phase System
Before your first dial session, you must run the backfill. This assigns every lead a phase and forward schedule.

1. Go to **Settings** tab
2. Scroll to **Phase Lifecycle Engine**
3. Click **Activate Phase System**
4. Watch the Phase Summary bar populate — it will show counts for P1, P2, P3, M2, EXIT

Do this once. Do not hit Reset unless you want to wipe all schedules and restart from scratch.

### Step 2 — Connect Supabase (if not already done)
In Settings → Supabase Config, paste your URL and Anon Key. This enables cloud sync so your data survives a browser clear.

---

## DAILY WORKFLOW — THE STANDARD OPERATING PROCEDURE

### Morning (Start of Session)
1. Open `http://localhost:5173` (or app.metkasolutions.com when deployed)
2. Click **⚡ TODAY** tab
3. Click **START BLOCK**
4. The timer starts. Your 30 leads are loaded, priority-sorted, and ready.

### During the Block
Work the list top to bottom. Do not skip leads. The sort order is intentional — recoveries first, then fresh P1 leads, then P2, then P3.

**For each lead:**
1. Click **DIAL** — your phone opens, the contact is auto-logged
2. After the call, select a disposition from the dropdown that appears
3. Optionally click **SMS** to send a follow-up text
4. Move to the next lead

**Target: 30 dials per session. 710 dials per week.**

### End of Session
Click **END BLOCK**. The timer stops. Your progress is saved.

---

## THE ⚡ TODAY TAB — DETAILED

### What Leads Appear Here
Only leads that are **due today or past due** and **not in EXIT** appear in your block. The engine compares today's date against each lead's next scheduled dial date (the minimum of all future schedule columns).

**Lead is eligible if:**
- `next_dial` ≤ today
- Phase is P1, P2, P3, or M2
- Has not been set to EXIT (dnc, not_interested)
- Has not booked an appointment (appointment_booked freezes the schedule)

### Priority Order (Top to Bottom)
| Priority | Disposition | Why |
|----------|-------------|-----|
| 1st | no_sale | Sat with them, didn't close — restart immediately |
| 2nd | no_show | Booked but ghosted — restart immediately |
| 3rd | P1 leads | Fresh, hottest window (Days 0–14) |
| 4th | P2 leads | Active follow-up (Days 15–29) |
| 5th | P3 leads | Weekly check-in (Days 31–59) |
| 6th | M2 leads | Aged reactivation (60+ days) |

### The 50% Recovery Cap
No_sale and no_show leads are capped at **15 of your 30 block slots**. This prevents a flood of recycled leads from pushing out fresh P1 contacts. The engine enforces this automatically.

### Disposition Guide
| What Happened | Select This |
|---------------|-------------|
| They answered, full conversation, did not buy | `no_sale` → resets P1 |
| They had an appointment and didn't show | `no_show` → resets P1 |
| No answer, no voicemail | `no_answer` → advances schedule |
| Left a voicemail | `vm_left` → advances schedule |
| Said call back at a specific time | `callback` → advances schedule |
| Appointment booked | `appointment_booked` → freezes schedule |
| Said do not call / not interested | `dnc` or `not_interested` → EXIT |

### After You Log a Disposition
The lead's next dial date auto-recalculates. If you set `no_sale` or `no_show`, the full 7-call P1 sequence restarts from today. The lead will reappear in your block starting tomorrow.

---

## SMS MODAL — HOW TO SEND TEXTS

All texts are manual (TCPA compliant — no ATDS). Click DIAL first, then click SMS.

### The 4 Templates

**1. Initial Outreach** (use on Day 0 — first contact)
> "Hi [First Name], this is Jeremy Metka with Metka Solutions. You recently requested information on protecting your household. I have your file pulled and wanted to reach out. When's a good time for a quick 20-minute call this week? Reply STOP to opt out."

**2. Verification** (use Day 2–4 — rapport building)
> "Hi [First Name], Jeremy Metka here with Metka Solutions. I'm verifying the contact on file for your Household Protection Audit request. Is this still the best number to reach you? Reply STOP to opt out."

**3. Ghost Protocol** (use Day 10–12 — force a response)
> "Hi [First Name], this is Jeremy Metka with Metka Solutions. I'm wrapping up regional files for your area this week and closing out household files I haven't been able to connect on. If you're still interested in reviewing your household's coverage, reply back or call me at (580) 263-5359. Otherwise, I'll close the file. Reply STOP to opt out."

**4. Scheduling Ask** (use any time — direct booking push)
> "Hi [First Name], Jeremy Metka here. I have a spot open [Day] at [Time] for your Household Protection Audit. Does that work? Here's my booking link: [Calendly]. Reply STOP to opt out."

### How to Send
1. Click template
2. It copies to clipboard automatically
3. Click "Open SMS" — your native messaging app opens with the lead's number
4. Paste (Ctrl+V) and send

**Do not include Calendly links in messages until your A2P campaign is approved by Twilio.**

---

## THE QUEUE TAB

Your full lead list. Use this for:
- Searching specific leads
- Viewing lead detail (full activity log, contact info, notes)
- Manually updating stage, disposition, or notes
- Adding leads one at a time

Clicking "Open" on a lead in Today's Block takes you directly to that lead's detail view in Queue.

---

## THE DASHBOARD TAB

Weekly performance view. Tracks:

- **Contact Rate** — % of dials where someone answered (target: 15%)
- **Show Rate** — % of appointments that actually showed (target: 70%)
- **Close Rate** — % of shows that became policies (target: 40%)
- **Week Dials** — running dial count vs. 710/week target
- **Financial Tracker** — estimated weekly commission vs. overhead ($3,921/mo = ~$980/week)
- **Break-even Progress** — visual bar showing where you stand vs. your $2,121/mo net target

---

## SETTINGS TAB

### Phase Lifecycle Engine
- **Activate Phase System** — Run once to backfill all leads
- **Reset All Phases** — Emergency reset (wipes and restarts all schedules from today)
- **Phase Summary** — Live count per phase

### CSV Import
Import leads from your lead vendor spreadsheets. Required columns: `firstName`, `lastName`, `phone`. Optional: `email`, `state`, `bucket`, `source`.

All imported leads are auto-assigned a phase based on their bucket (A/B/C) and age.

### Manual Add Lead
Add a single lead with full contact info. Auto-enters P1 immediately.

### Supabase Config
Cloud sync credentials. If you clear your browser, leads are restored from Supabase on next load. Your lead data is safe.

### Export
Downloads all leads as CSV. Use this to back up your data or hand off a list to a new agent.

---

## PHASE LIFECYCLE — FULL SCHEDULE REFERENCE

When a lead enters P1, the system schedules all 17 future dial attempts:

| Column | Day | Phase |
|--------|-----|-------|
| p1_1 | Day 0 | P1 |
| p1_2 | Day 2 | P1 |
| p1_3 | Day 4 | P1 |
| p1_4 | Day 6 | P1 |
| p1_5 | Day 8 | P1 |
| p1_6 | Day 10 | P1 |
| p1_7 | Day 12 | P1 |
| p2_1 | Day 15 | P2 |
| p2_2 | Day 18 | P2 |
| p2_3 | Day 22 | P2 |
| p2_4 | Day 25 | P2 |
| p2_5 | Day 29 | P2 |
| p3_1 | Day 31 | P3 |
| p3_2 | Day 38 | P3 |
| p3_3 | Day 45 | P3 |
| p3_4 | Day 52 | P3 |
| p3_5 | Day 59 | P3 |

After Day 59 with no conversion → lead moves to M2 (Machine 2 — aged reactivation pool).

---

## RUNNING THE CRM LOCALLY

```
cd "C:\Users\jamn1\OneDrive\Documents\Claude\Projects\Ministry of Protection HQ\metka-crm"
npm run dev
```

Open browser to: `http://localhost:5173`

To build for deployment (Squarespace / app.metkasolutions.com):
```
npm run build
```
Upload the `dist/` folder contents to your Squarespace file manager.

---

## QUICK REFERENCE — DAILY TARGETS

| Metric | Daily | Weekly |
|--------|-------|--------|
| Dials | 142 | 710 |
| Apps | 1 | 5 |
| Contact Rate Goal | 15% | — |
| Show Rate Goal | 70% | — |
| Close Rate Goal | 40% | — |

---

## COMPLIANCE REMINDERS

- **Manual dial only** — no auto-dialers, no pre-recorded messages
- **Hours: 8:00 AM – 9:00 PM local time** for the lead's state
- **STOP opt-out** — every text must include it; honor within 1 business day
- **No SMS ads** — texts are for appointment confirmation and follow-up only
- **A2P campaign** — Calendly links and external URLs go into texts only after Twilio approves your campaign
- Ministry of Protection is **internal language only** — all client-facing contact uses "Jeremy Metka / Metka Solutions"

---

*Metka Solutions | Jeremy Metka, Senior Field Underwriter | NPN #21425108*
*E&O: CNA Insurance — Policy #596427449*
