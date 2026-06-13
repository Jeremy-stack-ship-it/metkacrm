import React, { useState } from 'react';
import { fmt } from '../constants.js';

// ── APPOINTMENTS VIEW (v3.14) ─────────────────────────────────────
// Surfaces all appointment_booked leads in four sections:
//   Overdue  — past-due, apptConfirmed=false (modal handles resolution on lead open)
//   Today    — scheduled today, inline Showed/No-Show/Reschedule actions
//   Upcoming — next 7 days, open-lead link
//   Recent   — last 7 days of completed/no-show appointments (read-only)

const APPT_TYPE_LABELS = {
  household_audit: '🏠 Household Audit',
  policy_review:   '📋 Policy Review',
  annual_review:   '🔄 Annual Review',
  birthday:        '🎂 Birthday Call',
};

// ── STYLE HELPERS ─────────────────────────────────────────────────
const btn = (bg, color = '#fff', border = 'none', extra = {}) => ({
  padding: '6px 12px', borderRadius: '7px', border,
  background: bg, color, fontSize: '12px', fontWeight: '700',
  cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.4,
  ...extra,
});

const inputSt = {
  padding: '6px 8px', borderRadius: '7px', border: '1px solid var(--border)',
  background: 'var(--surface-2)', color: 'var(--t1)',
  fontSize: '12px', fontFamily: 'inherit',
};

