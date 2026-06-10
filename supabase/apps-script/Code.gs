/**
 * METKA SOLUTIONS — Sequence Email Web App
 * Google Apps Script — Merged v2 (Grok improvements + full coverage)
 *
 * DEPLOY INSTRUCTIONS (do this once):
 * 1. Go to script.google.com
 * 2. Create new project → name it "Metka Sequence Mailer"
 * 3. Paste this entire file into Code.gs
 * 4. Update CALENDLY, UNSUBSCRIBE_URL, and BUSINESS_ADDRESS below
 * 5. Click Deploy → New deployment → Web App
 * 6. Execute as: Me | Who has access: Anyone
 * 7. Click Deploy → copy the Web App URL
 * 8. Paste URL into CRM Settings → Sequence Engine → Apps Script URL
 *    AND into Supabase secret: APPS_SCRIPT_EMAIL_URL
 *
 * To update: edit here → Deploy → Manage deployments → New version
 *
 * SCRUBBER SETUP (one-time):
 * 1. Add Script Properties (Project Settings → Script Properties):
 *    SUPABASE_URL  → https://brskbcdaefmkcgctlhlb.supabase.co
 *    SUPABASE_KEY  → your service_role key (NOT anon key)
 * 2. Run installTriggers() once from the editor to activate auto-scrubbing
 * 3. Gmail labels "Metka/Sequence", "Metka/Replied", "Metka/Bounced"
 *    are created automatically on first send
 */

// ── CONFIG ───────────────────────────────────────────────────────────────────
var AGENT_NAME       = "Jeremy Metka";
var AGENT_TITLE      = "Senior Household Protection Advisor | Metka Solutions";
var AGENT_NPN        = "NPN #21425108";
var AGENT_PHONE      = "(580) 775-7564";
var CALENDLY         = "https://calendly.com/metkasolutions/20min";
var UNSUBSCRIBE_URL  = "https://YOUR-PROJECT.supabase.co/functions/v1/unsubscribe?email="; // ← UPDATE (or remove until endpoint is built)
var BUSINESS_ADDRESS = "Metka Solutions, Durant, OK 74701";      // ← UPDATE if needed

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

  var cat  = leadType.toLowerCase().indexOf("mortgage") >= 0 ? "mp" : "li";
  var tmpl = getTemplate(track, step, cat);

  if (!tmpl) {
    return { success: true, skipped: true, reason: "No email template for track:" + track + " step:" + step };
  }

  var subject = tmpl.subject(firstName);
  var body    = tmpl.body(firstName, agentPhone, calendly);
  var html    = wrapHtml(body, firstName, email);

  GmailApp.sendEmail(email, subject, body, {
    name:     AGENT_NAME,
    htmlBody: html,
  });

  // Tag the sent thread so the reply scrubber knows to watch it
  labelSequenceThread(email);

  return { success: true, to: email, subject: subject, track: track, step: step };
}

