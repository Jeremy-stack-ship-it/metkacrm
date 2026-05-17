import React from 'react';
import { isDueToday } from '../lib/phaseEngine';
import { priority } from '../lib/leadScoring';

function DashboardTab({ leads = [], activity = [], goals = {}, financialConfig = {}, setView, setOpenId, setPrevView = () => {}, startDialSession = () => {}, refreshQueueOrder = () => {} }) {

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const TODAY_KEY = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;

  function getWeekKeys() {
    const keys = [];
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    for (let i = 0; i < 7; i++) {
      const dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      keys.push(`${dd.getFullYear()}-${pad(dd.getMonth()+1)}-${pad(dd.getDate())}`);
    }
    return keys;
  }

  function getLastWeekKeys() {
    const keys = [];
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7);
    for (let i = 0; i < 7; i++) {
      const dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      keys.push(`${dd.getFullYear()}-${pad(dd.getMonth()+1)}-${pad(dd.getDate())}`);
    }
    return keys;
  }

  const WEEK_KEYS      = getWeekKeys();
  const LAST_WEEK_KEYS = getLastWeekKeys();

  function countEvents(keys, type) {
    return activity.filter(e => {
      if (!e || !e.ts) return false;
      return keys.includes(e.ts.substring(0, 10)) && e.type === type;
    }).length;
  }

  const todayDials     = countEvents([TODAY_KEY], 'dial');
  const todayContacts  = countEvents([TODAY_KEY], 'contact');
  const todayAppts     = countEvents([TODAY_KEY], 'appointment');
  const weekDials      = countEvents(WEEK_KEYS, 'dial');
  const weekContacts   = countEvents(WEEK_KEYS, 'contact');
  const weekAppts      = countEvents(WEEK_KEYS, 'appointment');
  const weekAuditsRan  = countEvents(WEEK_KEYS, 'audit_ran');
  const lastWeekDials     = countEvents(LAST_WEEK_KEYS, 'dial');
  const lastWeekContacts  = countEvents(LAST_WEEK_KEYS, 'contact');
  const lastWeekAppts     = countEvents(LAST_WEEK_KEYS, 'appointment');
  const lastWeekAuditsRan = countEvents(LAST_WEEK_KEYS, 'audit_ran');

  const dailyDialGoal    = goals.dials        || 118;
  const dailyContactGoal = goals.contacts     || 18;
  const dailyApptGoal    = goals.appointments || 3;

  const activeLeads = leads.filter(l => !l.archived && !l.invalid);
  const issuedLeads = leads.filter(l => l.stage === 'issued');
  const bucketA = activeLeads.filter(l => l.bucket === 'A');
  const bucketB = activeLeads.filter(l => l.bucket === 'B');
  const bucketC = activeLeads.filter(l => l.bucket === 'C');

  function countCalledThisWeek(bucket) {
    return bucket.filter(l => l.lastContact && WEEK_KEYS.includes(l.lastContact.substring(0,10))).length;
  }

  const stageCounts = {};
  ['new','contacted','appointment_set','app_submitted','underwriting','issued'].forEach(s => {
    stageCounts[s] = activeLeads.filter(l => l.stage === s).length;
  });

  const uwLeads = activeLeads.filter(l => l.stage === 'app_submitted' || l.stage === 'underwriting');

  function daysSince(dateStr) {
    if (!dateStr) return null;
    return Math.floor((now - new Date(dateStr)) / 86400000);
  }

  function pct(num, den) {
    return (!den || den === 0) ? null : Math.round((num / den) * 100);
  }

  // Lead intake windows (uses assignDate as "received date")
  function daysAgoISO(n) {
    const d = new Date(now); d.setDate(now.getDate() - n);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  const D7  = daysAgoISO(7);
  const D30 = daysAgoISO(30);
  const MTD_START = `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`;
  const leadsLast7  = activeLeads.filter(l => l.assignDate && l.assignDate.substring(0,10) >= D7).length;
  const leadsLast30 = activeLeads.filter(l => l.assignDate && l.assignDate.substring(0,10) >= D30).length;
  const leadsMTD    = activeLeads.filter(l => l.assignDate && l.assignDate.substring(0,10) >= MTD_START).length;

  const weekSubmitted = activeLeads.filter(l =>
    l.submittedDate && WEEK_KEYS.includes(l.submittedDate.substring(0,10))
  ).length;
  const lastWeekSubmitted = activeLeads.filter(l =>
    l.submittedDate && LAST_WEEK_KEYS.includes(l.submittedDate.substring(0,10))
  ).length;

  const contactRate     = pct(weekContacts,  weekDials);
  const showRate        = pct(weekAuditsRan, weekAppts);
  const closeRate       = pct(weekSubmitted, weekAuditsRan);
  const lastContactRate = pct(lastWeekContacts,  lastWeekDials);
  const lastShowRate    = pct(lastWeekAuditsRan,  lastWeekAppts);
  const lastCloseRate   = pct(lastWeekSubmitted,  lastWeekAuditsRan);

  // Financial config — pulled from Settings (localStorage) with hardcoded defaults
  const MONTHLY_OVERHEAD   = financialConfig.monthlyOverhead   || 3921;
  const MONTHLY_NET_NEEDED = financialConfig.monthlyNetNeeded  || 2121;
  const WEEKLY_OVERHEAD    = Math.round(MONTHLY_OVERHEAD / 4.33);
  const WEEKLY_TARGET      = Math.round((MONTHLY_OVERHEAD + MONTHLY_NET_NEEDED) / 4.33);
  const AVG_PAYOUT_PCT     = (financialConfig.avgPayoutPct     || 55) / 100;
  const APPS_GOAL_WEEK     = financialConfig.appsGoalWeek      || 5;
  const CONTRACT_LEVEL     = financialConfig.contractLevel     || '85%';
  const CONTRACT_TARGET    = financialConfig.contractTarget    || '100%';

  const weekAPV = activeLeads
    .filter(l => l.submittedDate && WEEK_KEYS.includes(l.submittedDate.substring(0,10)))
    .reduce((sum, l) => sum + (parseFloat(l.expectedPremium) || 0), 0);
  const estWeekCommission = Math.round(weekAPV * AVG_PAYOUT_PCT);
  const breakEvenPct = WEEKLY_TARGET > 0
    ? Math.min(Math.round((estWeekCommission / WEEKLY_TARGET) * 100), 100)
    : 0;

  function buildDialQueue() {
    // Uses phaseEngine.isDueToday + leadScoring.priority — single source of truth
    return [...bucketA, ...bucketB]
      .filter(isDueToday)
      .sort((a, b) => priority(b) - priority(a))
      .slice(0, 10)
      .map(l => {
        const isOD   = l.nextCallback && new Date(l.nextCallback) < now;
        const reason = isOD                          ? '🔴 Callback Overdue'
          : l.disposition === 'not_called'           ? '🟠 New — Not Called'
          : l.disposition === 'callback'             ? '📅 Callback Due'
          : (l.disposition === 'no_answer' || l.disposition === 'vm_left') ? '🔵 Re-dial'
          : '⚪ Eligible';
        return { ...l, _priority: priority(l), _reason: reason };
      });
  }

  const dialQueue = buildDialQueue();

  function progressColor(p) {
    if (p >= 100) return 'var(--green)';
    if (p >= 60)  return 'var(--amber)';
    return 'var(--red)';
  }

  function bucketColor(b) {
    if (b === 'A') return 'var(--red)';
    if (b === 'B') return 'var(--amber)';
    return 'var(--blue)';
  }

  function stuckColor(days) {
    if (days === null) return 'var(--green)';
    if (days > 14) return 'var(--red)';
    if (days > 7)  return 'var(--amber)';
    return 'var(--green)';
  }

  function TrendArrow({ curr, prev }) {
    if (curr === null || prev === null) return null;
    if (curr > prev) return <span style={{color:'var(--green)',fontSize:'0.8rem'}}> ▲</span>;
    if (curr < prev) return <span style={{color:'var(--red)',  fontSize:'0.8rem'}}> ▼</span>;
    return <span style={{color:'var(--blue)',fontSize:'0.8rem'}}> —</span>;
  }

  function ProgressBar({ value, goal, label }) {
    const p     = goal > 0 ? Math.min(Math.round((value / goal) * 100), 100) : 0;
    const color = progressColor(p);
    return (
      <div style={{marginBottom:'0.75rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.25rem'}}>
          <span style={{fontSize:'0.8rem',color:'#94a3b8'}}>{label}</span>
          <span style={{fontSize:'0.8rem',fontWeight:700,color:color}}>{value} / {goal}</span>
        </div>
        <div style={{background:'var(--navy)',borderRadius:4,height:8,overflow:'hidden'}}>
          <div style={{width:`${p}%`,height:'100%',background:color,borderRadius:4,transition:'width 0.3s'}} />
        </div>
      </div>
    );
  }

  function KpiCard({ label, value, prevValue, target }) {
    const onTarget = value !== null && target !== null && value >= target;
    return (
      <div style={{
        background:'var(--navy)',borderRadius:8,padding:'0.75rem 0.9rem',
        border:`1px solid ${onTarget ? 'var(--green)' : 'var(--navy-3)'}`
      }}>
        <div style={{fontSize:'0.68rem',color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.3rem'}}>{label}</div>
        <div style={{fontSize:'1.5rem',fontWeight:700,color:value===null?'#475569':(onTarget?'var(--green)':'var(--amber)')}}>
          {value !== null ? `${value}%` : '—'}
          <TrendArrow curr={value} prev={prevValue} />
        </div>
        {target !== null && (
          <div style={{fontSize:'0.68rem',color:'#64748b',marginTop:'0.15rem'}}>Target: {target}%{prevValue !== null ? ` · Last wk: ${prevValue}%` : ''}</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, width: '100%', height: '100%', overflowY: 'auto', background: 'var(--surface-2)' }}>
      <div style={{padding:'24px 32px',maxWidth:1400,margin:'0 auto',fontFamily:'inherit'}}>

        <div style={{
          background:'rgba(239,68,68,0.1)',border:'1px solid var(--red)',
          borderRadius:8,padding:'0.55rem 1rem',marginBottom:'1rem',
          display:'flex',alignItems:'center',gap:'0.75rem'
        }}>
          <span style={{color:'var(--red)',fontWeight:700,fontSize:'0.82rem',flexShrink:0}}>CHARGEBACK ACTIVE</span>
          <span style={{color:'#94a3b8',fontSize:'0.82rem'}}>
            UHL — $2,500 outstanding. Every closed app reduces this balance.
          </span>
        </div>

        {/* v3.7 — Daily pace KPI banner */}
        {(() => {
          const dialPct  = dailyDialGoal  > 0 ? Math.min(Math.round((todayDials    / dailyDialGoal)    * 100), 100) : 0;
          const contPct  = dailyContactGoal > 0 ? Math.min(Math.round((todayContacts / dailyContactGoal) * 100), 100) : 0;
          const apptPct  = dailyApptGoal  > 0 ? Math.min(Math.round((todayAppts    / dailyApptGoal)    * 100), 100) : 0;
          const workStart = 8; // 8 AM
          const workEnd   = 20; // 8 PM
          const hNow      = now.getHours() + now.getMinutes() / 60;
          const hLeft     = Math.max(0, workEnd - hNow);
          const hTotal    = workEnd - workStart;
          const timePct   = Math.min(Math.round(((hNow - workStart) / hTotal) * 100), 100);
          const hLeftStr  = hLeft > 0 ? (Math.floor(hLeft) + 'h ' + Math.round((hLeft % 1) * 60) + 'm left') : 'End of day';
          // Pace: dials completed vs time elapsed — are we ahead or behind?
          const expectedDials = Math.round((timePct / 100) * dailyDialGoal);
          const paceGap = todayDials - expectedDials; // positive = ahead, negative = behind
          const paceColor = paceGap >= 0 ? 'var(--green)' : paceGap >= -10 ? 'var(--amber)' : 'var(--red)';
          const paceLabel = paceGap >= 0 ? `▲ ${paceGap} ahead` : `▼ ${Math.abs(paceGap)} behind`;

          const Meter = ({ label, val, goal, pct }) => (
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                <span style={{fontSize:'10px',fontWeight:'700',color:'rgba(255,255,255,0.5)',letterSpacing:'0.06em'}}>{label}</span>
                <span style={{fontSize:'11px',fontWeight:'800',color: pct >= 100 ? 'var(--green)' : pct >= 60 ? 'var(--amber)' : 'rgba(255,255,255,0.7)'}}>{val}<span style={{fontWeight:'400',color:'rgba(255,255,255,0.35)'}}>/{goal}</span></span>
              </div>
              <div style={{height:'5px',background:'rgba(255,255,255,0.1)',borderRadius:'3px',overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct}%`,background: pct>=100?'var(--green)':pct>=60?'var(--amber)':'var(--red)',borderRadius:'3px',transition:'width 0.4s'}} />
              </div>
            </div>
          );

          return (
            <div style={{
              background:'var(--navy)', border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'10px', padding:'14px 18px', marginBottom:'16px',
              display:'flex', alignItems:'center', gap:'20px'
            }}>
              <div style={{flexShrink:0}}>
                <div style={{fontSize:'10px',fontWeight:'800',color:'rgba(255,255,255,0.4)',letterSpacing:'0.08em',marginBottom:'3px'}}>TODAY'S PACE</div>
                <div style={{fontSize:'22px',fontWeight:'800',color:paceColor,fontFamily:"'Syne',sans-serif",lineHeight:1}}>{paceLabel}</div>
                <div style={{fontSize:'10px',color:'rgba(255,255,255,0.35)',marginTop:'3px'}}>{hLeftStr}</div>
              </div>
              <div style={{width:'1px',height:'40px',background:'rgba(255,255,255,0.08)',flexShrink:0}} />
              <div style={{flex:1,display:'flex',gap:'16px',minWidth:0}}>
                <Meter label="DIALS"    val={todayDials}    goal={dailyDialGoal}    pct={dialPct} />
                <Meter label="CONTACTS" val={todayContacts} goal={dailyContactGoal} pct={contPct} />
                <Meter label="APPTS"    val={todayAppts}    goal={dailyApptGoal}    pct={apptPct} />
              </div>
              <div style={{flexShrink:0,textAlign:'right'}}>
                <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'3px'}}>TIME USED</div>
                <div style={{fontSize:'16px',fontWeight:'800',color:'rgba(255,255,255,0.7)'}}>{timePct}%</div>
                <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)'}}>of work day</div>
              </div>
            </div>
          );
        })()}


        {/* ── MISSION STATUS — compact bar ──────────────────────────────── */}
        {(() => {
          const missionColor = weekSubmitted >= APPS_GOAL_WEEK ? 'var(--green)' : weekSubmitted >= 3 ? 'var(--amber)' : 'var(--red)';
          const missionBg    = weekSubmitted >= APPS_GOAL_WEEK ? 'rgba(16,185,129,0.07)' : weekSubmitted >= 3 ? 'rgba(245,158,11,0.07)' : 'rgba(239,68,68,0.07)';
          const pctFill      = Math.min(Math.round((weekSubmitted / APPS_GOAL_WEEK) * 100), 100);
          return (
            <div style={{
              background: missionBg, border: `1px solid ${missionColor}40`,
              borderRadius: 8, padding: '0.55rem 1rem', marginBottom: '0.75rem',
              display: 'flex', alignItems: 'center', gap: '1rem'
            }}>
              <span style={{fontSize:'1.5rem',fontWeight:800,color:missionColor,fontFamily:"'Syne',sans-serif",lineHeight:1,flexShrink:0}}>
                {weekSubmitted}<span style={{fontSize:'0.75rem',color:'#64748b',fontWeight:600,marginLeft:'0.3rem'}}>/ {APPS_GOAL_WEEK}</span>
              </span>
              <span style={{fontSize:'0.75rem',fontWeight:700,color:missionColor,flexShrink:0}}>
                {weekSubmitted >= APPS_GOAL_WEEK ? '🎯 MISSION HIT' : `APPS THIS WEEK — ${APPS_GOAL_WEEK - weekSubmitted} TO GO`}
              </span>
              <div style={{flex:1,background:'var(--navy)',borderRadius:4,height:6,overflow:'hidden'}}>
                <div style={{width:`${pctFill}%`,height:'100%',background:missionColor,borderRadius:4,transition:'width 0.4s'}} />
              </div>
              <span style={{fontSize:'0.7rem',color:'#64748b',flexShrink:0}}>
                Last wk: <span style={{color: weekSubmitted >= lastWeekSubmitted ? 'var(--green)' : 'var(--red)', fontWeight:700}}>{lastWeekSubmitted}</span>
              </span>
            </div>
          );
        })()}
        <div style={{
          background:'var(--navy-2)',borderRadius:10,padding:'1rem 1.25rem',
          marginBottom:'1rem',border:'1px solid var(--navy-3)'
        }}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
            <span style={{fontWeight:700,fontSize:'0.95rem',color:'#e2e8f0'}}>Today's Activity</span>
            <span style={{fontSize:'0.72rem',color:'#64748b'}}>{TODAY_KEY} · 710 dials/wk target</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'1.25rem'}}>
            <ProgressBar value={todayDials}    goal={dailyDialGoal}    label="Dials" />
            <ProgressBar value={todayContacts} goal={dailyContactGoal} label="Contacts" />
            <ProgressBar value={todayAppts}    goal={dailyApptGoal}    label="Appts Set" />
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'220px 1fr 220px',gap:'1rem',marginBottom:'1rem'}}>

          <div style={{background:'var(--navy-2)',borderRadius:10,padding:'1rem',border:'1px solid var(--navy-3)'}}>
            <div style={{fontWeight:700,fontSize:'0.88rem',color:'#e2e8f0',marginBottom:'0.75rem'}}>Lead Intake</div>

            {/* Intake velocity */}
            {[
              {label:'Last 7 Days',  val:leadsLast7},
              {label:'Last 30 Days', val:leadsLast30},
              {label:'MTD',          val:leadsMTD},
            ].map(({label,val}) => (
              <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                background:'var(--navy)',borderRadius:7,padding:'0.5rem 0.75rem',marginBottom:'0.4rem'}}>
                <span style={{fontSize:'0.73rem',color:'#94a3b8'}}>{label}</span>
                <span style={{fontSize:'1.1rem',fontWeight:800,color:'#e2e8f0',fontFamily:"'JetBrains Mono',monospace"}}>{val}</span>
              </div>
            ))}

            <div style={{borderTop:'1px solid var(--navy-3)',paddingTop:'0.65rem',marginTop:'0.55rem'}}>
              <div style={{fontSize:'0.68rem',color:'#64748b',marginBottom:'0.4rem',textTransform:'uppercase',letterSpacing:'0.04em'}}>Buckets</div>
              {[
                {label:'A — HOT',  bucket:bucketA, color:'var(--red)',   key:'A'},
                {label:'B — WARM', bucket:bucketB, color:'var(--amber)', key:'B'},
                {label:'C — COLD', bucket:bucketC, color:'var(--blue)',  key:'C'},
              ].map(({label,bucket,color,key}) => (
                <div key={key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.3rem'}}>
                  <span style={{fontSize:'0.73rem',color,fontWeight:600}}>{label}</span>
                  <span style={{fontSize:'0.9rem',fontWeight:700,color:'#e2e8f0'}}>{bucket.length}
                    <span style={{fontSize:'0.65rem',color:'#64748b',fontWeight:400,marginLeft:'0.3rem'}}>
                      ({countCalledThisWeek(bucket)} called)
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <div style={{borderTop:'1px solid var(--navy-3)',paddingTop:'0.65rem',marginTop:'0.55rem'}}>
              <div style={{fontSize:'0.68rem',color:'#64748b',marginBottom:'0.4rem',textTransform:'uppercase',letterSpacing:'0.04em'}}>By Stage</div>
              {[
                ['New',stageCounts.new],['Contacted',stageCounts.contacted],
                ['App Submitted',stageCounts.app_submitted],['Underwriting',stageCounts.underwriting],
              ].map(([s,c]) => (
                <div key={s} style={{display:'flex',justifyContent:'space-between',fontSize:'0.72rem',color:'#94a3b8',marginBottom:'0.2rem'}}>
                  <span>{s}</span><span style={{fontWeight:600,color:'#e2e8f0'}}>{c}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{background:'var(--navy-2)',borderRadius:10,padding:'1rem',border:'1px solid var(--navy-3)',display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
              <span style={{fontWeight:800,fontSize:'0.88rem',color:'#e2e8f0',fontFamily:"'Syne',sans-serif",letterSpacing:'0.04em'}}>⚡ DIAL QUEUE</span>
              <div style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>
                <span style={{fontSize:'0.68rem',color:'#64748b',background:'var(--navy)',borderRadius:20,padding:'0.15rem 0.55rem'}}>{dialQueue.length} leads</span>
                <button onClick={refreshQueueOrder} title="Refresh priority order" style={{padding:'0.28rem 0.5rem',background:'none',color:'#64748b',border:'1px solid #334155',borderRadius:5,fontSize:'0.68rem',fontWeight:800,cursor:'pointer'}}>🔄</button>
                <button onClick={()=>startDialSession(dialQueue.map(l=>l.id))} style={{padding:'0.28rem 0.65rem',background:'var(--green)',color:'#fff',border:'none',borderRadius:5,fontSize:'0.68rem',fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}>▶ Start</button>
              </div>
            </div>
            {dialQueue.length === 0 ? (
              <div style={{color:'#475569',fontSize:'0.8rem',textAlign:'center',padding:'1.5rem 0'}}>🎯 Queue clear</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'0.45rem',overflowY:'auto',flex:1}}>
                {dialQueue.map((l, idx) => (
                  <div key={l.id} style={{
                    display:'flex',alignItems:'center',gap:'0.6rem',
                    background:'var(--navy)',borderRadius:7,padding:'0.55rem 0.7rem',
                    borderLeft:`3px solid ${bucketColor(l.bucket)}`,cursor:'pointer'
                  }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(51,65,94,0.9)'}
                    onMouseLeave={e => e.currentTarget.style.background='var(--navy)'}
                  >
                    <span style={{width:20,height:20,borderRadius:'50%',flexShrink:0,background:idx<3?bucketColor(l.bucket)+'33':'var(--navy-3)',color:idx<3?bucketColor(l.bucket):'#64748b',fontSize:'0.65rem',fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>{idx+1}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'0.78rem',fontWeight:700,color:'#e2e8f0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{l.name}</div>
                      <div style={{fontSize:'0.65rem',color:'#94a3b8',display:'flex',alignItems:'center',gap:'0.3rem',flexWrap:'wrap'}}>
                        <span>{l._reason}</span>
                        {l.nextCallback&&<span style={{color:'var(--sky)'}}>· CB {l.nextCallback}</span>}
                        {(()=>{const dc=(l.notes||[]).filter(n=>n.type==='call').length;return dc>0?<span style={{color:'#60a5fa',fontWeight:800,fontFamily:"'JetBrains Mono',monospace",background:'rgba(59,130,246,0.15)',padding:'0 4px',borderRadius:3,fontSize:'0.62rem'}}>📞{dc}</span>:null;})()}
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'0.25rem',flexShrink:0}}>
                      <a href={`tel:${l.phone}`} style={{fontSize:'0.68rem',fontWeight:700,color:'var(--green)',textDecoration:'none'}}>{l.phone}</a>
                      <button onClick={()=>{setPrevView('dashboard');setOpenId(l.id);setView('contact');}} style={{background:'var(--navy-3)',color:'#94a3b8',border:'none',borderRadius:4,padding:'0.18rem 0.5rem',fontSize:'0.62rem',fontWeight:700,cursor:'pointer'}}>Open →</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
            <div style={{background:'var(--navy-2)',borderRadius:10,padding:'1rem',border:'1px solid var(--navy-3)'}}>
              <div style={{fontWeight:700,fontSize:'0.88rem',color:'#e2e8f0',marginBottom:'0.75rem'}}>Weekly KPIs</div>
              <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                <KpiCard label="Contact Rate" value={contactRate} prevValue={lastContactRate} target={15} />
                <KpiCard label="Show Rate"    value={showRate}    prevValue={lastShowRate}    target={70} />
                <KpiCard label="Close Rate"   value={closeRate}   prevValue={lastCloseRate}   target={40} />
                <div style={{background:'var(--navy)',borderRadius:8,padding:'0.75rem 0.9rem',border:`1px solid ${weekDials>=710?'var(--green)':'var(--navy-3)'}`}}>
                  <div style={{fontSize:'0.68rem',color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.3rem'}}>Week Dials</div>
                  <div style={{fontSize:'1.5rem',fontWeight:700,color:weekDials>=710?'var(--green)':'var(--amber)'}}>
                    {weekDials}<span style={{fontSize:'0.85rem',color:'#64748b',fontWeight:400}}> / 710</span>
                  </div>
                  <div style={{fontSize:'0.68rem',color:'#64748b',marginTop:'0.15rem'}}>
                    {weekDials>=710 ? 'Weekly goal hit' : `${710-weekDials} remaining`}
                  </div>
                </div>
              </div>
            </div>

            <div style={{background:'var(--navy-2)',borderRadius:10,padding:'1rem',border:'1px solid var(--navy-3)',flex:1}}>
              <div style={{fontWeight:700,fontSize:'0.88rem',color:'#e2e8f0',marginBottom:'0.75rem'}}>Financial Tracker</div>
              <div style={{marginBottom:'0.75rem'}}>
                {[
                  ['Est. Commission (wk)', `$${estWeekCommission.toLocaleString()}`, 'var(--green)'],
                  ['Weekly Overhead',      `-$${WEEKLY_OVERHEAD.toLocaleString()}`,  'var(--red)'],
                  ['Weekly Target',        `$${WEEKLY_TARGET.toLocaleString()}`,     '#e2e8f0'],
                ].map(([label,val,color]) => (
                  <div key={label} style={{display:'flex',justifyContent:'space-between',marginBottom:'0.3rem'}}>
                    <span style={{fontSize:'0.73rem',color:'#94a3b8'}}>{label}</span>
                    <span style={{fontSize:'0.82rem',fontWeight:700,color}}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{fontSize:'0.68rem',color:'#64748b',marginBottom:'0.3rem'}}>Break-even Progress ({breakEvenPct}%)</div>
              <div style={{background:'var(--navy)',borderRadius:4,height:10,overflow:'hidden',marginBottom:'0.5rem'}}>
                <div style={{width:`${breakEvenPct}%`,height:'100%',borderRadius:4,transition:'width 0.3s',background:breakEvenPct>=100?'var(--green)':breakEvenPct>=50?'var(--amber)':'var(--red)'}} />
              </div>
              <div style={{fontSize:'0.68rem',color:'#64748b',marginBottom:'0.75rem'}}>
                {weekSubmitted} app{weekSubmitted!==1?'s':''} · APV ${Math.round(weekAPV).toLocaleString()} · {CONTRACT_LEVEL} contract
              </div>
              <div style={{borderTop:'1px solid var(--navy-3)',paddingTop:'0.65rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.3rem'}}>
                  <span style={{fontSize:'0.73rem',color:'#94a3b8'}}>Apps Goal (Week)</span>
                  <span style={{fontSize:'0.82rem',fontWeight:700,color:weekSubmitted>=APPS_GOAL_WEEK?'var(--green)':'var(--amber)'}}>{weekSubmitted} / {APPS_GOAL_WEEK}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:'0.73rem',color:'#94a3b8'}}>Contract Level</span>
                  <span style={{fontSize:'0.82rem',fontWeight:700,color:'var(--amber)'}}>{CONTRACT_LEVEL} → {CONTRACT_TARGET}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── UNDERWRITING PIPELINE ─────────────────────────── */}
        <div style={{background:'var(--navy-2)',borderRadius:10,padding:'1.25rem',border:'1px solid var(--navy-3)',marginBottom:'1rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.85rem'}}>
            <span style={{fontWeight:700,fontSize:'0.95rem',color:'#e2e8f0'}}>Underwriting Pipeline</span>
            {uwLeads.filter(l => (daysSince(l.submittedDate)||0) > 7).length > 0 && (
              <span style={{background:'var(--red)',color:'#fff',borderRadius:12,fontSize:'0.72rem',fontWeight:700,padding:'0.2rem 0.65rem'}}>
                {uwLeads.filter(l => (daysSince(l.submittedDate)||0) > 7).length} STUCK
              </span>
            )}
          </div>
          {uwLeads.length === 0 ? (
            <div style={{color:'#475569',fontSize:'0.85rem',textAlign:'center',padding:'1.5rem 0'}}>No apps in pipeline — close something.</div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.8rem'}}>
              <thead>
                <tr style={{color:'#64748b'}}>
                  {['Name','Lead Type','Carrier','Premium','Submitted','Days','Pending Reqs'].map(h => (
                    <th key={h} style={{padding:'0.35rem 0.6rem',borderBottom:'1px solid var(--navy-3)',textAlign:'left',fontWeight:600}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uwLeads.map(l => {
                  const days = daysSince(l.submittedDate);
                  const sc   = stuckColor(days);
                  const rawReqs = Array.isArray(l.pendingReqs) ? l.pendingReqs : [];
                  const reqs = rawReqs.filter(r => !r.done).map(r => r.label || '').filter(Boolean);
                  return (
                    <tr key={l.id} style={{borderBottom:'1px solid rgba(51,59,84,0.5)'}}>
                      <td style={{padding:'0.4rem 0.6rem',color:'var(--blue)',fontWeight:700,cursor:'pointer',textDecoration:'underline'}} onClick={()=>{setPrevView('dashboard');setOpenId(l.id);setView('contact');}}>{l.name}</td>
                      <td style={{padding:'0.4rem 0.6rem',color:'#94a3b8'}}>{l.leadType||'—'}</td>
                      <td style={{padding:'0.4rem 0.6rem',color:'#94a3b8'}}>{l.carrier||'—'}</td>
                      <td style={{padding:'0.4rem 0.6rem',color:'var(--green)',fontWeight:700}}>{l.expectedPremium?`$${parseFloat(l.expectedPremium).toLocaleString()}`:'—'}</td>
                      <td style={{padding:'0.4rem 0.6rem',color:'#64748b'}}>{l.submittedDate||'—'}</td>
                      <td style={{padding:'0.4rem 0.6rem'}}>
                        <span style={{color:sc,fontWeight:700,background:days>7?`${sc}20`:'transparent',padding:'0.15rem 0.4rem',borderRadius:4}}>
                          {days !== null ? `${days}d` : '—'}
                        </span>
                      </td>
                      <td style={{padding:'0.4rem 0.6rem',color:'#64748b'}}>
                        {reqs.length > 0 ? reqs.join(', ') : <span style={{color:'var(--green)',fontWeight:600}}>✓ Clear</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>


        {/* ── 5 R'S ANNUAL REVIEW ──────────────────────────────────────── */}
        {issuedLeads.length > 0 && (
          <div style={{background:'var(--navy-2)',borderRadius:10,padding:'1.25rem',border:'1px solid var(--navy-3)',marginBottom:'1rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.85rem'}}>
              <span style={{fontWeight:700,fontSize:'0.95rem',color:'#e2e8f0'}}>🔁 5 R's Annual Review</span>
              <span style={{background:'var(--green)',color:'#fff',borderRadius:12,fontSize:'0.72rem',fontWeight:700,padding:'0.2rem 0.65rem'}}>{issuedLeads.length} ISSUED</span>
            </div>
            {issuedLeads.map(l => {
              const first = (l.name || '').split(' ')[0] || 'there';
              const scripts5r = {
                'Referrals': `Hi ${first} — this is Jeremy Metka, your Senior Field Underwriter. I'm doing annual reviews this week and wanted to reach out. First — do you feel like your household is fully protected? And second, do you know anyone else who might benefit from a Household Protection Audit?`,
                'Reset': `Hi ${first} — Jeremy Metka here. I do annual reviews on all our issued households and I want to make sure your coverage still fits your life. Things change — income, family size, health. Can we set 15 minutes to run a quick reset audit?`,
                'Replace': `Hi ${first}, this is Jeremy Metka. I've been reviewing issued households and there may be a stronger product available now that could give you more Living Benefits for the same or less premium. Worth a 10-minute look?`,
                'Rugrats': `Hi ${first} — Jeremy Metka here. Just doing our annual reviews. Quick question — any new additions to the family? A new child or grandchild changes the protection picture entirely. Want to run a quick audit?`,
                'Recruit': `Hi ${first}, this is Jeremy Metka. You've seen firsthand what this work does for families. I'm building a regional team and looking for servant leaders — people with integrity who want to build something real. Would you ever consider learning more about what I do?`,
              };
              return (
                <div key={l.id} style={{
                  background:'var(--navy)',borderRadius:8,padding:'0.85rem 1rem',
                  marginBottom:'0.6rem',borderLeft:'3px solid var(--green)'
                }}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.6rem'}}>
                    <div>
                      <span style={{fontWeight:700,fontSize:'0.88rem',color:'#e2e8f0'}}>{l.name}</span>
                      {l.carrier && <span style={{fontSize:'0.72rem',color:'#64748b',marginLeft:'0.5rem'}}>· {l.carrier}</span>}
                    </div>
                    <span style={{fontSize:'0.68rem',color:'#64748b'}}>{l.phone}</span>
                  </div>
                  <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
                    {Object.entries(scripts5r).map(([label, msg]) => (
                      <button key={label} onClick={() => {
                        try { navigator.clipboard.writeText(msg); } catch(e) {
                          const ta = document.createElement('textarea');
                          ta.value = msg; document.body.appendChild(ta); ta.select();
                          document.execCommand('copy'); document.body.removeChild(ta);
                        }
                        alert(`✅ ${label} script copied for ${first}`);
                      }} style={{
                        padding:'0.3rem 0.65rem',fontSize:'0.72rem',fontWeight:700,
                        color:'var(--green)',background:'rgba(16,185,129,0.12)',
                        border:'1px solid rgba(16,185,129,0.3)',borderRadius:5,cursor:'pointer'
                      }}>{label}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{background:'rgba(37,44,63,0.4)',borderRadius:10,padding:'1rem 1.25rem',border:'1px dashed var(--navy-3)',opacity:0.55}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
            <span style={{fontWeight:700,fontSize:'0.88rem',color:'#475569'}}>Downline Pipeline</span>
            <span style={{fontSize:'0.68rem',color:'#334155',background:'var(--navy-3)',borderRadius:10,padding:'0.18rem 0.55rem'}}>Inactive — activate when first agent contracts</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.75rem'}}>
            {[1,2,3].map(n => (
              <div key={n} style={{background:'var(--navy)',borderRadius:8,padding:'0.75rem',border:'1px dashed var(--navy-3)'}}>
                <div style={{fontSize:'0.7rem',fontWeight:700,color:'#334155',marginBottom:'0.3rem'}}>AGENT {n}</div>
                <div style={{fontSize:'0.68rem',color:'#1E293B'}}>— open slot —</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default DashboardTab;
