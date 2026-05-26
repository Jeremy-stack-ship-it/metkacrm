import React from 'react';
import { BC, isUWStuck } from '../constants.js';
import { getPhasePriority, isDueToday, getActiveSession, getNextSession, SESSIONS, masterQueueSort } from '../lib/phaseEngine';

const LS_SESSION = 'metka-session-v1';

// ── DialQueuePanel — LEFT sidebar (dark, 240px) ───────────────────────────
// Owns: call control panel, PD controls, queue filter/sort, lead list
export default function DialQueuePanel({
  // call state (from DialView local state)
  callPanelExpanded, setCallPanelExpanded,
  onHold, setOnHold,
  // PD state
  pdMode, pdStatus, pdIdx, pdLockedQueue, pdAttempt, pdCountdown,
  pdStart, pdStop,
  pdQueue,
  pdSessionLog,
  currentPdLead, pdBg, pdAccent,
  // full lead pool (for rebalanceSession — NOT capped like queue)
  leads,
  // queue filter state
  dialQueueFilter, setDialQueueFilter,
  // slot selection (v3.23)
  selectedSlot, setSelectedSlot,
  // ── props from DialView (passed down from App) ──
  callStatus, callElapsed, activeCallLead, open,
  callMuted, toggleMute, hangUp,
  session, setSession, sessionPaused, setSessionPaused, setDialSessionActive,
  queue,
  refreshQueueOrder, setView,
  dialSortMode, setDialSortMode,
  openId, setOpenId, setNoteText, setDialRightTab,
}) {
  // ── SMART BLOCK REBALANCE (v3.14) ────────────────────────────────────────
  // Mid-session gap detection: injects fresh high-priority leads not yet dialed
  // into the active session's remaining slots. Uses existing composite sort —
  // phase priority first, then most-recently-due within phase. No AI needed.
  const rebalanceSession = () => {
    if (!session) return;
    const sessionIdSet = new Set(session.ids);
    const today = new Date().toLocaleDateString('en-CA');
    const SKIP_DISPS = new Set(['dnc', 'not_interested', 'withdrawn', 'chargeback', 'appointment_booked']);

    // Candidates: search full lead pool (not capped queue) so injection never starves
    const leadPool = leads && leads.length > 0 ? leads : queue; // v3.26 fallback
    const candidates = leadPool
      .filter(l => {
        if (sessionIdSet.has(l.id)) return false;
        if (l.lastContact === today) return false;
        if (l.phase === 'EXIT') return false;
        if (l.stage === 'removed') return false;
        if (SKIP_DISPS.has(l.disposition)) return false;
        if (!isDueToday(l)) return false;
        return true;
      })
      .sort((a, b) => {
        const pDiff = getPhasePriority(b) - getPhasePriority(a);
        if (pDiff !== 0) return pDiff;
        const aTs = a.next_dial ? new Date(a.next_dial).getTime() : 0;
        const bTs = b.next_dial ? new Date(b.next_dial).getTime() : 0;
        return bTs - aTs;
      });

    if (!candidates.length) {
      alert('No fresh leads available to inject. Queue is fully loaded.');
      return;
    }

    // Inject up to 20 fresh leads (or fill to session.capacity if defined)
    const maxInject = session.capacity
      ? Math.max(0, session.capacity - session.ids.length)
      : 20;
    const toInject = candidates.slice(0, Math.min(candidates.length, maxInject || 20));

    const newIds  = [...session.ids, ...toInject.map(l => l.id)];
    const updated = { ...session, ids: newIds, total: newIds.length };
    setSession(updated);
    try { localStorage.setItem(LS_SESSION, JSON.stringify(updated)); } catch {}
  };

  return React.createElement('div', {
    style: { width: '240px', flexShrink: 0, background: '#1E2433', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid rgba(0,0,0,0.3)' }
  },

    // ── SECTION 1: Header ─────────────────────────────────────────────────
    React.createElement('div', { style: { padding: '10px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '7px' } },
          React.createElement('div', {
            style: {
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: callStatus === 'connected' ? '#10B981' : callStatus === 'connecting' ? '#F59E0B' : 'rgba(255,255,255,0.2)',
              boxShadow: callStatus === 'connected' ? '0 0 6px #10B981' : 'none',
              transition: 'background 0.3s, box-shadow 0.3s'
            }
          }),
          React.createElement('div', { style: { fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' } }, 'MINISTRY OF PROTECTION')
        ),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '2px' } },
          React.createElement('button', {
            onClick: () => setCallPanelExpanded(e => !e),
            title: callPanelExpanded ? 'Collapse call controls' : 'Expand call controls',
            className: 'dqp-icon-btn',
            style: { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '14px', cursor: 'pointer', padding: '4px 8px', lineHeight: 1, transition: 'color 0.15s' },
          }, callPanelExpanded ? '−' : '+'),
          React.createElement('button', {
            onClick: () => setView('dashboard'),
            title: 'Exit dial view',
            className: 'dqp-icon-btn',
            style: { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: '14px', cursor: 'pointer', padding: '4px 8px', lineHeight: 1, transition: 'color 0.15s' },
          }, '✕')
        )
      )
    ),

    // ── SECTION 1.5: Today Panel ──────────────────────────────────────────────
    // v3.12 — Two-block daily overview: AM + PM sessions, lead/callback counts
    (() => {
      const now = new Date();
      const todaySessions = SESSIONS.filter(s => s.day === now.getDay());
      if (!todaySessions.length) return null;

      const activeSess = getActiveSession(now);
      const nextSess   = getNextSession(now);
      const nowMins    = now.getHours() * 60 + now.getMinutes();

      const fmtT = (h, m) => {
        const ap  = h >= 12 ? 'PM' : 'AM';
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        return h12 + ':' + String(m).padStart(2, '0') + ' ' + ap;
      };

      return React.createElement('div', {
        style: { padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }
      },
        React.createElement('div', { style: { display: 'flex', gap: '6px' } },
          todaySessions.map(sess => {
            const isActive  = !!(activeSess && activeSess.id === sess.id);
            const isPast    = !isActive && nowMins > sess.endH * 60 + sess.endM;
            const isNext    = !!(nextSess && nextSess.id === sess.id && !isActive);
            const leadCount = queue.filter(l => (l.slot || 'AM') === sess.slot).length;
            const cbCount   = queue.filter(l => (l.slot || 'AM') === sess.slot && l.disposition === 'callback').length;

            const bg     = isActive ? 'rgba(59,130,246,0.13)' : 'rgba(255,255,255,0.04)';
            const border = isActive ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.08)';

            // v3.23: slot selection state
            const isUserSelected = selectedSlot === sess.slot;
            const isPdThisSlot   = pdMode && isUserSelected;
            // Highlight: active-time = blue, user-selected (manual override) = gold, default = dim
            const tileColor  = isActive ? '#93C5FD' : isUserSelected ? '#FCD34D' : 'rgba(255,255,255,0.55)';
            const tileBg     = isActive ? 'rgba(59,130,246,0.13)' : isUserSelected ? 'rgba(234,179,8,0.10)' : 'rgba(255,255,255,0.04)';
            const tileBorder = isActive ? '1px solid rgba(59,130,246,0.4)' : isUserSelected ? '1px solid rgba(234,179,8,0.35)' : '1px solid rgba(255,255,255,0.08)';

            // Clicking the tile selects it (without starting PD)
            const handleTileClick = () => {
              if (setSelectedSlot) setSelectedSlot(prev => prev === sess.slot ? null : sess.slot);
            };

            // START button: builds the slot queue synchronously to avoid React timing issues
            const handleTileStart = () => {
              if (setSelectedSlot) setSelectedSlot(sess.slot);
              const slotLeads = queue.filter(l => isDueToday(l) && (l.slot || 'AM') === sess.slot);
              pdStart(slotLeads);
            };

            const btnBg     = isPdThisSlot ? 'rgba(239,68,68,0.22)' : '#3B82F6';
            const btnColor  = isPdThisSlot ? '#EF4444' : '#fff';
            const btnBorder = isPdThisSlot ? '1px solid rgba(239,68,68,0.5)' : 'none';
            // Dim START if PD is running for the OTHER slot
            const btnDisabled = pdMode && !isPdThisSlot;

            return React.createElement('div', {
              key: sess.id,
              onClick: handleTileClick,
              style: { flex: 1, background: tileBg, border: tileBorder, borderRadius: '8px', padding: '8px 8px 7px', minWidth: 0, opacity: isPast && !isUserSelected ? 0.45 : 1, cursor: 'pointer', transition: 'background 0.15s, border 0.15s' }
            },
              // Slot label + state indicator
              React.createElement('div', {
                style: { fontSize: '10px', fontWeight: '800', color: tileColor, letterSpacing: '0.07em', marginBottom: '1px' }
              }, (isActive ? '⚡ ' : isUserSelected ? '✦ ' : '') + sess.slot),
              // Time range
              React.createElement('div', {
                style: { fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: '600', marginBottom: '6px', whiteSpace: 'nowrap' }
              }, fmtT(sess.startH, sess.startM) + '–' + fmtT(sess.endH, sess.endM)),
              // Big lead count
              React.createElement('div', {
                style: { fontSize: '22px', fontWeight: '900', color: isActive || isUserSelected ? '#f1f5f9' : 'rgba(255,255,255,0.5)', lineHeight: 1, marginBottom: '1px' }
              }, leadCount),
              // Subtext: leads · N cb
              React.createElement('div', {
                style: { fontSize: '10px', color: '#94a3b8', fontWeight: '600', marginBottom: '6px' }
              }, 'leads' + (cbCount > 0 ? ' · ' + cbCount + ' cb' : '')),
              // Action: START/STOP on every tile (v3.23 — no longer time-gated)
              React.createElement('button', {
                onClick: e => { e.stopPropagation(); isPdThisSlot ? pdStop() : handleTileStart(); },
                disabled: btnDisabled,
                title: btnDisabled ? 'Stop the current session first' : isPdThisSlot ? 'Stop Power Dial' : 'Start Power Dial for this session slot',
                style: { width: '100%', minHeight: '28px', background: btnDisabled ? 'rgba(255,255,255,0.05)' : btnBg, color: btnDisabled ? 'rgba(255,255,255,0.2)' : btnColor, border: btnDisabled ? '1px solid rgba(255,255,255,0.07)' : btnBorder, borderRadius: '5px', fontSize: '10px', fontWeight: '800', cursor: btnDisabled ? 'not-allowed' : 'pointer', letterSpacing: '0.03em' }
              }, isPdThisSlot ? '⏹ STOP' : '▶ START')
            );
          })
        )
      );
    })(),

    // ── SECTION 2: Call control panel (collapsible) ───────────────────────
    callPanelExpanded && (() => {
      const isLive       = callStatus === 'connected';
      const isConnecting = callStatus === 'connecting';
      const timerStr     = (isLive || isConnecting)
        ? (Math.floor((callElapsed || 0) / 60) + ':' + String((callElapsed || 0) % 60).padStart(2, '0'))
        : '--:--';
      const leadName = isLive
        ? ((activeCallLead || open)?.name || 'Unknown')
        : (open?.name || '— idle —');
      return React.createElement('div', {
        style: {
          padding: '10px 12px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0,
          background: isLive ? 'rgba(16,185,129,0.06)' : isConnecting ? 'rgba(245,158,11,0.06)' : 'rgba(0,0,0,0.12)',
          transition: 'background 0.4s'
        }
      },
        React.createElement('div', {
          title: leadName,
          style: { fontSize: '12px', fontWeight: '800', color: isLive ? '#f1f5f9' : 'rgba(255,255,255,0.28)', marginBottom: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color 0.3s' }
        }, leadName),
        React.createElement('div', {
          style: { fontSize: '22px', fontWeight: '800', fontFamily: "'JetBrains Mono', monospace", color: isLive ? '#10B981' : isConnecting ? '#F59E0B' : 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', marginBottom: '10px', transition: 'color 0.3s' }
        }, timerStr),
        React.createElement('div', { style: { display: 'flex', gap: '4px' } },
          React.createElement('button', {
            onClick: isLive ? toggleMute : undefined,
            title: callMuted ? 'Unmute' : 'Mute',
            style: { flex: 1, minHeight: '36px', borderRadius: '7px', fontSize: '11px', fontWeight: '800', cursor: isLive ? 'pointer' : 'not-allowed', background: callMuted ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.07)', color: callMuted ? '#F59E0B' : isLive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)', border: callMuted ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.1)', transition: 'all 0.15s' }
          }, callMuted ? '🔇 MUTED' : '🎙 MUTE'),
          React.createElement('button', {
            onClick: isLive ? () => setOnHold(h => !h) : undefined,
            title: onHold ? 'Resume' : 'Hold',
            style: { flex: 1, minHeight: '36px', borderRadius: '7px', fontSize: '11px', fontWeight: '800', cursor: isLive ? 'pointer' : 'not-allowed', background: onHold ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.07)', color: onHold ? '#818CF8' : isLive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)', border: onHold ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.1)', transition: 'all 0.15s' }
          }, onHold ? '⏸ HOLD' : '⏸ HOLD'),
          React.createElement('button', {
            onClick: isLive ? hangUp : undefined,
            title: 'End call',
            style: { flex: 1, minHeight: '36px', borderRadius: '7px', fontSize: '11px', fontWeight: '800', cursor: isLive ? 'pointer' : 'not-allowed', background: isLive ? 'rgba(220,38,38,0.2)' : 'rgba(255,255,255,0.05)', color: isLive ? '#EF4444' : 'rgba(255,255,255,0.12)', border: isLive ? '1px solid rgba(220,38,38,0.5)' : '1px solid rgba(255,255,255,0.07)', transition: 'all 0.15s' }
          }, '📵 END')
        )
      );
    })(),

    // ── SECTION 3: Power dial + session controls ──────────────────────────
    React.createElement('div', { style: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 } },

      !session && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '8px' } },

        // ⚡ Power Dial
        pdMode && pdStatus !== 'idle'
          ? React.createElement('button', {
              onClick: pdStop, title: 'Stop Power Dial',
              style: { width: '100%', minHeight: '34px', padding: '0 8px', fontSize: '11px', fontWeight: '800', letterSpacing: '0.8px', background: 'rgba(220,38,38,0.22)', color: '#EF4444', border: '1px solid rgba(220,38,38,0.45)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }
            },
              React.createElement('span', null, '■'),
              React.createElement('span', null, 'STOP POWER DIAL'),
              React.createElement('span', { style: { fontSize: '11px', fontWeight: '800', background: 'rgba(220,38,38,0.3)', color: '#EF4444', borderRadius: '8px', padding: '1px 7px' } }, (pdIdx + 1) + '/' + pdLockedQueue.length)
            )
          : React.createElement('button', {
              onClick: pdStart,
              title: 'Auto-dial: 18s attempt 1, 30s attempt 2, then advance to next lead',
              style: { width: '100%', minHeight: '34px', padding: '0 8px', fontSize: '11px', fontWeight: '800', letterSpacing: '0.8px', background: pdQueue.length > 0 ? 'rgba(16,185,129,0.22)' : 'rgba(255,255,255,0.06)', color: pdQueue.length > 0 ? '#3B82F6' : 'rgba(255,255,255,0.55)', border: '1px solid ' + (pdQueue.length > 0 ? 'rgba(16,185,129,0.45)' : 'rgba(255,255,255,0.12)'), borderRadius: '4px', cursor: pdQueue.length > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }
            },
              React.createElement('span', null, '⚡'),
              React.createElement('span', null, 'POWER DIAL'),
              React.createElement('span', { style: { fontSize: '11px', fontWeight: '800', background: pdQueue.length > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)', color: pdQueue.length > 0 ? '#3B82F6' : 'rgba(255,255,255,0.5)', borderRadius: '8px', padding: '1px 7px' } }, pdQueue.length)
            ),

        // 📅 Log session to Google Calendar
        !pdMode && pdSessionLog && (() => {
          const toGCalTs = ms => new Date(ms).toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
          const durationMin = Math.max(1, Math.round((pdSessionLog.end - pdSessionLog.start) / 60000));
          const startLabel  = new Date(pdSessionLog.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          const endLabel    = new Date(pdSessionLog.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          const details  = encodeURIComponent(`Ministry of Protection — Power Dial Session\n\nLeads Dialed: ${pdSessionLog.dialsCount} / ${pdSessionLog.totalQueued}\nDuration: ${durationMin} min\nStart: ${startLabel}  |  End: ${endLabel}\n\nLogged via Metka Field Ops CRM`);
          const title    = encodeURIComponent(`🔥 MOP Dial Session — ${pdSessionLog.dialsCount} dials`);
          const gcalUrl  = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${toGCalTs(pdSessionLog.start)}/${toGCalTs(pdSessionLog.end)}&details=${details}`;
          return React.createElement('button', {
            onClick: () => window.open(gcalUrl, '_blank'),
            title: 'Log this dial session to Google Calendar',
            style: { width: '100%', minHeight: '30px', padding: '0 8px', fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px', background: 'rgba(66,133,244,0.15)', color: '#93C5FD', border: '1px solid rgba(66,133,244,0.35)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '4px' }
          },
            '📅',
            React.createElement('span', null, 'LOG SESSION TO CALENDAR'),
            React.createElement('span', { style: { opacity: 0.7 } }, `${pdSessionLog.dialsCount} dials · ${durationMin}m`)
          );
        })(),

        // ▶ Manual Dial
        queue.length > 0 && React.createElement('button', {
          onClick: () => {
            const ids = queue.map(l => l.id);
            const s = { ids, idx: 0, total: ids.length, startedAt: new Date().toISOString() };
            setSession(s); setSessionPaused(false);
            try { localStorage.setItem(LS_SESSION, JSON.stringify(s)); } catch {}
            setOpenId(ids[0]); setDialSessionActive(true); setNoteText(''); setDialRightTab('script'); // eslint-disable-line
          },
          title: 'Manual dial: step through the queue one lead at a time',
          style: { width: '100%', minHeight: '28px', padding: '0 8px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }
        },
          React.createElement('span', null, '▶'),
          React.createElement('span', null, 'MANUAL DIAL'),
          React.createElement('span', { style: { fontSize: '11px', fontWeight: '700', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', borderRadius: '8px', padding: '1px 6px' } }, queue.length)
        )
      ),

      // Progress counter + bar
      React.createElement('div', {
        'aria-live': 'polite', role: 'status',
        style: { fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginBottom: '8px' }
      }, session
        ? (session.idx + 1) + ' / ' + session.total + ' leads'
        : dialQueueFilter === 'today'
          ? queue.filter(isDueToday).length + ' due today'
          : queue.length + ' in queue'
      ),

      session && React.createElement('div', {
        style: { height: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' },
        role: 'progressbar', 'aria-valuenow': session.idx + 1, 'aria-valuemin': 1, 'aria-valuemax': session.total, 'aria-label': 'Session progress'
      },
        React.createElement('div', { style: { height: '100%', width: Math.round(((session.idx + 1) / session.total) * 100) + '%', background: sessionPaused ? '#F59E0B' : '#10B981', borderRadius: '4px', transition: 'width 0.3s' } })
      ),

      // Session controls
      React.createElement('div', { style: { display: 'flex', gap: '4px' } },
        session && React.createElement('button', {
          onClick: () => setSessionPaused(p => !p),
          'aria-label': sessionPaused ? 'Resume dial session' : 'Pause dial session',
          style: { flex: 1, minHeight: '30px', fontSize: '11px', fontWeight: '700', background: sessionPaused ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.1)', color: sessionPaused ? '#F59E0B' : 'rgba(255,255,255,0.8)', border: '1px solid ' + (sessionPaused ? '#F59E0B' : 'rgba(255,255,255,0.18)'), borderRadius: '4px', cursor: 'pointer' }
        }, sessionPaused ? '▶ RESUME' : '⏸ PAUSE'),
        session && React.createElement('button', {
          onClick: () => { setSession(null); setSessionPaused(false); setDialSessionActive(false); try { localStorage.removeItem(LS_SESSION); } catch {} },
          'aria-label': 'End session',
          style: { minHeight: '30px', padding: '0 7px', fontSize: '11px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.55)', borderRadius: '4px', cursor: 'pointer' }
        }, '⏹'),
        // v3.14 — Smart Block Rebalance: inject fresh P1 leads into remaining slots
        session && React.createElement('button', {
          onClick: rebalanceSession,
          'aria-label': 'Rebalance session — inject fresh leads into remaining slots',
          title: 'Inject fresh high-priority leads not yet dialed into remaining session slots',
          style: { minHeight: '30px', padding: '0 7px', fontSize: '10px', fontWeight: '800', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#93C5FD', borderRadius: '4px', cursor: 'pointer', letterSpacing: '0.3px', whiteSpace: 'nowrap' }
        }, '⚡ +'),
        React.createElement('button', {
          onClick: refreshQueueOrder, 'aria-label': 'Refresh queue order', title: 'Re-sort by live priority',
          style: { minHeight: '30px', padding: '0 7px', fontSize: '11px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.55)', borderRadius: '4px', cursor: 'pointer' }
        }, '🔄')
      )
    ),

    // ── PD Status Bar ─────────────────────────────────────────────────────
    pdMode && pdStatus !== 'idle' && currentPdLead && React.createElement('div', {
      style: { background: pdBg, borderBottom: '2px solid ' + pdAccent, padding: '8px 12px', flexShrink: 0 }
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        React.createElement('div', { style: { width: 8, height: 8, borderRadius: '50%', background: pdAccent, flexShrink: 0, boxShadow: '0 0 6px ' + pdAccent } }),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: '11px', fontWeight: '800', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, currentPdLead.name || 'Unknown'),
          React.createElement('div', { style: { fontSize: '11px', color: '#64748b', fontFamily: "'JetBrains Mono',monospace" } }, currentPdLead.phone)
        ),
        React.createElement('div', { style: { fontSize: '11px', fontWeight: '800', color: pdAttempt === 2 ? '#F59E0B' : '#94a3b8', background: pdAttempt === 2 ? '#F59E0B22' : 'var(--navy-2)', border: '1px solid ' + (pdAttempt === 2 ? '#F59E0B' : '#334155'), borderRadius: '4px', padding: '2px 6px' } }, 'ATT ' + pdAttempt),
        React.createElement('div', { style: { fontSize: '11px', fontWeight: '800', color: pdAccent, minWidth: '50px', textAlign: 'right' } },
          pdStatus === 'answered' ? '✓ LIVE' : pdStatus === 'pausing' ? '…' : pdCountdown !== null ? pdCountdown + 's' : 'Dialing'
        )
      ),
      pdCountdown !== null && pdStatus === 'dialing' && React.createElement('div', { style: { marginTop: '6px', background: 'var(--navy-2)', borderRadius: '4px', height: '3px', overflow: 'hidden' } },
        React.createElement('div', { style: { width: (pdCountdown / (pdAttempt === 1 ? 18 : 30) * 100) + '%', height: '100%', background: pdAccent, borderRadius: '4px', transition: 'width 1s linear' } })
      )
    ),

    // ── QUEUE FILTER + SORT ───────────────────────────────────────────────
    React.createElement('div', { style: { padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 } },
      React.createElement('div', { style: { display: 'flex', gap: '4px', marginBottom: '8px' } },
        (() => {
          const todayCount2 = queue.filter(isDueToday).length;
          const allCount    = queue.length;
          const btnBase = { flex: 1, minHeight: '26px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', letterSpacing: '0.8px', cursor: 'pointer', border: '1px solid', transition: 'all 0.15s' };
          return [
            React.createElement('button', {
              key: 'f-today', onClick: () => setDialQueueFilter('today'),
              title: 'Show only leads due today per the Phase Engine',
              style: { ...btnBase, background: dialQueueFilter === 'today' ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.05)', color: dialQueueFilter === 'today' ? '#3B82F6' : 'rgba(255,255,255,0.4)', borderColor: dialQueueFilter === 'today' ? 'rgba(16,185,129,0.45)' : 'rgba(255,255,255,0.12)' }
            }, 'TODAY', React.createElement('span', { style: { marginLeft: '5px', fontSize: '11px', fontWeight: '800', background: dialQueueFilter === 'today' ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.1)', color: dialQueueFilter === 'today' ? '#3B82F6' : 'rgba(255,255,255,0.5)', borderRadius: '8px', padding: '1px 5px' } }, todayCount2)),
            React.createElement('button', {
              key: 'f-all', onClick: () => setDialQueueFilter('all'),
              title: 'Show full queue',
              style: { ...btnBase, background: dialQueueFilter === 'all' ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.05)', color: dialQueueFilter === 'all' ? '#60A5FA' : 'rgba(255,255,255,0.4)', borderColor: dialQueueFilter === 'all' ? 'rgba(59,130,246,0.45)' : 'rgba(255,255,255,0.12)' }
            }, 'ALL', React.createElement('span', { style: { marginLeft: '5px', fontSize: '11px', fontWeight: '800', background: dialQueueFilter === 'all' ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.1)', color: dialQueueFilter === 'all' ? '#60A5FA' : 'rgba(255,255,255,0.5)', borderRadius: '8px', padding: '1px 5px' } }, allCount))
          ];
        })()
      ),
      React.createElement('label', { htmlFor: 'dial-sort-mode', style: { fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.4)', letterSpacing: '1.2px', display: 'block', marginBottom: '4px' } }, 'SORT'),
      React.createElement('select', {
        id: 'dial-sort-mode', value: dialSortMode, onChange: e => setDialSortMode(e.target.value),
        style: { width: '100%', background: 'var(--navy-2)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.85)', borderRadius: '4px', padding: '5px 7px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }
      },
        React.createElement('option', { value: 'priority', style: { background: 'var(--navy-2)', color: '#f1f5f9' } }, 'Priority Score'),
        React.createElement('option', { value: 'phase',    style: { background: 'var(--navy-2)', color: '#f1f5f9' } }, 'Phase Engine'),
        React.createElement('option', { value: 'overdue',  style: { background: 'var(--navy-2)', color: '#f1f5f9' } }, 'Overdue First')
      )
    ),

    // ── QUEUE LIST ────────────────────────────────────────────────────────
    React.createElement('ul', {
      role: 'listbox', 'aria-label': 'Dial queue',
      style: { flex: 1, overflowY: 'auto', padding: 0, margin: 0, listStyle: 'none' }
    },
      (() => {
        const now3       = new Date();
        const activeList = dialQueueFilter === 'today' ? queue.filter(isDueToday) : queue;
        let sorted = [...activeList];

        if (dialSortMode === 'priority') sorted.sort(masterQueueSort); // v3.26 — composite: phase + next_dial tiebreaker; overdue sort mode handles callback urgency
        else if (dialSortMode === 'phase') sorted.sort((a, b) => getPhasePriority(b) - getPhasePriority(a));
        else if (dialSortMode === 'overdue') sorted.sort((a, b) => {
          const aOD = (a.nextCallback && new Date(a.nextCallback) < now3) ? 1 : 0;
          const bOD = (b.nextCallback && new Date(b.nextCallback) < now3) ? 1 : 0;
          if (bOD !== aOD) return bOD - aOD;
          return ((bOD ? now3 - new Date(b.nextCallback) : 0) - (aOD ? now3 - new Date(a.nextCallback) : 0));
        });

        const DISP_ICON = {
          no_answer: '📵', vm_left: '📬', callback: '📅', follow_up: '🔄',
          not_interested: '🚫', hung_up: '📴', dnc: '⛔', no_show: '❌',
          appointment_booked: '✅', not_called: '', no_sale: '💬',
        };
        const recencyLabel = iso => {
          if (!iso) return null;
          const d    = new Date(iso);
          if (d.toDateString() === now3.toDateString()) return 'today';
          const days = Math.floor((Date.now() - d.getTime()) / 86400000);
          if (days === 1) return '1d ago';
          if (days < 7)  return days + 'd ago';
          if (days < 30) return Math.floor(days / 7) + 'wk ago';
          return Math.floor(days / 30) + 'mo ago';
        };
        const fmtCbTime = iso => {
          if (!iso) return null;
          return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        };

        return sorted.map((lead, idx) => {
          const isActive    = openId === lead.id;
          const isOD        = lead.nextCallback && new Date(lead.nextCallback) < now3;
          const isCbToday   = lead.nextCallback && new Date(lead.nextCallback).toDateString() === now3.toDateString();
          const stuck       = isUWStuck(lead);
          const calledToday = dialQueueFilter === 'all' && lead.lastContact && new Date(lead.lastContact).toDateString() === now3.toDateString();
          const dispIcon    = DISP_ICON[lead.disposition] || '';
          const recency     = recencyLabel(lead.lastContact);

          return React.createElement('li', {
            key: lead.id, role: 'option', 'aria-selected': isActive, tabIndex: 0,
            onClick:  () => { setOpenId(isActive ? null : lead.id); setNoteText(''); setDialRightTab('script'); },
            onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(isActive ? null : lead.id); setNoteText(''); setDialRightTab('script'); } },
            style: {
              minHeight: '48px', padding: '10px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              cursor: 'pointer',
              background:  isActive ? 'rgba(93,202,165,0.18)' : calledToday ? 'rgba(255,255,255,0.02)' : 'transparent',
              opacity:     calledToday && !isActive ? 0.6 : 1,
              borderLeft:  '3px solid ' + (isActive ? '#5DCAA5' : stuck ? '#EF4444' : isOD ? '#EF4444' : BC[lead.bucket] + '80'),
              display: 'flex', flexDirection: 'column', justifyContent: 'center', outline: 'none'
            }
          },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' } },
              React.createElement('span', { 'aria-hidden': 'true', style: { fontSize: '11px', color: 'rgba(255,255,255,0.5)', minWidth: '15px', fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 } }, idx + 1),
              React.createElement('span', { style: { fontSize: '12px', fontWeight: '700', color: isActive ? '#5DCAA5' : 'rgba(255,255,255,0.88)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, lead.name),
              calledToday && React.createElement('span', { title: 'Already worked today', style: { fontSize: '10px', padding: '1px 4px', borderRadius: '4px', background: 'rgba(93,202,165,0.15)', color: '#5DCAA5', fontWeight: '800', flexShrink: 0, marginRight: '3px' } }, '✓'),
              React.createElement('span', { 'aria-hidden': 'true', style: { fontSize: '11px', padding: '1px 5px', borderRadius: '8px', background: BC[lead.bucket] + '28', color: BC[lead.bucket], fontWeight: '800', flexShrink: 0 } }, lead.bucket)
            ),
            React.createElement('div', { style: { paddingLeft: '20px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' } },
              React.createElement('span', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontFamily: "'JetBrains Mono',monospace", fontWeight: '500', flexShrink: 0 } }, lead.phone),
              (dispIcon || recency) && React.createElement('span', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 } },
                (dispIcon ? dispIcon + ' ' : '') + (recency || '')
              ),
              (isOD || isCbToday) && React.createElement('span', {
                style: { fontSize: '10px', fontWeight: '800', flexShrink: 0, marginLeft: 'auto', color: isOD ? '#EF4444' : '#34D399', background: isOD ? 'rgba(239,68,68,0.12)' : 'rgba(52,211,153,0.12)', padding: '1px 5px', borderRadius: '4px' }
              }, (isOD ? 'OD ' : 'CB ') + (fmtCbTime(lead.nextCallback) || '')),
              stuck && React.createElement('span', { style: { fontSize: '11px', color: '#FBBF24', fontWeight: '800', flexShrink: 0 } }, 'UW')
            )
          );
        });
      })(),

      (dialQueueFilter === 'today' ? queue.filter(isDueToday).length : queue.length) === 0 &&
        React.createElement('li', { style: { padding: '40px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '12px', listStyle: 'none' } },
          dialQueueFilter === 'today' ? 'No leads due today' : '✓ Queue empty'
        )
    )
  );
}
