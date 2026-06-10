import React from 'react';
import SmsThread from './SmsThread.jsx';
import { inp, chip, NC, fmt } from '../constants.js';

// ── Script token renderer ─────────────────────────────────────────────────
const TOKEN_FIELDS = {
  'FIRST_NAME':'firstName','CITY':'city','STATE':'state',
  'LOAN_AMOUNT':'loanAmount','AGE':'age','LEAD TYPE':'leadType',
  'LEAD_TYPE':'leadType'
};

function renderLiveTokens(text, lead, upd) {
  if (!lead || !text) return [React.createElement(React.Fragment, { key: 'x' }, text || '')];
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]$/);
    if (!m) return React.createElement(React.Fragment, { key: i }, part);
    const token = m[1];
    const field = TOKEN_FIELDS[token];
    const val = field ? (String(lead[field] || '')) : '';
    if (val) {
      return React.createElement('span', {
        key: i,
        style: { display: 'inline', padding: '1px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: '800', border: '1px solid #86efac', fontSize: 'inherit', cursor: 'default' }
      }, val);
    }
    return React.createElement('input', {
      key: i + '-input',
      placeholder: token.replace(/_/g, ' ').toLowerCase(),
      defaultValue: '',
      onBlur: e => { const v = e.target.value.trim(); if (v && field) upd(lead.id, { [field]: v }); },
      style: { display: 'inline', padding: '2px 8px', borderRadius: '4px', border: '1px dashed #fcd34d', background: '#fefce8', color: '#92400e', fontWeight: '700', fontSize: '0.88em', width: 'auto', minWidth: '72px', maxWidth: '150px', fontFamily: 'inherit', outline: 'none', verticalAlign: 'middle', marginInline: '2px' }
    });
  });
}


