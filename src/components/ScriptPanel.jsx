import React from 'react';
import { inp, chip } from '../constants.js';

export default function ScriptPanel({
  lead,
  scripts,
  scriptType, setScriptType,
  scriptSection, setScriptSection,
  editingScript, setEditingScript,
  saveScripts,
  interpolate,
}) {
  const type = lead?.leadType || scriptType;
  const script = scripts[type] || scripts["Mortgage Protection"];
  const sections = Object.keys(script || {});

  return React.createElement("div", { style: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" } },

    // Header bar
    React.createElement("div", {
      style: {
        padding: "12px 24px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: "10px",
        background: "var(--surface)", position: "sticky", top: 0, zIndex: 5, flexShrink: 0,
      }
    },
      !lead && React.createElement("select", {
        value: scriptType,
        onChange: e => setScriptType(e.target.value),
        style: { ...inp(), fontSize: "12px", fontWeight: "600" },
      },
        Object.keys(scripts).map(t => React.createElement("option", { key: t, value: t }, t))
      ),
      lead && React.createElement("span", {
        style: {
          fontSize: "11px", fontWeight: "700", padding: "4px 12px", borderRadius: "20px",
          background: type.includes("Mortgage") ? "var(--blue-mid)" : "var(--green-dim)",
          color: type.includes("Mortgage") ? "#1D4ED8" : "var(--green)",
        }
      }, type),
      lead && React.createElement("span", { style: { fontSize: "11px", color: "var(--t3)", fontWeight: "500" } }, "for " + (lead.firstName || lead.name)),
      React.createElement("div", { style: { marginLeft: "auto", display: "flex", gap: "6px" } },
        sections.map(s =>
          React.createElement("button", {
            key: s,
            onClick: () => setScriptSection(s),
            style: { ...chip(scriptSection === s, "#2563EB"), fontSize: "10px", padding: "5px 14px", textTransform: "capitalize", margin: 0 },
          }, s)
        )
      )
    ),

    // Script body
    React.createElement("div", { style: { padding: "20px 24px", flex: 1 } },
      editingScript
        ? React.createElement("div", null,
            React.createElement("textarea", {
              defaultValue: (script || {})[scriptSection] || "",
              onChange: e => {
                const next = { ...scripts, [type]: { ...script, [scriptSection]: e.target.value } };
                setScriptType(type); // ensure type stays selected while editing
                saveScripts(next);
              },
              style: { ...inp(), width: "100%", minHeight: "340px", resize: "vertical", lineHeight: "1.75", fontSize: "12px", boxSizing: "border-box" },
            }),
            React.createElement("div", { style: { display: "flex", gap: "8px", marginTop: "10px" } },
              React.createElement("button", {
                onClick: () => { saveScripts(scripts); setEditingScript(false); },
                style: { padding: "7px 18px", background: "var(--green)", color: "#fff", border: "none", borderRadius: "7px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }
              }, "Save ✓"),
              React.createElement("button", {
                onClick: () => setEditingScript(false),
                style: { padding: "7px 14px", background: "var(--surface-2)", color: "var(--t2)", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12px", cursor: "pointer" }
              }, "Cancel")
            )
          )
        : React.createElement("div", null,
            React.createElement("pre", {
              style: {
                fontFamily: "'DM Sans',system-ui,sans-serif", fontSize: "13px", color: "#334155",
                lineHeight: "1.9", whiteSpace: "pre-wrap", background: "var(--surface-2)",
                padding: "24px", borderRadius: "12px", border: "1px solid var(--border)",
                maxHeight: "460px", overflowY: "auto",
              }
            }, interpolate((script || {})[scriptSection] || "No script for this section.", lead)),
            React.createElement("button", {
              onClick: () => setEditingScript(true),
              style: { marginTop: "12px", padding: "6px 16px", background: "transparent", color: "var(--t3)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "11px", cursor: "pointer", fontWeight: "600" }
            }, "✏️ Edit Script")
          )
    )
  );
}
