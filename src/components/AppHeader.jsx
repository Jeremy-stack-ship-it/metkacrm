import React from 'react';
import { goalTone } from '../lib/activityLog.js';

export default function AppHeader({
  view, navOpen, setNavOpen,
  activityStats, goals, stats,
  supaStatus, setView,
  setAddForm, fileRef, handleFile,
}) {
  const todayDials = activityStats?.today?.dials || 0;
  const dialGoal   = goals?.dials || 30; // v3.40 — matches DEFAULT_GOALS and DashboardTab
  const dialPct    = Math.min(todayDials / dialGoal, 1);
  const barColor   = dialPct < 0.5 ? '#DC2626' : dialPct < 0.8 ? '#F59E0B' : '#10B981';

  return React.createElement("header", {
    style: {
      background: "var(--surface)", padding: "0 24px", display: "flex",
      alignItems: "center", justifyContent: "space-between",
      height: "62px", flexShrink: 0, borderBottom: "1px solid var(--border)",
    }
  },

    // Brand / Title Area
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "12px" } },
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

    // Stats Strip (Centered)
    React.createElement("div", { style: { display: "flex", gap: "5px", alignItems: "center" } },

      // ── DIALS TILE — battery fill indicator ──────────────────────────────────
      React.createElement("button", {
        onClick: () => setView("activity"),
        title: todayDials + " / " + dialGoal + " dials today — " + Math.round(dialPct * 100) + "%",
        style: {
          position: "relative", overflow: "hidden",
          display: "flex", alignItems: "center", gap: "6px",
          padding: "7px 16px", borderRadius: "7px",
          background: "var(--surface-2)",
          border: "1.5px solid " + barColor + "60",
          cursor: "pointer", minWidth: "110px",
        }
      },
        // Battery fill — grows left-to-right
        React.createElement("div", {
          style: {
            position: "absolute", top: 0, left: 0, bottom: 0,
            width: (dialPct * 100) + "%",
            background: `linear-gradient(90deg, ${barColor}28, ${barColor}40)`,
            transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
            pointerEvents: "none",
          }
        }),
        // Count
        React.createElement("span", {
          style: {
            position: "relative", fontSize: "20px", fontWeight: "800",
            color: dialPct >= 1 ? barColor : dialPct > 0 ? barColor : "var(--t2)",
            lineHeight: 1, fontFamily: "'JetBrains Mono',monospace",
            transition: "color 0.4s ease",
          }
        }, "" + todayDials),
        // Goal + label stacked
        React.createElement("div", {
          style: { position: "relative", display: "flex", flexDirection: "column", gap: "1px" }
        },
          React.createElement("span", {
            style: { fontSize: "10px", fontWeight: "700", color: "var(--t3)", lineHeight: 1 }
          }, "/" + dialGoal),
          React.createElement("span", {
            style: { fontSize: "10px", fontWeight: "800", letterSpacing: "0.06em", color: barColor, lineHeight: 1 }
          }, "DIALS"),
        ),
        // Percentage badge — right edge
        React.createElement("span", {
          style: {
            position: "relative", marginLeft: "auto",
            fontSize: "10px", fontWeight: "700",
            color: barColor, opacity: 0.85,
          }
        }, Math.round(dialPct * 100) + "%"),
      ),

      // Contacts + Appts tiles (unchanged compact style)
      ...(() => {
        const td = activityStats?.today || { contacts: 0, appointments: 0 };
        return [
          { val: td.contacts,     goal: goals.contacts,     label: "CONTACTS" },
          { val: td.appointments, goal: goals.appointments, label: "APPTS"    },
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

      // Pipeline signals
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

    // Actions (right side)
    React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center" } },
      // v3.27 — cloud sync badge: error state expands to a visible warning strip
      supaStatus === "error"
        ? React.createElement("div", {
            title: "Cloud sync failed — changes are saved locally. Check your connection.",
            style: {
              display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px",
              borderRadius: "7px", cursor: "default",
              background: "rgba(239,68,68,0.15)",
              border: "1.5px solid #EF4444",
              animation: "none",
            }
          },
            React.createElement("span", { style: { fontSize: "11px" } }, "⚠️"),
            React.createElement("span", {
              style: { fontSize: "10px", fontWeight: "800", color: "#EF4444", letterSpacing: "0.3px" }
            }, "SYNC FAILED — LOCAL ONLY")
          )
        : React.createElement("div", {
            title: "Supabase — " + supaStatus,
            style: {
              display: "flex", alignItems: "center", gap: "4px", padding: "5px 9px",
              borderRadius: "7px",
              background: supaStatus === "ok" ? "var(--green-dim)" : supaStatus === "syncing" ? "var(--blue-dim)" : "var(--surface-2)",
              border: `1px solid ${supaStatus === "ok" ? "#6EE7B7" : supaStatus === "syncing" ? "var(--blue-mid)" : "var(--border)"}`,
            }
          },
            React.createElement("span", { style: { fontSize: "10px" } }, "☁"),
            React.createElement("span", {
              style: {
                fontSize: "10px", fontWeight: "700", letterSpacing: "0.3px",
                color: supaStatus === "ok" ? "var(--green)" : supaStatus === "syncing" ? "var(--blue)" : "var(--t3)",
              }
            }, supaStatus === "ok" ? "OK" : supaStatus === "syncing" ? "SYNC…" : "CLOUD")
          ),
      React.createElement("button", {
        onClick: () => setAddForm(v => !v),
        title: "Add lead manually",
        style: { padding: "6px 13px", fontSize: "11px", fontWeight: "700", background: "transparent", color: "var(--green)", border: "1.5px solid var(--green)", borderRadius: "7px", cursor: "pointer", letterSpacing: "0.4px" }
      }, "+ ADD"),
      React.createElement("button", {
        onClick: () => fileRef.current?.click(),
        title: "Import leads from CSV",
        style: { padding: "6px 13px", fontSize: "11px", fontWeight: "700", background: "var(--blue)", color: "#fff", border: "none", borderRadius: "7px", cursor: "pointer", letterSpacing: "0.4px" }
      }, "⬆ CSV"),
      React.createElement("input", { ref: fileRef, type: "file", accept: ".csv", onChange: handleFile, style: { display: "none" } })
    )
  );
}
