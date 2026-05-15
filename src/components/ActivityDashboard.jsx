import React from 'react';
import HourlyStats from './HourlyStats';
import { ACTIVITY_TYPES, goalTone, TODAY_KEY, fmtTime, DEFAULT_GOALS } from '../lib/activityLog.js';

export default function ActivityDashboard({
  activityStats, activityRange, setActivityRange,
  goals, goalsDraft, setGoalsDraft,
  editingGoals, setEditingGoals, saveGoals,
  activity, saveActivity, logActivity,
  setOpenId, setView, setDetailTab,
}) {
  const view     = activityStats.view;
  const goalDials = activityRange === "today" ? goals.dials        : activityRange === "week" ? goals.dials * 7        : goals.dials * activityStats.days;
  const goalCont  = activityRange === "today" ? goals.contacts     : activityRange === "week" ? goals.contacts * 7     : goals.contacts * activityStats.days;
  const goalAppts = activityRange === "today" ? goals.appointments : activityRange === "week" ? goals.appointments * 7 : goals.appointments * activityStats.days;
  const tiles = [
    { label: "DIALS",        icon: "📞", val: view.dials,        goal: goalDials, key: "dial" },
    { label: "CONTACTS",     icon: "☎",  val: view.contacts,     goal: goalCont,  key: "contact" },
    { label: "APPOINTMENTS", icon: "📅", val: view.appointments, goal: goalAppts, key: "appointment" },
  ];
  const max7 = Math.max(1, ...activityStats.last7.map(d => {
    const a = activityStats.last7Agg.perDay[d.key] || {};
    return (a.dials || 0) + (a.contacts || 0) + (a.appointments || 0);
  }));
  const recent     = (activity || []).slice(0, 18);
  const rangeLabel = activityRange === "today" ? "Today" : activityRange === "week" ? "This Week" : "This Month";

  // Inline style helper for number inputs
  const inp = () => ({
    padding: "8px 12px", fontSize: "13px", borderRadius: "8px",
    border: "1px solid var(--border)", background: "var(--surface)",
    color: "var(--t1)", outline: "none", fontFamily: "'DM Sans',system-ui,sans-serif",
  });

  return React.createElement("div", { style: { flex: 1, overflowY: "auto", padding: "24px 32px", background: "var(--surface-2)" } },
    React.createElement("div", { style: { maxWidth: "1100px", margin: "0 auto" } },

      // Header row
      React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "12px" } },
        React.createElement("div", null,
          React.createElement("h2", { style: { fontSize: "22px", fontWeight: "800", color: "var(--t1)", fontFamily: "'Syne',sans-serif", letterSpacing: "0.5px" } }, "📊 Activity Dashboard"),
          React.createElement("div", { style: { fontSize: "12px", color: "var(--t3)", fontWeight: "500", marginTop: "4px" } }, "Accountability tracker · " + rangeLabel)
        ),
        React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center" } },
          ["today", "week", "month"].map(r =>
            React.createElement("button", {
              key: r, onClick: () => setActivityRange(r),
              style: {
                padding: "7px 16px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.5px", borderRadius: "8px", cursor: "pointer",
                background: activityRange === r ? "var(--navy)" : "var(--surface)",
                color:      activityRange === r ? "#fff"        : "var(--t2)",
                border:    `1px solid ${activityRange === r ? "var(--navy)" : "var(--border)"}`,
                textTransform: "uppercase"
              }
            }, r)
          ),
          React.createElement("button", {
            onClick: () => { setGoalsDraft(goals); setEditingGoals(v => !v); },
            style: { marginLeft: "6px", padding: "7px 14px", fontSize: "11px", fontWeight: "700", borderRadius: "8px", cursor: "pointer", background: "var(--surface)", color: "var(--t2)", border: "1px solid var(--border)", letterSpacing: "0.5px" }
          }, editingGoals ? "× Cancel" : "⚙ Goals"),
          React.createElement("button", {
            onClick: () => {
              const rows = [["Date","Time","Type","Lead Name","Source"], ...(activity || []).map(e => [
                e.date || "", e.ts ? new Date(e.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "",
                e.type || "", e.leadName || "", e.source || ""
              ])];
              const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "ministry-activity-" + new Date().toISOString().split("T")[0] + ".csv"; a.click(); URL.revokeObjectURL(url);
            },
            style: { marginLeft: "4px", padding: "7px 14px", fontSize: "11px", fontWeight: "700", borderRadius: "8px", cursor: "pointer", background: "var(--green-dim)", color: "var(--green)", border: "1px solid #6EE7B7", letterSpacing: "0.5px", fontFamily: "'DM Sans',sans-serif" }
          }, "📥 Export CSV")
        )
      ),

      // Goals editor (collapsible)
      editingGoals && React.createElement("div", { style: { marginTop: "16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 4px 16px rgba(0,0,0,0.03)" } },
        React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--t3)", letterSpacing: "1.2px", marginBottom: "14px" } }, "DAILY TARGETS"),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "14px" } },
          [{ key: "dials", label: "Dials / day" }, { key: "contacts", label: "Contacts / day" }, { key: "appointments", label: "Appointments / day" }].map(f =>
            React.createElement("div", { key: f.key },
              React.createElement("label", { style: { fontSize: "10px", fontWeight: "700", color: "var(--t3)", letterSpacing: "0.6px", display: "block", marginBottom: "6px" } }, f.label),
              React.createElement("input", {
                type: "number", min: "0",
                value: goalsDraft[f.key],
                onChange: e => { const n = parseInt(e.target.value || "0", 10); setGoalsDraft(p => ({ ...p, [f.key]: isNaN(n) ? 0 : n })); },
                style: { ...inp(), width: "100%", fontSize: "15px", fontWeight: "700", fontFamily: "'JetBrains Mono',monospace" }
              })
            )
          )
        ),
        React.createElement("div", { style: { display: "flex", gap: "8px" } },
          React.createElement("button", { onClick: () => { saveGoals(goalsDraft); setEditingGoals(false); }, style: { padding: "9px 20px", background: "var(--green)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer", letterSpacing: "0.5px" } }, "Save Goals ✓"),
          React.createElement("button", { onClick: () => { setGoalsDraft(DEFAULT_GOALS); }, style: { padding: "9px 16px", background: "var(--surface-2)", color: "var(--t2)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" } }, "Reset to defaults")
        )
      ),

      // KPI tiles
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginTop: "20px", marginBottom: "18px" } },
        tiles.map(t => {
          const tone = goalTone(t.val, t.goal);
          const pct  = t.goal > 0 ? Math.min(100, Math.round((t.val / t.goal) * 100)) : 0;
          return React.createElement("div", { key: t.key, style: { background: "var(--surface)", border: `1px solid ${tone.border}`, borderRadius: "14px", padding: "20px 22px", boxShadow: "0 4px 16px rgba(0,0,0,0.03)" } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } },
              React.createElement("div", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", letterSpacing: "1.2px" } }, t.icon + " " + t.label),
              React.createElement("div", { style: { fontSize: "10px", fontWeight: "700", color: tone.c, letterSpacing: "0.5px", padding: "2px 8px", borderRadius: "20px", background: tone.bg, border: `1px solid ${tone.border}` } }, pct + "%")
            ),
            React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "12px" } },
              React.createElement("div", { style: { fontSize: "42px", fontWeight: "800", color: tone.c, fontFamily: "'Syne',sans-serif", lineHeight: 1 } }, "" + t.val),
              React.createElement("div", { style: { fontSize: "15px", color: "var(--t3)", fontWeight: "600", fontFamily: "'JetBrains Mono',monospace" } }, "/ " + t.goal)
            ),
            React.createElement("div", { style: { height: "8px", background: "var(--surface-2)", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--border)" } },
              React.createElement("div", { style: { height: "100%", width: pct + "%", background: tone.c, transition: "width 0.3s ease" } })
            ),
            React.createElement("button", { onClick: () => logActivity(t.key, null, "manual"), style: { marginTop: "12px", padding: "7px 14px", fontSize: "11px", fontWeight: "700", background: "var(--surface-2)", color: "var(--t2)", border: "1px dashed var(--border-2)", borderRadius: "7px", cursor: "pointer", letterSpacing: "0.5px" } }, "+1 " + t.label)
          );
        })
      ),

      // Conversion rates
      React.createElement("div", { style: { display: "flex", gap: "12px", marginBottom: "22px", flexWrap: "wrap" } },
        [
          { label: "CONTACT RATE", val: activityStats.contactRate, sub: "contacts ÷ dials (today)" },
          { label: "SET RATE",     val: activityStats.setRate,     sub: "appointments ÷ contacts (today)" },
        ].map(r => React.createElement("div", { key: r.label, style: { flex: 1, minWidth: "200px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" } },
          React.createElement("div", null,
            React.createElement("div", { style: { fontSize: "10px", fontWeight: "800", color: "var(--t3)", letterSpacing: "1px", marginBottom: "4px" } }, r.label),
            React.createElement("div", { style: { fontSize: "11px", color: "var(--t3)", fontWeight: "500" } }, r.sub)
          ),
          React.createElement("div", { style: { fontSize: "24px", fontWeight: "800", color: r.val >= 30 ? "var(--green)" : r.val >= 15 ? "var(--blue)" : r.val > 0 ? "var(--amber)" : "var(--t3)", fontFamily: "'Syne',sans-serif" } }, r.val + "%")
        ))
      ),

      // 7-day trend
      React.createElement("div", { style: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 22px", marginBottom: "18px", boxShadow: "0 4px 16px rgba(0,0,0,0.03)" } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" } },
          React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--t2)", letterSpacing: "1px" } }, "7-DAY TREND"),
          React.createElement("div", { style: { display: "flex", gap: "14px", fontSize: "10px", fontWeight: "700" } },
            ACTIVITY_TYPES.map(t => React.createElement("div", { key: t.id, style: { display: "flex", alignItems: "center", gap: "5px", color: "var(--t3)" } },
              React.createElement("span", { style: { width: "10px", height: "10px", borderRadius: "3px", background: t.color, display: "inline-block" } }),
              React.createElement("span", null, t.label.toUpperCase())
            ))
          )
        ),
        React.createElement("div", { style: { display: "flex", alignItems: "flex-end", gap: "10px", height: "160px", paddingBottom: "4px" } },
          activityStats.last7.map(d => {
            const a = activityStats.last7Agg.perDay[d.key] || { dials: 0, contacts: 0, appointments: 0 };
            const total = a.dials + a.contacts + a.appointments;
            const isToday = d.key === TODAY_KEY();
            return React.createElement("div", { key: d.key, style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" } },
              React.createElement("div", { style: { fontSize: "10px", fontWeight: "700", color: total > 0 ? "var(--t2)" : "var(--t4)", fontFamily: "'JetBrains Mono',monospace" } }, total > 0 ? total : ""),
              React.createElement("div", { style: { width: "100%", height: "110px", display: "flex", flexDirection: "column", justifyContent: "flex-end", borderRadius: "6px 6px 0 0", overflow: "hidden", background: "var(--surface-2)", border: `1px solid ${isToday ? "var(--blue)" : "var(--border)"}` } },
                a.appointments > 0 && React.createElement("div", { style: { height: `${(a.appointments / max7) * 100}%`, background: "var(--green)", minHeight: "3px" } }),
                a.contacts > 0     && React.createElement("div", { style: { height: `${(a.contacts / max7) * 100}%`,     background: "var(--sky)",   minHeight: "3px" } }),
                a.dials > 0        && React.createElement("div", { style: { height: `${(a.dials / max7) * 100}%`,        background: "var(--blue)",  minHeight: "3px" } })
              ),
              React.createElement("div", { style: { fontSize: "10px", fontWeight: isToday ? "800" : "600", color: isToday ? "var(--blue)" : "var(--t3)", letterSpacing: "0.4px" } }, isToday ? "TODAY" : d.label.toUpperCase())
            );
          })
        )
      ),

      // Hourly stats
      React.createElement(HourlyStats, { activity }),

      // Recent activity feed
      React.createElement("div", { style: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px 22px", boxShadow: "0 4px 16px rgba(0,0,0,0.03)" } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" } },
          React.createElement("div", { style: { fontSize: "11px", fontWeight: "800", color: "var(--t2)", letterSpacing: "1px" } }, "RECENT ACTIVITY"),
          React.createElement("div", { style: { fontSize: "11px", color: "var(--t3)", fontWeight: "600" } }, (activity || []).length + " total events")
        ),
        recent.length === 0 && React.createElement("div", { style: { padding: "32px", textAlign: "center", color: "var(--t4)", fontSize: "13px", fontWeight: "500" } }, "No activity logged yet. Make a call or set a callback to start tracking."),
        recent.length > 0 && React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "2px" } },
          recent.map(e => {
            const t = ACTIVITY_TYPES.find(x => x.id === e.type) || ACTIVITY_TYPES[0];
            return React.createElement("div", {
              key: e.id,
              onClick: () => { if (e.leadId) { setOpenId(e.leadId); setView("dial"); setDetailTab("activity"); } },
              style: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "8px", cursor: e.leadId ? "pointer" : "default", borderBottom: "1px solid var(--border)" }
            },
              React.createElement("div", { style: { fontSize: "10px", fontWeight: "700", color: "var(--t3)", fontFamily: "'JetBrains Mono',monospace", minWidth: "68px" } }, fmtTime(e.ts)),
              React.createElement("div", { style: { fontSize: "10px", fontWeight: "800", color: t.color, padding: "3px 10px", borderRadius: "20px", background: t.bg, border: `1px solid ${t.border}`, minWidth: "96px", textAlign: "center" } }, t.icon + " " + t.label.toUpperCase()),
              React.createElement("div", { style: { flex: 1, fontSize: "13px", color: "var(--t1)", fontWeight: "500" } },
                e.leadName || React.createElement("span", { style: { color: "var(--t3)", fontStyle: "italic" } }, "(unattached)")
              ),
              e.source === "manual" && React.createElement("span", { style: { fontSize: "9px", fontWeight: "700", color: "var(--t3)", padding: "2px 8px", borderRadius: "20px", background: "var(--surface-2)", border: "1px dashed var(--border-2)", letterSpacing: "0.5px" } }, "MANUAL"),
              React.createElement("button", {
                onClick: ev => { ev.stopPropagation(); saveActivity(activity.filter(x => x.id !== e.id)); },
                title: "Remove event",
                style: { marginLeft: "6px", background: "none", border: "none", color: "var(--t4)", fontSize: "16px", lineHeight: 1, cursor: "pointer", padding: "0 4px", borderRadius: "4px", flexShrink: 0 }
              }, "−")
            );
          })
        )
      )
    )
  );
}
