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
//   APPS_SCRIPT_EMAIL_URL   — deployed Google Apps Script web app URL
//   AGENT_PHONE             — Jeremy's phone number for email signatures
//   CALENDLY_URL            — Calendly booking link for email CTAs
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
    { step: 0, day: 60,  channels: ["email"]                },
    { step: 1, day: 120, channels: ["email"]                },
    { step: 2, day: 180, channels: ["email", "dial_reminder"]},
    { step: 3, day: 270, channels: ["email"]                },
    { step: 4, day: 365, channels: ["email", "dial_reminder"]},
    { step: 5, day: 540, channels: ["email"]                },
    { step: 6, day: 730, channels: ["archive"]              },
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
// Produces a note object matching CRM leads.js format:
//   { ts: ISO string, type: "note", text: string }
// Prepended to lead.notes — appears at top of contact card timeline.
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

// ── MAIN ──────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceKey     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appsScriptUrl  = Deno.env.get("APPS_SCRIPT_EMAIL_URL") || "";
    const agentPhone     = Deno.env.get("AGENT_PHONE")   || "";
    const calendlyUrl    = Deno.env.get("CALENDLY_URL")  || "";

    const supabase = createClient(supabaseUrl, serviceKey);
    const smsFnUrl = `${supabaseUrl}/functions/v1/send-sms`;

    // Load all leads — data is a JSONB blob per the leads table schema.
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

    // Filter to active sequence leads only
    const active = allRows.filter(row => {
      const d = row.data || {};
      return !d.seqPaused && !d.seqExitReason;
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
      const track = (lead.seqTrack as string) || "new";
      const sched = TRACK_SCHEDULES[track];
      if (!sched) { results.skipped++; continue; }

      const step    = (lead.seqStep as number) ?? 0;
      const entry   = sched.find(s => s.step === step);
      if (!entry)   { results.skipped++; continue; }

      const startDate = (lead.seqStartDate as string) || (lead.assignDate as string) || new Date().toISOString();
      if (!isDueToday(startDate, entry.day)) { results.skipped++; continue; }

      const trackLabel = TRACK_LABEL[track] || track;

      // ── ARCHIVE STEP ──────────────────────────────────────────────
      // When a non-nurture track exhausts → auto-enroll in nurture (email-only
      // slow drip to 2yr mark). When nurture itself exhausts → real archive.
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
            seqStartDate:  assignDateStr, // offsets measured from original assign date
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

      // Collect all activity notes for this lead this run
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

      // ── SEND EMAIL ────────────────────────────────────────────────
      if (entry.channels.includes("email") && lead.email && appsScriptUrl) {
        try {
          const resp = await fetch(appsScriptUrl, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              firstName,
              email:       lead.email,
              leadType:    lead.leadType    || "Mortgage Protection",
              track,
              step,
              agentPhone,
              calendlyUrl,
            }),
          });
          if (resp.ok) {
            results.emailsSent++;
            activityNotes.push(makeNote(
              `[SEQ] Email sent — Track: ${trackLabel} | Step ${step} | To: ${lead.email}`
            ));
          } else {
            const errText = await resp.text();
            const errMsg = errText.slice(0, 120);
            results.errors.push(`Email[${row.id}]: ${errMsg}`);
            activityNotes.push(makeNote(
              `[SEQ] Email FAILED — Track: ${trackLabel} | Step ${step} | Error: ${errMsg}`
            ));
          }
        } catch (e) {
          const errMsg = (e as Error).message;
          results.errors.push(`Email[${row.id}]: ${errMsg}`);
          activityNotes.push(makeNote(
            `[SEQ] Email FAILED — Track: ${trackLabel} | Step ${step} | Error: ${errMsg}`
          ));
        }
      }

      // ── DIAL REMINDER ─────────────────────────────────────────────
      // dial_reminder = no automated message; flags lead for manual call.
      // Log it so it appears in the CRM timeline as a to-do reminder.
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

      // Prepend all activity notes to existing lead notes
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
