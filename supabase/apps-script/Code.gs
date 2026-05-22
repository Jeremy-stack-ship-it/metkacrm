/**
 * METKA SOLUTIONS — Sequence Email Web App
 * Google Apps Script — deployed as a Web App (Execute as: Me)
 *
 * Receives POST from Supabase Edge Function process-sequence.
 * Sends sequence emails from Jeremy's Gmail using GmailApp.
 *
 * DEPLOY INSTRUCTIONS (do this once):
 * 1. Go to script.google.com
 * 2. Create new project → name it "Metka Email Sequence"
 * 3. Paste this entire file into Code.gs
 * 4. Click Deploy → New deployment
 * 5. Type: Web App
 * 6. Execute as: Me (Jeremy@metkasolutions.com)
 * 7. Who has access: Anyone
 * 8. Click Deploy → Copy the web app URL
 * 9. Paste that URL into CRM Settings → Sequence Engine → Apps Script URL
 *    AND into Supabase secrets: APPS_SCRIPT_EMAIL_URL
 *
 * To update: make edits here → Deploy → Manage deployments → New version
 */

// ── CONFIG ───────────────────────────────────────────────────────────────────
var AGENT_NAME  = "Jeremy Metka";
var AGENT_TITLE = "Senior Field Underwriter | Metka Solutions";
var AGENT_NPN   = "NPN #21425108";
var AGENT_PHONE = "(405) 555-XXXX"; // UPDATE with your real number
var CALENDLY    = "https://calendly.com/YOUR_LINK"; // UPDATE with your Calendly link

// ── ENTRY POINT ──────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var result  = sendSequenceEmail(payload);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test endpoint — GET request returns status
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", agent: AGENT_NAME }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── MAIN SEND FUNCTION ───────────────────────────────────────────────────────
function sendSequenceEmail(payload) {
  var firstName  = payload.firstName  || "there";
  var email      = payload.email;
  var leadType   = payload.leadType   || "Mortgage Protection";
  var track      = payload.track      || "new";
  var step       = parseInt(payload.step) || 0;
  var calendly   = payload.calendlyUrl || CALENDLY;
  var agentPhone = payload.agentPhone  || AGENT_PHONE;

  if (!email) return { success: false, error: "No email address provided" };

  var cat = leadType.toLowerCase().indexOf("mortgage") >= 0 ? "mp" : "li";
  var tmpl = getTemplate(track, step, cat);

  if (!tmpl) {
    // No template for this step — silently skip (not all steps have emails)
    return { success: true, skipped: true, reason: "No email template for track:" + track + " step:" + step };
  }

  var subject = tmpl.subject(firstName);
  var body    = tmpl.body(firstName, agentPhone, calendly);
  var html    = wrapHtml(body, firstName);

  GmailApp.sendEmail(email, subject, body, {
    name:     AGENT_NAME,
    htmlBody: html,
  });

  return { success: true, to: email, subject: subject, track: track, step: step };
}

// ── HTML WRAPPER ─────────────────────────────────────────────────────────────
function wrapHtml(plainBody, firstName) {
  var lines = plainBody.split("\n").map(function(l) {
    return "<p style='margin:0 0 12px 0;'>" + l.replace(/&/g,"&amp;").replace(/</g,"&lt;") + "</p>";
  }).join("");

  return [
    "<div style='font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a;font-size:15px;line-height:1.7;'>",
    "<div style='background:#1a2a44;padding:16px 24px;border-radius:6px 6px 0 0;'>",
    "<span style='color:#fff;font-size:13px;font-weight:bold;letter-spacing:0.5px;'>METKA SOLUTIONS</span>",
    "</div>",
    "<div style='padding:28px 32px;background:#fff;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 6px 6px;'>",
    lines,
    "</div>",
    "</div>",
  ].join("");
}

// ── TEMPLATES ────────────────────────────────────────────────────────────────
// Returns {subject: fn, body: fn} or null if no template for this track/step.

