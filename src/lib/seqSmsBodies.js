// ── SEQUENCE SMS BODIES (v3.53) ──────────────────────────────────────────────
// Mirror of the process-sequence Edge Function's SMS template map. The cron's
// notes only logged "Track | Step" — never the body. These templates are
// deterministic (track + step + leadType + firstName), so the UI reconstructs
// EXACTLY what was sent, including for the 169 sends of 2026-06-11.
// ⚠ Keep in lockstep with supabase/functions/process-sequence/index.ts.

const SMS = {
  "new:0": {
    mp: n => `Hi ${n}, I'm Jeremy Metka — Senior Field Underwriter. I received your Mortgage Protection request. Today's plans include Living Benefits that pay cash for cancer, stroke, or heart attack — not just at death. Can we connect this week? Reply STOP to opt out.`,
    li: n => `Hi ${n}, I'm Jeremy Metka — Senior Field Underwriter. I received your life insurance inquiry. Today's plans include Living Benefits — cash paid while you're still alive. Can we connect? Reply STOP to opt out.`,
  },
  "new:1": {
    mp: n => `Hi ${n}, Jeremy Metka following up on your Mortgage Protection review. I have 15 minutes to walk you through what's available in your state. When works for you? Reply STOP to opt out.`,
    li: n => `Hi ${n}, Jeremy Metka following up on your life insurance inquiry. 15 minutes is all I need to walk you through your options. When works for you? Reply STOP to opt out.`,
  },
  "new:2": {
    mp: n => `Hi ${n}, checking in on your Mortgage Protection request. Most families I work with had no idea their plan could pay out while they're still alive — not just at death. Worth a quick call. Reply STOP to opt out.`,
    li: n => `Hi ${n}, checking back on your life insurance inquiry. Living Benefits pay cash for critical illness while you're alive. That changes the whole conversation. Reply STOP to opt out.`,
  },
  "new:3": {
    mp: n => `Hi ${n}, Jeremy Metka. Still have your Mortgage Protection file open. Can we connect this week? Reply STOP to opt out.`,
    li: n => `Hi ${n}, Jeremy Metka. Still have your life insurance file open. Can we connect this week? Reply STOP to opt out.`,
  },
  "new:4": {
    mp: n => `Hi ${n} — Mortgage Protection plans today pay cash for cancer, stroke, or heart attack while your mortgage is active. That's the part most people never hear. 15 minutes to show you how it works. Reply STOP to opt out.`,
    li: n => `Hi ${n} — most families think life insurance only pays when you die. The plans I work with also pay cash for critical illness while you're alive. Worth knowing. Reply STOP to opt out.`,
  },
  "new:5": {
    mp: n => `Hi ${n}, Jeremy Metka — last follow-up before I wrap up household files in your area. Is Mortgage Protection still something you want to address? Reply STOP to opt out.`,
    li: n => `Hi ${n}, Jeremy Metka — reaching out before I close your file. Is life insurance still on your list? Reply STOP to opt out.`,
  },
  "new:6": {
    mp: n => `Hi ${n}, I'm wrapping up regional household files this week. Before I archive yours — if protecting your home is still a priority, I'm here. Reply STOP to opt out.`,
    li: n => `Hi ${n}, wrapping up regional files. Before I close yours — if life insurance is still on your list, I'm here. Reply STOP to opt out.`,
  },
  "new:7": {
    mp: n => `Hi ${n}, last message from me — archiving your household file unless I hear back. No hard feelings. Reach out anytime. Reply STOP to opt out.`,
    li: n => `Hi ${n}, last message — archiving your file unless I hear back. Reach out anytime if things change. Reply STOP to opt out.`,
  },
  "re-engage:0": {
    mp: n => `Hi ${n}, I know we haven't connected yet on your Mortgage Protection review. The plans I work with include Living Benefits — cash paid for critical illness while your mortgage is active. Worth 15 min. Reply STOP to opt out.`,
    li: n => `Hi ${n}, we haven't connected on your life insurance inquiry yet. Quick note: these plans pay cash for critical illness while you're alive — not just at death. 15 min. Reply STOP to opt out.`,
  },
  "re-engage:1": {
    mp: n => `Hi ${n}, Jeremy Metka — following up on your Mortgage Protection review. Can we find 15 minutes this week? Reply STOP to opt out.`,
    li: n => `Hi ${n}, Jeremy Metka — following up on your life insurance inquiry. 15 minutes this week? Reply STOP to opt out.`,
  },
  "re-engage:2": {
    mp: n => `Hi ${n}, wrapping up household files in your area. Is Mortgage Protection still on your radar? Reply STOP to opt out.`,
    li: n => `Hi ${n}, making one final attempt before I close your file. Is life insurance still something you want to address? Reply STOP to opt out.`,
  },
  "re-engage:3": {
    mp: n => `Hi ${n}, last message — going ahead and archiving your file. No hard feelings. Reply STOP to opt out.`,
    li: n => `Hi ${n}, last message — archiving your file. No hard feelings. Reply STOP to opt out.`,
  },
  "ghost:0": {
    mp: n => `Hi ${n}, Jeremy Metka — several attempts to reach you about your Mortgage Protection review. Last attempt before I archive your household file. Still interested? Reply STOP to opt out.`,
    li: n => `Hi ${n}, Jeremy Metka — last attempt before I archive your life insurance file. Still interested? Reply STOP to opt out.`,
  },
  "ghost:1": {
    mp: n => `Hi ${n}, going ahead and archiving your household file. Reach out anytime if things change. Reply STOP to opt out.`,
    li: n => `Hi ${n}, archiving your file. Reach out anytime if things change. Reply STOP to opt out.`,
  },

  // ── NO_SALE: sat through audit, didn't buy ──
  "no_sale:0": {
    mp: n => `Hey ${n}, Jeremy here — thanks for making time today. I know we didn't land on a decision yet, and that's completely fine. Whenever the timing feels right, I'm still here. The options we looked at aren't going anywhere. Reply STOP to opt out.`,
    li: n => `Hey ${n}, Jeremy here — thanks for taking the time today. No pressure on a decision. The coverage we reviewed is still available whenever you're ready. Reply STOP to opt out.`,
  },
  "no_sale:1": {
    mp: n => `${n} — just checking in. Sometimes questions come up after sitting with things. Anything I can answer? Happy to jump on a quick call. Reply STOP to opt out.`,
    li: n => `${n} — Jeremy here. Questions sometimes surface after a conversation like ours. I'm a quick call away whenever you need clarity. Reply STOP to opt out.`,
  },
  "no_sale:2": {
    mp: n => `${n}, Jeremy here. The part most families keep thinking about after we talk: Living Benefits — money that pays while you're still alive for cancer, heart attack, stroke. Most plans don't have it. The ones we reviewed do. Reply STOP to opt out.`,
    li: n => `${n} — the plans we reviewed include Living Benefits — cash paid while you're alive for a critical illness. That's not standard. Most people don't realize how rare it is. Reply STOP to opt out.`,
  },
  "no_sale:3": {
    mp: n => `${n} — the rate I quoted was based on your age and health today. Every month that passes is a month older. Still here when you're ready. Reply STOP to opt out.`,
    li: n => `${n}, Jeremy here. The rate from our conversation was locked to your current age and health. That window doesn't stay open forever. Still here. Reply STOP to opt out.`,
  },
  "no_sale:4": {
    mp: n => `${n} — the right Mortgage Protection plan doesn't just pay at death. It can help build equity faster while you're alive and healthy. Most families never put those two things together. Reply STOP to opt out.`,
    li: n => `${n} — Jeremy. Beyond the death benefit, these plans have a living component most people aren't aware of — accelerated payouts for critical illness. Worth locking in before rates change. Reply STOP to opt out.`,
  },
  "no_sale:5": {
    mp: n => `${n} — I'm wrapping up household files in your area this week. Do I need to archive yours or would you like to revisit what we talked about? No pressure either way. Reply STOP to opt out.`,
    li: n => `${n} — closing out regional files this week. Before I archive yours — is protecting your family still something you want to handle? Reply STOP to opt out.`,
  },
};

