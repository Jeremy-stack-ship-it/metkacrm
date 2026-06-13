// ── AI PANEL — Metka Field Ops CRM ───────────────────────────────
// Floating AI assistant powered by Gemini 2.0 Flash.
// Four tabs: Chat | Lead Intel | Draft Copy | Note Extraction
// API key stored in localStorage via Settings → AI Assistant card.

import React from 'react';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const SYS = `You are the AI assistant embedded in the Metka Field Ops CRM, used exclusively by Jeremy Metka — Senior Household Protection Advisor, Ministry of Protection, SFG/Quility. NPN #21425108.

Production target: 5 submitted life insurance applications per week. Every response serves this mission.

VOCABULARY:
- "Household Protection Audit" not "quote/pitch"
- "Milestone Shelter" or "Home Equity Safeguard" for positioning
- "Senior Household Protection Advisor" or "Protective Steward" not "agent"
- "Family" not "client/customer"
- "Living Benefits" — always emphasize cash payout while insured is alive (critical illness, chronic illness, terminal acceleration)
- Standard terms (policy, life insurance, coverage, mortgage protection) are acceptable

PROTOCOLS:
Ghost Protocol: Non-responsive → "I'm wrapping up regional files — do I need to archive your household file?"
The Pivot: Health disqualifies Term/Living Benefits → pivot to Graded/Guaranteed Issue Final Expense.

CARRIERS: Mutual of Omaha, American Amicable, Banner Life, F&G, SBLI, Transamerica, American General, Occidental, Foresters
STATES: OK, TX, VA, OH, NC, IL, MO, NJ, PA, AZ, NY, WA, AL, FL, GA, CA

COMPLIANCE: Manual dial only 8AM-9PM local. A2P approved June 2026. STOP opt-out required on all SMS.

Be direct, tactical, zero fluff. No "I hope this helps." Give the actual script, the actual strategy.`;

async function geminiCall(apiKey, msgs) {
  const r = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYS }] },
      contents: msgs.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }]
      })),
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    })
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error((e && e.error && e.error.message) || ('API error ' + r.status));
  }
  const d = await r.json();
  return (d.candidates &&
    d.candidates[0] &&
    d.candidates[0].content &&
    d.candidates[0].content.parts &&
    d.candidates[0].content.parts[0] &&
    d.candidates[0].content.parts[0].text) || '(no response)';
}

