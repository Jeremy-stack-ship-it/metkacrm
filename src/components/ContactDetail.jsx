/**
 * CONTACT DETAIL PAGE VIEW
 * Full contact card: identity, health profile, activity log,
 * disposition, stage stepper, callback, underwriting tracker.
 * v1.0 — May 6, 2026
 */

import React from 'react';
import {
  STAGES, DISPS, BC, BL, NC,
  UW_VISIBLE_STAGES, UW_ACTIVE_STAGES, UW_STUCK_DAYS, DEFAULT_REQS,
  daysInUW, isUWStuck, reqStats,
  fmt, fmtDate, currency,
  chip, inp,
} from '../constants.js';
import {
  getSequenceStatus, getSequenceBadgeColor, getNextTouchDate,
  pauseSequence, resumeSequence, advanceSequence,
} from '../lib/sequenceEngine.js';

// ── STAGE STEPPER (local — only used in ContactDetail) ───────────
const StageStepper = ({ stage, onSelect }) => {
  const currentIdx = STAGES.findIndex(s => s.id === stage);
  return React.createElement("div", {
    style:{ display:"flex", alignItems:"center", overflowX:"auto", paddingBottom:"4px", gap:"0", flexWrap:"nowrap" }
  },
    STAGES.map((s, i) => {
      const isActive   = s.id === stage;
      const isComplete = i < currentIdx;
      return [
        React.createElement("button", {
          key: s.id, onClick: () => onSelect(s.id),
          style:{
            padding:"5px 12px", whiteSpace:"nowrap", flexShrink:0,
            background: isActive ? s.color : isComplete ? s.color+"18" : "transparent",
            color:      isActive ? "#fff"   : isComplete ? s.color      : "var(--t3)",
            border:`1px solid ${isActive ? s.color : isComplete ? s.color+"55" : "var(--border)"}`,
            borderRadius:"var(--radius-pill)", fontSize: "11px", fontWeight: isActive ? "700" : "600",
            cursor:"pointer", transition:"all 0.1s ease", fontFamily:"'Inter',sans-serif"
          }
        }, (isComplete ? "✓ " : "") + s.label),
        i < STAGES.length - 1 && React.createElement("div", {
          key: "c"+i,
          style:{ width:"12px", height:"1px", background: i < currentIdx ? s.color+"55" : "var(--border)", flexShrink:0 }
        })
      ];
    }).flat()
  );
};

