import React from 'react';
import { goalTone } from '../lib/activityLog.js';

export default function AppHeader({
  view, navOpen, setNavOpen,
  activityStats, goals, stats,
  supaStatus, setView,
  setAddForm, fileRef, handleFile,
  backupExists, restoreBackup,
}) {
  return React.createElement("header", {
    style: {
      background: "var(--surface)", padding: "0 24px", display: "flex",
      alignItems: "center", justifyContent: "space-between",
      height: "56px", flexShrink: 0, borderBottom: "1px solid var(--border)",
    }
  },

    // Brand / Title Area
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "12px" } },
      // Hamburger — only visible on dial view
      view === "dial" && React.createElement("button", {
        onClick: () => setNavOpen(o => !o),
        title: navOpen ? "Hide navigation" : "Show navigation",
        style: {
          background: "transparent", border: "1px solid var(--border)", borderRadius: "7px",
          width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "var(--t2)", fontSize: "16px", flexShrink: 0, transition: "background 0.15s",
        }
      }, navOpen ? "✕" : "☰"),
      React.createElement("span", {
        style: { fontFamily: "'Syne',sans-serif", fontWeight: "800", fontSize: "18px", color: "var(--navy)", letterSpacing: "2px" }
      }, "METKA"),
      React.createElement("span", { style: { width: "1px", height: "18px", background: "var(--border)", display: "inline-block" } }),
      React.createElement("span", {
        style: { fontSize: "10px", color: "var(--t3)", letterSpacing: "2px", fontWeight: "600" }
      }, "FIELD OPS"),
    ),

    // Stats Strip (Centered)
    React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center" } },
      // Accountability tiles
      ...(() => {
        const td = activityStats?.today || { dials: 0, contacts: 0, appointments: 0 };
        return [
          { val: td.dials,        goal: goals.dials,        label: "DIALS",    icon: "📞" },
          { val: td.contacts,     goal: goals.contacts,     label: "CONTACTS", icon: "☎" },
          { val: td.appointments, goal: goals.appointments, label: "APPTS",    icon: "📅" },
        ];
      })().map(t => {
        const tone = goalTone(t.val, t.goal);
        return React.createElement("button", {
          key: "act-" + t.label,
          onClick: () => setView("activity"),
          title: t.val + " / " + t.goal + " today — click for Activity dashboard",
          style: {
            display: "flex", alignItems: "center", gap: "8px", padding: "6px 14px",
            borderRadius: "8px", background: tone.bg, border: `1px solid ${tone.border}`,
            cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
          }
        },
          React.createElement("span", {
            style: { fontSize: "16px", fontWeight: "800", color: tone.c, lineHeight: 1, fontFamily: "'JetBrains Mono',monospace" }
          }, "" + t.val),
          React.createElement("span", {
            style: { fontSize: "10px", color: tone.c, fontWeight: "700", lineHeight: 1, fontFamily: "'JetBrains Mono',monospace", opacity: 0.7 }
          }, "/" + t.goal),
          React.createElement("span", {
            style: { fontSize: "9px", color: tone.c, letterSpacing: "1px", fontWeight: "700", lineHeight: "1" }
          }, t.label)
        );
      }),

      // Divider
      React.createElement("div", { style: { width: "1px", height: "22px", background: "var(--border)", margin: "0 4px" } }),

      // Pipeline tiles
      ...[
        [stats.hot,      "HOT",      "#2563EB",                                  "var(--blue-dim)"],
        [stats.cbToday,  "CB TODAY", "#0EA5E9",                                  "var(--sky-dim)"],
        [stats.overdue,  "OVERDUE",  stats.overdue  > 0 ? "#DC2626" : "var(--t3)", stats.overdue  > 0 ? "var(--red-dim)"  : "var(--surface-2)"],
        [stats.pipe,     "PIPELINE", "#8B5CF6",                                  "#EDE9FE"],
        [stats.uwStuck,  "UW STUCK", stats.uwStuck  > 0 ? "#DC2626" : "var(--t3)", stats.uwStuck  > 0 ? "var(--red-dim)"  : "var(--surface-2)"],
        [stats.issued,   "ISSUED",   "#059669",                                  "var(--green-dim)"],
      ].map(([v, l, c, bg]) =>
        React.createElement("div", {
          key: l,
          style: {
            display: "flex", alignItems: "center", gap: "8px", padding: "6px 14px",
            borderRadius: "8px", background: bg, border: "1px solid " + c + "25",
          }
        },
          React.createElement("span", {
            style: { fontSize: "16px", fontWeight: "800", color: c, lineHeight: 1, fontFamily: "'DM Sans',sans-serif" }
          }, "" + v),
          React.createElement("span", {
            style: { fontSize: "9px", color: c, letterSpacing: "1px", fontWeight: "700", lineHeight: "1" }
          }, l)
        )
      ),
    ),

    // Actions (right side)
    React.createElement("div", { style: { display: "flex", gap: "8px", alignItems: "center" } },
      // Cloud status
      React.createElement("div", {
        title: "Supabase cloud storage — " + supaStatus,
        style: {
          display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px",
          borderRadius: "8px",
          background: supaStatus === "ok" ? "var(--green-dim)" : supaStatus === "syncing" ? "var(--blue-dim)" : supaStatus === "error" ? "var(--red-dim)" : "var(--surface-2)",
          border: `1px solid ${supaStatus === "ok" ? "#6EE7B7" : supaStatus === "syncing" ? "var(--blue-mid)" : supaStatus === "error" ? "#FCA5A5" : "var(--border)"}`,
          cursor: "default",
        }
      },
        React.createElement("span", { style: { fontSize: "10px" } }, "☁"),
        React.createElement("span", {
          style: {
            fontSize: "10px", fontWeight: "700", letterSpacing: "0.4px",
            color: supaStatus === "ok" ? "var(--green)" : supaStatus === "syncing" ? "var(--blue)" : supaStatus === "error" ? "var(--red)" : "var(--t3)",
          }
        }, supaStatus === "ok" ? "CLOUD OK" : supaStatus === "syncing" ? "SYNCING…" : supaStatus === "error" ? "CLOUD ERR" : "CLOUD")
      ),
      React.createElement("button", {
        onClick: () => setAddForm(v => !v),
        style: { padding: "8px 16px", fontSize: "11px", fontWeight: "700", background: "transparent", color: "var(--green)", border: "1.5px solid var(--green)", borderRadius: "8px", cursor: "pointer", letterSpacing: "0.5px" }
      }, "+ ADD"),
      React.createElement("button", {
        onClick: () => fileRef.current?.click(),
        style: { padding: "8px 16px", fontSize: "11px", fontWeight: "700", background: "var(--blue)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", letterSpacing: "0.5px" }
      }, "⬆ IMPORT CSV"),
      backupExists && React.createElement("button", {
        onClick: () => { if (window.confirm("Restore your pre-import backup? This will replace current leads.")) restoreBackup(); },
        style: { padding: "8px 14px", fontSize: "11px", fontWeight: "700", background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid var(--amber)", borderRadius: "8px", cursor: "pointer", letterSpacing: "0.5px" }
      }, "↩ RESTORE BACKUP"),
      React.createElement("input", { ref: fileRef, type: "file", accept: ".csv", onChange: handleFile, style: { display: "none" } })
    )
  );
}