// ── HTML WRAPPER with HiHello Signature ─────────────────────────────────────
function wrapHtml(plainBody, firstName, email) {
  var lines = plainBody.split("\n").map(function(l) {
    return "<p style='margin:0 0 12px 0;'>" + l.replace(/&/g,"&amp;").replace(/</g,"&lt;") + "</p>";
  }).join("");

  var unsubscribeLink = UNSUBSCRIBE_URL + encodeURIComponent(email);

  return [
    "<div style='font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a;font-size:15px;line-height:1.7;'>",

    "<div style='background:#1a2a44;padding:16px 24px;border-radius:6px 6px 0 0;'>",
    "<span style='color:#fff;font-size:13px;font-weight:bold;letter-spacing:0.5px;'>METKA SOLUTIONS</span>",
    "</div>",

    "<div style='padding:28px 32px;background:#fff;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 6px 6px;'>",
    lines,

    // HiHello Digital Business Card
    "<div style='margin-top:32px;'>",
    "<a href='https://hihello.com/p/6cc69b25-86ec-4c39-a45b-fd48bee85403' target='_blank' style='display:inline-block;'>",
    "<img src='https://cdn.hihello.me/cards/6cc69b25-86ec-4c39-a45b-fd48bee85403/signature_imagelogo.png?generated=1779479464429' ",
    "alt='Jeremy Metka - Metka Solutions' width='360' style='display:block;max-width:100%;height:auto;' />",
    "</a>",
    "</div>",

    // Footer
    "<div style='margin-top:32px;padding-top:20px;border-top:1px solid #e8e8e8;font-size:13px;color:#666;'>",
    "Metka Solutions &bull; " + BUSINESS_ADDRESS + "<br>" +
    "Licensed in OK, TX, VA, OH, NC, IL, MO, NJ, PA, AZ, NY, WA, AL, FL, GA, CA | NPN #21425108<br>",
    "<a href='" + unsubscribeLink + "' style='color:#666;text-decoration:underline;'>Unsubscribe</a>",
    "</div>",

    "</div></div>"
  ].join("");
}

// ── TEMPLATES ────────────────────────────────────────────────────────────────
// Email steps only. Steps with SMS/dial-only channels return null → silently skipped.
// new track email steps:      0, 2, 4, 6
// re-engage track email steps: 0, 2
// ghost track email steps:     0
// nurture track email steps:   0–5

