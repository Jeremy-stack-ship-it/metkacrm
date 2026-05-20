import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ccIsConnected, ccAuthorize, ccClearTokens,
  ccGetLists, ccSyncLeads, ccGetActivityStatus,
} from '../lib/ccIntegration.js';

// ── CC TAB (v3.15) ────────────────────────────────────────────────
// Full Constant Contact management:
//   • Connection status + connect/disconnect
//   • CC list browser with member counts
//   • Bucket + disposition filter + lead count preview
//   • Sync button → async activity status poller
//   • Sync history (last 10, localStorage)

const LS_CC_HISTORY = 'metka-cc-sync-history-v1';

const BUCKET_OPTS = [
  { id: 'A', label: '🔥 Bucket A — Hot',  color: '#2563EB' },
  { id: 'B', label: '🌡 Bucket B — Warm', color: '#10B981' },
  { id: 'C', label: '❄ Bucket C — Cold', color: '#94A3B8' },
];

const DISP_FILTERS = [
  { id: 'all',         label: 'All leads' },
  { id: 'has_email',   label: 'Has email only' },
  { id: 'interested',  label: 'Interested / Follow-up' },
  { id: 'no_answer',   label: 'No Answer / VM' },
];

// ── STYLE HELPERS ─────────────────────────────────────────────────
const card = (extra = {}) => ({
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: '14px', padding: '20px 22px', ...extra,
});

const btn = (bg, color = '#fff', border = 'none', extra = {}) => ({
  padding: '9px 16px', borderRadius: '8px', border,
  background: bg, color, fontSize: '13px', fontWeight: '700',
  cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.4, ...extra,
});

