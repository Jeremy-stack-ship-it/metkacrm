import React from 'react';
import { inp, BL } from '../constants.js';

export default function AddLeadForm({
  addForm,
  newL, setNewL,
  scripts,
  addLead,
  setAddForm,
  dupeLead, setDupeLead,
  setOpenId, setView,
}) {
  if (!addForm) return null;

  return React.createElement("div", {
    style: {
      background: "var(--surface)", borderBottom: "1px solid var(--border)",
      padding: "12px 24px", display: "flex", gap: "10px", alignItems: "center",
      flexShrink: 0, flexWrap: "wrap",
    }
  },
    React.createElement("span", { style: { fontSize: "11px", fontWeight: "700", color: "var(--t2)", letterSpacing: "0.5px" } }, "New Lead"),
    React.createElement("span", { style: { color: "var(--border-2)" } }, "·"),

    ...[ ["name", "Full Name", "170px"], ["phone", "Phone", "140px"], ["state", "ST", "48px"] ].map(([f, ph, w]) =>
      React.createElement("input", {
        key: f, placeholder: ph,
        value: newL[f],
        onChange: e => setNewL(p => ({ ...p, [f]: e.target.value })),
        style: { ...inp(), width: w },
      })
    ),

    React.createElement("select", {
      value: newL.bucket,
      onChange: e => setNewL(p => ({ ...p, bucket: e.target.value })),
      style: { ...inp(), width: "92px" },
    },
      ["A", "B", "C"].map(b => React.createElement("option", { key: b, value: b }, BL[b]))
    ),

    React.createElement("select", {
      value: newL.leadType,
      onChange: e => setNewL(p => ({ ...p, leadType: e.target.value })),
      style: { ...inp(), width: "180px" },
    },
      Object.keys(scripts).map(t => React.createElement("option", { key: t, value: t }, t))
    ),

    newL.leadType === "Living Benefits Lead" && React.createElement("input", {
      placeholder: "Hobby / Interest",
      value: newL.hobby || "",
      onChange: e => setNewL(p => ({ ...p, hobby: e.target.value })),
      style: { ...inp(), width: "160px" },
      title: "Hobby or interest for Day 1 opener",
    }),

    React.createElement("button", {
      onClick: addLead,
      style: { padding: "8px 20px", background: "var(--blue)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }
    }, "Add →"),

    React.createElement("button", {
      onClick: () => { setAddForm(false); setDupeLead(null); },
      style: { background: "none", border: "none", color: "var(--t4)", cursor: "pointer", fontSize: "20px", lineHeight: 1 }
    }, "×"),

    dupeLead && React.createElement("div", {
      style: {
        width: "100%", padding: "8px 14px", background: "var(--amber-dim)",
        border: "1px solid var(--amber)", borderRadius: "8px", fontSize: "12px",
        fontWeight: "600", color: "var(--amber)", display: "flex", alignItems: "center",
        gap: "10px", flexWrap: "wrap",
      }
    },
      "⚠ Lead already exists: " + dupeLead.name + " (" + dupeLead.phone + ")",
      React.createElement("button", {
        onClick: () => { setOpenId(dupeLead.id); setView("queue"); setAddForm(false); setDupeLead(null); },
        style: { marginLeft: "auto", padding: "4px 12px", background: "var(--amber)", color: "#fff", border: "none", borderRadius: "6px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }
      }, "→ Open Existing Lead")
    )
  );
}
