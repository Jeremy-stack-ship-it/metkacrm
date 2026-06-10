// ── HANDLE-CALENDLY-BOOKING Edge Function ─────────────────────────────────────
// Receives Calendly webhook on every new booking.
// Finds the matching lead by email (then phone fallback) and updates:
//   disposition → appointment_booked
//   stage       → appointment_set
//   nextCallback → event start time
//   notes       → prepends a booking note
//
// Secrets required (Supabase → Edge Functions → Secrets):
//   CALENDLY_WEBHOOK_SECRET  — from Calendly dashboard → Webhooks → Signing key
//
// Auto-injected by Supabase:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Register webhook in Calendly:
//   Dashboard → Integrations → Webhooks → Create Webhook
//   URL: https://brskbcdaefmkcgctlhlb.supabase.co/functions/v1/handle-calendly-booking
//   Events: invitee.created
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── SIGNATURE VERIFICATION ────────────────────────────────────────────────────
// Calendly signs webhooks with HMAC-SHA256.
// Header format: "t=<timestamp>,v1=<hex_signature>"
async function verifyCalendlySignature(
  rawBody: string,
  header: string | null,
  secret: string
): Promise<boolean> {
  if (!header) return false;
  const parts    = header.split(",");
  const tPart    = parts.find(p => p.startsWith("t="));
  const v1Part   = parts.find(p => p.startsWith("v1="));
  if (!tPart || !v1Part) return false;

  const timestamp   = tPart.slice(2);
  const expectedSig = v1Part.slice(3);
  const toSign      = `${timestamp}.${rawBody}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(toSign));
  const sigHex   = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return sigHex === expectedSig;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("CALENDLY_WEBHOOK_SECRET") || "";

    const rawBody = await req.text();

    // Verify signature if secret is configured
    if (webhookSecret) {
      const sigHeader = req.headers.get("Calendly-Webhook-Signature");
      const valid = await verifyCalendlySignature(rawBody, sigHeader, webhookSecret);
      if (!valid) {
        console.warn("[calendly-webhook] Invalid signature — rejected");
        return new Response(
          JSON.stringify({ error: "Invalid webhook signature" }),
          { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }
    }

    const payload = JSON.parse(rawBody);

    // Only process new bookings
    if (payload.event !== "invitee.created") {
      return new Response(
        JSON.stringify({ skipped: true, reason: `event type ${payload.event} not handled` }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const invitee   = payload.payload?.invitee   || {};
    const eventData = payload.payload?.event      || {};
    const qas       = payload.payload?.questions_and_answers || [];

    const inviteeEmail = (invitee.email || "").toLowerCase().trim();
    const inviteeName  = invitee.name  || "";
    const startTime    = eventData.start_time || "";
    const eventName    = payload.payload?.event_type?.name || "Household Protection Audit";

    // Extract phone from custom questions if present
    const phoneAnswer = qas.find((q: { question: string; answer: string }) =>
      q.question?.toLowerCase().includes("phone")
    );
    const inviteePhone = (phoneAnswer?.answer || "").replace(/\D/g, "");

    const supabase = createClient(supabaseUrl, serviceKey);

    // ── FIND LEAD ─────────────────────────────────────────────────────────────
    let matchedId: string | null = null;
    let matchedData: Record<string, unknown> = {};

    // Primary: match by email
    if (inviteeEmail) {
      const { data: emailMatches } = await supabase
        .from("leads")
        .select("id, data")
        .filter("data->>email", "ilike", inviteeEmail)
        .limit(1);
      if (emailMatches && emailMatches.length > 0) {
        matchedId   = emailMatches[0].id;
        matchedData = emailMatches[0].data || {};
      }
    }

    // Fallback: match by phone (last 10 digits)
    if (!matchedId && inviteePhone.length >= 10) {
      const phone10 = inviteePhone.slice(-10);
      const { data: allLeads } = await supabase
        .from("leads")
        .select("id, data")
        .not("data->>phone", "is", null);
      if (allLeads) {
        const phoneMatch = allLeads.find(row => {
          const lp = ((row.data?.phone as string) || "").replace(/\D/g, "").slice(-10);
          return lp === phone10;
        });
        if (phoneMatch) {
          matchedId   = phoneMatch.id;
          matchedData = phoneMatch.data || {};
        }
      }
    }

    if (!matchedId) {
      console.warn(`[calendly-webhook] No lead found for email=${inviteeEmail} phone=${inviteePhone}`);
      return new Response(
        JSON.stringify({
          success: false,
          reason: "No matching lead found",
          email: inviteeEmail,
          phone: inviteePhone
        }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ── UPDATE LEAD ───────────────────────────────────────────────────────────
    const ts   = new Date().toISOString();
    const fmtStart = startTime
      ? new Date(startTime).toLocaleString("en-US", {
          month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit", timeZoneName: "short"
        })
      : "time TBD";

    const bookingNote = {
      ts,
      type: "appointment",
      text: `📅 Calendly booking confirmed — ${eventName} on ${fmtStart} (auto-synced from Calendly)`
    };

    const existingNotes = (matchedData.notes as unknown[]) || [];
    const updatedData = {
      ...matchedData,
      disposition:   "appointment_booked",
      stage:         "appointment_set",
      nextCallback:  startTime || null,
      apptConfirmed: false,
      notes:         [bookingNote, ...existingNotes],
    };

    await supabase
      .from("leads")
      .update({
        data:         updatedData,
        disposition:  "appointment_booked",
        updated_at:   ts,
      })
      .eq("id", matchedId);

    console.log(`[calendly-webhook] Lead ${matchedId} updated → appointment_booked for ${fmtStart}`);

    return new Response(
      JSON.stringify({ success: true, leadId: matchedId, appointmentTime: startTime }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[calendly-webhook] fatal:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
