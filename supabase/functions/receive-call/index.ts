// ── RECEIVE-CALL Edge Function ────────────────────────────────────────────────
// Twilio inbound VOICE webhook — fires when someone calls your Twilio number.
// Matches the caller's phone to a CRM lead, logs "📞 Inbound call" to that lead's
// history, THEN returns TwiML that forwards the call to your cell. The lead still
// reaches you AND you get a record. Voice twin of receive-sms.
//
// Setup (one-time):
//   1. Deploy:  supabase functions deploy receive-call
//   2. Twilio Console → Phone Numbers → your number → Voice & Fax
//      "A Call Comes In" → Webhook → POST
//      URL: https://brskbcdaefmkcgctlhlb.supabase.co/functions/v1/receive-call
//      (this REPLACES the plain forward you set up)
//   3. Confirm FORWARD_TO below is your cell.
//
// Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional secret: TWILIO_AUTH_TOKEN — if set, validates the Twilio signature.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── YOUR CELL (where inbound lead calls get forwarded) ───────────────────────
const FORWARD_TO = "+15807757564"; // confirm this is your mobile

const xml = (body: string) =>
  new Response(body, { headers: { "Content-Type": "text/xml" } });

// Forward TwiML — passes the caller's real number through as caller ID so your
// cell shows WHO is calling. 20s ring, then the call falls to your normal voicemail.
const forward = (callerId: string) =>
  xml(`<Response><Dial timeout="20" callerId="${callerId}">${FORWARD_TO}</Dial></Response>`);

async function validateTwilioSignature(authToken: string, signature: string, url: string, params: Record<string, string>): Promise<boolean> {
  try {
    const sorted = Object.keys(params).sort();
    const toSign = url + sorted.map(k => k + params[k]).join("");
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(toSign));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return expected === signature;
  } catch { return false; }
}

serve(async (req) => {
  if (req.method !== "POST") return forward("");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authToken   = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

    const rawBody = await req.text();
    const params: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(rawBody)) params[k] = v;

    const fromRaw  = params["From"] || "";
    const callSid  = params["CallSid"] || "";
    const callerId = fromRaw || "";

    // Optional signature check. On failure we still FORWARD the call (never drop a
    // real lead) — we just skip the DB write, since a forged request isn't a real call.
    let trusted = true;
    if (authToken) {
      const sig = req.headers.get("X-Twilio-Signature") || "";
      const url = `${supabaseUrl}/functions/v1/receive-call`;
      trusted = await validateTwilioSignature(authToken, sig, url, params);
      if (!trusted) console.warn("[receive-call] Invalid Twilio signature — forwarding without logging");
    }

    if (!fromRaw || !trusted) return forward(callerId);

    const from10 = fromRaw.replace(/\D/g, "").slice(-10);
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find lead by normalized 10-digit phone (same approach as receive-sms)
    let matchedId: string | null = null;
    let matchedData: Record<string, unknown> = {};
    const PAGE = 1000;
    let from = 0, done = false;
    while (!done) {
      const { data, error } = await supabase.from("leads").select("id, data").range(from, from + PAGE - 1);
      if (error || !data) break;
      const match = data.find(row => ((row.data?.phone as string) || "").replace(/\D/g, "").slice(-10) === from10);
      if (match) { matchedId = match.id; matchedData = match.data || {}; break; }
      done = data.length < PAGE;
      from += PAGE;
    }

    if (matchedId) {
      const ts = new Date().toISOString();
      const existingNotes = (matchedData.notes as unknown[]) || [];
      const inboundCallNote = { ts, type: "call", text: "📞 Inbound call (lead called you)", from: fromRaw, callSid };
      const patch: Record<string, unknown> = {
        ...matchedData,
        notes: [inboundCallNote, ...existingNotes],
        callbackUnread: true,         // flag: a lead reached out
        _ts: Date.now(),             // in-blob _ts so the app merge accepts this write
      };
      await supabase.from("leads").update({ data: patch, updated_at: ts, _ts: Date.now() }).eq("id", matchedId);
      console.log(`[receive-call] Logged inbound call from ${fromRaw} → lead ${matchedId}`);
    } else {
      console.warn(`[receive-call] No lead found for ${fromRaw} — forwarding anyway`);
    }

    return forward(callerId);
  } catch (err) {
    console.error("[receive-call] fatal:", err);
    // Never drop the call — forward even on error
    return forward("");
  }
});
