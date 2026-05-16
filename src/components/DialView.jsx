import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BC, BL, NC, fmt, inp, chip, isUWStuck, daysInUW } from '../constants.js';
import { getPhasePriority } from './TodaysBlock';
import { isDueToday } from '../lib/phaseEngine';

const LS_SESSION = "metka-session-v1";

// ── Script token renderer — module scope (no per-render redefinition) ──────
const TOKEN_FIELDS = {
  'FIRST_NAME':'firstName','CITY':'city','STATE':'state',
  'LOAN_AMOUNT':'loanAmount','AGE':'age','LEAD TYPE':'leadType',
  'LEAD_TYPE':'leadType'
};
/** @param {string} text @param {object} lead @param {function} upd */
function renderLiveTokens(text, lead, upd) {
  if (!lead || !text) return [React.createElement(React.Fragment, { key: 'x' }, text || '')];
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]$/);
    if (!m) return React.createElement(React.Fragment, { key: i }, part);
    const token = m[1];
    const field = TOKEN_FIELDS[token];
    const val = field ? (String(lead[field] || '')) : '';
    if (val) {
      return React.createElement('span', {
        key: i,
        style: {
          display: 'inline', padding: '1px 8px', borderRadius: '4px',
          background: '#dcfce7', color: '#15803d', fontWeight: '800',
          border: '1px solid #86efac', fontSize: 'inherit', cursor: 'default'
        }
      }, val);
    }
    return React.createElement('input', {
      key: i + '-input',
      placeholder: token.replace(/_/g, ' ').toLowerCase(),
      defaultValue: '',
      onBlur: e => {
        const v = e.target.value.trim();
        if (v && field) upd(lead.id, { [field]: v });
      },
      style: {
        display: 'inline', padding: '2px 8px', borderRadius: '4px',
        border: '1px dashed #fcd34d', background: '#fefce8',
        color: '#92400e', fontWeight: '700', fontSize: '0.88em',
        width: 'auto', minWidth: '72px', maxWidth: '150px',
        fontFamily: 'inherit', outline: 'none', verticalAlign: 'middle',
        marginInline: '2px'
      }
    });
  });
}

// ── Power Dialer timing constants — module scope ─────────────────────────────
const ATTEMPT1_SEC = 18;
const ATTEMPT2_SEC = 30;

// Dispositions that keep the call live (no auto-hang-up on fire)
const KEEP_CALL_DISPS = new Set(['callback', 'appointment_booked']);

