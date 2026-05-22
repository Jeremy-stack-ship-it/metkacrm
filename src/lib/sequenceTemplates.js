// ── SEQUENCE TEMPLATES v1.0 ───────────────────────────────────────────────────
// Defines touch schedules + message content for all three sequence tracks.
// All external copy names "life insurance" explicitly per compliance rule.
// SMS: keep under 160 chars. Calendly link injected at runtime from settings.
// Email: subject + body function — firstName, agentPhone, calendlyUrl injected.
//
// TRACKS:
//   "new"       — never touched (167 New Lead in DLHA data)
//   "re-engage" — contact attempted but no resolution (85 Contact Attempted + 16 Contacting)
//   "ghost"     — no contact / unreachable (209 No Contact Unreachable)
//   "closed"    — paused, seqExitReason explains why (sold/booked/not_interested/dnc)
// ─────────────────────────────────────────────────────────────────────────────

// ── DAY OFFSETS PER TRACK ─────────────────────────────────────────────────────
// Each entry: { day, channels: ["sms","email","dial_reminder"] }
export const TRACK_SCHEDULES = {
  new: [
    { step:0,  day:0,  channels:["sms","email"]         }, // Welcome — fires immediately on add
    { step:1,  day:1,  channels:["sms","dial_reminder"]  }, // Day 1 confirm + dial
    { step:2,  day:3,  channels:["sms","email"]          }, // Day 3 follow-up
    { step:3,  day:5,  channels:["sms","dial_reminder"]  }, // Day 5 dial
    { step:4,  day:7,  channels:["sms","email"]          }, // Day 7 living benefits angle
    { step:5,  day:10, channels:["sms","dial_reminder"]  }, // Day 10 dial
    { step:6,  day:14, channels:["sms","email"]          }, // Day 14 ghost protocol
    { step:7,  day:21, channels:["sms","dial_reminder"]  }, // Day 21 final attempt
    { step:8,  day:30, channels:["archive"]              }, // Day 30 auto-archive → seqExitReason:"exhausted"
  ],
  "re-engage": [
    { step:0,  day:0,  channels:["sms","email"]          }, // Re-engagement — fires on import
    { step:1,  day:2,  channels:["sms","dial_reminder"]  }, // Day 2 follow-up
    { step:2,  day:5,  channels:["sms","email"]          }, // Day 5 ghost protocol
    { step:3,  day:10, channels:["sms","dial_reminder"]  }, // Day 10 final dial
    { step:4,  day:14, channels:["archive"]              }, // Day 14 auto-archive
  ],
  ghost: [
    { step:0,  day:0,  channels:["sms","email"]          }, // Ghost protocol — email + SMS only
    { step:1,  day:3,  channels:["sms"]                  }, // Day 3 final SMS
    { step:2,  day:7,  channels:["archive"]              }, // Day 7 auto-archive
  ],
};

// ── SMS TEMPLATES ─────────────────────────────────────────────────────────────
// Each function: (firstName, calendlyUrl, agentPhone) => string
// Mortgage Protection (mp) and Life Insurance (li) variants where content differs.