// ── UNDERWRITING CARD (local — only used in ContactDetail) ───────
const UnderwritingCard = ({ lead, upd, newReqText, setNewReqText, initUWReqs, toggleUWReq, removeUWReq, addUWReq }) => {
  if (!lead || !UW_VISIBLE_STAGES.includes(lead.stage)) return null;
  const days          = daysInUW(lead);
  const stuck         = isUWStuck(lead);
  const isClockRunning = UW_ACTIVE_STAGES.includes(lead.stage);
  const { list:reqs, done:doneCount, total:totalReqs, allDone, hasAny } = reqStats(lead);
  const stageObj      = STAGES.find(s => s.id === lead.stage) || STAGES[0];

  return React.createElement("div", { style:{ background:"var(--surface)", borderRadius:"12px", border:"1px solid var(--border)", padding:"20px 24px" } },
    // Header row
    React.createElement("div", { style:{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px", gap:"10px", flexWrap:"wrap" } },
      React.createElement("div", { style:{ fontSize: "11px", fontWeight:"800", color:"var(--t3)", letterSpacing:"1.5px" } }, "🛡 UNDERWRITING TRACKER"),
      React.createElement("div", { style:{ display:"flex", gap:"6px", alignItems:"center", flexWrap:"wrap" } },
        React.createElement("span", { style:{ fontSize: "11px", padding:"3px 10px", borderRadius:"var(--radius-pill)", background:stageObj.color+"18", color:stageObj.color, fontWeight:"700" } }, stageObj.label),
        isClockRunning && days !== null && React.createElement("span", {
          className: stuck ? "pulse-red" : "",
          style:{
            padding:"4px 12px", borderRadius:"var(--radius-pill)", fontSize:"11px", fontWeight:"700",
            background: stuck ? "var(--red-dim)" : "var(--blue-dim)",
            color:      stuck ? "var(--red)"     : "var(--blue)",
            border: "1px solid " + (stuck ? "#FCA5A5" : "var(--blue-mid)")
          }
        }, (stuck ? "⚠ " : "⏱ ") + days + " day" + (days===1?"":"s") + (stuck ? " · STUCK" : ""))
      )
    ),

    // Instant Issue flag
    React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px", padding:"8px 12px", background:"var(--surface-2)", borderRadius:"8px", border:"1px solid var(--border)" } },
      React.createElement("input", { type:"checkbox", id:"ii-"+lead.id, checked:!!lead.instantIssue, onChange:e=>upd(lead.id,{instantIssue:e.target.checked}), style:{ width:"15px", height:"15px", cursor:"pointer", accentColor:"var(--green)" } }),
      React.createElement("label", { htmlFor:"ii-"+lead.id, style:{ fontSize:"12px", fontWeight:"700", color:"var(--t2)", cursor:"pointer" } }, "⚡ Instant Issue — no additional underwriting")
    ),

    // Submitted date
    lead.submittedDate && React.createElement("div", { style:{ fontSize:"11px", color:"var(--t3)", marginBottom:"14px", fontWeight:"500" } },
      "Submitted: ",
      React.createElement("span", { style:{ color:"var(--t2)", fontFamily:"'JetBrains Mono',monospace", fontWeight:"600" } }, fmtDate(lead.submittedDate))
    ),

    // Carrier + Policy
    React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"12px" } },
      React.createElement("div", null,
        React.createElement("label", { style:{ fontSize: "11px", fontWeight:"700", color:"var(--t3)", letterSpacing:"0.6px", display:"block", marginBottom:"4px" } }, "CARRIER"),
        React.createElement("input", { key:"carrier-"+lead.id, placeholder:"e.g., Mutual of Omaha", defaultValue:lead.carrier||"", onBlur:e=>{ const v=e.target.value.trim(); if(v!==(lead.carrier||"")) upd(lead.id,{carrier:v}); }, style:{...inp(),width:"100%",fontSize:"13px"} })
      ),
      React.createElement("div", null,
        React.createElement("label", { style:{ fontSize: "11px", fontWeight:"700", color:"var(--t3)", letterSpacing:"0.6px", display:"block", marginBottom:"4px" } }, "POLICY #"),
        React.createElement("input", { key:"policy-"+lead.id, placeholder:"Policy number", defaultValue:lead.policyNumber||"", onBlur:e=>{ const v=e.target.value.trim(); if(v!==(lead.policyNumber||"")) upd(lead.id,{policyNumber:v}); }, style:{...inp(),width:"100%",fontSize:"13px",fontFamily:"'JetBrains Mono',monospace"} })
      )
    ),

    // Premium
    React.createElement("div", { style:{ marginBottom:"12px" } },
      React.createElement("label", { style:{ fontSize: "11px", fontWeight:"700", color:"var(--t3)", letterSpacing:"0.6px", display:"block", marginBottom:"4px" } }, "EXPECTED PREMIUM (MONTHLY)"),
      React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" } },
        React.createElement("span", { style:{ fontSize:"14px", color:"var(--t3)", fontFamily:"'JetBrains Mono',monospace", fontWeight:"600" } }, "$"),
        React.createElement("input", { key:"premium-"+lead.id, placeholder:"0.00", defaultValue:lead.expectedPremium||"", onBlur:e=>{ const v=e.target.value.trim().replace(/[^0-9.]/g,""); if(v!==(lead.expectedPremium||"")) upd(lead.id,{expectedPremium:v}); }, style:{...inp(),width:"160px",fontSize:"13px",fontFamily:"'JetBrains Mono',monospace"} }),
        lead.expectedPremium && React.createElement("span", { style:{ fontSize:"11px", color:"var(--t3)", fontWeight:"500" } },
          "annual ≈ ",
          React.createElement("span", { style:{ color:"var(--t2)", fontFamily:"'JetBrains Mono',monospace", fontWeight:"600" } },
            (() => {
              const apv = Number(lead.expectedPremium) * 12;
              const splitPct = lead.splitDeal ? (Number(lead.splitPct) || 50) : 100;
              return currency(apv * splitPct / 100) || "—";
            })()
          ),
          lead.splitDeal && React.createElement("span", { style:{ color:"var(--amber)", fontWeight:"700", marginLeft:"4px" } },
            " (my " + (lead.splitPct || 50) + "%)"
          )
        )
      )
    ),

    // Split Deal
    React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"16px", padding:"8px 12px", background: lead.splitDeal ? "var(--amber-dim)" : "var(--surface-2)", borderRadius:"8px", border:"1px solid " + (lead.splitDeal ? "var(--amber)" : "var(--border)"), transition:"all 0.2s" } },
      React.createElement("input", { type:"checkbox", id:"split-"+lead.id, checked:!!lead.splitDeal, onChange:e=>upd(lead.id,{splitDeal:e.target.checked, splitPct: lead.splitPct||50}), style:{ width:"15px", height:"15px", cursor:"pointer", accentColor:"var(--amber)" } }),
      React.createElement("label", { htmlFor:"split-"+lead.id, style:{ fontSize:"12px", fontWeight:"700", color: lead.splitDeal ? "var(--amber)" : "var(--t3)", cursor:"pointer", flex:1 } }, "🤝 Split Deal"),
      lead.splitDeal && React.createElement(React.Fragment, null,
        React.createElement("span", { style:{ fontSize:"11px", color:"var(--t3)", fontWeight:"600" } }, "My share:"),
        React.createElement("input", { key:"splitpct-"+lead.id, type:"number", min:"1", max:"99", defaultValue:lead.splitPct||50, onBlur:e=>{ const v=Math.min(99,Math.max(1,parseInt(e.target.value)||50)); upd(lead.id,{splitPct:v}); }, style:{...inp(),width:"64px",fontSize:"13px",fontFamily:"'JetBrains Mono',monospace",textAlign:"center"} }),
        React.createElement("span", { style:{ fontSize:"12px", color:"var(--t3)", fontWeight:"600" } }, "%")
      )
    ),

    // Pending Requirements
    React.createElement("div", { style:{ background:"var(--surface-2)", borderRadius:"10px", padding:"14px 16px", border:"1px solid var(--border)" } },
      React.createElement("div", { style:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px", flexWrap:"wrap", gap:"8px" } },
        React.createElement("div", { style:{ fontSize:"11px", fontWeight:"800", color:"var(--t2)", letterSpacing:"0.8px" } }, "PENDING REQUIREMENTS"),
        hasAny && React.createElement("span", {
          style:{
            fontSize:"11px", fontWeight:"700", padding:"3px 10px", borderRadius:"var(--radius-pill)",
            background: allDone ? "var(--green-dim)" : "var(--amber-dim)",
            color:       allDone ? "var(--green)"     : "var(--amber)",
            border: "1px solid " + (allDone ? "#6EE7B7" : "#FCD34D")
          }
        }, allDone ? "✓ All complete" : (doneCount + " / " + totalReqs + " done"))
      ),
      !hasAny && React.createElement("div", null,
        React.createElement("div", { style:{ fontSize:"12px", color:"var(--t3)", marginBottom:"10px", fontWeight:"500", lineHeight:"1.6" } }, "No requirements tracked yet. Load the standard checklist or add custom items below."),
        React.createElement("button", { onClick:()=>initUWReqs(lead.id), style:{ padding:"8px 16px", background:"var(--navy)", color:"#fff", border:"none", borderRadius:"7px", fontSize:"12px", fontWeight:"700", cursor:"pointer" } }, "+ Load Default Checklist (" + DEFAULT_REQS.length + ")")
      ),
      hasAny && React.createElement("div", null,
        reqs.map(r =>
          React.createElement("div", { key:r.id, style:{ display:"flex", alignItems:"center", gap:"10px", padding:"7px 0", borderBottom:"1px solid var(--border)" } },
            React.createElement("input", { type:"checkbox", checked:!!r.done, onChange:()=>toggleUWReq(lead.id,r.id), style:{ width:"16px", height:"16px", cursor:"pointer", flexShrink:0, accentColor:"var(--green)" } }),
            React.createElement("span", { style:{ flex:1, fontSize:"12px", fontWeight:"500", color:r.done?"var(--t4)":"var(--t1)", textDecoration:r.done?"line-through":"none" } }, r.label),
            r.done && r.completedAt && React.createElement("span", { style:{ fontSize: "11px", color:"var(--green)", fontWeight:"600", fontFamily:"'JetBrains Mono',monospace" } }, fmtDate(r.completedAt)),
            React.createElement("button", { onClick:()=>removeUWReq(lead.id,r.id), title:"Remove", style:{ background:"none", border:"none", color:"var(--t4)", cursor:"pointer", fontSize:"16px", lineHeight:1, padding:"2px 6px" } }, "×")
          )
        )
      ),
      hasAny && React.createElement("div", { style:{ display:"flex", gap:"8px", marginTop:"12px" } },
        React.createElement("input", { placeholder:"Add custom requirement…", value:newReqText, onChange:e=>setNewReqText(e.target.value), onKeyDown:e=>{ if(e.key==="Enter") addUWReq(lead.id,newReqText); }, style:{...inp(),flex:1,fontSize:"12px"} }),
        React.createElement("button", { onClick:()=>addUWReq(lead.id,newReqText), disabled:!newReqText.trim(), style:{ padding:"8px 14px", background:newReqText.trim()?"var(--blue)":"var(--surface-3)", color:newReqText.trim()?"#fff":"var(--t4)", border:"none", borderRadius:"7px", fontSize:"12px", fontWeight:"700", cursor:newReqText.trim()?"pointer":"not-allowed" } }, "Add")
      )
    ),

    // Issued banner
    lead.policyIssueDate && React.createElement("div", {
      style:{ marginTop:"12px", padding:"10px 14px", background:"var(--green-dim)", borderRadius:"8px", border:"1px solid #6EE7B7", fontSize:"12px", color:"var(--green)", fontWeight:"700" }
    }, "✅ Policy issued " + fmtDate(lead.policyIssueDate))
  );
};

