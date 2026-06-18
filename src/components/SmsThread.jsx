import React from 'react';
import { reconstructSeqSms } from '../lib/seqSmsBodies.js'; // v3.53 — real text for auto sends
import { SMS_SEQUENCES, suggestSeqCat, hoursSinceOpen } from '../lib/phaseEngine.js'; // v3.62 card touch

const CALENDLY = 'https://calendly.com/metkasolutions/20min';
const HIHELLO  = 'https://hihello.me/p/6cc69b25-86ec-4c39-a45b-fd48bee85403'; // digital business card
const SELF_APPLY = 'https://apply.quility.com/#/symmetry/raq/SFG0092434?redirect_url=https%3A%2F%2Fyourlivingbenefit.com%2F&leadtype=Life%20Insurance&producttype=Life%20Insurance';

// v3.86 — No Answer rotating templates (per-person 5-shot cycle), casual rewrite.
// Exported so DialView's No Answer confirm-to-send uses the same single source.
export const NO_ANSWER_TEMPLATES = [
  "Hey {firstName}, it's Jeremy Metka — tried giving you a call about the life insurance info you requested. Send me a time that works and I'll catch you then.",
  "Hey {firstName}, Jeremy again. Missed you just now. Still want to get you squared away on the coverage you reached out about — when's good for you?",
  "Hi {firstName}, Jeremy Metka here. Tried your line about your life insurance request. No rush on my end — just let me know when you've got a few minutes.",
  "Hey {firstName}, it's Jeremy. Been trying to reach you about the coverage you asked about. Happy to keep it short — what's a good time to connect?",
  "Hey {firstName}, Jeremy Metka here — circling back on your life insurance request. I know things get busy. What day this week is easiest for a quick call?",
];

// v3.79 — Number change broadcast template
const NUM_CHANGE_TEMPLATE =
  "Hey {firstName}, Jeremy Metka here — I changed my number. Please save (580) 263-5409 as my new contact. I’ll be in touch soon. Reply STOP to opt out.";

// v3.78 — TCPA-compliant initial contact template (must be first text from this number)
const INITIAL_CONTACT_TEMPLATE =
  "Hey {firstName}, this is Jeremy Metka. Most agents that reach out just sell death benefits. I specialize in Living Benefits — coverage that pays YOU while you're still alive. Big difference. When's a good time to connect? Reply STOP to opt out.";