export const SMS = {
  new: {
    0: {
      mp: (n,c)=>`Hey ${n}! This is Jeremy, Senior Field Underwriter — I received your request for a Mortgage Protection review. I'll be reaching out shortly. You can also grab a time here: ${c||'[CALENDLY]'}`,
      li: (n,c)=>`Hey ${n}! This is Jeremy, Senior Field Underwriter — I got your life insurance request. I'll reach out soon. Grab a time that works for you: ${c||'[CALENDLY]'}`,
    },
    1: {
      mp: (n,c)=>`Hey ${n}, Jeremy here — just confirming your info came through for your Mortgage Protection review. Trying to reach you today. Does this number still work?`,
      li: (n,c)=>`Hey ${n}, Jeremy here — confirming your life insurance request came through. Trying to reach you today. Does this number still work?`,
    },
    2: {
      mp: (n,c)=>`${n} — still trying to connect about your Mortgage Protection review. Worth knowing: some of this pays out while you're still alive (Living Benefits). Quick 15-min call. ${c||'[CALENDLY]'}`,
      li: (n,c)=>`${n} — still trying to connect about your life insurance review. Worth knowing: some policies pay out while you're still alive (Living Benefits). 15 min is all it takes. ${c||'[CALENDLY]'}`,
    },
    3: {
      mp: (n,c)=>`${n}, Jeremy here again. Life gets busy — no pressure. When you have 15 minutes I think I can make it worth your time. Still here whenever you're ready.`,
      li: (n,c)=>`${n}, Jeremy again. No pressure at all. When you have 15 minutes for your life insurance review, I'm here. Still trying to connect.`,
    },
    4: {
      mp: (n,c)=>`${n} — quick thing most families don't know: the right Mortgage Protection plan can pay off your home AND pay you cash if you get a critical illness. Not just a death benefit. Worth 15 min? ${c||'[CALENDLY]'}`,
      li: (n,c)=>`${n} — most families don't know life insurance can pay you cash for a critical illness or disability while you're still alive. Living Benefits change everything. Worth 15 min? ${c||'[CALENDLY]'}`,
    },
    5: {
      mp: (n,c)=>`${n}, Jeremy here. Tried you a few times now. Rates are locked by your age and health today — every month that passes matters. Still here when you're ready.`,
      li: (n,c)=>`${n}, Jeremy here. Life insurance rates are locked at your age and health today. The longer we wait the more it costs. Still here whenever you're ready.`,
    },
    6: {
      mp: (n,c)=>`${n} — I'm wrapping up household files in your area this week. Do I need to archive your file or would you like to connect first? Just 15 minutes. ${c||'[CALENDLY]'}`,
      li: (n,c)=>`${n} — I'm wrapping up regional files this week. Do I need to close your file or can we find 15 minutes first? ${c||'[CALENDLY]'}`,
    },
    7: {
      mp: (n,c)=>`${n}, this is my final attempt to connect about your Mortgage Protection review. If protecting your home and family is still a priority, I'm here: ${c||'[CALENDLY]'} — Jeremy`,
      li: (n,c)=>`${n}, last attempt from me on your life insurance review. If protecting your family is still a priority, I'm here: ${c||'[CALENDLY]'} — Jeremy`,
    },
  },

  "re-engage": {
    0: {
      mp: (n,c)=>`Hey ${n}, Jeremy here — following up on your Mortgage Protection inquiry. I know we haven't connected yet. I only need 15 minutes. Does this week work? ${c||'[CALENDLY]'}`,
      li: (n,c)=>`Hey ${n}, Jeremy here — checking back in on your life insurance inquiry. Still want to make sure your family is covered. 15 minutes is all I need. ${c||'[CALENDLY]'}`,
    },
    1: {
      mp: (n,c)=>`${n} — still here on your Mortgage Protection review. Quick note: some of what I work with pays out while you're still alive — not just at death. Worth knowing. ${c||'[CALENDLY]'}`,
      li: (n,c)=>`${n} — still here. Quick note: Life insurance with Living Benefits can pay you cash for a heart attack, cancer, or stroke while you're alive to use it. Worth 15 min? ${c||'[CALENDLY]'}`,
    },
    2: {
      mp: (n,c)=>`${n} — I'm closing out files in your region this week. Should I archive your household file or can we find time to connect? ${c||'[CALENDLY]'}`,
      li: (n,c)=>`${n} — closing out regional files this week. Should I archive your file or can we connect for 15 minutes? ${c||'[CALENDLY]'}`,
    },
    3: {
      mp: (n,c)=>`${n}, this is my last reach-out on your Mortgage Protection review. If protecting your home is still important, I'm here: ${c||'[CALENDLY]'} — Jeremy`,
      li: (n,c)=>`${n}, final message from me. If life insurance is still on your list, I'm here: ${c||'[CALENDLY]'} — Jeremy`,
    },
  },

  ghost: {
    0: {
      mp: (n,c)=>`Hi ${n}, this is Jeremy — Senior Field Underwriter. I've been trying to reach you about your Mortgage Protection review. I'm archiving household files this week. Should I keep yours open? ${c||'[CALENDLY]'}`,
      li: (n,c)=>`Hi ${n}, this is Jeremy — Senior Field Underwriter. Tried to reach you several times about your life insurance inquiry. Closing regional files this week. Keep yours open? ${c||'[CALENDLY]'}`,
    },
    1: {
      mp: (n,c)=>`${n} — last message from me. If protecting your home and family with Mortgage Protection ever moves back up the list, I'm still here. — Jeremy, Metka Solutions`,
      li: (n,c)=>`${n} — last message. If life insurance ever moves back up the list, I'm still here. Wishing you well. — Jeremy, Metka Solutions`,
    },
  },
};

// ── EMAIL TEMPLATES ───────────────────────────────────────────────────────────
// Each: { subject: fn, body: fn } — (firstName, agentPhone, calendlyUrl) => string
// Body is plain text; Apps Script wraps in HTML template.