function leadCtx(lead) {
  if (!lead) return 'No lead selected.';
  const name = lead.name || [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown';
  const recentNotes = (lead.notes || []).slice(0, 4)
    .map(n => '  [' + ((n.ts || '').slice(0, 10)) + '] ' + (n.text || ''))
    .join('\n') || '  None';
  return 'ACTIVE LEAD:\n' +
    'Name: ' + name + ' | Age: ' + (lead.age || 'N/A') + ' | State: ' + (lead.state || 'N/A') + ' | City: ' + (lead.city || '') + '\n' +
    'Phone: ' + (lead.phone || 'N/A') + ' | Email: ' + (lead.email || 'N/A') + '\n' +
    'Lead Type: ' + (lead.leadType || 'N/A') + ' | Loan: ' + (lead.loanAmount ? '$' + Number(lead.loanAmount).toLocaleString() : 'N/A') + '\n' +
    'Bucket: ' + (lead.bucket || 'N/A') + ' | Stage: ' + (lead.stage || 'N/A') + ' | Disp: ' + (lead.disposition || 'N/A') + '\n' +
    'Last Contact: ' + (lead.lastContact || 'Never') + '\n' +
    'Health: ' + (lead.healthIssues || lead.medications || 'None on file') + ' | Tobacco: ' + (lead.tobacco || 'Unknown') + '\n' +
    'Recent Notes:\n' + recentNotes;
}

const DRAFT_OPTS = [
  { id: 'ghost',        label: 'Ghost Protocol' },
  { id: 'followup',     label: 'Follow-Up' },
  { id: 'reengage',     label: 'Re-Engage (Cold)' },
  { id: 'appt_confirm', label: 'Appt Confirm' },
];

function draftPrompt(type, lead) {
  const ctx = leadCtx(lead);
  const fn = (lead && (lead.firstName || (lead.name && lead.name.split(' ')[0]))) || 'there';
  const prompts = {
    ghost:        ctx + '\n\nWrite Ghost Protocol outreach for ' + fn + '. SMS version (<160 chars) and Email version. Jeremy is wrapping up regional files and needs to know if he should archive their household file. Authority tone, not desperate. SMS must include: Reply STOP to opt out.',
    followup:     ctx + '\n\nWrite follow-up outreach for ' + fn + ' (prior contact, no appointment set yet). SMS version (<160 chars) and Email version. Reference Living Benefits — money paid out while alive. Offer a 15-min Household Protection Audit. SMS must include: Reply STOP to opt out.',
    reengage:     ctx + '\n\nWrite re-engagement for ' + fn + ' — cold lead (12+ months since contact). Originally submitted a form about life insurance/mortgage protection. SMS version (<160 chars) and Email version. Re-establish relevance without being desperate. SMS must include: Reply STOP to opt out.',
    appt_confirm: ctx + '\n\nWrite appointment confirmation for ' + fn + '. SMS version (<160 chars) and Email version. Confirm the upcoming Household Protection Audit. Build anticipation — they will learn about Living Benefits (money paid out while alive). Ask them to reply YES to confirm.',
  };
  return prompts[type] || prompts.ghost;
}

// ── Main Component ────────────────────────────────────────────────

export default function AIPanel({ activeLead, aiConfig }) {
  const apiKey = (aiConfig && aiConfig.geminiKey && aiConfig.geminiKey.trim()) || '';
  const noKey  = !apiKey;

  const [panelOpen, setPanelOpen] = React.useState(false);
  const [tab, setTab]             = React.useState('chat');

  // Chat
  const [chatMsgs,    setChatMsgs]    = React.useState([]);
  const [chatIn,      setChatIn]      = React.useState('');
  const [chatLoading, setChatLoading] = React.useState(false);
  const chatEnd = React.useRef(null);

  // Intel
  const [intelOut,     setIntelOut]     = React.useState('');
  const [intelLoading, setIntelLoading] = React.useState(false);

  // Draft
  const [draftType,    setDraftType]    = React.useState('ghost');
  const [draftOut,     setDraftOut]     = React.useState('');
  const [draftLoading, setDraftLoading] = React.useState(false);

  // Note extraction
  const [noteIn,      setNoteIn]      = React.useState('');
  const [noteOut,     setNoteOut]     = React.useState('');
  const [noteLoading, setNoteLoading] = React.useState(false);

  // Copy feedback
  const [copied, setCopied] = React.useState('');

  React.useEffect(() => {
    setIntelOut(''); setDraftOut(''); setNoteOut('');
  }, [activeLead && activeLead.id]);

  React.useEffect(() => {
    if (chatEnd.current) chatEnd.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs]);

  async function sendChat() {
    const text = chatIn.trim();
    if (!text || chatLoading) return;
    const ctx  = leadCtx(activeLead);
    const userMsg = { role: 'user', text: ctx + '\n\n---\n' + text };
    const next = [...chatMsgs, userMsg];
    setChatMsgs(next); setChatIn(''); setChatLoading(true);
    try {
      const reply = await geminiCall(apiKey, next);
      setChatMsgs(h => [...h, { role: 'assistant', text: reply }]);
    } catch(err) {
      setChatMsgs(h => [...h, { role: 'assistant', text: '❌ ' + err.message }]);
    }
    setChatLoading(false);
  }

  async function runIntel() {
    if (!activeLead) { setIntelOut('Open a lead first to run analysis.'); return; }
    setIntelLoading(true); setIntelOut('');
    const prompt = leadCtx(activeLead) + '\n\nAnalyze this lead and provide:\n' +
      '**1. Recommended Carrier(s)** — based on age, state, lead type, health notes\n' +
      '**2. Opening Line** — first 1-2 sentences when they answer\n' +
      '**3. Approach Strategy** — specific angle for this family\n' +
      '**4. Risk Flags** — anything that could disqualify or complicate coverage\n' +
      '**5. Living Benefits Angle** — how to frame the money-while-alive rider for this specific person\n\n' +
      'Be specific. No generic scripts.';
    try {
      const r = await geminiCall(apiKey, [{ role: 'user', text: prompt }]);
      setIntelOut(r);
    } catch(err) { setIntelOut('❌ ' + err.message); }
    setIntelLoading(false);
  }

  async function runDraft() {
    setDraftLoading(true); setDraftOut('');
    try {
      const r = await geminiCall(apiKey, [{ role: 'user', text: draftPrompt(draftType, activeLead) }]);
      setDraftOut(r);
    } catch(err) { setDraftOut('❌ ' + err.message); }
    setDraftLoading(false);
  }

  async function runExtract() {
    const text = noteIn.trim();
    if (!text) return;
    setNoteLoading(true); setNoteOut('');
    const prompt = leadCtx(activeLead) + '\n\nCall notes to analyze:\n---\n' + text + '\n---\n\n' +
      'Extract:\n' +
      '**1. Recommended Disposition** — exact value: no_answer | vm_left | callback | hung_up | not_interested | dnc | appointment_booked | no_show | no_sale | follow_up_needed\n' +
      '**2. Key Facts Learned** — new info: health, objections, interest level, family situation\n' +
      '**3. Objections & Rebuttals** — what they said + suggested counter for each\n' +
      '**4. Recommended Next Step** — specific action with timing\n' +
      '**5. CRM Note (ready to paste)** — clean 2-3 sentence note for the lead record';
    try {
      const r = await geminiCall(apiKey, [{ role: 'user', text: prompt }]);
      setNoteOut(r);
    } catch(err) { setNoteOut('❌ ' + err.message); }
    setNoteLoading(false);
  }

  function copyText(text, id) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(''), 1500);
  }

  // ── Styles ────────────────────────────────────────────────────────
  const FAB = {
    position: 'fixed', bottom: '76px', right: '18px', zIndex: 9998,
    width: '46px', height: '46px', borderRadius: '50%',
    background: panelOpen ? '#4338CA' : 'linear-gradient(135deg,#4F46E5,#7C3AED)',
    border: 'none', cursor: 'pointer', fontSize: '20px',
    boxShadow: '0 4px 18px rgba(79,70,229,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', transition: 'background 0.15s',
  };

  const PANEL = {
    position: 'fixed', bottom: '130px', right: '18px', zIndex: 9997,
    width: '390px', maxHeight: '560px',
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: '16px', boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  };

  const HDR = {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.12)',
    background: 'linear-gradient(135deg,#4F46E5,#7C3AED)',
    flexShrink: 0,
  };

  const TAB_BAR = {
    display: 'flex', borderBottom: '1px solid var(--border)',
    background: 'var(--surface-2)', flexShrink: 0,
  };

  const tabBtn = active => ({
    flex: 1, padding: '7px 2px', border: 'none', cursor: 'pointer',
    fontSize: '11px', fontWeight: active ? '800' : '600',
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? 'var(--blue)' : 'var(--t3)',
    borderBottom: active ? '2px solid var(--blue)' : '2px solid transparent',
    transition: 'all 0.1s',
  });

  const BODY = {
    flex: 1, overflowY: 'auto', padding: '12px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  };

  const OUTBOX = {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: '10px', padding: '10px 12px', fontSize: '12px',
    color: 'var(--t1)', lineHeight: '1.7', whiteSpace: 'pre-wrap',
    wordBreak: 'break-word', maxHeight: '300px', overflowY: 'auto',
  };

  const BTN_PRIMARY = {
    padding: '8px 16px', background: 'var(--blue)', color: '#fff',
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontSize: '12px', fontWeight: '700',
  };

  const BTN_SECONDARY = {
    padding: '8px 12px', background: 'var(--surface-2)', color: 'var(--t2)',
    border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer',
    fontSize: '12px', fontWeight: '700',
  };

  const BTN_COPY = {
    padding: '4px 10px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: '6px',
    fontSize: '11px', fontWeight: '700', color: 'var(--t2)',
    cursor: 'pointer', alignSelf: 'flex-end',
  };

  const INPUT_STYLE = {
    width: '100%', padding: '8px 10px', background: 'var(--surface-2)',
    border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px',
    color: 'var(--t1)', fontFamily: 'inherit', boxSizing: 'border-box',
  };

  const LABEL = {
    fontSize: '11pxpx', fontWeight: '700', color: 'var(--t3)',
    letterSpacing: '0.5px', display: 'block', marginBottom: '4px',
  };

  const e = React.createElement;

  // ── Tab labels ────────────────────────────────────────────────────
  const TABS = [
    { id: 'chat',  label: '💬 Chat'  },
    { id: 'intel', label: '🎯 Intel' },
    { id: 'draft', label: '✍️ Draft' },
    { id: 'note',  label: '📋 Note'  },
  ];

  // ── Spinner helper ────────────────────────────────────────────────
  function Spinner() {
    return e('span', { className: 'spin', style: { display: 'inline-block', width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', marginLeft: '6px', verticalAlign: 'middle' } });
  }

  // ── Chat tab ──────────────────────────────────────────────────────
  function renderChat() {
    return e('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 } },

      // Messages area
      e('div', { style: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '160px', maxHeight: '300px' } },
        chatMsgs.length === 0 && e('div', {
          style: { fontSize: '11px', color: 'var(--t4)', textAlign: 'center', marginTop: '20px', lineHeight: '1.6' }
        },
          activeLead
            ? 'Lead loaded: ' + (activeLead.firstName || (activeLead.name && activeLead.name.split(' ')[0]) || '') + '. Ask anything.'
            : 'No lead open. Ask strategy, scripts, objection handling…'
        ),
        chatMsgs.map((m, i) =>
          e('div', {
            key: i,
            style: {
              padding: '8px 12px',
              borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              background: m.role === 'user' ? 'var(--blue)' : 'var(--surface-2)',
              color: m.role === 'user' ? '#fff' : 'var(--t1)',
              border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
              fontSize: '12px', lineHeight: '1.6',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxWidth: '92%',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            }
          }, m.text)
        ),
        chatLoading && e('div', {
          style: {
            padding: '8px 12px', borderRadius: '12px 12px 12px 4px',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            fontSize: '12px', color: 'var(--t3)', alignSelf: 'flex-start',
          }
        }, '●●●'),
        e('div', { ref: chatEnd })
      ),

      // Input row
      e('div', { style: { display: 'flex', gap: '6px', alignItems: 'flex-end' } },
        e('textarea', {
          style: { ...INPUT_STYLE, resize: 'none' },
          value: chatIn, rows: 2,
          placeholder: 'Ask anything…',
          onChange: ev => setChatIn(ev.target.value),
          onKeyDown: ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); sendChat(); } }
        }),
        e('button', {
          style: { ...BTN_PRIMARY, padding: '8px 12px', whiteSpace: 'nowrap', flexShrink: 0 },
          onClick: sendChat, disabled: chatLoading,
        }, chatLoading ? e(React.Fragment, null, '…', Spinner()) : 'Send')
      ),

      // Clear
      chatMsgs.length > 0 && e('button', {
        style: { ...BTN_SECONDARY, fontSize: '11px', padding: '4px 10px', alignSelf: 'flex-start', border: 'none', background: 'transparent', color: 'var(--t4)' },
        onClick: () => setChatMsgs([])
      }, '🗑 Clear chat')
    );
  }

  // ── Intel tab ─────────────────────────────────────────────────────
  function renderIntel() {
    return e('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
      e('div', { style: { fontSize: '11px', color: 'var(--t3)', lineHeight: '1.5', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border)' } },
        activeLead
          ? '📍 ' + (activeLead.name || [activeLead.firstName, activeLead.lastName].filter(Boolean).join(' ') || 'Lead') + ' — ' + (activeLead.state || '') + (activeLead.age ? ' | Age ' + activeLead.age : '') + (activeLead.leadType ? ' | ' + activeLead.leadType : '')
          : '⚠️ No lead open. Open a contact record to analyze.'
      ),
      e('button', {
        style: { ...BTN_PRIMARY, alignSelf: 'flex-start', opacity: (!activeLead || intelLoading) ? 0.6 : 1 },
        onClick: runIntel,
        disabled: intelLoading || !activeLead,
      }, intelLoading ? e(React.Fragment, null, 'Analyzing…', Spinner()) : '🎯 Analyze This Lead'),
      intelOut && e('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        e('div', { style: OUTBOX }, intelOut),
        e('button', { style: BTN_COPY, onClick: () => copyText(intelOut, 'intel') },
          copied === 'intel' ? '✓ Copied' : '📋 Copy'
        )
      )
    );
  }

  // ── Draft tab ─────────────────────────────────────────────────────
  function renderDraft() {
    return e('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
      e('div', null,
        e('label', { style: LABEL }, 'MESSAGE TYPE'),
        e('select', {
          style: { ...INPUT_STYLE },
          value: draftType,
          onChange: ev => { setDraftType(ev.target.value); setDraftOut(''); }
        },
          DRAFT_OPTS.map(o => e('option', { key: o.id, value: o.id }, o.label))
        )
      ),
      e('button', {
        style: { ...BTN_PRIMARY, alignSelf: 'flex-start', opacity: draftLoading ? 0.6 : 1 },
        onClick: runDraft, disabled: draftLoading,
      }, draftLoading ? e(React.Fragment, null, 'Generating…', Spinner()) : '✍️ Generate Copy'),
      draftOut && e('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        e('div', { style: OUTBOX }, draftOut),
        e('button', { style: BTN_COPY, onClick: () => copyText(draftOut, 'draft') },
          copied === 'draft' ? '✓ Copied' : '📋 Copy'
        )
      )
    );
  }

  // ── Note extraction tab ───────────────────────────────────────────
  function renderNote() {
    return e('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
      e('div', null,
        e('label', { style: LABEL }, 'PASTE CALL NOTES / TRANSCRIPT'),
        e('textarea', {
          style: { ...INPUT_STYLE, resize: 'vertical', minHeight: '80px' },
          value: noteIn, rows: 4,
          placeholder: 'Paste raw call notes or transcript here…',
          onChange: ev => setNoteIn(ev.target.value),
        })
      ),
      e('button', {
        style: { ...BTN_PRIMARY, alignSelf: 'flex-start', opacity: (!noteIn.trim() || noteLoading) ? 0.6 : 1 },
        onClick: runExtract, disabled: noteLoading || !noteIn.trim(),
      }, noteLoading ? e(React.Fragment, null, 'Extracting…', Spinner()) : '📋 Extract'),
      noteOut && e('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        e('div', { style: OUTBOX }, noteOut),
        e('button', { style: BTN_COPY, onClick: () => copyText(noteOut, 'note') },
          copied === 'note' ? '✓ Copied' : '📋 Copy'
        )
      )
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  return e(React.Fragment, null,

    // ── Floating Action Button ────────────────────────────────────
    e('button', { style: FAB, title: 'AI Assistant', onClick: () => setPanelOpen(o => !o) },
      panelOpen ? '✕' : '🤖'
    ),

    // ── Panel ─────────────────────────────────────────────────────
    panelOpen && e('div', { style: PANEL },

      // Header
      e('div', { style: HDR },
        e('span', { style: { flex: 1, fontSize: '13px', fontWeight: '800', color: '#fff', fontFamily: "'Syne',sans-serif" } }, '🤖 AI Assistant'),
        activeLead && e('span', {
          style: { fontSize: '11pxpx', fontWeight: '700', color: '#C4B5FD', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '10px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
        }, (activeLead.firstName || (activeLead.name && activeLead.name.split(' ')[0]) || 'Lead').slice(0, 16)),
        e('button', {
          style: { background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '700', padding: '4px 8px', marginLeft: '4px' },
          onClick: () => setPanelOpen(false)
        }, '✕')
      ),

      // No key warning
      noKey && e('div', {
        style: { margin: '14px', padding: '12px 14px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '10px', fontSize: '12px', color: '#92400E', lineHeight: '1.6', fontWeight: '500' }
      },
        '⚠️ No API key set. Go to ',
        e('strong', null, 'Settings → 🤖 AI Assistant'),
        ' and paste your Gemini API key.'
      ),

      // Tab bar + content
      !noKey && e(React.Fragment, null,
        e('div', { style: TAB_BAR },
          TABS.map(t => e('button', { key: t.id, style: tabBtn(tab === t.id), onClick: () => setTab(t.id) }, t.label))
        ),
        e('div', { style: BODY },
          tab === 'chat'  && renderChat(),
          tab === 'intel' && renderIntel(),
          tab === 'draft' && renderDraft(),
          tab === 'note'  && renderNote(),
        )
      )
    )
  );
}
