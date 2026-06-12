// ── SEND-SMS Edge Function ─────────────────────────────────────────────────
// Twilio REST API proxy — keeps credentials server-side, never in the browser.
// Deploy: supabase functions deploy send-sms
// Secrets (set once in Supabase dashboard → Settings → Edge Functions → Secrets):
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM_NUMBER   (E.164 format, e.g. +14052223333)
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { to, body, leadId } = await req.json();

    if (!to || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, body" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // v3.56 — SERVER-SIDE OPT-OUT GUARD (audit V2-3b, defense in depth).
    // Every caller — UI, cron, future code — is checked here, at the wire.
    if (leadId) {
      try {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: row } = await sb.from("leads").select("data").eq("id", leadId).single();
        if (row?.data?.smsOptOut === true) {
          console.warn(`[send-sms] BLOCKED opted-out lead ${leadId}`);
          return new Response(
            JSON.stringify({ error: "Lead has opted out (STOP). Send blocked.", code: "OPTED_OUT" }),
            { status: 403, headers: { ...CORS, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        console.warn("[send-sms] optOut lookup failed (continuing):", (e as Error).message);
      }
    }

    const accountSid  = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken   = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber  = Deno.env.get("TWILIO_FROM_NUMBER");

    if (!accountSid || !authToken || !fromNumber) {
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured in Supabase secrets" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone to E.164
    const digits = to.replace(/\D/g, "");
    const toE164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;

    // Send via Twilio Messages API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    const form = new URLSearchParams();
    form.append("To",   toE164);
    form.append("From", fromNumber);
    form.append("Body", body);

    const resp = await fetch(twilioUrl, {
      method:  "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("Twilio error:", data);
      return new Response(
        JSON.stringify({ error: data.message || "Twilio API error", code: data.code }),
        { status: resp.status, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, messageSid: data.sid, leadId }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("send-sms error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