export const EMAIL = {
  new: {
    0: {
      mp: {
        subject: (n)=>`Your Mortgage Protection Review — ${n}`,
        body: (n,ph,c)=>`Hi ${n},

My name is Jeremy Metka — I'm a Senior Field Underwriter based in Oklahoma, and I received your request for a Mortgage Protection review.

I want to make sure I reach a real person and not just leave a message in a void, so I'm following up both by phone and here.

Here's what I do: I work with families to make sure their home and income are protected if something unexpected happens — death, critical illness, disability. What most families don't realize is that today's life insurance can pay out WHILE YOU'RE STILL ALIVE through what's called Living Benefits. That means cash for a heart attack, cancer, stroke, or terminal diagnosis — not just a death benefit.

I only need 15 minutes to walk through what's available in your state and show you real numbers. No pressure, no obligation.

You can grab a time here: ${c||'[CALENDLY LINK]'}

Or reply to this email and we'll find something that works.

Looking forward to connecting,

Jeremy Metka
Senior Field Underwriter | Metka Solutions
NPN #21425108
${ph||''}`,
      },
      li: {
        subject: (n)=>`Your Life Insurance Review — ${n}`,
        body: (n,ph,c)=>`Hi ${n},

My name is Jeremy Metka — Senior Field Underwriter, and I received your life insurance inquiry.

I want to make sure you actually hear from a real person, so I'm following up here as well.

What I specialize in is making sure families are protected in a way that makes sense for their budget AND their life right now. Today's life insurance isn't just a death benefit — many of the plans I work with include Living Benefits that pay you cash if you're diagnosed with a critical illness, suffer a stroke, or face a disability. Money you can use while you're still alive.

15 minutes is all I need to show you what's available and what it actually costs.

Grab a time here: ${c||'[CALENDLY LINK]'}

Or just reply and we'll find something that works.

Jeremy Metka
Senior Field Underwriter | Metka Solutions
NPN #21425108
${ph||''}`,
      },
    },
    4: {
      mp: {
        subject: (n)=>`Something most families don't know — ${n}`,
        body: (n,ph,c)=>`Hi ${n},

Most families think Mortgage Protection is just a policy that pays off the house when someone dies.

That's only half the story.

The plans I work with also include Living Benefits — which means if you have a heart attack, get diagnosed with cancer, or suffer a stroke while your mortgage is still active, the plan pays you cash to use however you need. Keep the house. Cover medical bills. Replace lost income.

You don't have to die for it to pay out. That's the part most people have never heard.

I'd love to show you how it works. Takes 15 minutes.

${c||'[CALENDLY LINK]'}

Jeremy Metka
Senior Field Underwriter | Metka Solutions
NPN #21425108
${ph||''}`,
      },
      li: {
        subject: (n)=>`Living Benefits — something most families don't know`,
        body: (n,ph,c)=>`Hi ${n},

Most people think life insurance only pays out when you die.

The plans I work with include Living Benefits — meaning if you're diagnosed with a critical illness, suffer a disability, or receive a terminal diagnosis, the policy pays you cash while you're still alive to use it.

That changes the entire conversation around life insurance.

I'd love to walk you through what's available in your state. 15 minutes.

${c||'[CALENDLY LINK]'}

Jeremy Metka
Senior Field Underwriter | Metka Solutions
NPN #21425108
${ph||''}`,
      },
    },
    6: {
      mp: {
        subject: (n)=>`Closing your household file — ${n}`,
        body: (n,ph,c)=>`Hi ${n},

I've been reaching out about your Mortgage Protection review and haven't been able to connect.

I'm in the process of wrapping up household files in your region this week. Before I close yours, I wanted to make one more attempt — just in case the timing was off.

If protecting your home and family is still a priority, I'm here. 15 minutes is all it takes.

${c||'[CALENDLY LINK]'}

If I don't hear back, I'll go ahead and archive your file. No hard feelings — life gets busy.

Jeremy Metka
Senior Field Underwriter | Metka Solutions
NPN #21425108
${ph||''}`,
      },
      li: {
        subject: (n)=>`Closing your file — ${n}`,
        body: (n,ph,c)=>`Hi ${n},

I've made several attempts to connect about your life insurance inquiry and haven't been able to reach you.

I'm wrapping up regional files this week. Before I close yours, I wanted to make one final attempt — in case the timing just wasn't right.

If protecting your family with life insurance is still on your list, I'm here. 15 minutes.

${c||'[CALENDLY LINK]'}

If I don't hear back, I'll archive your file. No hard feelings.

Jeremy Metka
Senior Field Underwriter | Metka Solutions
NPN #21425108
${ph||''}`,
      },
    },
  },

  "re-engage": {
    0: {
      mp: {
        subject: (n)=>`Still here — your Mortgage Protection review`,
        body: (n,ph,c)=>`Hi ${n},

I know we haven't been able to connect yet on your Mortgage Protection review. I'm following up one more time because I don't want your request to fall through the cracks.

Here's what I want you to know: the Mortgage Protection plans I work with aren't just death benefits. They include Living Benefits that pay out if you suffer a critical illness — heart attack, cancer, stroke — while your mortgage is still active. Cash you can use while you're still alive.

That's worth 15 minutes of your time.

Grab a time here: ${c||'[CALENDLY LINK]'}

Jeremy Metka
Senior Field Underwriter | Metka Solutions
NPN #21425108
${ph||''}`,
      },
      li: {
        subject: (n)=>`Still here — your life insurance review`,
        body: (n,ph,c)=>`Hi ${n},

We haven't been able to connect yet on your life insurance inquiry, and I don't want it to fall through the cracks.

Quick thing worth knowing: the life insurance plans I work with include Living Benefits. That means the policy pays you cash if you're diagnosed with a critical illness or suffer a disability — not just when you die.

Worth 15 minutes. Here's my calendar: ${c||'[CALENDLY LINK]'}

Jeremy Metka
Senior Field Underwriter | Metka Solutions
NPN #21425108
${ph||''}`,
      },
    },
    2: {
      mp: {
        subject: (n)=>`Wrapping up your household file — ${n}`,
        body: (n,ph,c)=>`Hi ${n},

I'm in the process of closing out household files in your area. I wanted to reach out one more time before I archive yours.

If Mortgage Protection is still on your radar, I'm here. 15 minutes is all it takes to see what's available and what it costs.

${c||'[CALENDLY LINK]'}

Jeremy Metka
Senior Field Underwriter | Metka Solutions
${ph||''}`,
      },
      li: {
        subject: (n)=>`Closing your life insurance file — ${n}`,
        body: (n,ph,c)=>`Hi ${n},

Making one final attempt before I close your file. If life insurance is still something you want to address, I'd love to help.

${c||'[CALENDLY LINK]'}

Jeremy Metka
Senior Field Underwriter | Metka Solutions
${ph||''}`,
      },
    },
  },

  ghost: {
    0: {
      mp: {
        subject: (n)=>`Last attempt — your Mortgage Protection file`,
        body: (n,ph,c)=>`Hi ${n},

I've made several attempts to reach you by phone and text about your Mortgage Protection review without success.

This is my final outreach before I archive your household file.

If protecting your home and family is still something you want to address — even if the timing was just off — I'm here. 15 minutes.

${c||'[CALENDLY LINK]'}

If I don't hear back, I'll go ahead and close your file. No hard feelings at all.

Jeremy Metka
Senior Field Underwriter | Metka Solutions
NPN #21425108
${ph||''}`,
      },
      li: {
        subject: (n)=>`Last attempt — your life insurance file`,
        body: (n,ph,c)=>`Hi ${n},

Several attempts to reach you about your life insurance inquiry haven't connected. This is my last outreach before I close your file.

If it's still something you want to address, I'm here: ${c||'[CALENDLY LINK]'}

Jeremy Metka
Senior Field Underwriter | Metka Solutions
NPN #21425108
${ph||''}`,
      },
    },
  },
};

