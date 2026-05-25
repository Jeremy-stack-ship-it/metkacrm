// ── DEFAULT SCRIPTS ──────────────────────────────────────────────
// Seed script library. Loaded on first run if no saved scripts exist.
// Keys match leadType values used in the lead schema.

const DEFAULT_SCRIPTS = {
  "Mortgage Protection": {
    phone: `B.E.S.T. PHONE OPENER — MORTGAGE PROTECTION\n\n"Hey [FIRST_NAME]? — Hey, this is Jeremy Metka, I'm calling about your mortgage in the amount of [LOAN_AMOUNT] over at [CITY]."\n\n[Pause — wait for response]\n\n"I was getting back to you about your request for Mortgage Protection coverage designed to protect your family and pay off your mortgage. I just need to quickly verify the information you provided so we can get your options out to you."\n\n"I have your age as [AGE], is that correct? And are you in [CITY], [STATE]?"\n\nHEALTH QUALIFIER (quick):\n1. "Have you used any tobacco in the last 12 months?"\n2. "How's your health overall — any major conditions in the last 5-10 years?"\n3. "Any medications your doctor has you on?"\n4. "What does your mortgage payment run per month?"\n5. "Is that a 15 or 30-year?"`,
    appointment: `SFG MORTGAGE PROTECTION PRESENTATION (Newest Script)\n\nINTRO / WARM UP:\n"Hello [FIRST_NAME], this is Jeremy. I was following up on your request for Mortgage Protection coverage options to protect your family and mortgage. I just need to verify the info you submitted."`,
    objections: `OBJECTION HANDLING — MORTGAGE PROTECTION\n\n"I DON'T REMEMBER THIS."\n"I'm not surprised — it's been a while. It's for the [LOAN_AMOUNT] protection on the home in [CITY]. My job is just to close the file."`
  },
  "Life Insurance": {
    phone: `B.E.S.T. PHONE OPENER — LIFE INSURANCE\n\n"Hey [FIRST_NAME]? — Hey, this is Jeremy Metka. I'm calling about your request for life insurance coverage."`,
    appointment: `GENERAL LIFE INSURANCE SCRIPT\n\nROLE + PURPOSE:\n"Hey [FIRST_NAME], this is Jeremy. I'm calling about our chat regarding your family's life insurance options."`,
    objections: `OBJECTION HANDLING — LIFE INSURANCE\n\n"I CAN'T AFFORD IT."\n"I hear that — and it's exactly why I want to sit down with you..."`
  },
  "Living Benefits Lead": {
    phone: `LIVING BENEFITS LEAD — DAY 1 PHONE OPENER\n\n[Call AFTER sending Text 1 + Text 2 — wait ~2 min]\n\n"Hey [FIRST_NAME]? — Hey, this is Jeremy Metka. I just sent you a couple texts — did you get them?"\n\n[Pause]\n\n"I got your request for a life insurance review and I wanted to reach out personally. I know you're into [HOBBY] — I actually work with a lot of families who are into that and one thing that comes up is making sure their family is taken care of if something ever happens to them."\n\n[Pause]\n\n"What I specialize in is called Living Benefits — meaning if you get diagnosed with cancer, have a heart attack, or suffer a stroke, the plan pays you CASH while you're still alive to use it. Not just a death benefit."\n\nHEALTH QUALIFIER:\n1. "How's your health overall?"\n2. "Any tobacco in the last 12 months?"\n3. "Any medications you're on currently?"\n4. "Who are you looking to protect — spouse, kids, both?"`,
    appointment: `LIVING BENEFITS PRESENTATION SCRIPT\n\nOPENING:\n"[FIRST_NAME], thanks for making time. I specialize in Living Benefits life insurance — meaning this pays you while you're alive if you hit a critical illness. Let me show you how that works and what it costs in your state."\n\nKEY TALKING POINTS:\n1. Living Benefits — cash for cancer, heart attack, stroke, terminal diagnosis\n2. Not just death benefit — you benefit while you're alive\n3. Rates locked at today's age and health — every month matters\n4. 15-minute review, no obligation, real numbers`,
    objections: `OBJECTION HANDLING — LIVING BENEFITS LEAD\n\n"I ALREADY HAVE LIFE INSURANCE."\n"That's great — and that's actually one of the reasons I want to sit down. Most people I talk to have a policy that only pays when they die. What I work with also pays out cash if you get a critical illness while you're alive. It's a completely different conversation."\n\n"I CAN'T AFFORD IT."\n"I hear that. The reason most people say that is because they're thinking of old-school life insurance. What I work with — because of the Living Benefits — actually replaces income in a crisis. Let me just show you what it looks like at your age. If it doesn't make sense, I'll tell you."\n\n"I NEED TO THINK ABOUT IT."\n"I get it. What specifically do you want to think through? Most of the time when I hear that there's a question underneath it I can actually answer right now."`
  },
  "Clearance Campaign (B/C Bucket)": {
    phone: `CLEARANCE CAMPAIGN — WARM/COLD RE-ENGAGEMENT\n\nFor leads 3-12+ months old. Fast, low-pressure, designed for volume.\n\n"Hey [FIRST_NAME]? — Hey, this is Jeremy Metka. I'm not sure if you remember, but [TIME PERIOD] ago you had inquired about some life insurance coverage for your family."`,
    objections: `CLEARANCE CAMPAIGN OBJECTIONS\n\n"I DON'T REMEMBER THIS."\n"I'm not surprised — it's been a while..."`,
    appointment: `N/A — Clearance Campaign is phone-only until they convert to interested status.`
  },
  "Policy Review (Book of Business)": {
    phone: `WORKING YOUR BOOK OF BUSINESS\n\nFor past clients — annual policy reviews + upsell opportunity.\n\n"Hi, can I speak with [FIRST_NAME]? This is Jeremy Metka, the insurance agent who helped with your policy..."`,
    objections: `POLICY REVIEW OBJECTIONS\n\n"I'M HAPPY WITH WHAT I HAVE."\n"That's great — and that's actually the best case scenario for me too..."`,
    appointment: `See phone script — policy review IS the appointment.`
  }
};

export default DEFAULT_SCRIPTS;
