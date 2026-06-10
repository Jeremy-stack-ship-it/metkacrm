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
  M3:   { id:'M3',   label:'Machine 3', color:'#94A3B8' },
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

// ── CALENDAR-DERIVED PHASE (v3.44 — audit F4 / gap G1) ──────────────────────
// Doctrine: phase transitions are calendar-driven and automatic. Day 15→P2,
// Day 31→P3, Day 61→M2 (≤180d), Day 181→M3. No lead ever goes silently dark.
export const PHASE_ORDER = ['P1', 'P2', 'P3', 'M2', 'M3'];

// Age in days from phase_start (reset by no-show/no-sale rebuilds) or assignDate.
export const leadAgeDays = (lead, now = new Date()) => {
  const base = lead.phase_start || lead.assignDate || lead.seqStartDate || null;
  if (!base) return 0;
  const d = new Date(base);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((now - d) / 86400000));
};

// Derived phase by age, with a FLOOR at the stored phase: a disposition that
// deliberately placed a lead later (no_sale → P3 day-0, Jeremy's weekly-cadence
// decision) is never walked back to P1 by the calendar. EXIT always wins.
export const effectivePhase = (lead, now = new Date()) => {
  if (!lead) return 'M3';
  if (lead.phase === 'EXIT') return 'EXIT';
  const days = leadAgeDays(lead, now);
  const byAge = days <= 14 ? 'P1' : days <= 30 ? 'P2' : days <= 60 ? 'P3' : days <= 180 ? 'M2' : 'M3';
  const stored = lead.phase;
  if (stored && PHASE_ORDER.includes(stored) &&
      PHASE_ORDER.indexOf(byAge) < PHASE_ORDER.indexOf(stored)) return stored;
  return byAge;
};

// M2 priority tiers (docs: Machine 2 addendum).
// T1 high (no_sale/no_show/positive) · T2 neutral engagement · T3 never engaged · T4 excluded
export const deriveM2Tier = (lead) => {
  const d = lead.disposition || '';
  if (['dnc', 'not_interested', 'withdrawn', 'chargeback'].includes(d)) return 4;
  if (['no_sale', 'no_show'].includes(d)) return 1;
  if (['appointment_set', 'audit_set'].includes(lead.stage) || d === 'interested' || d === 'appointment_booked') return 1;
  if (lead.lastContact || ['callback', 'follow_up_needed', 'hung_up'].includes(d)) return 2;
  return 3;
};

const _nextEligibleIso = (lead, gapDays, now = new Date()) => {
  if (lead.lastContact) {
    const lc = new Date(lead.lastContact);
    if (!isNaN(lc.getTime())) return new Date(lc.getTime() + gapDays * 86400000).toISOString();
  }
  return now.toISOString(); // never contacted — eligible immediately
};

// Startup migration (idempotent): day 61+ leads enter M2 (schedule wiped — M2 has
// no structured cadence per docs), day 181+ enter M3 (forever until terminal
// disposition — Jeremy's M3 decision, NO age-kill). Returns patch or null.
export const migrateAgedPhases = (lead, now = new Date()) => {
  if (!lead || lead.phase === 'EXIT' || lead.stage === 'removed') return null;
  if (['dnc', 'not_interested', 'withdrawn', 'chargeback', 'appointment_booked'].includes(lead.disposition)) return null;
  const days = leadAgeDays(lead, now);
  if (days <= 60) return null;
  const target = days <= 180 ? 'M2' : 'M3';
  const already = lead.phase === target && lead.next_dial == null &&
    (target === 'M2' ? lead.m2_tier != null : lead.m3_next_eligible != null);
  if (already) return null;
  const patch = { phase: target, next_dial: null };
  SCHED_COLS.forEach(k => { if (lead[k]) patch[k] = null; });
  if (lead.m2_tier == null) patch.m2_tier = deriveM2Tier(lead);
  if (target === 'M2') {
    patch.m2_next_eligible = lead.m2_next_eligible || _nextEligibleIso(lead, 14, now);
  } else {
    patch.m3_next_eligible = lead.m3_next_eligible || _nextEligibleIso(lead, 30, now);
  }
  return patch;
};

