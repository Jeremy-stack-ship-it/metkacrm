// ── TOAST (v3.58 — 7b) ────────────────────────────────────────────────────────
// Non-blocking notifications replacing window.alert() in the dial flow.
// Framework-free DOM injection — usable from any module, no React plumbing.
export const toast = (msg, type = 'info', ms = 3500) => {
  try {
    let host = document.getElementById('metka-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'metka-toast-host';
      host.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;';
      document.body.appendChild(host);
    }
    const colors = {
      ok:    ['#EAF3DE', '#27500A', '#97C459'],
      err:   ['#FCEBEB', '#791F1F', '#F09595'],
      warn:  ['#FAEEDA', '#633806', '#FAC775'],
      info:  ['#E6F1FB', '#0C447C', '#85B7EB'],
    };
    const [bg, fg, bd] = colors[type] || colors.info;
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.style.cssText = 'pointer-events:auto;max-width:480px;padding:10px 18px;border-radius:10px;font:700 13px Inter,sans-serif;letter-spacing:0.2px;background:' + bg + ';color:' + fg + ';border:1px solid ' + bd + ';box-shadow:0 6px 24px rgba(0,0,0,0.18);opacity:0;transition:opacity 0.2s, transform 0.2s;transform:translateY(8px);';
    el.textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    setTimeout(() => {
      el.style.opacity = '0'; el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 250);
    }, ms);
  } catch { /* toast must never break the app */ }
};
