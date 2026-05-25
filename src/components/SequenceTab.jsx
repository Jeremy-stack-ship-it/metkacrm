// ── SEQUENCE TAB v1.0 ─────────────────────────────────────────────────────────
// Email sequence activity hub: open tracking, active leads, dormant/exhausted
// analysis, per-step analytics, and manual enrollment controls.
//
// Props: leads, upd, setOpenId, setView, setPrevView, seqStats
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo } from 'react';
import SequenceRunsTab from './SequenceRunsTab.jsx';
import { TRACK_SCHEDULES, getTrackLength } from '../lib/sequenceTemplates.js';
import { getTodayCallList, getSequenceStatus, getSequenceBadgeColor } from '../lib/sequenceEngine.js';

// ── TRACK BADGE STYLES ────────────────────────────────────────────────────────
const TC = {
  'new':       { bg:'#EFF6FF', border:'#93C5FD', text:'#1D4ED8', label:'NEW'       },
  're-engage': { bg:'#FFF7ED', border:'#FDB786', text:'#C2410C', label:'RE-ENGAGE' },
  'ghost':     { bg:'#F3F4F6', border:'#D1D5DB', text:'#4B5563', label:'GHOST'     },
  'nurture':   { bg:'#FAF5FF', border:'#D8B4FE', text:'#7E22CE', label:'NURTURE'   },
};

const trackBadge = (track) => {
  const c = TC[track] || TC['new'];
  return React.createElement('span', {
    style: {
      fontSize:'10px', fontWeight:'700', letterSpacing:'0.05em',
      padding:'2px 7px', borderRadius:'4px',
      background:c.bg, border:`1px solid ${c.border}`, color:c.text,
    }
  }, c.label);
};

const fmtTs = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', {
    month:'short', day:'numeric', hour:'numeric', minute:'2-digit',
  });
};

// ── LEAD STATUS HELPERS ───────────────────────────────────────────────────────
const isActive    = (l) => !!l.seqTrack && !l.seqPaused;
const isExhausted = (l) => l.seqPaused && l.seqExitReason === 'exhausted';
const hasEmail    = (l) => (l.seqStep ?? 0) >= 1 && !!l.seqTrack;

// ── INNER TAB DEFINITIONS ─────────────────────────────────────────────────────
const INNER_TABS = [
  { id:'duetoday',  label:'📞 Due Today'     },
  { id:'opens',     label:'📬 Opens'        },
  { id:'active',    label:'⚡ Active'        },
  { id:'dormant',   label:'👻 Never Opened'  },
  { id:'exhausted', label:'📭 Exhausted'     },
  { id:'analytics', label:'📊 By Step'       },
  { id:'engine',    label:'🤖 Engine'        },
];

// ── TABLE HEADER STYLE ────────────────────────────────────────────────────────
const TH_STYLE = {
  padding:'8px 12px', textAlign:'left', fontSize:'10px',
  fontWeight:'700', color:'var(--t3)', letterSpacing:'0.06em', whiteSpace:'nowrap',
};
const TD_STYLE = { padding:'10px 12px', fontSize:'12px' };

// ─────────────────────────────────────────────────────────────────────────────