// ── CONTACT DETAIL PAGE ───────────────────────────────────────────
export default function ContactDetail({
  open, prevView, setView,
  upd, logDial, dialLead, deleteLead,
  tcpaInfo,
  noteType, setNoteType, noteText, setNoteText, addNote,
  cbDate, setCbDate, cbTime, setCbTime, lockCB,
  handleDisposition,
  openCalendlyPopup, calendlyUrl, setCalendlyTargetId,
  newReqText, setNewReqText,
  initUWReqs, toggleUWReq, removeUWReq, addUWReq,
}) {
  if (!open) return null;

  return React.createElement("div", { style:{ flex:1, display:"flex", flexDirection:"column", background:"var(--surface-2)", overflow:"hidden" } },
    // ── Header bar
    React.createElement("div", { style:{ padding:"14px 24px", background:"var(--surface)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:"12px", flexShrink:0 } },
      React.createElement("button", { onClick:()=>setView(prevView), style:{ padding:"8px 16px", borderRadius:"8px", fontWeight:"700", fontSize:"12px", cursor:"pointer", border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--t2)" } }, "← Back"),
      React.createElement("div", { style:{ fontFamily:"'Syne',sans-serif", fontWeight:"800", fontSize:"15px", color:"var(--navy)", letterSpacing:"1px", flex:1 } }, open.name || "Contact"),
      React.createElement("div", { style:{ display:"flex", gap:"8px", alignItems:"center" } },
        React.createElement("span", { style:{ fontSize:"11px", padding:"4px 12px", borderRadius:"var(--radius-pill)", background:BC[open.bucket]+"18", color:BC[open.bucket], fontWeight:"800" } }, BL[open.bucket]),
        open.stage && React.createElement("span", { style:{ fontSize:"11px", padding:"4px 12px", borderRadius:"var(--radius-pill)", background:"var(--surface-2)", color:"var(--t2)", fontWeight:"700", border:"1px solid var(--border)" } }, (STAGES.find(s=>s.id===open.stage)||STAGES[0]).label),
        React.createElement("button", { onClick:()=>{ dialLead(open); }, style:{ padding:"8px 18px", borderRadius:"8px", fontWeight:"700", fontSize:"12px", cursor:"pointer", border:"none", background:"var(--blue)", color:"#fff" } }, "📞 Dial"),
        React.createElement("button", { onClick:()=>deleteLead(open.id), style:{ padding:"8px 14px", borderRadius:"8px", fontWeight:"700", fontSize:"12px", cursor:"pointer", border:"1px solid #FCA5A5", background:"var(--red-dim)", color:"var(--red)" } }, "🗑 Delete")
      )
    ),

    // ── Scrollable body — two-column layout
    React.createElement("div", { style:{ flex:1, overflowY:"auto", padding:"24px", display:"flex", gap:"24px", alignItems:"flex-start", flexWrap:"wrap" } },

      // ── LEFT: identity + health + activity log
      React.createElement("div", { style:{ flex:"1 1 340px", minWidth:"300px", display:"flex", flexDirection:"column", gap:"16px" } },

        // Identity card
        React.createElement("div", { style:{ background:"var(--surface)", borderRadius:"12px", border:"1px solid var(--border)", padding:"20px 24px" } },
          React.createElement("div", { style:{ fontSize: "11px", fontWeight:"800", color:"var(--t3)", letterSpacing:"1.5px", marginBottom:"12px" } }, "CONTACT INFO"),
          // Phone row
          React.createElement("div", { style:{ display:"flex", flexWrap:"wrap", gap:"10px", marginBottom:"14px", alignItems:"center" } },
            React.createElement("a", { href:"tel:"+open.phone.replace(/\D/g,""), onClick:()=>logDial(open.id), style:{ fontSize:"15px", color:"var(--blue)", fontFamily:"'JetBrains Mono',monospace", fontWeight:"600", padding:"4px 10px", background:"var(--blue-dim)", borderRadius:"6px", border:"1px solid var(--blue-mid)", textDecoration:"none" } }, open.phone),
            tcpaInfo && React.createElement("span", { title:"Local time — TCPA safe hours 8AM-9PM", style:{ fontSize:"11px", fontWeight:"700", padding:"3px 10px", borderRadius:"6px", background:tcpaInfo.safe?"var(--green-dim)":"var(--red-dim)", color:tcpaInfo.safe?"var(--green)":"var(--red)", border:"1px solid "+(tcpaInfo.safe?"#6EE7B7":"#FCA5A5") } }, tcpaInfo.timeStr+" "+tcpaInfo.ltz)
          ),
          // Editable grid
          React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"10px" } },
            [["Name","name","Full name"],["Phone","phone","(405) 555-0000"],["Email","email","email@domain.com"],["Age","age","e.g. 54"],["City","city","City"],["State","state","OK"],["Loan Amount","loanAmount","e.g. 185000"],["Lead Type","leadType","Mortgage Protection"]].map(([label,field,ph]) =>
              React.createElement("div", { key:field },
                React.createElement("label", { style:{ fontSize: "11px", fontWeight:"700", color:"var(--t3)", letterSpacing:"0.6px", display:"block", marginBottom:"4px" } }, label.toUpperCase()),
                React.createElement("input", { key:field+"-id-"+open.id, placeholder:ph, defaultValue:open[field]||"", onBlur:e=>{ const v=e.target.value.trim(); if(v!==(open[field]||"")) upd(open.id,{[field]:v}); }, style:{...inp(),width:"100%",fontSize:"12px",boxSizing:"border-box"} })
              )
            )
          ),
          open.pdfUrl && React.createElement("a", { href:open.pdfUrl, target:"_blank", rel:"noreferrer", style:{ fontSize:"11px", color:"var(--sky)", textDecoration:"none", fontWeight:"700" } }, "📋 Lead Sheet →")
        ),

        // Health profile card
        React.createElement("div", { style:{ background:"var(--surface)", borderRadius:"12px", border:"1px solid var(--border)", padding:"20px 24px" } },
          React.createElement("div", { style:{ fontSize: "11px", fontWeight:"800", color:"var(--t3)", letterSpacing:"1.5px", marginBottom:"12px" } }, "🩺 HEALTH PROFILE"),
          // Tobacco checkbox
          React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"14px", padding:"10px 14px", borderRadius:"8px", background:open.tobacco?"#FEF3C7":"var(--surface-2)", border:"1px solid "+(open.tobacco?"#FCD34D":"var(--border)"), cursor:"pointer" }, onClick:()=>upd(open.id,{tobacco:!open.tobacco}) },
            React.createElement("input", { type:"checkbox", checked:!!open.tobacco, onChange:()=>upd(open.id,{tobacco:!open.tobacco}), style:{ width:"16px", height:"16px", cursor:"pointer", accentColor:"#D97706" } }),
            React.createElement("span", { style:{ fontSize:"13px", fontWeight:"700", color:open.tobacco?"#D97706":"var(--t2)" } }, "🚬 Tobacco User"),
            open.tobacco && React.createElement("span", { style:{ fontSize:"11px", fontWeight:"600", color:"#D97706", marginLeft:"auto" } }, "TABLE RATING LIKELY")
          ),
          React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px", marginBottom:"10px" } },
            [["DOB","dob","e.g. 1965-04-12"],["Height","height","e.g. 5'10\""],["Weight","weight","lbs"]].map(([label,field,ph]) =>
              React.createElement("div", { key:field },
                React.createElement("label", { style:{ fontSize: "11px", fontWeight:"700", color:"var(--t3)", letterSpacing:"0.6px", display:"block", marginBottom:"4px" } }, label.toUpperCase()),
                React.createElement("input", { key:field+"-cp-"+open.id, placeholder:ph, defaultValue:open[field]||"", onBlur:e=>{ const v=e.target.value.trim(); if(v!==(open[field]||"")) upd(open.id,{[field]:v}); }, style:{...inp(),width:"100%",fontSize:"12px",boxSizing:"border-box"} })
              )
            )
          ),
          React.createElement("div", { style:{ marginBottom:"10px" } },
            React.createElement("label", { style:{ fontSize: "11px", fontWeight:"700", color:"var(--t3)", letterSpacing:"0.6px", display:"block", marginBottom:"4px" } }, "MEDICATIONS"),
            React.createElement("textarea", { key:"meds-cp-"+open.id, placeholder:"List current medications...", defaultValue:open.medications||"", onBlur:e=>{ const v=e.target.value.trim(); if(v!==(open.medications||"")) upd(open.id,{medications:v}); }, style:{...inp(),width:"100%",minHeight:"56px",resize:"vertical",fontSize:"12px",lineHeight:"1.5",boxSizing:"border-box"} })
          ),
          React.createElement("div", { style:{ marginBottom:"10px" } },
            React.createElement("label", { style:{ fontSize: "11px", fontWeight:"700", color:"var(--t3)", letterSpacing:"0.6px", display:"block", marginBottom:"4px" } }, "CONDITIONS / HISTORY"),
            React.createElement("textarea", { key:"health-cp-"+open.id, placeholder:"Conditions, diagnoses, history...", defaultValue:open.healthIssues||"", onBlur:e=>{ const v=e.target.value.trim(); if(v!==(open.healthIssues||"")) upd(open.id,{healthIssues:v}); }, style:{...inp(),width:"100%",minHeight:"56px",resize:"vertical",fontSize:"12px",lineHeight:"1.5",boxSizing:"border-box"} })
          ),
          React.createElement("div", null,
            React.createElement("label", { style:{ fontSize: "11px", fontWeight:"700", color:"var(--t3)", letterSpacing:"0.6px", display:"block", marginBottom:"4px" } }, "DRIVE LINK"),
            React.createElement("input", { key:"drive-cp-"+open.id, placeholder:"Paste Google Drive URL...", defaultValue:open.driveLink||"", onBlur:e=>{ const v=e.target.value.trim(); if(v!==(open.driveLink||"")) upd(open.id,{driveLink:v}); }, style:{...inp(),width:"100%",fontSize:"12px",fontFamily:"'JetBrains Mono',monospace",boxSizing:"border-box"} }),
            open.driveLink && React.createElement("a", { href:open.driveLink, target:"_blank", rel:"noreferrer", style:{ fontSize:"11px", color:"var(--blue)", fontWeight:"600", textDecoration:"none", display:"block", marginTop:"6px" } }, "📂 Open Drive File →")
          )
        ),

        // Activity log card
        React.createElement("div", { style:{ background:"var(--surface)", borderRadius:"12px", border:"1px solid var(--border)", padding:"20px 24px" } },
          React.createElement("div", { style:{ fontSize: "11px", fontWeight:"800", color:"var(--t3)", letterSpacing:"1.5px", marginBottom:"14px" } }, "ACTIVITY LOG — "+(open.notes||[]).length+" ENTRIES"),
          React.createElement("div", { style:{ display:"flex", gap:"6px", marginBottom:"12px" } },
            [["call","📞 Call"],["appointment","📅 Appt"],["note","📝 Note"]].map(([t,l]) =>
              React.createElement("button", { key:t, onClick:()=>setNoteType(t), style:{...chip(noteType===t, NC[t]),fontSize:"12px",padding:"6px 16px",margin:0} }, l)
            )
          ),
          React.createElement("div", { style:{ display:"flex", gap:"10px", marginBottom:"16px" } },
            React.createElement("textarea", { value:noteText, onChange:e=>setNoteText(e.target.value), placeholder: noteType==="call"?"Result, what they said, next step...":noteType==="appointment"?"Audit details, products discussed, Five R's...":"General note...", style:{ flex:1, background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"10px", color:"var(--t1)", padding:"12px 14px", fontSize:"13px", fontFamily:"'Inter',sans-serif", resize:"vertical", minHeight:"80px", lineHeight:"1.6" } }),
            React.createElement("button", { onClick:()=>addNote(open.id), style:{ padding:"0 20px", background:"var(--blue)", color:"#fff", border:"none", borderRadius:"10px", fontSize:"24px", cursor:"pointer", alignSelf:"stretch" } }, "→")
          ),
          (open.notes||[]).length === 0 && React.createElement("div", { style:{ fontSize:"13px", color:"var(--t4)", padding:"24px", textAlign:"center", background:"var(--surface-2)", borderRadius:"10px", fontWeight:"500" } }, "No activity yet"),
          (open.notes||[]).map((n, i) =>
            React.createElement("div", { key:i, style:{ marginBottom:"16px", display:"flex", gap:"14px", alignItems:"flex-start" } },
              React.createElement("div", { style:{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:"4px", flexShrink:0 } },
                React.createElement("div", { style:{ width:"10px", height:"10px", borderRadius:"50%", background:NC[n.type]||"var(--t4)", flexShrink:0 } }),
                i < (open.notes||[]).length-1 && React.createElement("div", { style:{ width:"2px", flex:1, minHeight:"30px", background:"var(--border)", marginTop:"6px", borderRadius:"2px" } })
              ),
              React.createElement("div", { style:{ flex:1, paddingBottom:"8px" } },
                React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"6px" } },
                  React.createElement("span", { style:{ fontSize: "11px", fontWeight:"800", color:NC[n.type]||"var(--t3)", textTransform:"uppercase", letterSpacing:"0.8px" } }, n.type||"note"),
                  React.createElement("span", { style:{ fontSize:"11px", color:"var(--t4)", fontWeight:"500" } }, n.ts?new Date(n.ts).toLocaleString():""),
                  React.createElement("button", { onClick:()=>{ const next=(open.notes||[]).filter((_,ni)=>ni!==i); upd(open.id,{notes:next}); }, title:"Remove", style:{ marginLeft:"auto", background:"none", border:"none", color:"var(--t4)", cursor:"pointer", fontSize:"14px", padding:"0 2px", lineHeight:1 } }, "−")
                ),
                React.createElement("div", { style:{ fontSize:"13px", color:"var(--t2)", lineHeight:"1.6", background:"var(--surface-2)", padding:"12px 16px", borderRadius:"10px" } }, ""+n.text)
              )
            )
          )
        )
      ),

      // ── RIGHT: disposition + stage + callback + UW
      React.createElement("div", { style:{ flex:"1 1 320px", minWidth:"280px", display:"flex", flexDirection:"column", gap:"16px" } },

        // Disposition card
        React.createElement("div", { style:{ background:"var(--surface)", borderRadius:"12px", border:"1px solid var(--border)", padding:"20px 24px" } },
          React.createElement("div", { style:{ fontSize: "11px", fontWeight:"800", color:"var(--t3)", letterSpacing:"1.5px", marginBottom:"12px" } }, "CALL DISPOSITION"),
          React.createElement("button", {
            onClick:()=>{ openCalendlyPopup(open, calendlyUrl, setCalendlyTargetId); },
            style:{ display:"block", width:"100%", padding:"12px 16px", marginBottom:"10px", background:open.disposition==="appointment_booked"?"#8B5CF6":"var(--surface)", color:open.disposition==="appointment_booked"?"#fff":"#8B5CF6", border:"1.5px solid "+(open.disposition==="appointment_booked"?"#8B5CF6":"#C4B5FD"), borderRadius:"10px", fontSize:"14px", fontWeight:"800", cursor:"pointer", textAlign:"center", transition:"all 0.1s ease" }
          }, open.disposition==="appointment_booked" ? "📅 BOOKED · "+fmt(open.nextCallback) : "📅 BOOK APPOINTMENT → CALENDLY"),
          React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px", marginBottom:"8px" } },
            DISPS.filter(d=>["no_answer","vm_left","callback","not_interested","dnc"].includes(d.id)).map(d =>
              React.createElement("button", { key:d.id, onClick:()=>handleDisposition(d.id), style:{ padding:"10px 8px", background:open.disposition===d.id?d.color+"22":"var(--surface-2)", color:open.disposition===d.id?d.color:"var(--t2)", border:"1px solid "+(open.disposition===d.id?d.color+"66":"var(--border)"), borderRadius:"8px", fontSize:"12px", fontWeight:open.disposition===d.id?"700":"600", cursor:"pointer", transition:"all 0.1s ease", textAlign:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" } }, d.label)
            )
          ),
          ["appointment_set","follow_up","app_submitted","underwriting","issued"].includes(open.stage) && React.createElement("div", { style:{ marginTop:"8px" } },
            React.createElement("div", { style:{ fontSize: "11px", fontWeight:"800", color:"var(--t3)", letterSpacing:"1px", marginBottom:"6px" } }, "POST-APPOINTMENT"),
            React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px" } },
              DISPS.filter(d=>["no_show","follow_up_needed","withdrawn"].includes(d.id)).map(d =>
                React.createElement("button", { key:d.id, onClick:()=>handleDisposition(d.id), style:{ padding:"10px 8px", background:open.disposition===d.id?d.color+"22":"var(--surface-2)", color:open.disposition===d.id?d.color:"var(--t2)", border:"1px solid "+(open.disposition===d.id?d.color+"66":"var(--border)"), borderRadius:"8px", fontSize:"12px", fontWeight:"600", cursor:"pointer", textAlign:"center" } }, d.label)
              )
            )
          )
        ),

        // Stage stepper card
        React.createElement("div", { style:{ background:"var(--surface)", borderRadius:"12px", border:"1px solid var(--border)", padding:"20px 24px" } },
          React.createElement("div", { style:{ fontSize: "11px", fontWeight:"800", color:"var(--t3)", letterSpacing:"1.5px", marginBottom:"14px" } }, "FUNNEL STAGE"),
          React.createElement(StageStepper, { stage:open.stage, onSelect:s=>upd(open.id,{stage:s}) }),
          ["app_submitted","underwriting"].includes(open.stage) && React.createElement("div", { style:{ marginTop:"12px" } },
            React.createElement("button", { onClick:()=>{ if(window.confirm("Remove from pipeline?")) upd(open.id,{stage:"contacted",disposition:"withdrawn"}); }, style:{ padding:"8px 16px", background:"var(--red-dim)", color:"var(--red)", border:"1px solid #FCA5A5", borderRadius:"8px", fontSize:"11px", fontWeight:"700", cursor:"pointer" } }, "⚠ Remove from Pipeline")
          )
        ),

        // Callback card
        React.createElement("div", { style:{ background:"var(--surface)", borderRadius:"12px", border:"1px solid var(--border)", padding:"20px 24px" } },
          React.createElement("div", { style:{ fontSize: "11px", fontWeight:"800", color:"var(--t3)", letterSpacing:"1.5px", marginBottom:"12px" } }, "SET CALLBACK"),
          open.nextCallback && React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px", padding:"10px 16px", background:"var(--sky-dim)", borderRadius:"10px", border:"1px solid #BAE6FD" } },
            React.createElement("span", { style:{ fontSize:"13px", color:"var(--sky)", fontWeight:"700" } }, "\ud83d\udcc5 "+fmt(open.nextCallback)),
            React.createElement("button", { onClick:()=>upd(open.id,{nextCallback:null}), style:{ marginLeft:"auto", background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:"20px", lineHeight:1 } }, "\u00d7")
          ),
          React.createElement("div", { style:{ display:"flex", gap:"10px", flexWrap:"wrap" } },
            React.createElement("input", { type:"date", value:cbDate, onChange:e=>setCbDate(e.target.value), style:{...inp(),flex:1,minWidth:"140px"} }),
            React.createElement("input", { type:"time", value:cbTime, onChange:e=>setCbTime(e.target.value), style:{...inp(),width:"110px"} }),
            React.createElement("button", { onClick:()=>lockCB(open.id), style:{ padding:"10px 22px", background:"var(--sky)", color:"#fff", border:"none", borderRadius:"8px", fontSize:"13px", fontWeight:"700", cursor:"pointer" } }, "Set Callback")
          )
        ),

        // Sequence control panel
        (() => {
              const seqStatus = getSequenceStatus(open);
              const seqColor  = getSequenceBadgeColor(open);
              const nextTouch = getNextTouchDate(open);
              const isPaused  = !!open.seqPaused;
              const isExited  = !!open.seqExitReason && open.seqExitReason !== 'manual';
              const track     = open.seqTrack || 'new';
              const step      = open.seqStep  ?? 0;
              const TRACK_LABELS = { new:'New Lead', 're-engage':'Re-Engage', ghost:'Ghost' };
              const EXIT_OPTIONS = [
                { value:'not_interested', label:'Not Interested' },
                { value:'dnc',            label:'DNC — Do Not Contact' },
                { value:'sold',           label:'Sold — Protection Placed' },
                { value:'manual',         label:'Manual Hold' },
              ];

              // Background tint based on state
              const panelBg = isExited ? 'var(--surface)'
                : isPaused   ? '#FFFBEB'
                : seqColor === 'var(--red)' ? '#FFF5F5'
                : 'var(--surface)';
              const panelBorder = isExited ? 'var(--border)'
                : isPaused   ? '#FCD34D'
                : seqColor === 'var(--red)' ? '#FCA5A5'
                : 'var(--border)';

              return React.createElement("div", {
                style:{ background:panelBg, borderRadius:"12px", border:"1px solid "+panelBorder, padding:"20px 24px" }
              },
                // Header
                React.createElement("div", { style:{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px", gap:"8px", flexWrap:"wrap" } },
                  React.createElement("div", { style:{ fontSize:"11px", fontWeight:"800", color:"var(--t3)", letterSpacing:"1.5px" } }, "🤖 SEQUENCE"),
                  React.createElement("span", {
                    style:{
                      fontSize:"11px", fontWeight:"700", padding:"3px 10px", borderRadius:"var(--radius-pill)",
                      color: seqColor,
                      background: seqColor === 'var(--red)'   ? '#FEE2E2'
                                : seqColor === 'var(--amber)' ? '#FEF3C7'
                                : seqColor === 'var(--green)' ? '#ECFDF5'
                                : seqColor === 'var(--blue)'  ? '#EFF6FF'
                                : 'var(--surface-2)',
                      border: "1px solid " + (
                        seqColor === 'var(--red)'   ? '#FCA5A5'
                      : seqColor === 'var(--amber)' ? '#FCD34D'
                      : seqColor === 'var(--green)' ? '#6EE7B7'
                      : seqColor === 'var(--blue)'  ? 'var(--blue-mid)'
                      : 'var(--border)'
                      )
                    }
                  }, seqStatus)
                ),

                // Track + Step row
                React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"12px" } },
                  React.createElement("div", null,
                    React.createElement("div", { style:{ fontSize:"10px", fontWeight:"700", color:"var(--t4)", letterSpacing:"0.6px", marginBottom:"4px" } }, "TRACK"),
                    React.createElement("div", { style:{ fontSize:"13px", fontWeight:"700", color:"var(--t1)" } }, TRACK_LABELS[track] || track)
                  ),
                  React.createElement("div", null,
                    React.createElement("div", { style:{ fontSize:"10px", fontWeight:"700", color:"var(--t4)", letterSpacing:"0.6px", marginBottom:"4px" } }, "STEP"),
                    React.createElement("div", { style:{ fontSize:"13px", fontWeight:"700", color:"var(--t1)", fontFamily:"'JetBrains Mono',monospace" } }, step)
                  )
                ),

                // Next touch date
                !isExited && React.createElement("div", {
                  style:{ fontSize:"12px", color:"var(--t3)", marginBottom:"14px", padding:"8px 12px", background:"var(--surface-2)", borderRadius:"8px", border:"1px solid var(--border)", fontWeight:"500" }
                },
                  isPaused
                    ? "Sequence paused — no automated touches will fire."
                    : nextTouch
                      ? React.createElement(React.Fragment, null,
                          "Next touch: ",
                          React.createElement("span", { style:{ color:"var(--t1)", fontWeight:"700", fontFamily:"'JetBrains Mono',monospace" } },
                            nextTouch.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
                          )
                        )
                      : "No upcoming touches scheduled."
                ),

                // Action buttons
                !isExited && React.createElement("div", { style:{ display:"flex", gap:"8px", marginBottom:"12px" } },
                  isPaused
                    ? React.createElement("button", {
                        onClick: () => upd(open.id, resumeSequence()),
                        style:{ flex:1, padding:"10px 14px", background:"var(--green)", color:"#fff", border:"none", borderRadius:"8px", fontSize:"12px", fontWeight:"700", cursor:"pointer" }
                      }, "▶ Resume Sequence")
                    : React.createElement("button", {
                        onClick: () => upd(open.id, pauseSequence('manual')),
                        style:{ flex:1, padding:"10px 14px", background:"var(--surface-2)", color:"var(--amber)", border:"1px solid #FCD34D", borderRadius:"8px", fontSize:"12px", fontWeight:"700", cursor:"pointer" }
                      }, "⏸ Pause"),
                  !isPaused && React.createElement("button", {
                    onClick: () => upd(open.id, advanceSequence(open)),
                    title: "Skip current step and advance to next",
                    style:{ padding:"10px 14px", background:"var(--blue-dim)", color:"var(--blue)", border:"1px solid var(--blue-mid)", borderRadius:"8px", fontSize:"12px", fontWeight:"700", cursor:"pointer" }
                  }, "Skip →")
                ),

                // Change track
                !isExited && React.createElement("div", { style:{ marginBottom:"12px" } },
                  React.createElement("div", { style:{ fontSize:"10px", fontWeight:"700", color:"var(--t4)", letterSpacing:"0.6px", marginBottom:"6px" } }, "CHANGE TRACK"),
                  React.createElement("div", { style:{ display:"flex", gap:"6px" } },
                    ['new','re-engage','ghost'].map(t =>
                      React.createElement("button", {
                        key: t,
                        onClick: () => upd(open.id, {
                          seqTrack:      t,
                          seqStep:       0,
                          seqStartDate:  new Date().toISOString(),
                          seqPaused:     false,
                          seqExitReason: null,
                        }),
                        style:{
                          flex:1, padding:"7px 0", fontSize:"11px", fontWeight:"700", cursor:"pointer", borderRadius:"6px", textAlign:"center",
                          background: track === t ? 'var(--navy)' : 'var(--surface-2)',
                          color:      track === t ? '#fff'        : 'var(--t3)',
                          border:     track === t ? 'none'        : '1px solid var(--border)',
                        }
                      }, { new:'New', 're-engage':'Re-Engage', ghost:'Ghost' }[t])
                    )
                  )
                ),

                // Exit sequence dropdown
                React.createElement("div", null,
                  React.createElement("div", { style:{ fontSize:"10px", fontWeight:"700", color:"var(--t4)", letterSpacing:"0.6px", marginBottom:"6px" } }, "EXIT SEQUENCE"),
                  React.createElement("select", {
                    value: open.seqExitReason || '',
                    onChange: e => {
                      const reason = e.target.value;
                      if (!reason) return;
                      upd(open.id, pauseSequence(reason));
                    },
                    style:{...inp(), width:"100%", fontSize:"12px", cursor:"pointer" }
                  },
                    React.createElement("option", { value:"" }, "— Select exit reason —"),
                    EXIT_OPTIONS.map(o =>
                      React.createElement("option", { key:o.value, value:o.value }, o.label)
                    )
                  ),
                  isExited && React.createElement("button", {
                    onClick: () => upd(open.id, resumeSequence()),
                    style:{ marginTop:"8px", width:"100%", padding:"9px 0", background:"var(--surface-2)", color:"var(--blue)", border:"1px solid var(--blue-mid)", borderRadius:"8px", fontSize:"12px", fontWeight:"700", cursor:"pointer" }
                  }, "↩ Re-Enter Sequence")
                )
              );
            })(),

            // Underwriting card
            React.createElement(UnderwritingCard, {
              lead:open, key:"uw-cp-"+open.id,
              upd, newReqText, setNewReqText,
              initUWReqs, toggleUWReq, removeUWReq, addUWReq,
            })
          )
        )
      );
    }

    export { StageStepper, UnderwritingCard };
