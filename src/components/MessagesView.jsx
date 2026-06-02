import React from 'react';
import SmsThread from './SmsThread.jsx';

// ── MESSAGES VIEW ─────────────────────────────────────────────────────────────
// iMessage-style inbox. Left: conversation list. Right: active thread.
// Shows ALL leads with any SMS activity (inbound or outbound).
// Unread leads (smsUnread: true) float to top with blue dot.
// ─────────────────────────────────────────────────────────────────────────────
export default function MessagesView({ leads, sendSms, upd, setView, setOpenId, setPrevView }) {
  const [selectedId, setSelectedId] = React.useState(null);
  const [search,     setSearch]     = React.useState('');

  // Build conversation list — leads with ANY SMS activity
  const conversations = React.useMemo(() => {
    return (leads || [])
      .map(lead => {
        const notes = lead.notes || [];
        const smsNotes = notes.filter(n =>
          n && n.text && (
            n.type === 'sms_inbound' ||
            n.text.startsWith('📱 SMS sent:') ||
            n.text.startsWith('[SEQ] SMS sent')
          )
        );
        if (smsNotes.length === 0) return null;
        const latest = smsNotes.sort((a,b) => new Date(b.ts)-new Date(a.ts))[0];
        return { lead, latest, count: smsNotes.length, hasUnread: !!lead.smsUnread };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Unread first, then by most recent message
        if (a.hasUnread && !b.hasUnread) return -1;
        if (!a.hasUnread && b.hasUnread) return 1;
        return new Date(b.latest.ts) - new Date(a.latest.ts);
      });
  }, [leads]);

  const filtered = search.trim()
    ? conversations.filter(c =>
        (c.lead.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.lead.phone || '').includes(search)
      )
    : conversations;

  const selectedLead = selectedId ? (leads || []).find(l => l.id === selectedId) : null;

  const fmtTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const today = new Date(); today.setHours(0,0,0,0);
    const dDay = new Date(d); dDay.setHours(0,0,0,0);
    if (dDay.getTime() === today.getTime()) {
      return d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
    }
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  };

  const previewText = (note) => {
    if (!note) return '';
    if (note.type === 'sms_inbound') return '← ' + (note.text || '').slice(0, 55);
    if (note.text && note.text.startsWith('[SEQ]')) return '↑ [Auto] ' + (note.text.match(/Step (\d+)/)?.[0] || '');
    return '↑ ' + (note.text || '').replace('📱 SMS sent: ', '').slice(0, 55);
  };

  return React.createElement('div', {
    style:{ display:'flex', flex:1, height:'100%', overflow:'hidden', background:'var(--surface-2)' }
  },

    // ── LEFT: Conversation list ──────────────────────────────────────
    React.createElement('div', {
      style:{ width:'300px', flexShrink:0, display:'flex', flexDirection:'column', borderRight:'1px solid var(--border)', background:'var(--surface)', overflow:'hidden' }
    },

      // Header
      React.createElement('div', { style:{ padding:'14px 16px', borderBottom:'1px solid var(--border)', flexShrink:0 } },
        React.createElement('div', { style:{ fontSize:'13px', fontWeight:'800', color:'var(--t1)', marginBottom:'10px', letterSpacing:'0.5px' } },
          '💬 MESSAGES',
          conversations.filter(c=>c.hasUnread).length > 0 && React.createElement('span', {
            style:{ marginLeft:'8px', fontSize:'11px', fontWeight:'800', background:'var(--blue)', color:'#fff', borderRadius:'10px', padding:'2px 7px' }
          }, conversations.filter(c=>c.hasUnread).length + ' new')
        ),
        React.createElement('input', {
          value:search, onChange:e=>setSearch(e.target.value),
          placeholder:'Search leads…',
          style:{ width:'100%', padding:'7px 10px', fontSize:'12px', borderRadius:'7px', border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--t1)', boxSizing:'border-box', fontFamily:"'Inter',sans-serif" }
        })
      ),

      // List
      filtered.length === 0
        ? React.createElement('div', { style:{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t4)', fontSize:'12px', textAlign:'center', padding:'24px' } },
            React.createElement('div', null,
              React.createElement('div', { style:{ fontSize:'28px', marginBottom:'8px' } }, '💬'),
              conversations.length === 0 ? 'No SMS activity yet.\nSend a message from any lead card.' : 'No results.'
            )
          )
        : React.createElement('div', { style:{ flex:1, overflowY:'auto' } },
            filtered.map(({ lead, latest, hasUnread }) =>
              React.createElement('div', {
                key:lead.id,
                onClick:()=>{ setSelectedId(lead.id); if(hasUnread && upd) upd(lead.id,{smsUnread:false}); },
                style:{
                  padding:'12px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer',
                  background: selectedId===lead.id ? 'var(--blue-dim)' : 'transparent',
                  borderLeft: hasUnread ? '3px solid var(--blue)' : '3px solid transparent',
                  transition:'background 0.1s'
                },
                onMouseEnter:e=>{ if(selectedId!==lead.id) e.currentTarget.style.background='var(--surface-2)'; },
                onMouseLeave:e=>{ if(selectedId!==lead.id) e.currentTarget.style.background='transparent'; }
              },
                React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'3px' } },
                  React.createElement('div', { style:{ fontSize:'13px', fontWeight: hasUnread?'800':'600', color: hasUnread?'var(--t1)':'var(--t2)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginRight:'6px' } }, lead.name || lead.phone || 'Unknown'),
                  React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:'5px', flexShrink:0 } },
                    hasUnread && React.createElement('div', { style:{ width:'8px', height:'8px', borderRadius:'50%', background:'var(--blue)', flexShrink:0 } }),
                    React.createElement('span', { style:{ fontSize:'10px', color:'var(--t4)', fontWeight:'500' } }, fmtTime(latest.ts))
                  )
                ),
                React.createElement('div', { style:{ fontSize:'11px', color:'var(--t3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } }, previewText(latest)),
                React.createElement('div', { style:{ fontSize:'10px', color:'var(--t4)', marginTop:'3px' } }, lead.phone || '')
              )
            )
          )
    ),

    // ── RIGHT: Active thread ─────────────────────────────────────────
    React.createElement('div', { style:{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' } },
      selectedLead
        ? React.createElement(React.Fragment, null,
            // Thread header action bar
            React.createElement('div', { style:{ padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--surface)', display:'flex', alignItems:'center', gap:'10px', flexShrink:0 } },
              React.createElement('button', {
                onClick:()=>{ setPrevView('messages'); setOpenId(selectedLead.id); setView('contact'); },
                style:{ fontSize:'11px', fontWeight:'700', padding:'5px 12px', borderRadius:'6px', border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--t2)', cursor:'pointer' }
              }, '↗ Contact Card')
            ),
            React.createElement(SmsThread, { open:selectedLead, sendSms, upd, height:'100%' })
          )
        : React.createElement('div', { style:{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', color:'var(--t4)', gap:'12px' } },
            React.createElement('div', { style:{ fontSize:'48px' } }, '💬'),
            React.createElement('div', { style:{ fontSize:'14px', fontWeight:'600' } }, 'Select a conversation'),
            React.createElement('div', { style:{ fontSize:'12px' } }, conversations.length + ' conversation' + (conversations.length!==1?'s':'') + ' total')
          )
    )
  );
}
