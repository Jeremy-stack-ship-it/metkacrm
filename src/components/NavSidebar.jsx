import React from 'react';

const NAV_ITEMS = [
  { id: "dashboard", icon: "🏠", label: "DASH" },
  { id: "today",     icon: "⚡", label: "TODAY" },
  { id: "callbacks", icon: "📅", label: "CB" },
  { id: "dial",      icon: "🎙", label: "DIAL" },
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
      alignItems: "center", padding: "24px 0", gap: "32px", zIndex: 20,
      borderRight: "1px solid var(--navy-3)", flexShrink: 0,
    }
  },
    React.createElement("div", {
      style: { color: "#fff", fontWeight: "800", fontSize: "12px", letterSpacing: "1.5px", fontFamily: "'Syne',sans-serif" }
    }, "CRM"),

    React.createElement("div", {
      style: { display: "flex", flexDirection: "column", gap: "12px", width: "100%", padding: "0 8px" }
    },
      ...NAV_ITEMS.map(v =>
        React.createElement("button", {
          key: v.id,
          onClick: () => setView(v.id),
          style: {
            width: "100%", padding: "12px 0", borderRadius: "10px", border: "none",
            background: view === v.id ? "var(--blue)" : "transparent",
            color: view === v.id ? "#fff" : "var(--t3)",
            cursor: "pointer", transition: "0.15s ease",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
          }
        },
          React.createElement("span", { style: { fontSize: "16px", lineHeight: 1 } }, v.icon),
          React.createElement("span", { style: { fontSize: "8px", fontWeight: "700", letterSpacing: "1px" } }, v.label)
        )
      )
    )
  );
}
