// ── LEAD ORDER ECONOMICS (v3.51 — Session 5) ────────────────────────────────
// "Never blend DLHA numbers with aged analog" — Jeremy + Derick, 2026-06-10.
// Every lead belongs to a leadOrderId (an import batch / lead drop). This module
// clusters historical leads into orders and computes per-order P&L:
// spend (Σ purchaseAmount) vs money-in (commission + advance, chargebacks
// subtract), break-even date, days-to-BE, ROI — cut by source and level.
// Pure functions. No React, no side effects.

// ── ORDER ASSIGNMENT ─────────────────────────────────────────────────────────

// ISO week key for clustering: '2026-W23'
const weekKey = (dateIso) => {
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return 'unknown';
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

// Historical backfill: cluster by (source, level, assign-week). Deterministic —
// same lead always lands in the same order. Idempotent (skips leads that have one).
export const assignLeadOrders = (leads) => {
  let changed = 0;
  const out = (leads || []).map(l => {
    if (!l) return l;
    // v3.52 — re-cluster leads whose order was built before source data existed
    const isUnknownCluster = l.leadOrderId && l.leadOrderId.includes('_UNKNOWN_') && l.leadSource;
    if (l.leadOrderId && !isUnknownCluster) return l;
    const src = (l.leadSource || 'unknown').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const lvl = (l.leadLevel || l.leadType || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const wk  = weekKey(l.funnelAssignDate || l.assignDate);
    changed++;
    return { ...l, leadOrderId: `ord_${src}_${lvl}_${wk}` };
  });
  return { leads: out, changed };
};

// Import-time stamp: one batch = one order (caller passes a batch label).
export const stampImportOrder = (newLeads, label) => {
  const id = `ord_import_${label || new Date().toISOString().slice(0, 10)}_${Date.now().toString(36)}`;
  return (newLeads || []).map(l => l.leadOrderId ? l : { ...l, leadOrderId: id });
};

// ── PER-ORDER ROLLUP ─────────────────────────────────────────────────────────

const money = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

// Money-in for one lead. appStatus 'chargeback' subtracts everything received.
export const leadMoneyIn = (l) => {
  const inn = money(l.commissionPaid) + money(l.advancePaid);
  return l.appStatus === 'chargeback' ? -inn : inn;
};

export const orderRollup = (leads) => {
  const orders = new Map();
  (leads || []).forEach(l => {
    if (!l) return;
    const id = l.leadOrderId || 'unassigned';
    if (!orders.has(id)) orders.set(id, []);
    orders.get(id).push(l);
  });

  const rows = [];
  orders.forEach((ls, id) => {
    const spend = ls.reduce((s, l) => s + money(l.purchaseAmount), 0);
    const moneyIn = ls.reduce((s, l) => s + leadMoneyIn(l), 0);
    const apps = ls.filter(l => l.submittedDate || ['submitted'].includes(l.disposition)).length;
    const apv = ls.reduce((s, l) => s + money(l.apv), 0);
    const apptsSet = ls.filter(l => l.apptSetEver).length;
    const sat = ls.filter(l => l.satEver).length;
    const chargebacks = ls.filter(l => l.appStatus === 'chargeback').length;

    // Break-even: walk payments by paymentDate; BE = first date cumulative >= spend
    const payments = ls
      .filter(l => leadMoneyIn(l) !== 0 && l.paymentDate)
      .map(l => ({ d: l.paymentDate, amt: leadMoneyIn(l) }))
      .sort((a, b) => new Date(a.d) - new Date(b.d));
    let cum = 0, beDate = null;
    for (const p of payments) {
      cum += p.amt;
      if (spend > 0 && cum >= spend && !beDate) beDate = p.d;
    }
    const startDates = ls.map(l => l.funnelAssignDate || l.assignDate).filter(Boolean).sort();
    const orderStart = startDates[0] || null;
    const daysToBE = (beDate && orderStart)
      ? Math.round((new Date(beDate) - new Date(orderStart)) / 86400000)
      : null;

    const sample = ls[0] || {};
    rows.push({
      id,
      label: id.startsWith('ord_import_') ? `Import ${id.slice(11, 21)}` : id.replace(/^ord_/, '').replace(/_/g, ' '),
      source: sample.leadSource || '—',
      level: sample.leadLevel || sample.leadType || '—',
      orderStart,
      leadCount: ls.length,
      spend, moneyIn, apps, apv, apptsSet, sat, chargebacks,
      beDate, daysToBE,
      roi: spend > 0 ? moneyIn / spend : null,
      net: moneyIn - spend,
    });
  });

  // Newest orders first
  rows.sort((a, b) => (b.orderStart || '').localeCompare(a.orderStart || ''));
  return rows;
};

// Median days-to-BE per level — Derick's projection use case ("how long does a
// DLHA order take to break even?"). Only orders that actually broke even count.
export const medianDaysToBE = (rows) => {
  const byLevel = new Map();
  rows.forEach(r => {
    if (r.daysToBE == null) return;
    if (!byLevel.has(r.level)) byLevel.set(r.level, []);
    byLevel.get(r.level).push(r.daysToBE);
  });
  const out = {};
  byLevel.forEach((arr, lvl) => {
    arr.sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    out[lvl] = arr.length % 2 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
  });
  return out;
};
