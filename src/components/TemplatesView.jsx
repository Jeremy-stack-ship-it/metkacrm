// ── TEMPLATES VIEW ────────────────────────────────────────────────
import React from 'react';
import { inp } from '../constants.js';

export default function TemplatesView({
  templates,
  newTemplateName, setNewTemplateName,
  newTemplateText, setNewTemplateText,
  addTemplate, deleteTemplate,
}) {
  return React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"32px",background:"var(--surface-2)"}},
    React.createElement("div",{style:{maxWidth:"860px",margin:"0 auto"}},
      React.createElement("h2",{style:{fontSize:"20px",fontWeight:"800",marginBottom:"8px",color:"var(--t1)",fontFamily:"'Syne',sans-serif"}},"💬 Messaging"),
      React.createElement("div",{style:{background:"var(--navy)",border:"1px solid var(--navy-3)",borderRadius:"16px",padding:"32px",marginBottom:"28px",textAlign:"center"}},
        React.createElement("div",{style:{fontSize:"36px",marginBottom:"12px"}},"📨"),
        React.createElement("div",{style:{fontSize:"16px",fontWeight:"800",color:"#e2e8f0",fontFamily:"'Syne',sans-serif",marginBottom:"8px"}},"Twilio Messaging — ✅ A2P Approved · Live"),
        React.createElement("div",{style:{fontSize:"13px",color:"#64748b",fontWeight:"500",lineHeight:"1.6",maxWidth:"380px",margin:"0 auto"}},"Two-way SMS is LIVE — manual sends from any lead, reply threads in 💬 SMS, STOP opt-outs honored automatically. Automated SMS stays off (Funnel deconfliction). These templates feed the quick-send chips."),
        React.createElement("div",{style:{marginTop:"16px",display:"flex",gap:"10px",justifyContent:"center"}},
          React.createElement("div",{style:{padding:"8px 18px",background:"var(--navy-3)",borderRadius:"20px",fontSize:"11px",fontWeight:"700",color:"#94a3b8",letterSpacing:"0.5px"}},"Send Campaigns"),
          React.createElement("div",{style:{padding:"8px 18px",background:"var(--navy-3)",borderRadius:"20px",fontSize:"11px",fontWeight:"700",color:"#94a3b8",letterSpacing:"0.5px"}},"Reply Threads"),
          React.createElement("div",{style:{padding:"8px 18px",background:"var(--navy-3)",borderRadius:"20px",fontSize:"11px",fontWeight:"700",color:"#94a3b8",letterSpacing:"0.5px"}},"Opt-Out Tracking")
        )
      ),
      React.createElement("h2",{style:{fontSize:"16px",fontWeight:"800",marginBottom:"16px",color:"var(--t1)",fontFamily:"'Syne',sans-serif"}},"SMS Templates"),
      React.createElement("div",{style:{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px",marginBottom:"32px",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
        React.createElement("h3",{style:{fontSize:"14px",fontWeight:"700",marginBottom:"16px",color:"var(--t1)"}},"Add New Template"),
        React.createElement("input",{placeholder:"Template Name",value:newTemplateName,onChange:e=>setNewTemplateName(e.target.value),style:{...inp(),width:"100%",marginBottom:"12px",boxSizing:"border-box",padding:"12px 14px",fontSize:"13px"}}),
        React.createElement("textarea",{placeholder:"Message text (use {first_name}, {callback_time}, {your_number})",value:newTemplateText,onChange:e=>setNewTemplateText(e.target.value),style:{...inp(),width:"100%",minHeight:"100px",marginBottom:"14px",resize:"vertical",boxSizing:"border-box",lineHeight:"1.6",padding:"12px 14px",fontSize:"13px"}}),
        React.createElement("button",{onClick:addTemplate,style:{padding:"10px 22px",background:"var(--green)",color:"#fff",border:"none",borderRadius:"8px",fontSize:"13px",fontWeight:"700",cursor:"pointer"}},"Add Template →")
      ),
      React.createElement("h3",{style:{fontSize:"11px",fontWeight:"800",marginBottom:"16px",color:"var(--t2)",letterSpacing:"1px"}},"TEMPLATES ("+Object.keys(templates).length+")"),
      React.createElement("div",{style:{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"16px",overflow:"hidden",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
        React.createElement("table",{style:{width:"100%",borderCollapse:"collapse"}},
          React.createElement("thead",null,
            React.createElement("tr",{style:{background:"var(--surface-2)",borderBottom:"1px solid var(--border)"}},
              ["Name","Preview",""].map(h=>React.createElement("th",{key:h,style:{padding:"14px 20px",textAlign:h===""?"right":"left",fontSize:"11pxpx",fontWeight:"800",color:"var(--t3)",letterSpacing:"1px"}},h))
            )
          ),
          React.createElement("tbody",null,
            Object.entries(templates).map(([key,t])=>
              React.createElement("tr",{key:key,style:{borderBottom:"1px solid var(--border)"}},
                React.createElement("td",{style:{padding:"16px 20px",fontSize:"14px",fontWeight:"700",color:"var(--blue)"}},""+t.name),
                React.createElement("td",{style:{padding:"16px 20px",fontSize:"13px",color:"var(--t2)",maxWidth:"340px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:"500"}},""+t.text),
                React.createElement("td",{style:{padding:"16px 20px",textAlign:"right"}},
                  React.createElement("button",{onClick:()=>deleteTemplate(key),style:{padding:"6px 14px",background:"var(--red-dim)",color:"var(--red)",border:"1px solid #FCA5A5",borderRadius:"6px",fontSize:"12px",fontWeight:"700",cursor:"pointer"}},"Delete")
                )
              )
            )
          )
        )
      )
    )
  );
}
