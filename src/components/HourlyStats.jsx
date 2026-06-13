// ============================================================
// HourlyStats.jsx — v1.0
// Hourly dial/contact breakdown for the Activity tab
// Shows dials + contacts per hour, contact rate, and peak hour
// Props: activity (array of activity events)
// STAGED — not imported until plugged in via App.jsx
// ============================================================

import React, { useState, useMemo } from 'react';

// Business hours to display (7am – 9pm)
const BUSINESS_HOURS = [7,8,9,10,11,12,13,14,15,16,17,18,19,20];

function fmtHour(h) {
  if (h === 0)  return '12a';
  if (h === 12) return '12p';
  if (h > 12)   return `${h - 12}p`;
  return `${h}a`;
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function HourlyStats({ activity = [] }) {
  const [range, setRange] = useState('today'); // 'today' | 'week'

  const now   = new Date();
  const today = dayKey(now);

  // Build the week's date keys (last 7 days including today)
  const weekKeys = useMemo(() => {
    const keys = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      keys.push(dayKey(d));
    }
    return new Set(keys);
  }, [today]);

  // Compute hourly totals
  const hourlyData = useMemo(() => {
    const hours = {};
    BUSINESS_HOURS.forEach(h => { hours[h] = { dials: 0, contacts: 0, appointments: 0 }; });

    const relevant = (activity || []).filter(e => {
      if (!e || !e.ts) return false;
      return range === 'today' ? e.date === today : weekKeys.has(e.date);
    });

    relevant.forEach(e => {
      const localH = new Date(e.ts).getHours();
      if (hours[localH] === undefined) return;
      if (e.type === 'dial')        hours[localH].dials++;
      else if (e.type === 'contact')     hours[localH].contacts++;
      else if (e.type === 'appointment') hours[localH].appointments++;
    });

    return hours;
  }, [activity, range, today, weekKeys]);

  // Summary stats
  const summary = useMemo(() => {
    const totals = BUSINESS_HOURS.reduce((acc, h) => {
      acc.dials        += hourlyData[h].dials;
      acc.contacts     += hourlyData[h].contacts;
      acc.appointments += hourlyData[h].appointments;
      return acc;
    }, { dials: 0, contacts: 0, appointments: 0 });

    const activeHours = BUSINESS_HOURS.filter(h => hourlyData[h].dials > 0);
    const avgDialsPerHour = activeHours.length > 0
      ? Math.round(totals.dials / activeHours.length)
      : 0;

    const peakHour = BUSINESS_HOURS.reduce((best, h) =>
      hourlyData[h].dials > (hourlyData[best] ? hourlyData[best].dials : 0) ? h : best,
      BUSINESS_HOURS[0]
    );

    const bestContactHour = BUSINESS_HOURS.reduce((best, h) => {
      const rate = hourlyData[h].dials > 0
        ? hourlyData[h].contacts / hourlyData[h].dials
        : 0;
      const bestRate = hourlyData[best] && hourlyData[best].dials > 0
        ? hourlyData[best].contacts / hourlyData[best].dials
        : 0;
      return rate > bestRate ? h : best;
    }, BUSINESS_HOURS[0]);

    const overallContactRate = totals.dials > 0
      ? Math.round((totals.contacts / totals.dials) * 100)
      : 0;

    return { ...totals, avgDialsPerHour, peakHour, bestContactHour, overallContactRate, hasData: totals.dials > 0 };
  }, [hourlyData]);

  const maxDials = Math.max(...BUSINESS_HOURS.map(h => hourlyData[h].dials), 1);

  const rangeLabel = range === 'today' ? 'Today' : 'Last 7 Days';

  // ── RENDER ────────────────────────────────────────────────────────────
  return React.createElement('div', {
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '20px 22px',
      marginBottom: '18px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
    }
  },

    // ── Header Row ──
    React.createElement('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }
    },
      React.createElement('div', { style: { fontSize: '11px', fontWeight: '800', color: 'var(--t2)', letterSpacing: '1px' } },
        '⏱ DIALS BY HOUR'
      ),
      React.createElement('div', { style: { display: 'flex', gap: '6px' } },
        ['today', 'week'].map(r =>
          React.createElement('button', {
            key: r,
            onClick: () => setRange(r),
            style: {
              padding: '5px 14px',
              fontSize: '11pxpx',
              fontWeight: '700',
              letterSpacing: '0.5px',
              borderRadius: '6px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              background: range === r ? 'var(--navy)' : 'var(--surface-2)',
              color:      range === r ? '#fff'        : 'var(--t2)',
              border:     `1px solid ${range === r ? 'var(--navy)' : 'var(--border)'}`,
              transition: 'all 0.15s',
            }
          }, r === 'today' ? 'Today' : '7 Days')
        )
      )
    ),

    // ── Summary Tiles ──
    summary.hasData
      ? React.createElement('div', {
          style: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }
        },
          [
            { label: 'Peak Hour',     value: fmtHour(summary.peakHour),       sub: `${hourlyData[summary.peakHour].dials} dials`, color: 'var(--blue)' },
            { label: 'Best Connect',  value: fmtHour(summary.bestContactHour), sub: summary.bestContactHour !== summary.peakHour || hourlyData[summary.bestContactHour].dials === 0 ? `${hourlyData[summary.bestContactHour].dials > 0 ? Math.round(hourlyData[summary.bestContactHour].contacts / hourlyData[summary.bestContactHour].dials * 100) : 0}% rate` : `${Math.round(hourlyData[summary.bestContactHour].contacts / hourlyData[summary.bestContactHour].dials * 100)}% rate`, color: 'var(--sky)' },
            { label: 'Avg / Hr',      value: summary.avgDialsPerHour,          sub: 'dials',                                        color: 'var(--t2)' },
            { label: 'Contact Rate',  value: `${summary.overallContactRate}%`,  sub: rangeLabel,                                     color: summary.overallContactRate >= 20 ? 'var(--green)' : summary.overallContactRate >= 10 ? 'var(--blue)' : 'var(--t3)' },
          ].map(tile =>
            React.createElement('div', {
              key: tile.label,
              style: {
                flex: '1 1 90px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px 14px',
                minWidth: '80px',
              }
            },
              React.createElement('div', { style: { fontSize: '11pxpx', fontWeight: '700', color: 'var(--t3)', letterSpacing: '0.8px', marginBottom: '3px' } }, tile.label.toUpperCase()),
              React.createElement('div', { style: { fontSize: '18px', fontWeight: '800', color: tile.color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.2 } }, tile.value),
              React.createElement('div', { style: { fontSize: '11pxpx', color: 'var(--t4)', marginTop: '2px' } }, tile.sub)
            )
          )
        )
      : null,

    // ── Bar Chart ──
    !summary.hasData
      ? React.createElement('div', {
          style: { padding: '32px', textAlign: 'center', color: 'var(--t4)', fontSize: '13px', fontWeight: '500' }
        }, `No ${rangeLabel.toLowerCase()} dial data yet. Start dialing to build your hourly map.`)

      : React.createElement('div', { style: { overflowX: 'auto' } },
          React.createElement('div', {
            style: {
              display: 'flex',
              alignItems: 'flex-end',
              gap: '4px',
              height: '120px',
              minWidth: `${BUSINESS_HOURS.length * 44}px`,
              borderBottom: '1px solid var(--border)',
              paddingBottom: '2px',
            }
          },
            BUSINESS_HOURS.map(h => {
              const d = hourlyData[h];
              const isPeak = h === summary.peakHour && d.dials > 0;
              const dialH  = Math.max(Math.round((d.dials / maxDials) * 100), d.dials > 0 ? 4 : 0);
              const contH  = d.dials > 0 && d.contacts > 0
                ? Math.max(Math.round((d.contacts / maxDials) * 100), 3)
                : 0;
              const rate   = d.dials > 0 ? Math.round((d.contacts / d.dials) * 100) : null;
              const isCurrent = fmtHour(h) === fmtHour(now.getHours()) && range === 'today';

              return React.createElement('div', {
                key: h,
                title: `${fmtHour(h)}: ${d.dials} dials, ${d.contacts} contacts${rate !== null ? `, ${rate}% connect` : ''}`,
                style: {
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '2px',
                  cursor: 'default',
                  minWidth: '34px',
                }
              },
                // Contact rate badge (only if meaningful)
                rate !== null && rate > 0
                  ? React.createElement('div', {
                      style: {
                        fontSize: '11pxpx',
                        fontWeight: '800',
                        color: rate >= 20 ? 'var(--green)' : 'var(--t3)',
                        fontFamily: "'JetBrains Mono', monospace",
                        lineHeight: 1,
                        marginBottom: '1px',
                      }
                    }, `${rate}%`)
                  : React.createElement('div', { style: { height: '12px' } }),

                // Bar wrapper (dial + contact stacked)
                React.createElement('div', {
                  style: {
                    position: 'relative',
                    width: '28px',
                    height: `${dialH}px`,
                    minHeight: d.dials > 0 ? '4px' : '0px',
                    borderRadius: '4px 4px 0 0',
                    background: 'var(--blue-dim)',
                    border: isPeak ? '1px solid var(--blue)' : '1px solid transparent',
                    borderBottom: 'none',
                    transition: 'height 0.3s ease',
                    boxShadow: isPeak ? '0 0 8px rgba(59,130,246,0.25)' : 'none',
                  }
                },
                  // Contact overlay bar (bottom of the dial bar)
                  contH > 0 && React.createElement('div', {
                    style: {
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${Math.min(contH, dialH)}px`,
                      background: 'var(--sky)',
                      borderRadius: '4px 4px 0 0',
                      opacity: 0.85,
                    }
                  }),

                  // Current hour indicator
                  isCurrent && React.createElement('div', {
                    style: {
                      position: 'absolute',
                      top: '-16px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '11pxpx',
                      color: 'var(--green)',
                      fontWeight: '800',
                    }
                  }, '▼')
                ),

                // Hour label
                React.createElement('div', {
                  style: {
                    fontSize: '11pxpx',
                    fontWeight: isCurrent ? '800' : '600',
                    color: isCurrent ? 'var(--green)' : isPeak ? 'var(--blue)' : 'var(--t4)',
                    fontFamily: "'JetBrains Mono', monospace",
                    marginTop: '4px',
                    letterSpacing: '0.3px',
                  }
                }, fmtHour(h))
              );
            })
          ),

          // ── Legend ──
          React.createElement('div', {
            style: { display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11pxpx', fontWeight: '700', color: 'var(--t3)' }
          },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '5px' } },
              React.createElement('span', { style: { width: '10px', height: '10px', borderRadius: '2px', background: 'var(--blue-dim)', border: '1px solid var(--blue)', display: 'inline-block' } }),
              'DIALS'
            ),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '5px' } },
              React.createElement('span', { style: { width: '10px', height: '10px', borderRadius: '2px', background: 'var(--sky)', display: 'inline-block', opacity: 0.85 } }),
              'CONTACTS'
            ),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '5px' } },
              React.createElement('span', { style: { fontSize: '11pxpx', color: 'var(--green)', fontWeight: '800' } }, '▼'),
              'CURRENT HOUR'
            ),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '5px' } },
              React.createElement('span', { style: { fontSize: '11pxpx', color: 'var(--t3)' } }, '%'),
              'CONNECT RATE'
            ),
          )
        )
  );
}

export default HourlyStats;
