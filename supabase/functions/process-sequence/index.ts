// ── PROCESS-SEQUENCE Edge Function ────────────────────────────────────────────
// Daily cron: queries all active sequence leads, fires due touches (SMS + email),
// advances seqStep, auto-archives exhausted tracks.
// Every action (email sent, SMS sent, dial reminder flagged, archive, errors)
// is written back to the lead's notes array so CRM activity history is complete.
//
// Called by pg_cron at 8:00 AM UTC daily (see DEPLOY_INSTRUCTIONS.md).
// Also callable manually via POST for testing.
//
// Secrets required (Supabase dashboard → Settings → Edge Functions → Secrets):
//   GMAIL_CLIENT_ID      — OAuth2 client ID (from Google Cloud Console)
//   GMAIL_CLIENT_SECRET  — OAuth2 client secret
//   GMAIL_REFRESH_TOKEN  — Long-lived refresh token (from OAuth2 consent flow)
//   AGENT_PHONE          — Jeremy's phone number for email signatures
//   CALENDLY_URL         — Calendly booking link for email CTAs
//   UNSUBSCRIBE_URL      — Base URL for unsubscribe endpoint (e.g. https://brskbcdaefmkcgctlhlb.supabase.co/functions/v1/unsubscribe?email=)
//
// Auto-injected by Supabase:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── TRACK SCHEDULES ────────────────────────────────────────────────────────────
type SchedEntry = { step: number; day: number; channels: string[] };
const TRACK_SCHEDULES: Record<string, SchedEntry[]> = {
  new: [
    { step: 0,  day: 0,  channels: ["sms", "email"]          },
    { step: 1,  day: 1,  channels: ["sms", "dial_reminder"]  },
    { step: 2,  day: 3,  channels: ["sms", "email"]          },
    { step: 3,  day: 5,  channels: ["sms", "dial_reminder"]  },
    { step: 4,  day: 7,  channels: ["sms", "email"]          },
    { step: 5,  day: 10, channels: ["sms", "dial_reminder"]  },
    { step: 6,  day: 14, channels: ["sms", "email"]          },
    { step: 7,  day: 21, channels: ["sms", "dial_reminder"]  },
    { step: 8,  day: 30, channels: ["archive"]               },
  ],
  "re-engage": [
    { step: 0, day: 0,  channels: ["sms", "email"]          },
    { step: 1, day: 2,  channels: ["sms", "dial_reminder"]  },
    { step: 2, day: 5,  channels: ["sms", "email"]          },
    { step: 3, day: 10, channels: ["sms", "dial_reminder"]  },
    { step: 4, day: 14, channels: ["archive"]               },
  ],
  ghost: [
    { step: 0, day: 0, channels: ["sms", "email"] },
    { step: 1, day: 3, channels: ["sms"]          },
    { step: 2, day: 7, channels: ["archive"]      },
  ],
  // Email-only. Day offsets from original assignDate. Archives at 2yr mark.
  nurture: [
    { step: 0, day: 60,  channels: ["email"]                 },
    { step: 1, day: 120, channels: ["email"]                 },
    { step: 2, day: 180, channels: ["email", "dial_reminder"]},
    { step: 3, day: 270, channels: ["email"]                 },
    { step: 4, day: 365, channels: ["email", "dial_reminder"]},
    { step: 5, day: 540, channels: ["email"]                 },
    { step: 6, day: 730, channels: ["archive"]               },
  ],
  // Client (issued) track — relationship maintenance. No archive.
  // Birthday emails handled separately via daily DOB check, not step-based.
  client: [
    { step: 0, day: 60,  channels: ["email"] },
    { step: 1, day: 120, channels: ["email"] },
    { step: 2, day: 180, channels: ["email"] },
  ],
};

// ── SMS TEMPLATES ─────────────────────────────────────────────────────────────
type SmsFn = (firstName: string) => string;

const SMS: Record<string, { mp: SmsFn; li: SmsFn }> = {
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
};

function getSmsBody(track: string, step: number, cat: string, firstName: string): string | null {
  const key = `${track}:${step}`;
  const t = SMS[key];
  if (!t) return null;
  const fn = cat === "mp" ? t.mp : t.li;
  return fn ? fn(firstName) : null;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function isDueToday(startDateStr: string, dayOffset: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDateStr);
  const due = new Date(start);
  due.setDate(due.getDate() + dayOffset);
  due.setHours(0, 0, 0, 0);
  return due <= today;
}