// ── SMS TAB COMPONENT ─────────────────────────────────────────────────────────
// Live send via Twilio send-sms Edge Function.
// Templates: quick-access chips from manual templates + freeform compose.
// Char counter: 160 chars = 1 SMS segment. Logs every send to lead notes.
function SmsTab({ open, upd, sendSms, templates }) {
  const [msgText,    setMsgText]    = React.useState('');
  const [sending,    setSending]    = React.useState(false);
  const [lastResult, setLastResult] = React.useState(null); // 'ok' | 'err'

  const MAX_SEG = 160;
  const chars   = msgText.length;
  const segs    = Math.ceil(chars / MAX_SEG) || 1;
  const charColor = chars > MAX_SEG * 2 ? 'var(--red)' : chars > MAX_SEG ? 'var(--amber)' : 'var(--t3)';

  const fill = (text) => {
    if (!open) return;
    const first = (open.firstName || (open.name || '').split(' ')[0] || 'there');
    setMsgText(text.replace(/\{n\}/g, first).replace(/\{name\}/gi, first).replace(/\{firstName\}/gi, first));
  };

  const handleSend = async () => {
    if (!open || !msgText.trim() || sending) return;
    if (!open.phone) { alert('No phone number on this lead.'); return; }
    setSending(true);
    setLastResult(null);
    try {
      await sendSms(open.phone, msgText.trim(), open.id);
      setLastResult('ok');
      setMsgText('');
      setTimeout(() => setLastResult(null), 3000);
    } catch (e) {
      setLastResult('err');
    } finally {
      setSending(false);
    }
  };

  // SMS history — notes that contain SMS sends
  const smsNotes = (open && open.notes || []).filter(n =>
    n.text && (n.text.startsWith('📱 SMS') || n.text.startsWith('[SEQ] SMS'))
  ).slice(0, 6);

  if (!open) return React.createElement('div', { id: 'dial-panel-sms', role: 'tabpanel', 'aria-labelledby': 'dial-tab-sms',
    style: { padding: '32px', textAlign: 'center', color: 'var(--t4)', fontSize: '12px' } }, 'Select a lead to send SMS.');

  return React.createElement('div', {
    id: 'dial-panel-sms', role: 'tabpanel', 'aria-labelledby': 'dial-tab-sms',
    style: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }
  },

    // Phone + TCPA status
    React.createElement('div', { style: { fontSize: '11px', fontWeight: '700', color: 'var(--t2)', padding: '6px 10px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' } },
      '📱 ', open.phone || 'No phone',
      React.createElement('span', { style: { marginLeft: '8px', color: 'var(--green)', fontWeight: '800' } }, '✓ A2P Cleared')
    ),

    // Quick-fill chips from manual templates
    Object.keys(templates || {}).length > 0 && React.createElement('div', null,
      React.createElement('div', { style: { fontSize: '10px', fontWeight: '800', color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: '5px' } }, 'QUICK TEMPLATES'),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
        Object.entries(templates || {}).slice(0, 8).map(([key, tpl]) =>
          React.createElement('button', {
            key,
            onClick: () => fill(tpl.text || ''),
            style: { fontSize: '10px', padding: '3px 8px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--t2)', cursor: 'pointer', fontWeight: '600', lineHeight: 1.4 }
          }, (tpl.name || key).replace(/^[A-Z0-9]+ — /, '').slice(0, 22))
        )
      )
    ),

    // Compose area
    React.createElement('div', null,
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
        React.createElement('div', { style: { fontSize: '10px', fontWeight: '800', color: 'var(--t3)', letterSpacing: '0.08em' } }, 'MESSAGE'),
        React.createElement('div', { style: { fontSize: '10px', color: charColor, fontWeight: '700' } },
          chars + ' chars · ' + segs + (segs === 1 ? ' segment' : ' segments'))
      ),
      React.createElement('textarea', {
        value: msgText,
        onChange: e => setMsgText(e.target.value),
        placeholder: 'Type a message or pick a template above...',
        style: { width: '100%', minHeight: '90px', padding: '8px 10px', fontSize: '12px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--t1)', fontFamily: "'Inter',sans-serif", resize: 'vertical', boxSizing: 'border-box', lineHeight: '1.5' }
      })
    ),

    // Send button + result
    React.createElement('button', {
      onClick: handleSend,
      disabled: !msgText.trim() || sending,
      style: {
        width: '100%', minHeight: '42px', borderRadius: '8px', border: 'none',
        background: lastResult === 'ok' ? 'var(--green)' : lastResult === 'err' ? 'var(--red)' : msgText.trim() ? '#2563EB' : 'var(--border)',
        color: msgText.trim() || lastResult ? '#fff' : 'var(--t3)',
        fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px',
        cursor: msgText.trim() && !sending ? 'pointer' : 'default',
        transition: 'background 0.2s'
      }
    }, sending ? '⏳ Sending...' : lastResult === 'ok' ? '✅ Sent!' : lastResult === 'err' ? '❌ Failed — Try Again' : '📱 SEND SMS'),

    // SMS history
    smsNotes.length > 0 && React.createElement('div', null,
      React.createElement('div', { style: { fontSize: '10px', fontWeight: '800', color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: '5px' } }, 'SENT HISTORY'),
      smsNotes.map((n, i) =>
        React.createElement('div', { key: n.ts || i, style: { fontSize: '11px', color: 'var(--t2)', padding: '6px 8px', background: 'var(--surface)', borderRadius: '5px', border: '1px solid var(--border)', marginBottom: '4px', lineHeight: '1.4' } },
          React.createElement('span', { style: { color: 'var(--t4)', marginRight: '5px' } },
            n.ts ? new Date(n.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
          ),
          n.text.replace('📱 SMS sent: ', '').replace('[SEQ] SMS sent — ', '')
        )
      )
    )
  );
}

