import React from 'react';

// ── SEQUENCE RUNS TAB (v3.21) ─────────────────────────────────────────────────
// Displays the history of automated cron runs from the sequence_runs Supabase
// table plus a live breakdown of all leads by sequence state.
//
// Props:
//   leads    — full leads array from App state
//   seqStats — array of sequence_runs rows (newest first), or null if not loaded

export default function SequenceRunsTab({ leads = [], seqStats = null }) {

  const now = new Date();

  // ── Live lead state computed from leads prop ─────────────────────
  const activeLeads  = leads.filter(l => !l.archived && !l.invalid);
  const seqActive    = activeLeads.filter(l => !!l.seqTrack && !l.seqPaused && !l.seqExitReason);
  const seqPaused    = activeLeads.filter(l => !!l.seqTrack && !!l.seqPaused);
  const seqExited    = activeLeads.filter(l => !!l.seqTrack && !!l.seqExitReason);
  const seqBounced   = leads.filter(l => !!l.emailBounced);
  const seqNone      = activeLeads.filter(l => !l.seqTrack);

  const TRACKS = [
    { key: 'new',       label: '🆕 New Lead',    color: 'var(--blue)'  },
    { key: 're-engage', label: '🔁 Re-Engage',    color: 'var(--amber)' },
    { key: 'ghost',     label: '👻 Ghost',         color: 'var(--red)'   },
    { key: 'nurture',   label: '🌱 Nurture',       color: 'var(--green)' },
    { key: 'lbl',       label: '🔥 LBL',           color: '#a78bfa'      },
  ];

  const trackCounts = {};
  TRACKS.forEach(t => {
    trackCounts[t.key] = seqActive.filter(l => l.seqTrack === t.key);
  });

  // ── Helpers ──────────────────────────────────────────────────────
  function fmtRunTime(ts) {
    if (!ts) return '—';
    const d    = new Date(ts);
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    const hm   = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString())   return 'Today ' + hm;
    if (d.toDateString() === yest.toDateString())  return 'Yesterday ' + hm;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + hm;
  }

  function fmtRelative(ts) {
    if (!ts) return '—';
    const diffMs  = now - new Date(ts);
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 2)    return 'just now';
    if (diffMin < 60)   return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24)    return `${diffHr}h ago`;
    const diffDy = Math.round(diffHr / 24);
    return `${diffDy}d ago`;
  }

  const lastRun  = seqStats && seqStats.length > 0 ? seqStats[0] : null;
  const errCount = lastRun ? (Array.isArray(lastRun.errors) ? lastRun.errors.length : 0) : 0;
  const hasErrors = errCount > 0;

  const loading = seqStats === null;

  // ── Stat pill component ───────────────────────────────────────────
  const StatRow = ({ label, val, color = '#e2e8f0' }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{label}</span>
      <span style={{ fontSize: '0.88rem', fontWeight: 700, color, fontFamily: "'JetBrains Mono',monospace" }}>{val ?? '—'}</span>
    </div>
  );

  return (
    <div style={{ flex: 1, width: '100%', height: '100%', overflowY: 'auto', background: 'var(--surface-2)' }}>
      <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto', fontFamily: 'inherit' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#e2e8f0', fontFamily: "'Syne',sans-serif", letterSpacing: '0.03em' }}>
              🤖 Sequence Engine
            </h2>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              Daily cron · 8AM UTC · Supabase Edge Function
            </div>
          </div>
          {lastRun && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Last run</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: hasErrors ? 'var(--red)' : 'var(--green)' }}>
                {fmtRunTime(lastRun.ran_at)}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#475569' }}>{fmtRelative(lastRun.ran_at)}</div>
            </div>
          )}
        </div>

        {/* Top row: last run detail + live state */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>

          {/* Last Cron Run */}
          <div style={{ background: 'var(--navy-2)', borderRadius: 10, padding: '1.25rem', border: `1px solid ${hasErrors ? 'rgba(239,68,68,0.4)' : 'rgba(99,102,241,0.3)'}` }}>
            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#e2e8f0', marginBottom: '0.9rem', letterSpacing: '0.04em' }}>
              LAST RUN SUMMARY
            </div>
            {loading ? (
              <div style={{ color: '#475569', fontSize: '0.82rem' }}>Loading…</div>
            ) : !lastRun ? (
              <div style={{ color: '#475569', fontSize: '0.82rem', lineHeight: 1.6 }}>
                No run data yet.<br />
                The cron fires automatically at 8AM UTC each day.<br />
                <span style={{ color: '#334155', fontSize: '0.72rem' }}>First run will appear here after tomorrow morning.</span>
              </div>
            ) : (
              <>
                <StatRow label="Leads Scanned (Total)"  val={lastRun.total}       color="#e2e8f0" />
                <StatRow label="Active in Sequence"     val={lastRun.active}      color="var(--blue)" />
                <StatRow label="Processed (steps sent)" val={lastRun.processed}   color="var(--green)" />
                <StatRow label="Emails Sent"            val={lastRun.emails_sent} color="var(--blue)" />
                <StatRow label="SMS Sent"               val={lastRun.sms_sent}    color="#a78bfa" />
                <StatRow label="Skipped"                val={lastRun.skipped}     color="#64748b" />
                <StatRow label="Archived (exhausted)"   val={lastRun.archived}    color="var(--amber)" />

                {hasErrors && (
                  <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: 7, border: '1px solid rgba(239,68,68,0.35)' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--red)', marginBottom: '0.4rem' }}>
                      ⚠ {errCount} ERROR{errCount > 1 ? 'S' : ''} — review and fix before next run
                    </div>
                    {(lastRun.errors || []).map((e, i) => (
                      <div key={i} style={{ fontSize: '0.65rem', color: '#fca5a5', fontFamily: "'JetBrains Mono',monospace", marginBottom: '0.2rem', wordBreak: 'break-all', lineHeight: 1.4 }}>
                        {i + 1}. {e}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Live Sequence State */}
          <div style={{ background: 'var(--navy-2)', borderRadius: 10, padding: '1.25rem', border: '1px solid var(--navy-3)' }}>
            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#e2e8f0', marginBottom: '0.9rem', letterSpacing: '0.04em' }}>
              LIVE SEQUENCE STATE
            </div>

            <div style={{ marginBottom: '0.5rem', fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Tracks</div>
            {TRACKS.map(({ key, label, color }) => {
              const arr = trackCounts[key];
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {arr.length > 0 && (
                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                        step {[...new Set(arr.map(l => l.seqStep || 0))].sort((a,b)=>a-b).join('/')}
                      </span>
                    )}
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: arr.length > 0 ? color : '#334155', fontFamily: "'JetBrains Mono',monospace", minWidth: '1.5rem', textAlign: 'right' }}>
                      {arr.length}
                    </span>
                  </div>
                </div>
              );
            })}

            <div style={{ height: '1px', background: 'var(--navy-3)', margin: '0.6rem 0' }} />
            <div style={{ marginBottom: '0.4rem', fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Other States</div>

            {[
              { label: 'Paused',          val: seqPaused.length,  color: 'var(--amber)' },
              { label: 'Exited / Done',   val: seqExited.length,  color: '#475569'      },
              { label: '⚠ Email Bounced', val: seqBounced.length, color: 'var(--red)'   },
              { label: 'Not Enrolled',    val: seqNone.length,    color: '#334155'      },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{label}</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color, fontFamily: "'JetBrains Mono',monospace" }}>{val}</span>
              </div>
            ))}

            <div style={{ marginTop: '0.9rem', padding: '0.55rem 0.7rem', background: 'var(--navy)', borderRadius: 7, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Total in sequence</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#e2e8f0', fontFamily: "'JetBrains Mono',monospace" }}>
                {seqActive.length + seqPaused.length + seqExited.length}
              </span>
            </div>
          </div>
        </div>

        {/* Run History Table */}
        <div style={{ background: 'var(--navy-2)', borderRadius: 10, padding: '1.25rem', border: '1px solid var(--navy-3)' }}>
          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#e2e8f0', marginBottom: '0.9rem', letterSpacing: '0.04em' }}>
            RUN HISTORY <span style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 400 }}>(last 14 runs)</span>
          </div>

          {loading ? (
            <div style={{ color: '#475569', fontSize: '0.82rem', padding: '1rem 0' }}>Loading run history…</div>
          ) : !seqStats || seqStats.length === 0 ? (
            <div style={{ color: '#475569', fontSize: '0.82rem', padding: '1rem 0', textAlign: 'center' }}>
              No runs recorded yet. First entry appears after the next 8AM UTC cron fires.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ color: '#64748b' }}>
                  {['Run Time', 'Total', 'Active', 'Processed', 'Emails', 'SMS', 'Skipped', 'Archived', 'Errors'].map(h => (
                    <th key={h} style={{ padding: '0.35rem 0.6rem', borderBottom: '1px solid var(--navy-3)', textAlign: h === 'Run Time' ? 'left' : 'right', fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seqStats.map((run, idx) => {
                  const errs = Array.isArray(run.errors) ? run.errors.length : 0;
                  const isLatest = idx === 0;
                  return (
                    <tr key={run.id} style={{ borderBottom: '1px solid rgba(51,59,84,0.5)', background: isLatest ? 'rgba(99,102,241,0.06)' : 'transparent' }}>
                      <td style={{ padding: '0.45rem 0.6rem', color: isLatest ? '#e2e8f0' : '#94a3b8', fontWeight: isLatest ? 700 : 400, whiteSpace: 'nowrap' }}>
                        {fmtRunTime(run.ran_at)}
                        {isLatest && <span style={{ marginLeft: '0.5rem', fontSize: '0.6rem', background: 'rgba(99,102,241,0.3)', color: '#a5b4fc', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>LATEST</span>}
                      </td>
                      {[run.total, run.active, run.processed, run.emails_sent, run.sms_sent, run.skipped, run.archived].map((val, i) => (
                        <td key={i} style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", color: '#94a3b8', fontWeight: 600 }}>{val ?? '—'}</td>
                      ))}
                      <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: errs > 0 ? 'var(--red)' : '#334155' }}>
                        {errs > 0 ? `⚠ ${errs}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
