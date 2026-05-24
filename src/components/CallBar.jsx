import React, { useState } from 'react';

/**
 * CallBar — floating call control bar
 * Props: activeCall, callStatus, callElapsed, callMuted,
 *        activeCallLead, toggleMute, hangUp, sendDigit
 */
export default function CallBar({ activeCall, callStatus, callElapsed, callMuted, activeCallLead, toggleMute, hangUp, sendDigit }) {
  const [showNumpad, setShowNumpad] = useState(false);

  if (!activeCall) return null;

  const connected = callStatus === 'connected';
  const ringing   = callStatus === 'ringing';
  const accent    = connected ? '#10B981' : ringing ? '#3B82F6' : '#F59E0B';
  const timer     = connected
    ? `${Math.floor(callElapsed / 60)}:${String(callElapsed % 60).padStart(2, '0')}`
    : ringing ? 'Ringing…' : 'Connecting…';

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'var(--navy)', borderTop: `2px solid ${accent}`,
      padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '16px',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.4)'
    }}>

      {/* pulse dot */}
      <div style={{
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
        background: accent, boxShadow: `0 0 8px ${accent}`,
        animation: ringing ? 'pulse 1s infinite' : 'none',
      }} />

      {/* lead info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {activeCallLead ? activeCallLead.name : 'Unknown'}
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: "'JetBrains Mono',monospace" }}>
          {activeCallLead ? activeCallLead.phone : ''}
        </div>
      </div>

      {/* timer / status */}
      <div style={{ fontSize: '13px', fontWeight: 700, minWidth: 80, textAlign: 'center', color: accent }}>
        {timer}
      </div>

      {/* controls */}
      <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>

        {/* Keypad toggle — only usable when connected */}
        <button
          onClick={() => setShowNumpad(p => !p)}
          disabled={!connected}
          style={{
            padding: '8px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '12px',
            cursor: connected ? 'pointer' : 'not-allowed',
            background: showNumpad ? 'var(--blue)' : 'var(--surface-2)',
            color:      showNumpad ? '#fff' : 'var(--t2)',
            border:     showNumpad ? '1px solid var(--blue)' : '1px solid var(--border)',
            opacity: connected ? 1 : 0.45,
          }}
        >
          🔢 Keypad
        </button>

        {/* Keypad popover */}
        {showNumpad && connected && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 12px)', right: 0,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '16px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
            zIndex: 10000,
          }}>
            {['1','2','3','4','5','6','7','8','9','*','0','#'].map(key => (
              <button
                key={key}
                onClick={() => sendDigit && sendDigit(key)}
                style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  fontSize: '18px', fontWeight: 800, color: 'var(--t1)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseDown={e => e.currentTarget.style.background = 'var(--blue-dim, #1e3a5f)'}
                onMouseUp={e => e.currentTarget.style.background = 'var(--surface-2)'}
              >
                {key}
              </button>
            ))}
          </div>
        )}

        {/* Mute */}
        <button
          onClick={toggleMute}
          disabled={!connected}
          style={{
            padding: '8px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '12px',
            cursor: connected ? 'pointer' : 'not-allowed',
            background: callMuted ? '#78350f' : 'var(--surface-2)',
            color:      callMuted ? '#FDE68A' : 'var(--t2)',
            border:     callMuted ? '1px solid #F59E0B' : '1px solid var(--border)',
            opacity: connected ? 1 : 0.45,
          }}
        >
          {callMuted ? '🔇 Muted' : '🎙 Mute'}
        </button>
      </div>

      {/* hang up */}
      <button
        onClick={hangUp}
        style={{
          padding: '8px 22px', borderRadius: '8px', fontWeight: 800, fontSize: '12px',
          cursor: 'pointer', background: '#DC2626', color: '#fff', border: 'none', letterSpacing: '0.3px',
        }}
      >
        🔴 Hang Up
      </button>

    </div>
  );
}