// ── SMS THREAD ────────────────────────────────────────────────────────────────
// Shared two-way SMS thread component.
// Props:
//   open       — lead object
//   sendSms    — async fn(phone, body, leadId)
//   upd        — lead update fn (to clear unread flag)
//   height     — optional fixed height (default: '100%')
// ─────────────────────────────────────────────────────────────────────────────
export default function SmsThread({ open, sendSms, upd, height = '100%' }) {
  const [msgText,    setMsgText]    = React.useState('');
  const [sending,    setSending]    = React.useState(false);
  const [sendResult, setSendResult] = React.useState(null);
  const [tplOpen,    setTplOpen]    = React.useState(false);
  const [tplCat,     setTplCat]     = React.useState('cat1');
  // v3.58 — 7b: ladder position memory. When a drawer step fills the composer,
  // a successful SEND auto-advances smsSeq/smsStep — no manual mark needed.
  const [filledStep, setFilledStep] = React.useState(null);
  const [naOpen,     setNaOpen]     = React.useState(false); // v3.80 — no-answer dropdown
  const bottomRef = React.useRef(null);

  const MAX = 160;
  const chars = msgText.length;
  const segs  = Math.ceil(chars / MAX) || 1;

  // Clear unread when thread opens
  React.useEffect(() => {
    if (open && open.smsUnread && upd) {
      upd(open.id, { smsUnread: false });
    }
  }, [open && open.id]);

  React.useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [open && (open.notes || []).length]);

  // v3.78 — TCPA: derive whether any SMS has been sent from this number to this lead
  const hasBeenTexted = React.useMemo(() => {
    if (!open) return false;
    return (open.notes || []).some(n =>
      n && n.text && (
        n.text.startsWith('📱 SMS sent:') ||
        n.text.startsWith('[SEQ] SMS sent') ||
        n.type === 'sms_inbound'
      )
    );
  }, [open && open.notes]);

  const smsMessages = React.useMemo(() => {
    if (!open) return [];
    return (open.notes || [])
      .filter(n => {
        if (!n || !n.text) return false;
        if (n.type === 'sms_inbound') return true;
        if (n.text.startsWith('📱 SMS sent:')) return true;
        if (n.text.startsWith('[SEQ] SMS sent')) return true;
        return false;
      })
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  }, [open && open.notes]);

  const fill = (text) => {
    const fn = open ? (open.firstName || (open.name || '').split(' ')[0] || 'there') : 'there';
    setMsgText(
      text
        .replace(/\$\{n\}|\{n\}/g, fn)
        .replace(/\{firstName\}/gi, fn)
        .replace(/\{calendly\}|\{calendlyUrl\}/gi, CALENDLY)
        .replace(/\[YOUR CALENDLY LINK\]/g, CALENDLY)
        .replace(/\[CALENDLY\]/g, CALENDLY)
        .replace(/\{selfApply\}/gi, SELF_APPLY)
    );
    setTplOpen(false);
  };

  const insertVar = (val) => setMsgText(prev => prev + val);

  const handleSend = async () => {
    if (!open || !msgText.trim() || sending || !open.phone || open.smsOptOut) return;
    setSending(true); setSendResult(null);
    try {
      await sendSms(open.phone, msgText.trim(), open.id);
      // v3.58 — 7b: real send of a ladder step advances the position memory
      if (filledStep) { upd && upd(open.id, { smsSeq: filledStep.cat, smsStep: filledStep.step }); setFilledStep(null); }
      setSendResult('ok');
      setMsgText('');
      setTimeout(() => setSendResult(null), 2500);
    } catch { setSendResult('err'); }
    finally { setSending(false); }
  };

  const dayLabel = (ts) => {
    const d = new Date(ts);
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
    const msgDay = new Date(d); msgDay.setHours(0,0,0,0);
    if (msgDay.getTime() === today.getTime()) return 'Today';
    if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  };

  const catLabels = { cat1:'📭 New/Cold', cat2:'❌ No-Show', cat3:'📋 Sat — No Buy' };
  const sugCat = open ? suggestSeqCat(open) : 'cat1';
  const optedOut = !!(open && open.smsOptOut);
  let lastDay = '';

  if (!open) return React.createElement('div', {
    style:{ display:'flex', alignItems:'center', justifyContent:'center', height, color:'var(--t4)', fontSize:'13px' }
  }, '← Select a conversation');

  return React.createElement('div', {
    style:{ display:'flex', flexDirection:'column', height, background:'var(--surface)', overflow:'hidden' }
  },

    // ── Header ──────────────────────────────────────────────────────
    React.createElement('div', { style:{ padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)', display:'flex', alignItems:'center', gap:'10px', flexShrink:0 } },
      React.createElement('div', { style:{ flex:1 } },
        React.createElement('div', { style:{ fontSize:'14px', fontWeight:'800', color:'var(--t1)' } }, open.name || 'Unknown'),
        React.createElement('div', { style:{ fontSize:'11px', color:'var(--t3)', fontFamily:"'JetBrains Mono',monospace", marginTop:'2px' } }, open.phone || '')
      ),
      React.createElement('div', { style:{ fontSize:'11pxpx', padding:'3px 8px', borderRadius:'12px', background: optedOut?'var(--red-dim)':'var(--green-dim)', color:optedOut?'var(--red)':'var(--green)', fontWeight:'800', border:'1px solid '+(optedOut?'#FCA5A5':'#6EE7B7') } },
        optedOut ? '🔴 STOP' : '✅ A2P'
      )
    ),

    // ── Thread ──────────────────────────────────────────────────────
    React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:'4px' } },
      smsMessages.length === 0
        ? React.createElement('div', { style:{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', color:'var(--t4)', fontSize:'12px', textAlign:'center', padding:'32px', gap:'8px' } },
            React.createElement('div', { style:{ fontSize:'32px' } }, '💬'),
            'No messages yet.',
            React.createElement('div', { style:{ fontSize:'11px' } }, 'Send the first one below.')
          )
        : smsMessages.map((msg, i) => {
            const isInbound = msg.type === 'sms_inbound';
            const isAuto    = msg.text && msg.text.startsWith('[SEQ]');
            // v3.53 — show the ACTUAL sent text: prefer logged body (new sends),
            // else reconstruct from the deterministic template map (old sends).
            const display   = isAuto
              ? (msg.body || reconstructSeqSms(msg.text, open) ||
                 '[Auto · ' + (msg.text.match(/Step (\d+)/)?.[0] || 'sequence') + ']')
              : msg.text.replace('📱 SMS sent: ', '');
            const msgDay    = dayLabel(msg.ts);
            const showDiv   = msgDay !== lastDay;
            lastDay = msgDay;
            const time = new Date(msg.ts).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });

            return React.createElement(React.Fragment, { key: msg.ts + i },
              showDiv && React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:'8px', margin:'8px 0 4px' } },
                React.createElement('div', { style:{ flex:1, height:'1px', background:'var(--border)' } }),
                React.createElement('span', { style:{ fontSize:'11pxpx', color:'var(--t4)', fontWeight:'600', whiteSpace:'nowrap' } }, msgDay),
                React.createElement('div', { style:{ flex:1, height:'1px', background:'var(--border)' } })
              ),
              React.createElement('div', { style:{ display:'flex', justifyContent: isInbound?'flex-start':'flex-end', marginBottom:'2px' } },
                React.createElement('div', {
                  style:{
                    maxWidth:'75%', padding:'8px 12px',
                    borderRadius: isInbound?'4px 16px 16px 16px':'16px 4px 16px 16px',
                    background: isInbound?'var(--surface-2)':'#1a2a44',
                    color: isInbound?'var(--t1)':'#fff',
                    border: isInbound?'1px solid var(--border)':'none',
                    fontSize:'13px', lineHeight:'1.5', wordBreak:'break-word'
                  }
                },
                  React.createElement('div', null, display),
                  React.createElement('div', { style:{ fontSize:'11pxpx', marginTop:'3px', opacity:0.55, textAlign: isInbound?'left':'right' } }, time + (isAuto?' · auto':''))
                )
              )
            );
          }),
      React.createElement('div', { ref: bottomRef })
    ),

    // ── Compose ─────────────────────────────────────────────────────
    // v3.54 — OPT-OUT HARD LOCK: this family texted STOP. Composer is replaced,
    // not just disabled — texting them again is a willful TCPA violation.
    (open && open.smsOptOut === true)
      ? React.createElement('div', { style:{ borderTop:'1px solid #FCA5A5', background:'var(--red-dim)', padding:'14px 16px', flexShrink:0, textAlign:'center' } },
          React.createElement('div', { style:{ fontSize:'12px', fontWeight:'800', color:'var(--red)', letterSpacing:'0.5px' } }, '⛔ OPTED OUT — texted STOP'),
          React.createElement('div', { style:{ fontSize:'11pxpx', color:'var(--red)', marginTop:'4px', opacity:0.85 } }, 'Texting this family again is a TCPA violation. Phone calls only. (They can reply START to opt back in.)')
        )
      : React.createElement('div', { style:{ borderTop:'1px solid var(--border)', background:'var(--surface)', padding:'10px 12px', flexShrink:0, position:'relative' } },

      // Template drawer
      tplOpen && React.createElement('div', {
        style:{ position:'absolute', bottom:'calc(100% + 4px)', left:0, right:0, zIndex:200, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', boxShadow:'0 -4px 20px rgba(0,0,0,0.15)', padding:'12px', maxHeight:'300px', overflow:'hidden', display:'flex', flexDirection:'column' }
      },
        React.createElement('div', { style:{ display:'flex', gap:'4px', marginBottom:'8px', flexShrink:0 } },
          Object.entries(catLabels).map(([cat, lbl]) =>
            React.createElement('button', {
              key:cat, onClick:()=>setTplCat(cat),
              style:{ flex:1, padding:'5px 4px', fontSize:'11pxpx', fontWeight:'700', borderRadius:'6px', cursor:'pointer', border:'1px solid '+(tplCat===cat?'var(--blue)':'var(--border)'), background:tplCat===cat?'var(--blue)':'transparent', color:tplCat===cat?'#fff':'var(--t3)' }
            }, (cat===sugCat?'⭐ ':'')+lbl)
          )
        ),
        React.createElement('div', { style:{ overflowY:'auto', flex:1 } },
          (SMS_SEQUENCES[tplCat] && SMS_SEQUENCES[tplCat].texts || []).map(step => {
            const fn = open ? (open.firstName || (open.name||'').split(' ')[0] || 'there') : 'there';
            const preview = step.body(fn, CALENDLY).slice(0, 90) + '…';
            const sentUpTo = (open && open.smsSeq === tplCat) ? (open.smsStep || 0) : 0;
            const isNext = step.step === sentUpTo + 1;
            const isSent = step.step <= sentUpTo;
            return React.createElement('div', {
              key: step.step,
              onClick: () => { fill(step.body(fn, CALENDLY)); setFilledStep({ cat: tplCat, step: step.step }); },
              style:{ padding:'7px 10px', marginBottom:'3px', borderRadius:'7px', border:'1px solid '+(isNext?'var(--blue)':'var(--border)'), cursor:'pointer', background: isNext?'var(--blue-dim)':'var(--surface-2)', fontSize:'11px', opacity: isSent?0.5:1 },
              onMouseEnter: e => e.currentTarget.style.background='var(--blue-dim)',
              onMouseLeave: e => e.currentTarget.style.background='var(--surface-2)',
            },
              React.createElement('span', { style:{ fontSize:'11px', fontWeight:'800', color: isNext?'var(--blue)':'var(--t3)', marginRight:'6px' } }, (isSent?'\u2713 ':'') + 'Step '+step.step + (isNext?' \u2022 NEXT':'')),
              React.createElement('span', { style:{ color:'var(--t2)', lineHeight:'1.4' } }, preview)
            );
          })
        )
      ),

      // Toolbar
      React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px' } },
        React.createElement('button', { onClick:()=>setTplOpen(v=>!v), style:{ fontSize:'11px', fontWeight:'700', padding:'4px 10px', borderRadius:'6px', border:'1px solid '+(tplOpen?'var(--blue)':'var(--border)'), background:tplOpen?'var(--blue)':'var(--surface-2)', color:tplOpen?'#fff':'var(--t2)', cursor:'pointer' } },
          '📋 ' + (tplOpen?'▲':'▾')
        ),
        // v3.62 — 🔥 CARD TOUCH: one-tap warm intro for email openers. Manual
        // send only (deconfliction intact) — fills the composer, you hit send,
        // then dial them two minutes later with your name already on their phone.
        (() => {
          const h = hoursSinceOpen(open);
          if (h == null || h > 48 || open.smsOptOut) return null;
          const first = open.firstName || (open.name||'').split(' ')[0] || 'there';
          const cardMsg = 'Hey ' + first + ', Jeremy Metka \u2014 saw you were looking over what I sent about your coverage options. Here\u2019s my card so you know who\u2019s calling: ' + HIHELLO + ' \u2014 talk soon. Reply STOP to opt out.';
          return React.createElement('button', {
            onClick: () => setMsgText(cardMsg),
            title: 'They opened an email ' + h + 'h ago \u2014 send your card, then dial',
            style:{ fontSize:'11px', fontWeight:'800', padding:'3px 9px', borderRadius:'6px', border:'1px solid rgba(239,68,68,0.5)', background:'rgba(239,68,68,0.10)', color:'#EF4444', cursor:'pointer' }
          }, '\ud83d\udd25 Card');
        })(),
        // v3.80 — INTRO button (TCPA gate — always visible when not opted out)
        !optedOut && !hasBeenTexted && React.createElement('button', {
          onClick: () => {
            const first = open.firstName || (open.name||'').split(' ')[0] || 'there';
            fill(INITIAL_CONTACT_TEMPLATE.replace(/\{firstName\}/gi, first));
          },
          title: 'First text — includes STOP opt-out (TCPA required)',
          style:{ fontSize:'11px', fontWeight:'900', padding:'3px 9px', borderRadius:'6px', border:'1px solid rgba(234,179,8,0.6)', background:'rgba(234,179,8,0.10)', color:'#A16207', cursor:'pointer', whiteSpace:'nowrap' }
        }, '⚠️ INTRO'),
        // v3.80 — No Answer dropdown
        !optedOut && React.createElement('div', { style:{ position:'relative' } },
          React.createElement('button', {
            onClick: () => setNaOpen(v => !v),
            style:{ fontSize:'11px', fontWeight:'900', padding:'3px 9px', borderRadius:'6px', border:'1px solid rgba(239,68,68,0.4)', background: naOpen ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)', color:'#DC2626', cursor:'pointer', whiteSpace:'nowrap' }
          }, '📵 No Answer ' + (naOpen ? '▲' : '▾')),
          naOpen && React.createElement('div', {
            style:{ position:'absolute', bottom:'100%', right:0, zIndex:200, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px 8px 0 8px', boxShadow:'0 -6px 20px rgba(0,0,0,0.22)', minWidth:'300px', maxWidth:'320px', padding:'6px', marginBottom:'0' }
          },
            // Template items
            [...NO_ANSWER_TEMPLATES.map((tpl, i) =>
              React.createElement('button', {
                key: 'na'+i,
                onClick: () => {
                  const first = open.firstName || (open.name||'').split(' ')[0] || 'there';
                  fill(tpl.replace(/\{firstName\}/gi, first));
                  setNaOpen(false);
                },
                style:{ display:'block', width:'100%', textAlign:'left', padding:'7px 10px', borderRadius:'6px', border:'none', background:'transparent', color:'var(--t1)', fontSize:'11px', cursor:'pointer', lineHeight:'1.4', marginBottom:'2px' },
                onMouseEnter: e => e.currentTarget.style.background='var(--surface-2)',
                onMouseLeave: e => e.currentTarget.style.background='transparent',
              },
                React.createElement('span', { style:{ fontWeight:'900', color:'#DC2626', marginRight:'6px', fontSize:'10px' } }, 'T'+(i+1)),
                tpl.replace(/\{firstName\}/g, open.firstName || (open.name||'').split(' ')[0] || 'there').slice(0, 80) + '…'
              )
            ),
            // Divider
            React.createElement('div', { style:{ borderTop:'1px solid var(--border)', margin:'4px 0' } }),
            // # Change
            React.createElement('button', {
              key: 'numchange',
              onClick: () => {
                const first = open.firstName || (open.name||'').split(' ')[0] || 'there';
                fill(NUM_CHANGE_TEMPLATE.replace(/\{firstName\}/gi, first));
                setNaOpen(false);
              },
              style:{ display:'block', width:'100%', textAlign:'left', padding:'7px 10px', borderRadius:'6px', border:'none', background:'transparent', color:'var(--t1)', fontSize:'11px', cursor:'pointer', lineHeight:'1.4' },
              onMouseEnter: e => e.currentTarget.style.background='var(--surface-2)',
              onMouseLeave: e => e.currentTarget.style.background='transparent',
            },
              React.createElement('span', { style:{ fontWeight:'900', color:'#4338CA', marginRight:'6px', fontSize:'10px' } }, '📲'),
              '# Change — ' + NUM_CHANGE_TEMPLATE.replace(/\{firstName\}/g, open.firstName || (open.name||'').split(' ')[0] || 'there').slice(0, 70) + '…'
            )]
          )
        ),
        [['Name', open.firstName||(open.name||'').split(' ')[0]||'there'], ['Cal', CALENDLY], ['Apply', SELF_APPLY]].map(([lbl, val]) =>
          React.createElement('button', { key:lbl, onClick:()=>insertVar(val), style:{ fontSize:'11pxpx', fontWeight:'700', padding:'3px 7px', borderRadius:'6px', border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--t3)', cursor:'pointer' } }, '{'+lbl+'}')
        ),
        React.createElement('div', { style:{ marginLeft:'auto', fontSize:'11pxpx', fontWeight:'700', fontFamily:'monospace', color: chars>MAX?'var(--red)':chars>MAX*0.85?'var(--amber)':'var(--t4)' } },
          chars+'/'+MAX+(segs>1?' ·'+segs+'seg':'')
        )
      ),

      // Input row
      React.createElement('div', { style:{ display:'flex', gap:'8px', alignItems:'flex-end' } },
        React.createElement('textarea', {
          value:msgText, onChange:e=>setMsgText(e.target.value),
          onKeyDown:e=>{ if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)) handleSend(); },
          placeholder: optedOut?'Lead opted out — cannot send':'Message… (⌘+Enter to send)',
          disabled:optedOut, rows:2,
          style:{ flex:1, resize:'none', padding:'8px 10px', fontSize:'13px', borderRadius:'8px', border:'1px solid var(--border)', background: optedOut?'var(--surface-2)':'var(--surface)', color:'var(--t1)', fontFamily:"'Inter',sans-serif", lineHeight:'1.5', boxSizing:'border-box' }
        }),
        React.createElement('button', {
          onClick:handleSend,
          disabled:!msgText.trim()||sending||optedOut,
          style:{ padding:'8px 18px', borderRadius:'8px', border:'none', cursor:msgText.trim()&&!sending&&!optedOut?'pointer':'default', background:sendResult==='ok'?'var(--green)':sendResult==='err'?'var(--red)':msgText.trim()&&!optedOut?'#1a2a44':'var(--border)', color:msgText.trim()||sendResult?'#fff':'var(--t3)', fontSize:'13px', fontWeight:'800', transition:'background 0.15s', whiteSpace:'nowrap', alignSelf:'stretch', minHeight:'54px' }
        }, sending?'⏳':sendResult==='ok'?'✅':sendResult==='err'?'❌':'Send ▶')
      )
    )
  );
}
