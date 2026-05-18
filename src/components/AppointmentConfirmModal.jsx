import React, { useState } from 'react';

// ── APPOINTMENT CONFIRMATION MODAL ──────────────────────────────────────────
// Full-screen lock — no X, no backdrop close. Must resolve before anything else.
export default function AppointmentConfirmModal({ open, upd, logActivity, fmt, onAdvance }) {
  const [confirmReschedule, setConfirmReschedule] = useState(false);
  const [confirmCbDate,     setConfirmCbDate]     = useState('');
  const [confirmCbTime,     setConfirmCbTime]     = useState('');
  const [resolved,          setResolved]          = useState(false);

  if (!open) return null;
  const first = (open.name || '').split(' ')[0];
  const apptTime = fmt(open.nextCallback);

  const handleShowed = () => {
    upd(open.id, {
      apptConfirmed: true,
      stage: 'presentation',
      notes: [{ ts: new Date().toISOString(), type: 'appointment', text: '✅ Showed for appointment — ' + apptTime }, ...(open.notes || [])]
    });
    logActivity('appointment', open.id, 'auto');
    setConfirmReschedule(false);
    setResolved('showed');
  };

  const handleNoShow = () => {
    upd(open.id, {
      disposition: 'no_show',
      stage: 'contacted',
      nextCallback: null,
      apptConfirmed: true,
      notes: [{ ts: new Date().toISOString(), type: 'call', text: '❌ No-show — appointment was ' + apptTime }, ...(open.notes || [])]
    });
    setConfirmReschedule(false);
    setResolved('no_show');
  };

  const handleConfirmReschedule = () => {
    if (!confirmCbDate) return;
    const newDT = confirmCbTime ? (confirmCbDate + 'T' + confirmCbTime) : confirmCbDate;
    upd(open.id, {
      nextCallback: newDT,
      apptConfirmed: false,
      notes: [{ ts: new Date().toISOString(), type: 'appointment', text: '🔄 Rescheduled — new appointment: ' + fmt(newDT) }, ...(open.notes || [])]
    });
    setConfirmReschedule(false);
    setConfirmCbDate('');
    setConfirmCbTime('');
    setResolved('rescheduled');
  };

  return React.createElement('div', {
    style: {
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(10, 15, 30, 0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }
  },
    React.createElement('div', {
      style: {
        background: 'var(--surface)', borderRadius: '18px',
        padding: '32px 28px 28px',
        maxWidth: '460px', width: 'calc(100% - 40px)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        border: '2px solid var(--border)'
      }
    },
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }
      },
        React.createElement('div', { style: { fontSize: '28px', lineHeight: 1 } }, '📅'),
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: '11px', fontWeight: '800', color: 'var(--navy)', letterSpacing: '0.08em', textTransform: 'uppercase' } }, 'Ministry of Protection'),
          React.createElement('div', { style: { fontSize: '14px', fontWeight: '800', color: 'var(--t1)', marginTop: '2px' } }, 'Appointment Check-In')
        )
      ),

      React.createElement('div', {
        style: { background: 'var(--surface-2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '22px', border: '1px solid var(--border)' }
      },
        React.createElement('div', { style: { fontSize: '16px', fontWeight: '800', color: 'var(--t1)', marginBottom: '4px' } }, open.name || ''),
        React.createElement('div', { style: { fontSize: '12px', color: 'var(--t3)', fontWeight: '600' } }, '🗓  Appointment was scheduled for ' + apptTime)
      ),

      !resolved && React.createElement('div', {
        style: { fontSize: '15px', fontWeight: '700', color: 'var(--t1)', marginBottom: '18px', lineHeight: '1.4' }
      }, 'Did ' + first + ' show up?'),

      resolved
        ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '8px 0' } },
            React.createElement('div', { style: { fontSize: '32px' } },
              resolved === 'showed' ? '✅' : resolved === 'no_show' ? '❌' : '🔄'
            ),
            React.createElement('div', { style: { fontSize: '15px', fontWeight: '700', color: 'var(--t1)', textAlign: 'center' } },
              resolved === 'showed' ? 'Logged — Presentation In Progress'
              : resolved === 'no_show' ? 'No-Show Logged — Phase Reset'
              : 'Rescheduled — New Appointment Set'
            ),
            onAdvance && React.createElement('button', {
              onClick: onAdvance,
              style: {
                marginTop: '8px', minHeight: '52px', width: '100%',
                background: 'var(--sky)', color: '#fff',
                border: 'none', borderRadius: '10px',
                fontSize: '15px', fontWeight: '800', cursor: 'pointer',
                letterSpacing: '0.02em'
              }
            }, 'Next Lead →')
          )
        : confirmReschedule
        ? React.createElement('div', null,
            React.createElement('div', { style: { fontSize: '11px', fontWeight: '800', color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: '10px' } }, 'SET NEW DATE & TIME'),
            React.createElement('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px' } },
              React.createElement('input', {
                type: 'date', value: confirmCbDate, onChange: e => setConfirmCbDate(e.target.value),
                style: { flex: 1, padding: '9px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--t1)', fontSize: '13px', fontFamily: 'inherit' }
              }),
              React.createElement('input', {
                type: 'time', value: confirmCbTime, onChange: e => setConfirmCbTime(e.target.value),
                style: { width: '100px', padding: '9px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--t1)', fontSize: '13px', fontFamily: 'inherit' }
              })
            ),
            React.createElement('div', { style: { display: 'flex', gap: '8px' } },
              React.createElement('button', {
                onClick: () => { setConfirmReschedule(false); setConfirmCbDate(''); setConfirmCbTime(''); },
                style: { flex: 1, minHeight: '44px', background: 'var(--surface-2)', color: 'var(--t2)', border: '1px solid var(--border)', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }
              }, '← Back'),
              React.createElement('button', {
                onClick: handleConfirmReschedule, disabled: !confirmCbDate,
                style: {
                  flex: 2, minHeight: '44px',
                  background: confirmCbDate ? 'var(--sky)' : 'var(--border)',
                  color: confirmCbDate ? '#fff' : 'var(--t3)',
                  border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '800',
                  cursor: confirmCbDate ? 'pointer' : 'default'
                }
              }, '✓ Confirm Reschedule')
            )
          )
        : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
            React.createElement('button', {
              onClick: handleShowed,
              style: { minHeight: '54px', padding: '14px 16px', background: '#ECFDF5', color: '#065F46', border: '2px solid #6EE7B7', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }
            }, '✅  Showed — They Made It'),
            React.createElement('button', {
              onClick: handleNoShow,
              style: { minHeight: '54px', padding: '14px 16px', background: '#FEF3C7', color: '#92400E', border: '2px solid #FCD34D', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }
            }, '❌  No-Show — They Ghosted'),
            React.createElement('button', {
              onClick: () => setConfirmReschedule(true),
              style: { minHeight: '54px', padding: '14px 16px', background: '#EFF6FF', color: '#1E40AF', border: '2px solid #93C5FD', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }
            }, '🔄  Rescheduled — Set New Time')
          )
    )
  );
}
