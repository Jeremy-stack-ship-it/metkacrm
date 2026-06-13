import React, { useState } from 'react';

const PASSWORD    = import.meta.env.VITE_CRM_PASSWORD;
const SESSION_KEY = "metka-auth-v1";
const SESSION_TTL = 1000 * 60 * 60 * 12;

export function useAuth() {
  const [authed, setAuthed] = useState(() => {
    try {
      const s = localStorage.getItem(SESSION_KEY);
      if (!s) return false;
      const { expires } = JSON.parse(s);
      return Date.now() < expires;
    } catch { return false; }
  });
  return [authed, () => setAuthed(true)];
}

export default function LoginGate({ onAuth }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);

  const submit = () => {
    if (pw === PASSWORD) {
      const expires = Date.now() + SESSION_TTL;
      localStorage.setItem(SESSION_KEY, JSON.stringify({ expires }));
      onAuth();
    } else {
      setError(true); setPw("");
      setTimeout(() => setError(false), 2000);
    }
  };

  return React.createElement("div", { style: { height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" } },
    React.createElement("div", { style: { background: "var(--surface)", borderRadius: "16px", padding: "52px 44px 44px", width: "380px", boxShadow: "0 20px 60px rgba(0,0,0,0.08),0 4px 16px rgba(0,0,0,0.04)", border: "1px solid var(--border)" } },
      React.createElement("div", { style: { marginBottom: "40px", textAlign: "center" } },
        React.createElement("div", { style: { fontFamily: "'Syne',sans-serif", fontWeight: "800", fontSize: "26px", letterSpacing: "7px", color: "var(--navy)", marginBottom: "8px" } }, "METKA"),
        React.createElement("div", { style: { fontSize: "11pxpx", color: "var(--t3)", letterSpacing: "3px", fontWeight: "500" } }, "FIELD OPS CRM")
      ),
      React.createElement("div", { style: { marginBottom: "20px" } },
        React.createElement("label", { style: { fontSize: "11px", fontWeight: "600", color: "var(--t2)", letterSpacing: "1px", display: "block", marginBottom: "8px" } }, "PASSWORD"),
        React.createElement("div", { style: { position: "relative" } },
          React.createElement("input", {
            type: show ? "text" : "password", value: pw,
            onChange: e => setPw(e.target.value),
            onKeyDown: e => e.key === "Enter" && submit(),
            placeholder: "Enter password", autoFocus: true,
            style: { width: "100%", padding: "12px 44px 12px 14px", fontSize: "14px", border: `1.5px solid ${error ? "var(--red)" : "var(--border)"}`, borderRadius: "10px", outline: "none", transition: "border 0.15s", background: error ? "var(--red-dim)" : "var(--surface)", color: "var(--t1)" }
          }),
          React.createElement("button", { onClick: () => setShow(v => !v), style: { position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--t3)", fontSize: "14px", padding: "4px" } }, show ? "🙈" : "👁")
        ),
        error && React.createElement("div", { style: { fontSize: "11px", color: "var(--red)", marginTop: "6px", fontWeight: "600" } }, "Incorrect password. Try again.")
      ),
      React.createElement("button", { onClick: submit, className: "t", style: { width: "100%", padding: "13px", background: "var(--navy)", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer", letterSpacing: "0.3px" } }, "Sign In →"),
      React.createElement("div", { style: { marginTop: "28px", fontSize: "11pxpx", color: "var(--t4)", textAlign: "center" } }, "Jeremy Metka · Senior Field Underwriter")
    )
  );
}
