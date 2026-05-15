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
    phone:       fi(["cellphone","mobile","cell","phone","phone_number"]),
    state:       fi(["state","st","province"]),
    city:        fi(["city","town"]),
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
    pdfUrl:      fi(["pdf_url","pdfurl","pdf","pdfurl"]),
    importStage: fi(["stage","lead_stage"]),
    emailOpener: fi(["emailopener","email_opener","email_openers"]),
  };
}

export function parseCSV(txt, customIdxMap = null) {
  const lines = txt.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
  const idxMap = customIdxMap || autoDetectMapping(headers);

  const mapDisp = s => {
    if (!s) return "not_called";
    const l = s.toLowerCase();
    if (l.includes("appointment")) return "interested";
    if (l.includes("no contact") || l.includes("unreachable")) return "no_answer";
    if (l.includes("no interest")) return "not_interested";
    if (l.includes("dnc") || l.includes("do not call")) return "dnc";
    if (l.includes("active") || l.includes("contacting")) return "callback";
    return "not_called";
  };

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
    const rawPhone = get(idxMap.phone).replace(/\D/g, "");
    if (!rawPhone) return null;
    const aiScore      = parseInt(get(idxMap.score)) || 0;
    const tier         = get(idxMap.tier);
    const daysOld      = get(idxMap.daysOld);
    const assignDateRaw = get(idxMap.assignDate);
    const bucket       = mapBucket(get(idxMap.bucket), tier, daysOld, assignDateRaw);
    const flags        = get(idxMap.flags);
    const rationale    = get(idxMap.rationale);
    const statusRaw    = get(idxMap.status);
    const disposition  = mapDisp(statusRaw);
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
      email: get(idxMap.email),
      age: get(idxMap.age),
      loanAmount: get(idxMap.loan),
      leadType: get(idxMap.leadType) || "Mortgage Protection",
      leadLevel: get(idxMap.leadLevel),
      pdfUrl: get(idxMap.pdfUrl),
      bucket, aiScore, tier, flags,
      stage: (get(idxMap.importStage) && STAGES.find(s => s.id === get(idxMap.importStage))) ? get(idxMap.importStage) : (disposition === "interested" ? "audit_set" : "new"),
      emailOpener: get(idxMap.emailOpener).toUpperCase() === "YES",
      disposition, notes, assignDate,
      lastContact: null, nextCallback: null,
    };
  }).filter(l => l && l.phone);
}
