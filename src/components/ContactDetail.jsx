import { BRAND } from '../config.js';
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
import { getLBLDay1Opener } from '../lib/sequenceTemplates.js';
import { SMS_SEQUENCES, suggestSeqCat, effectivePhase, leadAgeDays, PHASE_DEFS } from '../lib/phaseEngine.js';
import SmsThread from './SmsThread.jsx'; // v3.90 — lead view now uses the shared SMS panel (INTRO / 🔥 intro+card / No-Answer rotation)

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

// ── APP ECONOMICS CARD (v3.51 — Session 5) ───────────────────────
// Money-in per application: APV, commission, advance, payment date, status.
// Feeds the Lead Orders break-even dashboard (💰 ORDERS in nav).
const ECON_STAGES = ["app_submitted", "underwriting", "issued"];
const APP_STATUSES = ["submitted", "issued", "paid", "chargeback", "cancelled"];
const AppEconomicsCard = ({ lead, upd }) => {
  if (!lead) return null;
  const show = ECON_STAGES.includes(lead.stage) || lead.appStatus || lead.apv;
  if (!show) return null;
  const numIn = (label, field, ph) => React.createElement("div", { style:{ flex:"1 1 110px", minWidth:"100px" } },
    React.createElement("div", { style:{ fontSize:"11pxpx", fontWeight:"800", color:"var(--t4)", letterSpacing:"0.8px", marginBottom:"4px" } }, label),
    React.createElement("input", {
      type:"number", step:"0.01", placeholder: ph || "0",
      value: lead[field] ?? "",
      onChange: e => upd(lead.id, { [field]: e.target.value === "" ? null : parseFloat(e.target.value) }),
      style:{ width:"100%", padding:"8px 10px", fontSize:"13px", fontFamily:"'JetBrains Mono',monospace", border:"1px solid var(--border)", borderRadius:"8px", background:"var(--surface-2)", color:"var(--t1)", outline:"none" }
    })
  );
  return React.createElement("div", { style:{ background:"var(--surface)", borderRadius:"12px", border:"1px solid var(--border)", padding:"20px 24px" } },
    React.createElement("div", { style:{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px", flexWrap:"wrap", gap:"8px" } },
      React.createElement("div", { style:{ fontSize:"11px", fontWeight:"800", color:"var(--t3)", letterSpacing:"1.5px" } }, "\u{1F4B0} APP ECONOMICS"),
      React.createElement("select", {
        value: lead.appStatus || "",
        onChange: e => upd(lead.id, { appStatus: e.target.value || null }),
        style:{ padding:"6px 10px", fontSize:"11px", fontWeight:"700", border:"1px solid var(--border)", borderRadius:"8px", background:"var(--surface-2)", color: lead.appStatus === "chargeback" ? "var(--red)" : lead.appStatus === "paid" ? "var(--green)" : "var(--t2)", cursor:"pointer" }
      },
        React.createElement("option", { value:"" }, "status\u2026"),
        APP_STATUSES.map(st => React.createElement("option", { key:st, value:st }, st))
      )
    ),
    React.createElement("div", { style:{ display:"flex", gap:"10px", flexWrap:"wrap" } },
      numIn("APV ($/yr)", "apv"),
      numIn("COMMISSION PAID", "commissionPaid"),
      numIn("ADVANCE PAID", "advancePaid"),
      React.createElement("div", { style:{ flex:"1 1 130px", minWidth:"120px" } },
        React.createElement("div", { style:{ fontSize:"11pxpx", fontWeight:"800", color:"var(--t4)", letterSpacing:"0.8px", marginBottom:"4px" } }, "PAYMENT DATE"),
        React.createElement("input", {
          type:"date",
          value: lead.paymentDate ? lead.paymentDate.slice(0,10) : "",
          onChange: e => upd(lead.id, { paymentDate: e.target.value || null }),
          style:{ width:"100%", padding:"7px 10px", fontSize:"12px", border:"1px solid var(--border)", borderRadius:"8px", background:"var(--surface-2)", color:"var(--t1)", outline:"none" }
        })
      )
    ),
    lead.appStatus === "chargeback" && React.createElement("div", { style:{ marginTop:"10px", fontSize:"11px", fontWeight:"700", color:"var(--red)", background:"var(--red-dim)", padding:"8px 12px", borderRadius:"8px" } },
      "\u26A0 Chargeback \u2014 commission + advance SUBTRACT from this lead's order P&L.")
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


// ── SMS THREAD TAB ─────────────────────────────────────────────────────────────
// Full two-way SMS thread: outbound bubbles (right, navy) + inbound (left, gray).
// Template picker: cat1/cat2/cat3 sequences. Variable insertion. Char counter.
function SmsThreadTab({ open, sendSms, selfApplyUrl }) {
  const [msgText,      setMsgText]      = React.useState('');
  const [sending,      setSending]      = React.useState(false);
  const [sendResult,   setSendResult]   = React.useState(null); // 'ok'|'err'
  const [tplOpen,      setTplOpen]      = React.useState(false);
  const [tplCategory,  setTplCategory]  = React.useState('cat1');
  const bottomRef = React.useRef(null);

  const MAX = 160;
  const chars = msgText.length;
  const segs  = Math.ceil(chars / MAX) || 1;

  // Auto-scroll to bottom when messages change
  React.useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [(open && open.notes || []).length]);

  // Pull SMS messages from notes — inbound + outbound
  const smsMessages = React.useMemo(() => {
    if (!open) return [];
    return (open.notes || [])
      .filter(n => {
        if (!n || !n.text) return false;
        if (n.type === 'sms_inbound') return true;
        if (n.text.startsWith('📱 SMS sent:')) return true;
        if (n.text.startsWith('[SEQ] SMS sent')) return true;
        return false;
      })
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  }, [open && open.notes]);

  const fill = (text) => {
    const firstName = open ? (open.firstName || (open.name || '').split(' ')[0] || 'there') : 'there';
    const calendly  = BRAND.calendly;
    setMsgText(
      text
        .replace(/\$\{n\}|\{n\}/g, firstName)
        .replace(/\{firstName\}/gi, firstName)
        .replace(/\{calendly\}|\{calendlyUrl\}/gi, calendly)
        .replace(/\{selfApply\}/gi, selfApplyUrl || '')
        .replace(/\[YOUR CALENDLY LINK\]/g, calendly)
        .replace(/\[CALENDLY\]/g, calendly)
    );
    setTplOpen(false);
  };

  const insertVar = (v) => {
    const firstName = open ? (open.firstName || (open.name || '').split(' ')[0] || 'there') : 'there';
    const map = {
      '{firstName}':  firstName,
      '{calendly}':   BRAND.calendly,
      '{selfApply}':  selfApplyUrl || '',
    };
    setMsgText(prev => prev + (map[v] || v));
  };

  const handleSend = async () => {
    if (!open || !msgText.trim() || sending || !open.phone) return;
    setSending(true); setSendResult(null);
    try {
      await sendSms(open.phone, msgText.trim(), open.id);
      setSendResult('ok');
      setMsgText('');
      setTimeout(() => setSendResult(null), 2500);
    } catch { setSendResult('err'); }
    finally { setSending(false); }
  };

  // Date divider helper
  const dayLabel = (ts) => {
    const d = new Date(ts);
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const msgDay = new Date(d); msgDay.setHours(0,0,0,0);
    if (msgDay.getTime() === today.getTime()) return 'Today';
    if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: msgDay.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  };

  const catLabels = { cat1: '📭 New / Cold', cat2: '❌ No-Show', cat3: '📋 Sat — No Buy' };
  const suggestedCat = open ? suggestSeqCat(open) : 'cat1';

  // Group messages by day for date dividers
  let lastDay = '';

  if (!open) return React.createElement('div', { style: { padding: '32px', textAlign: 'center', color: 'var(--t4)', fontSize: '12px' } }, 'No lead selected.');

  const optedOut = !!(open.smsOptOut);

  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column', height: '560px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }
  },

    // ── Header ─────────────────────────────────────────────────────
    React.createElement('div', {
      style: { padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }
    },
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('div', { style: { fontSize: '13px', fontWeight: '800', color: 'var(--t1)', fontFamily: "'JetBrains Mono',monospace" } }, open.phone || 'No phone'),
        React.createElement('div', { style: { fontSize: '11pxpx', color: 'var(--t3)', marginTop: '2px' } },
          smsMessages.length + ' messages · ' + (optedOut ? '🔴 Opted Out' : '✅ A2P Cleared')
        )
      ),
      optedOut && React.createElement('span', {
        style: { fontSize: '11pxpx', fontWeight: '800', padding: '3px 8px', borderRadius: '12px', background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid #FCA5A5' }
      }, 'STOP RECEIVED')
    ),

    // ── Thread ─────────────────────────────────────────────────────
    React.createElement('div', {
      style: { flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }
    },
      smsMessages.length === 0
        ? React.createElement('div', { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t4)', fontSize: '12px', textAlign: 'center', padding: '24px' } },
            React.createElement('div', null,
              React.createElement('div', { style: { fontSize: '28px', marginBottom: '8px' } }, '💬'),
              'No messages yet.',
              React.createElement('br', null),
              'Send the first one below.'
            )
          )
        : smsMessages.map((msg, i) => {
            const isInbound  = msg.type === 'sms_inbound';
            const isAuto     = msg.text && msg.text.startsWith('[SEQ]');
            const msgText    = msg.text
              .replace('📱 SMS sent: ', '')
              .replace(/^\[SEQ\] SMS sent — Track: .+ \| Step \d+ \| To: .+/, '[Auto sequence message]')
              .replace(/^\[SEQ\] SMS sent — .+/, '[Auto sequence]');
            const msgDay     = dayLabel(msg.ts);
            const showDivider = msgDay !== lastDay;
            lastDay = msgDay;
            const time = new Date(msg.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

            return React.createElement(React.Fragment, { key: msg.ts + i },
              showDivider && React.createElement('div', {
                style: { textAlign: 'center', margin: '8px 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }
              },
                React.createElement('div', { style: { flex: 1, height: '1px', background: 'var(--border)' } }),
                React.createElement('span', { style: { fontSize: '11pxpx', color: 'var(--t4)', fontWeight: '600', whiteSpace: 'nowrap' } }, msgDay),
                React.createElement('div', { style: { flex: 1, height: '1px', background: 'var(--border)' } })
              ),
              React.createElement('div', {
                style: { display: 'flex', justifyContent: isInbound ? 'flex-start' : 'flex-end', marginBottom: '2px' }
              },
                React.createElement('div', {
                  style: {
                    maxWidth: '78%', padding: '8px 12px', borderRadius: isInbound ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                    background: isInbound ? 'var(--surface-2)' : '#1a2a44',
                    color: isInbound ? 'var(--t1)' : '#fff',
                    border: isInbound ? '1px solid var(--border)' : 'none',
                    fontSize: '12px', lineHeight: '1.5', wordBreak: 'break-word'
                  }
                },
                  React.createElement('div', null, msgText),
                  React.createElement('div', {
                    style: { fontSize: '11pxpx', marginTop: '4px', opacity: 0.6, textAlign: isInbound ? 'left' : 'right' }
                  }, time + (isAuto ? ' · auto' : ''))
                )
              )
            );
          }),
      React.createElement('div', { ref: bottomRef })
    ),

    // ── Toolbar + Compose ──────────────────────────────────────────
    React.createElement('div', {
      style: { borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '10px 12px', flexShrink: 0, position: 'relative' }
    },

      // Template popover
      tplOpen && React.createElement('div', {
        style: {
          position: 'absolute', bottom: 'calc(100% + 4px)', left: '0', right: '0', zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)', padding: '12px', maxHeight: '320px', overflow: 'hidden', display: 'flex', flexDirection: 'column'
        }
      },
        // Category tabs
        React.createElement('div', { style: { display: 'flex', gap: '4px', marginBottom: '10px', flexShrink: 0 } },
          Object.entries(catLabels).map(([cat, label]) =>
            React.createElement('button', {
              key: cat,
              onClick: () => setTplCategory(cat),
              style: {
                flex: 1, padding: '5px 4px', fontSize: '11pxpx', fontWeight: '700', borderRadius: '6px', cursor: 'pointer', border: '1px solid ' + (tplCategory === cat ? 'var(--blue)' : 'var(--border)'),
                background: tplCategory === cat ? 'var(--blue)' : 'transparent',
                color: tplCategory === cat ? '#fff' : 'var(--t3)'
              }
            }, (cat === suggestedCat ? '⭐ ' : '') + label)
          )
        ),
        // Steps list
        React.createElement('div', { style: { overflowY: 'auto', flex: 1 } },
          (SMS_SEQUENCES[tplCategory] && SMS_SEQUENCES[tplCategory].texts || []).map(step => {
            const firstName = open ? (open.firstName || (open.name || '').split(' ')[0] || 'there') : 'there';
            const preview = step.body(firstName, BRAND.calendly).slice(0, 80) + '…';
            return React.createElement('div', {
              key: step.step,
              onClick: () => fill(step.body(firstName, BRAND.calendly)),
              style: {
                padding: '8px 10px', marginBottom: '4px', borderRadius: '8px', border: '1px solid var(--border)',
                cursor: 'pointer', background: 'var(--surface-2)', transition: 'background 0.1s'
              },
              onMouseEnter: e => e.currentTarget.style.background = 'var(--blue-dim)',
              onMouseLeave: e => e.currentTarget.style.background = 'var(--surface-2)',
            },
              React.createElement('div', { style: { fontSize: '11pxpx', fontWeight: '800', color: 'var(--t3)', marginBottom: '2px' } }, 'Step ' + step.step),
              React.createElement('div', { style: { fontSize: '11px', color: 'var(--t2)', lineHeight: '1.4' } }, preview)
            );
          })
        )
      ),

      // Toolbar row
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' } },
        React.createElement('button', {
          onClick: () => setTplOpen(v => !v),
          style: { fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px', border: '1px solid ' + (tplOpen ? 'var(--blue)' : 'var(--border)'), background: tplOpen ? 'var(--blue)' : 'var(--surface-2)', color: tplOpen ? '#fff' : 'var(--t2)', cursor: 'pointer', whiteSpace: 'nowrap' }
        }, '📋 Templates ' + (tplOpen ? '▲' : '▾')),
        // Variable insertion
        React.createElement('div', { style: { display: 'flex', gap: '3px' } },
          [
            ['{firstName}', 'Name'],
            ['{calendly}',  'Cal'],
            ['{selfApply}', 'Apply'],
          ].map(([v, lbl]) =>
            React.createElement('button', {
              key: v,
              onClick: () => insertVar(v),
              title: 'Insert ' + v,
              style: { fontSize: '11pxpx', fontWeight: '700', padding: '3px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--t3)', cursor: 'pointer' }
            }, '{' + lbl + '}')
          )
        ),
        React.createElement('div', { style: { marginLeft: 'auto', fontSize: '11pxpx', color: chars > MAX ? 'var(--red)' : chars > MAX * 0.85 ? 'var(--amber)' : 'var(--t4)', fontWeight: '700', fontFamily: 'monospace' } },
          chars + '/' + MAX + (segs > 1 ? ' ·' + segs + 'seg' : '')
        )
      ),

      // Compose row
      React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'flex-end' } },
        React.createElement('textarea', {
          value: msgText,
          onChange: e => setMsgText(e.target.value),
          onKeyDown: e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(); },
          placeholder: optedOut ? 'Lead has opted out — cannot send' : 'Type a message… (Cmd+Enter to send)',
          disabled: optedOut,
          rows: 2,
          style: {
            flex: 1, resize: 'none', padding: '8px 10px', fontSize: '12px', borderRadius: '8px',
            border: '1px solid var(--border)', background: optedOut ? 'var(--surface-2)' : 'var(--surface)',
            color: 'var(--t1)', fontFamily: "'Inter',sans-serif", lineHeight: '1.5', boxSizing: 'border-box'
          }
        }),
        React.createElement('button', {
          onClick: handleSend,
          disabled: !msgText.trim() || sending || optedOut,
          style: {
            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: msgText.trim() && !sending && !optedOut ? 'pointer' : 'default',
            background: sendResult === 'ok' ? 'var(--green)' : sendResult === 'err' ? 'var(--red)' : msgText.trim() && !optedOut ? '#1a2a44' : 'var(--border)',
            color: msgText.trim() || sendResult ? '#fff' : 'var(--t3)',
            fontSize: '12px', fontWeight: '800', transition: 'background 0.15s', whiteSpace: 'nowrap', alignSelf: 'stretch', minHeight: '54px'
          }
        }, sending ? '⏳' : sendResult === 'ok' ? '✅ Sent' : sendResult === 'err' ? '❌ Retry' : '📱 Send')
      )
    )
  );
}

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
  sendSms,
  selfApplyUrl,
  logActivity, // v3.50 — saveMeeting 'Held' feeds Set Rate
}) {
  if (!open) return null;

  // v3.35 — local state for structured meeting log
  const [cdTab, setCdTab] = React.useState('overview'); // 'overview' | 'sms'
  // v3.89 — open straight to the SMS tab when launched via the dashboard 💬 quick-text
  React.useEffect(() => {
    try { if (localStorage.getItem('metka-cd-tab') === 'sms') { setCdTab('sms'); localStorage.removeItem('metka-cd-tab'); } } catch (e) {}
  }, [open && open.id]);
  const [meetingOutcome, setMeetingOutcome] = React.useState('Held');
  const [meetingTs, setMeetingTs]           = React.useState('');

  const [apptTs, setApptTs] = React.useState(''); // v3.93 — manual appointment setter (lead view)

  // Save a structured appointment record
  const saveMeeting = () => {
    if (!noteText.trim() && meetingOutcome === 'Held') return;
    const ts = meetingTs ? new Date(meetingTs).toISOString() : new Date().toISOString();
    const outcomeEmoji = meetingOutcome === 'Held' ? '✅' : meetingOutcome === 'No Show' ? '❌' : '🔄';
    const richNote = {
      ts,
      type: 'appointment',
      outcome: meetingOutcome,
      text: outcomeEmoji + ' ' + meetingOutcome + (noteText.trim() ? ' — ' + noteText.trim() : ''),
    };
    // v3.50 — outcome 'Held' = an audit happened: fire audit_ran (Set Rate numerator)
    // + stamp satEver lifetime flag. No Show / Reschedule stay note-only.
    if (meetingOutcome === 'Held' && logActivity) logActivity('audit_ran', open.id, 'manual');
    // v3.37 — functional updater: reads fresh notes from React state, not stale open prop
    upd(open.id, (fresh) => ({
      notes: [richNote, ...(fresh.notes || [])],
      ...(meetingOutcome === 'Held' ? { satEver: true } : {}),
    }));
    setNoteText('');
    setMeetingTs('');
    setMeetingOutcome('Held');
  };

  return React.createElement("div", { style:{ flex:1, display:"flex", flexDirection:"column", background:"var(--surface-2)", overflow:"hidden" } },
    // ── Header bar
    React.createElement("div", { style:{ padding:"14px 24px", background:"var(--surface)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:"12px", flexShrink:0 } },
      React.createElement("button", { onClick:()=>setView(prevView), style:{ padding:"8px 16px", borderRadius:"8px", fontWeight:"700", fontSize:"12px", cursor:"pointer", border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--t2)" } }, "← Back"),
      React.createElement("div", { style:{ fontFamily:"'Syne',sans-serif", fontWeight:"800", fontSize:"15px", color:"var(--navy)", letterSpacing:"1px", flex:1 } }, open.name || "Contact"),
      React.createElement("div", { style:{ display:"flex", gap:"8px", alignItems:"center" } },
        React.createElement("span", { style:{ fontSize:"11px", padding:"4px 12px", borderRadius:"var(--radius-pill)", background:BC[open.bucket]+"18", color:BC[open.bucket], fontWeight:"800" } }, BL[open.bucket]),
        (() => { const ep = effectivePhase(open); const pd = PHASE_DEFS[ep]; const age = leadAgeDays(open); return pd ? React.createElement("span", { style:{ fontSize:"11px", padding:"4px 10px", borderRadius:"var(--radius-pill)", background:pd.dim||"var(--surface-2)", color:pd.color||"var(--t2)", fontWeight:"800", border:"1px solid "+(pd.dim||"var(--border)") } }, ep + (age !== null ? " · Day " + age : "")) : null; })(),
        open.stage && React.createElement("span", { style:{ fontSize:"11px", padding:"4px 12px", borderRadius:"var(--radius-pill)", background:"var(--surface-2)", color:"var(--t2)", fontWeight:"700", border:"1px solid var(--border)" } }, (STAGES.find(s=>s.id===open.stage)||STAGES[0]).label),
        open.assignDate && React.createElement("span", { style:{ fontSize:"11px", color:"var(--t4)", fontWeight:"600", padding:"0 4px" } }, "📅 " + fmtDate(open.assignDate)),
        open.emailBounced && React.createElement("span", { style:{ fontSize:"11px", padding:"4px 12px", borderRadius:"var(--radius-pill)", background:"var(--red-dim)", color:"var(--red)", fontWeight:"800", border:"1px solid #FCA5A5" } }, "⚠ Email Bounced"),
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
            [["Name","name","Full name"],["Phone","phone","(405) 555-0000"],["Email","email","email@domain.com"],["Age","age","e.g. 54"],["City","city","City"],["State","state","OK"],["Loan Amount","loanAmount","e.g. 185000"],["Lead Type","leadType","Mortgage Protection"],["Gender","gender","Male / Female"],["Zip","zip","74864"],["Req. Coverage","requestedCoverage","e.g. Under $100,000"],["Beneficiary","beneficiary","e.g. Spouse"],["Employment","employment","e.g. Employed Full-Time"]].map(([label,field,ph]) =>
              React.createElement("div", { key:field },
                React.createElement("label", { style:{ fontSize: "11px", fontWeight:"700", color:"var(--t3)", letterSpacing:"0.6px", display:"block", marginBottom:"4px" } }, label.toUpperCase()),
                React.createElement("input", { key:field+"-id-"+open.id, placeholder:ph, defaultValue:open[field]||"", onBlur:e=>{ const v=e.target.value.trim(); if(v!==(open[field]||"")) upd(open.id,{[field]:v}); }, style:{...inp(),width:"100%",fontSize:"12px",boxSizing:"border-box"} })
              )
            ),
            open.leadType === "Living Benefits Lead" && React.createElement("div", { key:"hobby", style:{ gridColumn:"1 / -1" } },
              React.createElement("label", { style:{ fontSize: "11px", fontWeight:"700", color:"#7C3AED", letterSpacing:"0.6px", display:"block", marginBottom:"4px" } }, "HOBBY / INTEREST"),
              React.createElement("input", { key:"hobby-id-"+open.id, placeholder:"e.g. hunting, fishing, camping...", defaultValue:open.hobby||"", onBlur:e=>{ const v=e.target.value.trim(); if(v!==(open.hobby||"")) upd(open.id,{hobby:v}); }, style:{...inp(),width:"100%",fontSize:"12px",boxSizing:"border-box",borderColor:"#7C3AED44"} })
            )
          ),
          open.pdfUrl && React.createElement("a", { href:open.pdfUrl, target:"_blank", rel:"noreferrer", style:{ fontSize:"11px", color:"var(--sky)", textDecoration:"none", fontWeight:"700" } }, "📋 Lead Sheet →"),
          React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"10px", marginTop:"10px", padding:"8px 12px", background:open.emailBounced?"var(--red-dim)":"var(--surface-2)", borderRadius:"8px", border:"1px solid "+(open.emailBounced?"#FCA5A5":"var(--border)") } },
            React.createElement("input", { type:"checkbox", id:"bounce-"+open.id, checked:!!open.emailBounced, onChange:e=>upd(open.id,{emailBounced:e.target.checked}), style:{ width:"15px", height:"15px", cursor:"pointer", accentColor:"var(--red)" } }),
            React.createElement("label", { htmlFor:"bounce-"+open.id, style:{ fontSize:"12px", fontWeight:"700", color:open.emailBounced?"var(--red)":"var(--t3)", cursor:"pointer" } }, "⚠ Email Bounced — skip email sequence")
          )
        ),

        // ── Day 1 Opener card — LBL leads only ─────────────────────────────────────
        open.leadType === "Living Benefits Lead" && React.createElement("div", { style:{ background:"var(--surface)", borderRadius:"12px", border:"1px solid #7C3AED55", padding:"20px 24px" } },
          React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"16px" } },
            React.createElement("div", { style:{ fontSize:"11px", fontWeight:"800", color:"#7C3AED", letterSpacing:"1.5px", flex:1 } }, "⚡ DAY 1 OPENER — COPY & SEND IN ORDER"),
            React.createElement("div", { style:{ fontSize:"11pxpx", color:"var(--t4)", fontWeight:"600" } }, "Manual send · TCPA compliant")
          ),
          (() => {
            const firstName = (open.firstName || open.name || "").split(" ")[0] || open.name || "there";
            const opener = getLBLDay1Opener(firstName, open.hobby);
            return React.createElement(React.Fragment, null,
              // Text 1
              React.createElement("div", { style:{ marginBottom:"12px" } },
                React.createElement("div", { style:{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"6px" } },
                  React.createElement("div", { style:{ fontSize:"11px", fontWeight:"700", color:"var(--t3)", letterSpacing:"0.6px" } }, "TEXT 1 — SEND FIRST"),
                  React.createElement("button", {
                    onClick: () => { navigator.clipboard.writeText(opener.text1).catch(()=>{}); },
                    style:{ fontSize:"11px", fontWeight:"700", color:"#7C3AED", background:"#7C3AED18", border:"1px solid #7C3AED44", borderRadius:"6px", padding:"3px 10px", cursor:"pointer" }
                  }, "Copy")
                ),
                React.createElement("div", { style:{ background:"var(--surface-2)", borderRadius:"8px", border:"1px solid var(--border)", padding:"10px 14px", fontSize:"12px", color:"var(--t1)", lineHeight:"1.6", fontFamily:"'Inter',sans-serif", whiteSpace:"pre-wrap" } }, opener.text1)
              ),
              // Text 2
              React.createElement("div", { style:{ marginBottom:"12px" } },
                React.createElement("div", { style:{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"6px" } },
                  React.createElement("div", { style:{ fontSize:"11px", fontWeight:"700", color:"var(--t3)", letterSpacing:"0.6px" } }, "TEXT 2 — SEND ~2 MIN LATER"),
                  React.createElement("button", {
                    onClick: () => { navigator.clipboard.writeText(opener.text2).catch(()=>{}); },
                    style:{ fontSize:"11px", fontWeight:"700", color:"#7C3AED", background:"#7C3AED18", border:"1px solid #7C3AED44", borderRadius:"6px", padding:"3px 10px", cursor:"pointer" }
                  }, "Copy")
                ),
                React.createElement("div", { style:{ background:"var(--surface-2)", borderRadius:"8px", border:"1px solid var(--border)", padding:"10px 14px", fontSize:"12px", color:"var(--t1)", lineHeight:"1.6", fontFamily:"'Inter',sans-serif", whiteSpace:"pre-wrap" } }, opener.text2)
              ),
              // Call reminder
              React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 14px", background:"var(--blue-dim)", borderRadius:"8px", border:"1px solid var(--blue-mid)" } },
                React.createElement("span", { style:{ fontSize:"13px" } }, "📞"),
                React.createElement("span", { style:{ fontSize:"11px", fontWeight:"700", color:"var(--blue)" } }, "THEN CALL immediately after Text 2 — use the Dial button above")
              )
            );
          })()
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
          // v3.35 — structured meeting fields when appointment type selected
          noteType === "appointment" && React.createElement("div", { style:{ marginBottom:"10px", display:"flex", flexDirection:"column", gap:"8px" } },
            React.createElement("div", { style:{ display:"flex", gap:"6px", alignItems:"center" } },
              React.createElement("span", { style:{ fontSize:"11px", fontWeight:"800", color:"var(--t3)", letterSpacing:"0.6px", minWidth:"60px" } }, "OUTCOME"),
              ["Held","No Show","Rescheduled"].map(o =>
                React.createElement("button", {
                  key:o, onClick:()=>setMeetingOutcome(o),
                  style:{ padding:"5px 12px", borderRadius:"20px", fontSize:"11px", fontWeight:"700", cursor:"pointer", border:"1.5px solid " + (meetingOutcome===o ? "var(--blue)" : "var(--border)"), background: meetingOutcome===o ? "var(--blue)" : "transparent", color: meetingOutcome===o ? "#fff" : "var(--t2)", transition:"all 0.1s" }
                }, o)
              )
            ),
            React.createElement("div", { style:{ display:"flex", gap:"6px", alignItems:"center" } },
              React.createElement("span", { style:{ fontSize:"11px", fontWeight:"800", color:"var(--t3)", letterSpacing:"0.6px", minWidth:"60px" } }, "DATE/TIME"),
              React.createElement("input", {
                type:"datetime-local", value:meetingTs, onChange:e=>setMeetingTs(e.target.value),
                style:{ fontSize:"11px", padding:"6px 10px", borderRadius:"8px", border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--t2)", fontFamily:"inherit", flex:1 }
              }),
              React.createElement("span", { style:{ fontSize:"11pxpx", color:"var(--t4)", fontWeight:"500", whiteSpace:"nowrap" } }, "← blank = now")
            )
          ),
          React.createElement("div", { style:{ display:"flex", gap:"10px", marginBottom:"16px" } },
            React.createElement("textarea", { value:noteText, onChange:e=>setNoteText(e.target.value), placeholder: noteType==="call"?"Result, what they said, next step...":noteType==="appointment"?"Products discussed, next step, Five R's...":"General note...", style:{ flex:1, background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"10px", color:"var(--t1)", padding:"12px 14px", fontSize:"13px", fontFamily:"'Inter',sans-serif", resize:"vertical", minHeight:"80px", lineHeight:"1.6" } }),
            React.createElement("button", { onClick:()=>{ noteType==="appointment" ? saveMeeting() : addNote(open.id); }, style:{ padding:"0 20px", background:"var(--blue)", color:"#fff", border:"none", borderRadius:"10px", fontSize:"24px", cursor:"pointer", alignSelf:"stretch" } }, "→")
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
                  n.outcome && React.createElement("span", { style:{ fontSize:"11pxpx", fontWeight:"700", padding:"2px 7px", borderRadius:"10px", background: n.outcome==="Held" ? "rgba(16,185,129,0.12)" : n.outcome==="No Show" ? "rgba(239,68,68,0.12)" : "rgba(99,102,241,0.12)", color: n.outcome==="Held" ? "var(--green)" : n.outcome==="No Show" ? "var(--red)" : "var(--indigo, #6366f1)" } }, n.outcome),
                  React.createElement("span", { style:{ fontSize:"11px", color:"var(--t4)", fontWeight:"500" } }, n.ts?new Date(n.ts).toLocaleString():""),
                  React.createElement("button", { onClick:()=>{ const next=(open.notes||[]).filter((_,ni)=>ni!==i); upd(open.id,{notes:next}); }, title:"Remove", style:{ marginLeft:"auto", background:"none", border:"none", color:"var(--t4)", cursor:"pointer", fontSize:"14px", padding:"0 2px", lineHeight:1 } }, "−")
                ),
                React.createElement("div", { style:{ fontSize:"13px", color:"var(--t2)", lineHeight:"1.6", background:"var(--surface-2)", padding:"12px 16px", borderRadius:"10px" } }, ""+n.text)
              )
            )
          )
        )
      ),

      // ── RIGHT: tabbed panel — Overview | SMS
      React.createElement("div", { style:{ flex:"1 1 320px", minWidth:"280px", display:"flex", flexDirection:"column", gap:"0" } },

        // Tab bar
        React.createElement("div", { style:{ display:"flex", marginBottom:"16px", borderRadius:"10px", overflow:"hidden", border:"1px solid var(--border)", background:"var(--surface-2)", flexShrink:0 } },
          [["overview","📋 Overview"],["sms","💬 SMS"]].map(([tab,label]) =>
            React.createElement("button", {
              key:tab, onClick:()=>setCdTab(tab),
              style:{
                flex:1, padding:"9px 6px", fontSize:"11px", fontWeight:"700", border:"none", cursor:"pointer",
                background: cdTab===tab ? "var(--navy)" : "transparent",
                color: cdTab===tab ? "#fff" : "var(--t3)",
                borderRight: tab==="overview" ? "1px solid var(--border)" : "none",
                transition:"all 0.1s"
              }
            }, label)
          )
        ),

        // SMS tab
        cdTab === "sms" && React.createElement(SmsThread, { open, sendSms, upd, height: '560px' }),

        // Overview tab contents — disposition + stage + callback + UW
        cdTab === "overview" && React.createElement("div", { style:{ display:"flex", flexDirection:"column", gap:"16px" } },

        // Disposition card
        React.createElement("div", { style:{ background:"var(--surface)", borderRadius:"12px", border:"1px solid var(--border)", padding:"20px 24px" } },
          React.createElement("div", { style:{ fontSize: "11px", fontWeight:"800", color:"var(--t3)", letterSpacing:"1.5px", marginBottom:"12px" } }, "CALL DISPOSITION"),
          React.createElement("button", {
            onClick:()=>{ openCalendlyPopup(open, calendlyUrl, setCalendlyTargetId); },
            style:{ display:"block", width:"100%", padding:"12px 16px", marginBottom:"10px", background:open.disposition==="appointment_booked"?"#8B5CF6":"var(--surface)", color:open.disposition==="appointment_booked"?"#fff":"#8B5CF6", border:"1.5px solid "+(open.disposition==="appointment_booked"?"#8B5CF6":"#C4B5FD"), borderRadius:"10px", fontSize:"14px", fontWeight:"800", cursor:"pointer", textAlign:"center", transition:"all 0.1s ease" }
          }, open.disposition==="appointment_booked" ? "📅 BOOKED · "+fmt(open.nextCallback) : "📅 BOOK APPOINTMENT → CALENDLY"),
          // v3.93 — manual appointment setter (parity with the dialer's manual appt)
          React.createElement("div", { style:{ display:"flex", gap:"6px", marginBottom:"10px", alignItems:"center" } },
            React.createElement("input", { type:"datetime-local", value:apptTs, onChange:e=>setApptTs(e.target.value), style:{...inp(), flex:1, fontSize:"12px", padding:"8px 10px"} }),
            React.createElement("button", { onClick:()=>{ if(!apptTs) return; const iso=new Date(apptTs).toISOString(); upd(open.id,(fresh)=>({ disposition:"appointment_booked", stage:"appointment_set", nextCallback:iso, apptConfirmed:false, notes:[{ts:new Date().toISOString(),type:"appointment",text:"\ud83d\udcc5 Appointment set - "+fmt(iso)}, ...(fresh.notes||[])] })); setApptTs(""); }, style:{ padding:"8px 14px", background:"#8B5CF6", color:"#fff", border:"none", borderRadius:"8px", fontSize:"12px", fontWeight:"700", cursor:"pointer", whiteSpace:"nowrap" } }, "\ud83d\udcc5 Set Manually")
          ),
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
            React.createElement("button", { onClick:()=>upd(open.id,{ nextCallback:null, disposition: open.disposition==="callback" ? null : open.disposition, notes:[{ts:new Date().toISOString(),type:"note",text:"📅 Callback dismissed — returned to normal dial track."}, ...(open.notes||[])] }), style:{ marginLeft:"auto", background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:"20px", lineHeight:1 } }, "\u00d7")
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
                    React.createElement("div", { style:{ fontSize:"11pxpx", fontWeight:"700", color:"var(--t4)", letterSpacing:"0.6px", marginBottom:"4px" } }, "TRACK"),
                    React.createElement("div", { style:{ fontSize:"13px", fontWeight:"700", color:"var(--t1)" } }, TRACK_LABELS[track] || track)
                  ),
                  React.createElement("div", null,
                    React.createElement("div", { style:{ fontSize:"11pxpx", fontWeight:"700", color:"var(--t4)", letterSpacing:"0.6px", marginBottom:"4px" } }, "STEP"),
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

                // Email open stats
                (open.emailOpenCount || open.lastEmailOpenedAt) && React.createElement("div", {
                  style:{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px", padding:"8px 12px", background:"#EFF6FF", borderRadius:"8px", border:"1px solid var(--blue-mid)" }
                },
                  React.createElement("span", { style:{ fontSize:"16px" } }, "📬"),
                  React.createElement("div", null,
                    React.createElement("div", { style:{ fontSize:"11px", fontWeight:"800", color:"var(--blue)", letterSpacing:"0.5px" } },
                      `${open.emailOpenCount || 0} open${(open.emailOpenCount || 0) !== 1 ? "s" : ""} tracked`
                    ),
                    open.lastEmailOpenedAt && React.createElement("div", { style:{ fontSize:"11px", color:"var(--t3)", marginTop:"2px" } },
                      "Last: " + new Date(open.lastEmailOpenedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})
                    )
                  )
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
                  React.createElement("div", { style:{ fontSize:"11pxpx", fontWeight:"700", color:"var(--t4)", letterSpacing:"0.6px", marginBottom:"6px" } }, "CHANGE TRACK"),
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
                  React.createElement("div", { style:{ fontSize:"11pxpx", fontWeight:"700", color:"var(--t4)", letterSpacing:"0.6px", marginBottom:"6px" } }, "EXIT SEQUENCE"),
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
            React.createElement(AppEconomicsCard, { lead: open, upd }),
            React.createElement(UnderwritingCard, {
              lead:open, key:"uw-cp-"+open.id,
              upd, newReqText, setNewReqText,
              initUWReqs, toggleUWReq, removeUWReq, addUWReq,
            })
          )
        )
      )
    );
    }

    export { StageStepper, UnderwritingCard };