export default function DialView({
  queue, session, setSession, sessionPaused, setSessionPaused, setDialSessionActive,
  dialSortMode, setDialSortMode,
  dialRightTab, setDialRightTab,
  openId, setOpenId,
  open, upd,
  dialLead, useTwilioCalling, twilioDevice,
  hangUp, callStatus,
  activeCall, activeCallLead, callMuted, callElapsed, toggleMute,
  todayLeads,
  noteText, setNoteText,
  noteType, setNoteType,
  addNote,
  handleDisposition,
  confirmCbDate, setConfirmCbDate, confirmCbTime, setConfirmCbTime,
  confirmReschedule, setConfirmReschedule,
  tcpaInfo,
  detailTab, setDetailTab,
  scripts, scriptType, setScriptType, scriptSection, setScriptSection,
  templates,
  calendlyUrl, setCalendlyTargetId,
  refreshQueueOrder,
  openCalendlyPopup,
  logActivity,
  todayCount,
  setView,
  setPrevView,
  callbackPresets,
}) {
  // ── POWER DIALER ENGINE (18s/30s auto-hangup) ──────────────────

  // ── Call control panel state ─────────────────────────────────────────────
  const [callPanelExpanded, setCallPanelExpanded] = useState(true);
  const [onHold,            setOnHold]            = useState(false);

  // ── Queue filter: "today" shows only phase-engine due leads, "all" shows full queue ──
  const [dialQueueFilter, setDialQueueFilter] = useState('today');

  // ── Attempt 2 pending flag — fires after call actually disconnects (callStatus=null) ──
  const [pdPendingAttempt2, setPdPendingAttempt2] = useState(false);

  // ── Callback scheduler popover ────────────────────────────────────────────
  const [cbPopoverOpen, setCbPopoverOpen] = useState(false);
  const [cbCustomTs,    setCbCustomTs]    = useState('');

  // ── Manual appointment booking popover ───────────────────────────────────
  const [manualApptOpen, setManualApptOpen] = useState(false);
  const [manualApptTs,   setManualApptTs]   = useState('');

  // ── Power Dial queue: intersection of current UI queue and phase-engine due-today ──
  // This is what Power Dial actually dials through — consistent with the TODAY badge.
  const pdQueue = React.useMemo(() => queue.filter(isDueToday), [queue]);

  const [pdMode,         setPdMode]         = useState(false);
  const [pdIdx,          setPdIdx]          = useState(0);
  const [pdAttempt,      setPdAttempt]      = useState(1);
  const [pdCountdown,    setPdCountdown]    = useState(null);
  const [pdStatus,       setPdStatus]       = useState('idle'); // idle | dialing | answered | pausing
  const [pdLockedQueue,  setPdLockedQueue]  = useState([]);
  // ── Session log for Google Calendar export ────────────────────────────────
  const [pdSessionStart, setPdSessionStart] = useState(null);
  const [pdSessionLog,   setPdSessionLog]   = useState(null); // set on stop; cleared on next start

  const pdTimerRef   = useRef(null);
  const pdTimeoutRef = useRef(null);
  const pdAdvanceRef = useRef(null);

  const pdClearTimers = useCallback(() => {
    if (pdTimerRef.current)   { clearInterval(pdTimerRef.current);  pdTimerRef.current   = null; }
    if (pdTimeoutRef.current) { clearTimeout(pdTimeoutRef.current); pdTimeoutRef.current = null; }
    if (pdAdvanceRef.current) { clearTimeout(pdAdvanceRef.current); pdAdvanceRef.current = null; }
    setPdCountdown(null);
  }, []);

  const pdAdvanceToNext = useCallback((queue, nextIdx) => {
    pdClearTimers();
    setPdStatus('pausing');
    pdAdvanceRef.current = setTimeout(() => {
      if (nextIdx >= queue.length) {
        setPdStatus('idle'); setPdIdx(0); setPdMode(false); return;
      }
      const nextLead = queue[nextIdx];
      setPdIdx(nextIdx);
      setPdAttempt(1);
      setPdStatus('dialing');
      setOpenId(nextLead.id);
      dialLead(nextLead);

      let secs = ATTEMPT1_SEC;
      setPdCountdown(secs);
      pdTimerRef.current = setInterval(() => { secs -= 1; setPdCountdown(secs); }, 1000);
      pdTimeoutRef.current = setTimeout(() => {
        // Attempt 1 timeout — hang up, set pending flag; useEffect fires attempt 2 once callStatus hits null
        if (twilioDevice) twilioDevice.disconnectAll();
        pdClearTimers();
        setPdAttempt(2); setPdStatus('pausing'); setPdPendingAttempt2(true);
      }, ATTEMPT1_SEC * 1000);
    }, 1500);
  }, [dialLead, twilioDevice, setOpenId, pdClearTimers]);

  const pdStart = useCallback(() => {
    if (!pdQueue || !pdQueue.length) {
      alert('No leads due today in your current queue. Switch to ALL or adjust your filters.');
      return;
    }
    const queue = [...pdQueue];
    setPdLockedQueue(queue);
    setPdIdx(0); setPdAttempt(1); setPdStatus('dialing'); setPdMode(true);
    setPdSessionStart(Date.now()); setPdSessionLog(null);

    const lead = queue[0];
    setOpenId(lead.id);
    dialLead(lead);

    let secs = ATTEMPT1_SEC;
    setPdCountdown(secs);
    pdTimerRef.current = setInterval(() => { secs -= 1; setPdCountdown(secs); }, 1000);
    pdTimeoutRef.current = setTimeout(() => {
      if (twilioDevice) twilioDevice.disconnectAll();
      pdClearTimers();
      setPdAttempt(2); setPdStatus('pausing'); setPdPendingAttempt2(true);
    }, ATTEMPT1_SEC * 1000);
  }, [pdQueue, dialLead, twilioDevice, handleDisposition, setOpenId, pdClearTimers, pdAdvanceToNext]);

  const pdStop = useCallback(() => {
    const endTs = Date.now();
    setPdSessionLog(prev => {
      // Only write a new log if we actually started a session
      if (!pdSessionStart || pdIdx < 0) return prev;
      return { start: pdSessionStart, end: endTs, dialsCount: pdIdx + 1, totalQueued: pdLockedQueue.length };
    });
    setPdSessionStart(null);
    pdClearTimers();
    if (twilioDevice) twilioDevice.disconnectAll();
    setPdStatus('idle'); setPdIdx(0); setPdAttempt(1); setPdPendingAttempt2(false); setPdLockedQueue([]); setPdMode(false);
  }, [twilioDevice, pdClearTimers, pdSessionStart, pdIdx, pdLockedQueue]);

  // Detect answered call — stop countdown, mark as answered
  useEffect(() => {
    if (pdMode && pdStatus === 'dialing' && callStatus === 'connected') {
      pdClearTimers(); setPdStatus('answered');
    }
  }, [callStatus, pdMode, pdStatus, pdClearTimers]);

  // Fire attempt 2 once the attempt 1 call has actually disconnected (callStatus → null)
  useEffect(() => {
    if (pdMode && pdPendingAttempt2 && callStatus === null) {
      setPdPendingAttempt2(false);
      const currentLead = pdLockedQueue[pdIdx];
      if (!currentLead) return;
      setPdStatus('dialing');
      dialLead(currentLead);
      setPdCountdown(null);
    }
  }, [callStatus, pdMode, pdPendingAttempt2, pdLockedQueue, pdIdx, dialLead]);

  // ── fireDisp: disposition wrapper that also advances PD when a call is answered ──
  // All JSX disposition buttons call this instead of handleDisposition directly.
  // Internal PD timeout paths (no_answer) still call handleDisposition directly
  // because they already invoke pdAdvanceToNext immediately after.
  const fireDisp = useCallback((dispId) => {
    // Hang up on all dispositions except ones where the user explicitly keeps the call alive
    if (!KEEP_CALL_DISPS.has(dispId) && twilioDevice) {
      twilioDevice.disconnectAll();
    }
    handleDisposition(dispId);
    if (pdMode && (pdStatus === 'answered' || pdStatus === 'dialing')) {
      pdClearTimers();
      pdAdvanceToNext(pdLockedQueue, pdIdx + 1);
    }
  }, [handleDisposition, twilioDevice, pdMode, pdStatus, pdClearTimers, pdAdvanceToNext, pdLockedQueue, pdIdx]);

  // Cleanup on unmount
  useEffect(() => () => pdClearTimers(), [pdClearTimers]);

  // PD display helpers
  const currentPdLead = pdMode && pdLockedQueue.length > 0 ? pdLockedQueue[pdIdx] : null;
  const pdBg     = pdStatus === 'answered' ? '#1A3A5C' : pdStatus === 'pausing' ? '#252D3D' : '#171E2D';
  const pdAccent = pdStatus === 'answered' ? '#3B82F6' : pdStatus === 'pausing' ? '#64748B' : '#3B82F6';

    return React.createElement("div", { style: { display: "flex", flex: 1, height: "100%", minWidth: 0, overflow: "hidden" } },

    // ── LEFT: Dark sidebar queue (210px) ──
    React.createElement("div", { style: { width: "240px", flexShrink: 0, background: "#1E2433", display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid rgba(0,0,0,0.3)" } },

      // ── SECTION 1: Header — MINISTRY OF PROTECTION (unchanged) ──────────────
      React.createElement("div", { style: { padding: "10px 12px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
          // Brand label + live dot
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "7px" } },
            React.createElement("div", {
              style: {
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: callStatus === 'connected' ? "#10B981" : callStatus === 'connecting' ? "#F59E0B" : "rgba(255,255,255,0.2)",
                boxShadow: callStatus === 'connected' ? "0 0 6px #10B981" : "none",
                transition: "background 0.3s, box-shadow 0.3s"
              }
            }),
            React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em" } }, "MINISTRY OF PROTECTION")
          ),
          // Controls: collapse + exit
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "2px" } },
            React.createElement("button", {
              onClick: () => setCallPanelExpanded(e => !e),
              title: callPanelExpanded ? "Collapse call controls" : "Expand call controls",
              style: { background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "14px", cursor: "pointer", padding: "1px 4px", lineHeight: 1, transition: "color 0.15s" },
              onMouseEnter: e => e.currentTarget.style.color = "rgba(255,255,255,0.7)",
              onMouseLeave: e => e.currentTarget.style.color = "rgba(255,255,255,0.5)"
            }, callPanelExpanded ? "−" : "+"),
            React.createElement("button", {
              onClick: () => setView("dashboard"),
              title: "Exit dial view",
              style: { background: "transparent", border: "none", color: "rgba(255,255,255,0.55)", fontSize: "14px", cursor: "pointer", padding: "1px 4px", lineHeight: 1, transition: "color 0.15s" },
              onMouseEnter: e => e.currentTarget.style.color = "rgba(255,255,255,0.8)",
              onMouseLeave: e => e.currentTarget.style.color = "rgba(255,255,255,0.55)"
            }, "✕")
          )
        )
      ),

      // ── SECTION 2: Call control panel (below header, collapsible) ──────────
      callPanelExpanded && (() => {
        const isLive = callStatus === 'connected';
        const isConnecting = callStatus === 'connecting';
        const timerStr = (isLive || isConnecting)
          ? (Math.floor((callElapsed||0) / 60) + ':' + String((callElapsed||0) % 60).padStart(2, '0'))
          : '--:--';
        const leadName = isLive
          ? ((activeCallLead||open)?.name || 'Unknown')
          : (open?.name || '— idle —');
        return React.createElement("div", {
          style: {
            padding: "10px 12px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            flexShrink: 0,
            background: isLive ? "rgba(16,185,129,0.06)" : isConnecting ? "rgba(245,158,11,0.06)" : "rgba(0,0,0,0.12)",
            transition: "background 0.4s"
          }
        },
          // Lead name
          React.createElement("div", {
            title: leadName,
            style: {
              fontSize: "12px", fontWeight: "800",
              color: isLive ? "#f1f5f9" : "rgba(255,255,255,0.28)",
              marginBottom: "1px",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              transition: "color 0.3s"
            }
          }, leadName),
          // Timer
          React.createElement("div", {
            style: {
              fontSize: "22px", fontWeight: "800",
              fontFamily: "'JetBrains Mono', monospace",
              color: isLive ? "#10B981" : isConnecting ? "#F59E0B" : "rgba(255,255,255,0.4)",
              letterSpacing: "0.08em", marginBottom: "10px",
              transition: "color 0.3s"
            }
          }, timerStr),
          // MUTE | HOLD | END
          React.createElement("div", { style: { display: "flex", gap: "4px" } },
            React.createElement("button", {
              onClick: isLive ? toggleMute : undefined,
              title: callMuted ? "Unmute" : "Mute",
              style: {
                flex: 1, minHeight: "36px", borderRadius: "7px", fontSize: "11px", fontWeight: "800",
                cursor: isLive ? "pointer" : "not-allowed",
                background: callMuted ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.07)",
                color: callMuted ? "#F59E0B" : isLive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)",
                border: callMuted ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(255,255,255,0.1)",
                transition: "all 0.15s"
              }
            }, callMuted ? "🔇 MUTED" : "🎙 MUTE"),
            React.createElement("button", {
              onClick: isLive ? () => setOnHold(h => !h) : undefined,
              title: onHold ? "Resume" : "Hold",
              style: {
                flex: 1, minHeight: "36px", borderRadius: "7px", fontSize: "11px", fontWeight: "800",
                cursor: isLive ? "pointer" : "not-allowed",
                background: onHold ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.07)",
                color: onHold ? "#818CF8" : isLive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)",
                border: onHold ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.1)",
                transition: "all 0.15s"
              }
            }, onHold ? "⏸ HOLD" : "⏸ HOLD"),
            React.createElement("button", {
              onClick: isLive ? hangUp : undefined,
              title: "End call",
              style: {
                flex: 1, minHeight: "36px", borderRadius: "7px", fontSize: "11px", fontWeight: "800",
                cursor: isLive ? "pointer" : "not-allowed",
                background: isLive ? "rgba(220,38,38,0.2)" : "rgba(255,255,255,0.05)",
                color: isLive ? "#EF4444" : "rgba(255,255,255,0.12)",
                border: isLive ? "1px solid rgba(220,38,38,0.5)" : "1px solid rgba(255,255,255,0.07)",
                transition: "all 0.15s"
              }
            }, "📵 END")
          )
        );
      })(),

      // ── SECTION 3: Power dial + session controls ────────────────────────────
      React.createElement("div", { style: { padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 } },

        // ── Power Dial buttons (no active session) ──────────────────
        !session && React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "5px", marginBottom: "8px" } },

          // ⚡ Power Dial Today — real 18s/30s auto-hangup engine
          pdMode && pdStatus !== 'idle'
            ? React.createElement("button", {
                onClick: pdStop,
                title: "Stop Power Dial",
                style: {
                  width: "100%", minHeight: "34px", padding: "0 8px",
                  fontSize: "11px", fontWeight: "800", letterSpacing: "0.8px",
                  background: "rgba(220,38,38,0.22)", color: "#EF4444",
                  border: "1px solid rgba(220,38,38,0.45)",
                  borderRadius: "4px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "5px"
                }
              },
                React.createElement("span", null, "■"),
                React.createElement("span", null, "STOP POWER DIAL"),
                React.createElement("span", {
                  style: { fontSize: "11px", fontWeight: "800", background: "rgba(220,38,38,0.3)", color: "#EF4444", borderRadius: "8px", padding: "1px 7px" }
                }, (pdIdx + 1) + "/" + pdLockedQueue.length)
              )
            : React.createElement("button", {
                onClick: pdStart,
                title: "Auto-dial: 18s attempt 1, 30s attempt 2, then advance to next lead",
                style: {
                  width: "100%", minHeight: "34px", padding: "0 8px",
                  fontSize: "11px", fontWeight: "800", letterSpacing: "0.8px",
                  background: pdQueue.length > 0 ? "rgba(16,185,129,0.22)" : "rgba(255,255,255,0.06)",
                  color: pdQueue.length > 0 ? "#3B82F6" : "rgba(255,255,255,0.55)",
                  border: "1px solid " + (pdQueue.length > 0 ? "rgba(16,185,129,0.45)" : "rgba(255,255,255,0.12)"),
                  borderRadius: "4px", cursor: pdQueue.length > 0 ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "5px"
                }
              },
                React.createElement("span", null, "⚡"),
                React.createElement("span", null, "POWER DIAL"),
                React.createElement("span", {
                  style: {
                    fontSize: "11px", fontWeight: "800",
                    background: pdQueue.length > 0 ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)",
                    color: pdQueue.length > 0 ? "#3B82F6" : "rgba(255,255,255,0.5)",
                    borderRadius: "8px", padding: "1px 7px"
                  }
                }, pdQueue.length)
              ),

          // 📅 Log last session to Google Calendar — appears after PD stop
          !pdMode && pdSessionLog && (() => {
            const toGCalTs = (ms) => new Date(ms).toISOString().replace(/[-:.]/g,'').slice(0,15) + 'Z';
            const durationMin = Math.max(1, Math.round((pdSessionLog.end - pdSessionLog.start) / 60000));
            const startLabel = new Date(pdSessionLog.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const endLabel   = new Date(pdSessionLog.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const details = encodeURIComponent(
              `Ministry of Protection — Power Dial Session\n\nLeads Dialed: ${pdSessionLog.dialsCount} / ${pdSessionLog.totalQueued}\nDuration: ${durationMin} min\nStart: ${startLabel}  |  End: ${endLabel}\n\nLogged via Metka Field Ops CRM`
            );
            const title = encodeURIComponent(`🔥 MOP Dial Session — ${pdSessionLog.dialsCount} dials`);
            const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${toGCalTs(pdSessionLog.start)}/${toGCalTs(pdSessionLog.end)}&details=${details}`;
            return React.createElement("button", {
              onClick: () => window.open(gcalUrl, '_blank'),
              title: "Log this dial session to Google Calendar",
              style: {
                width: "100%", minHeight: "30px", padding: "0 8px",
                fontSize: "10px", fontWeight: "800", letterSpacing: "0.5px",
                background: "rgba(66,133,244,0.15)", color: "#93C5FD",
                border: "1px solid rgba(66,133,244,0.35)",
                borderRadius: "4px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                marginBottom: "4px"
              }
            },
              "📅",
              React.createElement("span", null, "LOG SESSION TO CALENDAR"),
              React.createElement("span", { style: { opacity: 0.7 } }, `${pdSessionLog.dialsCount} dials · ${durationMin}m`)
            );
          })(),

          // ▶ Manual Dial — one lead at a time, full queue as sorted
          queue.length > 0 && React.createElement("button", {
            onClick: () => {
              const ids = queue.map(l => l.id);
              const s = { ids, idx: 0, total: ids.length, startedAt: new Date().toISOString() };
              setSession(s); setSessionPaused(false);
              try { localStorage.setItem(LS_SESSION, JSON.stringify(s)); } catch {}
              setOpenId(ids[0]); setDialSessionActive(true); setNoteText(""); setDetailTab("live");
            },
            title: "Manual dial: step through the queue one lead at a time",
            style: {
              width: "100%", minHeight: "28px", padding: "0 8px",
              fontSize: "11px", fontWeight: "700", letterSpacing: "0.5px",
              background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(255,255,255,0.13)", borderRadius: "4px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "5px"
            }
          },
            React.createElement("span", null, "▶"),
            React.createElement("span", null, "MANUAL DIAL"),
            React.createElement("span", {
              style: {
                fontSize: "11px", fontWeight: "700", background: "rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.4)", borderRadius: "8px", padding: "1px 6px"
              }
            }, queue.length)
          )
        ),

        React.createElement("div", {
          "aria-live": "polite",
          role: "status",
          style: { fontSize: "12px", fontWeight: "700", color: "rgba(255,255,255,0.85)", marginBottom: "8px" }
        }, session
          ? (session.idx + 1) + " / " + session.total + " leads"
          : dialQueueFilter === "today"
            ? queue.filter(isDueToday).length + " due today"
            : queue.length + " in queue"
        ),
        session && React.createElement("div", {
          style: { height: "4px", background: "rgba(255,255,255,0.12)", borderRadius: "4px", overflow: "hidden", marginBottom: "8px" },
          role: "progressbar",
          "aria-valuenow": session.idx + 1,
          "aria-valuemin": 1,
          "aria-valuemax": session.total,
          "aria-label": "Session progress"
        },
          React.createElement("div", { style: { height: "100%", width: Math.round(((session.idx + 1) / session.total) * 100) + "%", background: sessionPaused ? "#F59E0B" : "#10B981", borderRadius: "4px", transition: "width 0.3s" } })
        ),
        React.createElement("div", { style: { display: "flex", gap: "4px" } },
          session && React.createElement("button", {
            onClick: () => setSessionPaused(p => !p),
            "aria-label": sessionPaused ? "Resume dial session" : "Pause dial session",
            style: { flex: 1, minHeight: "30px", fontSize: "11px", fontWeight: "700", background: sessionPaused ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.1)", color: sessionPaused ? "#F59E0B" : "rgba(255,255,255,0.8)", border: "1px solid " + (sessionPaused ? "#F59E0B" : "rgba(255,255,255,0.18)"), borderRadius: "4px", cursor: "pointer" }
          }, sessionPaused ? "▶ RESUME" : "⏸ PAUSE"),
          session && React.createElement("button", {
            onClick: () => { setSession(null); setSessionPaused(false); setDialSessionActive(false); try { localStorage.removeItem(LS_SESSION); } catch {} },
            "aria-label": "End session",
            style: { minHeight: "30px", padding: "0 7px", fontSize: "11px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)", borderRadius: "4px", cursor: "pointer" }
          }, "⏹"),
          React.createElement("button", {
            onClick: refreshQueueOrder,
            "aria-label": "Refresh queue order",
            title: "Re-sort by live priority",
            style: { minHeight: "30px", padding: "0 7px", fontSize: "11px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)", borderRadius: "4px", cursor: "pointer" }
          }, "🔄")
        )
      ),

      // ── PD Status Bar ──────────────────────────────────────────────
      pdMode && pdStatus !== 'idle' && currentPdLead && React.createElement("div", {
        style: { background: pdBg, borderBottom: "2px solid " + pdAccent, padding: "8px 12px", flexShrink: 0 }
      },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
          React.createElement("div", { style: { width: 8, height: 8, borderRadius: "50%", background: pdAccent, flexShrink: 0, boxShadow: "0 0 6px " + pdAccent } }),
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, currentPdLead.name || "Unknown"),
            React.createElement("div", { style: { fontSize: "11px", color: "#64748b", fontFamily: "'JetBrains Mono',monospace" } }, currentPdLead.phone)
          ),
          React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: pdAttempt === 2 ? "#F59E0B" : "#94a3b8", background: pdAttempt === 2 ? "#F59E0B22" : "var(--navy-2)", border: "1px solid " + (pdAttempt === 2 ? "#F59E0B" : "#334155"), borderRadius: "4px", padding: "2px 6px" } }, "ATT " + pdAttempt),
          React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: pdAccent, minWidth: "50px", textAlign: "right" } },
            pdStatus === 'answered' ? "✓ LIVE" : pdStatus === 'pausing' ? "…" : pdCountdown !== null ? pdCountdown + "s" : "Dialing"
          )
        ),
        pdCountdown !== null && pdStatus === 'dialing' && React.createElement("div", { style: { marginTop: "6px", background: "var(--navy-2)", borderRadius: "4px", height: "3px", overflow: "hidden" } },
          React.createElement("div", { style: { width: (pdCountdown / (pdAttempt === 1 ? 18 : 30) * 100) + "%", height: "100%", background: pdAccent, borderRadius: "4px", transition: "width 1s linear" } })
        )
      ),

      // ── QUEUE FILTER + SORT ──────────────────────────────────────────────────
      React.createElement("div", { style: { padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 } },

        // TODAY | ALL toggle
        React.createElement("div", { style: { display: "flex", gap: "4px", marginBottom: "8px" } },
          (() => {
            const todayCount2 = queue.filter(isDueToday).length;
            const allCount = queue.length;
            const btnBase = { flex: 1, minHeight: "26px", borderRadius: "4px", fontSize: "11px", fontWeight: "800", letterSpacing: "0.8px", cursor: "pointer", border: "1px solid", transition: "all 0.15s" };
            return [
              React.createElement("button", {
                key: "f-today",
                onClick: () => setDialQueueFilter("today"),
                title: "Show only leads due today per the Phase Engine",
                style: {
                  ...btnBase,
                  background: dialQueueFilter === "today" ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.05)",
                  color: dialQueueFilter === "today" ? "#3B82F6" : "rgba(255,255,255,0.4)",
                  borderColor: dialQueueFilter === "today" ? "rgba(16,185,129,0.45)" : "rgba(255,255,255,0.12)"
                }
              },
                "TODAY",
                React.createElement("span", {
                  style: { marginLeft: "5px", fontSize: "11px", fontWeight: "800", background: dialQueueFilter === "today" ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.1)", color: dialQueueFilter === "today" ? "#3B82F6" : "rgba(255,255,255,0.5)", borderRadius: "8px", padding: "1px 5px" }
                }, todayCount2)
              ),
              React.createElement("button", {
                key: "f-all",
                onClick: () => setDialQueueFilter("all"),
                title: "Show full queue",
                style: {
                  ...btnBase,
                  background: dialQueueFilter === "all" ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.05)",
                  color: dialQueueFilter === "all" ? "#60A5FA" : "rgba(255,255,255,0.4)",
                  borderColor: dialQueueFilter === "all" ? "rgba(59,130,246,0.45)" : "rgba(255,255,255,0.12)"
                }
              },
                "ALL",
                React.createElement("span", {
                  style: { marginLeft: "5px", fontSize: "11px", fontWeight: "800", background: dialQueueFilter === "all" ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.1)", color: dialQueueFilter === "all" ? "#60A5FA" : "rgba(255,255,255,0.5)", borderRadius: "8px", padding: "1px 5px" }
                }, allCount)
              )
            ];
          })()
        ),

        // Sort selector
        React.createElement("label", { htmlFor: "dial-sort-mode", style: { fontSize: "11px", fontWeight: "800", color: "rgba(255,255,255,0.4)", letterSpacing: "1.2px", display: "block", marginBottom: "4px" } }, "SORT"),
        React.createElement("select", {
          id: "dial-sort-mode",
          value: dialSortMode,
          onChange: e => setDialSortMode(e.target.value),
          style: { width: "100%", background: "var(--navy-2)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.85)", borderRadius: "4px", padding: "5px 7px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }
        },
          React.createElement("option", { value: "priority", style: { background: "var(--navy-2)", color: "#f1f5f9" } }, "Priority Score"),
          React.createElement("option", { value: "phase", style: { background: "var(--navy-2)", color: "#f1f5f9" } }, "Phase Engine"),
          React.createElement("option", { value: "overdue", style: { background: "var(--navy-2)", color: "#f1f5f9" } }, "Overdue First")
        )
      ),

      // Queue list — ul[role=listbox]
      React.createElement("ul", {
        role: "listbox",
        "aria-label": "Dial queue",
        style: { flex: 1, overflowY: "auto", padding: 0, margin: 0, listStyle: "none" }
      },
        (() => {
          const now3 = new Date();
          const activeList = dialQueueFilter === "today" ? queue.filter(isDueToday) : queue;
          let sorted = [...activeList];
          if (dialSortMode === "priority") sorted.sort((a, b) => {
            const overdueBonus = l => (l.nextCallback && new Date(l.nextCallback) < now3) ? 5000 : 0;
            return (getPhasePriority(b) + overdueBonus(b)) - (getPhasePriority(a) + overdueBonus(a));
          });
          else if (dialSortMode === "phase") sorted.sort((a, b) => getPhasePriority(b) - getPhasePriority(a));
          else if (dialSortMode === "overdue") sorted.sort((a, b) => {
            const aOD = (a.nextCallback && new Date(a.nextCallback) < now3) ? 1 : 0;
            const bOD = (b.nextCallback && new Date(b.nextCallback) < now3) ? 1 : 0;
            if (bOD !== aOD) return bOD - aOD;
            // Secondary: overdue age (oldest first)
            const aAge = aOD ? now3 - new Date(a.nextCallback) : 0;
            const bAge = bOD ? now3 - new Date(b.nextCallback) : 0;
            return bAge - aAge;
          });

          return sorted.map((lead, idx) => {
            const isActive = openId === lead.id;
            const isOD = lead.nextCallback && new Date(lead.nextCallback) < now3;
            const stuck = isUWStuck(lead);
            return React.createElement("li", {
              key: lead.id,
              role: "option",
              "aria-selected": isActive,
              tabIndex: 0,
              onClick: () => { setOpenId(isActive ? null : lead.id); setNoteText(""); setDialRightTab("script"); },
              onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(isActive ? null : lead.id); setNoteText(""); setDialRightTab("script"); } },
              style: {
                minHeight: "48px",
                padding: "10px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                cursor: "pointer",
                background: isActive ? "rgba(93,202,165,0.18)" : "transparent",
                borderLeft: "3px solid " + (isActive ? "#5DCAA5" : stuck ? "#EF4444" : isOD ? "#EF4444" : BC[lead.bucket] + "80"),
                display: "flex", flexDirection: "column", justifyContent: "center",
                outline: "none"
              }
            },
              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "5px", marginBottom: "2px" } },
                React.createElement("span", { "aria-hidden": "true", style: { fontSize: "11px", color: "rgba(255,255,255,0.5)", minWidth: "15px", fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 } }, idx + 1),
                React.createElement("span", { style: { fontSize: "12px", fontWeight: "700", color: isActive ? "#5DCAA5" : "rgba(255,255,255,0.88)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, lead.name),
                React.createElement("span", { "aria-hidden": "true", style: { fontSize: "11px", padding: "1px 5px", borderRadius: "8px", background: BC[lead.bucket] + "28", color: BC[lead.bucket], fontWeight: "800", flexShrink: 0 } }, lead.bucket)
              ),
              React.createElement("div", { style: { paddingLeft: "20px", display: "flex", gap: "6px", alignItems: "center" } },
                React.createElement("span", { style: { fontSize: "11px", color: "rgba(255,255,255,0.45)", fontFamily: "'JetBrains Mono',monospace", fontWeight: "500" } }, lead.phone),
                isOD && React.createElement("span", { style: { fontSize: "11px", color: "#EF4444", fontWeight: "800", marginLeft: "auto" } }, "OD"),
                stuck && React.createElement("span", { style: { fontSize: "11px", color: "#FBBF24", fontWeight: "800", marginLeft: "auto" } }, "UW")
              )
            );
          });
        })(),
        (dialQueueFilter === "today" ? queue.filter(isDueToday).length : queue.length) === 0 && React.createElement("li", { style: { padding: "40px 16px", textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: "12px", listStyle: "none" } },
          dialQueueFilter === "today" ? "No leads due today" : "✓ Queue empty"
        )
      )
    ),

    // ── CENTER: Lead detail + pinned disp bar ──
    React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--surface)" } },
      open ? React.createElement(React.Fragment, null,

        // Sticky lead header
        React.createElement("div", { style: { padding: "14px 18px 10px", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0, zIndex: 8 } },
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" } },
            React.createElement("label", { htmlFor: "dial-lead-name", className: "sr-only" }, "Lead name"),
            React.createElement("input", {
              id: "dial-lead-name",
              key: "dial-name-" + open.id,
              defaultValue: open.name,
              onBlur: e => { const v = e.target.value.trim(); if (v && v !== open.name) upd(open.id, { name: v }); },
              style: { fontFamily: "'Syne',sans-serif", fontWeight: "800", fontSize: "20px", color: "var(--t1)", lineHeight: 1.2, background: "transparent", border: "none", outline: "none", borderBottom: "2px solid transparent", padding: "0", flex: 1, cursor: "text", transition: "border-color 0.15s" },
              onFocus: e => { e.target.style.borderBottomColor = "var(--blue)"; },
              title: "Click to edit name"
            }),
            React.createElement("button", {
              onClick: () => { setPrevView("dial"); setView("contact"); },
              title: "View full contact card",
              style: { flexShrink: 0, display: "flex", alignItems: "center", gap: "4px", padding: "5px 10px", background: "var(--navy)", color: "#fff", border: "none", borderRadius: "6px", fontSize: "11px", fontWeight: "800", cursor: "pointer", letterSpacing: "0.05em", whiteSpace: "nowrap", transition: "opacity 0.15s" },
              onMouseEnter: e => e.currentTarget.style.opacity = "0.85",
              onMouseLeave: e => e.currentTarget.style.opacity = "1"
            }, "↗ VIEW LEAD")
          ),
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
            React.createElement("a", {
              href: (useTwilioCalling && twilioDevice) ? "#" : "tel:" + open.phone.replace(/\D/g, ""),
              onClick: e => { e.preventDefault(); dialLead(open); },
              "aria-label": "Dial " + open.phone,
              style: { fontSize: "13px", color: "var(--blue)", fontFamily: "'JetBrains Mono',monospace", fontWeight: "700", padding: "4px 10px", background: "var(--blue-dim)", borderRadius: "4px", border: "1px solid var(--blue-mid)", textDecoration: "none" }
            }, open.phone),
            tcpaInfo && React.createElement("span", {
              role: "status",
              title: "Local time — TCPA safe hours 8AM-9PM",
              style: { fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "4px", background: tcpaInfo.safe ? "var(--green-dim)" : "var(--red-dim)", color: tcpaInfo.safe ? "var(--green)" : "var(--red)", border: "1px solid " + (tcpaInfo.safe ? "#6EE7B7" : "#FCA5A5") }
            }, (tcpaInfo.safe ? "🟢 " : "🔴 ") + tcpaInfo.timeStr + " " + tcpaInfo.ltz),
            React.createElement("span", { style: { fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: BC[open.bucket] + "18", color: BC[open.bucket], fontWeight: "800" } }, BL[open.bucket]),
            open.leadType && React.createElement("span", { style: { fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: "var(--blue-mid)", color: "#1D4ED8", fontWeight: "700" } }, open.leadType),
            open.city && open.state && React.createElement("span", { style: { fontSize: "11px", color: "var(--t3)" } }, "📍 " + open.city + ", " + open.state),
            isUWStuck(open) && React.createElement("span", { className: "pulse-red", style: { fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: "var(--red-dim)", color: "var(--red)", fontWeight: "800", border: "1px solid #FCA5A5" } }, "⚠ UW " + daysInUW(open) + "d")
          )
        ),

        // Scrollable body
        React.createElement("div", { style: { flex: 1, overflowY: "auto", padding: "14px 18px" } },

          // Appointment gate
          (open.disposition === "appointment_booked" && open.nextCallback && new Date(open.nextCallback) < new Date() && !open.apptConfirmed)
            ? React.createElement("div", { style: { background: "#F5F3FF", border: "2px solid #C4B5FD", borderRadius: "12px", padding: "16px", marginBottom: "14px" } },
                React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "#4C1D95", letterSpacing: "0.08em", marginBottom: "8px" } }, "📅 APPOINTMENT CHECK-IN"),
                React.createElement("div", { style: { fontSize: "13px", color: "#4C1D95", lineHeight: "1.6", marginBottom: "12px" } },
                  "Did " + (open.name || "").split(" ")[0] + " show for their appointment on " + fmt(open.nextCallback) + "? Confirm before logging."
                ),
                confirmReschedule
                  ? React.createElement("div", null,
                      React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--t3)", letterSpacing: "1.2px", marginBottom: "8px" } }, "SET NEW DATE & TIME"),
                      React.createElement("div", { style: { display: "flex", gap: "6px", marginBottom: "10px" } },
                        React.createElement("label", { htmlFor: "gate-cb-date", className: "sr-only" }, "New appointment date"),
                        React.createElement("input", { id: "gate-cb-date", type: "date", value: confirmCbDate, onChange: e => setConfirmCbDate(e.target.value), style: { ...inp(), flex: 1, fontSize: "12px", padding: "7px 8px" } }),
                        React.createElement("label", { htmlFor: "gate-cb-time", className: "sr-only" }, "New appointment time"),
                        React.createElement("input", { id: "gate-cb-time", type: "time", value: confirmCbTime, onChange: e => setConfirmCbTime(e.target.value), style: { ...inp(), width: "90px", fontSize: "12px", padding: "7px 8px" } })
                      ),
                      React.createElement("div", { style: { display: "flex", gap: "6px" } },
                        React.createElement("button", {
                          onClick: () => setConfirmReschedule(false),
                          onKeyDown: e => { if (e.key === "Escape") setConfirmReschedule(false); },
                          style: { flex: 1, minHeight: "40px", background: "var(--surface-2)", color: "var(--t2)", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }
                        }, "← Back"),
                        React.createElement("button", {
                          onClick: () => {
                            if (!confirmCbDate) return;
                            const newDT = confirmCbTime ? (confirmCbDate + "T" + confirmCbTime) : confirmCbDate;
                            upd(open.id, { nextCallback: newDT, apptConfirmed: false, notes: [{ ts: new Date().toISOString(), type: "appointment", text: "🔄 Rescheduled — new appointment: " + fmt(newDT) }, ...(open.notes || [])] });
                            setConfirmReschedule(false); setConfirmCbDate(""); setConfirmCbTime("");
                          },
                          style: { flex: 2, minHeight: "40px", background: "var(--sky)", color: "#fff", border: "none", borderRadius: "7px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }
                        }, "✓ Confirm Reschedule")
                      )
                    )
                  : React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } },
                      React.createElement("button", {
                        onClick: () => { upd(open.id, { apptConfirmed: true, notes: [{ ts: new Date().toISOString(), type: "appointment", text: "✅ Showed for appointment — " + fmt(open.nextCallback) }, ...(open.notes || [])] }); logActivity("appointment", open.id, "auto"); },
                        style: { minHeight: "48px", padding: "12px", background: "#ECFDF5", color: "#065F46", border: "2px solid #6EE7B7", borderRadius: "8px", fontSize: "13px", fontWeight: "800", cursor: "pointer", textAlign: "left" }
                      }, "✅  Showed — They Made It"),
                      React.createElement("button", {
                        onClick: () => { upd(open.id, { disposition: "no_show", stage: "contacted", nextCallback: null, apptConfirmed: true, notes: [{ ts: new Date().toISOString(), type: "call", text: "❌ No-show — appointment was " + fmt(open.nextCallback) }, ...(open.notes || [])] }); },
                        style: { minHeight: "48px", padding: "12px", background: "#FEF3C7", color: "#92400E", border: "2px solid #FCD34D", borderRadius: "8px", fontSize: "13px", fontWeight: "800", cursor: "pointer", textAlign: "left" }
                      }, "❌  No-Show — They Ghosted"),
                      React.createElement("button", {
                        onClick: () => { setConfirmReschedule(true); setConfirmCbDate(""); setConfirmCbTime(""); },
                        style: { minHeight: "48px", padding: "12px", background: "var(--blue-dim)", color: "#1D4ED8", border: "2px solid var(--blue-mid)", borderRadius: "8px", fontSize: "13px", fontWeight: "800", cursor: "pointer", textAlign: "left" }
                      }, "🔄  Rescheduled — Set New Time")
                    )
              )
            : React.createElement(React.Fragment, null,

                // Calendly CTA
                // ── Appointment booking row: Calendly + Manual ───────────────
                React.createElement("div", { style: { marginBottom: "10px", position: "relative" } },
                  // Manual appt popover
                  manualApptOpen && React.createElement("div", {
                    style: {
                      position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, zIndex: 200,
                      background: "var(--surface)", border: "2px solid #8B5CF6", borderRadius: "12px",
                      padding: "14px", boxShadow: "0 -6px 24px rgba(0,0,0,0.18)"
                    }
                  },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } },
                      React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "#6D28D9", letterSpacing: "0.08em" } }, "📋 MANUAL APPOINTMENT"),
                      React.createElement("button", {
                        onClick: () => { setManualApptOpen(false); setManualApptTs(''); },
                        style: { background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "var(--t3)", padding: "0 2px", lineHeight: 1, fontWeight: "700" }
                      }, "✕")
                    ),
                    React.createElement("div", { style: { fontSize: "11px", color: "var(--t3)", marginBottom: "8px" } }, "Book directly — bypasses Calendly buffer"),
                    React.createElement("input", {
                      type: "datetime-local",
                      value: manualApptTs,
                      onChange: e => setManualApptTs(e.target.value),
                      style: { width: "100%", fontSize: "12px", padding: "8px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--t1)", fontFamily: "inherit", boxSizing: "border-box", marginBottom: "8px" }
                    }),
                    React.createElement("button", {
                      onClick: () => {
                        if (!manualApptTs || !open) return;
                        const ts = new Date(manualApptTs).toISOString();
                        const label = new Date(manualApptTs).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                        upd(open.id, {
                          disposition: 'appointment_booked',
                          stage: 'appointment_set',
                          nextCallback: ts,
                          apptConfirmed: false,
                          notes: [{ ts: new Date().toISOString(), type: 'appointment', text: '📋 Manual Appt Booked — ' + label }, ...(open.notes || [])]
                        });
                        // Open Google Calendar pre-fill
                        const toGCalTs = ms => new Date(ms).toISOString().replace(/[-:.]/g,'').slice(0,15)+'Z';
                        const startMs = new Date(manualApptTs).getTime();
                        const endMs   = startMs + 30 * 60000;
                        const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('🛡 Protection Audit — ' + (open.name || 'Household'))}&dates=${toGCalTs(startMs)}/${toGCalTs(endMs)}&details=${encodeURIComponent('Ministry of Protection — Household Protection Audit\n\nLead: ' + (open.name || '') + '\nPhone: ' + (open.phone || '') + '\n\nLogged via Metka Field Ops CRM')}`;
                        window.open(gcalUrl, '_blank');
                        setManualApptOpen(false);
                        setManualApptTs('');
                      },
                      disabled: !manualApptTs,
                      style: {
                        width: "100%", minHeight: "40px", borderRadius: "8px", border: "none",
                        background: manualApptTs ? "#7C3AED" : "var(--border)",
                        color: manualApptTs ? "#fff" : "var(--t3)",
                        fontSize: "12px", fontWeight: "800", letterSpacing: "0.5px",
                        cursor: manualApptTs ? "pointer" : "default"
                      }
                    }, "✓ BOOK & ADD TO GOOGLE CALENDAR")
                  ),
                  // Button row
                  React.createElement("div", { style: { display: "flex", gap: "6px" } },
                    React.createElement("button", {
                      onClick: () => openCalendlyPopup(open, calendlyUrl, setCalendlyTargetId),
                      style: {
                        flex: 1, minHeight: "44px", padding: "10px 8px",
                        background: open.disposition === "appointment_booked" ? "#8B5CF6" : "transparent",
                        color: open.disposition === "appointment_booked" ? "#fff" : "#8B5CF6",
                        border: "1.5px solid " + (open.disposition === "appointment_booked" ? "#8B5CF6" : "#C4B5FD"),
                        borderRadius: "8px", fontSize: "12px", fontWeight: "800", cursor: "pointer", textAlign: "center"
                      }
                    }, open.disposition === "appointment_booked" ? "📅 BOOKED · " + fmt(open.nextCallback) : "📅 CALENDLY"),
                    React.createElement("button", {
                      onClick: () => { setManualApptOpen(v => !v); setCbPopoverOpen(false); },
                      title: "Book appointment manually (bypasses Calendly buffer)",
                      style: {
                        flexShrink: 0, minHeight: "44px", padding: "10px 12px",
                        background: manualApptOpen ? "#7C3AED" : "transparent",
                        color: manualApptOpen ? "#fff" : "#7C3AED",
                        border: "1.5px solid " + (manualApptOpen ? "#7C3AED" : "#C4B5FD"),
                        borderRadius: "8px", fontSize: "12px", fontWeight: "800", cursor: "pointer", whiteSpace: "nowrap"
                      }
                    }, "📋 MANUAL")
                  )
                ),

                // Ghost Protocol
                React.createElement("button", {
                  onClick: () => {
                    const first = (open.name || "").split(" ")[0];
                    const msg = "Hi " + first + " — I'm wrapping up regional files for your area and wanted to check in before I close the household file. Would this week work for a quick 20-minute protection review, or should I go ahead and archive your file?";
                    try { navigator.clipboard.writeText(msg); } catch (err) { const ta = document.createElement("textarea"); ta.value = msg; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
                    alert("👻 Ghost Protocol copied!");
                  },
                  style: { display: "block", width: "100%", minHeight: "36px", padding: "7px 12px", marginBottom: "10px", background: "#FFFBEB", color: "#92400E", border: "1px solid #FCD34D", borderRadius: "7px", fontSize: "11px", fontWeight: "700", cursor: "pointer", textAlign: "left" }
                }, "👻 GHOST PROTOCOL — Copy to clipboard"),

                // Quick Capture
                React.createElement("div", { style: { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", marginBottom: "10px" } },
                  React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--t3)", letterSpacing: "0.08em", marginBottom: "10px" } }, "🩺 QUICK CAPTURE"),
                  React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", marginBottom: "8px" } },
                    [["Age", "age", "54"], ["Height", "height", "5'10\""], ["Weight", "weight", "180"], ["DOB", "dob", "1970-01-01"]].map(([lbl, field, ph]) =>
                      React.createElement("div", { key: field },
                        React.createElement("label", { htmlFor: "qc-" + field + "-" + open.id, style: { fontSize: "11px", fontWeight: "800", color: "var(--t3)", letterSpacing: "0.5px", display: "block", marginBottom: "3px" } }, lbl.toUpperCase()),
                        React.createElement("input", {
                          id: "qc-" + field + "-" + open.id, key: field + "-dial-" + open.id, placeholder: ph, defaultValue: open[field] || "",
                          onBlur: e => { const v = e.target.value.trim(); if (v !== (open[field] || "")) upd(open.id, { [field]: v }); },
                          style: { ...inp(), width: "100%", fontSize: "12px", boxSizing: "border-box", padding: "6px 8px" }
                        })
                      )
                    )
                  ),
                  React.createElement("div", {
                    style: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "4px", background: open.tobacco ? "#FEF3C7" : "var(--surface)", border: "1px solid " + (open.tobacco ? "#FCD34D" : "var(--border)"), cursor: "pointer", marginBottom: "8px" },
                    onClick: () => upd(open.id, { tobacco: !open.tobacco })
                  },
                    React.createElement("input", { type: "checkbox", id: "qc-tobacco-" + open.id, checked: !!open.tobacco, onChange: () => upd(open.id, { tobacco: !open.tobacco }), style: { width: "14px", height: "14px", cursor: "pointer", accentColor: "#D97706" } }),
                    React.createElement("label", { htmlFor: "qc-tobacco-" + open.id, style: { fontSize: "11px", fontWeight: "700", color: open.tobacco ? "#D97706" : "var(--t2)", cursor: "pointer" } }, "🚬 Tobacco User"),
                    open.tobacco && React.createElement("span", { style: { fontSize: "11px", fontWeight: "800", color: "#D97706", marginLeft: "auto" } }, "TABLE RATING")
                  ),
                  React.createElement("label", { htmlFor: "qc-meds-" + open.id, style: { fontSize: "11px", fontWeight: "800", color: "var(--t3)", letterSpacing: "0.5px", display: "block", marginBottom: "3px" } }, "MEDICATIONS / CONDITIONS"),
                  React.createElement("textarea", {
                    id: "qc-meds-" + open.id, key: "meds-dial-" + open.id, placeholder: "Meds, conditions...", defaultValue: open.medications || "",
                    onBlur: e => { const v = e.target.value.trim(); if (v !== (open.medications || "")) upd(open.id, { medications: v }); },
                    style: { ...inp(), width: "100%", fontSize: "12px", resize: "none", minHeight: "44px", lineHeight: "1.4", boxSizing: "border-box", padding: "6px 8px" }
                  }),
                  React.createElement("div", { style: { marginTop: "8px", padding: "8px 10px", background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: "4px", fontSize: "11px", color: "#065F46", fontWeight: "600" } },
                    "💚 Living Benefits — money that pays while ALIVE. Always lead with this."
                  )
                ),

              ),

          // Recent notes — always visible below actions
          (open.notes || []).length > 0 && React.createElement("div", { style: { marginTop: "12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" } },
            React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--t3)", letterSpacing: "0.08em", marginBottom: "8px" } }, "RECENT — " + (open.notes || []).length + " ENTRIES"),
            (open.notes || []).slice(0, 4).map((n, i) =>
              React.createElement("div", { key: n.ts || n.id || i, style: { marginBottom: "8px", padding: "8px 10px", background: "var(--surface)", borderRadius: "7px", border: "1px solid var(--border)" } },
                React.createElement("div", { style: { fontSize: "11px", color: NC[n.type] || "var(--t3)", fontWeight: "800", marginBottom: "3px" } },
                  n.type === "call" ? "📞 Call" : n.type === "appointment" ? "📅 Appt" : "📝 Note", " · " + fmt(n.ts)
                ),
                React.createElement("div", { style: { fontSize: "12px", color: "var(--t2)", lineHeight: "1.4" } }, n.text)
              )
            )
          )
        ),

        // Pinned disposition bar
        (() => {
          const gateActive = open.disposition === "appointment_booked" && open.nextCallback && new Date(open.nextCallback) < new Date() && !open.apptConfirmed;
          // Primary (most-used daily) — large, prominent
          const primaryDisps = [
            { id: "no_answer",  icon: "📵", label: "No Answer" },
            { id: "vm_left",    icon: "📬", label: "VM Left"   },
            { id: "callback",   icon: "📅", label: "Callback"  },
            { id: "follow_up",  icon: "🔄", label: "Follow Up" },
          ];
          // Secondary (less frequent) — smaller, muted
          const secondaryDisps = [
            { id: "not_interested", icon: "🚫", label: "Not Int." },
            { id: "hung_up",        icon: "📴", label: "Hung Up"  },
            { id: "dnc",            icon: "⛔", label: "DNC"      },
          ];
          // Callback preset compute helper
          const presetToDate = (p) => {
            if (p.minOffset != null) return new Date(Date.now() + p.minOffset * 60000);
            const d = new Date();
            d.setDate(d.getDate() + (p.daysAhead || 0));
            d.setHours(p.hour || 9, 0, 0, 0);
            return d;
          };
          const presets = callbackPresets || [
            { id: "2h",     label: "2 Hours",     minOffset: 120, daysAhead: 0, hour: null },
            { id: "tom_am", label: "Tomorrow AM", minOffset: null, daysAhead: 1, hour: 9  },
            { id: "tom_pm", label: "Tomorrow PM", minOffset: null, daysAhead: 1, hour: 14 },
            { id: "week",   label: "Next Week",   minOffset: null, daysAhead: 7, hour: 9  },
          ];
          const handleCbPreset = (p) => {
            if (!open) return;
            const ts = presetToDate(p).toISOString();
            upd(open.id, {
              nextCallback: ts,
              notes: [{ ts: new Date().toISOString(), type: 'note', text: '📅 Callback scheduled: ' + p.label }, ...(open.notes || [])]
            });
            fireDisp('callback');
            setCbPopoverOpen(false);
          };
          const handleCbCustom = () => {
            if (!cbCustomTs || !open) return;
            const ts = new Date(cbCustomTs).toISOString();
            const label = new Date(cbCustomTs).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            upd(open.id, {
              nextCallback: ts,
              notes: [{ ts: new Date().toISOString(), type: 'note', text: '📅 Callback scheduled: ' + label }, ...(open.notes || [])]
            });
            fireDisp('callback');
            setCbPopoverOpen(false);
            setCbCustomTs('');
          };

          return React.createElement("div", {
            style: { flexShrink: 0, padding: "8px 12px", borderTop: "2px solid var(--border)", background: "var(--surface)", display: "flex", gap: "5px", overflow: "visible", position: "relative" }
          },
            // ── Callback scheduler popover ──
            cbPopoverOpen && React.createElement("div", {
              style: {
                position: "absolute", bottom: "calc(100% + 4px)", left: "8px", right: "8px", zIndex: 300,
                background: "var(--surface)", border: "2px solid var(--navy)", borderRadius: "12px",
                padding: "14px", boxShadow: "0 -6px 24px rgba(0,0,0,0.18)"
              }
            },
              React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } },
                React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--navy)", letterSpacing: "0.08em" } }, "⏰ SCHEDULE CALLBACK"),
                React.createElement("button", {
                  onClick: () => setCbPopoverOpen(false),
                  style: { background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "var(--t3)", padding: "0 2px", lineHeight: 1, fontWeight: "700" }
                }, "✕")
              ),
              React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "10px" } },
                presets.map(p =>
                  React.createElement("button", {
                    key: p.id,
                    onClick: () => handleCbPreset(p),
                    style: {
                      padding: "11px 8px", borderRadius: "8px", border: "1px solid var(--border)",
                      background: "var(--surface-2)", color: "var(--t1)", cursor: "pointer",
                      fontSize: "11px", fontWeight: "700", textAlign: "center", letterSpacing: "0.3px",
                      transition: "all 0.1s"
                    }
                  }, p.label)
                )
              ),
              React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center" } },
                React.createElement("input", {
                  type: "datetime-local",
                  value: cbCustomTs,
                  onChange: e => setCbCustomTs(e.target.value),
                  style: { flex: 1, fontSize: "11px", padding: "7px 8px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--t2)", fontFamily: "inherit" }
                }),
                React.createElement("button", {
                  onClick: handleCbCustom,
                  disabled: !cbCustomTs,
                  style: {
                    padding: "7px 14px", borderRadius: "7px",
                    background: cbCustomTs ? "var(--navy)" : "var(--border)",
                    color: cbCustomTs ? "#fff" : "var(--t3)", border: "none",
                    cursor: cbCustomTs ? "pointer" : "default",
                    fontSize: "11px", fontWeight: "800", letterSpacing: "0.5px", whiteSpace: "nowrap"
                  }
                }, "SET")
              )
            ),

            gateActive
              ? React.createElement("div", { style: { width: "100%", textAlign: "center", fontSize: "11px", color: "var(--amber)", fontWeight: "600", padding: "8px 0" } }, "⚠ Complete appointment check-in above before logging a result")
              : React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "5px", width: "100%" } },
                  // ── Primary row ─────────────────────────────────────────
                  React.createElement("div", { style: { display: "flex", gap: "5px" } },
                    primaryDisps.map(d => {
                      const isCb = d.id === 'callback';
                      const isActive = isCb ? (cbPopoverOpen || open.disposition === d.id) : open.disposition === d.id;
                      return React.createElement("button", {
                        key: d.id,
                        onClick: () => isCb ? setCbPopoverOpen(v => !v) : fireDisp(d.id),
                        "aria-label": "Log: " + d.label,
                        "aria-pressed": isActive,
                        style: {
                          minHeight: "52px", flex: "1 1 0", padding: "6px 4px",
                          background: isActive ? "var(--blue)" : "var(--surface-2)",
                          color: isActive ? "#fff" : "var(--t1)",
                          border: "1.5px solid " + (isActive ? "var(--blue)" : "var(--border)"),
                          borderRadius: "8px", fontSize: "11px", fontWeight: isActive ? "700" : "500",
                          cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
                          justifyContent: "center", gap: "4px", transition: "all 0.1s ease",
                          boxShadow: isActive ? "0 0 0 2px rgba(37,99,235,0.2)" : "none",
                        }
                      },
                        React.createElement("span", { "aria-hidden": "true", style: { fontSize: "16px", lineHeight: 1 } }, d.icon),
                        React.createElement("span", { style: { fontSize: "11px", fontWeight: "600", lineHeight: 1.2, textAlign: "center" } }, d.label)
                      );
                    })
                  ),
                  // ── Secondary row ───────────────────────────────────────
                  React.createElement("div", { style: { display: "flex", gap: "5px" } },
                    secondaryDisps.map(d => {
                      const isActive = open.disposition === d.id;
                      return React.createElement("button", {
                        key: d.id,
                        onClick: () => fireDisp(d.id),
                        "aria-label": "Log: " + d.label,
                        "aria-pressed": isActive,
                        style: {
                          minHeight: "36px", flex: "1 1 0", padding: "4px 4px",
                          background: isActive ? "var(--navy)" : "transparent",
                          color: isActive ? "#fff" : "var(--t3)",
                          border: "1px solid " + (isActive ? "var(--navy)" : "var(--border)"),
                          borderRadius: "8px", fontSize: "11px", fontWeight: isActive ? "600" : "400",
                          cursor: "pointer", display: "flex", flexDirection: "row", alignItems: "center",
                          justifyContent: "center", gap: "5px", transition: "all 0.1s ease",
                        }
                      },
                        React.createElement("span", { "aria-hidden": "true", style: { fontSize: "12px", lineHeight: 1 } }, d.icon),
                        React.createElement("span", { style: { fontSize: "11px", lineHeight: 1.2 } }, d.label)
                      );
                    })
                  )
                )
          );
        })()

      ) : React.createElement("div", { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center" } },
          React.createElement("div", { style: { textAlign: "center", color: "var(--t4)" } },
            React.createElement("div", { style: { fontSize: "36px", marginBottom: "12px" } }, "🎙"),
            React.createElement("div", { style: { fontSize: "14px", fontWeight: "600", marginBottom: "6px" } }, "Select a lead to begin"),
            React.createElement("div", { style: { fontSize: "12px" } }, queue.length + " leads in queue")
          )
        )
    ),

    // ── RIGHT: Tab rail (300px) ──
    React.createElement("div", { style: { width: "300px", flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--surface-2)", borderLeft: "1px solid var(--border)", overflow: "hidden" } },

      // Tab bar (ARIA tablist)
      React.createElement("div", {
        role: "tablist",
        "aria-label": "Lead tools",
        style: { display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }
      },
        [["script", "\ud83d\udcde", "Script"], ["notes", "\ud83d\udcdd", "Notes"], ["sms", "\ud83d\udcac", "SMS"], ["activity", "\ud83d\udccb", "Activity"], ["quals", "\u2705", "Q's"]].map(([tab, icon, lbl]) =>
          React.createElement("button", {
            key: tab,
            role: "tab",
            "aria-selected": dialRightTab === tab,
            "aria-controls": "dial-panel-" + tab,
            id: "dial-tab-" + tab,
            onClick: () => setDialRightTab(tab),
            style: {
              flex: 1, minHeight: "44px", padding: "8px 4px",
              background: dialRightTab === tab ? "var(--navy)" : "transparent",
              color: dialRightTab === tab ? "#fff" : "var(--t3)",
              border: "none",
              borderBottom: dialRightTab === tab ? "2px solid var(--blue)" : "2px solid transparent",
              cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
              gap: "2px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.5px", transition: "all 0.1s"
            }
          },
            React.createElement("span", { "aria-hidden": "true", style: { fontSize: "14px" } }, icon),
            React.createElement("span", null, lbl)
          )
        )
      ),

      // Tab panels
      React.createElement("div", { style: { flex: 1, overflowY: "auto" } },

        // SCRIPT tab
        dialRightTab === "script" && React.createElement("div", {
          id: "dial-panel-script", role: "tabpanel", "aria-labelledby": "dial-tab-script", style: { padding: "12px" }
        },
          React.createElement("div", { style: { marginBottom: "8px" } },
            React.createElement("label", { htmlFor: "dial-script-type", className: "sr-only" }, "Script type"),
            React.createElement("select", {
              id: "dial-script-type",
              value: (open && open.leadType && scripts[open.leadType]) ? open.leadType : scriptType,
              onChange: e => { setScriptType(e.target.value); setScriptSection(Object.keys(scripts[e.target.value] || {})[0] || "phone"); },
              style: { ...inp(), fontSize: "11px", fontWeight: "700", padding: "5px 8px", width: "100%", marginBottom: "6px" }
            }, Object.keys(scripts).map(t => React.createElement("option", { key: t, value: t }, t))),
            React.createElement("div", { style: { display: "flex", gap: "3px", flexWrap: "wrap" } },
              Object.keys(scripts[(open && open.leadType && scripts[open.leadType]) ? open.leadType : scriptType] || {}).map(s =>
                React.createElement("button", {
                  key: s, onClick: () => setScriptSection(s),
                  style: { ...chip(scriptSection === s, "#2563EB"), fontSize: "11px", padding: "4px 8px", textTransform: "capitalize", margin: 0 }
                }, s)
              )
            )
          ),
          React.createElement("div", { style: { fontFamily: "'Inter',system-ui,sans-serif", fontSize: "12px", color: "#334155", lineHeight: "2.0", whiteSpace: "pre-wrap", background: "var(--surface)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border)" } },
            ...(open
              ? renderLiveTokens((scripts[(open.leadType && scripts[open.leadType]) ? open.leadType : scriptType] || {})[scriptSection] || "Select a section above.", open, upd)
              : ["Select a lead to load script."]
            )
          ),
          open && React.createElement("div", { style: { fontSize: "11px", color: "var(--t3)", textAlign: "center", marginTop: "6px", fontWeight: "500" } }, "🟡 Yellow = missing · 🟢 Green = on file")
        ),

        // NOTES tab
        dialRightTab === "notes" && React.createElement("div", {
          id: "dial-panel-notes", role: "tabpanel", "aria-labelledby": "dial-tab-notes", style: { padding: "12px" }
        },
          React.createElement("div", { style: { display: "flex", gap: "8px", marginBottom: "12px" } },
            React.createElement("label", { htmlFor: "dial-note-text", className: "sr-only" }, "Add note"),
            React.createElement("textarea", {
              id: "dial-note-text", value: noteText, onChange: e => setNoteText(e.target.value),
              placeholder: "What happened, next step...",
              style: { flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--t1)", padding: "8px 10px", fontSize: "12px", fontFamily: "'Inter',sans-serif", resize: "none", minHeight: "60px", lineHeight: "1.5" }
            }),
            React.createElement("button", { onClick: () => { if (open) addNote(open.id); }, "aria-label": "Save note", style: { padding: "0 12px", background: "var(--blue)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "18px", cursor: "pointer", alignSelf: "stretch" } }, "→")
          ),
          open && (open.notes || []).length > 0
            ? React.createElement("div", null,
                React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--t3)", letterSpacing: "0.08em", marginBottom: "8px" } }, "HISTORY — " + (open.notes || []).length + " ENTRIES"),
                (open.notes || []).map((n, i) =>
                  React.createElement("div", { key: n.ts || n.id || i, style: { marginBottom: "8px", padding: "8px 10px", background: "var(--surface)", borderRadius: "7px", border: "1px solid var(--border)" } },
                    React.createElement("div", { style: { fontSize: "11px", color: NC[n.type] || "var(--t3)", fontWeight: "800", marginBottom: "3px" } },
                      n.type === "call" ? "📞 Call" : n.type === "appointment" ? "📅 Appt" : "📝 Note", " \u00b7 " + fmt(n.ts)
                    ),
                    React.createElement("div", { style: { fontSize: "12px", color: "var(--t2)", lineHeight: "1.4" } }, n.text)
                  )
                )
              )
            : React.createElement("div", { style: { textAlign: "center", padding: "32px 0", color: "var(--t4)", fontSize: "12px" } }, "No notes yet.")
        ),

        // SMS tab
        dialRightTab === "sms" && React.createElement("div", {
          id: "dial-panel-sms", role: "tabpanel", "aria-labelledby": "dial-tab-sms", style: { padding: "12px" }
        },
          React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--t3)", letterSpacing: "0.08em", marginBottom: "10px" } }, "SMS TEMPLATES"),
          open && Object.entries(templates || {}).length > 0
            ? Object.entries(templates || {}).map(([key, tpl]) =>
                React.createElement("div", { key: key, style: { marginBottom: "8px", padding: "10px 12px", background: "var(--surface)", borderRadius: "8px", border: "1px solid var(--border)" } },
                  React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" } },
                    React.createElement("span", { style: { fontSize: "11px", fontWeight: "700", color: "var(--t1)", flex: 1 } }, tpl.name || key),
                    React.createElement("button", {
                      onClick: () => {
                        const first = (open.name || "").split(" ")[0];
                        const body = tpl.text || "";
                        const msg = body.replace(/\{name\}/gi, first).replace(/\{firstname\}/gi, first);
                        try { navigator.clipboard.writeText(msg); } catch (err) { const ta = document.createElement("textarea"); ta.value = msg; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
                        alert("\ud83d\udcf1 SMS copied \u2014 open your texting app and paste.");
                      },
                      style: { fontSize: "11px", padding: "3px 8px", borderRadius: "4px", background: "var(--blue)", color: "#fff", border: "none", cursor: "pointer", fontWeight: "800", letterSpacing: "0.5px" }
                    }, "COPY")
                  ),
                  React.createElement("div", { style: { fontSize: "11px", color: "var(--t2)", lineHeight: "1.5", whiteSpace: "pre-wrap", fontFamily: "\'JetBrains Mono\',monospace", background: "var(--surface-2)", padding: "8px", borderRadius: "4px", border: "1px solid var(--border)" } }, tpl.text || "")
                )
              )
            : React.createElement("div", { style: { textAlign: "center", padding: "32px 0", color: "var(--t4)", fontSize: "12px" } }, "No SMS templates configured.")
        ),

        // ACTIVITY tab
        dialRightTab === "activity" && React.createElement("div", {
          id: "dial-panel-activity", role: "tabpanel", "aria-labelledby": "dial-tab-activity", style: { padding: "12px" }
        },
          React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--t3)", letterSpacing: "0.08em", marginBottom: "10px" } }, "ACTIVITY LOG"),
          open && (open.notes || []).length > 0
            ? React.createElement("div", null,
                (open.notes || []).slice().reverse().map((n, i) =>
                  React.createElement("div", { key: n.ts || n.id || i, style: { marginBottom: "8px", padding: "8px 10px", background: "var(--surface)", borderRadius: "7px", border: "1px solid var(--border)", display: "flex", gap: "8px", alignItems: "flex-start" } },
                    React.createElement("span", { "aria-hidden": "true", style: { fontSize: "14px", lineHeight: 1, flexShrink: 0, marginTop: "1px" } },
                      n.type === "call" ? "\ud83d\udcde" : n.type === "appointment" ? "\ud83d\udcc5" : "\ud83d\udcdd"
                    ),
                    React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                      React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--t3)", marginBottom: "2px" } }, fmt(n.ts)),
                      React.createElement("div", { style: { fontSize: "11px", color: "var(--t2)", lineHeight: "1.4", wordBreak: "break-word" } }, n.text)
                    )
                  )
                )
              )
            : React.createElement("div", { style: { textAlign: "center", padding: "32px 0", color: "var(--t4)", fontSize: "12px" } },
                open ? "No activity logged yet." : "Select a lead to view activity."
              )
        ),

        // Q's tab — Qualification checklist
        dialRightTab === "quals" && React.createElement("div", {
          id: "dial-panel-quals", role: "tabpanel", "aria-labelledby": "dial-tab-quals", style: { padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }
        },
          React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--t3)", letterSpacing: "0.08em", marginBottom: "4px" } }, "📋 CLIENT QUALIFICATION FORM"),
          // 1. FINANCIAL & LIFESTYLE
          React.createElement("div", { style: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" } },
            React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--t3)", letterSpacing: "0.08em", marginBottom: "10px" } }, "💼 FINANCIAL & LIFESTYLE"),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" } },
              React.createElement("div", null,
                React.createElement("label", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", display: "block", marginBottom: "3px" } }, "OCCUPATION / RETIRED"),
                React.createElement("input", {
                  type: "text", placeholder: "e.g., Retired (2018)", defaultValue: open ? (open.occupation || "") : "",
                  onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open.occupation || "")) upd(open.id, { occupation: v }); } },
                  style: { ...inp(), width: "100%", fontSize: "11px", padding: "6px 8px", boxSizing: "border-box" }
                })
              ),
              React.createElement("div", null,
                React.createElement("label", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", display: "block", marginBottom: "3px" } }, "EST. ANNUAL INCOME"),
                React.createElement("input", {
                  type: "text", placeholder: "$50,000", defaultValue: open ? (open.annualIncome || "") : "",
                  onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open.annualIncome || "")) upd(open.id, { annualIncome: v }); } },
                  style: { ...inp(), width: "100%", fontSize: "11px", padding: "6px 8px", boxSizing: "border-box" }
                })
              ),
              React.createElement("div", null,
                React.createElement("label", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", display: "block", marginBottom: "3px" } }, "MORTGAGE BALANCE"),
                React.createElement("input", {
                  type: "text", placeholder: "$250,000", defaultValue: open ? (open.mortgageBalance || "") : "",
                  onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open.mortgageBalance || "")) upd(open.id, { mortgageBalance: v }); } },
                  style: { ...inp(), width: "100%", fontSize: "11px", padding: "6px 8px", boxSizing: "border-box" }
                })
              ),
              React.createElement("div", null,
                React.createElement("label", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", display: "block", marginBottom: "3px" } }, "MONTHLY PAYMENT"),
                React.createElement("input", {
                  type: "text", placeholder: "$1,500", defaultValue: open ? (open.mortgagePayment || "") : "",
                  onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open.mortgagePayment || "")) upd(open.id, { mortgagePayment: v }); } },
                  style: { ...inp(), width: "100%", fontSize: "11px", padding: "6px 8px", boxSizing: "border-box" }
                })
              ),
              React.createElement("div", null,
                React.createElement("label", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", display: "block", marginBottom: "3px" } }, "TERM LEFT"),
                React.createElement("input", {
                  type: "text", placeholder: "20 yrs", defaultValue: open ? (open.mortgageTerm || "") : "",
                  onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open.mortgageTerm || "")) upd(open.id, { mortgageTerm: v }); } },
                  style: { ...inp(), width: "100%", fontSize: "11px", padding: "6px 8px", boxSizing: "border-box" }
                })
              ),
              React.createElement("div", null,
                React.createElement("label", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", display: "block", marginBottom: "3px" } }, "PRIMARY BENEFICIARY"),
                React.createElement("input", {
                  type: "text", placeholder: "Name & Relationship", defaultValue: open ? (open.beneficiary || "") : "",
                  onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open.beneficiary || "")) upd(open.id, { beneficiary: v }); } },
                  style: { ...inp(), width: "100%", fontSize: "11px", padding: "6px 8px", boxSizing: "border-box" }
                })
              )
            ),
            React.createElement("div", { style: { marginBottom: "8px" } },
              React.createElement("label", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", display: "block", marginBottom: "3px" } }, "EXISTING LIFE INSURANCE"),
              React.createElement("textarea", {
                placeholder: "Company, Type, Death Benefit...", defaultValue: open ? (open.existingInsurance || "") : "",
                onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open.existingInsurance || "")) upd(open.id, { existingInsurance: v }); } },
                style: { ...inp(), width: "100%", minHeight: "36px", fontSize: "11px", padding: "6px 8px", boxSizing: "border-box", resize: "vertical" }
              })
            ),
            React.createElement("div", null,
              React.createElement("label", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", display: "block", marginBottom: "3px" } }, "FINANCIAL CONCERNS / GOALS"),
              React.createElement("textarea", {
                placeholder: "What do they want to address with this coverage?", defaultValue: open ? (open.financialGoals || "") : "",
                onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open.financialGoals || "")) upd(open.id, { financialGoals: v }); } },
                style: { ...inp(), width: "100%", minHeight: "36px", fontSize: "11px", padding: "6px 8px", boxSizing: "border-box", resize: "vertical" }
              })
            )
          ),
          // 2. HEALTH CONDITIONS
          React.createElement("div", { style: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" } },
            React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--t3)", letterSpacing: "0.08em", marginBottom: "10px" } }, "❤️ HEALTH CONDITIONS"),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "10px" } },
              ...[
                { id: "heart",         label: "Heart Disease/Attack" },
                { id: "cancer",        label: "Cancer or Tumors" },
                { id: "stroke",        label: "Stroke or TIA" },
                { id: "diabetes",      label: "Diabetes" },
                { id: "lung",          label: "Lung Disease/COPD" },
                { id: "kidney_liver",  label: "Kidney/Liver Disease" },
                { id: "mental",        label: "Mental Health (Dep/Anx)" },
                { id: "neuro",         label: "Neurological (MS/Park)" },
              ].map(flag =>
                React.createElement("label", { key: flag.id, style: { display: "flex", alignItems: "flex-start", gap: "6px", cursor: "pointer", padding: "5px 7px", borderRadius: "5px", background: (open && Array.isArray(open.healthFlags) && open.healthFlags.includes(flag.id)) ? "rgba(239,68,68,0.12)" : "transparent", border: "1px solid " + ((open && Array.isArray(open.healthFlags) && open.healthFlags.includes(flag.id)) ? "var(--red)" : "var(--border)") } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: !!(open && Array.isArray(open.healthFlags) && open.healthFlags.includes(flag.id)),
                    onChange: e => {
                      if (!open) return;
                      const cur = Array.isArray(open.healthFlags) ? [...open.healthFlags] : [];
                      const next = e.target.checked ? [...new Set([...cur, flag.id])] : cur.filter(f => f !== flag.id);
                      upd(open.id, { healthFlags: next });
                    },
                    style: { accentColor: "var(--red)", cursor: "pointer", marginTop: "2px" }
                  }),
                  React.createElement("span", {
                    style: {
                      fontSize: "10px", lineHeight: "1.3",
                      color: (open && Array.isArray(open.healthFlags) && open.healthFlags.includes(flag.id)) ? "var(--red)" : "var(--t2)",
                      fontWeight: (open && Array.isArray(open.healthFlags) && open.healthFlags.includes(flag.id)) ? "800" : "600"
                    }
                  }, flag.label)
                )
              )
            ),
            React.createElement("div", { style: { marginBottom: "8px" } },
              React.createElement("label", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", display: "block", marginBottom: "3px" } }, "PRESCRIPTION MEDICATIONS"),
              React.createElement("textarea", {
                placeholder: "Names, dosages, frequencies, reasons...", defaultValue: open ? (open.medicationsDetail || "") : "",
                onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open.medicationsDetail || "")) upd(open.id, { medicationsDetail: v }); } },
                style: { ...inp(), width: "100%", minHeight: "45px", fontSize: "11px", padding: "6px 8px", boxSizing: "border-box", resize: "vertical" }
              })
            ),
            React.createElement("div", null,
              React.createElement("label", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", display: "block", marginBottom: "3px" } }, "HOSPITALIZATIONS / SURGERIES (PAST 5 YRS)"),
              React.createElement("textarea", {
                placeholder: "Dates and reasons...", defaultValue: open ? (open.surgeries5yr || "") : "",
                onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open.surgeries5yr || "")) upd(open.id, { surgeries5yr: v }); } },
                style: { ...inp(), width: "100%", minHeight: "36px", fontSize: "11px", padding: "6px 8px", boxSizing: "border-box", resize: "vertical" }
              })
            )
          ),
          // 3. BACKGROUND & LIFESTYLE
          React.createElement("div", { style: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" } },
            React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--t3)", letterSpacing: "0.08em", marginBottom: "10px" } }, "⚠️ BACKGROUND & LIFESTYLE"),
            React.createElement("div", { style: { marginBottom: "8px" } },
              React.createElement("label", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", display: "block", marginBottom: "3px" } }, "TOBACCO / NICOTINE USE"),
              React.createElement("input", {
                type: "text", placeholder: "Type and frequency (e.g., Cigarettes, 1 pack/day)", defaultValue: open ? (open.tobaccoUseDetails || "") : "",
                onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open.tobaccoUseDetails || "")) upd(open.id, { tobaccoUseDetails: v }); } },
                style: { ...inp(), width: "100%", fontSize: "11px", padding: "6px 8px", boxSizing: "border-box" }
              })
            ),
            React.createElement("div", { style: { marginBottom: "8px" } },
              React.createElement("label", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", display: "block", marginBottom: "3px" } }, "DRUG OR ALCOHOL ABUSE HISTORY"),
              React.createElement("input", {
                type: "text", placeholder: "Treatment dates/details...", defaultValue: open ? (open.substanceAbuse || "") : "",
                onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open.substanceAbuse || "")) upd(open.id, { substanceAbuse: v }); } },
                style: { ...inp(), width: "100%", fontSize: "11px", padding: "6px 8px", boxSizing: "border-box" }
              })
            ),
            React.createElement("div", null,
              React.createElement("label", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", display: "block", marginBottom: "3px" } }, "DRIVING RECORD (Valid license? DUIs?)"),
              React.createElement("input", {
                type: "text", placeholder: "License status, DUIs, suspensions...", defaultValue: open ? (open.drivingRecord || "") : "",
                onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open.drivingRecord || "")) upd(open.id, { drivingRecord: v }); } },
                style: { ...inp(), width: "100%", fontSize: "11px", padding: "6px 8px", boxSizing: "border-box" }
              })
            )
          ),
          // Auto-qualification signal
          (() => {
            if (!open) return React.createElement("div", { style: { textAlign: "center", padding: "12px 0", color: "var(--t4)", fontSize: "12px" } }, "Select a lead to qualify.");
            const flags = Array.isArray(open.healthFlags) ? open.healthFlags : [];
            const pivot      = flags.length >= 2;
            const tableRate  = !pivot && (!!open.tobacco || flags.length === 1);
            const signal = pivot
              ? { label: "PIVOT",      color: "var(--red)",   bg: "rgba(239,68,68,0.08)",   border: "var(--red)",   action: "→ Graded / Guaranteed Issue FE", icon: "⚠️" }
              : tableRate
              ? { label: "TABLE RATE", color: "var(--amber)", bg: "rgba(245,158,11,0.08)",  border: "var(--amber)", action: "→ Run quoted products · flag rate class", icon: "⚡" }
              : { label: "CLEAN",      color: "var(--green)", bg: "rgba(16,185,129,0.08)",  border: "var(--green)", action: "→ Book Household Protection Audit", icon: "✅" };
            return React.createElement("div", {
              style: { background: signal.bg, border: `1px solid ${signal.border}`, borderRadius: "8px", padding: "14px", textAlign: "center" }
            },
              React.createElement("div", { style: { fontSize: "13px", fontWeight: "800", color: signal.color, letterSpacing: "0.08em", marginBottom: "5px" } }, signal.icon + " " + signal.label),
              React.createElement("div", { style: { fontSize: "11px", color: signal.color, fontWeight: "600" } }, signal.action)
            );
          })()
        )
      )
    )
  );
}
