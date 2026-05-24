import React, { useState, useEffect } from 'react';

// ── NAV GROUPS ────────────────────────────────────────────────────────────────
const GROUPS = [
  {
    id:    'work',
    icon:  '⚡',
    label: 'WORK',
    items: [
      { id: 'today',        icon: '⚡',  label: 'TODAY' },
      { id: 'dial',         icon: '🎙️', label: 'DIAL'  },
      { id: 'callbacks',    icon: '📞', label: 'CB'    },
      { id: 'appointments', icon: '📅', label: 'APPTS' },
    ],
  },
  {
    id:    'intel',
    icon:  '📊',
    label: 'INTEL',
    items: [
      { id: 'dashboard', icon: '🏠', label: 'DASH' },
      { id: 'activity',  icon: '🎯', label: 'ACT'  },
      { id: 'sequence',  icon: '🔁', label: 'SEQ'  },
      { id: 'cc',        icon: '📧', label: 'CC'   },
    ],
  },
  {
    id:    'data',
    icon:  '📇',
    label: 'DATA',
    items: [
      { id: 'contacts', icon: '📇', label: 'DATA' },
      { id: 'pipeline', icon: '📊', label: 'PIPE' },
    ],
  },
  {
    id:    'content',
    icon:  '📝',
    label: 'CONTENT',
    items: [
      { id: 'scripts',   icon: '📝', label: 'SCRIPT' },
      { id: 'templates', icon: '💬', label: 'SMS'    },
    ],
  },
];

// Map every view id to its parent group id
const VIEW_GROUP = {};
GROUPS.forEach(g => g.items.forEach(i => { VIEW_GROUP[i.id] = g.id; }));

// ── NAV BUTTON ────────────────────────────────────────────────────────────────
const NavBtn = ({ icon, label, active, onClick }) =>
  React.createElement('button', {
    onClick,
    style: {
      width: '100%', padding: '7px 0', borderRadius: '7px', border: 'none',
      background: active ? 'var(--blue)' : 'transparent',
      color: active ? '#fff' : 'rgba(255,255,255,0.5)',
      cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
    },
    onMouseEnter: e => { if (!active) { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; } },
    onMouseLeave: e => { if (!active) { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; } },
  },
    React.createElement('span', { style: { fontSize: '14px', lineHeight: 1 } }, icon),
    React.createElement('span', { style: { fontSize: '8px', fontWeight: '700', letterSpacing: '0.06em' } }, label),
  );

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function NavSidebar({ view, setView, navOpen }) {
  const [openGroup, setOpenGroup] = useState(() => VIEW_GROUP[view] || 'work');

  useEffect(() => {
    const g = VIEW_GROUP[view];
    if (g) setOpenGroup(g);
  }, [view]);

  if (!navOpen) return null;

  const toggleGroup = (gid) => setOpenGroup(prev => prev === gid ? null : gid);

  return React.createElement('aside', {
    style: {
      width: '68px', background: 'var(--navy)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', zIndex: 20, borderRight: '1px solid var(--navy-3)',
      flexShrink: 0, overflow: 'hidden',
    }
  },

    // LOGO
    React.createElement('div', {
      style: {
        color: '#fff', fontWeight: '700', fontSize: '11px',
        letterSpacing: '0.08em', fontFamily: "'Inter',sans-serif",
        padding: '16px 0 14px', flexShrink: 0,
      }
    }, 'CRM'),

    // SCROLLABLE GROUP AREA
    React.createElement('div', {
      style: {
        flex: 1, width: '100%', overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '4px 0 8px', gap: '2px', scrollbarWidth: 'none',
      }
    },

      ...GROUPS.map((g, gi) => {
        const isOpen    = openGroup === g.id;
        const hasActive = g.items.some(i => i.id === view);

        return React.createElement('div', { key: g.id, style: { width: '100%', padding: '0 6px' } },

          // Group header
          React.createElement('button', {
            onClick: () => toggleGroup(g.id),
            style: {
              width: '100%', padding: '7px 0', borderRadius: '7px', border: 'none',
              background: hasActive && !isOpen
                ? 'rgba(59,130,246,0.25)'
                : isOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: hasActive ? '#fff' : 'rgba(255,255,255,0.45)',
              cursor: 'pointer', transition: 'all 0.12s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            },
            onMouseEnter: e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.color = '#fff';
            },
            onMouseLeave: e => {
              e.currentTarget.style.background = hasActive && !isOpen
                ? 'rgba(59,130,246,0.25)'
                : isOpen ? 'rgba(255,255,255,0.08)' : 'transparent';
              e.currentTarget.style.color = hasActive ? '#fff' : 'rgba(255,255,255,0.45)';
            },
          },
            React.createElement('span', { style: { fontSize: '13px', lineHeight: 1 } }, g.icon),
            React.createElement('span', { style: { fontSize: '8px', fontWeight: '700', letterSpacing: '0.06em' } }, g.label),
            React.createElement('span', { style: { fontSize: '7px', opacity: 0.5, lineHeight: 1 } }, isOpen ? '▲' : '▼'),
          ),

          // Collapsed items
          isOpen && React.createElement('div', {
            style: {
              display: 'flex', flexDirection: 'column', gap: '2px',
              marginTop: '3px', paddingLeft: '2px',
              borderLeft: '2px solid rgba(59,130,246,0.4)',
              marginLeft: '6px',
            }
          },
            ...g.items.map(item =>
              React.createElement(NavBtn, {
                key:    item.id,
                icon:   item.icon,
                label:  item.label,
                active: view === item.id,
                onClick: () => setView(item.id),
              })
            )
          ),

          // Divider between groups
          gi < GROUPS.length - 1 && React.createElement('div', {
            style: {
              width: '32px', height: '1px',
              background: 'rgba(255,255,255,0.08)',
              margin: '5px auto',
            }
          }),
        );
      })
    ),

    // SETTINGS — PINNED BOTTOM
    React.createElement('div', {
      style: {
        flexShrink: 0, width: '100%', padding: '8px 6px 16px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }
    },
      React.createElement(NavBtn, {
        icon:   '⚙️',
        label:  'SET',
        active: view === 'settings',
        onClick: () => setView('settings'),
      })
    ),
  );
}
