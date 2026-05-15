// ── SCRIPTS VIEW ──────────────────────────────────────────────────
import React from 'react';
import { inp } from '../constants.js';
import ScriptPanel from './ScriptPanel.jsx';

export default function ScriptsView({
  scripts, saveScripts,
  scriptType, setScriptType,
  scriptSection, setScriptSection,
  editingScript, setEditingScript,
  interpolate,
}) {
  return React.createElement("div", { style: { flex: 1, display: "flex", overflow: "hidden" } },

    React.createElement("div", { style: { width: "230px", borderRight: "1px solid var(--border)", background: "var(--surface-2)", overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column" } },
      React.createElement("div", { style: { padding: "16px 20px", borderBottom: "1px solid var(--border)", fontSize: "10px", fontWeight: "800", color: "var(--t3)", letterSpacing: "1.5px" } }, "SCRIPT LIBRARY"),
      React.createElement("div", { style: { flex: 1 } },
        Object.keys(scripts).map(type =>
          React.createElement("div", {
            key: type,
            style: { display: "flex", alignItems: "center", borderBottom: "1px solid var(--border)", background: scriptType === type ? "var(--surface)" : "transparent", borderLeft: scriptType === type ? "4px solid var(--blue)" : "4px solid transparent", transition: "all 0.1s ease" }
          },
            React.createElement("div", { onClick: () => { setScriptType(type); setScriptSection(Object.keys(scripts[type])[0]); }, style: { flex: 1, padding: "12px 16px", cursor: "pointer" } },
              React.createElement("div", { style: { fontSize: "13px", fontWeight: "700", color: "var(--t1)" } }, "" + type),
              React.createElement("div", { style: { fontSize: "11px", color: "var(--t3)", marginTop: "2px", fontWeight: "500" } }, Object.keys(scripts[type]).length + " sections")
            ),
            React.createElement("button", { onClick: () => { if (window.confirm("Delete \"" + type + "\"?")) { const next = { ...scripts }; delete next[type]; saveScripts(next); } }, style: { background: "none", border: "none", color: "var(--red)", fontSize: "14px", cursor: "pointer", padding: "8px 10px", flexShrink: 0 } }, "×")
          )
        )
      ),
      React.createElement("div", { style: { padding: "12px", borderTop: "1px solid var(--border)" } },
        React.createElement("input", { id: "new-script-cat", placeholder: "New category name...", style: { ...inp(), width: "100%", fontSize: "12px", padding: "8px 10px", marginBottom: "6px", boxSizing: "border-box" } }),
        React.createElement("button", {
          onClick: () => {
            const el = document.getElementById("new-script-cat");
            const name = (el.value || "").trim();
            if (!name) return;
            const next = { ...scripts, [name]: { phone: "Phone script here...", appointment: "Appointment script here...", objections: "Objections here..." } };
            saveScripts(next); el.value = ""; setScriptType(name);
          },
          style: { width: "100%", padding: "8px", background: "var(--blue)", color: "#fff", border: "none", borderRadius: "7px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }
        }, "+ Add Category")
      )
    ),

    React.createElement(ScriptPanel, {
      lead: null, key: scriptType,
      scripts, scriptType, setScriptType,
      scriptSection, setScriptSection,
      editingScript, setEditingScript,
      saveScripts, interpolate,
    })
  );
}