function leadCat(leadType: string): "mp" | "li" {
  return (leadType || "").toLowerCase().includes("mortgage") ? "mp" : "li";
}

// ── NOTE FACTORY ──────────────────────────────────────────────────────────────
type CRMNote = { ts: string; type: string; text: string };

function makeNote(text: string): CRMNote {
  return { ts: new Date().toISOString(), type: "note", text };
}

// ── TRACK LABELS ──────────────────────────────────────────────────────────────
const TRACK_LABEL: Record<string, string> = {
  "new":        "New Lead",
  "re-engage":  "Re-Engage",
  "ghost":      "Ghost Protocol",
};

// ── GMAIL API ─────────────────────────────────────────────────────────────────

async function getGmailAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gmail token refresh failed: ${err.slice(0, 300)}`);
  }
  const json = await resp.json() as { access_token: string };
  if (!json.access_token) throw new Error("Gmail token refresh: no access_token in response");
  return json.access_token;
}

function base64urlEncode(input: string): string {
  // Proper UTF-8 → bytes → base64url
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sendGmailEmail(params: {
  accessToken: string;
  to: string;
  subject: string;
  htmlBody: string;
}): Promise<void> {
  const { accessToken, to, subject, htmlBody } = params;

  // RFC 2047 encoded-word for non-ASCII subject characters (em dash, etc.)
  const subjectBytes = new TextEncoder().encode(subject);
  let subjectBinary = "";
  for (const byte of subjectBytes) { subjectBinary += String.fromCharCode(byte); }
  const encodedSubject = `=?UTF-8?B?${btoa(subjectBinary)}?=`;

  const rawMessage = [
    `From: Jeremy Metka <Jeremy@metkasolutions.com>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlBody,
  ].join("\r\n");

  const encoded = base64urlEncode(rawMessage);

  const resp = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ raw: encoded }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gmail send failed (${resp.status}): ${err.slice(0, 300)}`);
  }
}

// ── EMAIL TEMPLATES ────────────────────────────────────────────────────────────

type EmailContent = { subject: string; bodyHtml: string };

/**
 * Returns subject + inner body HTML snippet (not the full wrapper).
 * Returns null if no email template exists for this track/step combo.
 */
function getEmailContent(
  track: string,
  step: number,
  cat: "mp" | "li",
  firstName: string
): EmailContent | null {
  const isMp = cat === "mp";

  // ── NEW TRACK ─────────────────────────────────────────────────────────────
  if (track === "new") {
    if (step === 0) {
      return {
        subject: isMp
          ? `Your Mortgage Protection Review — Living Benefits Included`
          : `Your Life Insurance Inquiry — What Most Families Never Hear`,
        bodyHtml: isMp
          ? `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Thank you for requesting a Mortgage Protection review. Before we talk numbers, I want to make sure you know something most families never hear about.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">The plans I work with include <strong>Living Benefits</strong> — meaning if you're ever diagnosed with cancer, suffer a heart attack, or have a stroke, your plan pays cash directly to you while you're still alive. Not to a hospital. To you. To use however your family needs it most.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I'd love to walk you through what's available in your state in a quick 15-minute call. There's no obligation, and you'll leave knowing exactly where you stand.</p>`
          : `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Thank you for your life insurance inquiry. Before we go any further, there's something important most families never hear.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">The plans I specialize in include <strong>Living Benefits</strong> — cash paid directly to you if you're diagnosed with cancer, have a heart attack, or suffer a stroke. You don't have to die to collect. The money is yours to use however your family needs it.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I'd love to walk you through your options in a quick 15-minute call. No pressure, no jargon — just a clear picture of what's available and what it costs.</p>`,
      };
    }
    if (step === 2) {
      return {
        subject: isMp
          ? `Following Up — Your Mortgage Protection Review`
          : `Following Up on Your Life Insurance Inquiry`,
        bodyHtml: isMp
          ? `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I wanted to follow up on your Mortgage Protection request — I still have your file open.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">One thing that surprises most families: protecting your mortgage isn't just about what happens if you pass away. The plans I work with also pay a cash benefit if you're diagnosed with a critical illness — so your family doesn't lose the home while you're still fighting to get well.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">A 15-minute call is all it takes to see what you qualify for. I'll do the heavy lifting.</p>`
          : `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Following up on your life insurance inquiry — I still have your file open and wanted to reach out.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">A lot of people come to me thinking life insurance is just a death benefit. The plans I specialize in also pay a cash benefit for critical illness — cancer, heart attack, stroke — while you're still alive. That changes the whole conversation.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If you're still exploring options, let's find 15 minutes. I'll show you exactly what's available in your state.</p>`,
      };
    }
    if (step === 4) {
      return {
        subject: isMp
          ? `Still Have Your File Open, ${firstName}`
          : `Still Here — Your Life Insurance File`,
        bodyHtml: isMp
          ? `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I've reached out a couple of times and I don't want to be a nuisance — but I also don't want to close your file without making sure you had a real chance to see what's available.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Mortgage Protection plans that include Living Benefits are something most families wish they'd known about sooner. The cash benefit for cancer, heart attack, or stroke can be the difference between keeping your home and losing it during the hardest season of your life.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If now's not the right time, just say the word and I'll close your file. Otherwise — 15 minutes and we'll get you taken care of.</p>`
          : `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I've followed up a couple of times — I don't want to crowd your inbox, but I also want to make sure you had a real opportunity here.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">The plans I work with pay cash for critical illness — cancer, heart attack, stroke — while you're still alive. That's money your family can use for treatment, bills, or whatever they need most. Most people don't know this is even an option.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If you're still interested, let's talk. If not, just let me know and I'll close your file — no hard feelings.</p>`,
      };
    }
    if (step === 6) {
      return {
        subject: isMp
          ? `Wrapping Up Household Files — One Last Note, ${firstName}`
          : `Closing Your File — One Last Note, ${firstName}`,
        bodyHtml: isMp
          ? `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I'm wrapping up household files in your area this week. Before I archive yours, I wanted to send one final note.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If protecting your home and your family from a critical illness is still something you want to address — the Living Benefits on these plans pay cash for cancer, heart attack, or stroke while your mortgage is active — I'm still here and happy to help.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If life's gotten busy and now's not the time, I completely understand. No hard feelings. Reach out anytime and I'll reopen your file.</p>`
          : `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I'm closing out regional files this week. Before I archive yours, I want to send one last note.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If life insurance — especially the kind that pays cash for a critical illness diagnosis while you're still alive — is still on your list, I'm here.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If the timing isn't right, that's completely okay. Reach out anytime and I'll pick your file right back up. Take care, ${firstName}.</p>`,
      };
    }
  }

  // ── RE-ENGAGE TRACK ────────────────────────────────────────────────────────
  if (track === "re-engage") {
    if (step === 0) {
      return {
        subject: isMp
          ? `Picking Up Where We Left Off — Mortgage Protection`
          : `Picking Up Where We Left Off — Life Insurance`,
        bodyHtml: isMp
          ? `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I know we haven't been able to connect yet on your Mortgage Protection review. I wanted to try one more time.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">The thing that sets these plans apart is the <strong>Living Benefits</strong> component — if you're ever diagnosed with cancer, suffer a heart attack, or have a stroke, your plan pays cash directly to you while your mortgage is still active. Your family keeps the home whether or not you're able to work.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Most families don't know this exists until it's too late to qualify. 15 minutes is all I need. Would this week work?</p>`
          : `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I wanted to reach back out on your life insurance inquiry. We haven't had a chance to connect, and I didn't want to close your file without one more try.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">The plans I specialize in include <strong>Living Benefits</strong> — meaning a cancer diagnosis, heart attack, or stroke triggers a cash payout to you while you're still alive. That's not standard with most life insurance, and it's the part that changes the conversation for most families.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If you have 15 minutes this week, I'd love to show you what you qualify for.</p>`,
      };
    }
    if (step === 2) {
      return {
        subject: isMp
          ? `Final Attempt — Your Mortgage Protection Review`
          : `Final Attempt — Your Life Insurance Review`,
        bodyHtml: isMp
          ? `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">This will be my last email — I don't want to keep filling your inbox.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If protecting your mortgage and your family from a critical illness is something you still want to address, I hope you'll reach out when the timing is right. The door doesn't close just because I stop emailing.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I genuinely wish you and your family well, ${firstName}. Reach out any time.</p>`
          : `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">This will be my last outreach for now. I don't want to wear out my welcome.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If life insurance — especially coverage that pays cash for a critical illness while you're still alive — is ever something you want to explore, I'm always just a call away. I'm closing your file, not the door.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Take care, ${firstName}. Reach out any time and I'll be happy to help.</p>`,
      };
    }
  }

  // ── GHOST TRACK ────────────────────────────────────────────────────────────
  if (track === "ghost") {
    if (step === 0) {
      return {
        subject: isMp
          ? `Archiving Your Household File — Last Note, ${firstName}`
          : `Archiving Your File — Last Note, ${firstName}`,
        bodyHtml: isMp
          ? `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I've made several attempts to reach you and I understand life gets busy. This is my last note before I close your household file.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If protecting your home and your family from a critical illness is still on your list — the Living Benefits on these plans pay cash for cancer, heart attack, or stroke while your mortgage is active — I hope you'll reach out when the timing is right.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">No hard feelings. The door is always open. I wish you and your family well.</p>`
          : `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I've reached out several times and I don't want to keep interrupting your day. This is my final note before I close your file.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If life insurance — especially coverage that pays cash for a critical illness while you're still alive — ever becomes a priority, please don't hesitate to reach out. I'll pick your file right back up.</p>
             <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I wish you and your family all the best, ${firstName}.</p>`,
      };
    }
  }

  // ── NURTURE TRACK ─────────────────────────────────────────────────────────
  if (track === "nurture") {
    if (step === 0) {
      return {
        subject: `Still Here When You're Ready — Jeremy Metka`,
        bodyHtml: `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">It's been a couple of months since we last connected. I wanted to check in — no pressure, just keeping the line open.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If protecting your family with life insurance is back on your radar, I'm still here. The plans I work with still include <strong>Living Benefits</strong> — cash paid directly to you for a cancer diagnosis, heart attack, or stroke. That's money your family controls, not a hospital.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Whenever you're ready, just reach out or book a call below. I'll take it from there.</p>`,
      };
    }
    if (step === 1) {
      return {
        subject: `Something Most Families Never Know About Life Insurance`,
        bodyHtml: `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I wanted to share something that most people never hear until it's too late to qualify for it.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">The life insurance plans I specialize in include <strong>Living Benefits</strong> — a provision that pays a portion of the benefit directly to you, in cash, if you're diagnosed with cancer, have a heart attack, or suffer a stroke while the policy is active.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">The money goes to you — not a hospital, not a creditor. You decide how it gets used. Medical bills, mortgage payments, time off to recover — whatever your family needs most.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If that sounds like the kind of coverage your family deserves, I'd love to show you what you qualify for. A 15-minute call is all it takes.</p>`,
      };
    }
    if (step === 2) {
      return {
        subject: `Six Months Later — Any Changes in Your Situation?`,
        bodyHtml: `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">It's been about six months since we first connected. A lot can change in that time — new home, growing family, changes in health — and I wanted to check in.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If life insurance or mortgage protection has come back to mind, this is a good time to revisit. The plans I work with include <strong>Living Benefits</strong>, and qualifying while you're in good health is always easier than waiting.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Happy to do a quick 15-minute review — no cost, no commitment. Just a clear picture of where you stand.</p>`,
      };
    }
    if (step === 3) {
      return {
        subject: `What Happens to Your Family If You Can't Work?`,
        bodyHtml: `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Most families plan for death. Very few plan for the things that happen before it.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">A cancer diagnosis. A heart attack at 45. A stroke that takes months of recovery. These events happen every day — and without a plan, they can devastate a family financially long before death enters the picture.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">The life insurance plans I specialize in address exactly this. <strong>Living Benefits</strong> pay cash directly to you for a qualifying critical illness — so your family can focus on recovery, not financial survival.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If that's a conversation worth having, I'm here. Book a call below whenever you're ready.</p>`,
      };
    }
    if (step === 4) {
      return {
        subject: `One Year Out — Still Thinking of You, ${firstName}`,
        bodyHtml: `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">It's been about a year since we first connected. I keep reaching out because I've seen what happens to families who had the right coverage in place — and what happens to the ones who didn't.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If you've been meaning to get life insurance sorted out, there's no better time than now. Rates are based on current age and health, and both tend to work against us as time goes by.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">A quick 15-minute call and I can show you exactly what's available and what it would cost your family. No pressure. Just information.</p>`,
      };
    }
    if (step === 5) {
      return {
        subject: `One Final Note From Me, ${firstName}`,
        bodyHtml: `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">This will be my last email to you for a long while — I don't want to stay in your inbox indefinitely.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If protecting your family with life insurance that includes <strong>Living Benefits</strong> — cash paid for a critical illness while you're still alive — ever rises to the top of your list, please reach out. I'll be here.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">It has been a privilege staying in touch. I wish you and your family every blessing. Take good care, ${firstName}.</p>`,
      };
    }
  }

  // ── CLIENT TRACK ─────────────────────────────────────────────────────────────
  // Relationship maintenance for issued/active policyholders.
  // No sales pressure. Stewardship tone throughout.
  if (track === "client") {
    if (step === 0) {
      return {
        subject: `Your Coverage Is Active — Here's What It Can Do For You, ${firstName}`,
        bodyHtml: `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I wanted to take a moment to check in now that your coverage is active.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Most families know their plan protects them when they pass away — but fewer realize the full picture of what they have. The <strong>Living Benefits</strong> on your plan mean that if you're ever diagnosed with cancer, suffer a heart attack, or have a stroke, your coverage can pay a cash benefit directly to you while you're still alive. That money is yours to use however your family needs it most — medical bills, mortgage payments, time to recover.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I'm here for any questions as they come up. And if anything in your life changes — new home, growing family, income shift — reach out and we'll make sure your coverage still fits.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">It's an honor to serve your family, ${firstName}.</p>`,
      };
    }
    if (step === 1) {
      return {
        subject: `Who Else In Your Circle Deserves This Conversation?`,
        bodyHtml: `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">${firstName}, I wanted to check in and say thank you — again — for trusting me with your family's protection.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Most of the families I work with come to me through someone who cared enough to make an introduction. If you know a friend, sibling, coworker, or neighbor who doesn't have coverage in place — or who has old coverage that hasn't been reviewed in years — I'd be honored if you'd pass my name along.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">There's never any pressure on my end. I'm just here to make sure the right families get the right information.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">You can send them my digital card below, or just have them reach out directly. I'll take good care of them.</p>`,
      };
    }
    if (step === 2) {
      return {
        subject: `Your Annual Protection Review — Let's Make Sure Nothing's Changed`,
        bodyHtml: `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">${firstName}, it's been about six months since your coverage went active. I like to do an annual check-in with every family I serve — not to change anything, just to make sure your plan still fits your life.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">A lot can happen in a year — new mortgage, new addition to the family, income changes, health updates. Any of those can mean your coverage deserves a second look.</p>
           <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">If you'd like to schedule a quick 15-minute review, I'd love to connect. If everything's unchanged and you're good — that's great too. Just know I'm always a call away.</p>`,
      };
    }
  }

  return null; // No email template for this track/step
}

