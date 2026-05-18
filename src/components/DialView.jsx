import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BC, BL, NC, fmt, inp, isUWStuck, daysInUW } from '../constants.js';
import { usePowerDialer } from '../lib/usePowerDialer.js';


// ── Script token renderer — module scope (no per-render redefinition) ──────
import DialQueuePanel from './DialQueuePanel';
import DialRightPanel from './DialRightPanel';
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
  // ── POWER DIALER ENGINE — extracted to lib/usePowerDialer.js ──────────
  const {
    pdQueue,
    pdMode, pdStatus, pdIdx, pdLockedQueue, pdAttempt, pdCountdown,
    pdSessionLog,
    currentPdLead, pdBg, pdAccent,
    pdStart, pdStop, fireDisp,
  } = usePowerDialer({ queue, openId, dialLead, twilioDevice, setOpenId, handleDisposition, callStatus });

  // ── Local view state ────────────────────────────────────────────────────
  const [callPanelExpanded, setCallPanelExpanded] = useState(true);
  const [onHold,            setOnHold]            = useState(false);
  const [dialQueueFilter,   setDialQueueFilter]   = useState('today');
  const [cbPopoverOpen,     setCbPopoverOpen]     = useState(false);
  const [cbCustomTs,        setCbCustomTs]        = useState('');
  const [manualApptOpen,    setManualApptOpen]    = useState(false);
  const [manualApptTs,      setManualApptTs]      = useState('');

    return React.createElement("div", { style: { display: "flex", flex: 1, height: "100%", minWidth: 0, overflow: "hidden" } },
    // ── LEFT: Queue panel (extracted) ──
    React.createElement(DialQueuePanel, {
      // call control
      callPanelExpanded, setCallPanelExpanded,
      onHold, setOnHold,
      // PD state
      pdMode, pdStatus, pdIdx, pdLockedQueue, pdAttempt, pdCountdown,
      pdStart, pdStop,
      pdQueue,
      pdSessionLog,
      currentPdLead, pdBg, pdAccent,
      // queue filter
      dialQueueFilter, setDialQueueFilter,
      // call props
      callStatus, callElapsed, activeCallLead, open,
      callMuted, toggleMute, hangUp,
      // session props
      session, setSession, sessionPaused, setSessionPaused, setDialSessionActive,
      // queue + nav
      queue,
      refreshQueueOrder, setView,
      dialSortMode, setDialSortMode,
      openId, setOpenId, setNoteText, setDialRightTab,
    }),
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
                      position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 200,
                      background: "var(--surface)", border: "2px solid #8B5CF6", borderRadius: "12px",
                      padding: "14px", boxShadow: "0 6px 24px rgba(0,0,0,0.18)"
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

    // ── RIGHT: Tab rail (extracted) ──
    React.createElement(DialRightPanel, {
      dialRightTab, setDialRightTab,
      open, upd,
      noteText, setNoteText,
      addNote,
      scripts, scriptType, setScriptType, scriptSection, setScriptSection,
      templates,
    })
  );
}