function getTemplate(track, step, cat) {
  var templates = {

    // ── TRACK: NEW ──────────────────────────────────────────────────────────
    "new:0": {
      mp: {
        subject: function(n){ return "Your Mortgage Protection Review — " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "My name is Jeremy Metka — I'm a Senior Field Underwriter, and I received your request for a Mortgage Protection review.",
          "",
          "I want to make sure a real person follows up with you, so I'm reaching out both by phone and here.",
          "",
          "Here's what most families don't know: today's Mortgage Protection plans don't just pay off the house when someone dies. They include Living Benefits — meaning the plan can pay you cash if you suffer a heart attack, cancer diagnosis, stroke, or disability while your mortgage is still active.",
          "",
          "Money you can use while you're still alive. That changes everything.",
          "",
          "I only need 15 minutes to walk you through what's available in your state and show you real numbers. No pressure, no obligation.",
          "",
          "Grab a time here: " + c,
          "",
          "Or reply to this email and we'll find something that works.",
          "",
          "Looking forward to connecting,",
          "",
          "Jeremy Metka",
          "Senior Field Underwriter | Metka Solutions",
          "NPN #21425108",
          ph,
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "Your Life Insurance Review — " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "My name is Jeremy Metka — Senior Field Underwriter, and I received your life insurance inquiry.",
          "",
          "I want to make sure a real person reaches out, so here I am.",
          "",
          "What I specialize in is helping families get protected in a way that actually makes sense for their budget and their life right now. Today's life insurance isn't just a death benefit — many of the plans I work with include Living Benefits that pay you cash if you're diagnosed with a critical illness, suffer a stroke, or face a disability.",
          "",
          "Money that pays out while you're still alive to use it.",
          "",
          "15 minutes is all I need to show you what's available and what it costs.",
          "",
          "Grab a time here: " + c,
          "",
          "Or just reply and we'll find something that works.",
          "",
          "Jeremy Metka",
          "Senior Field Underwriter | Metka Solutions",
          "NPN #21425108",
          ph,
        ].join("\n"); },
      },
    },

    "new:4": {
      mp: {
        subject: function(n){ return "Something most families don't know — " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "Most families think Mortgage Protection is just a life insurance policy that pays off the house when someone dies.",
          "",
          "That's only half the story.",
          "",
          "The plans I work with also include Living Benefits — which means if you have a heart attack, get diagnosed with cancer, or suffer a stroke while your mortgage is still active, the plan pays you cash to use however you need. Keep the house. Cover medical bills. Replace lost income.",
          "",
          "You don't have to die for it to pay out. That's the part most people have never heard.",
          "",
          "I'd love to show you how it works. Takes 15 minutes: " + c,
          "",
          "Jeremy Metka",
          "Senior Field Underwriter | Metka Solutions",
          ph,
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "Living Benefits — something most families don't know"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "Most people think life insurance only pays out when you die.",
          "",
          "The plans I work with include Living Benefits — meaning if you're diagnosed with a critical illness, suffer a disability, or receive a terminal diagnosis, the policy pays you cash while you're still alive to use it.",
          "",
          "That changes the entire conversation around life insurance.",
          "",
          "I'd love to walk you through what's available in your state. 15 minutes: " + c,
          "",
          "Jeremy Metka",
          "Senior Field Underwriter | Metka Solutions",
          ph,
        ].join("\n"); },
      },
    },

    "new:6": {
      mp: {
        subject: function(n){ return "Closing your household file — " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "I've been reaching out about your Mortgage Protection review and haven't been able to connect.",
          "",
          "I'm wrapping up household files in your region this week. Before I close yours, I wanted to make one more attempt — in case the timing was off.",
          "",
          "If protecting your home and family is still a priority, I'm here. 15 minutes: " + c,
          "",
          "If I don't hear back, I'll go ahead and archive your file. No hard feelings — life gets busy.",
          "",
          "Jeremy Metka",
          "Senior Field Underwriter | Metka Solutions",
          ph,
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "Closing your file — " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "I've made several attempts to connect about your life insurance inquiry and haven't been able to reach you.",
          "",
          "I'm wrapping up regional files this week. Before I close yours, I wanted to make one final attempt — in case the timing wasn't right.",
          "",
          "If life insurance is still on your list, I'm here. 15 minutes: " + c,
          "",
          "If I don't hear back, I'll archive your file. No hard feelings.",
          "",
          "Jeremy Metka",
          "Senior Field Underwriter | Metka Solutions",
          ph,
        ].join("\n"); },
      },
    },

    // ── TRACK: RE-ENGAGE ────────────────────────────────────────────────────
    "re-engage:0": {
      mp: {
        subject: function(n){ return "Still here — your Mortgage Protection review"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "I know we haven't been able to connect yet on your Mortgage Protection review. I'm following up one more time because I don't want your request to fall through the cracks.",
          "",
          "Here's what I want you to know: the Mortgage Protection plans I work with aren't just death benefits. They include Living Benefits that pay out if you suffer a critical illness — heart attack, cancer, stroke — while your mortgage is still active. Cash you can use while you're still alive.",
          "",
          "That's worth 15 minutes of your time.",
          "",
          "Grab a time here: " + c,
          "",
          "Jeremy Metka",
          "Senior Field Underwriter | Metka Solutions",
          ph,
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "Still here — your life insurance review"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "We haven't been able to connect yet on your life insurance inquiry, and I don't want it to fall through the cracks.",
          "",
          "Quick thing worth knowing: the life insurance plans I work with include Living Benefits. That means the policy pays you cash if you're diagnosed with a critical illness or suffer a disability — not just when you die.",
          "",
          "Worth 15 minutes. Here's my calendar: " + c,
          "",
          "Jeremy Metka",
          "Senior Field Underwriter | Metka Solutions",
          ph,
        ].join("\n"); },
      },
    },

    "re-engage:2": {
      mp: {
        subject: function(n){ return "Wrapping up your household file — " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "I'm in the process of closing out household files in your area. I wanted to reach out one more time before I archive yours.",
          "",
          "If Mortgage Protection is still on your radar, I'm here. 15 minutes: " + c,
          "",
          "Jeremy Metka",
          "Senior Field Underwriter | Metka Solutions",
          ph,
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "Closing your life insurance file — " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "Making one final attempt before I close your file. If life insurance is still something you want to address, I'd love to help.",
          "",
          c,
          "",
          "Jeremy Metka",
          "Senior Field Underwriter | Metka Solutions",
          ph,
        ].join("\n"); },
      },
    },

    // ── TRACK: GHOST ────────────────────────────────────────────────────────
    "ghost:0": {
      mp: {
        subject: function(n){ return "Last attempt — your Mortgage Protection file"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "I've made several attempts to reach you by phone and text about your Mortgage Protection review without success.",
          "",
          "This is my final outreach before I archive your household file.",
          "",
          "If protecting your home and family is still something you want to address — even if the timing was just off — I'm here. 15 minutes: " + c,
          "",
          "If I don't hear back, I'll go ahead and close your file. No hard feelings at all.",
          "",
          "Jeremy Metka",
          "Senior Field Underwriter | Metka Solutions",
          "NPN #21425108",
          ph,
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "Last attempt — your life insurance file"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "Several attempts to reach you about your life insurance inquiry haven't connected. This is my last outreach before I close your file.",
          "",
          "If it's still something you want to address, I'm here: " + c,
          "",
          "Jeremy Metka",
          "Senior Field Underwriter | Metka Solutions",
          "NPN #21425108",
          ph,
        ].join("\n"); },
      },
    },

  }; // end templates

  var key = track + ":" + step;
  var tmpl = templates[key];
  if (!tmpl) return null;
  return tmpl[cat] || tmpl.li || null;
}