function getTemplate(track, step, cat) {
  var templates = {

    // ── TRACK: NEW ──────────────────────────────────────────────────────────
    "new:0": {
      mp: {
        subject: function(n){ return "Your Mortgage Protection Review — " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "My name is Jeremy Metka — I'm a Senior Household Protection Advisor, and I received your request for a Mortgage Protection review.",
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
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "Your Life Insurance Review — " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "My name is Jeremy Metka — Senior Household Protection Advisor, and I received your life insurance inquiry.",
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
        ].join("\n"); },
      },
    },

    "new:2": {
      mp: {
        subject: function(n){ return n + ", still trying to connect"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "Tried reaching you by phone — wanted to follow up here as well on your Mortgage Protection request.",
          "",
          "Quick thing worth knowing: the plans I work with can pay you cash if you get a serious diagnosis — cancer, heart attack, stroke — while your mortgage is still active. Not just a death benefit. Living Benefits.",
          "",
          "Worth 15 minutes. Here's my calendar: " + c,
          "",
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return n + ", still trying to connect"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "Following up on your life insurance inquiry. Tried to reach you by phone — wanted to make sure this didn't slip through.",
          "",
          "Today's life insurance can pay cash for critical illness while you're still alive. That's worth knowing before you decide anything.",
          "",
          "15 minutes: " + c,
          "",
        ].join("\n"); },
      },
    },

    "new:4": {
      mp: {
        subject: function(n){ return "Most families don't know this about Mortgage Protection, " + n; },
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
        ].join("\n"); },
      },
    },

    "new:6": {
      mp: {
        subject: function(n){ return "Last attempt before I close your file, " + n; },
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
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "Last attempt before I close your file, " + n; },
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
        ].join("\n"); },
      },
    },

    // ── TRACK: RE-ENGAGE ────────────────────────────────────────────────────
    // Step 1 and 3 are SMS + dial_reminder only — no email template needed.
    "re-engage:0": {
      mp: {
        subject: function(n){ return "Still here for your Mortgage Protection review, " + n; },
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
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "Still here for your life insurance review, " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "We haven't been able to connect yet on your life insurance inquiry, and I don't want it to fall through the cracks.",
          "",
          "Quick thing worth knowing: the life insurance plans I work with include Living Benefits. That means the policy pays you cash if you're diagnosed with a critical illness or suffer a disability — not just when you die.",
          "",
          "Worth 15 minutes. Here's my calendar: " + c,
          "",
        ].join("\n"); },
      },
    },

    "re-engage:2": {
      mp: {
        subject: function(n){ return "Wrapping up your household file, " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "I'm in the process of closing out household files in your area. I wanted to reach out one more time before I archive yours.",
          "",
          "If Mortgage Protection is still on your radar, I'm here. 15 minutes: " + c,
          "",
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "Closing your life insurance file, " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "Making one final attempt before I close your file. If life insurance is still something you want to address, I'd love to help.",
          "",
          c,
          "",
        ].join("\n"); },
      },
    },

    // ── TRACK: GHOST ────────────────────────────────────────────────────────
    // Step 1 is SMS only — no email needed.
    "ghost:0": {
      mp: {
        subject: function(n){ return "Final outreach — Mortgage Protection, " + n; },
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
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "Final outreach — Life Insurance, " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "Several attempts to reach you about your life insurance inquiry haven't connected. This is my last outreach before I close your file.",
          "",
          "If it's still something you want to address, I'm here: " + c,
          "",
        ].join("\n"); },
      },
    },

    // ── TRACK: NURTURE ──────────────────────────────────────────────────────
    // Email-only slow drip. Auto-enrolled after any track exhausts.
    // Day offsets are from original assignDate. Step 6 = archive at 2yr mark.
    "nurture:0": {
      mp: {
        subject: function(n){ return n + " — still here if the timing is right"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "A couple of months ago I reached out about your Mortgage Protection review and we didn't connect. No pressure — life gets busy.",
          "",
          "One thing most families don't know: today's plans include Living Benefits that pay cash for cancer, stroke, or heart attack — while you're still alive.",
          "",
          "If you'd like a quick no-obligation review: " + c,
          "",
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return n + " — still here if the timing is right"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "A couple of months ago I reached out about your life insurance inquiry. Just checking in — no pressure.",
          "",
          "Today's plans include Living Benefits — cash paid while you're still alive for cancer, stroke, or heart attack. Worth knowing.",
          "",
          "15 minutes if you're ready: " + c,
          "",
        ].join("\n"); },
      },
    },

    "nurture:1": {
      mp: {
        subject: function(n){ return "The Living Benefit most families never hear about"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "Most people think Mortgage Protection only pays the bank when they die. The plans I work with also pay YOU cash if you're diagnosed with cancer, heart attack, or stroke while your mortgage is active.",
          "",
          "That's a Living Benefit — and most agents never explain it.",
          "",
          "Worth 15 minutes: " + c,
          "",
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "The Living Benefit most families never hear about"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "Most people think life insurance only pays when you die. The plans I work with pay cash for critical illness while you're alive.",
          "",
          "That's what I call a Living Benefit. It changes the whole conversation.",
          "",
          "15 minutes: " + c,
          "",
        ].join("\n"); },
      },
    },

    "nurture:2": {
      mp: {
        subject: function(n){ return "6 months in — keeping your file open, " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "It's been about six months since your Mortgage Protection request. Circumstances change — new job, refinance, growing family.",
          "",
          "If now is a better time, I have availability this week: " + c,
          "",
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "6 months in — keeping your file open, " + n; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "Six months since your life insurance inquiry. A lot can shift in that time.",
          "",
          "If now is the right window, I'm here: " + c,
          "",
        ].join("\n"); },
      },
    },

    "nurture:3": {
      mp: {
        subject: function(n){ return "Health windows don't stay open forever"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "The #1 thing I hear from families: 'I kept putting it off.' Health changes and rates go up. If you're in a good health window right now, this is worth 15 minutes.",
          "",
          c,
          "",
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "Health windows don't stay open forever"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "Life insurance gets harder — not easier — to qualify for as time passes. If you're healthy right now, this is worth 15 minutes: " + c,
          "",
        ].join("\n"); },
      },
    },

    "nurture:4": {
      mp: {
        subject: function(n){ return "One year later — your file is still open"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "It's been about a year since your Mortgage Protection inquiry. I still have your file open.",
          "",
          "If your situation has changed — or you want to lock in coverage before health windows close — I'm here: " + c,
          "",
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "One year later — your file is still open"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "One year since your life insurance inquiry. Still keeping your file open.",
          "",
          "If you're ready to revisit: " + c,
          "",
        ].join("\n"); },
      },
    },

    "nurture:5": {
      mp: {
        subject: function(n){ return "Final check-in before I close your file"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "This is my last outreach before I close your Mortgage Protection file. It's been nearly two years and I respect your time.",
          "",
          "If you ever want to revisit, you can always reach me directly at " + ph + ".",
          "",
          "Wishing you and your family well.",
          "",
        ].join("\n"); },
      },
      li: {
        subject: function(n){ return "Final check-in before I close your file"; },
        body: function(n,ph,c){ return [
          "Hi " + n + ",",
          "",
          "Last outreach before I close your life insurance file after nearly two years. No hard feelings at all.",
          "",
          "Reach me anytime at " + ph + " if things change.",
          "",
        ].join("\n"); },
      },
    },

  }; // end templates

  var key  = track + ":" + step;
  var tmpl = templates[key];
  if (!tmpl) return null;
  return tmpl[cat] || tmpl.li || null;
}

