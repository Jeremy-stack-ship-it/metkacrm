import React from 'react';
import { dayKey } from '../lib/activityLog.js';

const XP_PER = { dial: 1, contact: 5, appointment: 15, audit_ran: 25 };
const APP_XP = 100;

const RANKS = [
  { min: 0,    lvl: 1, name: 'RECRUIT'            },
  { min: 100,  lvl: 2, name: 'FIELD AGENT'        },
  { min: 300,  lvl: 3, name: 'UNDERWRITER'        },
  { min: 700,  lvl: 4, name: 'SR. UNDERWRITER'    },
  { min: 1500, lvl: 5, name: 'PROTECTIVE STEWARD' },
];

export default function WeeklyCampaignView({ activity = [], leads = [], goals = {}, financialConfig = {} }) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const toKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const TODAY_KEY = toKey(now);

  const APP_GOAL = financialConfig?.appsGoalWeek || 5;

  // ── Week structure (Sat → Fri, Symmetry week) ────────────────────────
  function buildWeekDays(offset = 0) {
    const day = now.getDay();
    const daysFromSat = (day - 6 + 7) % 7;
    const saturday = new Date(now);
    saturday.setDate(now.getDate() - daysFromSat - offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(saturday);
      dd.setDate(saturday.getDate() + i);
      const key = toKey(dd);
      return {
        key,
        date: dd,
        label: ['SAT','SUN','MON','TUE','WED','THU','FRI'][dd.getDay()],
      };
    });
  }

  const weekDays     = buildWeekDays(0);
  const lastWeekDays = buildWeekDays(1);

  // ── Event counter ────────────────────────────────────────────────────
  function countOn(dateKey, type) {
    return activity.filter(e => {
      const dk = e?.date || (e?.ts || '').substring(0, 10);
      return dk === dateKey && e?.type === type;
    }).length;
  }

  function appsOn(dateKey) {
    return leads.filter(l => {
      if (!l.submittedDate) return false;
      return dayKey(l.submittedDate) === dateKey;
    }).length;
  }

  // ── Per-day row ──────────────────────────────────────────────────────
  function buildRow(d) {
    const dials    = countOn(d.key, 'dial');
    const contacts = countOn(d.key, 'contact');
    const appts    = countOn(d.key, 'appointment');
    const audits   = countOn(d.key, 'audit_ran');
    const apps     = appsOn(d.key);
    const xp = dials * XP_PER.dial + contacts * XP_PER.contact +
               appts * XP_PER.appointment + audits * XP_PER.audit_ran +
               apps * APP_XP;
    return { ...d, dials, contacts, appts, audits, apps, xp };
  }

  const rows     = weekDays.map(buildRow);
  const lastRows = lastWeekDays.map(buildRow);

  // ── Totals ───────────────────────────────────────────────────────────
  const sum = (arr, k) => arr.reduce((s, r) => s + r[k], 0);
  const wDials    = sum(rows, 'dials');
  const wContacts = sum(rows, 'contacts');
  const wAudits   = sum(rows, 'audits');
  const wApps     = sum(rows, 'apps');
  const wXP       = sum(rows, 'xp');
  const lwDials   = sum(lastRows, 'dials');
  const lwApps    = sum(lastRows, 'apps');
  const lwXP      = sum(lastRows, 'xp');

  // ── Rank ─────────────────────────────────────────────────────────────
  const rank = [...RANKS].reverse().find(r => wXP >= r.min) || RANKS[0];
  const nextRank = RANKS.find(r => r.lvl === rank.lvl + 1);
  const prevMin  = rank.min;
  const nextMin  = nextRank?.min ?? prevMin + 1;
  const rankPct  = nextRank ? Math.min(((wXP - prevMin) / (nextMin - prevMin)) * 100, 100) : 100;

  // ── Streak (consecutive days with ≥1 dial, going backward from today) ─
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const k = toKey(d);
    const hasDials = activity.some(e => {
      const dk = e?.date || (e?.ts || '').substring(0, 10);
      return dk === k && e?.type === 'dial';
    });
    if (hasDials) { streak++; }
    else if (i > 0) { break; } // gap — stop
  }

  // ── Odds Meter ───────────────────────────────────────────────────────
  const D7_KEYS = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - i); return toKey(d);
  });
  const r7Dials = activity.filter(e => {
    const dk = e?.date || (e?.ts || '').substring(0, 10);
    return D7_KEYS.includes(dk) && e?.type === 'dial';
  }).length;
  const r7Apps = leads.filter(l => l.submittedDate && D7_KEYS.includes(dayKey(l.submittedDate))).length;
  const oddsRate = r7Apps > 0 ? Math.round(r7Dials / r7Apps) : null;

  const lastAppLead = [...leads]
    .filter(l => l.submittedDate)
    .sort((a, b) => b.submittedDate.localeCompare(a.submittedDate))[0];
  const lastAppKey = lastAppLead ? dayKey(lastAppLead.submittedDate) : null;
  const dialsSinceApp = lastAppKey != null
    ? activity.filter(e => {
        const dk = e?.date || (e?.ts || '').substring(0, 10);
        return e?.type === 'dial' && dk >= lastAppKey;
      }).length
    : null;
  const isDue = !!(oddsRate && dialsSinceApp != null && dialsSinceApp >= oddsRate);

  // ── Mission status ───────────────────────────────────────────────────
  const appPct = Math.min((wApps / APP_GOAL) * 100, 100);
  const todayIdx = rows.findIndex(r => r.key === TODAY_KEY);
  const daysRemaining = todayIdx >= 0 ? 6 - todayIdx : 0;

  let missionLabel, missionColor;
  if (wApps >= APP_GOAL) {
    missionLabel = '✅ MISSION COMPLETE'; missionColor = 'var(--green)';
  } else if (daysRemaining === 0 && wApps < APP_GOAL) {
    missionLabel = '⚠️ INCOMPLETE'; missionColor = 'var(--red)';
  } else {
    const appsNeeded = APP_GOAL - wApps;
    const pace = todayIdx > 0 ? wApps / todayIdx : 0;
    const projected = pace * 6;
    if (projected >= APP_GOAL * 0.85) {
      missionLabel = '🟡 ON TRACK'; missionColor = 'var(--amber)';
    } else {
      missionLabel = '🔴 BEHIND MISSION'; missionColor = 'var(--red)';
    }
  }

  // ── Week label ────────────────────────────────────────────────────────
  const fmtShort = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekLabel = `${fmtShort(weekDays[0].date)} – ${fmtShort(weekDays[6].date)}`;
  const weekNum = (() => {
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.ceil(((now - start) / 86400000 + 1) / 7);
  })();

  // ── Delta helper for last week comparison ───────────────────────────
  function Delta({ curr, prev }) {
    if (curr > prev) return <span style={{color:'var(--green)',fontSize:12,marginLeft:4}}>▲</span>;
    if (curr < prev) return <span style={{color:'var(--red)',fontSize:12,marginLeft:4}}>▼</span>;
    return <span style={{color:'var(--t4)',fontSize:12,marginLeft:4}}>—</span>;
  }

  return (
    <div style={{flex:1,overflowY:'auto',padding:'28px',background:'var(--surface-2)',minHeight:0}}>
      <div style={{maxWidth:780,margin:'0 auto',display:'flex',flexDirection:'column',gap:14}}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{display:'flex',alignItems:'baseline',gap:12,marginBottom:2}}>
          <h2 style={{margin:0,fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:'var(--t1)',letterSpacing:'0.06em'}}>
            CAMPAIGN BRIEF
          </h2>
          <span style={{fontSize:12,fontWeight:600,color:'var(--t3)',letterSpacing:'0.04em'}}>
            WEEK {weekNum} &middot; {weekLabel}
          </span>
        </div>

        {/* ── Mission Card ───────────────────────────────── */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderLeft:`3px solid ${missionColor}`,borderRadius:12,padding:'18px 20px'}}>
          <div style={{fontSize:11,fontWeight:800,color:'var(--t3)',letterSpacing:'0.1em',marginBottom:10}}>MISSION OBJECTIVE</div>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:10}}>
            <div style={{flex:1,height:10,background:'var(--surface-2)',borderRadius:5,overflow:'hidden',border:'1px solid var(--border)'}}>
              <div style={{
                height:'100%',
                width:`${appPct}%`,
                background: wApps >= APP_GOAL ? 'var(--green)' : wApps > 0 ? 'var(--amber)' : 'var(--red)',
                borderRadius:5,
                transition:'width 0.6s cubic-bezier(0.4,0,0.2,1)',
              }}/>
            </div>
            <span style={{fontSize:18,fontWeight:800,color:missionColor,fontFamily:"'JetBrains Mono',monospace",flexShrink:0,letterSpacing:'-0.01em'}}>
              {wApps}/{APP_GOAL} APPS
            </span>
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:13,fontWeight:700,color:missionColor}}>{missionLabel}</span>
            <span style={{fontSize:12,color:'var(--t3)'}}>
              {daysRemaining > 0 ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left` : 'Week ends today'}
            </span>
          </div>
        </div>

        {/* ── XP + Rank Card ─────────────────────────────── */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderLeft:'3px solid #8B5CF6',borderRadius:12,padding:'18px 20px'}}>
          <div style={{fontSize:11,fontWeight:800,color:'var(--t3)',letterSpacing:'0.1em',marginBottom:12}}>WEEKLY XP &amp; RANK</div>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:12,flexWrap:'wrap'}}>
            <div style={{flexShrink:0}}>
              <span style={{fontSize:30,fontWeight:800,color:'#8B5CF6',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-0.02em'}}>{wXP}</span>
              <span style={{fontSize:12,color:'var(--t3)',marginLeft:5}}>XP</span>
            </div>
            <div style={{width:1,height:36,background:'var(--border)',flexShrink:0}}/>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:'#8B5CF6',letterSpacing:'0.04em'}}>
                LV.{rank.lvl} &mdash; {rank.name}
              </div>
              {nextRank && (
                <div style={{fontSize:11,color:'var(--t3)',marginTop:3}}>
                  {nextRank.min - wXP} XP to {nextRank.name}
                </div>
              )}
            </div>
            <div style={{flexShrink:0,marginLeft:'auto',display:'flex',alignItems:'center',gap:6,padding:'6px 12px',background:'var(--surface-2)',borderRadius:8,border:'1px solid var(--border)'}}>
              <span style={{fontSize:14}}>🔥</span>
              <span style={{fontSize:13,fontWeight:700,color:'var(--t2)'}}>{streak}-day streak</span>
            </div>
          </div>
          {nextRank && (
            <div style={{height:6,background:'var(--surface-2)',borderRadius:3,overflow:'hidden',border:'1px solid var(--border)',marginBottom:12}}>
              <div style={{height:'100%',width:`${rankPct}%`,background:'linear-gradient(90deg,#8B5CF6,#EC4899)',borderRadius:3,transition:'width 0.5s'}}/>
            </div>
          )}
          {/* XP legend */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[
              ['📞','DIAL',1],['🤝','CONTACT',5],['📅','APPT',15],['🛡️','AUDIT',25],['✅','APP',100]
            ].map(([icon,label,xp]) => (
              <div key={label} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',background:'var(--surface-2)',borderRadius:6,border:'1px solid var(--border)'}}>
                <span style={{fontSize:11}}>{icon}</span>
                <span style={{fontSize:11,fontWeight:700,color:'var(--t2)'}}>{label}</span>
                <span style={{fontSize:11,fontWeight:800,color:'#8B5CF6'}}>+{xp}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Field Log Table ────────────────────────────── */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'18px 20px',overflowX:'auto'}}>
          <div style={{fontSize:11,fontWeight:800,color:'var(--t3)',letterSpacing:'0.1em',marginBottom:12}}>FIELD LOG</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:440}}>
            <thead>
              <tr style={{borderBottom:'2px solid var(--border)'}}>
                {['DAY','DIALS','CONTACTS','AUDITS','APPS','XP'].map(h => (
                  <th key={h} style={{padding:'6px 10px',textAlign:h==='DAY'?'left':'right',fontWeight:800,fontSize:11,color:'var(--t3)',letterSpacing:'0.08em'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isFuture = r.key > TODAY_KEY;
                const isToday  = r.key === TODAY_KEY;
                return (
                  <tr key={r.key} style={{
                    background: isToday ? 'rgba(59,130,246,0.05)' : 'transparent',
                    borderBottom:'1px solid var(--border)',
                    opacity: isFuture ? 0.38 : 1,
                  }}>
                    <td style={{padding:'8px 10px',fontWeight:isToday?800:600,color:isToday?'var(--blue)':'var(--t2)',fontSize:12,letterSpacing:'0.04em'}}>
                      {r.label}{isToday?' ◀':''}
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:r.dials>0?'var(--t1)':'var(--t4)',fontFamily:"'JetBrains Mono',monospace"}}>
                      {isFuture ? '—' : r.dials > 0 ? r.dials : '·'}
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:r.contacts>0?'var(--green)':'var(--t4)',fontFamily:"'JetBrains Mono',monospace"}}>
                      {isFuture ? '—' : r.contacts > 0 ? r.contacts : '·'}
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:r.audits>0?'#F59E0B':'var(--t4)',fontFamily:"'JetBrains Mono',monospace"}}>
                      {isFuture ? '—' : r.audits > 0 ? r.audits : '·'}
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:r.apps>0?'var(--green)':'var(--t4)',fontFamily:"'JetBrains Mono',monospace"}}>
                      {isFuture ? '—' : r.apps > 0 ? r.apps : '·'}
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontWeight:800,color:r.xp>0?'#8B5CF6':'var(--t4)',fontFamily:"'JetBrains Mono',monospace"}}>
                      {isFuture ? '—' : r.xp > 0 ? r.xp : '·'}
                    </td>
                  </tr>
                );
              })}
              <tr style={{borderTop:'2px solid var(--border)'}}>
                <td style={{padding:'8px 10px',fontSize:12,fontWeight:800,color:'var(--t1)'}}>TOTAL</td>
                <td style={{padding:'8px 10px',textAlign:'right',fontWeight:800,color:'var(--t1)',fontFamily:"'JetBrains Mono',monospace"}}>{wDials}</td>
                <td style={{padding:'8px 10px',textAlign:'right',fontWeight:800,color:'var(--t1)',fontFamily:"'JetBrains Mono',monospace"}}>{wContacts}</td>
                <td style={{padding:'8px 10px',textAlign:'right',fontWeight:800,color:'var(--t1)',fontFamily:"'JetBrains Mono',monospace"}}>{wAudits}</td>
                <td style={{padding:'8px 10px',textAlign:'right',fontWeight:800,color:wApps>=APP_GOAL?'var(--green)':'var(--t1)',fontFamily:"'JetBrains Mono',monospace"}}>{wApps}</td>
                <td style={{padding:'8px 10px',textAlign:'right',fontWeight:800,color:'#8B5CF6',fontFamily:"'JetBrains Mono',monospace"}}>{wXP}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Odds Meter ─────────────────────────────────── */}
        {oddsRate != null && (
          <div style={{
            background: isDue ? 'rgba(16,185,129,0.07)' : 'var(--surface)',
            border:`1px solid ${isDue?'rgba(16,185,129,0.5)':'var(--border)'}`,
            borderRadius:12,padding:'16px 20px',
          }}>
            <div style={{fontSize:11,fontWeight:800,color:'var(--t3)',letterSpacing:'0.1em',marginBottom:8}}>ODDS METER</div>
            <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
              <div>
                <span style={{fontSize:14,fontWeight:700,color:'var(--t2)'}}>
                  You close every&nbsp;
                  <strong style={{color:'var(--t1)'}}>~{oddsRate}</strong> dials
                </span>
                <span style={{fontSize:12,color:'var(--t3)',marginLeft:6}}>(7-day window)</span>
              </div>
              {dialsSinceApp != null && (
                <>
                  <div style={{width:1,height:20,background:'var(--border)',flexShrink:0}}/>
                  <span style={{fontSize:14,fontWeight:700,color:'var(--t2)'}}>
                    On&nbsp;<strong style={{color:isDue?'var(--green)':'var(--t1)'}}>{dialsSinceApp}</strong>&nbsp;since last app
                  </span>
                </>
              )}
              {isDue && (
                <div style={{marginLeft:'auto',padding:'6px 12px',background:'var(--green)',color:'#fff',borderRadius:7,fontSize:12,fontWeight:800,letterSpacing:'0.04em',flexShrink:0}}>
                  🎯 STATISTICALLY DUE
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Last Week Comparison ───────────────────────── */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'16px 20px'}}>
          <div style={{fontSize:11,fontWeight:800,color:'var(--t3)',letterSpacing:'0.1em',marginBottom:10}}>LAST WEEK</div>
          <div style={{display:'flex',gap:28,flexWrap:'wrap'}}>
            {[
              {label:'APPS',  lw:lwApps,  cw:wApps,  good: v => v >= APP_GOAL},
              {label:'DIALS', lw:lwDials, cw:wDials,  good: null},
              {label:'XP',    lw:lwXP,   cw:wXP,     good: null, suffix:' XP'},
            ].map(({label,lw,cw,good,suffix}) => {
              const baseColor = good ? (good(lw) ? 'var(--green)' : 'var(--t2)') : 'var(--t2)';
              return (
                <div key={label} style={{display:'flex',flexDirection:'column',gap:2}}>
                  <span style={{fontSize:11,fontWeight:700,color:'var(--t3)',letterSpacing:'0.08em'}}>{label}</span>
                  <span style={{fontSize:20,fontWeight:800,color:baseColor,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>
                    {lw}{suffix||''}
                    <Delta curr={cw} prev={lw}/>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
