// ── SETTINGS VIEW ─────────────────────────────────────────────────
import React from 'react';

export default function SettingsView({
  leads, setLeads, saveLeads,
  voiceDeviceStatus,
  useTwilioCalling, setUseTwilioCalling,
  tokenUrlDraft, setTokenUrlDraft, setTokenServiceUrl,
  notificationsEnabled, setNotificationsEnabled,
  twilioConfig, setTwilioConfig,
  twilioDraft, setTwilioDraft,
  twilioSaved, setTwilioSaved,
  financialConfig, setFinancialConfig,
  financialDraft, setFinancialDraft,
  financialSaved, setFinancialSaved,
  backfillLead, SCHED_COLS, assignSlot,
  backupNeedsAlert, backupDaysSince, backupBg, backupBorder, backupColor,
  backupExists, restoreBackup,
  templates, scripts,
  saveScripts, saveTemplates,
}) {
  return React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"32px",background:"var(--surface-2)"}},
    React.createElement("div",{style:{maxWidth:"640px",margin:"0 auto"}},
      React.createElement("h2",{style:{fontSize:"20px",fontWeight:"800",marginBottom:"24px",color:"var(--t1)",fontFamily:"'Syne',sans-serif"}},"Settings"),

      // ── PHASE LIFECYCLE ENGINE CARD ──
      React.createElement("div",{style:{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px",marginBottom:"16px",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:"15px",fontWeight:"700",color:"var(--t1)"}},"⚡ Phase Lifecycle Engine"),
            React.createElement("div",{style:{fontSize:"12px",color:"var(--t3)",marginTop:"4px",fontWeight:"500",lineHeight:"1.5"}},"Assigns P1/P2/P3/M2 phases to all leads and builds their forward dial schedules. Run this once to initialize Today's Block.")
          )
        ),
        React.createElement("div",{style:{display:"flex",gap:"10px",flexWrap:"wrap"}},
          React.createElement("button",{
            onClick:()=>{
              const unphased = leads.filter(l => !l.phase);
              if(unphased.length === 0){ alert("✅ All leads already have phases assigned."); return; }
              if(!window.confirm(`Assign phases to ${unphased.length} leads without phases?\n\nBucket A → P1/P2/P3/M2 based on age\nBucket B → M2\nBucket C → EXIT\n\nThis does NOT overwrite existing phase assignments.`)) return;
              const backfilled = leads.map(l => backfillLead(l));
              setLeads(backfilled);
              saveLeads(backfilled);
              alert(`✅ Phase lifecycle activated for ${unphased.length} leads.\n\nToday's Block is now ready — tap ⚡ in the sidebar.`);
            },
            style:{padding:"10px 20px",background:"var(--blue)",color:"#fff",border:"none",borderRadius:"8px",fontSize:"13px",fontWeight:"700",cursor:"pointer"}
          },"🚀 Activate Phase System"),
          React.createElement("button",{
            onClick:()=>{
              const phased = leads.filter(l => l.phase);
              if(!window.confirm(`Clear all phase data from ${phased.length} leads?\n\nThis lets you re-run Activate Phase System with updated bucket assignments.`)) return;
              const reset = leads.map(l => {
                const cleared = {...l};
                delete cleared.phase;
                delete cleared.phase_start;
                delete cleared.next_dial;
                SCHED_COLS.forEach(k => { delete cleared[k]; });
                return cleared;
              });
              setLeads(reset);
              saveLeads(reset);
              alert("✅ Phase data cleared. Now click Activate Phase System to re-assign.");
            },
            style:{padding:"10px 20px",background:"var(--surface-2)",color:"var(--t2)",border:"1px solid var(--border)",borderRadius:"8px",fontSize:"13px",fontWeight:"600",cursor:"pointer"}
          },"↺ Reset All Phases"),

          // Balance AM/PM Slots button
          React.createElement("button",{
            onClick:()=>{
              const amCount = leads.filter(l=>(l.slot||'AM')==='AM').length;
              const pmCount = leads.filter(l=>l.slot==='PM').length;
              const freshCount = leads.filter(l=>!l.next_dial).length;
              if(!window.confirm(`Current distribution:\n• AM: ${amCount} leads\n• PM: ${pmCount} leads\n\nThis will redistribute ${freshCount} unscheduled leads ~50/50.\nLeads already scheduled by the phase engine keep their slot.\n\nProceed?`)) return;
              const rebalanced = leads.map(l => {
                // Only rebalance fresh leads — phase-scheduled leads keep their slot intact
                if (l.next_dial) return l;
                const newSlot = assignSlot({ ...l, slot: undefined });
                return { ...l, slot: newSlot };
              });
              const newAm = rebalanced.filter(l=>l.slot==='AM').length;
              const newPm = rebalanced.filter(l=>l.slot==='PM').length;
              setLeads(rebalanced);
              saveLeads(rebalanced);
              alert(`✅ Slots rebalanced.\n• AM: ${newAm} leads\n• PM: ${newPm} leads`);
            },
            style:{padding:"10px 20px",background:"var(--surface-2)",color:"var(--t2)",border:"1px solid var(--border)",borderRadius:"8px",fontSize:"13px",fontWeight:"600",cursor:"pointer"}
          },"⚖ Balance AM/PM Slots")
        ),
        React.createElement("div",{style:{marginTop:"14px",padding:"10px 14px",background:"var(--surface-2)",borderRadius:"8px",border:"1px solid var(--border)"}},
          React.createElement("div",{style:{fontSize:"11px",fontWeight:"700",color:"var(--t3)",marginBottom:"6px",letterSpacing:"0.5px"}},"PHASE SUMMARY"),
          React.createElement("div",{style:{display:"flex",gap:"16px",flexWrap:"wrap"}},
            [["P1","#3B82F6"],["P2","#8B5CF6"],["P3","#F59E0B"],["M2","#64748B"],["EXIT","#DC2626"],["None","#94A3B8"]].map(([p,c])=>{
              const count = p==="None" ? leads.filter(l=>!l.phase).length : leads.filter(l=>l.phase===p).length;
              return React.createElement("div",{key:p,style:{display:"flex",alignItems:"center",gap:"6px"}},
                React.createElement("div",{style:{width:"8px",height:"8px",borderRadius:"2px",background:c}}),
                React.createElement("span",{style:{fontSize:"11px",fontWeight:"700",color:"var(--t2)"}},""+p+": "+count)
              );
            })
          )
        )
      ),

      // ── Twilio Browser Calling Card ──
      React.createElement("div",{style:{background:"var(--surface)",border:`1px solid ${voiceDeviceStatus==='ready'?'var(--green)':voiceDeviceStatus==='error'?'var(--red)':'var(--border)'}`,borderRadius:"16px",padding:"24px",marginBottom:"16px",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:"15px",fontWeight:"700",color:"var(--t1)"}},"📞 Twilio Browser Calling"),
            React.createElement("div",{style:{fontSize:"12px",color:"var(--t3)",marginTop:"4px"}},"Dial directly from the CRM using your Twilio number"),
            React.createElement("div",{style:{fontSize:"11px",marginTop:"4px",fontWeight:"700",color:voiceDeviceStatus==='ready'?'var(--green)':voiceDeviceStatus==='error'?'var(--red)':voiceDeviceStatus==='registering'?'var(--amber)':'var(--t4)'}},
              voiceDeviceStatus==='ready'?'● Device Ready':voiceDeviceStatus==='error'?'● Connection Error — check Token URL':voiceDeviceStatus==='registering'?'● Connecting…':'● Inactive'
            )
          ),
          React.createElement("label",{style:{display:"flex",alignItems:"center",gap:"10px",cursor:"pointer"}},
            React.createElement("span",{style:{fontSize:"12px",color:"var(--t3)",fontWeight:"600"}},useTwilioCalling?"ON":"OFF (use tel: links)"),
            React.createElement("input",{
              type:"checkbox", checked:useTwilioCalling,
              onChange:(e)=>{
                const v = e.target.checked;
                setUseTwilioCalling(v);
                localStorage.setItem('metka-use-twilio-calling', String(v));
              },
              style:{width:"18px",height:"18px",accentColor:"var(--green)",cursor:"pointer"}
            })
          )
        ),
        useTwilioCalling && React.createElement("div",null,
          React.createElement("div",{style:{fontSize:"11px",fontWeight:"700",color:"var(--t3)",marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.5px"}},"Token Service URL"),
          React.createElement("div",{style:{fontSize:"11px",color:"var(--t4)",marginBottom:"8px"}},"Paste your Twilio Function URL that returns an access token (JSON: { token: '...' })"),
          React.createElement("div",{style:{display:"flex",gap:"8px"}},
            React.createElement("input",{
              type:"text", value:tokenUrlDraft, placeholder:"https://your-function-url.twil.io/token",
              onChange:(e)=>setTokenUrlDraft(e.target.value),
              style:{flex:1,padding:"10px 12px",background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:"8px",fontSize:"12px",color:"var(--t1)",fontFamily:"'JetBrains Mono',monospace"}
            }),
            React.createElement("button",{
              onClick:()=>{
                localStorage.setItem('metka-twilio-token-url', tokenUrlDraft);
                setTokenServiceUrl(tokenUrlDraft);
              },
              style:{padding:"10px 18px",background:"var(--blue)",color:"#fff",border:"none",borderRadius:"8px",fontSize:"12px",fontWeight:"700",cursor:"pointer"}
            },"Save & Connect")
          ),
          React.createElement("div",{style:{marginTop:"14px",padding:"12px",background:"var(--surface-2)",borderRadius:"8px",border:"1px solid var(--border)"}},
            React.createElement("div",{style:{fontSize:"11px",fontWeight:"700",color:"var(--t3)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.5px"}},"Setup Steps"),
            React.createElement("div",{style:{fontSize:"11px",color:"var(--t3)",lineHeight:"1.8"}},
              "1. In Twilio Console → Explore Products → Voice → TwiML Apps → create app",React.createElement("br"),
              "2. Functions → Create Function → paste the token generator code (see below)",React.createElement("br"),
              "3. Add env vars: ACCOUNT_SID, API_KEY, API_SECRET, TWIML_APP_SID",React.createElement("br"),
              "4. Copy the Function URL into the field above → Save & Connect",React.createElement("br"),
              "5. Status shows ● Device Ready when connected"
            ),
            React.createElement("details",{style:{marginTop:"10px"}},
              React.createElement("summary",{style:{fontSize:"11px",fontWeight:"700",color:"var(--blue)",cursor:"pointer"}},"View Twilio Function code to paste"),
              React.createElement("pre",{style:{fontSize:"10px",color:"var(--t3)",marginTop:"8px",overflowX:"auto",background:"var(--navy)",padding:"10px",borderRadius:"6px",lineHeight:"1.6"}},
`exports.handler = function(context, event, callback) {
  const AccessToken = Twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: context.TWIML_APP_SID,
    incomingAllow: false,
  });
  const token = new AccessToken(
    context.ACCOUNT_SID,
    context.API_KEY,
    context.API_SECRET,
    { identity: 'jeremy', ttl: 3600 }
  );
  token.addGrant(voiceGrant);
  const response = new Twilio.Response();
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Content-Type', 'application/json');
  response.setBody({ token: token.toJwt() });
  callback(null, response);
};`
              )
            )
          )
        )
      ),

      // ── SMS Notifications Card ──
      React.createElement("div",{style:{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px",marginBottom:"16px",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:"15px",fontWeight:"700",color:"var(--t1)"}},"SMS Notifications"),
            React.createElement("div",{style:{fontSize:"12px",color:"var(--t3)",marginTop:"6px",fontWeight:"500"}},"Enable alerts when replies arrive")
          ),
          React.createElement("input",{type:"checkbox",checked:notificationsEnabled,onChange:e=>setNotificationsEnabled(e.target.checked),style:{width:"20px",height:"20px",cursor:"pointer"}})
        )
      ),

      // ── Twilio Config Card (v3.0) ──
      React.createElement("div",{style:{background:"var(--surface)",border:`1px solid ${twilioConfig.accountSid?"var(--green)":"var(--border)"}`,borderRadius:"16px",padding:"24px",marginBottom:"16px",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}},
          React.createElement("div",{style:{fontSize:"15px",fontWeight:"700",color:"var(--t1)"}},"📡 Twilio Messaging"),
          twilioConfig.accountSid
            ? React.createElement("span",{style:{fontSize:"11px",fontWeight:"800",color:"var(--green)",background:"var(--green-dim)",padding:"4px 10px",borderRadius:"20px",border:"1px solid #6EE7B7"}},"CONNECTED")
            : React.createElement("span",{style:{fontSize:"11px",fontWeight:"800",color:"var(--amber)",background:"#FEF3C7",padding:"4px 10px",borderRadius:"20px",border:"1px solid #FCD34D"}},"NOT SET")
        ),
        React.createElement("div",{style:{fontSize:"12px",color:"var(--t3)",marginBottom:"18px",fontWeight:"500",lineHeight:"1.6"}},"Enter your Twilio credentials to activate two-way SMS in the Messages tab on every contact."),
        React.createElement("label",{style:{fontSize:"10px",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},"ACCOUNT SID"),
        React.createElement("input",{
          placeholder:"ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          value:twilioDraft.accountSid,
          onChange:e=>setTwilioDraft(p=>({...p,accountSid:e.target.value})),
          style:{background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:"7px",padding:"10px 14px",fontSize:"12px",color:"var(--t1)",width:"100%",marginBottom:"12px",boxSizing:"border-box",fontFamily:"'JetBrains Mono',monospace"}
        }),
        React.createElement("label",{style:{fontSize:"10px",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},"AUTH TOKEN"),
        React.createElement("input",{
          type:"password",
          placeholder:"Your Auth Token",
          value:twilioDraft.authToken,
          onChange:e=>setTwilioDraft(p=>({...p,authToken:e.target.value})),
          style:{background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:"7px",padding:"10px 14px",fontSize:"12px",color:"var(--t1)",width:"100%",marginBottom:"12px",boxSizing:"border-box",fontFamily:"'JetBrains Mono',monospace"}
        }),
        React.createElement("label",{style:{fontSize:"10px",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},"TWILIO PHONE NUMBER"),
        React.createElement("input",{
          placeholder:"+14055550001",
          value:twilioDraft.fromNumber,
          onChange:e=>setTwilioDraft(p=>({...p,fromNumber:e.target.value})),
          style:{background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:"7px",padding:"10px 14px",fontSize:"12px",color:"var(--t1)",width:"100%",marginBottom:"16px",boxSizing:"border-box",fontFamily:"'JetBrains Mono',monospace"}
        }),
        React.createElement("div",{style:{display:"flex",gap:"8px"}},
          React.createElement("button",{
            onClick:()=>{
              const cfg={accountSid:twilioDraft.accountSid.trim(),authToken:twilioDraft.authToken.trim(),fromNumber:twilioDraft.fromNumber.trim()};
              setTwilioConfig(cfg);
              try{localStorage.setItem('metka-twilio-config-v1',JSON.stringify(cfg));}catch{}
              setTwilioSaved(true);
              setTimeout(()=>setTwilioSaved(false),2500);
            },
            style:{padding:"9px 20px",background:"var(--navy)",color:"#fff",border:"none",borderRadius:"8px",fontSize:"12px",fontWeight:"700",cursor:"pointer"}
          }, twilioSaved ? "✓ Saved!" : "Save Credentials"),
          twilioConfig.accountSid && React.createElement("button",{
            onClick:()=>{
              const empty={accountSid:"",authToken:"",fromNumber:""};
              setTwilioConfig(empty); setTwilioDraft(empty);
              try{localStorage.removeItem('metka-twilio-config-v1');}catch{}
            },
            style:{padding:"9px 16px",background:"var(--red-dim)",color:"var(--red)",border:"1px solid #FCA5A5",borderRadius:"8px",fontSize:"12px",fontWeight:"700",cursor:"pointer"}
          },"Disconnect")
        )
      ),

      // ── Financial Config Card (v3.6) ──
      React.createElement("div",{style:{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px",marginBottom:"16px",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}},
          React.createElement("div",{style:{fontSize:"15px",fontWeight:"700",color:"var(--t1)"}},"💰 Financial Targets"),
          financialSaved && React.createElement("span",{style:{fontSize:"11px",fontWeight:"800",color:"var(--green)",background:"var(--green-dim)",padding:"4px 10px",borderRadius:"20px",border:"1px solid #6EE7B7"}},"SAVED ✓")
        ),
        React.createElement("div",{style:{fontSize:"12px",color:"var(--t3)",marginBottom:"18px",fontWeight:"500",lineHeight:"1.6"}},"Set your overhead, commission targets, and contract level. These drive the Financial Tracker on the Dashboard — update them as your situation changes."),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}},
          ...[
            ["MONTHLY OVERHEAD ($)","monthlyOverhead","3921","e.g. 3921"],
            ["MONTHLY NET TARGET ($)","monthlyNetNeeded","2121","e.g. 2121"],
            ["AVG PAYOUT % (of APV)","avgPayoutPct","55","e.g. 55 for 55%"],
            ["APPS GOAL (per week)","appsGoalWeek","5","e.g. 5"],
          ].map(([label,key,_def,ph]) =>
            React.createElement("div",{key},
              React.createElement("label",{style:{fontSize:"10px",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},label),
              React.createElement("input",{
                type:"number",
                placeholder:ph,
                value:financialDraft[key]||"",
                onChange:e=>setFinancialDraft(p=>({...p,[key]:Number(e.target.value)||0})),
                style:{width:"100%",padding:"10px 12px",background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:"8px",fontSize:"12px",color:"var(--t1)",boxSizing:"border-box",fontFamily:"'JetBrains Mono',monospace"}
              })
            )
          )
        ),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"16px"}},
          ...[
            ["CURRENT CONTRACT LEVEL","contractLevel","e.g. 85%"],
            ["TARGET CONTRACT LEVEL","contractTarget","e.g. 100%"],
          ].map(([label,key,ph]) =>
            React.createElement("div",{key},
              React.createElement("label",{style:{fontSize:"10px",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},label),
              React.createElement("input",{
                type:"text",
                placeholder:ph,
                value:financialDraft[key]||"",
                onChange:e=>setFinancialDraft(p=>({...p,[key]:e.target.value})),
                style:{width:"100%",padding:"10px 12px",background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:"8px",fontSize:"12px",color:"var(--t1)",boxSizing:"border-box",fontFamily:"'JetBrains Mono',monospace"}
              })
            )
          )
        ),
        React.createElement("button",{
          onClick:()=>{
            setFinancialConfig({...financialDraft});
            try{localStorage.setItem('metka-financial-config-v1',JSON.stringify(financialDraft));}catch{}
            setFinancialSaved(true);
            setTimeout(()=>setFinancialSaved(false),2500);
          },
          style:{padding:"10px 24px",background:"var(--navy)",color:"#fff",border:"none",borderRadius:"8px",fontSize:"13px",fontWeight:"700",cursor:"pointer"}
        },"Save Financial Config")
      ),

      // ── Data Management Card ──
      React.createElement("div",{style:{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
        React.createElement("div",{style:{fontSize:"15px",fontWeight:"700",color:"var(--t1)",marginBottom:"16px"}},"Data Management"),
        backupNeedsAlert && React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"10px",padding:"12px 16px",background:backupBg,border:"1px solid "+backupBorder,borderRadius:"10px",marginBottom:"16px"}},
          React.createElement("span",{style:{fontSize:"20px",lineHeight:1}},backupDaysSince===null?"🔴":backupDaysSince>=14?"🔴":"🟡"),
          React.createElement("div",{style:{flex:1}},
            React.createElement("div",{style:{fontSize:"12px",fontWeight:"800",color:backupColor}},
              backupDaysSince===null ? "NO BACKUP ON RECORD" : backupDaysSince+" DAYS SINCE LAST BACKUP"
            ),
            React.createElement("div",{style:{fontSize:"11px",color:"#92400E",marginTop:"2px"}},"Export JSON below and save to OneDrive. Takes 5 seconds.")
          )
        ),
        !backupNeedsAlert && React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px",background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:"10px",marginBottom:"16px"}},
          React.createElement("span",{style:{fontSize:"16px"}},"✅"),
          React.createElement("span",{style:{fontSize:"11px",fontWeight:"700",color:"#15803D"}},"Backed up "+backupDaysSince+" day"+(backupDaysSince===1?"":"s")+" ago — next due in "+(7-backupDaysSince)+" day"+(7-backupDaysSince===1?"":"s"))
        ),
        React.createElement("div",{style:{display:"flex",gap:"12px",flexWrap:"wrap"}},
          React.createElement("button",{onClick:()=>{const data={leads,templates,scripts};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`metka-backup-${new Date().toISOString().split("T")[0]}.json`;a.click();URL.revokeObjectURL(url);try{localStorage.setItem('metka-last-export-v1',new Date().toISOString());}catch{}},style:{padding:"10px 22px",background:"var(--green-dim)",color:"var(--green)",border:"1px solid #6EE7B7",borderRadius:"8px",fontSize:"13px",fontWeight:"700",cursor:"pointer"}},"📥 Export JSON"),
          React.createElement("label",{style:{padding:"10px 22px",background:"var(--sky-dim)",color:"var(--sky)",border:"1px solid #BAE6FD",borderRadius:"8px",fontSize:"13px",fontWeight:"700",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"6px"}},
            "📂 Restore JSON",
            React.createElement("input",{type:"file",accept:".json",style:{display:"none"},onChange:ev=>{
              const file=ev.target.files?.[0]; if(!file) return;
              const rd=new FileReader();
              rd.onload=e2=>{
                try{
                  const data=JSON.parse(e2.target.result);
                  const restored=Array.isArray(data)?data:(data.leads||[]);
                  if(!Array.isArray(restored)||restored.length===0) throw new Error("No leads found");
                  if(window.confirm("Restore "+restored.length+" leads? Replaces current data.")){
                    saveLeads(restored);
                    if(data.scripts) saveScripts(data.scripts);
                    if(data.templates) saveTemplates(data.templates);
                    alert("Restored "+restored.length+" leads successfully.");
                  }
                }catch(err){ alert("Invalid JSON: "+err.message); }
              };
              rd.readAsText(file); ev.target.value="";
            }})
          ),
          backupExists && React.createElement("button",{
            onClick:()=>{ if(window.confirm("Restore your pre-import backup? This will replace current leads.")) restoreBackup(); },
            style:{padding:"10px 22px",background:"var(--amber-dim)",color:"var(--amber)",border:"1px solid var(--amber)",borderRadius:"8px",fontSize:"13px",fontWeight:"700",cursor:"pointer"}
          },"↩ Restore Pre-Import Backup"),
          React.createElement("button",{onClick:()=>{if(confirm("WIPE ALL LEADS? This cannot be undone.\n\nExport a backup first.")){saveLeads([]);alert("All leads cleared. Ready for fresh import.");}},style:{padding:"10px 22px",background:"var(--red-dim)",color:"var(--red)",border:"1px solid #FCA5A5",borderRadius:"8px",fontSize:"13px",fontWeight:"700",cursor:"pointer"}},"🗑 Wipe All Leads")
        )
      )
    )
  );
}
