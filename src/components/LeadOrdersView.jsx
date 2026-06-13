// ── LEAD ORDERS VIEW (v3.51 — Session 5) ─────────────────────────────────────
// Per-lead-order P&L: spend vs money-in, break-even date, ROI — by source/level.
// "On this lead order, here's what I got out of it." — the Derick dashboard.
import React, { useMemo } from 'react';
import { orderRollup, medianDaysToBE } from '../lib/leadOrders.js';

const fmt$ = (n) => (n == null ? '—' : '$' + Math.round(n).toLocaleString());
const fmtD = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—');

export default function LeadOrdersView({ leads }) {
  const rows = useMemo(() => orderRollup(leads), [leads]);
  const medians = useMemo(() => medianDaysToBE(rows), [rows]);
  const totals = useMemo(() => rows.reduce((t, r) => ({
    spend: t.spend + r.spend, moneyIn: t.moneyIn + r.moneyIn, apps: t.apps + r.apps,
  }), { spend: 0, moneyIn: 0, apps: 0 }), [rows]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--surface-2)', padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '17px', color: 'var(--t1)', letterSpacing: '1px' }}>LEAD ORDER ECONOMICS</div>
        <div style={{ fontSize: '11px', color: 'var(--t3)', fontWeight: 600 }}>
          Total spend {fmt$(totals.spend)} · collected {fmt$(totals.moneyIn)} · net <span style={{ color: totals.moneyIn - totals.spend >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 800 }}>{fmt$(totals.moneyIn - totals.spend)}</span> · {totals.apps} apps
        </div>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--t4)', marginBottom: '14px' }}>
        Spend = Σ lead cost (Funnel PurchaseAmount). Money in = commission + advance recorded per lead (chargebacks subtract). Enter dollars on the lead page → 💰 App Economics.
      </div>

      {Object.keys(medians).length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {Object.entries(medians).map(([lvl, d]) => (
            <span key={lvl} style={{ fontSize: '11pxpx', fontWeight: 800, color: 'var(--blue)', background: 'var(--blue-dim)', border: '1px solid var(--blue-mid)', padding: '4px 10px', borderRadius: '20px' }}>
              {lvl}: median {d}d to break even
            </span>
          ))}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '880px' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {['Order', 'Source', 'Level', 'Start', 'Leads', 'Spend', 'Appts', 'Sat', 'Apps', 'APV', 'Collected', 'Net', 'ROI', 'Break-even', 'Days'].map(h => (
                <th key={h} style={{ padding: '9px 10px', textAlign: h === 'Order' ? 'left' : 'right', fontSize: '11pxpx', fontWeight: 800, color: 'var(--t3)', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--t1)', whiteSpace: 'nowrap', maxWidth: '210px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--t3)' }}>{r.source}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--t2)', fontWeight: 700 }}>{r.level}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--t3)', whiteSpace: 'nowrap' }}>{fmtD(r.orderStart)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--t2)' }}>{r.leadCount}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--t1)', fontWeight: 700 }}>{fmt$(r.spend)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--t2)' }}>{r.apptsSet}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--t2)' }}>{r.sat}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: r.apps > 0 ? 'var(--green)' : 'var(--t4)', fontWeight: 800 }}>{r.apps}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--t2)' }}>{fmt$(r.apv)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--t1)', fontWeight: 700 }}>{fmt$(r.moneyIn)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: r.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt$(r.net)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--t2)', fontWeight: 700 }}>{r.roi == null ? '—' : (r.roi).toFixed(2) + 'x'}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: r.beDate ? 'var(--green)' : 'var(--t4)', whiteSpace: 'nowrap' }}>{fmtD(r.beDate)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--t2)', fontWeight: 700 }}>{r.daysToBE ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r0(rows)}
    </div>
  );
}

const r0 = (rows) => rows.length === 0 ? (
  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)', fontSize: '13px' }}>
    No orders yet — orders appear after the v3.51 backfill runs on next launch, and every CSV import creates one.
  </div>
) : null;
