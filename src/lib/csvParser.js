// ── CSV PARSER + IMPORT HELPERS ──────────────────────────────────
// Pure functions — no React, no side effects.
import { STAGES } from '../constants.js';

export function parseBucket(d) {
  if (!d) return "C";
  const yr = new Date(d).getFullYear(), mo = new Date(d).getMonth();
  if (yr >= 2026) return "A";
  if (yr === 2025 && mo >= 9) return "B";
  return "C";
}

export function parseDisp(s) {
  if (!s) return "not_called";
  const l = s.toLowerCase();
  if (l.includes("appointment")) return "interested";
  if (l.includes("no contact") || l.includes("unreachable")) return "no_answer";
  return "not_called";
}

export function parseStage(s) {
  if (!s) return "new";
  if (s.toLowerCase().includes("appointment")) return "audit_set";
  return "new";
}

export function autoDetectMapping(lowerHeaders) {
  const fi = (names) => lowerHeaders.findIndex(h => names.includes(h));
  return {
    fn:          fi(["firstname","first_name","first"]),
    ln:          fi(["lastname","last_name","last"]),
    name:        fi(["name","fullname","full_name","client"]),
    // phone: try cell first, then plain phone, then home/work as last resort
    phone:       fi(["cellphone","mobile","cell"]),
    phone2:      fi(["phone","phone_number"]),
    phone3:      fi(["homephone","home_phone","workphone","work_phone"]),
    state:       fi(["state","st","province"]),
    city:        fi(["city","town"]),
    county:      fi(["county"]),
    zip:         fi(["zip","zipcode","zip_code","postal","postalcode"]),
    loan:        fi(["loanamount","loan_amount","mortgage","amount","loan"]),
    score:       fi(["score","ai_score","aiscore"]),
    tier:        fi(["tier","dial_tier","priority_tier"]),
    bucket:      fi(["bucket"]),
    flags:       fi(["flags","intel_flags"]),
    rationale:   fi(["rationale","score_rationale","reason"]),
    comments:    fi(["comments","notes","note"]),
    email:       fi(["email","email_address"]),
    age:         fi(["age"]),
    leadType:    fi(["lead_type","leadtype","type"]),
    leadLevel:   fi(["lead_level","leadlevel","level"]),
    status:      fi(["status","leadstatus","lead_status"]),
    assignDate:  fi(["assign_date","assigndate","date_assigned"]),
    daysOld:     fi(["days_old","days","age_days"]),
    pdfUrl:      fi(["pdf_url","pdfurl","pdf"]),
    importStage: fi(["stage","lead_stage"]),
    emailOpener: fi(["emailopener","email_opener","email_openers"]),
    // v3.45 — Funnel sync fields (CSV-SYNC-ANALYSIS-2026-06-10)
    leadCode:         fi(["leadcode","lead_code"]),
    leadAssignmentId: fi(["leadassignmentid","lead_assignment_id"]),
    sex:              fi(["sex","gender"]),
    street:           fi(["street","address","street_address"]),
    leadSource:       fi(["leadsource","lead_source","source"]),
    leadSubSource:    fi(["leadsubsource","lead_sub_source","subsource"]),
    exclusivityEnd:   fi(["exclusivityenddate","exclusivity_end_date"]),
    purchaseAmount:   fi(["purchaseamount","purchase_amount","lead_cost","cost"]),
    birthday:         fi(["birthday","dob","date_of_birth","birthdate"]),
  };
}

// v3.45 — EXPORTED full Funnel/Lighthouse status map. Returns disposition + seq
// fields, plus `stage` where the status implies one (sold/issued). Used by both
// parseCSV (import) and funnelSync (status-diff sync).
export function mapFunnelStatus(s) {
  const l = (s || "").toLowerCase();
  if (l.includes("issue paid") || l.includes("issued"))
    return { disposition:"submitted",     stage:"issued",        seqTrack:"closed",    seqStep:0, seqPaused:true,  seqExitReason:"sold" };
  if (l.includes("sold") || l.includes("application taken") || l.includes("application submitted") || (l.includes("submitted") && !l.includes("contact")))
    return { disposition:"submitted",     stage:"app_submitted", seqTrack:"closed",    seqStep:0, seqPaused:true,  seqExitReason:"sold" };
  if (l.includes("credit approved"))
    return { disposition:"interested",    seqTrack:"closed",     seqStep:0, seqPaused:true,  seqExitReason:"booked" };
  if (l.includes("appointment set") || l.includes("appointment"))
    return { disposition:"interested",    seqTrack:"closed",     seqStep:0, seqPaused:true,  seqExitReason:"booked" };
  if (l.includes("not taken"))
    return { disposition:"no_sale",       seqTrack:"re-engage",  seqStep:0, seqPaused:false, seqExitReason:null };
  if (l.includes("no interest") || l.includes("not interested"))
    return { disposition:"not_interested",seqTrack:"closed",     seqStep:0, seqPaused:true,  seqExitReason:"not_interested" };
  if (l.includes("dnc") || l.includes("do not call"))
    return { disposition:"dnc",           seqTrack:"closed",     seqStep:0, seqPaused:true,  seqExitReason:"dnc" };
  if (l.includes("credit denied") || l.includes("declined"))
    return { disposition:"not_interested",seqTrack:"closed",     seqStep:0, seqPaused:true,  seqExitReason:"credit_denied" };
  if (l.includes("no contact") || l.includes("unreachable"))
    return { disposition:"no_answer",     seqTrack:"ghost",      seqStep:0, seqPaused:false, seqExitReason:null };
  if (l.includes("call again"))
    return { disposition:"callback",      seqTrack:"re-engage",  seqStep:0, seqPaused:false, seqExitReason:null };
  if (l.includes("contact attempted"))
    return { disposition:"callback",      seqTrack:"re-engage",  seqStep:0, seqPaused:false, seqExitReason:null };
  if (l.includes("active") || l.includes("contacting"))
    return { disposition:"callback",      seqTrack:"re-engage",  seqStep:1, seqPaused:false, seqExitReason:null };
  // "New Lead" and anything unrecognised → fresh, never touched
  return { disposition:"not_called",      seqTrack:"new",        seqStep:0, seqPaused:false, seqExitReason:null };
}