// ── TEMPLATE LOOKUP HELPERS ───────────────────────────────────────────────────

// Returns leadType category: "mp" | "li"
export const leadTypeCat = (leadType) => {
  const l = (leadType || "").toLowerCase();
  if (l.includes("mortgage")) return "mp";
  return "li";
};

// Returns SMS string for a given track + step + leadType
export const getSMS = (track, step, leadType, firstName, calendlyUrl) => {
  const cat = leadTypeCat(leadType);
  const trackSms = SMS[track];
  if (!trackSms) return null;
  const stepSms = trackSms[step];
  if (!stepSms) return null;
  const fn = stepSms[cat] || stepSms.li;
  return fn ? fn(firstName || "there", calendlyUrl || "") : null;
};

// Returns {subject, body} for a given track + step + leadType
export const getEmail = (track, step, leadType, firstName, agentPhone, calendlyUrl) => {
  const cat = leadTypeCat(leadType);
  const trackEmail = EMAIL[track];
  if (!trackEmail) return null;
  const stepEmail = trackEmail[step];
  if (!stepEmail) return null;
  const tmpl = stepEmail[cat] || stepEmail.li;
  if (!tmpl) return null;
  return {
    subject: tmpl.subject(firstName || "there"),
    body:    tmpl.body(firstName || "there", agentPhone || "", calendlyUrl || ""),
  };
};

// Returns schedule entry for a given track + step
export const getScheduleEntry = (track, step) => {
  const sched = TRACK_SCHEDULES[track];
  if (!sched) return null;
  return sched.find(s => s.step === step) || null;
};

// Returns total steps for a track (excluding archive step)
export const getTrackLength = (track) => {
  const sched = TRACK_SCHEDULES[track];
  if (!sched) return 0;
  return sched.filter(s => !s.channels.includes("archive")).length;
};