// ── DialRightPanel — Script / Notes / SMS / Activity / Q's tabs ───────────
export default function DialRightPanel({
  panelExpanded, togglePanel,
  dialRightTab, setDialRightTab,
  open, upd,
  noteText, setNoteText,
  addNote,
  scripts, scriptType, setScriptType, scriptSection, setScriptSection,
  templates,
  sendSms,
}) {
  return React.createElement('div', { style: { width: panelExpanded ? '100%' : '300px', flexShrink: panelExpanded ? 1 : 0, flex: panelExpanded ? 1 : undefined, display: 'flex', flexDirection: 'column', background: 'var(--surface-2)', borderLeft: '1px solid var(--border)', overflow: 'hidden', transition: 'width 0.25s ease' } },

    // Tab bar
    React.createElement('div', {
      role: 'tablist', 'aria-label': 'Lead tools',
      style: { display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }
    },
      [['script', '📞', 'Script'], ['notes', '📝', 'Notes'], ['sms', '💬', 'SMS'], ['activity', '📋', 'Activity'], ['quals', '✅', "Q's"]].map(([tab, icon, lbl]) =>
        React.createElement('button', {
          key: tab, role: 'tab',
          'aria-selected': dialRightTab === tab,
          'aria-controls': 'dial-panel-' + tab,
          id: 'dial-tab-' + tab,
          onClick: () => setDialRightTab(tab),
          style: {
            flex: 1, minHeight: '44px', padding: '8px 4px',
            background: dialRightTab === tab ? 'var(--navy)' : 'transparent',
            color: dialRightTab === tab ? '#fff' : 'var(--t3)',
            border: 'none',
            borderBottom: dialRightTab === tab ? '2px solid var(--blue)' : '2px solid transparent',
            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '2px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', transition: 'all 0.1s'
          }
        },
          React.createElement('span', { 'aria-hidden': 'true', style: { fontSize: '14px' } }, icon),
          React.createElement('span', null, lbl)
        )
      ),
      // v3.38 — expand/collapse toggle
      React.createElement('button', {
        onClick: togglePanel,
        title: panelExpanded ? 'Show Queue' : 'Focus Mode',
        style: { padding:'0 10px', minHeight:'44px', background:'transparent', border:'none', borderBottom:'2px solid transparent', borderLeft:'1px solid var(--border)', cursor:'pointer', color:'var(--t3)', fontSize:'16px', flexShrink:0, lineHeight:1 }
      }, panelExpanded ? '◀' : '▶')
    ),

    // Tab panels
    React.createElement('div', { style: { flex: 1, overflowY: 'auto' } },

      // SCRIPT tab
      dialRightTab === 'script' && React.createElement('div', {
        id: 'dial-panel-script', role: 'tabpanel', 'aria-labelledby': 'dial-tab-script', style: { padding: '12px' }
      },
        React.createElement('div', { style: { marginBottom: '8px' } },
          React.createElement('label', { htmlFor: 'dial-script-type', className: 'sr-only' }, 'Script type'),
          React.createElement('select', {
            id: 'dial-script-type',
            value: (open && open.leadType && scripts[open.leadType]) ? open.leadType : scriptType,
            onChange: e => { setScriptType(e.target.value); setScriptSection(Object.keys(scripts[e.target.value] || {})[0] || 'phone'); },
            style: { ...inp(), fontSize: '11px', fontWeight: '700', padding: '5px 8px', width: '100%', marginBottom: '6px' }
          }, Object.keys(scripts).map(t => React.createElement('option', { key: t, value: t }, t))),
          React.createElement('div', { style: { display: 'flex', gap: '3px', flexWrap: 'wrap' } },
            Object.keys(scripts[(open && open.leadType && scripts[open.leadType]) ? open.leadType : scriptType] || {}).map(s =>
              React.createElement('button', {
                key: s, onClick: () => setScriptSection(s),
                style: { ...chip(scriptSection === s, '#2563EB'), fontSize: '11px', padding: '4px 8px', textTransform: 'capitalize', margin: 0 }
              }, s)
            )
          )
        ),
        React.createElement('div', { style: { fontFamily: "'Inter',system-ui,sans-serif", fontSize: '12px', color: '#334155', lineHeight: '2.0', whiteSpace: 'pre-wrap', background: 'var(--surface)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' } },
          ...(open
            ? renderLiveTokens((scripts[(open.leadType && scripts[open.leadType]) ? open.leadType : scriptType] || {})[scriptSection] || 'Select a section above.', open, upd)
            : ['Select a lead to load script.']
          )
        ),
        open && React.createElement('div', { style: { fontSize: '11px', color: 'var(--t3)', textAlign: 'center', marginTop: '6px', fontWeight: '500' } }, '🟡 Yellow = missing · 🟢 Green = on file')
      ),

      // NOTES tab
      dialRightTab === 'notes' && React.createElement('div', {
        id: 'dial-panel-notes', role: 'tabpanel', 'aria-labelledby': 'dial-tab-notes', style: { padding: '12px' }
      },
        React.createElement('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px' } },
          React.createElement('label', { htmlFor: 'dial-note-text', className: 'sr-only' }, 'Add note'),
          React.createElement('textarea', {
            id: 'dial-note-text', value: noteText, onChange: e => setNoteText(e.target.value),
            placeholder: 'What happened, next step...',
            style: { flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--t1)', padding: '8px 10px', fontSize: '12px', fontFamily: "'Inter',sans-serif", resize: 'none', minHeight: '60px', lineHeight: '1.5' }
          }),
          React.createElement('button', { onClick: () => { if (open) addNote(open.id); }, 'aria-label': 'Save note', style: { padding: '0 12px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '18px', cursor: 'pointer', alignSelf: 'stretch' } }, '→')
        ),
        open && (open.notes || []).length > 0
          ? React.createElement('div', null,
              React.createElement('div', { style: { fontSize: '11px', fontWeight: '800', color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: '8px' } }, 'HISTORY — ' + (open.notes || []).length + ' ENTRIES'),
              (open.notes || []).map((n, i) =>
                React.createElement('div', { key: n.ts || n.id || i, style: { marginBottom: '8px', padding: '8px 10px', background: 'var(--surface)', borderRadius: '7px', border: '1px solid var(--border)' } },
                  React.createElement('div', { style: { fontSize: '11px', color: NC[n.type] || 'var(--t3)', fontWeight: '800', marginBottom: '3px' } },
                    n.type === 'call' ? '📞 Call' : n.type === 'appointment' ? '📅 Appt' : '📝 Note', ' · ' + fmt(n.ts)
                  ),
                  React.createElement('div', { style: { fontSize: '12px', color: 'var(--t2)', lineHeight: '1.4' } }, n.text)
                )
              )
            )
          : React.createElement('div', { style: { textAlign: 'center', padding: '32px 0', color: 'var(--t4)', fontSize: '12px' } }, 'No notes yet.')
      ),

      // SMS tab — full thread (A2P approved 2026-06-01)
      dialRightTab === 'sms' && React.createElement(SmsThread, {
        key: open ? open.id : 'no-lead',
        open, upd, sendSms, height: '100%'
      }),

      // ACTIVITY tab
      dialRightTab === 'activity' && React.createElement('div', {
        id: 'dial-panel-activity', role: 'tabpanel', 'aria-labelledby': 'dial-tab-activity', style: { padding: '12px' }
      },
        React.createElement('div', { style: { fontSize: '11px', fontWeight: '800', color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: '10px' } }, 'ACTIVITY LOG'),
        open && (open.notes || []).length > 0
          ? React.createElement('div', null,
              (open.notes || []).slice().reverse().map((n, i) =>
                React.createElement('div', { key: n.ts || n.id || i, style: { marginBottom: '8px', padding: '8px 10px', background: 'var(--surface)', borderRadius: '7px', border: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'flex-start' } },
                  React.createElement('span', { 'aria-hidden': 'true', style: { fontSize: '14px', lineHeight: 1, flexShrink: 0, marginTop: '1px' } },
                    n.type === 'call' ? '📞' : n.type === 'appointment' ? '📅' : '📝'
                  ),
                  React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                    React.createElement('div', { style: { fontSize: '11px', fontWeight: '800', color: 'var(--t3)', marginBottom: '2px' } }, fmt(n.ts)),
                    React.createElement('div', { style: { fontSize: '11px', color: 'var(--t2)', lineHeight: '1.4', wordBreak: 'break-word' } }, n.text)
                  )
                )
              )
            )
          : React.createElement('div', { style: { textAlign: 'center', padding: '32px 0', color: 'var(--t4)', fontSize: '12px' } },
              open ? 'No activity logged yet.' : 'Select a lead to view activity.'
            )
      ),

      // Q's tab — Qualification checklist
      dialRightTab === 'quals' && React.createElement('div', {
        id: 'dial-panel-quals', role: 'tabpanel', 'aria-labelledby': 'dial-tab-quals', style: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }
      },
        React.createElement('div', { style: { fontSize: '11px', fontWeight: '800', color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: '4px' } }, '📋 CLIENT QUALIFICATION FORM'),

        // FINANCIAL & LIFESTYLE
        React.createElement('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' } },
          React.createElement('div', { style: { fontSize: '11px', fontWeight: '800', color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: '10px' } }, '💼 FINANCIAL & LIFESTYLE'),
          React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' } },
            ...[
              ['OCCUPATION / RETIRED', 'occupation', 'e.g., Retired (2018)'],
              ['EST. ANNUAL INCOME',   'annualIncome', '$50,000'],
              ['MORTGAGE BALANCE',     'mortgageBalance', '$250,000'],
              ['MONTHLY PAYMENT',      'mortgagePayment', '$1,500'],
              ['TERM LEFT',            'mortgageTerm', '20 yrs'],
              ['PRIMARY BENEFICIARY',  'beneficiary', 'Name & Relationship'],
            ].map(([label, field, placeholder]) =>
              React.createElement('div', { key: field },
                React.createElement('label', { style: { fontSize: '10px', fontWeight: '800', color: 'var(--t3)', display: 'block', marginBottom: '3px' } }, label),
                React.createElement('input', {
                  type: 'text', placeholder, defaultValue: open ? (open[field] || '') : '',
                  onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open[field] || '')) upd(open.id, { [field]: v }); } },
                  style: { ...inp(), width: '100%', fontSize: '11px', padding: '6px 8px', boxSizing: 'border-box' }
                })
              )
            )
          ),
          ...[
            ['EXISTING LIFE INSURANCE', 'existingInsurance', 'Company, Type, Death Benefit...', true],
            ['FINANCIAL CONCERNS / GOALS', 'financialGoals', 'What do they want to address with this coverage?', true],
          ].map(([label, field, placeholder]) =>
            React.createElement('div', { key: field, style: { marginBottom: '8px' } },
              React.createElement('label', { style: { fontSize: '10px', fontWeight: '800', color: 'var(--t3)', display: 'block', marginBottom: '3px' } }, label),
              React.createElement('textarea', {
                placeholder, defaultValue: open ? (open[field] || '') : '',
                onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open[field] || '')) upd(open.id, { [field]: v }); } },
                style: { ...inp(), width: '100%', minHeight: '36px', fontSize: '11px', padding: '6px 8px', boxSizing: 'border-box', resize: 'vertical' }
              })
            )
          )
        ),

        // HEALTH CONDITIONS
        React.createElement('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' } },
          React.createElement('div', { style: { fontSize: '11px', fontWeight: '800', color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: '10px' } }, '❤️ HEALTH CONDITIONS'),
          React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' } },
            ...[
              { id: 'heart',        label: 'Heart Disease/Attack' },
              { id: 'cancer',       label: 'Cancer or Tumors' },
              { id: 'stroke',       label: 'Stroke or TIA' },
              { id: 'diabetes',     label: 'Diabetes' },
              { id: 'lung',         label: 'Lung Disease/COPD' },
              { id: 'kidney_liver', label: 'Kidney/Liver Disease' },
              { id: 'mental',       label: 'Mental Health (Dep/Anx)' },
              { id: 'neuro',        label: 'Neurological (MS/Park)' },
            ].map(flag => {
              const checked = !!(open && Array.isArray(open.healthFlags) && open.healthFlags.includes(flag.id));
              return React.createElement('label', {
                key: flag.id,
                style: { display: 'flex', alignItems: 'flex-start', gap: '6px', cursor: 'pointer', padding: '5px 7px', borderRadius: '5px', background: checked ? 'rgba(239,68,68,0.12)' : 'transparent', border: '1px solid ' + (checked ? 'var(--red)' : 'var(--border)') }
              },
                React.createElement('input', {
                  type: 'checkbox', checked,
                  onChange: e => {
                    if (!open) return;
                    const cur = Array.isArray(open.healthFlags) ? [...open.healthFlags] : [];
                    const next = e.target.checked ? [...new Set([...cur, flag.id])] : cur.filter(f => f !== flag.id);
                    upd(open.id, { healthFlags: next });
                  },
                  style: { accentColor: 'var(--red)', cursor: 'pointer', marginTop: '2px' }
                }),
                React.createElement('span', {
                  style: { fontSize: '10px', lineHeight: '1.3', color: checked ? 'var(--red)' : 'var(--t2)', fontWeight: checked ? '800' : '600' }
                }, flag.label)
              );
            })
          ),
          ...[
            ['PRESCRIPTION MEDICATIONS', 'medicationsDetail', 'Names, dosages, frequencies, reasons...', '45px'],
            ['HOSPITALIZATIONS / SURGERIES (PAST 5 YRS)', 'surgeries5yr', 'Dates and reasons...', '36px'],
          ].map(([label, field, placeholder, minH]) =>
            React.createElement('div', { key: field, style: { marginBottom: '8px' } },
              React.createElement('label', { style: { fontSize: '10px', fontWeight: '800', color: 'var(--t3)', display: 'block', marginBottom: '3px' } }, label),
              React.createElement('textarea', {
                placeholder, defaultValue: open ? (open[field] || '') : '',
                onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open[field] || '')) upd(open.id, { [field]: v }); } },
                style: { ...inp(), width: '100%', minHeight: minH, fontSize: '11px', padding: '6px 8px', boxSizing: 'border-box', resize: 'vertical' }
              })
            )
          )
        ),

        // BACKGROUND & LIFESTYLE
        React.createElement('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' } },
          React.createElement('div', { style: { fontSize: '11px', fontWeight: '800', color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: '10px' } }, '⚠️ BACKGROUND & LIFESTYLE'),
          ...[
            ['TOBACCO / NICOTINE USE',            'tobaccoUseDetails', 'Type and frequency (e.g., Cigarettes, 1 pack/day)'],
            ['DRUG OR ALCOHOL ABUSE HISTORY',      'substanceAbuse',    'Treatment dates/details...'],
            ['DRIVING RECORD (Valid license? DUIs?)', 'drivingRecord',  'License status, DUIs, suspensions...'],
          ].map(([label, field, placeholder]) =>
            React.createElement('div', { key: field, style: { marginBottom: '8px' } },
              React.createElement('label', { style: { fontSize: '10px', fontWeight: '800', color: 'var(--t3)', display: 'block', marginBottom: '3px' } }, label),
              React.createElement('input', {
                type: 'text', placeholder, defaultValue: open ? (open[field] || '') : '',
                onBlur: e => { if (open) { const v = e.target.value.trim(); if (v !== (open[field] || '')) upd(open.id, { [field]: v }); } },
                style: { ...inp(), width: '100%', fontSize: '11px', padding: '6px 8px', boxSizing: 'border-box' }
              })
            )
          )
        ),

        // Auto-qualification signal
        (() => {
          if (!open) return React.createElement('div', { style: { textAlign: 'center', padding: '12px 0', color: 'var(--t4)', fontSize: '12px' } }, 'Select a lead to qualify.');
          const flags = Array.isArray(open.healthFlags) ? open.healthFlags : [];
          const pivot     = flags.length >= 2;
          const tableRate = !pivot && (!!open.tobacco || flags.length === 1);
          const signal = pivot
            ? { label: 'PIVOT',      color: 'var(--red)',   bg: 'rgba(239,68,68,0.08)',   border: 'var(--red)',   action: '→ Graded / Guaranteed Issue FE', icon: '⚠️' }
            : tableRate
            ? { label: 'TABLE RATE', color: 'var(--amber)', bg: 'rgba(245,158,11,0.08)',  border: 'var(--amber)', action: '→ Run quoted products · flag rate class', icon: '⚡' }
            : { label: 'CLEAN',      color: 'var(--green)', bg: 'rgba(16,185,129,0.08)',  border: 'var(--green)', action: '→ Book Household Protection Audit', icon: '✅' };
          return React.createElement('div', {
            style: { background: signal.bg, border: `1px solid ${signal.border}`, borderRadius: '8px', padding: '14px', textAlign: 'center' }
          },
            React.createElement('div', { style: { fontSize: '13px', fontWeight: '800', color: signal.color, letterSpacing: '0.08em', marginBottom: '5px' } }, signal.icon + ' ' + signal.label),
            React.createElement('div', { style: { fontSize: '11px', color: signal.color, fontWeight: '600' } }, signal.action)
          );
        })()
      )
    )
  );
}
