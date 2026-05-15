import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BC, BL, NC, fmt, inp, chip, isUWStuck, daysInUW } from '../constants.js';
import { getPhasePriority } from './TodaysBlock';

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

export default function DialView({
  queue, session, setSession, sessionPaused, setSessionPaused, setDialSessionActive,
  dialSortMode, setDialSortMode,
  dialRightTab, setDialRightTab,
  openId, setOpenId,
  open, upd,
  dialLead, useTwilioCalling, twilioDevice,
  hangUp, callStatus,
  todayLeads,
  noteText, setNoteText,
  noteType, setNoteType,
  addNote,
  handleDisposition,
  lockCB, cbDate, setCbDate, cbTime, setCbTime,
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
}) {
  // ── POWER DIALER ENGINE (18s/30s auto-hangup) ──────────────────

  const [pdMode,         setPdMode]         = useState(false);
  const [pdIdx,          setPdIdx]          = useState(0);
  const [pdAttempt,      setPdAttempt]      = useState(1);
  const [pdCountdown,    setPdCountdown]    = useState(null);
  const [pdStatus,       setPdStatus]       = useState('idle'); // idle | dialing | answered | pausing
  const [pdLockedQueue,  setPdLockedQueue]  = useState([]);

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
        // Attempt 1 timeout — hang up, brief pause, attempt 2
        if (hangUp) hangUp(); else if (twilioDevice) twilioDevice.disconnectAll();
        setPdAttempt(2); setPdStatus('pausing'); pdClearTimers();

        pdAdvanceRef.current = setTimeout(() => {
          setPdStatus('dialing');
          dialLead(nextLead);

          let secs2 = ATTEMPT2_SEC;
          setPdCountdown(secs2);
          pdTimerRef.current = setInterval(() => { secs2 -= 1; setPdCountdown(secs2); }, 1000);
          pdTimeoutRef.current = setTimeout(() => {
            // Attempt 2 timeout — log no_answer, advance
            if (hangUp) hangUp(); else if (twilioDevice) twilioDevice.disconnectAll();
            pdClearTimers();
            handleDisposition('no_answer');
            pdAdvanceToNext(queue, nextIdx + 1);
          }, ATTEMPT2_SEC * 1000);
        }, 1500);
      }, ATTEMPT1_SEC * 1000);
    }, 1500);
  }, [dialLead, hangUp, twilioDevice, handleDisposition, setOpenId, pdClearTimers]);

  const pdStart = useCallback(() => {
    if (!todayLeads || !todayLeads.length) {
      alert('No leads due today per the Phase Engine. Check Today\'s Block for details.');
      return;
    }
    const queue = [...todayLeads];
    setPdLockedQueue(queue);
    setPdIdx(0); setPdAttempt(1); setPdStatus('dialing'); setPdMode(true);

    const lead = queue[0];
    setOpenId(lead.id);
    dialLead(lead);

    let secs = ATTEMPT1_SEC;
    setPdCountdown(secs);
    pdTimerRef.current = setInterval(() => { secs -= 1; setPdCountdown(secs); }, 1000);
    pdTimeoutRef.current = setTimeout(() => {
      if (hangUp) hangUp(); else if (twilioDevice) twilioDevice.disconnectAll();
      setPdAttempt(2); setPdStatus('pausing'); pdClearTimers();

      pdAdvanceRef.current = setTimeout(() => {
        setPdStatus('dialing');
        dialLead(lead);

        let secs2 = ATTEMPT2_SEC;
        setPdCountdown(secs2);
        pdTimerRef.current = setInterval(() => { secs2 -= 1; setPdCountdown(secs2); }, 1000);
        pdTimeoutRef.current = setTimeout(() => {
          if (hangUp) hangUp(); else if (twilioDevice) twilioDevice.disconnectAll();
          pdClearTimers();
          handleDisposition('no_answer');
          pdAdvanceToNext(queue, 1);
        }, ATTEMPT2_SEC * 1000);
      }, 1500);
    }, ATTEMPT1_SEC * 1000);
  }, [todayLeads, dialLead, hangUp, twilioDevice, handleDisposition, setOpenId, pdClearTimers, pdAdvanceToNext]);

  const pdStop = useCallback(() => {
    pdClearTimers();
    if (hangUp) hangUp(); else if (twilioDevice) twilioDevice.disconnectAll();
    setPdStatus('idle'); setPdIdx(0); setPdAttempt(1); setPdLockedQueue([]); setPdMode(false);
  }, [hangUp, twilioDevice, pdClearTimers]);

  // Detect answered call — stop countdown, mark as answered
  useEffect(() => {
    if (pdMode && pdStatus === 'dialing' && callStatus === 'connected') {
      pdClearTimers(); setPdStatus('answered');
    }
  }, [callStatus, pdMode, pdStatus, pdClearTimers]);

  // ── fireDisp: disposition wrapper that also advances PD when a call is answered ──
  // All JSX disposition buttons call this instead of handleDisposition directly.
  // Internal PD timeout paths (no_answer) still call handleDisposition directly
  // because they already invoke pdAdvanceToNext immediately after.
  const fireDisp = useCallback((dispId) => {
    handleDisposition(dispId);
    if (pdMode && (pdStatus === 'answered' || pdStatus === 'dialing')) {
      pdClearTimers();
      pdAdvanceToNext(pdLockedQueue, pdIdx + 1);
    }
  }, [handleDisposition, pdMode, pdStatus, pdClearTimers, pdAdvanceToNext, pdLockedQueue, pdIdx]);

  // Cleanup on unmount
  useEffect(() => () => pdClearTimers(), [pdClearTimers]);

  // PD display helpers
  const currentPdLead = pdMode && pdLockedQueue.length > 0 ? pdLockedQueue[pdIdx] : null;
  const pdBg     = pdStatus === 'answered' ? '#064E3B' : pdStatus === 'pausing' ? '#1e293b' : '#0F172A';
  const pdAccent = pdStatus === 'answered' ? '#10B981' : pdStatus === 'pausing' ? '#64748B' : '#3B82F6';

    return React.createElement("div", { style: { display: "flex", flex: 1, height: "100%", minWidth: 0, overflow: "hidden" } },

    // ── LEFT: Dark sidebar queue (210px) ──
    React.createElement("div", { style: { width: "210px", flexShrink: 0, background: "#0d3d2e", display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid rgba(0,0,0,0.3)" } },

      // Header + session controls
      React.createElement("div", { style: { padding: "12px 12px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 } },
        // Top row: label + exit button
        React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" } },
          React.createElement("div", { style: { fontSize: "9px", fontWeight: "800", color: "rgba(255,255,255,0.5)", letterSpacing: "2px" } }, "MINISTRY OF PROTECTION"),
          React.createElement("button", {
            onClick: () => setView("dashboard"),
            title: "Exit dial view",
            style: {
              background: "transparent", border: "none", color: "rgba(255,255,255,0.35)",
              fontSize: "14px", cursor: "pointer", padding: "0 2px", lineHeight: 1,
              transition: "color 0.15s"
            },
            onMouseEnter: e => e.currentTarget.style.color = "rgba(255,255,255,0.8)",
            onMouseLeave: e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"
          }, "✕")
        ),

        // ── Power Dial buttons (no active session) ──────────────────
        !session && React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "5px", marginBottom: "8px" } },

          // ⚡ Power Dial Today — real 18s/30s auto-hangup engine
          pdMode && pdStatus !== 'idle'
            ? React.createElement("button", {
                onClick: pdStop,
                title: "Stop Power Dial",
                style: {
                  width: "100%", minHeight: "34px", padding: "0 8px",
                  fontSize: "10px", fontWeight: "800", letterSpacing: "0.8px",
                  background: "rgba(220,38,38,0.22)", color: "#EF4444",
                  border: "1px solid rgba(220,38,38,0.45)",
                  borderRadius: "6px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "5px"
                }
              },
                React.createElement("span", null, "■"),
                React.createElement("span", null, "STOP POWER DIAL"),
                React.createElement("span", {
                  style: { fontSize: "9px", fontWeight: "800", background: "rgba(220,38,38,0.3)", color: "#EF4444", borderRadius: "10px", padding: "1px 7px" }
                }, pdIdx + 1 + "/" + pdLockedQueue.length)
              )
            : React.createElement("button", {
                onClick: pdStart,
                title: "Auto-dial today's leads: 18s attempt 1, 30s attempt 2, then advance",
                style: {
                  width: "100%", minHeight: "34px", padding: "0 8px",
                  fontSize: "10px", fontWeight: "800", letterSpacing: "0.8px",
                  background: todayCount > 0 ? "rgba(16,185,129,0.22)" : "rgba(255,255,255,0.06)",
                  color: todayCount > 0 ? "#10B981" : "rgba(255,255,255,0.35)",
                  border: "1px solid " + (todayCount > 0 ? "rgba(16,185,129,0.45)" : "rgba(255,255,255,0.12)"),
                  borderRadius: "6px", cursor: todayCount > 0 ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "5px"
                }
              },
                React.createElement("span", null, "⚡"),
                React.createElement("span", null, "POWER DIAL TODAY"),
                React.createElement("span", {
                  style: {
                    fontSize: "9px", fontWeight: "800",
                    background: todayCount > 0 ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)",
                    color: todayCount > 0 ? "#10B981" : "rgba(255,255,255,0.3)",
                    borderRadius: "10px", padding: "1px 7px"
                  }
                }, todayCount)
              ),

          // ▶ Dial This Queue — whatever is currently visible in the sidebar
          queue.length > 0 && React.createElement("button", {
            onClick: () => {
              const ids = queue.map(l => l.id);
              const s = { ids, idx: 0, total: ids.length, startedAt: new Date().toISOString() };
              setSession(s); setSessionPaused(false);
              try { localStorage.setItem(LS_SESSION, JSON.stringify(s)); } catch {}
              setOpenId(ids[0]); setDialSessionActive(true); setNoteText(""); setDetailTab("live");
            },
            title: "Start a session from the current queue as sorted",
            style: {
              width: "100%", minHeight: "28px", padding: "0 8px",
              fontSize: "9px", fontWeight: "700", letterSpacing: "0.5px",
              background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(255,255,255,0.13)", borderRadius: "6px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "5px"
            }
          },
            React.createElement("span", null, "▶"),
            React.createElement("span", null, "DIAL THIS QUEUE"),
            React.createElement("span", {
              style: {
                fontSize: "9px", fontWeight: "700", background: "rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.4)", borderRadius: "10px", padding: "1px 6px"
              }
            }, queue.length)
          )
        ),

        React.createElement("div", {
          "aria-live": "polite",
          role: "status",
          style: { fontSize: "12px", fontWeight: "700", color: "rgba(255,255,255,0.85)", marginBottom: "8px" }
        }, session ? (session.idx + 1) + " / " + session.total + " leads" : queue.length + " in queue"),
        session && React.createElement("div", {
          style: { height: "4px", background: "rgba(255,255,255,0.12)", borderRadius: "2px", overflow: "hidden", marginBottom: "8px" },
          role: "progressbar",
          "aria-valuenow": session.idx + 1,
          "aria-valuemin": 1,
          "aria-valuemax": session.total,
          "aria-label": "Session progress"
        },
          React.createElement("div", { style: { height: "100%", width: Math.round(((session.idx + 1) / session.total) * 100) + "%", background: sessionPaused ? "#F59E0B" : "#10B981", borderRadius: "2px", transition: "width 0.3s" } })
        ),
        React.createElement("div", { style: { display: "flex", gap: "4px" } },
          session && React.createElement("button", {
            onClick: () => setSessionPaused(p => !p),
            "aria-label": sessionPaused ? "Resume dial session" : "Pause dial session",
            style: { flex: 1, minHeight: "30px", fontSize: "9px", fontWeight: "700", background: sessionPaused ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.1)", color: sessionPaused ? "#F59E0B" : "rgba(255,255,255,0.8)", border: "1px solid " + (sessionPaused ? "#F59E0B" : "rgba(255,255,255,0.18)"), borderRadius: "5px", cursor: "pointer" }
          }, sessionPaused ? "▶ RESUME" : "⏸ PAUSE"),
          session && React.createElement("button", {
            onClick: () => { setSession(null); setSessionPaused(false); setDialSessionActive(false); try { localStorage.removeItem(LS_SESSION); } catch {} },
            "aria-label": "End session",
            style: { minHeight: "30px", padding: "0 7px", fontSize: "11px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)", borderRadius: "5px", cursor: "pointer" }
          }, "⏹"),
          React.createElement("button", {
            onClick: refreshQueueOrder,
            "aria-label": "Refresh queue order",
            title: "Re-sort by live priority",
            style: { minHeight: "30px", padding: "0 7px", fontSize: "11px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)", borderRadius: "5px", cursor: "pointer" }
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
            React.createElement("div", { style: { fontSize: "9px", color: "#64748b", fontFamily: "'JetBrains Mono',monospace" } }, currentPdLead.phone)
          ),
          React.createElement("div", { style: { fontSize: "9px", fontWeight: "800", color: pdAttempt === 2 ? "#F59E0B" : "#94a3b8", background: pdAttempt === 2 ? "#F59E0B22" : "#1e293b", border: "1px solid " + (pdAttempt === 2 ? "#F59E0B" : "#334155"), borderRadius: "4px", padding: "2px 6px" } }, "ATT " + pdAttempt),
          React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: pdAccent, minWidth: "50px", textAlign: "right" } },
            pdStatus === 'answered' ? "✓ LIVE" : pdStatus === 'pausing' ? "…" : pdCountdown !== null ? pdCountdown + "s" : "Dialing"
          )
        ),
        pdCountdown !== null && pdStatus === 'dialing' && React.createElement("div", { style: { marginTop: "6px", background: "#1e293b", borderRadius: "3px", height: "3px", overflow: "hidden" } },
          React.createElement("div", { style: { width: (pdCountdown / (pdAttempt === 1 ? 18 : 30) * 100) + "%", height: "100%", background: pdAccent, borderRadius: "3px", transition: "width 1s linear" } })
        )
      ),

            // Sort selector
      React.createElement("div", { style: { padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 } },
        React.createElement("label", { htmlFor: "dial-sort-mode", style: { fontSize: "9px", fontWeight: "800", color: "rgba(255,255,255,0.4)", letterSpacing: "1.2px", display: "block", marginBottom: "4px" } }, "SORT"),
        React.createElement("select", {
          id: "dial-sort-mode",
          value: dialSortMode,
          onChange: e => setDialSortMode(e.target.value),
          style: { width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.85)", borderRadius: "5px", padding: "5px 7px", fontSize: "10px", fontWeight: "600", cursor: "pointer" }
        },
          React.createElement("option", { value: "priority", style: { background: "#1e293b", color: "#f1f5f9" } }, "Priority Score"),
          React.createElement("option", { value: "phase", style: { background: "#1e293b", color: "#f1f5f9" } }, "Phase Engine"),
          React.createElement("option", { value: "overdue", style: { background: "#1e293b", color: "#f1f5f9" } }, "Overdue First")

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
          let sorted = [...queue];
          if (dialSortMode === "phase") sorted.sort((a, b) => getPhasePriority(b) - getPhasePriority(a));
          else if (dialSortMode === "overdue") sorted.sort((a, b) => {
            const aOD = (a.nextCallback && new Date(a.nextCallback) < now3) ? 1 : 0;
            const bOD = (b.nextCallback && new Date(b.nextCallback) < now3) ? 1 : 0;
            return bOD - aOD;
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
                React.createElement("span", { "aria-hidden": "true", style: { fontSize: "9px", color: "rgba(255,255,255,0.3)", minWidth: "15px", fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 } }, idx + 1),
                React.createElement("span", { style: { fontSize: "12px", fontWeight: "700", color: isActive ? "#5DCAA5" : "rgba(255,255,255,0.88)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, lead.name),
                React.createElement("span", { "aria-hidden": "true", style: { fontSize: "8px", padding: "1px 5px", borderRadius: "8px", background: BC[lead.bucket] + "28", color: BC[lead.bucket], fontWeight: "800", flexShrink: 0 } }, lead.bucket)
              ),
              React.createElement("div", { style: { paddingLeft: "20px", display: "flex", gap: "6px", alignItems: "center" } },
                React.createElement("span", { style: { fontSize: "9px", color: "rgba(255,255,255,0.45)", fontFamily: "'JetBrains Mono',monospace", fontWeight: "500" } }, lead.phone),
                isOD && React.createElement("span", { style: { fontSize: "8px", color: "#EF4444", fontWeight: "800", marginLeft: "auto" } }, "OD"),
                stuck && React.createElement("span", { style: { fontSize: "8px", color: "#FBBF24", fontWeight: "800", marginLeft: "auto" } }, "UW")
              )
            );
          });
        })(),
        queue.length === 0 && React.createElement("li", { style: { padding: "40px 16px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "12px", listStyle: "none" } }, "✓ Queue empty")
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
            })
          ),
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
            React.createElement("a", {
              href: (useTwilioCalling && twilioDevice) ? "#" : "tel:" + open.phone.replace(/\D/g, ""),
              onClick: e => { e.preventDefault(); dialLead(open); },
              "aria-label": "Dial " + open.phone,
              style: { fontSize: "13px", color: "var(--blue)", fontFamily: "'JetBrains Mono',monospace", fontWeight: "700", padding: "4px 10px", background: "var(--blue-dim)", borderRadius: "6px", border: "1px solid var(--blue-mid)", textDecoration: "none" }
            }, open.phone),
            tcpaInfo && React.createElement("span", {
              role: "status",
              title: "Local time — TCPA safe hours 8AM-9PM",
              style: { fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "6px", background: tcpaInfo.safe ? "var(--green-dim)" : "var(--red-dim)", color: tcpaInfo.safe ? "var(--green)" : "var(--red)", border: "1px solid " + (tcpaInfo.safe ? "#6EE7B7" : "#FCA5A5") }
            }, (tcpaInfo.safe ? "🟢 " : "🔴 ") + tcpaInfo.timeStr + " " + tcpaInfo.ltz),
            React.createElement("span", { style: { fontSize: "10px", padding: "3px 9px", borderRadius: "20px", background: BC[open.bucket] + "18", color: BC[open.bucket], fontWeight: "800" } }, BL[open.bucket]),
            open.leadType && React.createElement("span", { style: { fontSize: "10px", padding: "3px 9px", borderRadius: "20px", background: "var(--blue-mid)", color: "#1D4ED8", fontWeight: "700" } }, open.leadType),
            open.city && open.state && React.createElement("span", { style: { fontSize: "10px", color: "var(--t3)" } }, "📍 " + open.city + ", " + open.state),
            isUWStuck(open) && React.createElement("span", { className: "pulse-red", style: { fontSize: "10px", padding: "3px 9px", borderRadius: "20px", background: "var(--red-dim)", color: "var(--red)", fontWeight: "800", border: "1px solid #FCA5A5" } }, "⚠ UW " + daysInUW(open) + "d")
          )
        ),

        // Scrollable body
        React.createElement("div", { style: { flex: 1, overflowY: "auto", padding: "14px 18px" } },

          // Appointment gate
          (open.disposition === "appointment_booked" && open.nextCallback && new Date(open.nextCallback) < new Date() && !open.apptConfirmed)
            ? React.createElement("div", { style: { background: "#F5F3FF", border: "2px solid #C4B5FD", borderRadius: "12px", padding: "16px", marginBottom: "14px" } },
                React.createElement("div", { style: { fontSize: "10px", fontWeight: "800", color: "#4C1D95", letterSpacing: "1.5px", marginBottom: "8px" } }, "📅 APPOINTMENT CHECK-IN"),
                React.createElement("div", { style: { fontSize: "13px", color: "#4C1D95", lineHeight: "1.6", marginBottom: "12px" } },
                  "Did " + (open.name || "").split(" ")[0] + " show for their appointment on " + fmt(open.nextCallback) + "? Confirm before logging."
                ),
                confirmReschedule
                  ? React.createElement("div", null,
                      React.createElement("div", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", letterSpacing: "1.2px", marginBottom: "8px" } }, "SET NEW DATE & TIME"),
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
                        style: { minHeight: "48px", padding: "12px", background: "#ECFDF5", color: "#065F46", border: "2px solid #6EE7B7", borderRadius: "9px", fontSize: "13px", fontWeight: "800", cursor: "pointer", textAlign: "left" }
                      }, "✅  Showed — They Made It"),
                      React.createElement("button", {
                        onClick: () => { upd(open.id, { disposition: "no_show", stage: "contacted", nextCallback: null, apptConfirmed: true, notes: [{ ts: new Date().toISOString(), type: "call", text: "❌ No-show — appointment was " + fmt(open.nextCallback) }, ...(open.notes || [])] }); },
                        style: { minHeight: "48px", padding: "12px", background: "#FEF3C7", color: "#92400E", border: "2px solid #FCD34D", borderRadius: "9px", fontSize: "13px", fontWeight: "800", cursor: "pointer", textAlign: "left" }
                      }, "❌  No-Show — They Ghosted"),
                      React.createElement("button", {
                        onClick: () => { setConfirmReschedule(true); setConfirmCbDate(""); setConfirmCbTime(""); },
                        style: { minHeight: "48px", padding: "12px", background: "var(--blue-dim)", color: "#1D4ED8", border: "2px solid var(--blue-mid)", borderRadius: "9px", fontSize: "13px", fontWeight: "800", cursor: "pointer", textAlign: "left" }
                      }, "🔄  Rescheduled — Set New Time")
                    )
              )
            : React.createElement(React.Fragment, null,

                // Calendly CTA
                React.createElement("button", {
                  onClick: () => openCalendlyPopup(open, calendlyUrl, setCalendlyTargetId),
                  style: {
                    display: "block", width: "100%", minHeight: "44px", padding: "10px 12px", marginBottom: "10px",
                    background: open.disposition === "appointment_booked" ? "#8B5CF6" : "transparent",
                    color: open.disposition === "appointment_booked" ? "#fff" : "#8B5CF6",
                    border: "1.5px solid " + (open.disposition === "appointment_booked" ? "#8B5CF6" : "#C4B5FD"),
                    borderRadius: "8px", fontSize: "13px", fontWeight: "800", cursor: "pointer", textAlign: "center"
                  }
                }, open.disposition === "appointment_booked" ? "📅 BOOKED · " + fmt(open.nextCallback) : "📅 BOOK → CALENDLY"),

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
                React.createElement("div", { style: { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", marginBottom: "10px" } },
                  React.createElement("div", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", letterSpacing: "1.5px", marginBottom: "10px" } }, "🩺 QUICK CAPTURE"),
                  React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", marginBottom: "8px" } },
                    [["Age", "age", "54"], ["Height", "height", "5'10\""], ["Weight", "weight", "180"], ["DOB", "dob", "1970-01-01"]].map(([lbl, field, ph]) =>
                      React.createElement("div", { key: field },
                        React.createElement("label", { htmlFor: "qc-" + field + "-" + open.id, style: { fontSize: "9px", fontWeight: "800", color: "var(--t3)", letterSpacing: "0.5px", display: "block", marginBottom: "3px" } }, lbl.toUpperCase()),
                        React.createElement("input", {
                          id: "qc-" + field + "-" + open.id, key: field + "-dial-" + open.id, placeholder: ph, defaultValue: open[field] || "",
                          onBlur: e => { const v = e.target.value.trim(); if (v !== (open[field] || "")) upd(open.id, { [field]: v }); },
                          style: { ...inp(), width: "100%", fontSize: "12px", boxSizing: "border-box", padding: "6px 8px" }
                        })
                      )
                    )
                  ),
                  React.createElement("div", {
                    style: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "6px", background: open.tobacco ? "#FEF3C7" : "var(--surface)", border: "1px solid " + (open.tobacco ? "#FCD34D" : "var(--border)"), cursor: "pointer", marginBottom: "8px" },
                    onClick: () => upd(open.id, { tobacco: !open.tobacco })
                  },
                    React.createElement("input", { type: "checkbox", id: "qc-tobacco-" + open.id, checked: !!open.tobacco, onChange: () => upd(open.id, { tobacco: !open.tobacco }), style: { width: "14px", height: "14px", cursor: "pointer", accentColor: "#D97706" } }),
                    React.createElement("label", { htmlFor: "qc-tobacco-" + open.id, style: { fontSize: "11px", fontWeight: "700", color: open.tobacco ? "#D97706" : "var(--t2)", cursor: "pointer" } }, "🚬 Tobacco User"),
                    open.tobacco && React.createElement("span", { style: { fontSize: "9px", fontWeight: "800", color: "#D97706", marginLeft: "auto" } }, "TABLE RATING")
                  ),
                  React.createElement("label", { htmlFor: "qc-meds-" + open.id, style: { fontSize: "9px", fontWeight: "800", color: "var(--t3)", letterSpacing: "0.5px", display: "block", marginBottom: "3px" } }, "MEDICATIONS / CONDITIONS"),
                  React.createElement("textarea", {
                    id: "qc-meds-" + open.id, key: "meds-dial-" + open.id, placeholder: "Meds, conditions...", defaultValue: open.medications || "",
                    onBlur: e => { const v = e.target.value.trim(); if (v !== (open.medications || "")) upd(open.id, { medications: v }); },
                    style: { ...inp(), width: "100%", fontSize: "12px", resize: "none", minHeight: "44px", lineHeight: "1.4", boxSizing: "border-box", padding: "6px 8px" }
                  }),
                  React.createElement("div", { style: { marginTop: "8px", padding: "8px 10px", background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: "6px", fontSize: "11px", color: "#065F46", fontWeight: "600" } },
                    "💚 Living Benefits — money that pays while ALIVE. Always lead with this."
                  )
                ),

                // Set Callback
                React.createElement("div", { style: { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px" } },
                  React.createElement("div", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", letterSpacing: "1.5px", marginBottom: "8px" } }, "SET CALLBACK"),
                  open.nextCallback && React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", padding: "8px 10px", background: "var(--sky-dim)", borderRadius: "7px", border: "1px solid #BAE6FD" } },
                    React.createElement("span", { style: { fontSize: "12px", color: "var(--sky)", fontWeight: "700", flex: 1 } }, "📅 " + fmt(open.nextCallback)),
                    React.createElement("button", { onClick: () => upd(open.id, { nextCallback: null }), "aria-label": "Clear callback", style: { background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: "16px", lineHeight: 1 } }, "×")
                  ),
                  React.createElement("div", { style: { display: "flex", gap: "6px" } },
                    React.createElement("label", { htmlFor: "dial-cb-date", className: "sr-only" }, "Callback date"),
                    React.createElement("input", { id: "dial-cb-date", type: "date", value: cbDate, onChange: e => setCbDate(e.target.value), style: { ...inp(), flex: 1, fontSize: "11px", padding: "6px 8px" } }),
                    React.createElement("label", { htmlFor: "dial-cb-time", className: "sr-only" }, "Callback time"),
                    React.createElement("input", { id: "dial-cb-time", type: "time", value: cbTime, onChange: e => setCbTime(e.target.value), style: { ...inp(), width: "88px", fontSize: "11px", padding: "6px 8px" } }),
                    React.createElement("button", { onClick: () => lockCB(open.id), style: { minHeight: "36px", padding: "6px 12px", background: "var(--sky)", color: "#fff", border: "none", borderRadius: "7px", fontSize: "11px", fontWeight: "700", cursor: "pointer" } }, "Set")
                  )
                )
              ),

          // Recent notes — always visible below actions
          (open.notes || []).length > 0 && React.createElement("div", { style: { marginTop: "12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px" } },
            React.createElement("div", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", letterSpacing: "1.5px", marginBottom: "8px" } }, "RECENT — " + (open.notes || []).length + " ENTRIES"),
            (open.notes || []).slice(0, 4).map((n, i) =>
              React.createElement("div", { key: n.ts || n.id || i, style: { marginBottom: "8px", padding: "8px 10px", background: "var(--surface)", borderRadius: "7px", border: "1px solid var(--border)" } },
                React.createElement("div", { style: { fontSize: "10px", color: NC[n.type] || "var(--t3)", fontWeight: "800", marginBottom: "3px" } },
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
          const dispBar = [
            { id: "no_answer", icon: "📵", label: "No Answer" },
            { id: "vm_left", icon: "📬", label: "VM Left" },
            { id: "callback", icon: "📅", label: "Callback" },
            { id: "not_interested", icon: "🚫", label: "Not Int." },
            { id: "dnc", icon: "⛔", label: "DNC" },
            { id: "hung_up", icon: "📵", label: "Hung Up" },
            { id: "follow_up", icon: "🔄", label: "Follow Up" }
          ];
          return React.createElement("div", {
            style: { flexShrink: 0, padding: "8px 12px", borderTop: "2px solid var(--border)", background: "var(--surface)", display: "flex", gap: "5px", overflowX: "auto" }
          },
            gateActive
              ? React.createElement("div", { style: { width: "100%", textAlign: "center", fontSize: "11px", color: "var(--amber)", fontWeight: "700", padding: "8px 0" } }, "⚠ Complete appointment check-in above before logging a result")
              : dispBar.map(d =>
                  React.createElement("button", {
                    key: d.id,
                    onClick: () => fireDisp(d.id),
                    "aria-label": "Log: " + d.label,
                    "aria-pressed": open.disposition === d.id,
                    style: {
                      minHeight: "48px", flex: "1 1 0", minWidth: "58px", padding: "5px 2px",
                      background: open.disposition === d.id ? "var(--navy)" : "var(--surface-2)",
                      color: open.disposition === d.id ? "#fff" : "var(--t2)",
                      border: "1px solid " + (open.disposition === d.id ? "var(--navy)" : "var(--border)"),
                      borderRadius: "7px", fontSize: "9px", fontWeight: open.disposition === d.id ? "800" : "600",
                      cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: "3px", transition: "all 0.1s ease"
                    }
                  },
                    React.createElement("span", { "aria-hidden": "true", style: { fontSize: "14px", lineHeight: 1 } }, d.icon),
                    React.createElement("span", { style: { fontSize: "8px", lineHeight: 1.3, textAlign: "center", letterSpacing: "0.3px" } }, d.label)
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
        [["script", "📞", "Script"], ["notes", "📝", "Notes"], ["sms", "💬", "SMS"], ["activity", "📋", "Activity"]].map(([tab, icon, lbl]) =>
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
              gap: "2px", fontSize: "9px", fontWeight: "700", letterSpacing: "0.5px", transition: "all 0.1s"
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
                  style: { ...chip(scriptSection === s, "#2563EB"), fontSize: "9px", padding: "4px 8px", textTransform: "capitalize", margin: 0 }
                }, s)
              )
            )
          ),
          React.createElement("div", { style: { fontFamily: "'DM Sans',system-ui,sans-serif", fontSize: "12px", color: "#334155", lineHeight: "2.0", whiteSpace: "pre-wrap", background: "var(--surface)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)" } },
            ...(open
              ? renderLiveTokens((scripts[(open.leadType && scripts[open.leadType]) ? open.leadType : scriptType] || {})[scriptSection] || "Select a section above.", open, upd)
              : ["Select a lead to load script."]
            )
          ),
          open && React.createElement("div", { style: { fontSize: "9px", color: "var(--t3)", textAlign: "center", marginTop: "6px", fontWeight: "500" } }, "🟡 Yellow = missing · 🟢 Green = on file")
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
              style: { flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--t1)", padding: "8px 10px", fontSize: "12px", fontFamily: "'DM Sans',sans-serif", resize: "none", minHeight: "60px", lineHeight: "1.5" }
            }),
            React.createElement("button", { onClick: () => { if (open) addNote(open.id); }, "aria-label": "Save note", style: { padding: "0 12px", background: "var(--blue)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "18px", cursor: "pointer", alignSelf: "stretch" } }, "→")
          ),
          open && (open.notes || []).length > 0
            ? React.createElement("div", null,
                React.createElement("div", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", letterSpacing: "1.5px", marginBottom: "8px" } }, "HISTORY — " + (open.notes || []).length + " ENTRIES"),
                (open.notes || []).map((n, i) =>
                  React.createElement("div", { key: n.ts || n.id || i, style: { marginBottom: "8px", padding: "8px 10px", background: "var(--surface)", borderRadius: "7px", border: "1px solid var(--border)" } },
                    React.createElement("div", { style: { fontSize: "10px", color: NC[n.type] || "var(--t3)", fontWeight: "800", marginBottom: "3px" } },
                      n.type === "call" ? "📞 Call" : n.type === "appointment" ? "📅 Appt" : "📝 Note", " · " + fmt(n.ts)
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
          React.createElement("div", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", letterSpacing: "1.5px", marginBottom: "10px" } }, "SMS TEMPLATES"),
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
                      },
                      "aria-label": "Copy " + (tpl.name || key) + " template",
                      style: { padding: "3px 9px", background: "var(--blue-dim)", color: "var(--blue)", border: "1px solid var(--blue-mid)", borderRadius: "5px", fontSize: "10px", fontWeight: "700", cursor: "pointer" }
                    }, "Copy")
                  ),
                  React.createElement("div", { style: { fontSize: "11px", color: "var(--t3)", lineHeight: "1.5" } }, (tpl.text || "").length > 80 ? (tpl.text || "").slice(0, 80) + "\u2026" : (tpl.text || ""))
                )
              )
            : React.createElement("div", { style: { textAlign: "center", padding: "24px 0", color: "var(--t4)", fontSize: "12px" } }, "No templates. Add them in the SMS tab.")
        ),

        // ACTIVITY tab
        dialRightTab === "activity" && React.createElement("div", {
          id: "dial-panel-activity", role: "tabpanel", "aria-labelledby": "dial-tab-activity", style: { padding: "12px" }
        },
          React.createElement("div", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", letterSpacing: "1.5px", marginBottom: "10px" } }, "CALL HISTORY"),
          open && (open.notes || []).filter(n => n.type === "call").length > 0
            ? React.createElement("div", null,
                ...(open.notes || []).filter(n => n.type === "call").slice().reverse().map((n, i) =>
                  React.createElement("div", {
                    key: n.id || i,
                    style: { padding: "8px 0", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "3px" }
                  },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" } },
                      React.createElement("span", { style: { fontSize: "11px", fontWeight: "700", color: "var(--t1)", flex: 1 } }, n.text || "Outbound Dial"),
                      React.createElement("span", { style: { fontSize: "10px", color: "var(--t4)", whiteSpace: "nowrap" } },
                        n.ts ? new Date(n.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""
                      )
                    ),
                    n.source && React.createElement("span", { style: { fontSize: "10px", color: "var(--t4)" } }, n.source)
                  )
                )
              )
            : React.createElement("div", { style: { textAlign: "center", padding: "24px 0", color: "var(--t4)", fontSize: "12px" } }, "No calls logged yet.")
        )

      ) // end right panel
    ) // end flex row
  ); // end root div
}