export default function AppointmentsView({ leads, upd, logActivity, setOpenId, setView, setPrevView }) {
  const [rescheduleId,   setRescheduleId]   = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  // ── DERIVED DATA ──────────────────────────────────────────────────
  const now          = new Date();
  const todayStr     = now.toISOString().split('T')[0];
  const in7          = new Date(now); in7.setDate(in7.getDate() + 7);
  const ago7         = new Date(now); ago7.setDate(ago7.getDate() - 7);

  const booked = leads.filter(l => l.disposition === 'appointment_booked');

  const overdueAppts = booked
    .filter(l => l.nextCallback && !l.apptConfirmed &&
      new Date(l.nextCallback).toISOString().split('T')[0] < todayStr)
    .sort((a, b) => new Date(b.nextCallback) - new Date(a.nextCallback));

  const todayAppts = booked
    .filter(l => l.nextCallback &&
      new Date(l.nextCallback).toISOString().split('T')[0] === todayStr)
    .sort((a, b) => new Date(a.nextCallback) - new Date(b.nextCallback));

  const upcomingAppts = booked
    .filter(l => {
      if (!l.nextCallback) return false;
      const ds = new Date(l.nextCallback).toISOString().split('T')[0];
      return ds > todayStr && new Date(l.nextCallback) <= in7;
    })
    .sort((a, b) => new Date(a.nextCallback) - new Date(b.nextCallback));

  const recentAppts = leads
    .filter(l => l.disposition !== 'appointment_booked' && Array.isArray(l.notes) &&
      l.notes.some(n => n.ts && new Date(n.ts) >= ago7 &&
        (n.type === 'appointment' || (n.text && (n.text.includes('No-show') || n.text.includes('Showed for appointment'))))
      )
    )
    .sort((a, b) => {
      const latest = lead => {
        const hits = (lead.notes || []).filter(n =>
          n.type === 'appointment' || (n.text && (n.text.includes('No-show') || n.text.includes('Showed')))
        );
        return hits.length ? new Date(hits[0].ts).getTime() : 0;
      };
      return latest(b) - latest(a);
    })
    .slice(0, 20);

  // ── ACTIONS ───────────────────────────────────────────────────────
  const doShowed = lead => {
    upd(lead.id, {
      apptConfirmed: true,
      stage: 'presentation',
      notes: [
        { ts: new Date().toISOString(), type: 'appointment', text: '✅ Showed for appointment — ' + fmt(lead.nextCallback) },
        ...(lead.notes || []),
      ],
    });
    logActivity('appointment', lead.id, 'auto');
  };

  const doNoShow = lead => {
    upd(lead.id, {
      disposition: 'no_show',
      stage: 'contacted',
      nextCallback: null,
      apptConfirmed: true,
      notes: [
        { ts: new Date().toISOString(), type: 'call', text: '❌ No-show — appointment was ' + fmt(lead.nextCallback) },
        ...(lead.notes || []),
      ],
    });
  };

  const doReschedule = lead => {
    if (!rescheduleDate) return;
    const newDT = rescheduleTime ? rescheduleDate + 'T' + rescheduleTime : rescheduleDate;
    upd(lead.id, {
      nextCallback: newDT,
      apptConfirmed: false,
      notes: [
        { ts: new Date().toISOString(), type: 'appointment', text: '🔄 Rescheduled — new appointment: ' + fmt(newDT) },
        ...(lead.notes || []),
      ],
    });
    setRescheduleId(null); setRescheduleDate(''); setRescheduleTime('');
  };

  const openLead = lead => {
    setPrevView('appointments');
    setOpenId(lead.id);
    setView('contact');
  };

  // ── RENDERERS ─────────────────────────────────────────────────────

  // Time column — shows time + date
  const timeCol = lead => {
    if (!lead.nextCallback) return React.createElement('span', { style: { color: 'var(--t3)', fontSize: '12px' } }, 'No time');
    const d = new Date(lead.nextCallback);
    return React.createElement('div', null,
      React.createElement('div', { style: { fontSize: '14px', fontWeight: '800', color: 'var(--t1)' } },
        d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })),
      React.createElement('div', { style: { fontSize: '11px', color: 'var(--t3)', fontWeight: '600' } },
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    );
  };

  // Type chip
  const typeChip = lead => lead.apptType
    ? React.createElement('span', {
        style: {
          fontSize: '11pxpx', fontWeight: '700', letterSpacing: '0.05em',
          background: 'rgba(139,92,246,0.12)', color: '#7C3AED',
          borderRadius: '5px', padding: '2px 7px',
        },
      }, APPT_TYPE_LABELS[lead.apptType] || lead.apptType)
    : null;

  // Bucket chip
  const bucketChip = lead => React.createElement('span', {
    style: {
      fontSize: '11pxpx', fontWeight: '800', letterSpacing: '0.05em',
      color: lead.bucket === 'A' ? '#2563EB' : lead.bucket === 'B' ? '#10B981' : '#94A3B8',
      background: lead.bucket === 'A' ? 'rgba(37,99,235,0.1)' : lead.bucket === 'B' ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
      borderRadius: '4px', padding: '1px 6px',
    },
  }, `Bucket ${lead.bucket || '?'}`);

  // Actions column per section
  const actionsCol = (lead, section) => {
    if (section === 'overdue') {
      return React.createElement('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
        React.createElement('span', {
          style: {
            fontSize: '11pxpx', fontWeight: '800', color: '#D97706',
            background: '#FEF3C7', borderRadius: '6px', padding: '3px 9px', letterSpacing: '0.04em',
          },
        }, '⚠️ NEEDS CHECK-IN'),
        React.createElement('button', { onClick: () => openLead(lead), style: btn('var(--sky)') }, 'Open Lead →')
      );
    }

    if (rescheduleId === lead.id) {
      return React.createElement('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } },
        React.createElement('input', {
          type: 'date', value: rescheduleDate,
          onChange: e => setRescheduleDate(e.target.value),
          style: { ...inputSt, width: '120px' },
        }),
        React.createElement('input', {
          type: 'time', value: rescheduleTime,
          onChange: e => setRescheduleTime(e.target.value),
          style: { ...inputSt, width: '90px' },
        }),
        React.createElement('button', {
          onClick: () => doReschedule(lead), disabled: !rescheduleDate,
          style: btn(rescheduleDate ? 'var(--sky)' : 'var(--border)'),
        }, '✓ Save'),
        React.createElement('button', {
          onClick: () => { setRescheduleId(null); setRescheduleDate(''); setRescheduleTime(''); },
          style: btn('var(--surface-2)', 'var(--t2)', '1px solid var(--border)'),
        }, '✕')
      );
    }

    return React.createElement('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
      section === 'today' && React.createElement('button', {
        onClick: () => doShowed(lead),
        style: { ...btn('transparent', '#065F46', '1.5px solid #6EE7B7'), background: '#ECFDF5' },
      }, '✅ Showed'),
      section === 'today' && React.createElement('button', {
        onClick: () => doNoShow(lead),
        style: { ...btn('transparent', '#92400E', '1.5px solid #FCD34D'), background: '#FEF3C7' },
      }, '❌ No-Show'),
      React.createElement('button', {
        onClick: () => { setRescheduleId(lead.id); setRescheduleDate(''); setRescheduleTime(''); },
        style: { ...btn('transparent', '#1E40AF', '1.5px solid #93C5FD'), background: '#EFF6FF' },
      }, '🔄'),
      React.createElement('button', { onClick: () => openLead(lead), style: btn('var(--sky)') }, 'Open →')
    );
  };

  // Standard appointment row (overdue / today / upcoming)
  const apptRow = (lead, section) => React.createElement('div', {
    key: lead.id,
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 100px 110px auto',
      alignItems: 'center', gap: '12px',
      padding: '12px 16px',
      background: section === 'today' ? 'rgba(139,92,246,0.05)' : 'var(--surface)',
      border: section === 'today' ? '1px solid rgba(139,92,246,0.25)' : '1px solid var(--border)',
      borderRadius: '10px',
    },
  },
    // Name + phone + type chip
    React.createElement('div', null,
      React.createElement('div', { style: { fontSize: '14px', fontWeight: '800', color: 'var(--t1)', marginBottom: '3px' } }, lead.name || '—'),
      React.createElement('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } },
        React.createElement('span', { style: { fontSize: '12px', color: 'var(--t3)' } }, lead.phone || '—'),
        typeChip(lead),
      )
    ),
    // Time
    timeCol(lead),
    // State + bucket
    React.createElement('div', null,
      React.createElement('div', { style: { fontSize: '11px', fontWeight: '600', color: 'var(--t3)', marginBottom: '3px' } }, lead.state || ''),
      bucketChip(lead),
    ),
    // Actions
    actionsCol(lead, section)
  );

  // Recent row — read only
  const recentRow = lead => {
    const hit = (lead.notes || []).find(n =>
      n.type === 'appointment' || (n.text && (n.text.includes('No-show') || n.text.includes('Showed for appointment')))
    );
    const icon = hit && hit.text
      ? (hit.text.includes('✅') ? '✅' : hit.text.includes('❌') ? '❌' : '🔄')
      : '📅';

    return React.createElement('div', {
      key: lead.id,
      style: {
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 14px',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
      },
    },
      React.createElement('div', { style: { fontSize: '20px', lineHeight: 1, flexShrink: 0 } }, icon),
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { style: { fontSize: '13px', fontWeight: '800', color: 'var(--t1)' } }, lead.name || '—'),
        React.createElement('div', { style: { fontSize: '11px', color: 'var(--t3)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
          hit ? hit.text : '—')
      ),
      React.createElement('button', { onClick: () => openLead(lead), style: { ...btn('var(--sky)'), fontSize: '11px' } }, 'Open →')
    );
  };

  // Section wrapper
  const section = (title, items, renderFn, emptyMsg) => React.createElement('div', { style: { marginBottom: '28px' } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' } },
      React.createElement('div', {
        style: { fontSize: '12px', fontWeight: '800', color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase' },
      }, title),
      React.createElement('div', {
        style: {
          fontSize: '11px', fontWeight: '800',
          color: items.length ? 'var(--sky)' : 'var(--t3)',
          background: items.length ? 'rgba(14,165,233,0.1)' : 'var(--surface-2)',
          borderRadius: '10px', padding: '1px 8px',
        },
      }, String(items.length))
    ),
    items.length
      ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          ...items.map(l => renderFn(l))
        )
      : React.createElement('div', { style: { fontSize: '13px', color: 'var(--t3)', padding: '10px 0', fontStyle: 'italic' } }, emptyMsg)
  );

  const totalActive = overdueAppts.length + todayAppts.length + upcomingAppts.length;

  // ── RENDER ────────────────────────────────────────────────────────
  return React.createElement('div', {
    style: { flex: 1, overflowY: 'auto', padding: '20px 24px', background: 'var(--bg)' },
  },
    // Header
    React.createElement('div', { style: { marginBottom: '24px' } },
      React.createElement('div', { style: { fontSize: '18px', fontWeight: '900', color: 'var(--t1)' } }, '📅 Appointments'),
      React.createElement('div', { style: { fontSize: '12px', color: 'var(--t3)', marginTop: '3px' } },
        `${totalActive} active · ${recentAppts.length} recent`)
    ),

    // Overdue — only rendered when there are overdue items
    overdueAppts.length > 0 && section(
      '⚠️ Overdue — Open Lead to Resolve',
      overdueAppts,
      l => apptRow(l, 'overdue'),
      ''
    ),

    section('🔴 Today', todayAppts, l => apptRow(l, 'today'), 'No appointments scheduled for today.'),
    section('📆 Upcoming — Next 7 Days', upcomingAppts, l => apptRow(l, 'upcoming'), 'No upcoming appointments in the next 7 days.'),
    section('✅ Recent — Last 7 Days', recentAppts, recentRow, 'No appointment activity in the past 7 days.')
  );
}
