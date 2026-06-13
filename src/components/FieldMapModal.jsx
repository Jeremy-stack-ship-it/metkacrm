import React from 'react';
import { inp, FIELD_MAP_DEFS } from '../constants.js';
import { autoDetectMapping } from '../lib/csvParser.js';

export default function FieldMapModal({
  csvHeaders,
  fieldMapDraft, setFieldMapDraft,
  saveMappingCb, setSaveMappingCb,
  savedMapping,
  confirmFieldMapping,
  onClose,
}) {
  return React.createElement("div", {
    style: { position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }
  },
    React.createElement("div", {
      style: { background:"var(--surface)", borderRadius:"16px", padding:"28px 32px", maxWidth:"560px", width:"95%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,0.22)" }
    },
      // Header
      React.createElement("div", { style:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"4px" } },
        React.createElement("div", { style:{ fontSize:"17px", fontWeight:"700", color:"var(--t1)", fontFamily:"'Syne',sans-serif" } }, "Map CSV Fields"),
        React.createElement("button", { onClick: onClose, style:{ background:"none", border:"none", color:"var(--t4)", cursor:"pointer", fontSize:"22px", lineHeight:1, padding:"0" } }, "×")
      ),
      React.createElement("div", { style:{ fontSize:"11px", color:"var(--t3)", marginBottom:"20px" } },
        csvHeaders.length + " columns detected · Match each CRM field to the correct CSV column"
      ),

      // Field rows
      React.createElement("div", { style:{ display:"flex", flexDirection:"column", gap:"6px", marginBottom:"20px" } },
        React.createElement("div", { style:{ fontSize:"11pxpx", fontWeight:"800", color:"var(--t4)", letterSpacing:"1.2px", marginBottom:"2px" } }, "REQUIRED"),
        ...FIELD_MAP_DEFS.filter(f => f.required).map(f =>
          React.createElement("div", { key:f.key, style:{ display:"grid", gridTemplateColumns:"160px 1fr", gap:"10px", alignItems:"center", padding:"8px 12px", background:"var(--blue-dim)", borderRadius:"8px", border:"1px solid var(--blue-mid)" } },
            React.createElement("div", { style:{ fontSize:"12px", fontWeight:"700", color:"var(--blue)" } }, "★ " + f.label),
            React.createElement("select", {
              value: fieldMapDraft[f.key] ?? -1,
              onChange: ev => setFieldMapDraft(d => ({ ...d, [f.key]: parseInt(ev.target.value) })),
              style: { ...inp(), fontSize:"12px", fontFamily:"'JetBrains Mono',monospace", padding:"6px 8px" }
            },
              React.createElement("option", { value:-1 }, "— not mapped —"),
              csvHeaders.map((h, i) => React.createElement("option", { key:i, value:i }, h))
            )
          )
        ),
        React.createElement("div", { style:{ fontSize:"11pxpx", fontWeight:"800", color:"var(--t4)", letterSpacing:"1.2px", marginTop:"10px", marginBottom:"2px" } }, "OPTIONAL"),
        ...FIELD_MAP_DEFS.filter(f => !f.required).map(f =>
          React.createElement("div", { key:f.key, style:{ display:"grid", gridTemplateColumns:"160px 1fr", gap:"10px", alignItems:"center", padding:"7px 12px", background:fieldMapDraft[f.key]>-1?"var(--surface-2)":"var(--surface)", borderRadius:"8px", border:"1px solid var(--border)" } },
            React.createElement("div", { style:{ fontSize:"12px", fontWeight:"600", color:fieldMapDraft[f.key]>-1?"var(--t1)":"var(--t3)" } }, f.label),
            React.createElement("select", {
              value: fieldMapDraft[f.key] ?? -1,
              onChange: ev => setFieldMapDraft(d => ({ ...d, [f.key]: parseInt(ev.target.value) })),
              style: { ...inp(), fontSize:"12px", fontFamily:"'JetBrains Mono',monospace", padding:"6px 8px", opacity:fieldMapDraft[f.key]>-1?1:0.6 }
            },
              React.createElement("option", { value:-1 }, "— skip —"),
              csvHeaders.map((h, i) => React.createElement("option", { key:i, value:i }, h))
            )
          )
        )
      ),

      // Save mapping checkbox
      React.createElement("label", { style:{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"20px", cursor:"pointer", fontSize:"12px", color:"var(--t2)", fontWeight:"600" } },
        React.createElement("input", { type:"checkbox", checked:saveMappingCb, onChange:e=>setSaveMappingCb(e.target.checked), style:{ width:"15px", height:"15px", accentColor:"var(--blue)", cursor:"pointer" } }),
        "Save this mapping — auto-apply next time I import a Quility CSV",
        savedMapping.phone && React.createElement("span", { style:{ fontSize:"11pxpx", color:"var(--green)", fontWeight:"700", marginLeft:"4px" } }, "(saved ✓)")
      ),

      // Actions
      React.createElement("div", { style:{ display:"flex", gap:"10px" } },
        React.createElement("button", {
          onClick: confirmFieldMapping,
          disabled: (fieldMapDraft.phone ?? -1) < 0,
          style: { flex:1, padding:"12px", background:(fieldMapDraft.phone??-1)>=0?"var(--blue)":"var(--surface-2)", color:(fieldMapDraft.phone??-1)>=0?"#fff":"var(--t4)", border:"none", borderRadius:"9px", fontSize:"13px", fontWeight:"700", cursor:(fieldMapDraft.phone??-1)>=0?"pointer":"not-allowed" }
        }, "Continue to Import Preview →"),
        React.createElement("button", {
          onClick: () => {
            const auto = autoDetectMapping(csvHeaders.map(h => h.toLowerCase()));
            const reset = {};
            [...FIELD_MAP_DEFS.map(f => f.key), "score","tier","daysOld","flags","rationale","leadLevel","importStage"].forEach(k => { reset[k] = auto[k] ?? -1; });
            setFieldMapDraft(reset);
          },
          style: { padding:"12px 16px", background:"none", border:"1px solid var(--border)", borderRadius:"9px", fontSize:"12px", fontWeight:"600", cursor:"pointer", color:"var(--t3)" }
        }, "↺ Reset")
      )
    )
  );
}
