/**
 * PHASE LIFECYCLE ENGINE
 * Extracted from TodaysBlock.jsx
 *
 * Phase system:
 *   P1  — Day 0-14, every other day (7 dials)
 *   P2  — Day 15-29, 2x/week (5 dials)
 *   P3  — Day 31-59, 1x/week (5 dials)
 *   M2  — Day 60-180, bi-weekly (machine 2 aged reactivation)
 *   EXIT — Day 181+ or terminal disposition
 *
 * Priority order: no_sale → no_show → P1 → P2 → P3 → M2
 */

// ── PHASE CONSTANTS ──────────────────────────────────────────────
export const PHASE_DEFS = {
  P1:   { id:'P1',   label:'Phase 1',   color:'#3B82F6' },
  P2:   { id:'P2',   label:'Phase 2',   color:'#8B5CF6' },
  P3:   { id:'P3',   label:'Phase 3',   color:'#F59E0B' },
  M2:   { id:'M2',   label:'Machine 2', color:'#64748B' },
  EXIT: { id:'EXIT', label:'Exit',      color:'#DC2626' },
};

export const SCHED_COLS = [
  'p1_1','p1_2','p1_3','p1_4','p1_5','p1_6','p1_7',
  'p2_1','p2_2','p2_3','p2_4','p2_5',
  'p3_1','p3_2','p3_3','p3_4','p3_5',
];

// ── LIFECYCLE HELPERS ────────────────────────────────────────────

const addDaysISO = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
};

export const buildSchedule = (from) => {
  const d = new Date(from);
  d.setHours(9, 0, 0, 0);
  return {
    p1_1: addDaysISO(d, 0),
    p1_2: addDaysISO(d, 2),
    p1_3: addDaysISO(d, 4),
    p1_4: addDaysISO(d, 6),
    p1_5: addDaysISO(d, 8),
    p1_6: addDaysISO(d, 10),
    p1_7: addDaysISO(d, 12),
    p2_1: addDaysISO(d, 15),
    p2_2: addDaysISO(d, 18),
    p2_3: addDaysISO(d, 22),
    p2_4: addDaysISO(d, 25),
    p2_5: addDaysISO(d, 29),
    p3_1: addDaysISO(d, 31),
    p3_2: addDaysISO(d, 38),
    p3_3: addDaysISO(d, 45),
    p3_4: addDaysISO(d, 52),
    p3_5: addDaysISO(d, 59),
  };
};

export const computeNextDial = (lead) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dates = SCHED_COLS
    .map(k => lead[k])
    .filter(Boolean)
    .map(s => new Date(s))
    .filter(d => d >= startOfToday);
  if (!dates.length) return null;
  return new Date(Math.min(...dates.map(d => d.getTime()))).toISOString();
};

export const phaseFromBucket = (lead) => {
  const bucket = lead.bucket || 'C';
  const assignDate = lead.assignDate ? new Date(lead.assignDate) : new Date();
  const daysOld = Math.max(0, Math.floor((Date.now() - assignDate.getTime()) / 86400000));
  if (bucket === 'A') {
    if (daysOld <= 14) return 'P1';
    if (daysOld <= 30) return 'P2';
    if (daysOld <= 60) return 'P3';
    return 'M2';
  }
  if (bucket === 'B') return daysOld <= 180 ? 'M2' : 'EXIT';
  return 'EXIT';
};

export const applyPhaseTransition = (lead, dispId) => {
  const patch = {};
  const now = new Date().toISOString();

  if (['dnc', 'not_interested'].includes(dispId)) {
    patch.phase = 'EXIT';
    patch.next_dial = null;
    SCHED_COLS.forEach(k => { patch[k] = null; });
  } else if (dispId === 'appointment_booked') {
    patch.phase = lead.phase || 'P1';
  } else if (dispId === 'no_show' || dispId === 'no_sale') {
    const sched = buildSchedule(new Date());
    Object.assign(patch, sched);
    patch.phase = 'P1';
    patch.phase_start = now;
    patch.next_dial = sched.p1_1;
  } else if (['no_answer', 'vm_left', 'callback', 'follow_up_needed', 'hung_up'].includes(dispId)) {
    const earliest = SCHED_COLS
      .filter(k => lead[k])
      .map(k => ({ k, d: new Date(lead[k]) }))
      .filter(({ d }) => d <= new Date(Date.now() + 86400000))
      .sort((a, b) => a.d - b.d)[0];
    if (earliest) patch[earliest.k] = null;
    patch.next_dial = computeNextDial({ ...lead, ...patch });
  }

  return patch;
};

