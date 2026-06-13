import React from 'react';
import { inp } from '../constants.js';

export default function ImportModal({
  importPreview,
  leads,
  replaceConfirm, setReplaceConfirm,
  confirmImport,
  onClose,
}) {
  if (!importPreview) return null;

  return React.createElement("div", {
    style: { position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }
  },
    React.createElement("div", {
      style: { background:"var(--surface)", borderRadius:"16px", padding:"32px", maxWidth:"500px", width:"92%", boxShadow:"0 24px 64px rgba(0,0,0,0.22)" }
    },
      // Header
      React.createElement("div", { style:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"6px" } },
        React.createElement("div", { style:{ fontSize:"17px", fontWeight:"700", color:"var(--t1)", fontFamily:"'Syne',sans-serif" } }, "Import Leads"),
        React.createElement("button", { onClick: onClose, style:{ background:"none", border:"none", color:"var(--t4)", cursor:"pointer", fontSize:"22px", lineHeight:1, padding:"0" } }, "×")
      ),

      // Impact line
      React.createElement("div", { style:{ fontSize:"12px", color:"var(--t3)", marginBottom:"20px" } },
        "Currently: ", React.createElement("strong", { style:{ color:"var(--t1)" } }, "" + leads.length + " leads"),
        " → After adding new: ", React.createElement("strong", { style:{ color:"var(--green)" } }, (leads.length + importPreview.newLeads.length) + " leads")
      ),

      // Stat tiles
      React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px", marginBottom:"16px" } },
        [["In File", importPreview.all.length, "var(--blue)"], ["New", importPreview.newLeads.length, "var(--green)"], ["Already Exist", importPreview.dupes.length, "var(--t3)"]].map(([l, v, c]) =>
          React.createElement("div", { key:l, style:{ textAlign:"center", padding:"14px 10px", background:"var(--surface-2)", borderRadius:"10px", border:"1px solid var(--border)" } },
            React.createElement("div", { style:{ fontSize:"24px", fontWeight:"800", color:c, fontFamily:"'Syne',sans-serif" } }, v),
            React.createElement("div", { style:{ fontSize:"11pxpx", color:"var(--t3)", marginTop:"4px", letterSpacing:"0.5px" } }, l)
          )
        )
      ),

      // Backup notice
      React.createElement("div", { style:{ fontSize:"11px", color:"var(--green)", marginBottom:"20px", background:"var(--green-dim)", padding:"10px 14px", borderRadius:"8px", fontWeight:"600" } },
        "✓ Auto-backup will be saved before import. Use ↩ RESTORE BACKUP to undo anytime."
      ),

      // Primary action
      React.createElement("button", {
        onClick: () => confirmImport("append"),
        style: { display:"block", width:"100%", padding:"13px", background:"var(--blue)", color:"#fff", border:"none", borderRadius:"9px", fontSize:"14px", fontWeight:"700", cursor:"pointer", marginBottom:"16px" }
      }, "✓ Add " + importPreview.newLeads.length + " New Leads  (" + leads.length + " → " + (leads.length + importPreview.newLeads.length) + ")"),

      // v3.45 — Funnel Sync (mode 3): status-diff existing leads + add new.
      // Never downgrades; DNC always wins; conflicts kept + reported.
      importPreview.dupes.length > 0 && React.createElement("button", {
        onClick: () => confirmImport("sync"),
        style: { display:"block", width:"100%", padding:"13px", background:"var(--green)", color:"#fff", border:"none", borderRadius:"9px", fontSize:"14px", fontWeight:"700", cursor:"pointer", marginBottom:"6px" }
      }, "🔁 Sync from Funnel — update " + importPreview.dupes.length + " existing + add " + importPreview.newLeads.length + " new"),
      importPreview.dupes.length > 0 && React.createElement("div", { style:{ fontSize:"11pxpx", color:"var(--t3)", marginBottom:"16px", lineHeight:"1.5" } },
        "Promotes statuses only (never downgrades your work). DNC always applies. Conflicts kept + listed in console."),

      // Danger zone
      React.createElement("details", { style:{ borderRadius:"8px", border:"1px solid var(--red-dim)", overflow:"hidden" } },
        React.createElement("summary", { style:{ padding:"10px 14px", fontSize:"11px", fontWeight:"700", color:"var(--red)", cursor:"pointer", background:"var(--red-dim)", letterSpacing:"0.5px" } }, "⚠ Danger Zone — Replace All"),
        React.createElement("div", { style:{ padding:"14px", background:"var(--surface-2)" } },
          React.createElement("div", { style:{ fontSize:"11px", color:"var(--t2)", marginBottom:"10px", lineHeight:"1.6" } },
            "This will DELETE your current ", React.createElement("strong", null, "" + leads.length + " leads"),
            " and replace with only the ", React.createElement("strong", null, "" + importPreview.all.length),
            " leads in this file. Type ", React.createElement("strong", null, "" + importPreview.all.length), " to confirm."
          ),
          React.createElement("div", { style:{ display:"flex", gap:"8px" } },
            React.createElement("input", {
              value: replaceConfirm,
              onChange: e => setReplaceConfirm(e.target.value),
              placeholder: "Type " + importPreview.all.length + " to confirm",
              style: { ...inp(), flex:1, fontSize:"13px", fontFamily:"'JetBrains Mono',monospace", borderColor:replaceConfirm===String(importPreview.all.length)?"var(--red)":"var(--border)" }
            }),
            React.createElement("button", {
              disabled: replaceConfirm !== String(importPreview.all.length),
              onClick: () => confirmImport("replace"),
              style: { padding:"8px 16px", background:replaceConfirm===String(importPreview.all.length)?"var(--red)":"var(--surface)", color:replaceConfirm===String(importPreview.all.length)?"#fff":"var(--t4)", border:"1px solid var(--border)", borderRadius:"8px", fontSize:"12px", fontWeight:"700", cursor:replaceConfirm===String(importPreview.all.length)?"pointer":"not-allowed" }
            }, "Replace All")
          )
        )
      )
    )
  );
}