const TRACK_LABEL_TO_ID = {
  'New Lead': 'new',
  'Re-Engage': 're-engage',
  'Re-engage': 're-engage',
  'Ghost': 'ghost',
  'No Sale': 'no_sale',
  'No-Sale': 'no_sale',
  'No Show': 'no_show',
  'No-Show': 'no_show',
};

// Reconstruct the sent body from a "[SEQ] SMS sent — Track: X | Step N | ..." note.
// Returns null if it can't be determined (template changed, unknown track).
export const reconstructSeqSms = (noteText, lead) => {
  if (!noteText || !noteText.startsWith('[SEQ] SMS sent')) return null;
  const trackLabel = (noteText.match(/Track: ([^|]+) \|/) || [])[1]?.trim();
  const step = (noteText.match(/Step (\d+)/) || [])[1];
  if (!trackLabel || step == null) return null;
  const trackId = TRACK_LABEL_TO_ID[trackLabel] || trackLabel.toLowerCase().replace(/[^a-z_-]/g, '');
  const entry = SMS[`${trackId}:${step}`];
  if (!entry) return null;
  const isMp = ((lead?.leadType || '') + '').toLowerCase().includes('mortgage');
  const fn = isMp ? entry.mp : entry.li;
  const firstName = lead?.firstName || (lead?.name || '').split(' ')[0] || 'there';
  try { return fn(firstName); } catch { return null; }
};
