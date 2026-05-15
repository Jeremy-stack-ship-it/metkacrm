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