const label = (text) => React.createElement('div', {
  style: { fontSize: '11px', fontWeight: '800', color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' },
}, text);

// ── FILTER LOGIC ──────────────────────────────────────────────────
function applyFilter(leads, bucket, dispFilter) {
  let out = leads.filter(l => l.bucket === bucket);
  if (dispFilter === 'has_email')  out = out.filter(l => l.email);
  if (dispFilter === 'interested') out = out.filter(l => ['follow_up_needed', 'callback', 'appointment_booked'].includes(l.disposition));
  if (dispFilter === 'no_answer')  out = out.filter(l => ['no_answer', 'vm_left'].includes(l.disposition));
  return out;
}

// ── COMPONENT ─────────────────────────────────────────────────────
export default function CCTab({ leads }) {
  const [connected,     setConnected]     = useState(() => ccIsConnected());
  const [lists,         setLists]         = useState([]);
  const [listsLoading,  setListsLoading]  = useState(false);
  const [listsError,    setListsError]    = useState(null);
  const [selectedList,  setSelectedList]  = useState('');
  const [bucket,        setBucket]        = useState('A');
  const [dispFilter,    setDispFilter]    = useState('all');
  const [syncState,     setSyncState]     = useState('idle'); // idle|syncing|polling|done|error
  const [syncActivity,  setSyncActivity]  = useState(null);  // { activityId, total, state, errors }
  const [syncError,     setSyncError]     = useState(null);
  const [history,       setHistory]       = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_CC_HISTORY) || '[]'); } catch { return []; }
  });

  const pollRef = useRef(null);

  // ── LOAD LISTS ────────────────────────────────────────────────────
  const loadLists = useCallback(async () => {
    setListsLoading(true); setListsError(null);
    try {
      const data = await ccGetLists();
      setLists(data);
      if (data.length === 1) setSelectedList(data[0].id);
    } catch (e) {
      setListsError(e.message);
    } finally {
      setListsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected) loadLists();
    else { setLists([]); setSelectedList(''); }
  }, [connected, loadLists]);

  // ── CLEANUP POLL ON UNMOUNT ───────────────────────────────────────
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── DERIVED LEAD COUNT ────────────────────────────────────────────
  const filteredLeads = applyFilter(leads, bucket, dispFilter);
  const eligibleLeads = filteredLeads.filter(l => l.phone || l.email);

  // ── CONNECT / DISCONNECT ──────────────────────────────────────────
  const handleConnect = () => {
    ccClearTokens();
    ccAuthorize();
  };

  const handleDisconnect = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    ccClearTokens();
    setConnected(false);
    setLists([]); setSelectedList('');
    setSyncState('idle'); setSyncActivity(null);
  };

  // ── SYNC ──────────────────────────────────────────────────────────
  const handleSync = async () => {
    if (!selectedList || eligibleLeads.length === 0) return;
    const listName = lists.find(l => l.id === selectedList)?.name || selectedList;

    if (!window.confirm(
      `Sync ${eligibleLeads.length} leads (Bucket ${bucket}${dispFilter !== 'all' ? ' · ' + dispFilter : ''}) to "${listName}"?`
    )) return;

    setSyncState('syncing'); setSyncError(null); setSyncActivity(null);
    try {
      const res = await ccSyncLeads(eligibleLeads, selectedList);
      setSyncActivity({ activityId: res.activityId, total: res.count, state: 'processing', errors: 0 });
      setSyncState('polling');

      // Poll every 4 seconds for up to 3 minutes
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const status = await ccGetActivityStatus(res.activityId);
          setSyncActivity(prev => ({ ...prev, state: status.state, total: status.total ?? prev.total, errors: status.errors }));

          if (status.state === 'completed' || status.state === 'failed' || status.state === 'cancelled') {
            clearInterval(pollRef.current);
            setSyncState(status.state === 'completed' ? 'done' : 'error');

            // Save to history
            const entry = {
              id:       Date.now(),
              ts:       new Date().toISOString(),
              bucket,
              dispFilter,
              listName,
              count:    res.count,
              state:    status.state,
              errors:   status.errors,
            };
            setHistory(prev => {
              const next = [entry, ...prev].slice(0, 10);
              try { localStorage.setItem(LS_CC_HISTORY, JSON.stringify(next)); } catch {}
              return next;
            });
          }
        } catch {
          // Transient poll error — keep polling
        }

        if (attempts >= 45) { // 3 min timeout
          clearInterval(pollRef.current);
          setSyncState('error');
          setSyncError('Timed out waiting for CC to finish processing. Check your CC account — contacts may still be importing.');
        }
      }, 4000);

    } catch (e) {
      setSyncState('error');
      setSyncError(e.message);
    }
  };

  const resetSync = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setSyncState('idle'); setSyncActivity(null); setSyncError(null);
  };

  // ── RENDER ────────────────────────────────────────────────────────
  return React.createElement('div', {
    style: { flex: 1, overflowY: 'auto', padding: '20px 24px', background: 'var(--bg)' },
  },

    // ── HEADER ──────────────────────────────────────────────────────
    React.createElement('div', { style: { marginBottom: '22px' } },
      React.createElement('div', { style: { fontSize: '18px', fontWeight: '900', color: 'var(--t1)' } }, '📧 Constant Contact'),
      React.createElement('div', { style: { fontSize: '12px', color: 'var(--t3)', marginTop: '3px' } },
        'Push leads directly into CC email lists for drip campaigns')
    ),

    // ── CONNECTION STATUS CARD ───────────────────────────────────────
    React.createElement('div', { style: { ...card(), marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
        React.createElement('div', {
          style: {
            width: '10px', height: '10px', borderRadius: '50%',
            background: connected ? '#10B981' : '#EF4444',
            boxShadow: connected ? '0 0 8px #10B981' : 'none',
            flexShrink: 0,
          },
        }),
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: '14px', fontWeight: '800', color: 'var(--t1)' } },
            connected ? 'Connected to Constant Contact' : 'Not Connected'),
          React.createElement('div', { style: { fontSize: '11px', color: 'var(--t3)', marginTop: '2px' } },
            connected ? `${lists.length} list${lists.length !== 1 ? 's' : ''} available` : 'Connect your CC account to sync leads')
        )
      ),
      connected
        ? React.createElement('button', { onClick: handleDisconnect, style: btn('var(--surface-2)', 'var(--t2)', '1px solid var(--border)') }, '🔌 Disconnect')
        : React.createElement('button', { onClick: handleConnect, style: btn('#7C3AED') }, '🔗 Connect Constant Contact')
    ),

    // ── MAIN SYNC PANEL (only when connected) ───────────────────────
    connected && React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' } },

      // LEFT — Sync Config
      React.createElement('div', { style: card() },
        React.createElement('div', { style: { fontSize: '14px', fontWeight: '800', color: 'var(--t1)', marginBottom: '18px' } }, '🎯 Sync Setup'),

        // Bucket selector
        label('Bucket'),
        React.createElement('div', { style: { display: 'flex', gap: '8px', marginBottom: '16px' } },
          BUCKET_OPTS.map(b =>
            React.createElement('button', {
              key: b.id,
              onClick: () => { setBucket(b.id); resetSync(); },
              style: {
                flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                cursor: 'pointer', transition: 'all 0.15s',
                background: bucket === b.id ? b.color : 'var(--surface-2)',
                color: bucket === b.id ? '#fff' : 'var(--t3)',
                border: bucket === b.id ? `2px solid ${b.color}` : '2px solid transparent',
              },
            }, b.label)
          )
        ),

        // Disposition filter
        label('Filter'),
        React.createElement('select', {
          value: dispFilter,
          onChange: e => { setDispFilter(e.target.value); resetSync(); },
          style: {
            width: '100%', padding: '9px 10px', borderRadius: '8px',
            border: '1px solid var(--border)', background: 'var(--surface-2)',
            color: 'var(--t1)', fontSize: '13px', fontFamily: 'inherit', marginBottom: '16px',
          },
        },
          DISP_FILTERS.map(f => React.createElement('option', { key: f.id, value: f.id }, f.label))
        ),

        // Target list
        label('Target CC List'),
        listsLoading
          ? React.createElement('div', { style: { fontSize: '12px', color: 'var(--t3)', marginBottom: '16px' } }, '⏳ Loading lists…')
          : listsError
          ? React.createElement('div', { style: { fontSize: '12px', color: '#EF4444', marginBottom: '16px' } }, '⚠ ' + listsError)
          : React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' } },
              React.createElement('select', {
                value: selectedList,
                onChange: e => { setSelectedList(e.target.value); resetSync(); },
                style: {
                  flex: 1, padding: '9px 10px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                  color: 'var(--t1)', fontSize: '13px', fontFamily: 'inherit',
                },
              },
                React.createElement('option', { value: '' }, '— Select a list —'),
                lists.map(l => React.createElement('option', { key: l.id, value: l.id },
                  `${l.name} (${l.count} contacts)`))
              ),
              React.createElement('button', {
                onClick: loadLists,
                style: btn('var(--surface-2)', 'var(--t2)', '1px solid var(--border)', { padding: '9px 12px' }),
                title: 'Refresh lists',
              }, '↻')
            ),

        // Lead count preview
        React.createElement('div', {
          style: {
            background: 'var(--surface-2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px',
            border: '1px solid var(--border)',
          },
        },
          React.createElement('div', { style: { fontSize: '11px', fontWeight: '700', color: 'var(--t3)', marginBottom: '6px' } }, 'PREVIEW'),
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
            React.createElement('span', { style: { fontSize: '12px', color: 'var(--t2)' } }, `Bucket ${bucket} total`),
            React.createElement('span', { style: { fontSize: '12px', fontWeight: '700', color: 'var(--t1)' } }, filteredLeads.length)
          ),
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between' } },
            React.createElement('span', { style: { fontSize: '12px', color: 'var(--t2)' } }, 'Has phone or email'),
            React.createElement('span', { style: { fontSize: '13px', fontWeight: '800', color: '#7C3AED' } }, eligibleLeads.length)
          )
        ),

        // Sync button
        React.createElement('button', {
          onClick: handleSync,
          disabled: !selectedList || eligibleLeads.length === 0 || syncState === 'syncing' || syncState === 'polling',
          style: btn(
            (!selectedList || eligibleLeads.length === 0 || syncState === 'syncing' || syncState === 'polling')
              ? 'var(--border)' : '#7C3AED',
            '#fff', 'none',
            { width: '100%', padding: '12px', fontSize: '14px', opacity: syncState === 'syncing' || syncState === 'polling' ? 0.7 : 1 }
          ),
        },
          syncState === 'syncing' ? '⏳ Submitting…'
          : syncState === 'polling' ? '📡 Processing…'
          : `📤 Sync ${eligibleLeads.length} Leads to CC`
        )
      ),

      // RIGHT — Status + Lists
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },

        // Sync Status Card
        React.createElement('div', { style: card() },
          React.createElement('div', { style: { fontSize: '14px', fontWeight: '800', color: 'var(--t1)', marginBottom: '14px' } }, '📊 Sync Status'),

          syncState === 'idle' && React.createElement('div', { style: { fontSize: '13px', color: 'var(--t3)', fontStyle: 'italic' } },
            'No sync in progress. Configure and hit sync.'),

          (syncState === 'syncing' || syncState === 'polling') && React.createElement('div', null,
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' } },
              React.createElement('div', { style: { fontSize: '20px', animation: 'spin 1s linear infinite' } }, '⏳'),
              React.createElement('div', null,
                React.createElement('div', { style: { fontSize: '13px', fontWeight: '700', color: 'var(--t1)' } },
                  syncState === 'syncing' ? 'Submitting to Constant Contact…' : 'CC is processing your contacts…'),
                syncActivity && React.createElement('div', { style: { fontSize: '11px', color: 'var(--t3)', marginTop: '3px' } },
                  `Activity ID: ${syncActivity.activityId}`)
              )
            ),
            syncActivity && React.createElement('div', {
              style: { background: 'var(--surface-2)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--t2)' },
            },
              React.createElement('div', null, `Contacts submitted: ${syncActivity.total ?? '—'}`),
              React.createElement('div', null, `CC state: ${syncActivity.state}`)
            )
          ),

          syncState === 'done' && syncActivity && React.createElement('div', null,
            React.createElement('div', { style: { fontSize: '28px', marginBottom: '8px' } }, '✅'),
            React.createElement('div', { style: { fontSize: '14px', fontWeight: '800', color: '#065F46', marginBottom: '6px' } }, 'Sync Complete'),
            React.createElement('div', { style: { background: '#ECFDF5', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#065F46', marginBottom: '12px' } },
              React.createElement('div', null, `${syncActivity.total} contacts sent to CC`),
              syncActivity.errors > 0 && React.createElement('div', { style: { color: '#D97706', marginTop: '4px' } }, `⚠ ${syncActivity.errors} errors`)
            ),
            React.createElement('button', { onClick: resetSync, style: btn('var(--surface-2)', 'var(--t2)', '1px solid var(--border)', { width: '100%' }) }, 'Start New Sync')
          ),

          syncState === 'error' && React.createElement('div', null,
            React.createElement('div', { style: { fontSize: '28px', marginBottom: '8px' } }, '❌'),
            React.createElement('div', { style: { fontSize: '13px', fontWeight: '700', color: '#DC2626', marginBottom: '8px' } }, 'Sync Failed'),
            syncError && React.createElement('div', {
              style: { background: '#FEF2F2', borderRadius: '8px', padding: '10px 12px', fontSize: '11px', color: '#DC2626', marginBottom: '12px', wordBreak: 'break-word' },
            }, syncError),
            React.createElement('button', { onClick: resetSync, style: btn('var(--surface-2)', 'var(--t2)', '1px solid var(--border)', { width: '100%' }) }, 'Try Again')
          )
        ),

        // CC Lists Card
        React.createElement('div', { style: { ...card(), flex: 1 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' } },
            React.createElement('div', { style: { fontSize: '14px', fontWeight: '800', color: 'var(--t1)' } }, '📋 Your CC Lists'),
            React.createElement('button', { onClick: loadLists, style: btn('var(--surface-2)', 'var(--t3)', '1px solid var(--border)', { padding: '5px 10px', fontSize: '11px' }) }, '↻ Refresh')
          ),
          listsLoading
            ? React.createElement('div', { style: { fontSize: '12px', color: 'var(--t3)' } }, 'Loading…')
            : lists.length === 0
            ? React.createElement('div', { style: { fontSize: '12px', color: 'var(--t3)', fontStyle: 'italic' } }, 'No active lists in your CC account.')
            : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                lists.map(l =>
                  React.createElement('div', {
                    key: l.id,
                    onClick: () => setSelectedList(l.id),
                    style: {
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
                      background: selectedList === l.id ? 'rgba(124,58,237,0.08)' : 'var(--surface-2)',
                      border: selectedList === l.id ? '1.5px solid rgba(124,58,237,0.4)' : '1px solid var(--border)',
                      transition: 'all 0.12s',
                    },
                  },
                    React.createElement('div', { style: { fontSize: '13px', fontWeight: '700', color: 'var(--t1)' } }, l.name),
                    React.createElement('div', { style: { fontSize: '11px', fontWeight: '700', color: 'var(--t3)' } }, `${l.count} contacts`)
                  )
                )
              )
        )
      )
    ),

    // ── SYNC HISTORY ────────────────────────────────────────────────
    connected && history.length > 0 && React.createElement('div', { style: card() },
      React.createElement('div', { style: { fontSize: '14px', fontWeight: '800', color: 'var(--t1)', marginBottom: '12px' } }, '🕓 Sync History'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        history.map(h =>
          React.createElement('div', {
            key: h.id,
            style: {
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '9px 12px', background: 'var(--surface-2)', borderRadius: '8px',
              border: '1px solid var(--border)',
            },
          },
            React.createElement('div', { style: { fontSize: '16px', flexShrink: 0 } },
              h.state === 'completed' ? '✅' : '❌'),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { style: { fontSize: '12px', fontWeight: '700', color: 'var(--t1)' } },
                `Bucket ${h.bucket} → ${h.listName}`),
              React.createElement('div', { style: { fontSize: '11px', color: 'var(--t3)', marginTop: '2px' } },
                `${h.count} leads · ${h.dispFilter !== 'all' ? h.dispFilter + ' · ' : ''}${new Date(h.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`)
            ),
            h.errors > 0 && React.createElement('span', {
              style: { fontSize: '10px', fontWeight: '800', color: '#D97706', background: '#FEF3C7', borderRadius: '5px', padding: '2px 7px' },
            }, `${h.errors} errors`)
          )
        )
      )
    )
  );
}
