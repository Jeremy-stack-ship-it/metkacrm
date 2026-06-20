import React from 'react';

const digits = (p) => (p || '').replace(/\D/g, '').slice(-10);
const noteCount = (l) => (l.notes || []).length;
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch (e) { return ''; } };

// v3.94 — Duplicate finder + merge. Groups leads by 10-digit phone.
// In-app delete (tombstone) is the ONLY way dupe removal sticks across sync.
export default function DuplicatesView({ leads = [], setOpenId, setView, setPrevView = () => {}, deleteLead, upd }) {
  const groups = React.useMemo(() => {
    const m = new Map();
    (leads || []).forEach(l => {
      if (!l) return;
      const p = digits(l.phone);
      if (p.length < 10) return;
      if (!m.has(p)) m.set(p, []);
      m.get(p).push(l);
    });
    return [...m.entries()]
      .filter(([, ls]) => ls.length > 1)
      .map(([p, ls]) => ({ phone: p, leads: ls.slice().sort((a, b) => noteCount(b) - noteCount(a)) }))
      .sort((a, b) => b.leads.length - a.leads.length);
  }, [leads]);

  const openLead = (id) => { setPrevView('duplicates'); setOpenId(id); setView('contact'); };

  const mergeGroup = (group) => {
    const keeper = group.leads[0];
    const others = group.leads.slice(1);
    if (!keeper || !others.length) return;
    if (!window.confirm(
      'Merge ' + others.length + ' duplicate' + (others.length > 1 ? 's' : '') +
      ' into "' + (keeper.name || keeper.phone) + '"?\n\nTheir notes move into this lead, then the duplicates are deleted for good.'
    )) return;
    let notes = [...(keeper.notes || [])];
    others.forEach(o => { notes = notes.concat(o.notes || []); });
    const seen = new Set();
    notes = notes
      .filter(n => { const k = (n.ts || '') + '|' + (n.text || ''); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
    const patch = { notes };
    ['email', 'state', 'zip', 'age', 'gender', 'requestedCoverage', 'beneficiary', 'employment', 'dob', 'city', 'source'].forEach(f => {
      if (!keeper[f]) { const v = others.map(o => o[f]).find(Boolean); if (v) patch[f] = v; }
    });
    upd(keeper.id, patch);
    others.forEach(o => deleteLead(o.id, true)); // skipConfirm — already confirmed once above
  };

  return React.createElement('div', { style: { padding: '20px', maxWidth: '900px', margin: '0 auto' } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' } },
      React.createElement('div', { style: { fontSize: '18px', fontWeight: '800', color: 'var(--t1)' } }, '🔀 Duplicate Leads'),
      React.createElement('div', { style: { fontSize: '12px', color: 'var(--t3)', fontWeight: '600' } }, groups.length + ' group' + (groups.length !== 1 ? 's' : ''))
    ),
    React.createElement('div', { style: { fontSize: '12px', color: 'var(--t3)', marginBottom: '16px', lineHeight: '1.6' } },
      'Leads sharing a phone number. The one with the most history is the KEEPER (top). "Merge & keep" pulls the others’ notes in and deletes them. Deletes here stick — they tombstone so they can’t resync back.'
    ),
    groups.length === 0 && React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: 'var(--t4)', fontSize: '13px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' } }, '✅ No duplicates found — clean database.'),
    groups.map(group =>
      React.createElement('div', { key: group.phone, style: { background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: '12px' } },
        React.createElement('div', { style: { fontSize: '12px', fontWeight: '800', color: 'var(--t2)', fontFamily: "'JetBrains Mono',monospace", marginBottom: '10px' } }, '📞 ' + group.phone + ' · ' + group.leads.length + ' copies'),
        group.leads.map((l, i) =>
          React.createElement('div', { key: l.id, style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', marginBottom: '6px', background: i === 0 ? 'var(--green-dim)' : 'var(--surface-2)', border: '1px solid ' + (i === 0 ? '#6EE7B7' : 'var(--border)') } },
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { style: { fontSize: '13px', fontWeight: '700', color: 'var(--t1)' } },
                (l.name || 'Unknown'),
                i === 0 && React.createElement('span', { style: { marginLeft: '6px', fontSize: '9px', fontWeight: '800', color: 'var(--green)', background: 'var(--green-dim)', borderRadius: '4px', padding: '1px 5px' } }, 'KEEPER'),
                l.source === 'razor_ridge' && React.createElement('span', { style: { marginLeft: '6px', fontSize: '9px', fontWeight: '800', color: '#EF4444', background: 'rgba(239,68,68,0.12)', borderRadius: '4px', padding: '1px 5px' } }, 'RR')
              ),
              React.createElement('div', { style: { fontSize: '11px', color: 'var(--t3)' } }, noteCount(l) + ' notes · ' + (l.disposition || 'new') + (l.assignDate ? ' · ' + fmtDate(l.assignDate) : ''))
            ),
            React.createElement('button', { onClick: () => openLead(l.id), style: { fontSize: '11px', fontWeight: '700', color: 'var(--blue)', background: 'var(--blue-dim)', border: '1px solid var(--blue-mid)', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer' } }, 'Open'),
            React.createElement('button', { onClick: () => deleteLead(l.id), style: { fontSize: '11px', fontWeight: '700', color: 'var(--red)', background: 'var(--red-dim)', border: '1px solid #FCA5A5', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer' } }, 'Delete')
          )
        ),
        React.createElement('button', { onClick: () => mergeGroup(group), style: { marginTop: '4px', fontSize: '12px', fontWeight: '800', color: '#fff', background: '#8B5CF6', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer' } }, '🔗 Merge & keep "' + (group.leads[0].name || group.leads[0].phone) + '"')
      )
    )
  );
}
