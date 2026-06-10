// ── TRACK-OPEN Edge Function ───────────────────────────────────────────────────
// Fires when a recipient opens a sequence email.
// Called by the 1x1 tracking pixel embedded in every sequence email.
//
// GET /functions/v1/track-open?leadId=xxx&step=N&track=new
//   → Updates lead: increments emailOpenCount, sets lastEmailOpenedAt, appends note
//   → Returns a 1x1 transparent GIF (so email clients render it silently)
//
// Auto-injected by Supabase:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1x1 transparent GIF — smallest valid response an email client will accept
const GIF_B64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const GIF_BYTES = Uint8Array.from(atob(GIF_B64), c => c.charCodeAt(0));

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Always return the GIF — even on error — so email clients don't show broken images
  const gif = () => new Response(GIF_BYTES, {
    status: 200,
    headers: { ...CORS, "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" },
  });

  try {
    const url      = new URL(req.url);
    const leadId   = url.searchParams.get("leadId");
    const step     = url.searchParams.get("step") ?? "?";
    const track    = url.searchParams.get("track") ?? "?";

    if (!leadId) return gif();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch current lead data
    const { data: row, error: fetchErr } = await sb
      .from("leads")
      .select("id, data")
      .eq("id", leadId)
      .single();

    if (fetchErr || !row) return gif(); // lead not found — return GIF silently

    const lead = (row.data as Record<string, unknown>) || {};
    const now  = new Date().toISOString();

    const openCount = ((lead.emailOpenCount as number) || 0) + 1;
    const newNote   = {
      ts:   now,
      type: "note",
      text: `[SEQ] Email opened — Track: ${track} | Step ${step} | Open #${openCount}`,
    };
    const notes = [newNote, ...((lead.notes as unknown[]) || [])];

    // v3.40 — stamp fresh _ts so realtime subscription and boot-time hydration
    // accept this update (both use _ts to determine "newest wins").
    // Without this, open-count updates from track-open are silently rejected.
    await sb.from("leads").update({
      data: {
        ...lead,
        emailOpenCount:    openCount,
        lastEmailOpenedAt: now,
        notes,
        _ts: Date.now(),
      },
      updated_at: now,
    }).eq("id", leadId);

  } catch (_e) {
    // Never let tracking errors surface — just return the GIF
  }

  return gif();
});
