import React, { useMemo } from 'react';

const LS_SESSION = "metka-session-v1";

export default function CallbackQueue({
  leads,
  setOpenId, setView,
  setSession, setSessionPaused,
  setNoteText, setDetailTab,
}) {
  const now = new Date();
  const todayStr = now.toDateString();

  const fmtCB = ts => {
    const d = new Date(ts);
    const isToday = d.toDateString() === todayStr;
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (isToday) return time;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + time;
  };

  const allCBLeads = useMemo(() =>
    leads
      .filter(l => l.nextCallback)
      .sort((a, b) => new Date(a.nextCallback) - new Date(b.nextCallback))
  , [leads]);

  const overdue  = allCBLeads.filter(l => new Date(l.nextCallback) < now && new Date(l.nextCallback).toDateString() !== todayStr);
  const todayCBs = allCBLeads.filter(l => new Date(l.nextCallback).toDateString() === todayStr);
  const upcoming = allCBLeads.filter(l => {
    const cb = new Date(l.nextCallback);
    return cb.toDateString() !== todayStr && cb > now && cb <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  });

  const bucketColor = b => b === "A" ? "var(--green)" : b === "B" ? "var(--amber)" : "var(--t4)";

  const CBCard = ({ lead, isOverdue }) =>
    React.createElement("div", {
      onClick: () => { setOpenId(lead.id); setView("dial"); },
      style: {
        display: "flex", alignItems: "center", gap: "12px",
        padding: "12px 16px", cursor: "pointer",
        background: "var(--surface)", borderRadius: "10px",
        border: "1px solid " + (isOverdue ? "var(--red-dim, #FEE2E2)" : "var(--border)"),
        transition: "background 0.12s"
      },
      onMouseEnter: e => e.currentTarget.style.background = "var(--surface-2)",
      onMouseLeave: e => e.currentTarget.style.background = "var(--surface)"
    },
      React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: "44px", background: isOverdue ? "#FEF2F2" : "var(--sky-dim,#E0F2FE)", borderRadius: "8px", padding: "6px 4px" } },
        React.createElement("span", { style: { fontSize: "18px", lineHeight: 1 } }, isOverdue ? "⚠️" : "📅"),
        React.createElement("span", { style: { fontSize: "11px", fontWeight: "800", color: isOverdue ? "var(--red)" : "var(--sky)", marginTop: "3px", textAlign: "center", lineHeight: 1.1 } }, fmtCB(lead.nextCallback))
      ),
      React.createElement("div", { style: { flex: 1, minWidth: 0 } },
        React.createElement("div", { style: { fontSize: "13px", fontWeight: "700", color: "var(--t1)", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, lead.name || "Unknown"),
        React.createElement("div", { style: { fontSize: "11px", color: "var(--t3)", display: "flex", gap: "8px", alignItems: "center" } },
          React.createElement("span", null, lead.phone || "—"),
          lead.leadType && React.createElement("span", { style: { fontSize: "11px", background: "var(--navy-3,#1e293b22)", color: "var(--navy)", borderRadius: "4px", padding: "1px 6px", fontWeight: "600" } }, lead.leadType)
        )
      ),
      React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 } },
        React.createElement("span", { style: { fontSize: "11px", fontWeight: "800", color: bucketColor(lead.bucket), background: bucketColor(lead.bucket) + "22", borderRadius: "4px", padding: "2px 7px" } }, lead.bucket || "?"),
        lead.disposition && React.createElement("span", { style: { fontSize: "11px", color: "var(--t4)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" } }, lead.disposition.replace(/_/g, " "))
      )
    );

  const SectionHeader = ({ label, count, color }) =>
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px", padding: "6px 0", marginBottom: "8px" } },
      React.createElement("span", { style: { fontSize: "11px", fontWeight: "800", letterSpacing: "0.08em", color } }, label),
      React.createElement("span", { style: { fontSize: "11px", fontWeight: "700", background: color + "22", color, borderRadius: "10px", padding: "2px 8px" } }, count),
      React.createElement("div", { style: { flex: 1, height: "1px", background: "var(--border)" } })
    );

  const total = overdue.length + todayCBs.length;

  return React.createElement("div", { style: { flex: 1, overflowY: "auto", background: "var(--surface-2)", padding: "24px" } },
    React.createElement("div", { style: { maxWidth: "680px", margin: "0 auto" } },

      // v3.7 — Overdue emergency banner
      overdue.length > 0 && React.createElement("div", {
        style: {
          display: "flex", alignItems: "center", gap: "12px",
          padding: "12px 16px", marginBottom: "20px",
          background: "rgba(239,68,68,0.12)", border: "2px solid var(--red)",
          borderRadius: "10px", animation: "none"
        }
      },
        React.createElement("span", { style: { fontSize: "20px", flexShrink: 0 } }, "🚨"),
        React.createElement("div", { style: { flex: 1 } },
          React.createElement("div", { style: { fontSize: "13px", fontWeight: "800", color: "var(--red)", letterSpacing: "0.04em" } },
            overdue.length + " OVERDUE CALLBACK" + (overdue.length > 1 ? "S" : "") + " — ACT NOW"
          ),
          React.createElement("div", { style: { fontSize: "11px", color: "rgba(255,255,255,0.6)", marginTop: "2px" } },
            "These families are waiting. Dial them before anything else."
          )
        ),
        React.createElement("button", {
          onClick: () => {
            const ids = overdue.map(l => l.id);
            if (!ids.length) return;
            const s = { ids, idx: 0, total: ids.length, startedAt: new Date().toISOString() };
            setSession(s);
            setSessionPaused(false);
            try { localStorage.setItem(LS_SESSION, JSON.stringify(s)); } catch {}
            setOpenId(ids[0]); setView("dial"); setNoteText(""); setDetailTab("live");
          },
          style: {
            flexShrink: 0, padding: "8px 14px", background: "var(--red)", color: "#fff",
            border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "800",
            cursor: "pointer", whiteSpace: "nowrap"
          }
        }, "▶ Dial Now")
      ),

      // Header
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px" } },
        React.createElement("div", null,
          React.createElement("h2", { style: { margin: 0, fontSize: "17px", fontWeight: "800", color: "var(--t1)" } }, "📅 Callback Queue"),
          React.createElement("p", { style: { margin: "4px 0 0", fontSize: "12px", color: "var(--t3)" } },
            total > 0
              ? `${total} callback${total !== 1 ? "s" : ""} need attention today`
              : "No callbacks due — you're clear."
          )
        ),
        total > 0 && React.createElement("button", {
          onClick: () => {
            const ids = [...overdue, ...todayCBs].map(l => l.id);
            if (!ids.length) return;
            const s = { ids, idx: 0, total: ids.length, startedAt: new Date().toISOString() };
            setSession(s);
            setSessionPaused(false);
            try { localStorage.setItem(LS_SESSION, JSON.stringify(s)); } catch {}
            setOpenId(ids[0]); setView("dial"); setNoteText(""); setDetailTab("live");
          },
          style: { marginLeft: "auto", padding: "10px 20px", background: "var(--sky)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "800", cursor: "pointer" }
        }, "▶ Dial All Callbacks")
      ),

      // OVERDUE
      overdue.length > 0 && React.createElement(React.Fragment, null,
        React.createElement(SectionHeader, { label: "OVERDUE", count: overdue.length, color: "var(--red)" }),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" } },
          overdue.map(l => React.createElement(CBCard, { key: l.id, lead: l, isOverdue: true }))
        )
      ),

      // TODAY
      todayCBs.length > 0 && React.createElement(React.Fragment, null,
        React.createElement(SectionHeader, { label: "TODAY", count: todayCBs.length, color: "var(--sky)" }),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" } },
          todayCBs.map(l => React.createElement(CBCard, { key: l.id, lead: l, isOverdue: false }))
        )
      ),

      // UPCOMING (next 7 days)
      upcoming.length > 0 && React.createElement(React.Fragment, null,
        React.createElement(SectionHeader, { label: "UPCOMING (7 DAYS)", count: upcoming.length, color: "var(--t3)" }),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" } },
          upcoming.map(l => React.createElement(CBCard, { key: l.id, lead: l, isOverdue: false }))
        )
      ),

      // Empty state
      total === 0 && upcoming.length === 0 && React.createElement("div", { style: { textAlign: "center", padding: "60px 20px", color: "var(--t4)" } },
        React.createElement("div", { style: { fontSize: "48px", marginBottom: "12px" } }, "✅"),
        React.createElement("div", { style: { fontSize: "14px", fontWeight: "700", color: "var(--t3)" } }, "No callbacks scheduled"),
        React.createElement("div", { style: { fontSize: "12px", marginTop: "6px" } }, "Set callbacks on leads and they'll appear here.")
      )
    )
  );
}
