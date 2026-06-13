// ── SETTINGS VIEW ─────────────────────────────────────────────────
import React from 'react';
import { ccIsConnected, ccAuthorize, ccClearTokens, ccGetLists, ccSyncLeads } from '../lib/ccIntegration.js';

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
  gmailConfig, setGmailConfig,
  gmailDraft, setGmailDraft,
  gmailSaved, setGmailSaved,
  seqConfig, setSeqConfig,
  seqDraft, setSeqDraft,
  seqSaved, setSeqSaved,
  backfillLead, SCHED_COLS, assignSlot,
  backupNeedsAlert, backupDaysSince, backupBg, backupBorder, backupColor,
  backupExists, restoreBackup,
  templates, scripts,
  saveScripts, saveTemplates,
  aiConfig, aiDraft, setAiDraft, aiSaved, setAiSaved, saveAi,
  theme, setTheme,
}) {
  // ── CONSTANT CONTACT LOCAL STATE ─────────────────────────────────────
  const [ccConnected, setCcConnected] = React.useState(() => ccIsConnected());
  const [ccLists, setCcLists] = React.useState([]);
  const [ccSelectedList, setCcSelectedList] = React.useState('');
  const [ccListsLoading, setCcListsLoading] = React.useState(false);
  const [ccSyncStatus, setCcSyncStatus] = React.useState('idle'); // idle | loading | success | error
  const [ccSyncResult, setCcSyncResult] = React.useState(null);

  // Load CC lists when connected
  React.useEffect(() => {
    if (!ccConnected) { setCcLists([]); setCcSelectedList(''); return; }
    setCcListsLoading(true);
    ccGetLists()
      .then(lists => {
        setCcLists(lists);
        if (lists.length > 0) setCcSelectedList(prev => prev || lists[0].id);
        setCcListsLoading(false);
      })
      .catch(() => setCcListsLoading(false));
  }, [ccConnected]);

  return React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"32px",background:"var(--surface-2)"}},
    React.createElement("div",{style:{maxWidth:"640px",margin:"0 auto"}},
      React.createElement("h2",{style:{fontSize:"20px",fontWeight:"800",marginBottom:"24px",color:"var(--t1)",fontFamily:"'Syne',sans-serif"}},"Settings"),

      // ── APPEARANCE CARD ───────────────────────────────────────────────
      React.createElement("div",{style:{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px",marginBottom:"16px",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:"15px",fontWeight:"700",color:"var(--t1)",marginBottom:"4px"}},"🎨 Appearance"),
            React.createElement("div",{style:{fontSize:"12px",color:"var(--t3)",lineHeight:"1.5"}},"Day mode for daylight sessions. Night mode for evening dials.")
          ),
          React.createElement("div",{style:{display:"flex",borderRadius:"8px",overflow:"hidden",border:"1px solid var(--border)"}},
            React.createElement("button",{
              onClick:()=>setTheme&&setTheme('day'),
              style:{
                padding:"8px 16px",fontSize:"12px",fontWeight:"700",cursor:"pointer",border:"none",
                background:theme!=="night"?"var(--blue)":"var(--surface-2)",
                color:theme!=="night"?"#fff":"var(--t3)",
                letterSpacing:"0.04em",transition:"background 0.15s,color 0.15s",
              }
            },"☀️ DAY"),
            React.createElement("button",{
              onClick:()=>setTheme&&setTheme('night'),
              style:{
                padding:"8px 16px",fontSize:"12px",fontWeight:"700",cursor:"pointer",
                background:theme==="night"?"var(--blue)":"var(--surface-2)",
                color:theme==="night"?"#fff":"var(--t3)",
                letterSpacing:"0.04em",transition:"background 0.15s,color 0.15s",
                border:"none",borderLeft:"1px solid var(--border)",
              }
            },"🌙 NIGHT")
          )
        )
      ),

      // ── DIAL SESSIONS CARD ───────────────────────────────────────────────
      (() => {
        const LS_SESS = 'metka-dial-sessions-v1';
        const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const defaultSessions = [
          { id:'MON_AM', day:1, label:'Monday AM',      ampm:'AM', startH:9,  startM:0,  endH:10, endM:30, active:true  },
          { id:'MON_PM', day:1, label:'Monday PM',      ampm:'PM', startH:16, startM:0,  endH:17, endM:30, active:true  },
          { id:'TUE_AM', day:2, label:'Tuesday AM',     ampm:'AM', startH:9,  startM:0,  endH:10, endM:30, active:true  },
          { id:'TUE_PM', day:2, label:'Tuesday PM',     ampm:'PM', startH:14, startM:30, endH:16, endM:0,  active:true  },
          { id:'WED_AM', day:3, label:'Wednesday AM',   ampm:'AM', startH:9,  startM:0,  endH:10, endM:30, active:true  },
          { id:'WED_PM', day:3, label:'Wednesday Late', ampm:'PM', startH:18, startM:30, endH:20, endM:0,  active:true  },
          { id:'THU_AM', day:4, label:'Thursday AM',    ampm:'AM', startH:9,  startM:0,  endH:10, endM:30, active:true  },
          { id:'THU_PM', day:4, label:'Thursday PM',    ampm:'PM', startH:16, startM:0,  endH:17, endM:30, active:true  },
          { id:'FRI_AM', day:5, label:'Friday AM',      ampm:'AM', startH:9,  startM:0,  endH:10, endM:30, active:true  },
          { id:'FRI_PM', day:5, label:'Friday PM',      ampm:'PM', startH:16, startM:0,  endH:17, endM:30, active:true  },
          { id:'SAT_AM', day:6, label:'Saturday AM',    ampm:'AM', startH:9,  startM:0,  endH:12, endM:0,  active:true  },
        ];
        const fmtT = (h, m) => { const hh = h % 12 || 12; const mm = String(m).padStart(2,'0'); return hh + ':' + mm + (h < 12 ? ' AM' : ' PM'); };
        const [sessions, setSessions] = React.useState(() => {
          try { const s = JSON.parse(localStorage.getItem(LS_SESS)); return s && s.length ? s : defaultSessions; } catch { return defaultSessions; }
        });
        const [editing, setEditing] = React.useState(null); // id of row being edited
        const [draft, setDraft]     = React.useState({});

        const save = (updated) => { setSessions(updated); localStorage.setItem(LS_SESS, JSON.stringify(updated)); };

        const startEdit = (s) => { setEditing(s.id); setDraft({ startH: s.startH, startM: s.startM, endH: s.endH, endM: s.endM }); };
        const commitEdit = (id) => {
          save(sessions.map(s => s.id === id ? { ...s, startH: +draft.startH, startM: +draft.startM, endH: +draft.endH, endM: +draft.endM } : s));
          setEditing(null);
        };
        const resetAll = () => { save(defaultSessions); setEditing(null); };

        return React.createElement("div",{style:{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px",marginBottom:"16px",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
          React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}},
            React.createElement("div",null,
              React.createElement("div",{style:{fontSize:"15px",fontWeight:"700",color:"var(--t1)",marginBottom:"4px"}},"🗓 Dial Sessions"),
              React.createElement("div",{style:{fontSize:"12px",color:"var(--t3)",lineHeight:"1.5"}},"Configure your dial block times. Used by the session strip and countdown.")
            ),
            React.createElement("button",{onClick:resetAll,style:{fontSize:"11px",fontWeight:"700",padding:"6px 12px",borderRadius:"7px",border:"1px solid var(--border)",background:"var(--surface-2)",color:"var(--t3)",cursor:"pointer"}},"Reset defaults")
          ),
          sessions.map(s =>
            React.createElement("div",{key:s.id,style:{display:"flex",alignItems:"center",gap:"10px",padding:"8px 0",borderBottom:"1px solid var(--border)"}},
              React.createElement("span",{style:{fontSize:"12px",fontWeight:"700",color:"var(--t2)",minWidth:"110px"}},[s.label]),
              editing === s.id
                ? React.createElement(React.Fragment,null,
                    React.createElement("input",{type:"number",min:0,max:23,value:draft.startH,onChange:e=>setDraft(d=>({...d,startH:e.target.value})),style:{width:"44px",padding:"4px",borderRadius:"5px",border:"1px solid var(--border)",background:"var(--surface-2)",color:"var(--t1)",fontSize:"12px",textAlign:"center"}}),
                    React.createElement("span",{style:{color:"var(--t4)",fontSize:"11px"}},"h"),
                    React.createElement("input",{type:"number",min:0,max:59,step:5,value:draft.startM,onChange:e=>setDraft(d=>({...d,startM:e.target.value})),style:{width:"44px",padding:"4px",borderRadius:"5px",border:"1px solid var(--border)",background:"var(--surface-2)",color:"var(--t1)",fontSize:"12px",textAlign:"center"}}),
                    React.createElement("span",{style:{color:"var(--t4)",fontSize:"11px"}},":m →"),
                    React.createElement("input",{type:"number",min:0,max:23,value:draft.endH,onChange:e=>setDraft(d=>({...d,endH:e.target.value})),style:{width:"44px",padding:"4px",borderRadius:"5px",border:"1px solid var(--border)",background:"var(--surface-2)",color:"var(--t1)",fontSize:"12px",textAlign:"center"}}),
                    React.createElement("span",{style:{color:"var(--t4)",fontSize:"11px"}},"h"),
                    React.createElement("input",{type:"number",min:0,max:59,step:5,value:draft.endM,onChange:e=>setDraft(d=>({...d,endM:e.target.value})),style:{width:"44px",padding:"4px",borderRadius:"5px",border:"1px solid var(--border)",background:"var(--surface-2)",color:"var(--t1)",fontSize:"12px",textAlign:"center"}}),
                    React.createElement("span",{style:{color:"var(--t4)",fontSize:"11px"}},":m"),
                    React.createElement("button",{onClick:()=>commitEdit(s.id),style:{marginLeft:"6px",fontSize:"11px",fontWeight:"700",padding:"4px 10px",borderRadius:"6px",border:"none",background:"var(--green)",color:"#fff",cursor:"pointer"}},"✓ Save"),
                    React.createElement("button",{onClick:()=>setEditing(null),style:{fontSize:"11px",fontWeight:"600",padding:"4px 8px",borderRadius:"6px",border:"1px solid var(--border)",background:"var(--surface-2)",color:"var(--t3)",cursor:"pointer"}},"Cancel")
                  )
                : React.createElement(React.Fragment,null,
                    React.createElement("span",{style:{fontSize:"12px",color:"var(--t1)",fontFamily:"'JetBrains Mono',monospace",fontWeight:"600"}}, fmtT(s.startH, s.startM) + " – " + fmtT(s.endH, s.endM)),
                    React.createElement("button",{onClick:()=>startEdit(s),style:{marginLeft:"auto",fontSize:"11px",fontWeight:"700",padding:"3px 10px",borderRadius:"6px",border:"1px solid var(--border)",background:"var(--surface-2)",color:"var(--t3)",cursor:"pointer"}},"Edit")
                  )
            )
          )
        );
      })(),

      // ── PHASE LIFECYCLE ENGINE CARD (v3.60 — DISARMED: calendar engine runs phases automatically) ──
      React.createElement("div",{style:{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px",marginBottom:"16px",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:"15px",fontWeight:"700",color:"var(--t1)"}},"⚡ Phase Lifecycle Engine — automatic"),
            React.createElement("div",{style:{fontSize:"12px",color:"var(--t3)",marginTop:"4px",fontWeight:"500",lineHeight:"1.5"}},"Phases are calendar-driven since v3.44: P1→P2→P3→M2→M3 advance on their own at every startup. The old Activate/Reset buttons were removed — resetting would fight the engine.")
          )
        ),
        React.createElement("div",{style:{display:"flex",gap:"10px",flexWrap:"wrap"}},

          // Balance AM/PM Slots button
          React.createElement("button",{
            onClick:()=>{
              const amCount = leads.filter(l=>(l.slot||'AM')==='AM').length;
              const pmCount = leads.filter(l=>l.slot==='PM').length;
              // v3.14b — date-based: odd day of month received → AM, even → PM
              const activeLeads = leads.filter(l => l.stage !== 'removed' && l.phase !== 'EXIT');
              if(!window.confirm(`Current distribution:\n• AM: ${amCount} leads\n• PM: ${pmCount} leads\n\nThis will re-slot ALL ${activeLeads.length} active leads by date received:\n  Odd day received → AM  |  Even day received → PM\nPhases and schedule dates preserved.\n\nProceed?`)) return;
              const rebalanced = leads.map(l => {
                if (l.stage === 'removed' || l.phase === 'EXIT') return l;
                const dateStr = l.created_at || l.phase_start;
                const day = dateStr ? new Date(dateStr).getDate() : (l.id ? l.id.charCodeAt(0) : 1);
                const slot = day % 2 !== 0 ? 'AM' : 'PM'; // odd → AM, even → PM
                return { ...l, slot };
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
              React.createElement("pre",{style:{fontSize:"11pxpx",color:"var(--t3)",marginTop:"8px",overflowX:"auto",background:"var(--navy)",padding:"10px",borderRadius:"6px",lineHeight:"1.6"}},
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
        React.createElement("label",{style:{fontSize:"11pxpx",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},"ACCOUNT SID"),
        React.createElement("input",{
          placeholder:"ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          value:twilioDraft.accountSid,
          onChange:e=>setTwilioDraft(p=>({...p,accountSid:e.target.value})),
          style:{background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:"7px",padding:"10px 14px",fontSize:"12px",color:"var(--t1)",width:"100%",marginBottom:"12px",boxSizing:"border-box",fontFamily:"'JetBrains Mono',monospace"}
        }),
        React.createElement("label",{style:{fontSize:"11pxpx",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},"AUTH TOKEN"),
        React.createElement("input",{
          type:"password",
          placeholder:"Your Auth Token",
          value:twilioDraft.authToken,
          onChange:e=>setTwilioDraft(p=>({...p,authToken:e.target.value})),
          style:{background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:"7px",padding:"10px 14px",fontSize:"12px",color:"var(--t1)",width:"100%",marginBottom:"12px",boxSizing:"border-box",fontFamily:"'JetBrains Mono',monospace"}
        }),
        React.createElement("label",{style:{fontSize:"11pxpx",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},"TWILIO PHONE NUMBER"),
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
              React.createElement("label",{style:{fontSize:"11pxpx",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},label),
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
              React.createElement("label",{style:{fontSize:"11pxpx",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},label),
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


      // ── GMAIL INTEGRATION CARD ──
      React.createElement("div",{style:{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px",marginBottom:"16px",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:"15px",fontWeight:"700",color:"var(--t1)"}},"✉️ Gmail / Email Integration"),
            React.createElement("div",{style:{fontSize:"12px",color:"var(--t3)",marginTop:"4px",fontWeight:"500",lineHeight:"1.5"}},"Your sending address for lead email links. Opens Gmail compose pre-filled with lead info.")
          ),
          gmailSaved && React.createElement("span",{style:{fontSize:"11px",fontWeight:"800",color:"var(--green)",background:"var(--green-dim)",padding:"4px 10px",borderRadius:"20px",border:"1px solid #6EE7B7"}},"SAVED ✓")
        ),
        React.createElement("label",{style:{fontSize:"11pxpx",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},"YOUR EMAIL ADDRESS"),
        React.createElement("input",{
          type:"email",
          placeholder:"Jeremy@metkasolutions.com",
          value: gmailDraft.address || '',
          onChange: e => setGmailDraft(d => ({...d, address: e.target.value})),
          style:{width:"100%",padding:"10px 12px",borderRadius:"8px",border:"1px solid var(--border)",background:"var(--surface-2)",color:"var(--t1)",fontSize:"13px",fontFamily:"inherit",boxSizing:"border-box",marginBottom:"14px"}
        }),
        React.createElement("label",{style:{fontSize:"11pxpx",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},"DEFAULT EMAIL SIGNATURE (optional)"),
        React.createElement("textarea",{
          placeholder:"Jeremy Metka | Senior Field Underwriter\nMinistry of Protection | NPN #21425108\n(405) 555-0000",
          value: gmailDraft.signature || '',
          onChange: e => setGmailDraft(d => ({...d, signature: e.target.value})),
          rows: 4,
          style:{width:"100%",padding:"10px 12px",borderRadius:"8px",border:"1px solid var(--border)",background:"var(--surface-2)",color:"var(--t1)",fontSize:"12px",fontFamily:"inherit",boxSizing:"border-box",resize:"vertical",marginBottom:"14px"}
        }),
        gmailDraft.address && React.createElement("div",{style:{background:"var(--surface-2)",borderRadius:"8px",padding:"10px 14px",marginBottom:"14px",fontSize:"12px",color:"var(--t3)"}},
          "📬 Email links throughout the CRM will open Gmail compose addressed to your lead, from ",
          React.createElement("strong",{style:{color:"var(--t1)"}}, gmailDraft.address)
        ),
        React.createElement("button",{
          onClick:()=>{
            const next = { address: gmailDraft.address.trim(), signature: gmailDraft.signature.trim() };
            setGmailConfig(next);
            try { localStorage.setItem('metka-gmail-config-v1', JSON.stringify(next)); } catch {}
            setGmailSaved(true);
            setTimeout(()=>setGmailSaved(false),2500);
          },
          style:{padding:"10px 24px",background:"var(--navy)",color:"#fff",border:"none",borderRadius:"8px",fontSize:"13px",fontWeight:"700",cursor:"pointer"}
        },"Save Gmail Config")
      ),

      // ── SEQUENCE ENGINE CARD (v3.18) ──
      React.createElement("div",{style:{background:"var(--surface)",border:`1px solid ${seqConfig?.appsScriptUrl?"var(--green)":"var(--border)"}`,borderRadius:"16px",padding:"24px",marginBottom:"16px",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:"15px",fontWeight:"700",color:"var(--t1)"}},"🤖 Sequence Engine"),
            React.createElement("div",{style:{fontSize:"12px",color:"var(--t3)",marginTop:"4px",fontWeight:"500",lineHeight:"1.5"}},"Automated multi-touch SMS + email drip. Powered by Twilio (SMS) and Google Apps Script (email). Runs daily at 8 AM UTC via Supabase cron.")
          ),
          seqConfig?.appsScriptUrl
            ? React.createElement("span",{style:{fontSize:"11px",fontWeight:"800",color:"var(--green)",background:"var(--green-dim)",padding:"4px 10px",borderRadius:"20px",border:"1px solid #6EE7B7"}},"ACTIVE")
            : React.createElement("span",{style:{fontSize:"11px",fontWeight:"800",color:"var(--amber)",background:"#FEF3C7",padding:"4px 10px",borderRadius:"20px",border:"1px solid #FCD34D"}},"NOT SET")
        ),

        React.createElement("label",{style:{fontSize:"11pxpx",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},"APPS SCRIPT EMAIL URL"),
        React.createElement("div",{style:{fontSize:"11px",color:"var(--t4)",marginBottom:"6px"}},"Paste your deployed Google Apps Script web app URL (from script.google.com → Deploy → Web App)"),
        React.createElement("input",{
          type:"text",
          placeholder:"https://script.google.com/macros/s/AKfyc…/exec",
          value: seqDraft?.appsScriptUrl || '',
          onChange: e => setSeqDraft(d => ({...d, appsScriptUrl: e.target.value})),
          style:{width:"100%",padding:"10px 12px",borderRadius:"8px",border:"1px solid var(--border)",background:"var(--surface-2)",color:"var(--t1)",fontSize:"12px",fontFamily:"'JetBrains Mono',monospace",boxSizing:"border-box",marginBottom:"14px"}
        }),

        React.createElement("label",{style:{fontSize:"11pxpx",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},"CALENDLY BOOKING URL"),
        React.createElement("div",{style:{fontSize:"11px",color:"var(--t4)",marginBottom:"6px"}},"Included in sequence emails as the 15-minute booking CTA. Not sent via SMS (A2P pending approval)."),
        React.createElement("input",{
          type:"text",
          placeholder:"https://calendly.com/jeremy-metkasolutions/15min",
          value: seqDraft?.calendlyUrl || '',
          onChange: e => setSeqDraft(d => ({...d, calendlyUrl: e.target.value})),
          style:{width:"100%",padding:"10px 12px",borderRadius:"8px",border:"1px solid var(--border)",background:"var(--surface-2)",color:"var(--t1)",fontSize:"13px",fontFamily:"inherit",boxSizing:"border-box",marginBottom:"14px"}
        }),

        React.createElement("label",{style:{fontSize:"11pxpx",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},"AGENT PHONE (email signature)"),
        React.createElement("input",{
          type:"text",
          placeholder:"(405) 555-0000",
          value: seqDraft?.agentPhone || '',
          onChange: e => setSeqDraft(d => ({...d, agentPhone: e.target.value})),
          style:{width:"100%",padding:"10px 12px",borderRadius:"8px",border:"1px solid var(--border)",background:"var(--surface-2)",color:"var(--t1)",fontSize:"13px",fontFamily:"inherit",boxSizing:"border-box",marginBottom:"16px"}
        }),

        React.createElement("button",{
          onClick:()=>{
            const next = {
              appsScriptUrl: (seqDraft?.appsScriptUrl || '').trim(),
              calendlyUrl:   (seqDraft?.calendlyUrl   || '').trim(),
              agentPhone:    (seqDraft?.agentPhone     || '').trim(),
            };
            setSeqConfig(next);
            try { localStorage.setItem('metka-seq-config-v1', JSON.stringify(next)); } catch {}
            setSeqSaved(true);
            setTimeout(()=>setSeqSaved(false), 2500);
          },
          style:{padding:"10px 24px",background:"var(--navy)",color:"#fff",border:"none",borderRadius:"8px",fontSize:"13px",fontWeight:"700",cursor:"pointer",marginRight:"10px"}
        }, seqSaved ? "✓ Saved!" : "Save Sequence Config"),

        React.createElement("details",{style:{marginTop:"16px"}},
          React.createElement("summary",{style:{fontSize:"11px",fontWeight:"700",color:"var(--blue)",cursor:"pointer"}},"▸ View Supabase deployment instructions"),
          React.createElement("div",{style:{marginTop:"10px",padding:"12px 14px",background:"var(--surface-2)",borderRadius:"8px",border:"1px solid var(--border)",fontSize:"11px",color:"var(--t3)",lineHeight:"1.9"}},
            "1. Deploy Apps Script: script.google.com → New project → paste Code.gs → Deploy → Web App → Execute as: Me → Who has access: Anyone → Copy URL above",React.createElement("br"),
            "2. Update AGENT_PHONE and CALENDLY constants in Code.gs before deploying",React.createElement("br"),
            "3. In Supabase CLI: ",React.createElement("code",{style:{fontFamily:"'JetBrains Mono',monospace",background:"var(--navy)",color:"#7DD3FC",padding:"1px 5px",borderRadius:"3px"}},"supabase secrets set APPS_SCRIPT_EMAIL_URL=<your-url>"),React.createElement("br"),
            "4. Set Twilio secrets: ",React.createElement("code",{style:{fontFamily:"'JetBrains Mono',monospace",background:"var(--navy)",color:"#7DD3FC",padding:"1px 5px",borderRadius:"3px"}},"supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=..."),React.createElement("br"),
            "5. Deploy functions: ",React.createElement("code",{style:{fontFamily:"'JetBrains Mono',monospace",background:"var(--navy)",color:"#7DD3FC",padding:"1px 5px",borderRadius:"3px"}},"supabase functions deploy send-sms && supabase functions deploy process-sequence"),React.createElement("br"),
            "6. Enable daily cron in Supabase SQL editor — see ",React.createElement("span",{style:{color:"var(--blue)"}}),"DEPLOY_INSTRUCTIONS.md"," in the project repo"
          )
        )
      ),

      // ── CONSTANT CONTACT INTEGRATION CARD ──
      React.createElement("div",{style:{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px",marginBottom:"16px",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:"15px",fontWeight:"700",color:"var(--t1)"}},"📧 Constant Contact Sync"),
            React.createElement("div",{style:{fontSize:"12px",color:"var(--t3)",marginTop:"4px",fontWeight:"500",lineHeight:"1.5"}},"Push Bucket A leads directly into a CC email list for drip campaigns.")
          ),
          ccConnected
            ? React.createElement("span",{style:{fontSize:"11px",fontWeight:"700",padding:"4px 10px",background:"#DCFCE7",color:"#15803D",borderRadius:"20px",border:"1px solid #86EFAC"}},"● Connected")
            : React.createElement("span",{style:{fontSize:"11px",fontWeight:"700",padding:"4px 10px",background:"var(--red-dim)",color:"var(--red)",borderRadius:"20px",border:"1px solid #FCA5A5"}},"○ Not Connected")
        ),
        !ccConnected && React.createElement("button",{
          onClick:()=>{
            // Force-clear any stale tokens or PKCE verifier before retrying
            ccClearTokens();
            try { sessionStorage.removeItem('cc_pkce_verifier'); } catch {}
            setCcSyncStatus('idle'); setCcSyncResult(null);
            ccAuthorize();
          },
          style:{padding:"10px 20px",background:"var(--blue)",color:"#fff",border:"none",borderRadius:"8px",fontSize:"13px",fontWeight:"700",cursor:"pointer",marginBottom:"12px"}
        },"🔗 Connect Constant Contact"),
        ccConnected && React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"12px"}},
          ccListsLoading && React.createElement("div",{style:{fontSize:"12px",color:"var(--t3)"}},"Loading lists…"),
          !ccListsLoading && ccLists.length > 0 && React.createElement("div",{style:{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}},
            React.createElement("label",{style:{fontSize:"12px",fontWeight:"600",color:"var(--t2)"}},"Target List:"),
            React.createElement("select",{
              value:ccSelectedList,
              onChange:e=>setCcSelectedList(e.target.value),
              style:{flex:1,padding:"8px 12px",borderRadius:"8px",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--t1)",fontSize:"13px",fontWeight:"600"}
            },
              ccLists.map(l=>React.createElement("option",{key:l.id,value:l.id},l.name+" ("+l.count+" contacts)"))
            )
          ),
          !ccListsLoading && ccLists.length === 0 && React.createElement("div",{style:{fontSize:"12px",color:"var(--t3)"}},"No active lists found in your CC account."),
          React.createElement("div",{style:{display:"flex",gap:"10px",flexWrap:"wrap",alignItems:"center"}},
            React.createElement("button",{
              disabled:!ccSelectedList || ccSyncStatus==="loading",
              onClick:()=>{
                const bucketA = leads.filter(l=>l.bucket==="A");
                if(!bucketA.length){ alert("No Bucket A leads found."); return; }
                if(!window.confirm("Sync "+bucketA.length+" Bucket A leads to selected CC list?")) return;
                setCcSyncStatus("loading"); setCcSyncResult(null);
                ccSyncLeads(bucketA, ccSelectedList)
                  .then(res=>{ setCcSyncStatus("success"); setCcSyncResult(res); })
                  .catch(err=>{ setCcSyncStatus("error"); setCcSyncResult({error:err.message}); });
              },
              style:{padding:"10px 20px",background:ccSyncStatus==="loading"?"var(--surface-2)":"var(--green-dim)",color:ccSyncStatus==="loading"?"var(--t3)":"var(--green)",border:"1px solid #6EE7B7",borderRadius:"8px",fontSize:"13px",fontWeight:"700",cursor:ccSyncStatus==="loading"?"not-allowed":"pointer"}
            }, ccSyncStatus==="loading" ? "⏳ Syncing…" : "📤 Sync Bucket A Leads"),
            React.createElement("button",{
              onClick:()=>{
                ccClearTokens();
                try { sessionStorage.removeItem('cc_pkce_verifier'); } catch {}
                setCcConnected(false); setCcSyncStatus("idle"); setCcSyncResult(null); setCcLists([]);
              },
              style:{padding:"10px 16px",background:"var(--red-dim)",color:"var(--red)",border:"1px solid #FCA5A5",borderRadius:"8px",fontSize:"12px",fontWeight:"700",cursor:"pointer"}
            },"Disconnect"),
            React.createElement("button",{
              onClick:()=>{
                ccClearTokens();
                try { sessionStorage.removeItem('cc_pkce_verifier'); } catch {}
                setCcConnected(false); setCcSyncStatus("idle"); setCcSyncResult(null); setCcLists([]);
                setTimeout(() => ccAuthorize(), 50);
              },
              style:{padding:"10px 16px",background:"var(--surface-2)",color:"var(--t2)",border:"1px solid var(--border)",borderRadius:"8px",fontSize:"12px",fontWeight:"700",cursor:"pointer"}
            },"↺ Force Reconnect")
          ),
          ccSyncStatus==="success" && ccSyncResult && React.createElement("div",{style:{padding:"10px 14px",background:"#DCFCE7",border:"1px solid #86EFAC",borderRadius:"8px",fontSize:"12px",color:"#15803D",fontWeight:"600"}},
            "✅ Sync submitted — "+ccSyncResult.count+" contacts queued (Activity ID: "+ccSyncResult.activityId+")"
          ),
          ccSyncStatus==="error" && ccSyncResult && React.createElement("div",{style:{padding:"10px 14px",background:"var(--red-dim)",border:"1px solid #FCA5A5",borderRadius:"8px",fontSize:"12px",color:"var(--red)",fontWeight:"600"}},
            "❌ Sync failed: "+ccSyncResult.error
          )
        )
      ),


      // ── AI ASSISTANT CARD ──
      React.createElement("div",{style:{background:"var(--surface)",border:"1px solid " + (aiConfig && aiConfig.geminiKey ? "var(--green)" : "var(--border)"),borderRadius:"16px",padding:"24px",marginBottom:"16px",boxShadow:"0 4px 16px rgba(0,0,0,0.03)"}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}},
          React.createElement("div",{style:{fontSize:"15px",fontWeight:"700",color:"var(--t1)"}},"🤖 AI Assistant (Gemini)"),
          (aiConfig && aiConfig.geminiKey)
            ? React.createElement("span",{style:{fontSize:"11px",fontWeight:"800",color:"var(--green)",background:"var(--green-dim)",padding:"4px 10px",borderRadius:"20px",border:"1px solid #6EE7B7"}},"CONNECTED")
            : React.createElement("span",{style:{fontSize:"11px",fontWeight:"800",color:"var(--amber)",background:"#FEF3C7",padding:"4px 10px",borderRadius:"20px",border:"1px solid #FCD34D"}},"NOT SET")
        ),
        React.createElement("div",{style:{fontSize:"12px",color:"var(--t3)",marginBottom:"18px",fontWeight:"500",lineHeight:"1.6"}},"Enables the AI panel (🤖 button in the corner) — Chat, Lead Intel, Draft Copy, and Note Extraction. Powered by Google Gemini 2.0 Flash. Get a free key at aistudio.google.com."),
        React.createElement("label",{style:{fontSize:"11pxpx",fontWeight:"700",color:"var(--t3)",letterSpacing:"1px",display:"block",marginBottom:"5px"}},"GEMINI API KEY"),
        React.createElement("input",{
          type:"password",
          placeholder:"Paste your Google AI Studio API key…",
          value:(aiDraft && aiDraft.geminiKey) || "",
          onChange:e=>setAiDraft(p=>({...p,geminiKey:e.target.value})),
          style:{background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:"7px",padding:"10px 14px",fontSize:"12px",color:"var(--t1)",width:"100%",marginBottom:"16px",boxSizing:"border-box",fontFamily:"'JetBrains Mono',monospace"}
        }),
        React.createElement("div",{style:{display:"flex",gap:"8px"}},
          React.createElement("button",{
            onClick:()=>{
              const cfg = {geminiKey:(aiDraft && aiDraft.geminiKey || "").trim()};
              if(saveAi) saveAi(cfg); else { setAiSaved(true); setTimeout(()=>setAiSaved(false),2500); }
            },
            style:{padding:"9px 20px",background:"var(--navy)",color:"#fff",border:"none",borderRadius:"8px",fontSize:"12px",fontWeight:"700",cursor:"pointer"}
          }, aiSaved ? "✓ Saved!" : "Save Key"),
          (aiConfig && aiConfig.geminiKey) && React.createElement("button",{
            onClick:()=>{
              const empty = {geminiKey:""};
              if(saveAi) saveAi(empty);
            },
            style:{padding:"9px 16px",background:"var(--red-dim)",color:"var(--red)",border:"1px solid #FCA5A5",borderRadius:"8px",fontSize:"12px",fontWeight:"700",cursor:"pointer"}
          },"Disconnect")
        )
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