// ── LABEL HELPERS ─────────────────────────────────────────────────────────────

function getOrCreateLabel(name) {
  var label = GmailApp.getUserLabelByName(name);
  if (!label) label = GmailApp.createLabel(name);
  return label;
}

// Apply "Metka/Sequence" label to a thread after sending.
// Call this inside sendSequenceEmail after GmailApp.sendEmail.
function labelSequenceThread(toEmail) {
  var threads = GmailApp.search('to:' + toEmail + ' in:sent', 0, 5);
  if (!threads.length) return;
  getOrCreateLabel("Metka/Sequence").addToThread(threads[0]);
}

// ── REPLY SCRUBBER ────────────────────────────────────────────────────────────
/**
 * Scans all threads labeled "Metka/Sequence" for inbound replies.
 * When a reply is found from the lead (not from Jeremy):
 *   - Pauses the lead's sequence in Supabase (seqPaused = true, exitReason = "replied")
 *   - Moves thread label from Metka/Sequence → Metka/Replied
 * Run on a time trigger every 2–4 hours.
 */
function scanForReplies() {
  var seqLabel     = getOrCreateLabel("Metka/Sequence");
  var repliedLabel = getOrCreateLabel("Metka/Replied");
  var myEmail      = Session.getActiveUser().getEmail().toLowerCase();

  var threads = seqLabel.getThreads(0, 100);

  threads.forEach(function(thread) {
    var messages = thread.getMessages();
    // Look for any message NOT sent by Jeremy (i.e., a real reply)
    var hasReply = messages.some(function(msg) {
      return msg.getFrom().toLowerCase().indexOf(myEmail) === -1;
    });

    if (hasReply) {
      // Extract lead email from the first outbound message
      var firstMsg = messages[0];
      var leadEmail = extractEmail(firstMsg.getTo());

      if (leadEmail) {
        pauseLeadInSupabase(leadEmail, "replied");
        Logger.log("Reply detected — paused sequence for: " + leadEmail);
      }

      // Relabel thread
      seqLabel.removeFromThread(thread);
      repliedLabel.addToThread(thread);
    }
  });
}

// ── BOUNCE SCRUBBER ───────────────────────────────────────────────────────────
/**
 * Scans inbox for Gmail delivery failure notifications (bounces).
 * When a bounce is found:
 *   - Marks the lead's email as bad in Supabase (badEmail = true, seqPaused = true)
 *   - Labels the bounce thread "Metka/Bounced" and marks it read
 * Run on a time trigger every 2–4 hours.
 */