export function parseCSV(txt, customIdxMap = null) {
  const lines = txt.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
  const idxMap = customIdxMap || autoDetectMapping(headers);

  // Full status map — returns disposition + stage + sequence fields from raw Funnel/Lighthouse LeadStatus
  // v3.45 — exported (Funnel sync reuses it); fixed: Issue Paid, Call Again, Not Taken;
  // sold statuses now carry a stage so paying clients stop importing as stage "new".
  const mapStatus = mapFunnelStatus;

  const mapDisp = s => mapStatus(s).disposition;

  const mapBucket = (bv, tv, dv, assignDateRaw) => {
    if (bv && ["A","B","C"].includes(bv.toUpperCase())) return bv.toUpperCase();
    if (tv) { if (tv.includes("TODAY")) return "A"; if (tv.includes("WEEK")) return "B"; }
    const d = parseInt(dv) || 0;
    if (d > 0) { if (d <= 120) return "A"; if (d <= 365) return "B"; return "C"; }
    if (assignDateRaw) {
      const dt = new Date(assignDateRaw);
      if (!isNaN(dt.getTime())) {
        if (dt >= new Date('2026-01-01')) return "A";
        if (dt >= new Date('2025-10-01')) return "B";
        return "C";
      }
    }
    return "A";
  };

  return lines.slice(1).map((line, i) => {
    const cols = []; let cur = "", inQ = false;
    for (const c of line) {
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
      cur += c;
    }
    cols.push(cur.trim());
    const get = (idx) => idx > -1 ? (cols[idx] || "").replace(/^"|"$/g,"").trim() : "";
    let finalName = get(idxMap.name);
    if (!finalName) finalName = [get(idxMap.fn), get(idxMap.ln)].filter(Boolean).join(" ");
    // fall through cell → phone → home/work until we find a number
    const rawPhone = (get(idxMap.phone) || get(idxMap.phone2 ?? -1) || get(idxMap.phone3 ?? -1)).replace(/\D/g, "");
    if (!rawPhone) return null;
    const aiScore      = parseInt(get(idxMap.score)) || 0;
    const tier         = get(idxMap.tier);
    const daysOld      = get(idxMap.daysOld);
    const assignDateRaw = get(idxMap.assignDate);
    const bucket       = mapBucket(get(idxMap.bucket), tier, daysOld, assignDateRaw);
    const flags        = get(idxMap.flags);
    const rationale    = get(idxMap.rationale);
    const statusRaw    = get(idxMap.status);
    const statusFields = mapStatus(statusRaw);
    const { disposition, seqTrack, seqStep, seqPaused, seqExitReason, stage: statusStage } = statusFields;
    const notes = [];
    const commentsTxt = get(idxMap.comments);
    if (commentsTxt) notes.push({ ts: new Date().toISOString(), type: "note", text: commentsTxt });
    if (rationale || flags) notes.push({ ts: new Date().toISOString(), type: "note", text: "🤖 Lead Qualifier: " + (rationale || flags) });
    const assignDate = assignDateRaw ? new Date(assignDateRaw).toISOString() : new Date().toISOString();
    return {
      id: `csv_${Date.now()}_${i}_${Math.random().toString(36).slice(2,7)}`,
      name: finalName || "Unknown",
      phone: rawPhone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3"),
      state: get(idxMap.state) || "OK",
      city: get(idxMap.city),
      county: get(idxMap.county),
      zip: get(idxMap.zip),
      email: get(idxMap.email),
      age: get(idxMap.age),
      loanAmount: get(idxMap.loan),
      leadType: get(idxMap.leadType) || "Mortgage Protection",
      leadLevel: get(idxMap.leadLevel),
      pdfUrl: get(idxMap.pdfUrl),
      bucket, aiScore, tier, flags,
      stage: (get(idxMap.importStage) && STAGES.find(s => s.id === get(idxMap.importStage))) ? get(idxMap.importStage) : (statusStage || (disposition === "interested" ? "audit_set" : "new")),
      emailOpener: get(idxMap.emailOpener).toUpperCase() === "YES",
      disposition, notes, assignDate,
      seqTrack, seqStep, seqStartDate: assignDate, seqPaused, seqExitReason,
      lastContact: null, nextCallback: null,
      // v3.45 — Funnel sync fields. funnelAssignDate = TRUE lead age from Funnel,
      // stored for the post-Session-3 age re-base. assignDate/phase_start untouched.
      leadCode: get(idxMap.leadCode ?? -1) || null,
      leadAssignmentId: get(idxMap.leadAssignmentId ?? -1) || null,
      sex: get(idxMap.sex ?? -1) || null,
      street: get(idxMap.street ?? -1) || null,
      leadSource: get(idxMap.leadSource ?? -1) || null,
      leadSubSource: get(idxMap.leadSubSource ?? -1) || null,
      exclusivityEndDate: get(idxMap.exclusivityEnd ?? -1) || null,
      purchaseAmount: parseFloat(get(idxMap.purchaseAmount ?? -1)) || null,
      birthday: get(idxMap.birthday ?? -1) || null,
      funnelAssignDate: assignDateRaw || null,
      funnelStatusRaw: statusRaw || null,
      inFunnel: true,
    };
  }).filter(l => l && l.phone);
}
