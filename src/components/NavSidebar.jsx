import React from 'react';

const NAV_ITEMS = [
  { id: "dashboard", icon: "🏠", label: "DASH" },
  { id: "today",     icon: "⚡", label: "TODAY" },
  { id: "callbacks",     icon: "📞", label: "CB" },
  { id: "appointments", icon: "📅", label: "APPTS" },
  { id: "cc",           icon: "📧", label: "CC" },
  { id: "sequence",     icon: "🔁", label: "SEQ" },
  { id: "dial",          icon: "🎙", label: "DIAL" },
  { id: "activity",  icon: "🎯", label: "ACT" },
  { id: "contacts",  icon: "📇", label: "DATA" },
  { id: "pipeline",  icon: "📊", label: "PIPE" },
  { id: "scripts",   icon: "📝", label: "SCRIPT" },
  { id: "templates", icon: "💬", label: "SMS" },
  { id: "settings",  icon: "⚙️", label: "SET" },
];

export default function NavSidebar({ view, setView, navOpen }) {
  if (!navOpen) return null;

  return React.createElement("aside", {
    style: {
      width: "68px", background: "var(--navy)", display: "flex", flexDirection: "column",
      alignItems: "center", padding: "24px 0", gap: "28px", zIndex: 20,
      borderRight: "1px solid var(--navy-3)", flexShrink: 0,
    }
  },
    React.createElement("div", {
      style: { color: "#fff", fontWeight: "700", fontSize: "11px", letterSpacing: "0.08em", fontFamily: "'Inter',sans-serif" }
    }, "CRM"),

    React.createElement("div", {
      style: { display: "flex", flexDirection: "column", gap: "4px", width: "100%", padding: "0 8px" }
    },
      ...NAV_ITEMS.map(v =>
        React.createElement("button", {
          key: v.id,
          onClick: () => setView(v.id),
          style: {
            width: "100%", padding: "10px 0", borderRadius: "8px", border: "none",
            background: view === v.id ? "var(--blue)" : "transparent",
            color: view === v.id ? "#fff" : "rgba(255,255,255,0.5)",
            cursor: "pointer", transition: "background 0.15s, color 0.15s",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
          },
          onMouseEnter: e => { if (view !== v.id) e.currentTarget.style.color = "rgba(255,255,255,0.85)"; },
          onMouseLeave: e => { if (view !== v.id) e.currentTarget.style.color = "rgba(255,255,255,0.5)"; },
        },
          React.createElement("span", { style: { fontSize: "15px", lineHeight: 1 } }, v.icon),
          React.createElement("span", { style: { fontSize: "9px", fontWeight: "600", letterSpacing: "0.06em" } }, v.label)
        )
      )
    )
  );
}