function scanForBounces() {
  var bouncedLabel = getOrCreateLabel("Metka/Bounced");

  // Gmail delivery failures come from mailer-daemon or postmaster
  var query = 'from:(mailer-daemon@googlemail.com OR postmaster@) subject:(delivery OR undeliverable OR failed) -label:Metka/Bounced newer_than:30d';
  var threads = GmailApp.search(query, 0, 50);

  threads.forEach(function(thread) {
    var body = thread.getMessages()[0].getPlainBody();
    var bounced = parseBounceEmail(body);

    if (bounced) {
      pauseLeadInSupabase(bounced, "bad_email");
      Logger.log("Bounce detected — marked bad email for: " + bounced);
    }

    bouncedLabel.addToThread(thread);
    thread.markRead();
  });
}

// ── SUPABASE PAUSE CALL ───────────────────────────────────────────────────────
/**
 * Updates the lead record in Supabase:
 *   seqPaused = true
 *   exitReason = reason ("replied" | "bad_email")
 * Uses the REST API with service_role key from Script Properties.
 */
function pauseLeadInSupabase(email, reason) {
  var props   = PropertiesService.getScriptProperties();
  var baseUrl = props.getProperty("SUPABASE_URL");
  var apiKey  = props.getProperty("SUPABASE_KEY");

  if (!baseUrl || !apiKey) {
    Logger.log("ERROR: SUPABASE_URL or SUPABASE_KEY not set in Script Properties");
    return;
  }

  var url = baseUrl + "/rest/v1/leads?email=eq." + encodeURIComponent(email);

  var payload = {
    seqPaused:     true,
    seqExitReason: reason,
    updatedAt:     new Date().toISOString()
  };

  var options = {
    method:      "PATCH",
    contentType: "application/json",
    headers: {
      "apikey":        apiKey,
      "Authorization": "Bearer " + apiKey,
      "Prefer":        "return=minimal"
    },
    payload:          JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code     = response.getResponseCode();

  if (code !== 200 && code !== 204) {
    Logger.log("Supabase PATCH failed (" + code + ") for " + email + ": " + response.getContentText());
  }
}

// ── UTILITY ───────────────────────────────────────────────────────────────────

// Extracts the raw email address from a "Name <email>" or plain "email" string.
function extractEmail(str) {
  if (!str) return null;
  var match = str.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  return str.trim().toLowerCase();
}

// Parses a bounce notification body and returns the failed delivery address.
// Handles the two most common Gmail bounce formats.
function parseBounceEmail(body) {
  if (!body) return null;

  // Format 1: "Final-Recipient: rfc822; user@example.com"
  var m1 = body.match(/Final-Recipient[^;]*;\s*([^\s\r\n]+)/i);
  if (m1) return m1[1].replace(/^mailto:/i, "").toLowerCase();

  // Format 2: "The email account ... <user@example.com> ... does not exist"
  var m2 = body.match(/[Tt]he email account[^<]*<([^>]+)>/);
  if (m2) return m2[1].toLowerCase();

  // Format 3: bare email in "failed permanently for user@example.com"
  var m3 = body.match(/failed permanently[^a-z0-9.]*([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})/i);
  if (m3) return m3[1].toLowerCase();

  return null;
}

// ── TRIGGER INSTALLER ─────────────────────────────────────────────────────────
/**
 * Run this ONCE from the Apps Script editor (not via trigger).
 * Sets up two time-driven triggers:
 *   - scanForReplies  → every 2 hours
 *   - scanForBounces  → every 2 hours
 * Safe to re-run — deletes old Metka triggers first to avoid duplicates.
 */
function installTriggers() {
  // Remove any existing Metka scrubber triggers
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === "scanForReplies" || fn === "scanForBounces") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("scanForReplies")
    .timeBased()
    .everyHours(2)
    .create();

  ScriptApp.newTrigger("scanForBounces")
    .timeBased()
    .everyHours(2)
    .create();

  Logger.log("Triggers installed: scanForReplies + scanForBounces (every 2 hours)");
}
