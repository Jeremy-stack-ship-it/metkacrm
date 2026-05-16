import React from 'react';
import { goalTone } from '../lib/activityLog.js';

export default function AppHeader({
  view, navOpen, setNavOpen,
  activityStats, goals, stats,
  supaStatus, setView,
  setAddForm, fileRef, handleFile,
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
        style: { fontFamily: "'Syne',sans-serif", fontWeight: "800", fontSize: "18px", color: "var(--navy)", letterSpacing: "0.08em" }
      }, "METKA"),
      React.createElement("span", { style: { width: "1px", height: "18px", background: "var(--border)", display: "inline-block" } }),
      React.createElement("span", {
        style: { fontSize: "11px", color: "var(--t3)", letterSpacing: "0.08em", fontWeight: "600" }
      }, "FIELD OPS"),
    ),

    // Stats Strip (Centered) — Today's activity + critical pipeline signals only
    React.createElement("div", { style: { display: "flex", gap: "5px", alignItems: "center" } },

      // Today's accountability tiles (compact)
      ...(() => {
        const td = activityStats?.today || { dials: 0, contacts: 0, appointments: 0 };
        return [
          { val: td.dials,        goal: goals.dials,        label: "DIALS" },
          { val: td.contacts,     goal: goals.contacts,     label: "CONTACTS" },
          { val: td.appointments, goal: goals.appointments, label: "APPTS" },
        ];
      })().map(t => {
        const tone = goalTone(t.val, t.goal);
        return React.createElement("button", {
          key: "act-" + t.label,
          onClick: () => setView("activity"),
          title: t.val + " / " + t.goal + " today",
          style: {
            display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px",
            borderRadius: "7px", background: tone.bg, border: `1px solid ${tone.border}`,
            cursor: "pointer",
          }
        },
          React.createElement("span", {
            style: { fontSize: "14px", fontWeight: "800", color: tone.c, lineHeight: 1, fontFamily: "'JetBrains Mono',monospace" }
          }, "" + t.val),
          React.createElement("span", {
            style: { fontSize: "10px", color: tone.c, fontWeight: "700", opacity: 0.65 }
          }, "/" + t.goal),
          React.createElement("span", {
            style: { fontSize: "10px", color: tone.c, letterSpacing: "0.05em", fontWeight: "700" }
          }, t.label)
        );
      }),

      // Divider
      React.createElement("div", { style: { width: "1px", height: "20px", background: "var(--border)", margin: "0 3px" } }),

      // Critical pipeline signals only — CB TODAY, OVERDUE, UW STUCK
      ...[
        [stats.cbToday, "CB TODAY", "#0EA5E9",   "var(--sky-dim)"],
        [stats.overdue, "OVERDUE",  stats.overdue  > 0 ? "#DC2626" : "var(--t3)", stats.overdue  > 0 ? "var(--red-dim)" : "var(--surface-2)"],
        [stats.uwStuck, "UW STUCK", stats.uwStuck  > 0 ? "#DC2626" : "var(--t3)", stats.uwStuck  > 0 ? "var(--red-dim)" : "var(--surface-2)"],
      ].map(([v, l, c, bg]) =>
        React.createElement("div", {
          key: l,
          style: {
            display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px",
            borderRadius: "7px", background: bg, border: "1px solid " + c + "30",
          }
        },
          React.createElement("span", {
            style: { fontSize: "14px", fontWeight: "800", color: c, lineHeight: 1, fontFamily: "'JetBrains Mono',monospace" }
          }, "" + v),
          React.createElement("span", {
            style: { fontSize: "10px", color: c, letterSpacing: "0.05em", fontWeight: "700" }
          }, l)
        )
      ),
    ),

    // Actions (right side) — compact
    React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center" } },
      // Cloud sync badge
      React.createElement("div", {
        title: "Supabase — " + supaStatus,
        style: {
          display: "flex", alignItems: "center", gap: "4px", padding: "5px 9px",
          borderRadius: "7px",
          background: supaStatus === "ok" ? "var(--green-dim)" : supaStatus === "syncing" ? "var(--blue-dim)" : supaStatus === "error" ? "var(--red-dim)" : "var(--surface-2)",
          border: `1px solid ${supaStatus === "ok" ? "#6EE7B7" : supaStatus === "syncing" ? "var(--blue-mid)" : supaStatus === "error" ? "#FCA5A5" : "var(--border)"}`,
        }
      },
        React.createElement("span", { style: { fontSize: "10px" } }, "☁"),
        React.createElement("span", {
          style: {
            fontSize: "10px", fontWeight: "700", letterSpacing: "0.3px",
            color: supaStatus === "ok" ? "var(--green)" : supaStatus === "syncing" ? "var(--blue)" : supaStatus === "error" ? "var(--red)" : "var(--t3)",
          }
        }, supaStatus === "ok" ? "OK" : supaStatus === "syncing" ? "SYNC…" : supaStatus === "error" ? "ERR" : "CLOUD")
      ),
      // Add lead
      React.createElement("button", {
        onClick: () => setAddForm(v => !v),
        title: "Add lead manually",
        style: { padding: "6px 13px", fontSize: "11px", fontWeight: "700", background: "transparent", color: "var(--green)", border: "1.5px solid var(--green)", borderRadius: "7px", cursor: "pointer", letterSpacing: "0.4px" }
      }, "+ ADD"),
      // Import CSV
      React.createElement("button", {
        onClick: () => fileRef.current?.click(),
        title: "Import leads from CSV",
        style: { padding: "6px 13px", fontSize: "11px", fontWeight: "700", background: "var(--blue)", color: "#fff", border: "none", borderRadius: "7px", cursor: "pointer", letterSpacing: "0.4px" }
      }, "⬆ CSV"),
      React.createElement("input", { ref: fileRef, type: "file", accept: ".csv", onChange: handleFile, style: { display: "none" } })
    )
  );
}