// Missed-slot processor (v3.44 — Jeremy's missed-block decision 2026-06-10:
// auto-log as no-answer, schedule marches on; replaces spreadOverdueLeads).
// Slots >24h past are consumed (nulled) and next_dial advances along the
// PRE-MADE schedule. Slots missed since lastSeen produce auto-log dial events;
// older slots (first run / long gaps) are consumed silently to avoid flooding
// the activity log with thousands of back-dated events.
export const processMissedSlots = (leads, lastSeenIso, now = new Date()) => {
  const cutoff = new Date(now.getTime() - 24 * 3600 * 1000);
  const lastSeen = lastSeenIso ? new Date(lastSeenIso) : null;
  const changedIds = new Set();
  const events = [];
  let silent = 0;
  const out = (leads || []).map(l => {
    if (!l || l.phase === 'EXIT' || l.stage === 'removed') return l;
    if (['dnc', 'not_interested', 'withdrawn', 'chargeback', 'appointment_booked'].includes(l.disposition)) return l;
    const missed = SCHED_COLS.filter(k => l[k] && new Date(l[k]) < cutoff);
    if (!missed.length) return l;
    const patch = {};
    missed.forEach(k => {
      const slotIso = l[k];
      patch[k] = null;
      if (lastSeen && new Date(slotIso) >= lastSeen) {
        events.push({
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ts: slotIso,
          date: slotIso.slice(0, 10),
          type: 'dial',
          leadId: l.id,
          leadName: l.name || null,
          source: 'auto',
          note: '[auto-logged: block missed]',
        });
      } else silent++;
    });
    const merged = { ...l, ...patch };
    merged.next_dial = computeNextDial(merged);
    changedIds.add(l.id);
    return merged;
  });
  return { leads: out, changedIds, events, silentCount: silent };
};

export const applyPhaseTransition = (lead, dispId) => {
  const patch = {};
  const now = new Date().toISOString();

  if (['dnc', 'not_interested', 'withdrawn', 'chargeback'].includes(dispId)) {
    patch.phase = 'EXIT';
    patch.next_dial = null;
    SCHED_COLS.forEach(k => { patch[k] = null; });
  } else if (dispId === 'appointment_booked') {
    patch.phase = lead.phase || 'P1';
  } else if (dispId === 'no_show') {
    const sched = buildSchedule(new Date());
    Object.assign(patch, sched);
    patch.phase = 'P1';
    patch.phase_start = now;
    patch.next_dial = sched.p1_1;
  } else if (dispId === 'no_sale') {
    // Post-audit: sequence track owns days 1-30, phase engine picks up at P3 (day 31, weekly)
    const sched = buildSchedule(new Date());
    Object.assign(patch, sched);
    patch.phase = 'P3';
    patch.phase_start = now;
    patch.next_dial = sched.p3_1;
  } else if (['no_answer', 'vm_left', 'callback', 'follow_up_needed', 'hung_up'].includes(dispId)) {
    const earliest = SCHED_COLS
      .filter(k => lead[k])
      .map(k => ({ k, d: new Date(lead[k]) }))
      .filter(({ d }) => d <= new Date(Date.now() + 86400000))
      .sort((a, b) => a.d - b.d)[0];
    if (earliest) patch[earliest.k] = null;
    patch.next_dial = computeNextDial({ ...lead, ...patch });
    // v3.12 — flip slot on no_answer: never call same person at same time twice
    if (['no_answer', 'vm_left', 'hung_up'].includes(dispId)) {
      patch.slot = (lead.slot || 'AM') === 'AM' ? 'PM' : 'AM';
    }
  }

  return patch;
};

