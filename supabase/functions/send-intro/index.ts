// ── SEND-INTRO Edge Function ───────────────────────────────────────────────
// Auto-fires Jeremy's 🔥 Card intro SMS to NEW inbound leads, hands-free.
//
// SAFETY MODEL (mandatory after the 2026-06-11 incident — 169 texts at 4AM):
//   1. KILL SWITCH    — sends NOTHING unless INTRO_ENABLED === "true". Default OFF.
//   2. NEW LEADS ONLY — only leads stamped data.introEligible === true by the
//      intake scripts. The existing ~2,481-lead backlog has no such flag, so it
//      can NEVER be touched by this function, even if the switch is on.
//   3. ONCE-ONLY      — introSent set after a successful send; never repeats.
//   4. OPT-OUT        — smsOptOut skipped here AND again inside send-sms.
//   5. QUIET HOURS    — 8AM–9PM in the LEAD's state timezone. Outside the window
//      the lead stays eligible and is picked up on the next in-window run =
//      "queue overnight → fire at 8AM local."
//   6. LICENSED STATE — only the 16 states Jeremy is licensed in.
//   7. RUN CAP        — at most INTRO_RUN_CAP sends per invocation.
//
// Cron calls this every 15 min; the window check lives in code, not the schedule.
// Deploy: supabase functions deploy send-intro
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INTRO_ENABLED, INTRO_RUN_CAP(opt)
//   (Twilio creds stay only in send-sms — this function calls send-sms.)
// ─────────────────────────────────────────────────────────────────────────────
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NAME = "Jeremy Metka";
const CARD = "https://hihello.me/p/6cc69b25-86ec-4c39-a45b-fd48bee85403";

// The 🔥 Card touch — identical copy to the manual button in SmsThread.jsx.
function introBody(first: string): string {
  // ASCII-only — em-dash/curly quotes force UCS-2 encoding and split SMS segments.
  return `Hey ${first}, ${NAME} - got your request about life insurance with living benefits. `
       + `Here is my card so you know who is calling: ${CARD}. `
       + `What is the best time to reach you? Reply STOP to opt out.`;
}

const LICENSED = new Set(["OK","TX","VA","OH","NC","IL","MO","NJ","PA","AZ","NY","WA","AL","FL","GA","CA"]);

const STATE_TZ: Record<string, string> = {
  OK:"America/Chicago", TX:"America/Chicago", IL:"America/Chicago", MO:"America/Chicago", AL:"America/Chicago",
  VA:"America/New_York", OH:"America/New_York", NC:"America/New_York", NJ:"America/New_York",
  PA:"America/New_York", NY:"America/New_York", FL:"America/New_York", GA:"America/New_York",
  AZ:"America/Phoenix", WA:"America/Los_Angeles", CA:"America/Los_Angeles",
};
function inWindow(state: string): boolean {
  const tz = STATE_TZ[(state||"").toUpperCase()] || "America/Chicago";
  const hour = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(new Date()), 10);
  return hour >= 8 && hour < 21; // TCPA window: 8AM–9PM lead-local
}

type CRMNote = { ts: string; type: string; text: string; body?: string };
function makeNote(text: string): CRMNote { return { ts: new Date().toISOString(), type: "note", text }; }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const out = { enabled: false, scanned: 0, eligible: 0, sent: 0, queued: 0, skipped: 0, errors: [] as string[] };
  try {
    // 1. KILL SWITCH — default OFF.
    const ENABLED = (Deno.env.get("INTRO_ENABLED") || "").toLowerCase() === "true";
    out.enabled = ENABLED;
    const CAP = parseInt(Deno.env.get("INTRO_RUN_CAP") || "30", 10);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase    = createClient(supabaseUrl, serviceKey);
    const smsFnUrl    = `${supabaseUrl}/functions/v1/send-sms`;

    // 2. NEW LEADS ONLY — introEligible flag, set exclusively by intake scripts.
    const { data, error } = await supabase
      .from("leads").select("id, data")
      .filter("data->>introEligible", "eq", "true");
    if (error) throw new Error(`[load] ${error.message}`);

    const rows = (data || []).filter(r => (r.data || {}).introSent !== true);
    out.scanned  = (data || []).length;
    out.eligible = rows.length;

    const clearEligible = async (id: string, lead: Record<string, unknown>, reason: string) => {
      const note = makeNote(`[INTRO] Skipped — ${reason}`);
      const upd = { ...lead, introEligible: false, introSkipReason: reason,
                    notes: [note, ...((lead.notes as CRMNote[]) || [])], _ts: Date.now() };
      await supabase.from("leads").update({ data: upd, updated_at: new Date().toISOString(), _ts: Date.now() }).eq("id", id);
    };

    for (const row of rows) {
      if (out.sent >= CAP) break;
      const lead = (row.data || {}) as Record<string, unknown>;

      if (lead.smsOptOut === true) { await clearEligible(row.id, lead, "opted_out"); out.skipped++; continue; }
      const digits = String(lead.phone || "").replace(/\D/g, "");
      if (digits.length < 10)      { await clearEligible(row.id, lead, "no_phone"); out.skipped++; continue; }
      const st = String(lead.state || "").toUpperCase();
      if (!LICENSED.has(st))       { await clearEligible(row.id, lead, "unlicensed_state:" + (st || "?")); out.skipped++; continue; }

      // 5. QUIET HOURS — outside window: leave eligible, retry next in-window run.
      if (!inWindow(st)) { out.queued++; continue; }

      if (!ENABLED) { continue; } // switch off → count eligibility but send nothing

      const first = (lead.firstName as string) || String(lead.name || "").split(" ")[0] || "there";
      const body  = introBody(first);
      try {
        const resp = await fetch(smsFnUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ to: lead.phone, body, leadId: row.id }),
        });
        if (resp.ok) {
          out.sent++;
          const note = makeNote(`[INTRO] 🔥 Card intro auto-sent — To: ${lead.phone}`); note.body = body;
          const upd = { ...lead, introSent: true, introSentAt: new Date().toISOString(), introEligible: false,
                        notes: [note, ...((lead.notes as CRMNote[]) || [])], _ts: Date.now() };
          await supabase.from("leads").update({ data: upd, updated_at: new Date().toISOString(), _ts: Date.now() }).eq("id", row.id);
        } else {
          const t = await resp.text();
          out.errors.push(`Intro[${row.id}]: ${t.slice(0, 140)}`); // leave eligible → retry next run
        }
      } catch (e) {
        out.errors.push(`Intro[${row.id}]: ${(e as Error).message}`);
      }
    }

    return new Response(JSON.stringify(out), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    out.errors.push((err as Error).message);
    return new Response(JSON.stringify(out), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
