// ── METKA CRM — SHARED CONSTANTS & HELPERS ───────────────────────
// Imported by App.jsx and all extracted components.
// Keep this file pure (no React, no state, no side effects).

// ── TIMEZONE MAP ─────────────────────────────────────────────────
export const STATE_TZ = {
  CT:"ET",ME:"ET",MA:"ET",NH:"ET",RI:"ET",VT:"ET",NY:"ET",NJ:"ET",PA:"ET",DE:"ET",MD:"ET",DC:"ET",
  VA:"ET",WV:"ET",NC:"ET",SC:"ET",GA:"ET",FL:"ET",OH:"ET",MI:"ET",IN:"ET",KY:"ET",TN:"ET",
  IL:"CT",MO:"CT",WI:"CT",MN:"CT",IA:"CT",ND:"CT",SD:"CT",NE:"CT",KS:"CT",OK:"CT",TX:"CT",
  AR:"CT",LA:"CT",MS:"CT",AL:"CT",
  MT:"MT",WY:"MT",CO:"MT",NM:"MT",ID:"MT",UT:"MT",AZ:"MT",
  WA:"PT",OR:"PT",CA:"PT",NV:"PT",AK:"AT",HI:"HT"
};

// ── FUNNEL STAGES ─────────────────────────────────────────────────
export const STAGES = [
  {id:"new",             label:"New Lead",         color:"#94A3B8"},
  {id:"contacted",       label:"Contacted",         color:"#3B82F6"},
  {id:"appointment_set", label:"Appt Booked",      color:"#8B5CF6"},
  {id:"follow_up",       label:"Follow-Up",         color:"#F59E0B"},
  {id:"app_submitted",   label:"App Submitted",    color:"#0EA5E9"},
  {id:"underwriting",    label:"Underwriting",     color:"#0284C7"},
  {id:"issued",          label:"Issue Paid",       color:"#059669"},
];

// ── DISPOSITIONS ──────────────────────────────────────────────────
export const DISPS = [
  {id:"not_called",         label:"Not Called",       color:"#94A3B8"},
  {id:"no_answer",          label:"No Answer",         color:"#64748B"},
  {id:"vm_left",            label:"VM Left",           color:"#3B82F6"},
  {id:"callback",           label:"Callback Set",      color:"#0EA5E9"},
  {id:"hung_up",            label:"Hung Up 📴",        color:"#EF4444"},
  {id:"not_interested",     label:"Not Interested",    color:"#94A3B8"},
  {id:"dnc",                label:"DNC 🚫",            color:"#DC2626"},
  {id:"appointment_booked", label:"📅 Appt Booked",   color:"#8B5CF6"},
  {id:"no_show",            label:"No Show",           color:"#F59E0B"},
  {id:"follow_up_needed",   label:"Follow-Up Needed", color:"#6366F1"},
  {id:"withdrawn",          label:"Withdrawn",         color:"#94A3B8"},
  {id:"chargeback",         label:"Chargeback 🔴",    color:"#DC2626"},
];

// ── BUCKET COLORS + LABELS ────────────────────────────────────────
export const BC = {A:"#2563EB", B:"#10B981", C:"#94A3B8"};
export const BL = {A:"🔥 HOT",  B:"🌡 WARM",  C:"❄ COLD"};
export const NC = {call:"#3B82F6", appointment:"#10B981", note:"#64748B"};

// ── UNDERWRITING TRACKER CONSTANTS (v2.2) ────────────────────────
export const UW_STUCK_DAYS    = 7;
export const UW_ACTIVE_STAGES  = ["app_submitted","underwriting"];
export const UW_VISIBLE_STAGES = ["app_submitted","underwriting","issued","delivered"];
export const DEFAULT_REQS = [
  "APS (Attending Physician Statement)",
  "Tele-Med Interview",
  "Paramedical Exam",
  "Voice Signature",
  "EFT / Banking Info",
  "Replacement Form (1035)",
  "HIPAA Authorization",
  "Photo ID Verification",
];

// ── UW CALCULATION HELPERS ────────────────────────────────────────
export const daysInUW = lead => {
  if(!lead || !lead.submittedDate) return null;
  const start = new Date(lead.submittedDate);
  if(isNaN(start.getTime())) return null;
  const diff = Date.now() - start.getTime();
  return Math.floor(diff / (1000*60*60*24));
};
export const isUWStuck = lead => {
  if(!lead || !UW_ACTIVE_STAGES.includes(lead.stage)) return false;
  const d = daysInUW(lead);
  return d !== null && d > UW_STUCK_DAYS;
};
export const reqStats = lead => {
  const list = Array.isArray(lead && lead.pendingReqs) ? lead.pendingReqs : [];
  const done = list.filter(r => r && r.done).length;
  return { list, done, total:list.length, allDone: list.length>0 && done===list.length, hasAny: list.length>0 };
};

// ── FORMAT HELPERS ────────────────────────────────────────────────
export const fmt     = iso => iso ? new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : null;
export const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : null;
export const currency = v  => v && Number(v)>0 ? `$${Number(v).toLocaleString()}` : null;

// ── STYLE HELPERS ─────────────────────────────────────────────────
export const chip = (sel, c) => ({
  padding:"5px 12px", margin:"3px 3px 3px 0",
  background: sel ? c+"22" : "var(--surface-2)",
  color:       sel ? c       : "var(--t2)",
  border:     `1px solid ${sel ? c+"55" : "var(--border)"}`,
  borderRadius:"20px", cursor:"pointer",
  fontWeight:  sel ? "700" : "500", fontSize:"11px",
  transition:"all 0.1s ease", display:"inline-block"
});
export const inp = () => ({
  background:"var(--surface)", border:"1px solid var(--border)",
  borderRadius:"7px", padding:"8px 11px", fontSize:"12px",
  color:"var(--t1)", fontFamily:"'DM Sans',sans-serif"
});

export const FIELD_MAP_DEFS = [
  { key:"phone",       label:"Phone",                required:true  },
  { key:"fn",          label:"First Name",           required:false },
  { key:"ln",          label:"Last Name",            required:false },
  { key:"name",        label:"Full Name",            required:false },
  { key:"email",       label:"Email",                required:false },
  { key:"state",       label:"State",                required:false },
  { key:"city",        label:"City",                 required:false },
  { key:"age",         label:"Age",                  required:false },
  { key:"leadType",    label:"Lead Type",            required:false },
  { key:"loan",        label:"Loan Amount",          required:false },
  { key:"status",      label:"Status / Disposition", required:false },
  { key:"assignDate",  label:"Assign Date",          required:false },
  { key:"comments",    label:"Comments / Notes",     required:false },
  { key:"pdfUrl",      label:"PDF URL",              required:false },
  { key:"bucket",      label:"Bucket (A/B/C)",       required:false },
  { key:"emailOpener", label:"Email Opener",         required:false },
];