export const getPhasePriority = (lead) => {
  const disp = lead.disposition || '';
  if (disp === 'no_sale') return 100;
  if (disp === 'no_show') return 90;
  // v3.44 — F4: rank on CALENDAR-derived phase, not the stored label.
  // A day-50 lead can no longer hold P1 priority for its whole arc.
  const phase = effectivePhase(lead);
  if (phase === 'P1') return 80;
  if (phase === 'P2') return 70;
  if (phase === 'P3') return 60;
  if (phase === 'M2') return 50;
  if (phase === 'M3') return 45;
  if (lead.bucket === 'A') return 40;
  if (lead.bucket === 'B') return 30;
  return 10;
};

export const isDueToday = (lead) => {
  if (lead.phase === 'EXIT') return false;
  if (lead.stage === 'removed') return false;
  if (['dnc', 'not_interested', 'withdrawn', 'chargeback', 'appointment_booked'].includes(lead.disposition)) return false;

  // v3.7 — don't resurface a lead already contacted today unless a callback is now due
  // v3.10 fix: compare date strings directly (avoids UTC midnight parse timezone offset)
  if (lead.lastContact) {
    const contactedToday = lead.lastContact === new Date().toLocaleDateString('en-CA');
    if (contactedToday) {
      const cbDue = lead.nextCallback && new Date(lead.nextCallback) <= new Date();
      if (!cbDue) return false;
    }
  }

  // v3.44 — M2/M3 leads stay out of the Today queue (Session 3 wires their
  // spillover fill) EXCEPT a due callback always surfaces — agreement-based
  // callbacks ("call me Thursday") are never buried by phase.
  const _eff = effectivePhase(lead);
  if (_eff === 'M2' || _eff === 'M3') {
    if (!lead.nextCallback) return false;
    const _eod = new Date();
    _eod.setHours(23, 59, 59, 999);
    return new Date(lead.nextCallback) <= _eod;
  }

  if (lead.next_dial) {
    const due = new Date(lead.next_dial);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    // v3.30 — staleness guard: don't surface leads whose next_dial is > 14 days
    // in the past. Leads with a valid phase schedule (p1_1 set) are already
    // repaired by normalizePhaseSchedule on startup — they have a current or
    // future next_dial, so this guard is a no-op for them. This only catches
    // orphaned leads (no p1_1) that normalize can't fix, preventing them from
    // flooding Today queue with the entire 2,440-lead database.
    const staleThreshold = new Date();
    staleThreshold.setDate(staleThreshold.getDate() - 14);
    staleThreshold.setHours(0, 0, 0, 0);
    return due >= staleThreshold && due <= endOfDay;
  }

  // Bucket B: surface when a callback is due/overdue today
  if (lead.bucket === 'B') {
    if (!lead.nextCallback) return false;
    const cb = new Date(lead.nextCallback);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return cb <= endOfDay;
  }

  // v3.11 — Bucket A fallback: only truly fresh leads (no schedule built yet, assigned ≤2 days ago)
  // Leads with no next_dial that are older than 2 days should have been backfilled on load —
  // if they still lack a schedule, don't flood the Today queue with all 466 at once.
  if (lead.bucket === 'A') {
    const assigned = lead.assignDate ? new Date(lead.assignDate) : null;
    if (!assigned) return false;
    const daysOld = (Date.now() - assigned.getTime()) / 86400000;
    return daysOld <= 2;
  }

  return false;
};

