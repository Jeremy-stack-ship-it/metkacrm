import React from 'react';
import { isDueToday } from '../lib/phaseEngine';
import { priority } from '../lib/leadScoring';
import { getSequenceStatus, getSequenceBadgeColor } from '../lib/sequenceEngine.js';

function DashboardTab({ leads = [], activity = [], goals = {}, financialConfig = {}, setView, setOpenId, setPrevView = () => {}, startDialSession = () => {}, refreshQueueOrder = () => {}, seqStats = null, onStartDialSlot = null }) {

  const now = new Date();
  // v3.24 — confirmation modal state
  const [confirmSlot, setConfirmSlot] = React.useState(null); // 'AM' | 'PM' | null
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
  // Today's queue stats (phase engine — replaces legacy bucket counts)
  const dueToday      = activeLeads.filter(l => isDueToday(l));
  const dueTodayAM    = dueToday.filter(l => (l.slot || 'AM') === 'AM');
  const dueTodayPM    = dueToday.filter(l => (l.slot || 'AM') === 'PM');
  const calledToday   = dueToday.filter(l => l.lastContact && l.lastContact.substring(0,10) === TODAY_KEY);

  // Lead type breakdown for today's queue
  function topLeadTypes(arr, n = 3) {
    const counts = {};
    arr.forEach(l => { const t = l.leadType || 'Unknown'; counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, n);
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
    .reduce((sum, l) => {
      const apv = (parseFloat(l.expectedPremium) || 0) * 12;
      const myPct = l.splitDeal ? (Number(l.splitPct) || 50) / 100 : 1;
      return sum + apv * myPct;
    }, 0);
  const estWeekCommission = Math.round(weekAPV * AVG_PAYOUT_PCT);
  const breakEvenPct = WEEKLY_TARGET > 0
    ? Math.min(Math.round((estWeekCommission / WEEKLY_TARGET) * 100), 100)
    : 0;

  function progressColor(p) {
    if (p >= 100) return 'var(--green)';
    if (p >= 60)  return 'var(--amber)';
    return 'var(--red)';
  }

  function stuckColor(days) {
    if (days === null) return 'var(--green)';
    if (days > 14) return 'var(--red)';
    if (days > 7)  return 'var(--amber)';
    return 'var(--green)';
  }

  function TrendArrow({ curr, prev }) {
    if (curr === null || prev === null) return null;
    if (curr > prev) return React.createElement('span', {style:{color:'var(--green)',fontSize:'0.85rem',marginLeft:'4px'}}, '▲');
    if (curr < prev) return React.createElement('span', {style:{color:'var(--red)',  fontSize:'0.85rem',marginLeft:'4px'}}, '▼');
    return React.createElement('span', {style:{color:'#64748b',fontSize:'0.85rem',marginLeft:'4px'}}, '—');
  }

  // Redesigned ProgressBar — taller, more vivid
  function ProgressBar({ value, goal, label }) {
    const p     = goal > 0 ? Math.min(Math.round((value / goal) * 100), 100) : 0;
    const color = progressColor(p);
    return (
      <div style={{marginBottom:'0.75rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
          <span style={{fontSize:'0.78rem',color:'#94a3b8',fontWeight:600,letterSpacing:'0.03em'}}>{label}</span>
          <span style={{fontSize:'0.82rem',fontWeight:800,color:color}}>{value}<span style={{color:'rgba(255,255,255,0.25)',fontWeight:400}}> / {goal}</span></span>
        </div>
        <div style={{background:'rgba(255,255,255,0.06)',borderRadius:6,height:12,overflow:'hidden',boxShadow:'inset 0 1px 2px rgba(0,0,0,0.3)'}}>
          <div style={{width:`${p}%`,height:'100%',background:`linear-gradient(90deg, ${color}99, ${color})`,borderRadius:6,transition:'width 0.4s',boxShadow:`0 0 8px ${color}60`}} />
        </div>
      </div>
    );
  }

  // Redesigned KpiCard — bolder numbers, clearer accent
  function KpiCard({ label, value, prevValue, target }) {
    const onTarget = value !== null && target !== null && value >= target;
    const numColor = value === null ? '#94a3b8' : onTarget ? 'var(--green)' : '#f59e0b';
    const borderColor = onTarget ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.07)';
    const bgAccent = onTarget ? 'rgba(16,185,129,0.05)' : 'transparent';
    return (
      <div style={{
        background:`linear-gradient(135deg, rgba(15,23,42,0.6) 0%, ${bgAccent} 100%)`,
        borderRadius:10, padding:'0.85rem 1rem',
        border:`1px solid ${borderColor}`,
        borderLeft:`3px solid ${numColor}`,
        display:'flex', alignItems:'center', gap:'0.85rem'
      }}>
        <div style={{flex:1}}>
          <div style={{fontSize:'0.65rem',color:'#64748b',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:'0.2rem',fontWeight:700}}>{label}</div>
          {target !== null && (
            <div style={{fontSize:'0.65rem',color:'#94a3b8',marginTop:'0.15rem'}}>
              Target {target}%{prevValue !== null ? ` · Last wk ${prevValue}%` : ''}
            </div>
          )}
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          <div style={{fontSize:'2rem',fontWeight:800,color:numColor,lineHeight:1,fontFamily:"'Syne',sans-serif"}}>
            {value !== null ? `${value}%` : '—'}
          </div>
          {prevValue !== null && value !== null && (
            <TrendArrow curr={value} prev={prevValue} />
          )}
        </div>
      </div>
    );
  }

  // Section header helper
  function SectionHeader({ label, accent = 'var(--blue)', badge = null }) {
    return (
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.85rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <div style={{width:3,height:16,background:accent,borderRadius:2,flexShrink:0}} />
          <span style={{fontWeight:700,fontSize:'0.9rem',color:'#e2e8f0',letterSpacing:'0.01em'}}>{label}</span>
        </div>
        {badge}
      </div>
    );
  }

  return (
    <React.Fragment>
    <div style={{ flex: 1, width: '100%', height: '100%', overflowY: 'auto', background: 'var(--surface-2)' }}>
      <div style={{padding:'20px 28px',maxWidth:1300,margin:'0 auto',fontFamily:'inherit'}}>

        {/* ── CHARGEBACK BANNER ─────────────────────────────────────── */}
        <div style={{
          background:'linear-gradient(90deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
          border:'1px solid rgba(239,68,68,0.4)',
          borderLeft:'3px solid var(--red)',
          borderRadius:8, padding:'0.55rem 1rem', marginBottom:'1rem',
          display:'flex', alignItems:'center', gap:'0.75rem'
        }}>
          <span style={{color:'var(--red)',fontWeight:800,fontSize:'0.78rem',flexShrink:0,letterSpacing:'0.04em'}}>⚡ CHARGEBACK ACTIVE</span>
          <span style={{color:'#94a3b8',fontSize:'0.8rem'}}>UHL — $2,500 outstanding. Every closed app reduces this balance.</span>
        </div>

        {/* ── TODAY'S PACE BANNER ─────────────────────────────────── */}
        {(() => {
          const dialPct  = dailyDialGoal  > 0 ? Math.min(Math.round((todayDials    / dailyDialGoal)    * 100), 100) : 0;
          const contPct  = dailyContactGoal > 0 ? Math.min(Math.round((todayContacts / dailyContactGoal) * 100), 100) : 0;
          const apptPct  = dailyApptGoal  > 0 ? Math.min(Math.round((todayAppts    / dailyApptGoal)    * 100), 100) : 0;
          const workStart = 8;
          const workEnd   = 20;
          const hNow      = now.getHours() + now.getMinutes() / 60;
          const hLeft     = Math.max(0, workEnd - hNow);
          const hTotal    = workEnd - workStart;
          const timePct   = Math.min(Math.round(((hNow - workStart) / hTotal) * 100), 100);
          const hLeftStr  = hLeft > 0 ? (Math.floor(hLeft) + 'h ' + Math.round((hLeft % 1) * 60) + 'm left') : 'End of day';
          const expectedDials = Math.round((timePct / 100) * dailyDialGoal);
          const paceGap = todayDials - expectedDials;
          const paceColor = paceGap >= 0 ? 'var(--green)' : paceGap >= -10 ? 'var(--amber)' : 'var(--red)';
          const paceLabel = paceGap >= 0 ? `▲ ${paceGap} ahead` : `▼ ${Math.abs(paceGap)} behind`;

          const Meter = ({ label, val, goal, p }) => (
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
                <span style={{fontSize:'10px',fontWeight:'700',color:'rgba(255,255,255,0.45)',letterSpacing:'0.07em'}}>{label}</span>
                <span style={{fontSize:'12px',fontWeight:'800',color: p >= 100 ? 'var(--green)' : p >= 60 ? 'var(--amber)' : 'rgba(255,255,255,0.75)'}}>{val}<span style={{fontWeight:'400',color:'rgba(255,255,255,0.25)'}}>/{goal}</span></span>
              </div>
              <div style={{height:'8px',background:'rgba(255,255,255,0.07)',borderRadius:'4px',overflow:'hidden',boxShadow:'inset 0 1px 2px rgba(0,0,0,0.3)'}}>
                <div style={{height:'100%',width:`${p}%`,background:p>=100?'var(--green)':p>=60?'var(--amber)':'var(--red)',borderRadius:'4px',transition:'width 0.4s',boxShadow:`0 0 6px ${p>=100?'rgba(16,185,129,0.5)':p>=60?'rgba(245,158,11,0.5)':'rgba(239,68,68,0.5)'}`}} />
              </div>
            </div>
          );

          return (
            <div style={{
              background:'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.7) 100%)',
              border:'1px solid rgba(255,255,255,0.1)',
              borderLeft:'3px solid var(--blue)',
              borderRadius:10, padding:'14px 18px', marginBottom:'14px',
              display:'flex', alignItems:'center', gap:'20px',
              boxShadow:'0 2px 12px rgba(0,0,0,0.3)'
            }}>
              <div style={{flexShrink:0}}>
                <div style={{fontSize:'10px',fontWeight:'800',color:'rgba(255,255,255,0.35)',letterSpacing:'0.1em',marginBottom:'3px'}}>TODAY\'S PACE</div>
                <div style={{fontSize:'24px',fontWeight:'800',color:paceColor,fontFamily:"'Syne',sans-serif",lineHeight:1}}>{paceLabel}</div>
                <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginTop:'4px'}}>{hLeftStr}</div>
              </div>
              <div style={{width:'1px',height:'44px',background:'rgba(255,255,255,0.07)',flexShrink:0}} />
              <div style={{flex:1,display:'flex',gap:'18px',minWidth:0}}>
                <Meter label="DIALS"    val={todayDials}    goal={dailyDialGoal}    p={dialPct} />
                <Meter label="CONTACTS" val={todayContacts} goal={dailyContactGoal} p={contPct} />
                <Meter label="APPTS"    val={todayAppts}    goal={dailyApptGoal}    p={apptPct} />
              </div>
              <div style={{flexShrink:0,textAlign:'right'}}>
                <div style={{fontSize:'10px',color:'rgba(255,255,255,0.35)',marginBottom:'3px',letterSpacing:'0.05em'}}>TIME USED</div>
                <div style={{fontSize:'20px',fontWeight:'800',color:'rgba(255,255,255,0.8)'}}>{timePct}%</div>
                <div style={{fontSize:'10px',color:'rgba(255,255,255,0.25)'}}>of work day</div>
              </div>
            </div>
          );
        })()}

        {/* ── MISSION STATUS BAR ──────────────────────────────────── */}
        {(() => {
          const missionColor = weekSubmitted >= APPS_GOAL_WEEK ? 'var(--green)' : weekSubmitted >= 3 ? 'var(--amber)' : 'var(--red)';
          const pctFill      = Math.min(Math.round((weekSubmitted / APPS_GOAL_WEEK) * 100), 100);
          return (
            <div style={{
              background:`linear-gradient(90deg, ${weekSubmitted >= APPS_GOAL_WEEK ? 'rgba(16,185,129,0.12)' : weekSubmitted >= 3 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'} 0%, transparent 100%)`,
              border:`1px solid ${missionColor}35`,
              borderLeft:`3px solid ${missionColor}`,
              borderRadius:8, padding:'0.6rem 1rem', marginBottom:'1rem',
              display:'flex', alignItems:'center', gap:'1rem'
            }}>
              <span style={{fontSize:'2rem',fontWeight:900,color:missionColor,fontFamily:"'Syne',sans-serif",lineHeight:1,flexShrink:0}}>
                {weekSubmitted}<span style={{fontSize:'1rem',color:'rgba(255,255,255,0.25)',fontWeight:400}}>/{APPS_GOAL_WEEK}</span>
              </span>
              <span style={{fontSize:'0.78rem',fontWeight:800,color:missionColor,flexShrink:0,letterSpacing:'0.04em'}}>
                {weekSubmitted >= APPS_GOAL_WEEK ? '🎯 MISSION COMPLETE' : `APPS THIS WEEK — ${APPS_GOAL_WEEK - weekSubmitted} TO GO`}
              </span>
              <div style={{flex:1,background:'rgba(255,255,255,0.06)',borderRadius:4,height:8,overflow:'hidden',boxShadow:'inset 0 1px 2px rgba(0,0,0,0.3)'}}>
                <div style={{width:`${pctFill}%`,height:'100%',background:`linear-gradient(90deg, ${missionColor}80, ${missionColor})`,borderRadius:4,transition:'width 0.4s',boxShadow:`0 0 8px ${missionColor}50`}} />
              </div>
              <span style={{fontSize:'0.7rem',color:'#64748b',flexShrink:0}}>
                Last wk: <span style={{color: weekSubmitted >= lastWeekSubmitted ? 'var(--green)' : 'var(--red)',fontWeight:800}}>{lastWeekSubmitted}</span>
              </span>
            </div>
          );
        })()}

        {/* ── TODAY'S ACTIVITY CARD ───────────────────────────────── */}
        <div style={{
          background:'linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(30,41,59,0.5) 100%)',
          borderRadius:10, padding:'1rem 1.25rem', marginBottom:'1rem',
          border:'1px solid rgba(255,255,255,0.07)',
          borderLeft:'3px solid rgba(59,130,246,0.6)'
        }}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.85rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontWeight:700,fontSize:'0.9rem',color:'#e2e8f0'}}>Today's Activity</span>
            </div>
            <span style={{fontSize:'0.7rem',color:'#94a3b8',background:'rgba(255,255,255,0.04)',padding:'0.2rem 0.6rem',borderRadius:6,border:'1px solid rgba(255,255,255,0.06)'}}>{TODAY_KEY} · 710 dials/wk target</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'1.5rem'}}>
            <ProgressBar value={todayDials}    goal={dailyDialGoal}    label="Dials" />
            <ProgressBar value={todayContacts} goal={dailyContactGoal} label="Contacts" />
            <ProgressBar value={todayAppts}    goal={dailyApptGoal}    label="Appts Set" />
          </div>
        </div>

        {/* ── MAIN 2-COLUMN GRID ─────────────────────────────────── */}
        <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:'1rem',marginBottom:'1rem'}}>

          {/* LEFT: Lead Intake */}
          <div style={{
            background:'linear-gradient(160deg, rgba(15,23,42,0.9) 0%, rgba(23,32,54,0.7) 100%)',
            borderRadius:10, padding:'1rem',
            border:'1px solid rgba(255,255,255,0.07)',
            borderTop:'2px solid var(--blue)'
          }}>
            <SectionHeader label="Lead Intake" accent="var(--blue)" />

            {[
              {label:'Last 7 Days',  val:leadsLast7,  color:'var(--blue)'},
              {label:'Last 30 Days', val:leadsLast30, color:'#818cf8'},
              {label:'MTD',          val:leadsMTD,    color:'#a78bfa'},
            ].map(({label,val,color}) => (
              <div key={label} style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                background:'rgba(255,255,255,0.03)', borderRadius:8,
                padding:'0.55rem 0.8rem', marginBottom:'0.4rem',
                border:'1px solid rgba(255,255,255,0.05)'
              }}>
                <span style={{fontSize:'0.72rem',color:'#94a3b8',fontWeight:600}}>{label}</span>
                <span style={{fontSize:'1.3rem',fontWeight:900,color,fontFamily:"'Syne',sans-serif"}}>{val}</span>
              </div>
            ))}

            <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:'0.7rem',marginTop:'0.6rem'}}>
              <div style={{fontSize:'0.63rem',color:'#94a3b8',marginBottom:'0.6rem',textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:700}}>Today's Queue</div>
              {/* Total due today */}
              <div style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                background:'rgba(59,130,246,0.08)', borderRadius:8,
                padding:'0.55rem 0.75rem', marginBottom:'0.5rem',
                border:'1px solid rgba(59,130,246,0.2)'
              }}>
                <span style={{fontSize:'0.72rem',color:'#94a3b8',fontWeight:600}}>Due Today</span>
                <span style={{fontSize:'1.4rem',fontWeight:900,color:'var(--blue)',fontFamily:"'Syne',sans-serif"}}>{dueToday.length}</span>
              </div>
              {/* AM / PM split — clickable to launch dial session */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.4rem',marginBottom:'0.5rem'}}>
                {[
                  {slot:'AM', count:dueTodayAM.length, color:'#93c5fd', border:'rgba(147,197,253,0.25)', bg:'rgba(59,130,246,0.08)'},
                  {slot:'PM', count:dueTodayPM.length, color:'#a5b4fc', border:'rgba(165,180,252,0.25)', bg:'rgba(99,102,241,0.08)'},
                ].map(({slot, count, color, border, bg}) => (
                  <div key={slot}
                    onClick={() => onStartDialSlot && count > 0 && setConfirmSlot(slot)}
                    style={{
                      background:bg, borderRadius:7, padding:'0.55rem 0.65rem',
                      border:`1px solid ${border}`,
                      textAlign:'center',
                      cursor: onStartDialSlot && count > 0 ? 'pointer' : 'default',
                      transition:'all 0.15s',
                      userSelect:'none',
                    }}
                    onMouseEnter={e => { if (onStartDialSlot && count > 0) e.currentTarget.style.opacity='0.8'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity='1'; }}
                  >
                    <div style={{fontSize:'0.6rem',color:'#64748b',fontWeight:700,letterSpacing:'0.06em',marginBottom:'2px'}}>{slot} SESSION</div>
                    <div style={{fontSize:'1.2rem',fontWeight:900,color,fontFamily:"'Syne',sans-serif"}}>{count}</div>
                    {onStartDialSlot && count > 0 && (
                      <div style={{fontSize:'0.58rem',color,opacity:0.6,marginTop:'2px'}}>tap to start ▶</div>
                    )}
                  </div>
                ))}
              </div>
              {/* Called today */}
              <div style={{display:'flex',justifyContent:'space-between',padding:'0.3rem 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                <span style={{fontSize:'0.71rem',color:'#64748b'}}>Called today</span>
                <span style={{fontSize:'0.82rem',fontWeight:700,color:calledToday.length>0?'var(--green)':'#64748b'}}>{calledToday.length}<span style={{color:'rgba(255,255,255,0.2)',fontWeight:400}}> / {dueToday.length}</span></span>
              </div>
              {/* Top lead types in today's queue */}
              {topLeadTypes(dueToday).map(([type, count]) => (
                <div key={type} style={{display:'flex',justifyContent:'space-between',padding:'0.28rem 0',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                  <span style={{fontSize:'0.71rem',color:'#64748b'}}>{type}</span>
                  <span style={{fontSize:'0.8rem',fontWeight:700,color:'#94a3b8'}}>{count}</span>
                </div>
              ))}
            </div>

            <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:'0.7rem',marginTop:'0.6rem'}}>
              <div style={{fontSize:'0.63rem',color:'#94a3b8',marginBottom:'0.5rem',textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:700}}>Pipeline Stage</div>
              {[
                ['New', stageCounts.new, '#64748b'],
                ['Contacted', stageCounts.contacted, 'var(--blue)'],
                ['App Submitted', stageCounts.app_submitted, 'var(--amber)'],
                ['Underwriting', stageCounts.underwriting, 'var(--green)'],
              ].map(([s,c,col]) => (
                <div key={s} style={{display:'flex',justifyContent:'space-between',padding:'0.22rem 0',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                  <span style={{fontSize:'0.72rem',color:'#64748b'}}>{s}</span>
                  <span style={{fontSize:'0.82rem',fontWeight:700,color:col}}>{c}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: KPIs + Financial stacked */}
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>

            {/* Weekly KPIs */}
            <div style={{
              background:'linear-gradient(160deg, rgba(15,23,42,0.9) 0%, rgba(23,32,54,0.7) 100%)',
              borderRadius:10, padding:'1rem',
              border:'1px solid rgba(255,255,255,0.07)',
              borderTop:'2px solid var(--amber)'
            }}>
              <SectionHeader label="Weekly KPIs" accent="var(--amber)" />
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.65rem',marginBottom:'0.75rem'}}>
                <KpiCard label="Contact Rate" value={contactRate} prevValue={lastContactRate} target={15} />
                <KpiCard label="Show Rate"    value={showRate}    prevValue={lastShowRate}    target={70} />
                <KpiCard label="Close Rate"   value={closeRate}   prevValue={lastCloseRate}   target={40} />
              </div>
              {/* Week Dials as a full-width bar */}
              <div style={{
                background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'0.8rem 1rem',
                border:`1px solid ${weekDials>=710?'rgba(16,185,129,0.3)':'rgba(255,255,255,0.06)'}`,
                display:'flex', alignItems:'center', gap:'1rem'
              }}>
                <div style={{flexShrink:0}}>
                  <div style={{fontSize:'0.62rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:700,marginBottom:'2px'}}>Week Dials</div>
                  <div style={{fontSize:'2rem',fontWeight:900,color:weekDials>=710?'var(--green)':'var(--amber)',fontFamily:"'Syne',sans-serif",lineHeight:1}}>
                    {weekDials}<span style={{fontSize:'1rem',color:'rgba(255,255,255,0.2)',fontWeight:400}}>/710</span>
                  </div>
                  <div style={{fontSize:'0.65rem',color:'#94a3b8',marginTop:'2px'}}>{weekDials>=710?'✓ Weekly goal hit':`${710-weekDials} remaining`}</div>
                </div>
                <div style={{flex:1}}>
                  <div style={{height:14,background:'rgba(255,255,255,0.05)',borderRadius:7,overflow:'hidden',boxShadow:'inset 0 2px 4px rgba(0,0,0,0.3)'}}>
                    <div style={{
                      width:`${Math.min(Math.round((weekDials/710)*100),100)}%`,height:'100%',
                      background:weekDials>=710?'linear-gradient(90deg,rgba(16,185,129,0.7),var(--green))':'linear-gradient(90deg,rgba(245,158,11,0.6),var(--amber))',
                      borderRadius:7,transition:'width 0.4s',
                      boxShadow:weekDials>=710?'0 0 10px rgba(16,185,129,0.4)':'0 0 10px rgba(245,158,11,0.3)'
                    }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Tracker */}
            <div style={{
              background:'linear-gradient(160deg, rgba(15,23,42,0.9) 0%, rgba(23,32,54,0.7) 100%)',
              borderRadius:10, padding:'1rem',
              border:'1px solid rgba(255,255,255,0.07)',
              borderTop:'2px solid var(--green)',
              flex:1
            }}>
              <SectionHeader label="Financial Tracker" accent="var(--green)" />

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.65rem',marginBottom:'0.85rem'}}>
                {[
                  {label:'Est. Commission', val:`$${estWeekCommission.toLocaleString()}`, color:'var(--green)', sub:'this week'},
                  {label:'Weekly Overhead',  val:`-$${WEEKLY_OVERHEAD.toLocaleString()}`,  color:'var(--red)',   sub:'fixed costs'},
                  {label:'Weekly Target',    val:`$${WEEKLY_TARGET.toLocaleString()}`,      color:'#e2e8f0',     sub:'break-even+'},
                ].map(({label,val,color,sub}) => (
                  <div key={label} style={{
                    background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'0.75rem 0.85rem',
                    border:'1px solid rgba(255,255,255,0.06)'
                  }}>
                    <div style={{fontSize:'0.63rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:700,marginBottom:'4px'}}>{label}</div>
                    <div style={{fontSize:'1.5rem',fontWeight:900,color,fontFamily:"'Syne',sans-serif",lineHeight:1}}>{val}</div>
                    <div style={{fontSize:'0.63rem',color:'#64748b',marginTop:'3px'}}>{sub}</div>
                  </div>
                ))}
              </div>

              <div style={{marginBottom:'0.6rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                  <span style={{fontSize:'0.72rem',color:'#64748b',fontWeight:600}}>Break-even Progress</span>
                  <span style={{fontSize:'0.82rem',fontWeight:800,color:progressColor(breakEvenPct)}}>{breakEvenPct}%</span>
                </div>
                <div style={{height:14,background:'rgba(255,255,255,0.05)',borderRadius:7,overflow:'hidden',boxShadow:'inset 0 2px 4px rgba(0,0,0,0.3)'}}>
                  <div style={{
                    width:`${breakEvenPct}%`,height:'100%',
                    background:breakEvenPct>=100?'linear-gradient(90deg,rgba(16,185,129,0.7),var(--green))':breakEvenPct>=50?'linear-gradient(90deg,rgba(245,158,11,0.6),var(--amber))':'linear-gradient(90deg,rgba(239,68,68,0.6),var(--red))',
                    borderRadius:7,transition:'width 0.4s',
                    boxShadow:`0 0 10px ${breakEvenPct>=100?'rgba(16,185,129,0.4)':breakEvenPct>=50?'rgba(245,158,11,0.3)':'rgba(239,68,68,0.3)'}`
                  }} />
                </div>
              </div>

              <div style={{display:'flex',gap:'0.6rem',marginTop:'0.6rem'}}>
                <div style={{
                  flex:1, background:'rgba(255,255,255,0.02)', borderRadius:8, padding:'0.55rem 0.75rem',
                  border:`1px solid ${weekSubmitted>=APPS_GOAL_WEEK?'rgba(16,185,129,0.25)':'rgba(255,255,255,0.05)'}`
                }}>
                  <div style={{fontSize:'0.62rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700,marginBottom:'3px'}}>Apps Goal</div>
                  <div style={{fontSize:'1.1rem',fontWeight:800,color:weekSubmitted>=APPS_GOAL_WEEK?'var(--green)':'var(--amber)'}}>
                    {weekSubmitted} <span style={{color:'rgba(255,255,255,0.2)',fontWeight:400,fontSize:'0.85rem'}}>/ {APPS_GOAL_WEEK}</span>
                  </div>
                </div>
                <div style={{
                  flex:1, background:'rgba(255,255,255,0.02)', borderRadius:8, padding:'0.55rem 0.75rem',
                  border:'1px solid rgba(255,255,255,0.05)'
                }}>
                  <div style={{fontSize:'0.62rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700,marginBottom:'3px'}}>Contract</div>
                  <div style={{fontSize:'1rem',fontWeight:800,color:'var(--amber)'}}>{CONTRACT_LEVEL} → {CONTRACT_TARGET}</div>
                </div>
                <div style={{
                  flex:1, background:'rgba(255,255,255,0.02)', borderRadius:8, padding:'0.55rem 0.75rem',
                  border:'1px solid rgba(255,255,255,0.05)'
                }}>
                  <div style={{fontSize:'0.62rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700,marginBottom:'3px'}}>APV (wk)</div>
                  <div style={{fontSize:'1rem',fontWeight:800,color:'var(--green)'}}>${Math.round(weekAPV).toLocaleString()}</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── UNDERWRITING PIPELINE ─────────────────────────── */}
        <div style={{
          background:'linear-gradient(160deg, rgba(15,23,42,0.9) 0%, rgba(23,32,54,0.7) 100%)',
          borderRadius:10, padding:'1.25rem',
          border:'1px solid rgba(255,255,255,0.07)',
          borderTop:'2px solid var(--amber)',
          marginBottom:'1rem'
        }}>
          <SectionHeader
            label="Underwriting Pipeline"
            accent="var(--amber)"
            badge={uwLeads.filter(l => (daysSince(l.submittedDate)||0) > 7).length > 0 ? (
              <span style={{background:'var(--red)',color:'#fff',borderRadius:20,fontSize:'0.7rem',fontWeight:800,padding:'0.2rem 0.7rem',letterSpacing:'0.04em'}}>
                {uwLeads.filter(l => (daysSince(l.submittedDate)||0) > 7).length} STUCK
              </span>
            ) : null}
          />
          {uwLeads.length === 0 ? (
            <div style={{color:'#64748b',fontSize:'0.85rem',textAlign:'center',padding:'1.5rem 0',fontStyle:'italic'}}>No apps in pipeline — close something.</div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.8rem'}}>
              <thead>
                <tr>
                  {['Name','Lead Type','Carrier','Premium','Submitted','Days','Pending Reqs'].map(h => (
                    <th key={h} style={{padding:'0.4rem 0.7rem',borderBottom:'1px solid rgba(255,255,255,0.07)',textAlign:'left',fontWeight:700,fontSize:'0.67rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uwLeads.map((l, rowIdx) => {
                  const days = daysSince(l.submittedDate);
                  const sc   = stuckColor(days);
                  const rawReqs = Array.isArray(l.pendingReqs) ? l.pendingReqs : [];
                  const reqs = rawReqs.filter(r => !r.done).map(r => r.label || '').filter(Boolean);
                  return (
                    <tr key={l.id} style={{background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                      <td style={{padding:'0.5rem 0.7rem',color:'var(--blue)',fontWeight:700,cursor:'pointer'}} onClick={()=>{setPrevView('dashboard');setOpenId(l.id);setView('contact');}}>{l.name}</td>
                      <td style={{padding:'0.5rem 0.7rem',color:'#64748b'}}>{l.leadType||'—'}</td>
                      <td style={{padding:'0.5rem 0.7rem',color:'#64748b'}}>{l.carrier||'—'}</td>
                      <td style={{padding:'0.5rem 0.7rem',color:'var(--green)',fontWeight:700}}>{l.expectedPremium?`$${parseFloat(l.expectedPremium).toLocaleString()}`:'—'}</td>
                      <td style={{padding:'0.5rem 0.7rem',color:'#94a3b8'}}>{l.submittedDate||'—'}</td>
                      <td style={{padding:'0.5rem 0.7rem'}}>
                        <span style={{color:sc,fontWeight:800,background:`${sc}15`,padding:'0.2rem 0.5rem',borderRadius:5,fontSize:'0.78rem'}}>
                          {days !== null ? `${days}d` : '—'}
                        </span>
                      </td>
                      <td style={{padding:'0.5rem 0.7rem',color:'#64748b'}}>
                        {reqs.length > 0 ? reqs.join(', ') : <span style={{color:'var(--green)',fontWeight:700}}>✓ Clear</span>}
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
          <div style={{
            background:'linear-gradient(160deg, rgba(15,23,42,0.9) 0%, rgba(23,32,54,0.7) 100%)',
            borderRadius:10, padding:'1.25rem',
            border:'1px solid rgba(255,255,255,0.07)',
            borderTop:'2px solid var(--green)',
            marginBottom:'1rem'
          }}>
            <SectionHeader
              label="5 R's Annual Review"
              accent="var(--green)"
              badge={<span style={{background:'rgba(16,185,129,0.2)',color:'var(--green)',borderRadius:20,fontSize:'0.7rem',fontWeight:800,padding:'0.2rem 0.7rem',border:'1px solid rgba(16,185,129,0.3)'}}>{issuedLeads.length} ISSUED</span>}
            />
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
                  background:'rgba(16,185,129,0.04)', borderRadius:8, padding:'0.85rem 1rem',
                  marginBottom:'0.6rem', border:'1px solid rgba(16,185,129,0.12)',
                  borderLeft:'3px solid var(--green)'
                }}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.65rem'}}>
                    <div>
                      <span style={{fontWeight:700,fontSize:'0.9rem',color:'#e2e8f0'}}>{l.name}</span>
                      {l.carrier && <span style={{fontSize:'0.72rem',color:'#64748b',marginLeft:'0.5rem'}}>· {l.carrier}</span>}
                    </div>
                    <span style={{fontSize:'0.7rem',color:'#94a3b8',fontFamily:"'JetBrains Mono',monospace"}}>{l.phone}</span>
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
                        padding:'0.3rem 0.75rem', fontSize:'0.72rem', fontWeight:700,
                        color:'var(--green)', background:'rgba(16,185,129,0.1)',
                        border:'1px solid rgba(16,185,129,0.25)', borderRadius:6, cursor:'pointer',
                        transition:'background 0.15s'
                      }}>{label}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── DOWNLINE PIPELINE (placeholder) ──────────────────── */}
        <div style={{
          background:'rgba(15,23,42,0.4)', borderRadius:10, padding:'1rem 1.25rem',
          border:'1px dashed rgba(255,255,255,0.05)', opacity:0.5
        }}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
            <span style={{fontWeight:700,fontSize:'0.85rem',color:'#64748b'}}>Downline Pipeline</span>
            <span style={{fontSize:'0.67rem',color:'#1e293b',background:'rgba(255,255,255,0.03)',borderRadius:10,padding:'0.18rem 0.6rem',border:'1px solid rgba(255,255,255,0.04)'}}>Activate when first agent contracts</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.75rem'}}>
            {[1,2,3].map(n => (
              <div key={n} style={{background:'rgba(255,255,255,0.02)',borderRadius:8,padding:'0.75rem',border:'1px dashed rgba(255,255,255,0.04)'}}>
                <div style={{fontSize:'0.68rem',fontWeight:700,color:'#1e293b',marginBottom:'0.3rem'}}>AGENT {n}</div>
                <div style={{fontSize:'0.68rem',color:'#0f172a'}}>— open slot —</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>

    {/* ── SLOT LAUNCH CONFIRMATION MODAL ─────────────────────────── */}
    {confirmSlot && (
      <div style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9999,
        display:'flex', alignItems:'center', justifyContent:'center'
      }} onClick={() => setConfirmSlot(null)}>
        <div style={{
          background:'#0f172a', borderRadius:14, padding:'2rem',
          border:'1px solid rgba(255,255,255,0.1)',
          borderTop:`3px solid ${confirmSlot === 'AM' ? '#93c5fd' : '#a5b4fc'}`,
          maxWidth:380, width:'90%', boxShadow:'0 24px 60px rgba(0,0,0,0.6)'
        }} onClick={e => e.stopPropagation()}>
          <div style={{marginBottom:'0.4rem',fontSize:'0.65rem',color:'#64748b',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}>Launch Dial Session</div>
          <div style={{fontSize:'1.6rem',fontWeight:900,color:'#e2e8f0',fontFamily:"'Syne',sans-serif",marginBottom:'0.25rem'}}>
            {confirmSlot} Session
          </div>
          <div style={{fontSize:'0.85rem',color:'#94a3b8',marginBottom:'1.5rem',lineHeight:1.5}}>
            <span style={{color:confirmSlot === 'AM' ? '#93c5fd' : '#a5b4fc',fontWeight:700,fontSize:'1.1rem'}}>
              {confirmSlot === 'AM' ? dueTodayAM.length : dueTodayPM.length}
            </span> leads due today in this slot.
            <br/>Power Dialer will start automatically.
          </div>
          <div style={{display:'flex',gap:'0.75rem'}}>
            <button onClick={() => setConfirmSlot(null)} style={{
              flex:1, padding:'0.7rem', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)',
              background:'transparent', color:'#64748b', fontSize:'0.85rem', fontWeight:700, cursor:'pointer'
            }}>Cancel</button>
            <button onClick={() => {
              setConfirmSlot(null);
              if (onStartDialSlot) onStartDialSlot(confirmSlot);
            }} style={{
              flex:2, padding:'0.7rem', borderRadius:8, border:'none',
              background: confirmSlot === 'AM' ? 'rgba(59,130,246,0.8)' : 'rgba(99,102,241,0.8)',
              color:'#fff', fontSize:'0.9rem', fontWeight:800, cursor:'pointer',
              boxShadow:`0 0 20px ${confirmSlot === 'AM' ? 'rgba(59,130,246,0.4)' : 'rgba(99,102,241,0.4)'}`
            }}>▶ Start {confirmSlot} Session</button>
          </div>
        </div>
      </div>
    )}
    </React.Fragment>
  );
}

export default DashboardTab;
