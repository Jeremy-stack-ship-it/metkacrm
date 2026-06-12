// ── UNSUBSCRIBE Edge Function (v3.60 — URGENT: link was 404ing since launch) ──
// Public GET endpoint linked from every sequence email footer.
// Sets emailOptOut + seqPaused (the deployed cron already respects seqPaused,
// so unsubscribes take effect IMMEDIATELY) + bumps in-blob _ts so the app sees it.
// verify_jwt MUST be false — families click this from their inbox.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAGE_HTML = (msg: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Metka Solutions</title></head>
<body style="font-family:Arial,sans-serif;background:#f6f4ef;margin:0;padding:40px 16px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #ddd;border-radius:10px;padding:32px;text-align:center;">
<div style="font-size:20px;letter-spacing:4px;font-weight:bold;color:#1e2433;margin-bottom:6px;">METKA</div>
<div style="font-size:11px;letter-spacing:2px;color:#999;margin-bottom:24px;">SOLUTIONS</div>
<div style="font-size:15px;color:#333;line-height:1.6;">${msg}</div>
<div style="font-size:12px;color:#999;margin-top:24px;">Questions? Reply to any of our emails or call us directly.</div>
</div></body></html>`;

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const email = (url.searchParams.get("email") || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return new Response(PAGE_HTML("Something went wrong — no email address was provided."), {
        headers: { "Content-Type": "text/html" }, status: 400 });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find every lead carrying this email (paginated — no indexed email column)
    const PAGE = 1000;
    let from = 0, done = false, updated = 0;
    while (!done) {
      const { data, error } = await sb.from("leads").select("id, data").range(from, from + PAGE - 1);
      if (error || !data) break;
      for (const row of data) {
        const rowEmail = ((row.data?.email as string) || "").trim().toLowerCase();
        if (rowEmail === email) {
          const ts = new Date().toISOString();
          const patch = {
            ...row.data,
            emailOptOut: true,
            seqPaused: true,
            seqExitReason: "unsubscribed",
            notes: [{ ts, type: "note", text: "\u{1F4E7}\u26D4 UNSUBSCRIBED from emails via footer link" }, ...((row.data?.notes as unknown[]) || [])],
            _ts: Date.now(),
          };
          await sb.from("leads").update({ data: patch, updated_at: ts, _ts: Date.now() }).eq("id", row.id);
          updated++;
        }
      }
      done = data.length < PAGE;
      from += PAGE;
    }

    console.log(`[unsubscribe] ${email} \u2192 ${updated} lead(s) opted out`);
    // Always show success — never reveal whether an email exists in the database
    return new Response(PAGE_HTML("You've been unsubscribed. You won't receive any more emails from us."), {
      headers: { "Content-Type": "text/html" } });

  } catch (err) {
    console.error("[unsubscribe] fatal:", err);
    return new Response(PAGE_HTML("Something went wrong on our end. Please reply STOP to any email and we'll handle it manually."), {
      headers: { "Content-Type": "text/html" }, status: 500 });
  }
});