export const backfillLead = (lead) => {
  const seqDefaults = {
    seqTrack:      lead.seqTrack      ?? 'new',
    seqStep:       lead.seqStep       ?? 0,
    seqStartDate:  lead.seqStartDate  ?? new Date().toISOString(),
    seqPaused:     lead.seqPaused     ?? false,
    seqExitReason: lead.seqExitReason ?? null,
  };
  if (lead.phase) return { ...lead, ...seqDefaults };
  const phase = phaseFromBucket(lead);
  if (phase === 'EXIT') return { ...lead, phase, next_dial: null, ...seqDefaults };
  // v3.44 — M2 entries get tier + eligibility, NOT a fresh P1 schedule
  // (old behavior contradicted the docs: M2 has no structured cadence).
  if (phase === 'M2') {
    return {
      ...lead, phase, next_dial: null,
      m2_tier: lead.m2_tier ?? deriveM2Tier(lead),
      m2_next_eligible: lead.m2_next_eligible || new Date().toISOString(),
      ...seqDefaults,
    };
  }
  const sched = buildSchedule(new Date());
  return { ...lead, phase, phase_start: new Date().toISOString(), next_dial: sched.p1_1, ...sched, ...seqDefaults };
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

// ── SESSION SLOT SYSTEM (v3.12) ─────────────────────────────────────────────
// 11 fixed weekly sessions. slot:'AM'|'PM' on each lead controls which session
// they surface in. Wednesday PM = 6:30–8:00 (late). Saturday AM = 80-lead double.
// No-answer flips the slot so leads are never called at the same time twice.

export const SESSIONS = [
  { id:'MON_AM',  day:1, slot:'AM', startH:9,  startM:0,  endH:10, endM:30, capacity:40, label:'Monday AM'    },
  { id:'MON_PM',  day:1, slot:'PM', startH:16, startM:0,  endH:17, endM:30, capacity:40, label:'Monday PM'    },
  { id:'TUE_AM',  day:2, slot:'AM', startH:9,  startM:0,  endH:10, endM:30, capacity:40, label:'Tuesday AM'   },
  { id:'TUE_PM',  day:2, slot:'PM', startH:14, startM:30, endH:16, endM:0,  capacity:40, label:'Tuesday PM'   },
  { id:'WED_AM',  day:3, slot:'AM', startH:9,  startM:0,  endH:10, endM:30, capacity:40, label:'Wednesday AM' },
  { id:'WED_PM',  day:3, slot:'PM', startH:18, startM:30, endH:20, endM:0,  capacity:40, label:'Wednesday Late'},
  { id:'THU_AM',  day:4, slot:'AM', startH:9,  startM:0,  endH:10, endM:30, capacity:40, label:'Thursday AM'  },
  { id:'THU_PM',  day:4, slot:'PM', startH:16, startM:0,  endH:17, endM:30, capacity:40, label:'Thursday PM'  },
  { id:'FRI_AM',  day:5, slot:'AM', startH:9,  startM:0,  endH:10, endM:30, capacity:40, label:'Friday AM'    },
  { id:'FRI_PM',  day:5, slot:'PM', startH:16, startM:0,  endH:17, endM:30, capacity:40, label:'Friday PM'    },
  { id:'SAT_AM',  day:6, slot:'AM', startH:9,  startM:0,  endH:12, endM:0,  capacity:80, label:'Saturday AM'  },
];

// Returns the active session for a given time, opening 15 min early.
// Returns null between sessions or on Sunday.
export const getActiveSession = (now = new Date()) => {
  const day = now.getDay();
  const hhmm = now.getHours() * 60 + now.getMinutes();
  for (const s of SESSIONS) {
    if (s.day !== day) continue;
    const start = s.startH * 60 + s.startM;
    const end   = s.endH   * 60 + s.endM;
    if (hhmm >= start - 15 && hhmm < end) return s;
  }
  return null;
};

// Returns the next upcoming session (today or future days this week).
export const getNextSession = (now = new Date()) => {
  const day  = now.getDay();
  const hhmm = now.getHours() * 60 + now.getMinutes();
  // Remaining sessions today
  for (const s of SESSIONS) {
    if (s.day === day && (s.startH * 60 + s.startM) > hhmm) return s;
  }
  // Future days, wrapping up to 7
  for (let i = 1; i <= 7; i++) {
    const nd = (day + i) % 7;
    const found = SESSIONS.find(s => s.day === nd);
    if (found) return found;
  }
  return null;
};
// Assigns AM/PM slot. Uses a hash of lead.id for even 50/50 distribution
// regardless of what day or batch leads were uploaded.
// v3.23 — ID-hash based; avoids day-of-month clustering.
export const assignSlot = (lead) => {
  if (lead.slot) return lead.slot;
  // Hash lead ID: deterministic, evenly distributed, upload-date agnostic.
  if (lead.id) {
    const s = String(lead.id);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 2 === 0 ? 'AM' : 'PM';
  }
  // Fallback: date-based (legacy path for leads with no id)
  const dateStr = lead.created_at || lead.phase_start;
  if (dateStr) {
    const day = new Date(dateStr).getDate();
    return day % 2 !== 0 ? 'AM' : 'PM';
  }
  return 'AM';
};

// ── CANONICAL COMPOSITE SORT (v3.26) ────────────────────────────────────────
// Phase priority first, then most-recently-due within the same phase.
// Extracted from buildSessionQueue so all views use identical ordering.
// Import this anywhere a sorted queue is needed instead of duplicating logic.
export const masterQueueSort = (a, b) => {
  const pDiff = getPhasePriority(b) - getPhasePriority(a);
  if (pDiff !== 0) return pDiff;
  // v3.43 — F5: earliest due first (docs: next_dial ascending) — most-overdue
  // leads dial first within a phase. No-schedule leads (no next_dial) sort last.
  const aTs = a.next_dial ? new Date(a.next_dial).getTime() : Infinity;
  const bTs = b.next_dial ? new Date(b.next_dial).getTime() : Infinity;
  return aTs - bTs;
};

// Builds the session queue for a given session.
// Returns up to session.capacity leads: max 15 callbacks (no_sale+no_show),
// remainder filled with phase-scheduled fresh leads.
export const buildSessionQueue = (leads, session) => {
  if (!session) return [];
  const CALLBACK_DISPS = new Set(['no_sale', 'no_show']);
  const SKIP_DISPS     = new Set(['dnc','not_interested','withdrawn','chargeback','appointment_booked']);
  const maxCallbacks   = Math.min(15, Math.round(session.capacity * 0.375));

  const candidates = (leads || []).filter(l => {
    if (l.phase === 'EXIT')          return false;
    if (l.stage === 'removed')       return false;
    if (SKIP_DISPS.has(l.disposition)) return false;
    if (!isDueToday(l))              return false;
    return (l.slot || 'AM') === session.slot;
  });

  // v3.26 — uses masterQueueSort (single source of truth for composite ordering)
  const sorted    = [...candidates].sort(masterQueueSort);
  const callbacks = sorted.filter(l => CALLBACK_DISPS.has(l.disposition));
  const fresh     = sorted.filter(l => !CALLBACK_DISPS.has(l.disposition));

  const cappedCb    = callbacks.slice(0, maxCallbacks);
  const freshSlots  = session.capacity - cappedCb.length;
  const cappedFresh = fresh.slice(0, freshSlots);

  // Priority order: fresh first (P1→P2→P3), callbacks after (cap enforced)
  return [...cappedFresh, ...cappedCb];
};


// ── (v3.42 spreadOverdueLeads DELETED v3.44 — invented dates without contact,
//     violating schedule-rules-all doctrine. Replaced by processMissedSlots +
//     session capacity caps. See tasks/SPEC-M1-M2-M3-BUILD.md Session 2.) ──────

// ── PHASE DATE NORMALIZATION (v3.15) ─────────────────────────────────────────
// Repairs leads whose next_dial is past-due — typically leads imported months ago
// whose phase schedule was built at import time and has since gone stale.
//   • Future phase slots remain → repair next_dial to the earliest one.
//   • All slots exhausted       → null next_dial (lead exits Today queue silently;
//     re-enters only when dispositioned, which rebuilds the schedule fresh).
// Idempotent — safe to run on every startup.
export const normalizePhaseSchedule = (lead) => {
  if (lead.phase === 'EXIT') return null;
  if (!lead.p1_1)            return null; // no schedule to normalize

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Only act when next_dial is genuinely past-due (before today's midnight)
  if (!lead.next_dial || new Date(lead.next_dial) >= startOfToday) return null;

  const nextFuture = computeNextDial(lead);

  if (nextFuture) {
    // Future slot exists — repair the pointer only, leave everything else alone
    return { next_dial: nextFuture };
  }

  // All phase slots exhausted — clear next_dial so isDueToday returns false
  return { next_dial: null };
};

// Counts today's leads per slot — used for session header