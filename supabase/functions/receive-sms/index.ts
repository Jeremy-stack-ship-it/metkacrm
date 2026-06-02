// ── RECEIVE-SMS Edge Function ─────────────────────────────────────────────────
// Twilio inbound webhook — fires every time someone texts your Twilio number.
// Matches the sender's phone to a CRM lead, writes the inbound message to
// lead.notes as { type: 'sms_inbound', ... }, returns empty TwiML <Response/>.
//
// Setup (one-time):
//   Twilio Console → Phone Numbers → Your number → Messaging
//   "When a message comes in" → Webhook → POST
//   URL: https://brskbcdaefmkcgctlhlb.supabase.co/functions/v1/receive-sms
//
// Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional secret: TWILIO_AUTH_TOKEN — if set, validates Twilio signature.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── TWILIO SIGNATURE VALIDATION ───────────────────────────────────────────────
// Twilio signs each webhook with HMAC-SHA1.
// Header: X-Twilio-Signature
// Input: full URL + sorted POST params concatenated as key+value pairs.
async function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): Promise<boolean> {
  try {
    const sorted = Object.keys(params).sort();
    const toSign = url + sorted.map(k => k + params[k]).join("");
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(authToken),
      { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(toSign));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return expected === signature;
  } catch { return true; } // fail open if crypto error — don't block messages
}

serve(async (req) => {
  // Twilio sends application/x-www-form-urlencoded
  if (req.method !== "POST") {
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" }
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authToken   = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

    const rawBody = await req.text();
    const params: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(rawBody)) params[k] = v;

    const fromRaw    = params["From"]      || "";
    const body       = params["Body"]      || "";
    const messageSid = params["MessageSid"] || "";
    const numMedia   = parseInt(params["NumMedia"] || "0", 10);

    // Optional signature validation
    if (authToken) {
      const sig = req.headers.get("X-Twilio-Signature") || "";
      const url = `${supabaseUrl}/functions/v1/receive-sms`;
      const valid = await validateTwilioSignature(authToken, sig, url, params);
      if (!valid) {
        console.warn("[receive-sms] Invalid Twilio signature");
        return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
      }
    }

    if (!fromRaw) {
      console.warn("[receive-sms] No From number in payload");
      return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
    }

    // Normalize to 10 digits for matching
    const from10 = fromRaw.replace(/\D/g, "").slice(-10);

    // Handle STOP / opt-out
    const bodyTrimmed = body.trim().toUpperCase();
    const isOptOut  = ["STOP","STOPALL","UNSUBSCRIBE","CANCEL","END","QUIT"].includes(bodyTrimmed);
    const isOptIn   = ["START","UNSTOP","YES"].includes(bodyTrimmed);

    const supabase = createClient(supabaseUrl, serviceKey);

    // ── FIND LEAD BY PHONE ────────────────────────────────────────────────────
    // Load all leads and match by normalized 10-digit phone.
    // (No indexed phone column — JSON search via PostgREST filter)
    let matchedId:   string | null = null;
    let matchedData: Record<string, unknown> = {};

    const PAGE = 1000;
    let from = 0, done = false;
    while (!done) {
      const { data, error } = await supabase
        .from("leads").select("id, data")
        .range(from, from + PAGE - 1);
      if (error || !data) break;
      const match = data.find(row => {
        const phone = ((row.data?.phone as string) || "").replace(/\D/g, "").slice(-10);
        return phone === from10;
      });
      if (match) { matchedId = match.id; matchedData = match.data || {}; break; }
      done = data.length < PAGE;
      from += PAGE;
    }

    if (!matchedId) {
      console.warn(`[receive-sms] No lead found for ${fromRaw}`);
      return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
    }

    const ts = new Date().toISOString();
    const existingNotes = (matchedData.notes as unknown[]) || [];

    // Build the inbound note
    let noteText = body;
    if (numMedia > 0) noteText += ` [+${numMedia} media attachment${numMedia > 1 ? "s" : ""}]`;

    const inboundNote = {
      ts,
      type:       "sms_inbound",
      text:       noteText,
      from:       fromRaw,
      messageSid,
    };

    // Build lead patch
    const patch: Record<string, unknown> = {
      ...matchedData,
      notes: [inboundNote, ...existingNotes],
    };

    // Handle opt-out / opt-in
    if (isOptOut)  { patch.smsOptOut = true;  patch.smsOptIn = false; }
    if (isOptIn)   { patch.smsOptOut = false; patch.smsOptIn = true;  }

    await supabase
      .from("leads")
      .update({ data: patch, updated_at: ts })
      .eq("id", matchedId);

    console.log(`[receive-sms] Logged inbound from ${fromRaw} → lead ${matchedId}${isOptOut ? " [OPT-OUT]" : isOptIn ? " [OPT-IN]" : ""}`);

    // Always return valid TwiML — Twilio requires it
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" }
    });

  } catch (err) {
    console.error("[receive-sms] fatal:", err);
    // Still return valid TwiML so Twilio doesn't retry
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" }
    });
  }
});