/**
 * Wraps inner body HTML in the full branded email template.
 */
function buildEmailHtml(params: {
  bodyContent: string;
  agentPhone: string;
  calendlyUrl: string;
  email: string;
  unsubscribeBaseUrl: string;
  includeLivingBenefits?: boolean;
  includeCta?: boolean;
  ctaText?: string;
}): string {
  const {
    bodyContent, agentPhone, calendlyUrl, email, unsubscribeBaseUrl,
    includeLivingBenefits = true,
    includeCta = true,
    ctaText = "Schedule Your Protection Audit &rarr;",
  } = params;
  const unsubLink = `${unsubscribeBaseUrl}${encodeURIComponent(email)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;">

        <!-- HEADER -->
        <tr>
          <td style="background:#1a2a44;padding:24px 32px;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#ffffff;font-weight:bold;line-height:1.2;">Jeremy Metka</p>
            <p style="margin:6px 0 0;font-size:13px;color:#8fadc8;letter-spacing:0.3px;">Senior Field Underwriter &nbsp;|&nbsp; NPN #21425108</p>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:32px 32px 24px;">
            ${bodyContent}
          </td>
        </tr>

        ${includeLivingBenefits ? `<!-- LIVING BENEFITS CALLOUT -->
        <tr>
          <td style="padding:0 32px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#eef2f7;border-left:4px solid #1a2a44;padding:16px 20px;">
                  <p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:14px;font-weight:bold;color:#1a2a44;">What Are Living Benefits?</p>
                  <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">The plans I work with pay a cash benefit directly to you — not a hospital, not a creditor — if you are diagnosed with cancer, have a heart attack, or suffer a stroke. You decide how to use the money.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : ""}

        ${includeCta ? `<!-- CTA -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <a href="${calendlyUrl}" style="display:inline-block;background:#1a2a44;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;padding:15px 36px;text-decoration:none;letter-spacing:0.3px;">${ctaText}</a>
          </td>
        </tr>` : ""}

        <!-- SIGNATURE -->
        <tr>
          <td style="padding:20px 32px 24px;border-top:1px solid #e5e5e5;">
            <a href="https://hihello.com/p/6cc69b25-86ec-4c39-a45b-fd48bee85403?referer=email_signature&source=manual" style="display:block;text-decoration:none;border:0;">
              <img src="https://cdn.hihello.me/cards/6cc69b25-86ec-4c39-a45b-fd48bee85403/signature_imagelogo.png" width="360" alt="Jeremy Metka | Senior Field Underwriter | Metka Solutions | (580) 775-7564 | Jeremy@metkasolutions.com" style="display:block;border:0;max-width:100%;height:auto;" />
            </a>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#f7f7f7;padding:16px 32px;text-align:center;border-top:1px solid #e5e5e5;">
            <p style="margin:0;font-size:11px;color:#aaa;line-height:1.6;">
              Metka Solutions | Durant, OK 74701<br>
              Licensed in OK, TX, VA, OH, NC, IL, MO, NJ, PA, AZ, NY, WA, AL, FL, GA, CA<br>
              <a href="${unsubLink}" style="color:#aaa;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceKey     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const gmailClientId  = Deno.env.get("GMAIL_CLIENT_ID")     || "";
    const gmailSecret    = Deno.env.get("GMAIL_CLIENT_SECRET") || "";
    const gmailRefresh   = Deno.env.get("GMAIL_REFRESH_TOKEN") || "";
    const agentPhone     = Deno.env.get("AGENT_PHONE")         || "(580) 775-7564";
    const calendlyUrl    = Deno.env.get("CALENDLY_URL")        || "";
    const unsubBaseUrl   = Deno.env.get("UNSUBSCRIBE_URL")     || `${supabaseUrl}/functions/v1/unsubscribe?email=`;

    const supabase = createClient(supabaseUrl, serviceKey);
    const smsFnUrl = `${supabaseUrl}/functions/v1/send-sms`;

    // Cache Gmail access token for the duration of this run (tokens last 1hr)
    let gmailAccessToken: string | null = null;
    const emailEnabled = !!(gmailClientId && gmailSecret && gmailRefresh);

    // ── LOAD LEADS ────────────────────────────────────────────────────────────
    const PAGE = 1000;
    let allRows: { id: string; data: Record<string, unknown> }[] = [];
    let from = 0, done = false;
    while (!done) {
      const { data, error } = await supabase
        .from("leads")
        .select("id, data")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`[load] ${error.message}`);
      allRows = allRows.concat(data || []);
      done = !data || data.length < PAGE;
      from += PAGE;
    }

    // Filter to EXPLICITLY enrolled sequence leads only.
    // seqTrack MUST be set — never default unset leads to any track.
    const active = allRows.filter(row => {
      const d = row.data || {};
      const track = d.seqTrack as string;
      return !!track && !d.seqPaused && !d.seqExitReason;
    });

    const results = {
      total:      allRows.length,
      active:     active.length,
      processed:  0,
      archived:   0,
      emailsSent: 0,
      smsSent:    0,
      skipped:    0,
      errors:     [] as string[],
    };

    for (const row of active) {
      const lead = row.data as Record<string, unknown>;
      const track = lead.seqTrack as string;
      // Hard skip — never process a lead without an explicit seqTrack enrollment
      if (!track) { results.skipped++; continue; }
      const sched = TRACK_SCHEDULES[track];
      if (!sched) { results.skipped++; continue; }

      const step    = (lead.seqStep as number) ?? 0;
      const entry   = sched.find(s => s.step === step);
      if (!entry)   { results.skipped++; continue; }

      const startDate = (lead.seqStartDate as string) || (lead.assignDate as string) || new Date().toISOString();
      if (!isDueToday(startDate, entry.day)) { results.skipped++; continue; }

      const trackLabel = TRACK_LABEL[track] || track;

      // ── ARCHIVE STEP ──────────────────────────────────────────────
      if (entry.channels.includes("archive")) {
        const assignDateStr = (lead.assignDate as string) || startDate;
        const existingNotes = (lead.notes as CRMNote[]) || [];

        if (track !== "nurture") {
          // Enroll in nurture — keep seqStartDate as assignDate so day offsets align
          const enrollNote = makeNote(
            `[SEQ] ${trackLabel} track complete — enrolled in Nurture drip (email-only to 2yr mark).`
          );
          const enrolled = {
            ...lead,
            seqTrack:      "nurture",
            seqStep:       0,
            seqPaused:     false,
            seqExitReason: null,
            seqStartDate:  assignDateStr,
            notes:         [enrollNote, ...existingNotes],
          };
          await supabase.from("leads")
            .update({ data: enrolled, updated_at: new Date().toISOString() })
            .eq("id", row.id);
          results.processed++;
        } else {
          // Nurture exhausted = true 2yr archive
          const archiveNote = makeNote(
            `[SEQ] Nurture complete — Track: Nurture | Step ${step} | File archived at 2yr mark.`
          );
          const archived = {
            ...lead,
            seqPaused:     true,
            seqExitReason: "exhausted",
            stage: (lead.stage === "new" || lead.stage === "contacted") ? "archived" : lead.stage,
            notes: [archiveNote, ...existingNotes],
          };
          await supabase.from("leads")
            .update({ data: archived, updated_at: new Date().toISOString() })
            .eq("id", row.id);
          results.archived++;
        }
        continue;
      }

      const firstName = (lead.firstName as string) || ((lead.name as string) || "").split(" ")[0] || "there";
      const cat       = leadCat((lead.leadType as string) || "");

      const activityNotes: CRMNote[] = [];

      // ── SEND SMS ──────────────────────────────────────────────────
      if (entry.channels.includes("sms") && lead.phone) {
        const smsBody = getSmsBody(track, step, cat, firstName);
        if (smsBody) {
          try {
            const resp = await fetch(smsFnUrl, {
              method:  "POST",
              headers: {
                "Content-Type":  "application/json",
                "Authorization": `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({ to: lead.phone, body: smsBody, leadId: row.id }),
            });
            if (resp.ok) {
              results.smsSent++;
              activityNotes.push(makeNote(
                `[SEQ] SMS sent — Track: ${trackLabel} | Step ${step} | To: ${lead.phone}`
              ));
            } else {
              const errText = await resp.text();
              const errMsg = errText.slice(0, 120);
              results.errors.push(`SMS[${row.id}]: ${errMsg}`);
              activityNotes.push(makeNote(
                `[SEQ] SMS FAILED — Track: ${trackLabel} | Step ${step} | Error: ${errMsg}`
              ));
            }
          } catch (e) {
            const errMsg = (e as Error).message;
            results.errors.push(`SMS[${row.id}]: ${errMsg}`);
            activityNotes.push(makeNote(
              `[SEQ] SMS FAILED — Track: ${trackLabel} | Step ${step} | Error: ${errMsg}`
            ));
          }
        }
      }

      // ── SEND EMAIL (Gmail API) ─────────────────────────────────────
      if (entry.channels.includes("email") && lead.email && emailEnabled) {
        const emailContent = getEmailContent(track, step, cat, firstName);
        if (emailContent) {
          try {
            // Lazy-load access token once per run
            if (!gmailAccessToken) {
              gmailAccessToken = await getGmailAccessToken(gmailClientId, gmailSecret, gmailRefresh);
            }
            const htmlBody = buildEmailHtml({
              bodyContent:       emailContent.bodyHtml,
              agentPhone,
              calendlyUrl,
              email:             lead.email as string,
              unsubscribeBaseUrl: unsubBaseUrl,
            });
            await sendGmailEmail({
              accessToken: gmailAccessToken,
              to:          lead.email as string,
              subject:     emailContent.subject,
              htmlBody,
            });
            results.emailsSent++;
            activityNotes.push(makeNote(
              `[SEQ] Email sent — Track: ${trackLabel} | Step ${step} | Subject: "${emailContent.subject}" | To: ${lead.email}`
            ));
          } catch (e) {
            const errMsg = (e as Error).message;
            results.errors.push(`Email[${row.id}]: ${errMsg}`);
            activityNotes.push(makeNote(
              `[SEQ] Email FAILED — Track: ${trackLabel} | Step ${step} | Error: ${errMsg}`
            ));
          }
        }
      } else if (entry.channels.includes("email") && lead.email && !emailEnabled) {
        activityNotes.push(makeNote(
          `[SEQ] Email SKIPPED — Gmail secrets not configured | Track: ${trackLabel} | Step ${step}`
        ));
      }

      // ── DIAL REMINDER ─────────────────────────────────────────────
      if (entry.channels.includes("dial_reminder")) {
        activityNotes.push(makeNote(
          `[SEQ] Dial reminder — Track: ${trackLabel} | Step ${step} | Manual call due today.`
        ));
      }

      // ── ADVANCE STEP ──────────────────────────────────────────────
      const nextStep  = step + 1;
      const nextEntry = sched.find(s => s.step === nextStep);
      const seqPatch  = (!nextEntry || nextEntry.channels.includes("archive"))
        ? { seqStep: nextStep, seqPaused: true, seqExitReason: "exhausted" }
        : { seqStep: nextStep };

      const existingNotes = (lead.notes as CRMNote[]) || [];
      const updatedLead = {
        ...lead,
        ...seqPatch,
        notes: [...activityNotes, ...existingNotes],
      };

      await supabase.from("leads")
        .update({ data: updatedLead, updated_at: new Date().toISOString() })
        .eq("id", row.id);

      results.processed++;
    }

    // ── BIRTHDAY CHECK ────────────────────────────────────────────────────────
    // Runs daily across all client-track leads. Sends a warm personal birthday
    // email when DOB month+day matches today. Does NOT advance seqStep.
    if (emailEnabled) {
      const todayUtc   = new Date();
      const todayMonth = todayUtc.getUTCMonth() + 1; // 1–12
      const todayDay   = todayUtc.getUTCDate();       // 1–31
      const thisYear   = String(todayUtc.getUTCFullYear());

      const { data: clientRows } = await supabase
        .from("leads")
        .select("id, data")
        .filter("data->>seqTrack", "eq", "client");

      for (const crow of clientRows || []) {
        const cl = crow.data || {};
        if (cl.seqExitReason) continue;

        const dobRaw = ((cl.dob || cl.DOB || cl.dateOfBirth || "") as string).trim();
        if (!dobRaw) continue;

        // Parse DOB — supports MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY
        let dobMonth = 0, dobDay = 0;
        if (dobRaw.includes("/")) {
          const p = dobRaw.split("/");
          dobMonth = parseInt(p[0], 10);
          dobDay   = parseInt(p[1], 10);
        } else if (dobRaw.includes("-")) {
          const p = dobRaw.split("-");
          if (p[0].length === 4) { dobMonth = parseInt(p[1], 10); dobDay = parseInt(p[2], 10); }
          else                   { dobMonth = parseInt(p[0], 10); dobDay = parseInt(p[1], 10); }
        }
        if (!dobMonth || !dobDay) continue;
        if (dobMonth !== todayMonth || dobDay !== todayDay) continue;

        // Skip if already sent this calendar year
        if ((cl.seqBirthdayYear as string) === thisYear) continue;

        const bdayFirstName = (cl.firstName as string) || ((cl.name as string) || "").split(" ")[0] || "Friend";
        const bdayEmail     = (cl.email as string) || "";
        if (!bdayEmail) continue;

        const bdayBody = `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Happy Birthday, ${bdayFirstName}!</p>
          <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">I just wanted to take a moment on your special day to say that it's been a privilege serving your family. Wishing you a wonderful year ahead filled with health, joy, and everything you deserve.</p>
          <p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Enjoy your day, ${bdayFirstName}. You've earned it.</p>`;

        const bdayHtml = buildEmailHtml({
          bodyContent:          bdayBody,
          agentPhone,
          calendlyUrl,
          email:                bdayEmail,
          unsubscribeBaseUrl:   unsubBaseUrl,
          includeLivingBenefits: false,
          includeCta:            false,
        });

        try {
          if (!gmailAccessToken) {
            gmailAccessToken = await getGmailAccessToken(gmailClientId, gmailSecret, gmailRefresh);
          }
          await sendGmailEmail({
            accessToken: gmailAccessToken,
            to:          bdayEmail,
            subject:     `Happy Birthday, ${bdayFirstName}! 🎂`,
            htmlBody:    bdayHtml,
          });
          results.emailsSent++;

          // Mark birthday sent this year + log note
          const bdayNote = makeNote(`[SEQ] Birthday email sent — ${todayUtc.toISOString().split("T")[0]}`);
          const existingBdayNotes = (cl.notes as CRMNote[]) || [];
          await supabase.from("leads")
            .update({
              data: { ...cl, seqBirthdayYear: thisYear, notes: [bdayNote, ...existingBdayNotes] },
              updated_at: new Date().toISOString(),
            })
            .eq("id", crow.id);
        } catch (e) {
          results.errors.push(`Birthday[${crow.id}]: ${(e as Error).message}`);
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    console.log("[process-sequence] run complete:", JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[process-sequence] fatal:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
