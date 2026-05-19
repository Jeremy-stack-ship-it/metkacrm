// ── CONTACTS VIEW ─────────────────────────────────────────────────
import React from 'react';
import { STAGES, DISPS, BC, BL, isUWStuck, daysInUW, inp } from '../constants.js';

export default function ContactsView({
  leads,
  searchQuery, setSearchQuery,
  showFilters, setShowFilters,
  filterBucket, setFilterBucket,
  filterStage, setFilterStage,
  filterDisp, setFilterDisp,
  filterState, setFilterState,
  filterTimezone, setFilterTimezone,
  filterMonth, setFilterMonth,
  exclBucket, setExclBucket,
  exclStage, setExclStage,
  exclDisp, setExclDisp,
  filteredContacts, paginatedContacts,
  page, setPage, totalPages, ITEMS_PER_PAGE,
  availableMonths,
  queueMode, setQueueMode,
  setSession, setSessionPaused,
  setOpenId, setPrevView, setView, setDetailTab,
  dialLead, useTwilioCalling, twilioDevice,
  upd, saveLeads,
}) {
  return React.createElement("div",{style:{flex:1, display:"flex", flexDirection:"column", background:"var(--surface-2)", overflow:"hidden"}},
    // ── FILTER BAR ──
    React.createElement("div",{style:{padding:"14px 20px",background:"var(--surface)",borderBottom:"1px solid var(--border)"}},
      React.createElement("div",{style:{display:"flex",gap:"10px",alignItems:"center",marginBottom:showFilters?"10px":"0"}},
        React.createElement("input",{
          placeholder:"Search name, phone, email, city...",
          value:searchQuery,
          onChange:e=>setSearchQuery(e.target.value),
          style:{...inp(),flex:1,padding:"9px 14px",fontSize:"13px"}
        }),
        React.createElement("button",{
          onClick:()=>setShowFilters(v=>!v),
          style:{
            padding:"9px 16px",borderRadius:"var(--radius-md)",fontWeight:"700",fontSize:"12px",cursor:"pointer",whiteSpace:"nowrap",
            border:"1px solid var(--border)",
            background:(filterBucket!=="all"||filterStage!=="all"||filterDisp!=="all"||filterState!=="all"||filterTimezone!=="all"||filterMonth!=="all")?"var(--blue)":"var(--surface-2)",
            color:(filterBucket!=="all"||filterStage!=="all"||filterDisp!=="all"||filterState!=="all"||filterTimezone!=="all"||filterMonth!=="all")?"#fff":"var(--t2)"
          }
        },(()=>{const a=[filterBucket,filterStage,filterDisp,filterState,filterTimezone,filterMonth].filter(v=>v!=="all").length;return(showFilters?"▲ ":"▼ ")+"Filters"+(a>0?" ("+a+")":"");})()),
        React.createElement("button",{
          onClick:()=>setQueueMode(q=>!q),
          style:{padding:"9px 16px",borderRadius:"var(--radius-md)",fontWeight:"700",fontSize:"12px",cursor:"pointer",border:"none",whiteSpace:"nowrap",
            background:queueMode?"#2563EB":"var(--surface-2)",color:queueMode?"#fff":"var(--t2)",
            boxShadow:queueMode?"0 0 0 2px #2563EB44":"none",transition:"all 0.2s"}
        },queueMode?"🎯 QUEUE ON":"🎯 QUEUE"),
        (searchQuery||filterBucket!=="all"||filterStage!=="all"||filterDisp!=="all"||filterState!=="all"||filterTimezone!=="all"||filterMonth!=="all")&&React.createElement("button",{
          onClick:()=>{setSearchQuery("");setFilterBucket("all");setFilterStage("all");setFilterDisp("all");setFilterState("all");setFilterTimezone("all");setFilterMonth("all");setPage(1);},
          style:{padding:"9px 14px",borderRadius:"var(--radius-md)",fontWeight:"700",fontSize:"12px",cursor:"pointer",border:"1px solid #FCA5A5",background:"var(--red-dim)",color:"var(--red)",whiteSpace:"nowrap"}
        },"✕ Clear"),
        React.createElement("button",{
          onClick:()=>{
            if(filteredContacts.length===0){alert("No leads match current filters.");return;}
            const ids=filteredContacts.map(l=>l.id);
            const s={ids,idx:0,total:ids.length,startedAt:new Date().toISOString()};
            setSession(s); setSessionPaused(false);
            try{localStorage.setItem('metka-session-v1',JSON.stringify(s));}catch{}
            setOpenId(ids[0]); setView("dial"); setDetailTab("live");
          },
          style:{padding:"9px 16px",borderRadius:"var(--radius-md)",fontWeight:"700",fontSize:"12px",cursor:"pointer",border:"none",whiteSpace:"nowrap",
            background:"var(--green)",color:"#fff",transition:"all 0.2s"}
        },"▶ Start Session"),
        React.createElement("div",{style:{fontSize:"11px",color:"var(--t3)",fontWeight:"600",whiteSpace:"nowrap"}},filteredContacts.length.toLocaleString()+" leads"+(queueMode?" · priority":""))
      ),
      showFilters&&React.createElement("div",{style:{display:"flex",gap:"8px",flexWrap:"wrap"}},
        React.createElement("select",{value:filterBucket,onChange:e=>setFilterBucket(e.target.value),style:{...inp(),padding:"8px 10px",fontSize:"12px",fontWeight:"600"}},
          React.createElement("option",{value:"all"},"All Buckets"),
          ["A","B","C"].map(b=>React.createElement("option",{key:b,value:b},BL[b]))
        ),
        React.createElement("select",{value:filterStage,onChange:e=>setFilterStage(e.target.value),style:{...inp(),padding:"8px 10px",fontSize:"12px",fontWeight:"600"}},
          React.createElement("option",{value:"all"},"All Stages"),
          STAGES.map(s=>React.createElement("option",{key:s.id,value:s.id},s.label))
        ),
        React.createElement("select",{value:filterDisp,onChange:e=>setFilterDisp(e.target.value),style:{...inp(),padding:"8px 10px",fontSize:"12px",fontWeight:"600"}},
          React.createElement("option",{value:"all"},"All Dispositions"),
          DISPS.map(d=>React.createElement("option",{key:d.id,value:d.id},d.label))
        ),
        React.createElement("select",{value:filterState,onChange:e=>setFilterState(e.target.value),style:{...inp(),padding:"8px 10px",fontSize:"12px",fontWeight:"600"}},
          React.createElement("option",{value:"all"},"All States"),
          [...new Set(leads.map(l=>(l.state||"").toUpperCase()).filter(Boolean))].sort().map(s=>React.createElement("option",{key:s,value:s},s))
        ),
        React.createElement("select",{value:filterTimezone,onChange:e=>setFilterTimezone(e.target.value),style:{...inp(),padding:"8px 10px",fontSize:"12px",fontWeight:"600"}},
          React.createElement("option",{value:"all"},"All Timezones"),
          ["ET","CT","MT","PT"].map(tz=>React.createElement("option",{key:tz,value:tz},tz))
        ),
        React.createElement("select",{value:filterMonth,onChange:e=>setFilterMonth(e.target.value),style:{...inp(),padding:"8px 10px",fontSize:"12px",fontWeight:"600"}},
          React.createElement("option",{value:"all"},"All Months"),
          availableMonths.map(m=>{const[yr,mo]=m.split("-");const label=new Date(+yr,+mo-1,1).toLocaleString("default",{month:"long",year:"numeric"});return React.createElement("option",{key:m,value:m},label);})
        ),
        React.createElement("div",{style:{width:"100%",display:"flex",gap:"8px",flexWrap:"wrap",paddingTop:"8px",borderTop:"1px dashed var(--border)",marginTop:"4px",alignItems:"center"}},
          React.createElement("span",{style:{fontSize: "11px",fontWeight:"800",color:"var(--red)",letterSpacing:"1px",whiteSpace:"nowrap"}},"≠ EXCLUDE:"),
          React.createElement("select",{value:exclBucket,onChange:e=>setExclBucket(e.target.value),style:{...inp(),padding:"6px 8px",fontSize:"11px",fontWeight:"600",color:"var(--red)",border:"1px solid #FCA5A5"}},
            React.createElement("option",{value:"none"},"Bucket"),
            ["A","B","C"].map(b=>React.createElement("option",{key:b,value:b},"≠ "+BL[b]))
          ),
          React.createElement("select",{value:exclStage,onChange:e=>setExclStage(e.target.value),style:{...inp(),padding:"6px 8px",fontSize:"11px",fontWeight:"600",color:"var(--red)",border:"1px solid #FCA5A5"}},
            React.createElement("option",{value:"none"},"Stage"),
            STAGES.map(s=>React.createElement("option",{key:s.id,value:s.id},"≠ "+s.label))
          ),
          React.createElement("select",{value:exclDisp,onChange:e=>setExclDisp(e.target.value),style:{...inp(),padding:"6px 8px",fontSize:"11px",fontWeight:"600",color:"var(--red)",border:"1px solid #FCA5A5"}},
            React.createElement("option",{value:"none"},"Disposition"),
            DISPS.map(d=>React.createElement("option",{key:d.id,value:d.id},"≠ "+d.label))
          ),
          (exclBucket!=="none"||exclStage!=="none"||exclDisp!=="none")&&React.createElement("button",{onClick:()=>{setExclBucket("none");setExclStage("none");setExclDisp("none");},style:{padding:"5px 10px",fontSize:"11px",fontWeight:"700",background:"var(--red-dim)",color:"var(--red)",border:"1px solid #FCA5A5",borderRadius:"6px",cursor:"pointer"}},"Clear ≠")
        ),
        React.createElement("button",{
          onClick:()=>{const emailList=window.prompt("Paste opener email list (one per line or comma-separated):");if(!emailList)return;const openers=new Set(emailList.split(/[\n,]+/).map(e=>e.trim().toLowerCase()).filter(Boolean));let matched=0;const updated=leads.map(l=>{if(l.email&&openers.has(l.email.toLowerCase())){matched++;return{...l,emailOpener:true};}return l;});saveLeads(updated);alert(matched+" leads flagged as Email Openers.");},
          style:{padding:"8px 14px",borderRadius:"var(--radius-md)",fontWeight:"700",fontSize:"12px",cursor:"pointer",border:"1px solid var(--amber)",background:"var(--amber-dim)",color:"var(--amber)",whiteSpace:"nowrap"}
        },"📧 Flag Openers")
      )
    ),
    // Data Table
    React.createElement("div",{style:{flex:1, overflowY:"auto", padding:"24px"}},
       React.createElement("table", {style:{width:"100%", background:"var(--surface)", borderCollapse:"collapse", borderRadius:"12px", overflow:"hidden", border:"1px solid var(--border)", boxShadow:"0 4px 16px rgba(0,0,0,0.04)"}},
         React.createElement("thead", null,
           React.createElement("tr", {style: {background: "var(--surface-2)", borderBottom: "1px solid var(--border)", textAlign: "left"}},
              ["NAME", "PHONE", "LOCATION", "BUCKET", "STAGE", "DISPOSITION"].map(h =>
                React.createElement("th", {key: h, style: {padding: "14px 20px", fontSize: "11px", fontWeight: "800", color: "var(--t3)", letterSpacing: "0.06em"}}, h)
              )
           )
         ),
         React.createElement("tbody", null,
           paginatedContacts.map((lead, _qi) => {
             const stageObj = STAGES.find(s => s.id === lead.stage) || STAGES[0];
             const dispObj = DISPS.find(d => d.id === lead.disposition) || DISPS[0];
             const stuck = isUWStuck(lead);
             const _gi = (page - 1) * ITEMS_PER_PAGE + _qi + 1;
             const _now2 = Date.now();
             const _lc = lead.lastContact ? new Date(lead.lastContact).getTime() : 0;
             const _ms = _lc ? _now2 - _lc : Infinity;
             const _due = queueMode && lead.bucket === "A" && _lc > 0 && _ms >= 172800000;
             const _undialed = queueMode && lead.disposition === "not_called";
             const _cbod = lead.nextCallback && new Date(lead.nextCallback).getTime() <= _now2;
             return React.createElement("tr", {
               key: lead.id,
               className: "contact-row",
               onClick: () => { setPrevView("contacts"); setOpenId(lead.id); setView("contact"); },
               style: {borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "0.15s",
                 background: queueMode && _gi <= 3 ? "rgba(37,99,235,0.04)" : undefined}
             },
               React.createElement("td", {style: {padding: "14px 20px", fontSize: "14px", fontWeight: "700", color: "var(--t1)"}},
                 queueMode && React.createElement("span",{style:{marginRight:"8px",fontSize: "11px",padding:"2px 7px",borderRadius:"var(--radius-pill)",background:"var(--surface-2)",color:"var(--t3)",fontWeight:"800",fontFamily:"monospace"}},"#"+_gi),
                 lead.name,
                 stuck && React.createElement("span",{style:{marginLeft:"8px",fontSize: "11px",padding:"2px 8px",borderRadius:"var(--radius-pill)",background:"var(--red-dim)",color:"var(--red)",fontWeight:"800",border:"1px solid #FCA5A5"}}, "⚠ UW " + daysInUW(lead) + "d"),
                 _cbod && React.createElement("span",{style:{marginLeft:"6px",fontSize: "11px",padding:"2px 7px",borderRadius:"var(--radius-pill)",background:"#FEF9C3",color:"#CA8A04",fontWeight:"800"}},"📞 CB OD"),
                 _due && React.createElement("span",{style:{marginLeft:"6px",fontSize: "11px",padding:"2px 7px",borderRadius:"var(--radius-pill)",background:"#FEE2E2",color:"#DC2626",fontWeight:"800"}},"🔴 DUE"),
                 _undialed && !_due && React.createElement("span",{style:{marginLeft:"6px",fontSize: "11px",padding:"2px 7px",borderRadius:"var(--radius-pill)",background:"#ECFDF5",color:"#059669",fontWeight:"800"}},"● NEW"),
                 lead.emailOpener && React.createElement("span",{style:{marginLeft:"6px",fontSize: "11px",padding:"2px 7px",borderRadius:"var(--radius-pill)",background:"var(--amber-dim)",color:"var(--amber)",fontWeight:"800",border:"1px solid var(--amber)"}},"📧 OPENER")
               ),
               // Dial — Twilio if enabled, tel: fallback
               React.createElement("td", {style: {padding: "14px 20px"}},
                  React.createElement("a", {
                    href: (useTwilioCalling && twilioDevice) ? "#" : "tel:" + lead.phone.replace(/\D/g, ''),
                    onClick: e => { e.stopPropagation(); e.preventDefault(); dialLead(lead); },
                    style: {textDecoration:"none", fontSize: "13px", color: "var(--blue)", fontFamily: "'JetBrains Mono', monospace", fontWeight: "500"}
                  }, lead.phone)
               ),
               React.createElement("td", {style: {padding: "14px 20px", fontSize: "13px", color: "var(--t2)", fontWeight: "500"}}, lead.city ? `${lead.city}, ${lead.state}` : lead.state),
               React.createElement("td", {style: {padding: "14px 20px"}},
                  React.createElement("span", {style: {fontSize: "11px", padding: "4px 10px", borderRadius: "var(--radius-pill)", background: BC[lead.bucket]+"18", color: BC[lead.bucket], fontWeight: "800"}}, BL[lead.bucket])
               ),
               React.createElement("td", {style: {padding: "14px 20px"}},
                  React.createElement("span", {style: {fontSize: "11px", padding: "4px 10px", borderRadius: "var(--radius-pill)", background: stageObj.color+"18", color: stageObj.color, fontWeight: "700"}}, stageObj.label)
               ),
               React.createElement("td", {style: {padding: "14px 20px"}},
                  React.createElement("span", {style: {fontSize: "11px", padding: "4px 10px", borderRadius: "var(--radius-pill)", background: dispObj.color+"18", color: dispObj.color, fontWeight: "700"}}, dispObj.label)
               )
             );
           }),
           filteredContacts.length === 0 && React.createElement("tr", null,
             React.createElement("td", {colSpan: "6", style: {padding: "40px", textAlign: "center", fontSize: "14px", color: "var(--t3)", fontWeight: "500"}}, "No contacts match your filters.")
           )
         )
       ),
      totalPages > 1 && React.createElement("div", {style: {display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderTop: "1px solid var(--border)", marginTop: "12px"}},
         React.createElement("button", {onClick: () => setPage(p => Math.max(1, p - 1)), disabled: page === 1, style: {padding: "8px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: page === 1 ? "transparent" : "var(--surface)", color: page === 1 ? "var(--t4)" : "var(--t2)", cursor: page === 1 ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: "600"}}, "← Previous"),
         React.createElement("span", {style: {fontSize: "12px", color: "var(--t3)", fontWeight: "600"}}, `Page ${page} of ${totalPages}`),
         React.createElement("button", {onClick: () => setPage(p => Math.min(totalPages, p + 1)), disabled: page === totalPages, style: {padding: "8px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: page === totalPages ? "transparent" : "var(--surface)", color: page === totalPages ? "var(--t4)" : "var(--t2)", cursor: page === totalPages ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: "600"}}, "Next →")
       )
    )
  );
}