export default function SequenceTab({ leads, upd, setOpenId, setView, setPrevView, seqStats = null }) {
  const [innerTab,    setInnerTab]    = useState('duetoday');
  const [enrollId,    setEnrollId]    = useState(null);
  const [enrollTrack, setEnrollTrack] = useState('re-engage');

  // ── DUE TODAY call list ──────────────────────────────────────────────────
  const dueToday = getTodayCallList(leads, 50);

  const renderDueToday = () => {
    if (dueToday.length === 0) {
      return React.createElement('div', {
        style:{ padding:'2rem', color:'var(--t4)', fontSize:'13px', textAlign:'center' }
      }, '✅ No sequence dials due today.');
    }
    return React.createElement('div', { style:{ padding:'8px' } },
      React.createElement('div', {
        style:{
          display:'flex', alignItems:'center', gap:'10px',
          padding:'10px 14px', marginBottom:'8px',
          background:'rgba(239,68,68,0.08)', borderRadius:'8px',
          border:'1px solid rgba(239,68,68,0.25)',
        }
      },
        React.createElement('span', { style:{ fontSize:'11px', color:'var(--t3)', lineHeight:1.5 } },
          `${dueToday.length} lead${dueToday.length !== 1 ? 's' : ''} due for a human dial today per sequence track. Call before the automated email fires.`
        )
      ),
      ...dueToday.map((l, idx) => {
        const seqStatus = getSequenceStatus(l);
        const trackLabel = l.seqTrack === 'ghost' ? '👻 Ghost'
          : l.seqTrack === 're-engage' ? '🔁 Re-Engage'
          : l.seqTrack === 'lbl'       ? '🔥 LBL'
          : l.seqTrack === 'nurture'   ? '🌱 Nurture'
          : '🆕 New';
        const trackColor = l.seqTrack === 'ghost'     ? 'var(--red)'
          : l.seqTrack === 're-engage' ? 'var(--amber)'
          : l.seqTrack === 'lbl'       ? '#a78bfa'
          : l.seqTrack === 'nurture'   ? 'var(--green)'
          : 'var(--blue)';
        const dialCount = (l.notes || []).filter(n => n.type === 'call').length;
        return React.createElement('div', {
          key: l.id,
          style:{
            display:'flex', alignItems:'center', gap:'10px',
            background:'var(--surface-2)', borderRadius:'8px',
            padding:'10px 12px', marginBottom:'6px',
            borderLeft:`3px solid ${trackColor}`,
            cursor:'pointer',
          },
          onClick:() => { setPrevView('sequence'); setOpenId(l.id); setView('contact'); },
        },
          React.createElement('span', {
            style:{
              width:22, height:22, borderRadius:'50%', flexShrink:0,
              background: idx < 3 ? `${trackColor}22` : 'var(--panel)',
              color: idx < 3 ? trackColor : 'var(--t4)',
              fontSize:'10px', fontWeight:'800',
              display:'flex', alignItems:'center', justifyContent:'center',
            }
          }, idx + 1),
          React.createElement('div', { style:{ flex:1, minWidth:0 } },
            React.createElement('div', {
              style:{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }
            },
              React.createElement('span', {
                style:{ fontSize:'13px', fontWeight:'700', color:'var(--t1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }
              }, l.name),
              React.createElement('span', {
                style:{ fontSize:'10px', fontWeight:'700', padding:'1px 6px', borderRadius:'3px', background:`${trackColor}22`, color:trackColor, flexShrink:0 }
              }, `${trackLabel} · Step ${l.seqStep}`),
              dialCount > 0 && React.createElement('span', {
                style:{ fontSize:'10px', fontWeight:'800', color:'#60a5fa', background:'rgba(59,130,246,0.15)', padding:'0 5px', borderRadius:'3px', flexShrink:0, fontFamily:"'JetBrains Mono',monospace" }
              }, `📞${dialCount}`),
            ),
            React.createElement('div', {
              style:{ fontSize:'11px', color:'var(--t3)', display:'flex', gap:'8px', flexWrap:'wrap' }
            },
              React.createElement('span', { style:{ color:trackColor, fontWeight:'700' } }, seqStatus),
              l.leadType && React.createElement('span', null, '· ' + l.leadType),
              l.state    && React.createElement('span', null, '· ' + l.state),
            ),
          ),
          React.createElement('div', {
            style:{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px', flexShrink:0 }
          },
            React.createElement('a', {
              href:`tel:${l.phone}`,
              onClick: e => e.stopPropagation(),
              style:{ fontSize:'11px', fontWeight:'700', color:'var(--green)', textDecoration:'none' }
            }, l.phone),
            l.emailBounced && React.createElement('span', {
              style:{ fontSize:'9px', fontWeight:'700', color:'var(--red)', background:'rgba(239,68,68,0.1)', padding:'1px 5px', borderRadius:'3px' }
            }, '⚠ Bounced'),
          ),
        );
      })
    );
  };

  // ── COMPUTED ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    active:        leads.filter(isActive).length,
    uniqueOpeners: leads.filter(l => (l.emailOpenCount || 0) > 0).length,
    totalEvents:   leads.reduce((s, l) => s + (l.emailOpenCount || 0), 0),
  }), [leads]);

  const opens = useMemo(() =>
    leads
      .filter(l => l.lastEmailOpenedAt)
      .sort((a, b) => new Date(b.lastEmailOpenedAt) - new Date(a.lastEmailOpenedAt))
  , [leads]);

  const activeLeads = useMemo(() =>
    leads.filter(isActive).sort((a, b) => (b.emailOpenCount || 0) - (a.emailOpenCount || 0))
  , [leads]);

  const dormantLeads = useMemo(() =>
    leads.filter(l => isActive(l) && hasEmail(l) && !(l.emailOpenCount))
  , [leads]);

  const exhaustedLeads = useMemo(() =>
    leads.filter(isExhausted).sort((a, b) => (b.emailOpenCount || 0) - (a.emailOpenCount || 0))
  , [leads]);

  // Parse per-step open counts from lead notes
  const stepBreakdown = useMemo(() => {
    const counts = {};
    leads.forEach(l => {
      (l.notes || []).forEach(n => {
        if (!n.text?.includes('[SEQ] Email opened')) return;
        const tr = n.text.match(/Track: ([\w-]+)/)?.[1];
        const st = n.text.match(/Step (\d+)/)?.[1];
        if (!tr || st == null) return;
        counts[`${tr}||${st}`] = (counts[`${tr}||${st}`] || 0) + 1;
      });
    });
    return counts;
  }, [leads]);

  // ── ACTIONS ───────────────────────────────────────────────────────────────
  const openLead = (id) => {
    setOpenId(id);
    setPrevView('sequence');
    setView('contact');
  };

  const confirmEnroll = (leadId, track) => {
    upd(leadId, {
      seqTrack:      track,
      seqStep:       0,
      seqPaused:     false,
      seqExitReason: null,
      seqStartDate:  new Date().toISOString(),
    });
    setEnrollId(null);
  };

  const removeFromSeq = (leadId, name) => {
    if (!window.confirm(`Remove ${name} from the sequence?`)) return;
    upd(leadId, { seqPaused: true, seqExitReason: 'removed' });
  };

  // ── UI PRIMITIVES ─────────────────────────────────────────────────────────

  const statCard = (label, value, sub, accent) =>
    React.createElement('div', {
      style: {
        flex:1, background:'var(--panel)', border:'1px solid var(--border)',
        borderRadius:'10px', padding:'16px 20px', borderTop:`3px solid ${accent}`,
      }
    },
      React.createElement('div', { style:{ fontSize:'28px', fontWeight:'800', color:accent } }, value),
      React.createElement('div', { style:{ fontSize:'11px', fontWeight:'700', color:'var(--t2)', letterSpacing:'0.05em', marginTop:'2px' } }, label),
      sub && React.createElement('div', { style:{ fontSize:'10px', color:'var(--t3)', marginTop:'4px' } }, sub),
    );

  const emptyState = (icon, msg) =>
    React.createElement('div', { style:{ padding:'56px', textAlign:'center', color:'var(--t3)' } },
      React.createElement('div', { style:{ fontSize:'36px', marginBottom:'10px' } }, icon),
      React.createElement('div', { style:{ fontSize:'13px', maxWidth:'320px', margin:'0 auto', lineHeight:'1.5' } }, msg),
    );

  const tHead = (...headers) =>
    React.createElement('thead', null,
      React.createElement('tr', { style:{ borderBottom:'2px solid var(--border)' } },
        ...headers.map((h, i) => React.createElement('th', { key:i, style:TH_STYLE }, h))
      )
    );

  const nameCell = (l) =>
    React.createElement('td', {
      style:{ ...TD_STYLE, cursor:'pointer' },
      onClick: () => openLead(l.id),
    },
      React.createElement('div', { style:{ fontWeight:'600', fontSize:'13px', color:'var(--t1)' } },
        l.name || `${l.firstName || ''} ${l.lastName || ''}`.trim() || l.phone || '—'
      ),
      React.createElement('div', { style:{ fontSize:'11px', color:'var(--t3)', marginTop:'1px' } },
        l.phone || l.state || '—'
      ),
    );

  const opensBadge = (count) =>
    count > 0
      ? React.createElement('span', {
          style:{ fontSize:'12px', fontWeight:'700', color:'var(--blue)',
                  background:'#EFF6FF', borderRadius:'12px', padding:'2px 10px' }
        }, count)
      : React.createElement('span', { style:{ fontSize:'12px', color:'var(--t3)' } }, '0');

  const removeBtn = (l) =>
    React.createElement('button', {
      onClick: () => removeFromSeq(l.id, l.firstName || l.name || 'this lead'),
      style:{
        fontSize:'11px', padding:'3px 8px', borderRadius:'4px',
        border:'1px solid var(--border)', background:'transparent',
        color:'var(--t3)', cursor:'pointer',
      }
    }, 'Remove');

  const enrollControls = (l) =>
    enrollId === l.id
      ? React.createElement('div', { style:{ display:'flex', gap:'6px', alignItems:'center' } },
          React.createElement('select', {
            value: enrollTrack,
            onChange: e => setEnrollTrack(e.target.value),
            style:{
              fontSize:'11px', padding:'3px 6px', borderRadius:'4px',
              border:'1px solid var(--border)', background:'var(--panel)', color:'var(--t1)',
            }
          },
            React.createElement('option', { value:'new' },       'New'),
            React.createElement('option', { value:'re-engage' }, 'Re-engage'),
            React.createElement('option', { value:'ghost' },     'Ghost'),
            React.createElement('option', { value:'nurture' },   'Nurture'),
          ),
          React.createElement('button', {
            onClick: () => confirmEnroll(l.id, enrollTrack),
            style:{
              fontSize:'11px', padding:'3px 8px', borderRadius:'4px',
              border:'none', background:'var(--blue)', color:'#fff', cursor:'pointer',
            }
          }, 'Enroll'),
          React.createElement('button', {
            onClick: () => setEnrollId(null),
            style:{
              fontSize:'11px', padding:'3px 8px', borderRadius:'4px',
              border:'1px solid var(--border)', background:'transparent',
              color:'var(--t3)', cursor:'pointer',
            }
          }, '✕'),
        )
      : React.createElement('button', {
          onClick: () => { setEnrollId(l.id); setEnrollTrack('re-engage'); },
          style:{
            fontSize:'11px', padding:'3px 8px', borderRadius:'4px',
            border:'1px solid var(--blue)', background:'transparent',
            color:'var(--blue)', cursor:'pointer',
          }
        }, 'Re-enroll');

  // ══════════════════════════════════════════════════════════════════
  // TAB RENDERERS
  // ══════════════════════════════════════════════════════════════════

  const renderOpens = () => {
    if (!opens.length) return emptyState('📬',
      'No email opens tracked yet. Opens appear here as families engage with the sequence.');

    return React.createElement('table', { style:{ width:'100%', borderCollapse:'collapse' } },
      tHead('FAMILY', 'TRACK', 'STEP', 'OPENS', 'LAST OPEN'),
      React.createElement('tbody', null,
        ...opens.map(l =>
          React.createElement('tr', {
            key: l.id,
            onClick: () => openLead(l.id),
            style:{ cursor:'pointer', borderBottom:'1px solid var(--border)' },
            onMouseEnter: e => e.currentTarget.style.background = 'var(--bg)',
            onMouseLeave: e => e.currentTarget.style.background = '',
          },
            nameCell(l),
            React.createElement('td', { style:TD_STYLE }, trackBadge(l.seqTrack || 'new')),
            React.createElement('td', { style:{ ...TD_STYLE, color:'var(--t2)' } },
              `Step ${l.seqStep ?? '?'}`
            ),
            React.createElement('td', { style:{ ...TD_STYLE, textAlign:'center' } }, opensBadge(l.emailOpenCount || 0)),
            React.createElement('td', { style:{ ...TD_STYLE, color:'var(--t3)', whiteSpace:'nowrap' } },
              fmtTs(l.lastEmailOpenedAt)
            ),
          )
        )
      )
    );
  };

  const renderActive = () => {
    if (!activeLeads.length) return emptyState('⚡', 'No leads are currently in an active sequence.');

    return React.createElement('table', { style:{ width:'100%', borderCollapse:'collapse' } },
      tHead('FAMILY', 'TRACK', 'PROGRESS', 'OPENS', 'LAST OPEN', ''),
      React.createElement('tbody', null,
        ...activeLeads.map(l => {
          const len = getTrackLength(l.seqTrack);
          const pct = len ? Math.min(100, Math.round(((l.seqStep ?? 0) / len) * 100)) : 0;
          return React.createElement('tr', {
            key: l.id,
            style:{ borderBottom:'1px solid var(--border)' },
            onMouseEnter: e => e.currentTarget.style.background = 'var(--bg)',
            onMouseLeave: e => e.currentTarget.style.background = '',
          },
            nameCell(l),
            React.createElement('td', { style:TD_STYLE }, trackBadge(l.seqTrack || 'new')),
            React.createElement('td', { style:TD_STYLE },
              React.createElement('div', { style:{ fontSize:'11px', color:'var(--t2)', marginBottom:'4px' } },
                `Step ${l.seqStep ?? 0} of ${len}`
              ),
              React.createElement('div', {
                style:{ height:'4px', background:'var(--border)', borderRadius:'2px', width:'80px' }
              },
                React.createElement('div', {
                  style:{ width:`${pct}%`, height:'100%', background:'var(--blue)', borderRadius:'2px', transition:'width 0.3s' }
                })
              ),
            ),
            React.createElement('td', { style:{ ...TD_STYLE, textAlign:'center' } }, opensBadge(l.emailOpenCount || 0)),
            React.createElement('td', { style:{ ...TD_STYLE, color:'var(--t3)', whiteSpace:'nowrap' } },
              l.lastEmailOpenedAt ? fmtTs(l.lastEmailOpenedAt) : '—'
            ),
            React.createElement('td', { style:TD_STYLE }, removeBtn(l)),
          );
        })
      )
    );
  };

  const renderDormant = () => {
    if (!dormantLeads.length) return emptyState('👻',
      'No silent leads right now — every active lead has opened at least one email.');

    return React.createElement('div', null,
      React.createElement('div', {
        style:{
          padding:'10px 16px', fontSize:'11px', color:'#C2410C',
          background:'#FFF7ED', borderBottom:'1px solid #FDB786',
          fontWeight:'600',
        }
      },
        `⚠️ ${dormantLeads.length} lead${dormantLeads.length !== 1 ? 's' : ''} receiving emails with zero opens — Ghost Protocol candidates.`
      ),
      React.createElement('table', { style:{ width:'100%', borderCollapse:'collapse' } },
        tHead('FAMILY', 'TRACK', 'STEPS SENT', 'STATUS', ''),
        React.createElement('tbody', null,
          ...dormantLeads.map(l =>
            React.createElement('tr', {
              key: l.id,
              style:{ borderBottom:'1px solid var(--border)' },
              onMouseEnter: e => e.currentTarget.style.background = 'var(--bg)',
              onMouseLeave: e => e.currentTarget.style.background = '',
            },
              nameCell(l),
              React.createElement('td', { style:TD_STYLE }, trackBadge(l.seqTrack || 'new')),
              React.createElement('td', { style:{ ...TD_STYLE, color:'var(--t2)' } },
                `${l.seqStep ?? 0} of ${getTrackLength(l.seqTrack)} sent`
              ),
              React.createElement('td', { style:TD_STYLE },
                React.createElement('span', {
                  style:{
                    fontSize:'10px', fontWeight:'700', padding:'2px 7px', borderRadius:'4px',
                    background:'#FFF7ED', border:'1px solid #FDB786', color:'#C2410C',
                  }
                }, '👻 GHOST CANDIDATE')
              ),
              React.createElement('td', { style:TD_STYLE }, removeBtn(l)),
            )
          )
        )
      )
    );
  };

  const renderExhausted = () => {
    if (!exhaustedLeads.length) return emptyState('📭', 'No exhausted leads yet.');

    const withOpens    = exhaustedLeads.filter(l => (l.emailOpenCount || 0) > 0);
    const withoutOpens = exhaustedLeads.filter(l => !(l.emailOpenCount || 0));

    const sectionRows = (subset) => subset.map(l =>
      React.createElement('tr', {
        key: l.id,
        style:{ borderBottom:'1px solid var(--border)' },
        onMouseEnter: e => e.currentTarget.style.background = 'var(--bg)',
        onMouseLeave: e => e.currentTarget.style.background = '',
      },
        nameCell(l),
        React.createElement('td', { style:TD_STYLE }, trackBadge(l.seqTrack || 'new')),
        React.createElement('td', { style:{ ...TD_STYLE, textAlign:'center' } }, opensBadge(l.emailOpenCount || 0)),
        React.createElement('td', { style:{ ...TD_STYLE, color:'var(--t3)', whiteSpace:'nowrap' } },
          l.lastEmailOpenedAt ? fmtTs(l.lastEmailOpenedAt) : 'Never opened'
        ),
        React.createElement('td', { style:TD_STYLE }, enrollControls(l)),
      )
    );

    const sectionHeader = (label, accent) =>
      React.createElement('tr', null,
        React.createElement('td', {
          colSpan: 5,
          style:{
            padding:'8px 12px', fontSize:'10px', fontWeight:'700',
            color:accent, letterSpacing:'0.06em',
            background:'var(--bg)', borderBottom:'1px solid var(--border)',
          }
        }, label)
      );

    return React.createElement('table', { style:{ width:'100%', borderCollapse:'collapse' } },
      tHead('FAMILY', 'TRACK', 'OPENS', 'LAST OPEN', ''),
      React.createElement('tbody', null,
        withOpens.length && sectionHeader(
          `OPENED AT LEAST ONCE — ${withOpens.length} lead${withOpens.length !== 1 ? 's' : ''}`, 'var(--blue)'
        ),
        ...sectionRows(withOpens),
        withoutOpens.length && sectionHeader(
          `NEVER OPENED — ${withoutOpens.length} lead${withoutOpens.length !== 1 ? 's' : ''}`, 'var(--t3)'
        ),
        ...sectionRows(withoutOpens),
      )
    );
  };

  const renderAnalytics = () => {
    const tracks = ['new', 're-engage', 'ghost', 'nurture'];
    const maxVal = Math.max(1, ...Object.values(stepBreakdown));

    return React.createElement('div', { style:{ padding:'20px', display:'flex', flexDirection:'column', gap:'28px' } },
      React.createElement('div', { style:{ fontSize:'11px', color:'var(--t3)', lineHeight:'1.5' } },
        'Opens by sequence track and step. Open rate (opens ÷ sends) requires send-side logging — planned for a future build.'
      ),

      ...tracks.map(track => {
        const sched = TRACK_SCHEDULES[track];
        if (!sched) return null;
        const emailSteps = sched.filter(s => s.channels.includes('email'));
        if (!emailSteps.length) return null;
        const c = TC[track] || TC['new'];
        const trackTotal = emailSteps.reduce((sum, { step }) =>
          sum + (stepBreakdown[`${track}||${step}`] || 0), 0);

        return React.createElement('div', { key: track },
          React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' } },
            trackBadge(track),
            React.createElement('span', { style:{ fontSize:'11px', color:'var(--t3)' } },
              `${emailSteps.length} email steps`
            ),
            trackTotal > 0 && React.createElement('span', {
              style:{ fontSize:'11px', fontWeight:'700', color:c.text }
            }, `${trackTotal} total opens`),
          ),

          React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:'8px' } },
            ...emailSteps.map(({ step, day }) => {
              const key   = `${track}||${step}`;
              const count = stepBreakdown[key] || 0;
              const barW  = Math.round((count / maxVal) * 180);
              return React.createElement('div', {
                key: step,
                style:{ display:'flex', alignItems:'center', gap:'12px' }
              },
                React.createElement('div', {
                  style:{ fontSize:'11px', color:'var(--t2)', width:'72px', flexShrink:0 }
                }, `Step ${step}  D${day}`),

                React.createElement('div', {
                  style:{
                    height:'22px', flex:1, maxWidth:'240px',
                    background:c.bg, border:`1px solid ${c.border}`,
                    borderRadius:'4px', overflow:'hidden',
                    display:'flex', alignItems:'center',
                  }
                },
                  React.createElement('div', {
                    style:{
                      width: count > 0 ? `${Math.max(barW, 4)}px` : '0',
                      height:'100%', background:c.border, transition:'width 0.4s',
                    }
                  })
                ),

                React.createElement('div', {
                  style:{
                    fontSize:'12px', fontWeight:'700', minWidth:'28px',
                    color: count > 0 ? c.text : 'var(--t3)',
                  }
                }, count > 0 ? count : '—'),
              );
            })
          ),
        );
      })
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // ROOT RENDER
  // ══════════════════════════════════════════════════════════════════
  return React.createElement('div', {
    style:{
      flex:1, display:'flex', flexDirection:'column', overflow:'hidden',
      background:'var(--bg)', padding:'20px', gap:'16px',
    }
  },

    // ── HEADER ──────────────────────────────────────────────────
    React.createElement('div', {
      style:{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }
    },
      React.createElement('div', null,
        React.createElement('div', { style:{ fontSize:'18px', fontWeight:'800', color:'var(--t1)', letterSpacing:'-0.3px' } },
          '📧 Sequence Engine'
        ),
        React.createElement('div', { style:{ fontSize:'12px', color:'var(--t3)', marginTop:'3px' } },
          'Email open tracking, active lead pipeline, and enrollment controls'
        ),
      ),
    ),

    // ── STATS BAR ───────────────────────────────────────────────
    React.createElement('div', { style:{ display:'flex', gap:'12px' } },
      statCard('ACTIVE IN SEQUENCE',  stats.active,        'currently enrolled',            '#3B82F6'),
      statCard('UNIQUE OPENERS',       stats.uniqueOpeners, 'opened at least one email',     '#10B981'),
      statCard('TOTAL OPEN EVENTS',    stats.totalEvents,   'across all leads and steps',    '#8B5CF6'),
    ),

    // ── INNER TAB BAR ────────────────────────────────────────────
    React.createElement('div', {
      style:{
        display:'flex', gap:'4px', background:'var(--panel)',
        borderRadius:'8px', padding:'4px', border:'1px solid var(--border)',
        flexWrap:'wrap',
      }
    },
      ...INNER_TABS.map(t =>
        React.createElement('button', {
          key: t.id,
          onClick: () => setInnerTab(t.id),
          style:{
            padding:'7px 14px', borderRadius:'6px', border:'none',
            fontSize:'12px', fontWeight:'600', cursor:'pointer', transition:'all 0.15s',
            background: innerTab === t.id ? 'var(--blue)' : 'transparent',
            color:      innerTab === t.id ? '#fff' : 'var(--t2)',
          }
        }, t.label)
      )
    ),

    // ── CONTENT PANEL ────────────────────────────────────────────
    React.createElement('div', {
      style:{
        flex:1, background:'var(--panel)', border:'1px solid var(--border)',
        borderRadius:'10px', overflow:'auto',
      }
    },
      innerTab === 'duetoday'  && renderDueToday(),
      innerTab === 'opens'     && renderOpens(),
      innerTab === 'active'    && renderActive(),
      innerTab === 'dormant'   && renderDormant(),
      innerTab === 'exhausted' && renderExhausted(),
      innerTab === 'analytics' && renderAnalytics(),
      innerTab === 'engine'    && React.createElement(SequenceRunsTab, { leads, seqStats }),
    ),
  );
}
