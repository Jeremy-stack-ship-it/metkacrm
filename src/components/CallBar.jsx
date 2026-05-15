import React from 'react';

/**
 * CallBar — floating call control bar
 * Props: activeCall, callStatus, callElapsed, callMuted,
 *        activeCallLead, toggleMute, hangUp
 */
export default function CallBar({ activeCall, callStatus, callElapsed, callMuted, activeCallLead, toggleMute, hangUp }) {
  if (!activeCall) return null;

  const connected = callStatus === 'connected';
  const accent    = connected ? '#10B981' : '#F59E0B';
  const timer     = connected
    ? `${Math.floor(callElapsed / 60)}:${String(callElapsed % 60).padStart(2, '0')}`
    : 'Connecting…';

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
        background: accent, boxShadow: `0 0 8px ${accent}`
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
      <div style={{ fontSize: '13px', fontWeight: 700, minWidth: 70, textAlign: 'center', color: accent }}>
        {timer}
      </div>

      {/* mute */}
      <button
        onClick={toggleMute}
        style={{
          padding: '8px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
          background: callMuted ? '#78350f' : 'var(--surface-2)',
          color:      callMuted ? '#FDE68A' : 'var(--t2)',
          border:     callMuted ? '1px solid #F59E0B' : '1px solid var(--border)'
        }}
      >
        {callMuted ? '🔇 Muted' : '🎙 Mute'}
      </button>

      {/* hang up */}
      <button
        onClick={hangUp}
        style={{
          padding: '8px 22px', borderRadius: '8px', fontWeight: 800, fontSize: '12px', cursor: 'pointer',
          background: '#DC2626', color: '#fff', border: 'none', letterSpacing: '0.3px'
        }}
      >
        🔴 Hang Up
      </button>

    </div>
  );
}
