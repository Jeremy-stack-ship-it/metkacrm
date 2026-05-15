// ── PIPELINE VIEW ─────────────────────────────────────────────────
import React from 'react';
import { STAGES, DISPS, BC, BL, isUWStuck, daysInUW, reqStats, currency,
         UW_VISIBLE_STAGES, UW_ACTIVE_STAGES } from '../constants.js';

export default function PipelineView({
  leads,
  useTwilioCalling, twilioDevice,
  dialLead,
  setPrevView, setOpenId, setView, setDetailTab,
  upd,
}) {
  return React.createElement("div",{style:{flex:1,overflowX:"auto",display:"flex",padding:"24px",gap:"16px",background:"var(--surface-2)"}},
    STAGES.map(stage=>{
      const TERMINAL_DISPS = ['dnc','not_interested','invalid','archive'];
      const sl=leads.filter(l=>l.stage===stage.id && !TERMINAL_DISPS.includes(l.disposition));
      const stuckCount = sl.filter(l=>isUWStuck(l)).length;
      return React.createElement("div",{key:stage.id,style:{minWidth:"230px",maxWidth:"230px",display:"flex",flexDirection:"column"}},
        React.createElement("div",{style:{padding:"14px 16px",background:"var(--surface)",borderTop:`4px solid ${stage.color}`,border:"1px solid var(--border)",borderTopWidth:"4px",borderRadius:"12px 12px 0 0",borderBottom:"none"}},
          React.createElement("div",{style:{fontSize:"10px",fontWeight:"800",color:stage.color,letterSpacing:"1.2px",textTransform:"uppercase",marginBottom:"6px"}},""+stage.label),
          React.createElement("div",{style:{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:"8px"}},
            React.createElement("div",{style:{fontSize:"32px",fontWeight:"800",color:stage.color,lineHeight:1,fontFamily:"'Syne',sans-serif"}},""+sl.length),
            stuckCount > 0 && React.createElement("div",{style:{fontSize:"10px",fontWeight:"800",padding:"3px 8px",borderRadius:"20px",background:"var(--red-dim)",color:"var(--red)",border:"1px solid #FCA5A5"}}, "⚠ " + stuckCount + " stuck")
          )
        ),
        React.createElement("div",{style:{flex:1,overflowY:"auto",background:"#E9E7E1",border:"1px solid var(--border)",borderTop:"none",borderRadius:"0 0 12px 12px",padding:"10px"}},
          sl.map(lead=>{
            const disp=DISPS.find(d=>d.id===lead.disposition)||DISPS[0];
            const isOD=lead.nextCallback&&new Date(lead.nextCallback)<new Date();
            const stuck = isUWStuck(lead);
            const showUW = UW_VISIBLE_STAGES.includes(lead.stage);
            const reqs = reqStats(lead);
            const days = daysInUW(lead);
            return React.createElement("div",{
              key:lead.id,
              onClick:()=>{setPrevView("pipeline");setOpenId(lead.id);setView("contact");setDetailTab("activity");},
              style:{background:"var(--surface)",border:"1px solid "+(stuck?"#FCA5A5":"var(--border)"),borderLeft:`4px solid ${stuck?"var(--red)":BC[lead.bucket]}`,borderRadius:"10px",padding:"12px 14px",marginBottom:"10px",cursor:"pointer",transition:"transform 0.1s ease",boxShadow:"0 2px 8px rgba(0,0,0,0.03)"}
            },
              React.createElement("div",{style:{fontSize:"13px",fontWeight:"700",color:"var(--t1)",marginBottom:"4px"}},""+lead.name),
              // Dial — Twilio if enabled, tel: fallback
              React.createElement("a",{
                href: (useTwilioCalling && twilioDevice) ? "#" : "tel:" + lead.phone.replace(/\D/g, ''),
                onClick: e => { e.stopPropagation(); e.preventDefault(); dialLead(lead); },
                style:{display:"block",textDecoration:"none",fontSize:"11px",color:"var(--blue)",marginBottom:"6px",fontFamily:"'JetBrains Mono',monospace",fontWeight:"500"}
              },""+lead.phone),
              lead.leadType&&React.createElement("div",{style:{fontSize:"10px",color:"var(--t3)",marginBottom:"6px"}},""+lead.leadType+(currency(lead.loanAmount)?" · "+currency(lead.loanAmount):"")),
              // UW details strip (only for UW-visible stages)
              showUW && (lead.carrier || lead.expectedPremium || reqs.hasAny || days !== null) && React.createElement("div",{
                style:{marginTop:"6px",paddingTop:"6px",borderTop:"1px dashed var(--border)",display:"flex",flexDirection:"column",gap:"3px"}
              },
                lead.carrier && React.createElement("div",{style:{fontSize:"10px",color:"var(--t2)",fontWeight:"700"}}, "🛡 " + lead.carrier + (lead.policyNumber?" · #"+lead.policyNumber:"")),
                lead.expectedPremium && React.createElement("div",{style:{fontSize:"10px",color:"var(--t3)",fontFamily:"'JetBrains Mono',monospace"}}, "$" + lead.expectedPremium + "/mo"),
                reqs.hasAny && React.createElement("div",{style:{fontSize:"10px",color:reqs.allDone?"var(--green)":"var(--amber)",fontWeight:"700"}}, (reqs.allDone?"✓ ":"") + reqs.done + "/" + reqs.total + " reqs"),
                UW_ACTIVE_STAGES.includes(lead.stage) && days !== null && React.createElement("div",{style:{fontSize:"10px",color:stuck?"var(--red)":"var(--t3)",fontWeight:"700"}}, (stuck?"⚠ ":"⏱ ") + days + "d in UW")
              ),
              React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginTop:"6px"}},
                React.createElement("span",{style:{fontSize:"10px",color:BC[lead.bucket],fontWeight:"800"}},""+BL[lead.bucket]),
                React.createElement("span",{style:{fontSize:"10px",color:disp.color,fontWeight:"700"}},""+disp.label)
              ),
              isOD&&React.createElement("div",{style:{marginTop:"8px",fontSize:"10px",padding:"4px 8px",borderRadius:"6px",background:"var(--red-dim)",color:"var(--red)",fontWeight:"700"}},"⚠ Overdue CB"),
              React.createElement("div",{style:{marginTop:"10px", borderTop:"1px solid var(--border)", paddingTop:"10px"}},
                React.createElement("select",{
                  value: lead.stage,
                  onClick: e => e.stopPropagation(),
                  onChange: e => upd(lead.id, {stage: e.target.value}),
                  style: { background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"6px", width:"100%", fontSize:"11px", fontWeight:"600", padding:"6px 8px", color:"var(--t2)", outline:"none", cursor:"pointer" }
                },
                  STAGES.map(s => React.createElement("option", {key: s.id, value: s.id}, "Move to: " + s.label))
                )
              )
            );
          }),
          sl.length===0&&React.createElement("div",{style:{fontSize:"12px",color:"var(--t4)",padding:"24px",textAlign:"center",fontWeight:"500"}},"Empty")
        )
      );
    })
  );
}