export const getPhasePriority = (lead) => {
  const disp = lead.disposition || '';
  if (disp === 'no_sale') return 100;
  if (disp === 'no_show') return 90;
  const phase = lead.phase;
  if (phase === 'P1') return 80;
  if (phase === 'P2') return 70;
  if (phase === 'P3') return 60;
  if (phase === 'M2') return 50;
  if (lead.bucket === 'A') return 40;
  if (lead.bucket === 'B') return 30;
  return 10;
};

export const isDueToday = (lead) => {
  if (lead.phase === 'EXIT') return false;
  if (['dnc', 'not_interested', 'appointment_booked'].includes(lead.disposition)) return false;
  if (lead.next_dial) {
    const due = new Date(lead.next_dial);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return due <= endOfDay;
  }
  return lead.bucket === 'A';
};

export const backfillLead = (lead) => {
  if (lead.phase) return lead;
  const phase = phaseFromBucket(lead);
  if (phase === 'EXIT') return { ...lead, phase, next_dial: null };
  const sched = buildSchedule(new Date());
  return { ...lead, phase, phase_start: new Date().toISOString(), next_dial: sched.p1_1, ...sched };
};

// ── NURTURE SMS SEQUENCES ────────────────────────────────────────

export const SMS_SEQUENCES = {
  cat1: {
    label: 'Never Set',
    subtitle: 'General Life — never booked',
    color: '#EF4444',
    texts: [
      { step:1,  hasLink:false, body:(n,c)=>`Hey ${n}, this is Jeremy with Metka Solutions — I just tried to reach you. No rush, just wanted to make sure you got a real person and not a robot 🙏 I'll try you again soon.` },
      { step:2,  hasLink:false, body:(n,c)=>`Hey ${n}, Jeremy again. Tried you once more — totally understand life gets busy. Whenever you have 15 minutes, I think I can make this worth your time. No pressure either way.` },
      { step:3,  hasLink:true,  body:(n,c)=>`${n} — still trying to connect. If the timing's just bad right now, no worries at all. Whenever you're ready, here's a link to grab a time: ${c||'[YOUR CALENDLY LINK]'} — 15 minutes, that's all.` },
      { step:4,  hasLink:true,  body:(n,c)=>`Hey ${n}, Jeremy here with Metka Solutions. I know calls can be hard to coordinate — if it's easier to just pick a time on your own, here you go: ${c||'[YOUR CALENDLY LINK]'}. Still just 15 minutes.` },
      { step:5,  hasLink:false, body:(n,c)=>`${n} 🙏 I promise I'm not a bill collector. Just someone who helps families make sure they're protected. Still happy to connect whenever you're ready.` },
      { step:6,  hasLink:true,  body:(n,c)=>`Are you alive? #pleasebe 😄 Seriously though — still here when you're ready, ${n}. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:7,  hasLink:true,  body:(n,c)=>`Hey ${n} — one thing worth knowing: some of what I work with pays out while you're still alive. Living benefits — money for a critical illness, disability, or terminal diagnosis. Not just a death benefit. Worth a quick conversation. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:8,  hasLink:false, body:(n,c)=>`Did you get my last message? Curious if that caught your attention at all.` },
      { step:9,  hasLink:true,  body:(n,c)=>`${n} — a lot of families I work with use their protection plan to also protect their home equity. There are strategies that help pay off your mortgage faster while you're still healthy enough to lock in your rate. Most people haven't heard of it. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:10, hasLink:false, body:(n,c)=>`Just so I understand where you're coming from — on a scale of 1 to 10, how important is it to you right now to make sure your family is protected if something happened to you?` },
      { step:11, hasLink:true,  body:(n,c)=>`[Send a GIF — "still waiting"] Still here, ${n}. Whenever you're ready. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:12, hasLink:false, body:(n,c)=>`${n}, I've reached out a few times now. I'm not going anywhere — but I also don't want to keep bothering you if this genuinely isn't a priority right now. Is it worth finding 15 minutes, or should I give you some space?` },
      { step:13, hasLink:true,  body:(n,c)=>`Something I think about in this work — rates are based on your age and health today. Every month that passes is a month older, and sometimes health changes when we least expect it. Just something worth knowing. Still here if you want to talk. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:14, hasLink:false, body:(n,c)=>`${n} — honest question. Is protecting your family something you still want to get handled, or has it moved down the list? Either answer is fine. I just want to make sure I'm respecting your time.` },
      { step:15, hasLink:true,  body:(n,c)=>`I've worked with a lot of families. The ones I think about most aren't the ones who said yes — they're the ones who kept waiting and then something changed. I don't say that to scare you. I say it because I'd rather have an honest conversation now than not have been able to help when it mattered. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:16, hasLink:true,  body:(n,c)=>`${n}, I'll give you some space for now — but if protecting your family ever moves back up the list, I'm still here. Same number, same link: ${c||'[YOUR CALENDLY LINK]'}. Wishing you well. — Jeremy | Metka Solutions` },
    ]
  },
  cat2: {
    label: 'No-Show',
    subtitle: 'General Life — booked but didn\'t show',
    color: '#F59E0B',
    texts: [
      { step:1,  hasLink:false, body:(n,c)=>`Hey ${n}, this is Jeremy with Metka Solutions — looks like we missed each other. No worries at all, life happens. Still happy to connect whenever works for you.` },
      { step:2,  hasLink:false, body:(n,c)=>`Hey ${n}, Jeremy here. Still want to make sure you get taken care of — whenever you're ready to find a new time, I'm here.` },
      { step:3,  hasLink:true,  body:(n,c)=>`${n} — no pressure, just want to make sure this doesn't fall through the cracks for you. Here's my link whenever you're ready: ${c||'[YOUR CALENDLY LINK]'}` },
      { step:4,  hasLink:true,  body:(n,c)=>`Hey ${n}, Jeremy again. I know life gets busy — if grabbing a time on your own is easier, here you go: ${c||'[YOUR CALENDLY LINK]'}. Still just 15 minutes.` },
      { step:5,  hasLink:true,  body:(n,c)=>`${n} 🙏 Still here, still easy to work with. Whenever you're ready. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:6,  hasLink:false, body:(n,c)=>`Did I do something to offend you? If so, I'm genuinely sorry. I know it was important to you to protect your loved ones. If it would help, I can get you connected with someone else on my team — just say the word.` },
      { step:7,  hasLink:true,  body:(n,c)=>`Hey ${n} — one thing I didn't get a chance to mention: a lot of what I work with goes beyond just a death benefit. Living benefits — money that pays out for a critical illness, disability, or terminal diagnosis while you're still here to use it. Might be worth a fresh conversation. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:8,  hasLink:false, body:(n,c)=>`Did you get my last message? Curious if that caught your attention at all.` },
      { step:9,  hasLink:true,  body:(n,c)=>`${n} — there are strategies through Metka Solutions that use your protection plan to build home equity and pay your mortgage down faster. Most families haven't heard of it. Worth 15 minutes if nothing else. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:10, hasLink:false, body:(n,c)=>`Just so I understand where you're coming from — on a scale of 1 to 10, how important is it to you to make sure your family is protected if something happened to you?` },
      { step:11, hasLink:true,  body:(n,c)=>`[Send a GIF — "still waiting"] Still here, ${n}. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:12, hasLink:false, body:(n,c)=>`${n}, I've reached out quite a few times now. Not going anywhere — but I don't want to keep showing up uninvited if this isn't the right time. Is it worth finding 15 minutes, or would you rather I give you some space?` },
      { step:13, hasLink:true,  body:(n,c)=>`Something worth knowing — rates are based on your age and health today. Every month that passes is a month older, and health can change when we least expect it. Still here whenever you're ready. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:14, hasLink:false, body:(n,c)=>`${n} — honest question. Is protecting your family still something you want to get handled, or has it moved down the list? Either answer is fine. I just want to respect your time.` },
      { step:15, hasLink:true,  body:(n,c)=>`I've worked with a lot of families. The ones I think about most aren't the ones who said yes — they're the ones who kept waiting and then something changed. I don't say that to scare you. I say it because I'd rather have an honest conversation now than not have been able to help when it mattered. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:16, hasLink:true,  body:(n,c)=>`${n}, I'll give you some space for now — but if protecting your family ever moves back up the list, I'm still here. Same number, same link: ${c||'[YOUR CALENDLY LINK]'}. Wishing you well. — Jeremy | Metka Solutions` },
    ]
  },
  cat3: {
    label: 'Sat — Didn\'t Buy',
    subtitle: 'General Life — completed audit, no app',
    color: '#8B5CF6',
    texts: [
      { step:1,  hasLink:false, body:(n,c)=>`Hey ${n}, Jeremy here with Metka Solutions — just wanted to check in since we spoke. No pressure at all, just want to make sure you have everything you need if any questions came up after our conversation.` },
      { step:2,  hasLink:false, body:(n,c)=>`Hey ${n}, still thinking about you. I know these decisions take time — I'm here whenever you're ready to talk it through. No rush.` },
      { step:3,  hasLink:true,  body:(n,c)=>`${n} — just checking in again. If it's easier to grab a time that works for you: ${c||'[YOUR CALENDLY LINK]'}. Happy to pick up right where we left off.` },
      { step:4,  hasLink:true,  body:(n,c)=>`Hey ${n}, Jeremy again. I know life gets busy — if you want to reconnect on your own schedule, here's my link: ${c||'[YOUR CALENDLY LINK]'}. Still just 15 minutes.` },
      { step:5,  hasLink:true,  body:(n,c)=>`${n} — still in your corner whenever you're ready. No agenda, just want to make sure your family gets protected. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:6,  hasLink:false, body:(n,c)=>`Did I do something to offend you? If so, I'm genuinely sorry. I know protecting your family was important to you when we spoke. If it would help, I can connect you with someone else on my team — just say the word.` },
      { step:7,  hasLink:true,  body:(n,c)=>`Hey ${n} — something I've been thinking about since we talked. A lot of people come back with questions after they've had time to sit with it. Whatever's on your mind — cost, coverage, timing — I'm an easy conversation. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:8,  hasLink:false, body:(n,c)=>`Did you get my last message? Curious if anything's come up since we spoke.` },
      { step:9,  hasLink:true,  body:(n,c)=>`${n} — one thing I want to make sure you know. Rates are locked based on your age and health at the time you apply. The longer the gap, the more things can shift. Just want to make sure you have the full picture. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:10, hasLink:false, body:(n,c)=>`Just so I understand where you're coming from — on a scale of 1 to 10, how important is it to you to make sure your family is protected if something happened to you?` },
      { step:11, hasLink:true,  body:(n,c)=>`[Send a GIF — "still waiting"] Still here, ${n}. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:12, hasLink:false, body:(n,c)=>`${n}, I've reached out a few times since we talked. I'm not going anywhere — but I also don't want to keep showing up if the timing just isn't right. Is it worth reconnecting, or would you rather I give you some space?` },
      { step:13, hasLink:false, body:(n,c)=>`${n} — honest question. Is protecting your family still something you want to get handled, or has it moved down the list? Either answer is fine. I just want to make sure I'm respecting your time.` },
      { step:14, hasLink:true,  body:(n,c)=>`Something I think about in this work — the families that are hardest to think about aren't the ones who said no. They're the ones who were close and then something changed before they could circle back. I don't say that to pressure you. I say it because I genuinely want to help while I still can. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:15, hasLink:true,  body:(n,c)=>`${n} — we had a good conversation. I'd hate for that to be where it ended. Still here if you want to pick it back up. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:16, hasLink:true,  body:(n,c)=>`${n}, I'll give you some space for now — but if protecting your family ever moves back up the list, I'm still here. Same number, same link: ${c||'[YOUR CALENDLY LINK]'}. Wishing you well. — Jeremy | Metka Solutions` },
    ]
  }
};

// Helper to suggest which SMS sequence based on lead disposition/stage
export const suggestSeqCat = (lead) => {
  if (lead?.smsSeq) return lead.smsSeq;
  const d = lead?.disposition;
  if (d === 'no_show') return 'cat2';
  if (d === 'not_interested' && (lead?.stage === 'appointment_set' || lead?.smsSeq)) return 'cat3';
  return 'cat1';
};
