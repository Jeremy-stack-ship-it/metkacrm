/**
 * MINISTRY LEAD OPERATING SYSTEM — TODAY'S BLOCK
 * Phase Lifecycle Engine + Today's Dial Block View
 * v1.1 — Power Dialer added (May 8, 2026)
 *
 * Phase system:
 *   P1  — Day 0-14, every other day (7 dials)
 *   P2  — Day 15-29, 2x/week (5 dials)
 *   P3  — Day 31-59, 1x/week (5 dials)
 *   M2  — Day 60-180, bi-weekly (machine 2 aged reactivation)
 *   EXIT — Day 181+ or terminal disposition
 *
 * Priority order per block: no_sale → no_show → P1 → P2 → P3 → M2
 * 50% cap on no_sale/no_show per block (max 15 of 30 slots)
 *
 * Power Dialer:
 *   Attempt 1 → 18s → hang up if no answer
 *   Attempt 2 → 30s → hang up if no answer → auto-log no_answer → next lead
 *   On disposition → auto-advance to next lead (1.5s pause)
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { SCHED_COLS, buildSchedule, computeNextDial, phaseFromBucket, applyPhaseTransition, getPhasePriority, isDueToday, backfillLead } from '../lib/phaseEngine';

// ── PHASE CONSTANTS ──────────────────────────────────────────────
export const PHASE_DEFS = {
  P1:   { id:'P1',   label:'Phase 1',   color:'#3B82F6' },
  P2:   { id:'P2',   label:'Phase 2',   color:'#8B5CF6' },
  P3:   { id:'P3',   label:'Phase 3',   color:'#F59E0B' },
  M2:   { id:'M2',   label:'Machine 2', color:'#64748B' },
  EXIT: { id:'EXIT', label:'Exit',      color:'#DC2626' },
};

export const SMS_SEQUENCES = {
  cat1: {
    label: 'Never Set',
    subtitle: 'General Life — never booked',
    color: '#EF4444',
    texts: [
      { step:1,  hasLink:false, body:(n,c)=>`Hey ${n}, this is Jeremy with Metka Solutions — I just tried to reach you. No rush, just wanted to make sure you got a real person and not a robot 🙏 I'll try you again soon.` },
      { step:2,  hasLink:false, body:(n,c)=>`Hey ${n}, Jeremy again. Tried you once more — totally understand life gets busy. Whenever you have 15 minutes, I think I can make this worth your time. No pressure either way.` },
      { step:3,  hasLink:true,  body:(n,c)=>`${n} — still trying to connect. If the timing's just bad right now, no worries at all. Whenever you're ready, here's a link to grab a time: ${c||'[YOUR CALENDLY LINK]'} — 15 minutes, that's all.` },
      { step:4,  hasLink:true,  body:(n,c)=>`Hey ${n}, Jeremy here with Metka Solutions. I know calls can be hard to coordinate — if it's easier to just pick a time on your own, here you go: ${c||'[YOUR CALENDLY LINK]'}. Still just 15 minutes.` },
      { step:5,  hasLink:false, body:(n,c)=>`${n} 🙏 I promise I'm not a bill collector. Just someone who helps families make sure they're protected. Still happy to connect whenever you're ready.` },
      { step:6,  hasLink:true,  body:(n,c)=>`Are you alive? #pleasebe 😄 Seriously though — still here when you're ready, ${n}. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:7,  hasLink:true,  body:(n,c)=>`Hey ${n} — one thing worth knowing: some of what I work with pays out while you're still alive. Living benefits — money for a critical illness, disability, or terminal diagnosis. Not just a death benefit. Worth a quick conversation. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:8,  hasLink:false, body:(n,c)=>`Did you get my last message? Curious if that caught your attention at all.` },
      { step:9,  hasLink:true,  body:(n,c)=>`${n} — a lot of families I work with use their protection plan to also protect their home equity. There are strategies that help pay off your mortgage faster while you're still healthy enough to lock in your rate. Most people haven't heard of it. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:10, hasLink:false, body:(n,c)=>`Just so I understand where you're coming from — on a scale of 1 to 10, how important is it to you right now to make sure your family is protected if something happened to you?` },
      { step:11, hasLink:true,  body:(n,c)=>`[Send a GIF — "still waiting"] Still here, ${n}. Whenever you're ready. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:12, hasLink:false, body:(n,c)=>`${n}, I've reached out a few times now. I'm not going anywhere — but I also don't want to keep bothering you if this genuinely isn't a priority right now. Is it worth finding 15 minutes, or should I give you some space?` },
      { step:13, hasLink:true,  body:(n,c)=>`Something I think about in this work — rates are based on your age and health today. Every month that passes is a month older, and sometimes health changes when we least expect it. Just something worth knowing. Still here if you want to talk. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:14, hasLink:false, body:(n,c)=>`${n} — honest question. Is protecting your family something you still want to get handled, or has it moved down the list? Either answer is fine. I just want to make sure I'm respecting your time.` },
      { step:15, hasLink:true,  body:(n,c)=>`I've worked with a lot of families. The ones I think about most aren't the ones who said yes — they're the ones who kept waiting and then something changed. I don't say that to scare you. I say it because I'd rather have an honest conversation now than not have been able to help when it mattered. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:16, hasLink:true,  body:(n,c)=>`${n}, I'll give you some space for now — but if protecting your family ever moves back up the list, I'm still here. Same number, same link: ${c||'[YOUR CALENDLY LINK]'}. Wishing you well. — Jeremy | Metka Solutions` },
    ]
  },
  cat2: {
    label: 'No-Show',
    subtitle: 'General Life — booked but didn\'t show',
    color: '#F59E0B',
    texts: [
      { step:1,  hasLink:false, body:(n,c)=>`Hey ${n}, this is Jeremy with Metka Solutions — looks like we missed each other. No worries at all, life happens. Still happy to connect whenever works for you.` },
      { step:2,  hasLink:false, body:(n,c)=>`Hey ${n}, Jeremy here. Still want to make sure you get taken care of — whenever you're ready to find a new time, I'm here.` },
      { step:3,  hasLink:true,  body:(n,c)=>`${n} — no pressure, just want to make sure this doesn't fall through the cracks for you. Here's my link whenever you're ready: ${c||'[YOUR CALENDLY LINK]'}` },
      { step:4,  hasLink:true,  body:(n,c)=>`Hey ${n}, Jeremy again. I know life gets busy — if grabbing a time on your own is easier, here you go: ${c||'[YOUR CALENDLY LINK]'}. Still just 15 minutes.` },
      { step:5,  hasLink:true,  body:(n,c)=>`${n} 🙏 Still here, still easy to work with. Whenever you're ready. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:6,  hasLink:false, body:(n,c)=>`Did I do something to offend you? If so, I'm genuinely sorry. I know it was important to you to protect your loved ones. If it would help, I can get you connected with someone else on my team — just say the word.` },
      { step:7,  hasLink:true,  body:(n,c)=>`Hey ${n} — one thing I didn't get a chance to mention: a lot of what I work with goes beyond just a death benefit. Living benefits — money that pays out for a critical illness, disability, or terminal diagnosis while you're still here to use it. Might be worth a fresh conversation. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:8,  hasLink:false, body:(n,c)=>`Did you get my last message? Curious if that caught your attention at all.` },
      { step:9,  hasLink:true,  body:(n,c)=>`${n} — there are strategies through Metka Solutions that use your protection plan to build home equity and pay your mortgage down faster. Most families haven't heard of it. Worth 15 minutes if nothing else. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:10, hasLink:false, body:(n,c)=>`Just so I understand where you're coming from — on a scale of 1 to 10, how important is it to you to make sure your family is protected if something happened to you?` },
      { step:11, hasLink:true,  body:(n,c)=>`[Send a GIF — "still waiting"] Still here, ${n}. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:12, hasLink:false, body:(n,c)=>`${n}, I've reached out quite a few times now. Not going anywhere — but I don't want to keep showing up uninvited if this isn't the right time. Is it worth finding 15 minutes, or would you rather I give you some space?` },
      { step:13, hasLink:true,  body:(n,c)=>`Something worth knowing — rates are based on your age and health today. Every month that passes is a month older, and health can change when we least expect it. Still here whenever you're ready. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:14, hasLink:false, body:(n,c)=>`${n} — honest question. Is protecting your family still something you want to get handled, or has it moved down the list? Either answer is fine. I just want to respect your time.` },
      { step:15, hasLink:true,  body:(n,c)=>`I've worked with a lot of families. The ones I think about most aren't the ones who said yes — they're the ones who kept waiting and then something changed. I don't say that to scare you. I say it because I'd rather have an honest conversation now than not have been able to help when it mattered. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:16, hasLink:true,  body:(n,c)=>`${n}, I'll give you some space for now — but if protecting your family ever moves back up the list, I'm still here. Same number, same link: ${c||'[YOUR CALENDLY LINK]'}. Wishing you well. — Jeremy | Metka Solutions` },
    ]
  },
  cat3: {
    label: 'Sat — Didn\'t Buy',
    subtitle: 'General Life — completed audit, no app',
    color: '#8B5CF6',
    texts: [
      { step:1,  hasLink:false, body:(n,c)=>`Hey ${n}, Jeremy here with Metka Solutions — just wanted to check in since we spoke. No pressure at all, just want to make sure you have everything you need if any questions came up after our conversation.` },
      { step:2,  hasLink:false, body:(n,c)=>`Hey ${n}, still thinking about you. I know these decisions take time — I'm here whenever you're ready to talk it through. No rush.` },
      { step:3,  hasLink:true,  body:(n,c)=>`${n} — just checking in again. If it's easier to grab a time that works for you: ${c||'[YOUR CALENDLY LINK]'}. Happy to pick up right where we left off.` },
      { step:4,  hasLink:true,  body:(n,c)=>`Hey ${n}, Jeremy again. I know life gets busy — if you want to reconnect on your own schedule, here's my link: ${c||'[YOUR CALENDLY LINK]'}. Still just 15 minutes.` },
      { step:5,  hasLink:true,  body:(n,c)=>`${n} — still in your corner whenever you're ready. No agenda, just want to make sure your family gets protected. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:6,  hasLink:false, body:(n,c)=>`Did I do something to offend you? If so, I'm genuinely sorry. I know protecting your family was important to you when we spoke. If it would help, I can connect you with someone else on my team — just say the word.` },
      { step:7,  hasLink:true,  body:(n,c)=>`Hey ${n} — something I've been thinking about since we talked. A lot of people come back with questions after they've had time to sit with it. Whatever's on your mind — cost, coverage, timing — I'm an easy conversation. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:8,  hasLink:false, body:(n,c)=>`Did you get my last message? Curious if anything's come up since we spoke.` },
      { step:9,  hasLink:true,  body:(n,c)=>`${n} — one thing I want to make sure you know. Rates are locked based on your age and health at the time you apply. The longer the gap, the more things can shift. Just want to make sure you have the full picture. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:10, hasLink:false, body:(n,c)=>`Just so I understand where you're coming from — on a scale of 1 to 10, how important is it to you to make sure your family is protected if something happened to you?` },
      { step:11, hasLink:true,  body:(n,c)=>`[Send a GIF — "still waiting"] Still here, ${n}. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:12, hasLink:false, body:(n,c)=>`${n}, I've reached out a few times since we talked. I'm not going anywhere — but I also don't want to keep showing up if the timing just isn't right. Is it worth reconnecting, or would you rather I give you some space?` },
      { step:13, hasLink:false, body:(n,c)=>`${n} — honest question. Is protecting your family still something you want to get handled, or has it moved down the list? Either answer is fine. I just want to make sure I'm respecting your time.` },
      { step:14, hasLink:true,  body:(n,c)=>`Something I think about in this work — the families that are hardest to think about aren't the ones who said no. They're the ones who were close and then something changed before they could circle back. I don't say that to pressure you. I say it because I genuinely want to help while I still can. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:15, hasLink:true,  body:(n,c)=>`${n} — we had a good conversation. I'd hate for that to be where it ended. Still here if you want to pick it back up. ${c||'[YOUR CALENDLY LINK]'}` },
      { step:16, hasLink:true,  body:(n,c)=>`${n}, I'll give you some space for now — but if protecting your family ever moves back up the list, I'm still here. Same number, same link: ${c||'[YOUR CALENDLY LINK]'}. Wishing you well. — Jeremy | Metka Solutions` },
    ]
  }
};

const suggestSeqCat = (lead) => {
  if (lead?.smsSeq) return lead.smsSeq;
  const d = lead?.disposition;
  if (d === 'no_show') return 'cat2';
  if (d === 'not_interested' && (lead?.stage === 'appointment_set' || lead?.smsSeq)) return 'cat3';
  return 'cat1';
};

// ── COMPONENT CONSTANTS ──────────────────────────────────────────

const QUICK_DISPS = [
  { id:'no_answer',         label:'No Answer',       color:'#64748B' },
  { id:'vm_left',           label:'VM Left',          color:'#3B82F6' },
  { id:'callback',          label:'Callback Set',     color:'#0EA5E9' },
  { id:'hung_up',           label:'Hung Up 📴',       color:'#EF4444' },
  { id:'not_interested',    label:'Not Interested',   color:'#94A3B8' },
  { id:'appointment_booked',label:'📅 Appt Booked ✓', color:'#8B5CF6' },
  { id:'no_show',           label:'No Show ↩',       color:'#F59E0B' },
  { id:'no_sale',           label:'No Sale ↩',       color:'#EF4444' },
  { id:'dnc',               label:'DNC 🚫',          color:'#DC2626' },
];

const phaseColor = (p) => ({ P1:'#3B82F6', P2:'#8B5CF6', P3:'#F59E0B', M2:'#64748B', EXIT:'#DC2626' }[p] || '#94A3B8');


// ── TODAY'S BLOCK COMPONENT ──────────────────────────────────────

export default function TodaysBlock({
  leads, onDispose, onOpen, onUpdate,
  calendlyUrl,
}) {
  // ── Block state ──
  const [blockActive,    setBlockActive]    = useState(false);
  const [blockStart,     setBlockStart]     = useState(null);
  const [elapsed,        setElapsed]        = useState(0);

  // ── SMS / inline state ──
  const [inlineDisp,  setInlineDisp]  = useState({});
  const [smsDraft,    setSmsDraft]    = useState(null);
  const [smsMode,     setSmsMode]     = useState('quick');
  const [seqCat,      setSeqCat]      = useState('cat1');
  const [copiedId,    setCopiedId]    = useState(null);

  // ── Elapsed block timer ──
  useEffect(() => {
    if (!blockActive || !blockStart) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - blockStart) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [blockActive, blockStart]);

  const fmtElapsed = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  // ── Build today's priority list ──
  const todayListComputed = useMemo(() => {
    const GHOST_DISP  = ['dnc','not_interested','invalid','archive','appointment_booked'];
    const GHOST_STAGE = ['dnc','issued','app_submitted','underwriting'];
    const MAX_RECOVERY = 15;
    const eligible = leads.filter(l => {
      if (GHOST_DISP.includes(l.disposition))  return false;
      if (GHOST_STAGE.includes(l.stage))        return false;
      return isDueToday(l);
    }).sort((a,b) => getPhasePriority(b) - getPhasePriority(a));
    let recovCt = 0;
    return eligible.filter(l => {
      const isRec = ['no_sale','no_show'].includes(l.disposition);
      if (isRec) { if (recovCt >= MAX_RECOVERY) return false; recovCt++; }
      return true;
    }).slice(0, 80);
  }, [leads]);

  const dialedToday = useMemo(() => {
    const todayStr = new Date().toDateString();
    return leads.filter(l => l.lastContact && new Date(l.lastContact).toDateString() === todayStr).length;
  }, [leads]);

  const blockLabel = () => {
    const h = new Date().getHours();
    if (h >= 8  && h < 10) return 'Morning Block 0800–0930';
    if (h >= 12 && h < 15) return 'Afternoon Block 1230–1430';
    return 'Dial Block';
  };

  // ── Disposition handler ──
  const handleDispose = (leadId, dispId) => {
    onDispose(leadId, dispId);
    setInlineDisp(prev => ({ ...prev, [leadId]: false }));
  };

  // SMS templates
  const smsTemplates = (lead) => [
    { label: 'Initial Outreach', body: `Hi ${lead.firstName || lead.name?.split(' ')[0] || '[First Name]'}, this is Jeremy Metka with Metka Solutions. You recently requested information about protecting your household. I have your file pulled — when's a good time for a quick 20-minute call? Reply STOP to opt out.` },
    { label: 'Verification',     body: `Hi ${lead.firstName || lead.name?.split(' ')[0] || '[First Name]'}, Jeremy here with Metka Solutions. Just verifying I have the right contact — are you still looking to go over your household protection options? Reply STOP to opt out.` },
    { label: 'Ghost Protocol',   body: `I'm wrapping up my regional files for the week and closing out household files I haven't been able to reach. Wanted to give you one last opportunity before I move on. If you'd still like to go over your options, reply back and I'll keep your file open. Otherwise I'll close it out — no hard feelings at all. Reply STOP to opt out.` },
    { label: 'Scheduling Ask',   body: `Hi ${lead.firstName || lead.name?.split(' ')[0] || '[First Name]'}, I have your file ready. What day works better for a 20-minute Household Protection Audit — morning or afternoon? Reply STOP to opt out.` },
  ];

  // ── RENDER ──────────────────────────────────────────────────────
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--surface-2)' }}>

      {/* ── BLOCK HEADER ── */}
      <div style={{ background:'var(--navy)', padding:'14px 20px', borderBottom:'1px solid var(--navy-3)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap' }}>
          <div style={{ flex:1 }}>
            <div style={{ color:'#e2e8f0', fontWeight:'800', fontSize:'13px', fontFamily:"'Syne',sans-serif", letterSpacing:'1.5px' }}>
              TODAY'S DIAL BLOCK
            </div>
            <div style={{ color:'#64748b', fontSize:'10px', fontWeight:'600', marginTop:'2px', letterSpacing:'0.5px' }}>
              {blockLabel()} · {todayListComputed.length} due · {dialedToday} dialed today
              {blockActive ? ` · ⏱ ${fmtElapsed(elapsed)}` : ''}
            </div>
          </div>

          {!blockActive
            ? <button onClick={() => { setBlockActive(true); setBlockStart(Date.now()); setElapsed(0); }}
                style={{ padding:'8px 20px', background:'#2563EB', color:'#fff', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'800', cursor:'pointer', letterSpacing:'0.5px', flexShrink:0 }}>
                ▶ START BLOCK
              </button>
            : <button onClick={() => { setBlockActive(false); setBlockStart(null); setElapsed(0); }}
                style={{ padding:'8px 20px', background:'#DC2626', color:'#fff', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'800', cursor:'pointer', letterSpacing:'0.5px', flexShrink:0 }}>
                ■ END BLOCK
              </button>
          }
        </div>
      </div>

      {/* ── PHASE LEGEND ── */}
      <div style={{ background:'var(--surface)', padding:'8px 20px', borderBottom:'1px solid var(--border)', display:'flex', gap:'12px', alignItems:'center', flexShrink:0, flexWrap:'wrap' }}>
        <span style={{ fontSize:'10px', fontWeight:'700', color:'var(--t3)', letterSpacing:'0.5px' }}>PRIORITY:</span>
        {[['NO SALE','#EF4444'],['NO SHOW','#F59E0B'],['P1','#3B82F6'],['P2','#8B5CF6'],['P3','#F59E0B'],['M2','#64748B']].map(([label,color],i) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <div style={{ width:'8px', height:'8px', borderRadius:'2px', background:color, flexShrink:0 }} />
            <span style={{ fontSize:'9px', fontWeight:'700', color:'var(--t3)', letterSpacing:'0.5px' }}>{label}</span>
            {i < 5 && <span style={{ fontSize:'9px', color:'var(--t4)', marginLeft:'4px' }}>→</span>}
          </div>
        ))}
        <span style={{ marginLeft:'auto', fontSize:'10px', fontWeight:'700', color:'var(--t4)' }}>{todayListComputed.length} leads</span>
      </div>

      {/* ── LEAD LIST ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
        {todayListComputed.length === 0 ? (
          <div style={{ padding:'60px 24px', textAlign:'center' }}>
            <div style={{ fontSize:'36px', marginBottom:'12px' }}>✅</div>
            <div style={{ fontSize:'15px', fontWeight:'800', color:'var(--t1)', fontFamily:"'Syne',sans-serif", marginBottom:'8px' }}>Block Clear</div>
            <div style={{ fontSize:'13px', color:'var(--t3)', fontWeight:'500', lineHeight:'1.6' }}>
              No leads due today. Check back next dial block.<br/>
              <span style={{ fontSize:'11px', color:'var(--t4)' }}>Leads refresh each morning based on their phase schedule.</span>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {todayListComputed.map((lead, idx) => {
              const phase = lead.phase || (lead.bucket === 'A' ? 'P1' : lead.bucket === 'B' ? 'M2' : null);
              const isRecovery = ['no_sale','no_show'].includes(lead.disposition);
              const showDisp = inlineDisp[lead.id];

              return (
                <div key={lead.id} style={{
                  background: 'var(--surface)',
                  border:`1px solid ${isRecovery ? '#F59E0B33' : 'var(--border)'}`,
                  borderLeft:`3px solid ${phaseColor(phase)}`,
                  borderRadius:'10px',
                  overflow:'hidden',
                }}>
                  <div style={{ padding:'10px 12px', display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ width:'20px', height:'20px', borderRadius:'50%', background:'var(--surface-2)', color:'var(--t4)', fontSize:'9px', fontWeight:'800', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {idx + 1}
                    </div>

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                        <span style={{ fontWeight:'700', fontSize:'13px', color:'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'140px' }}>
                          {lead.name || 'Unknown'}
                        </span>
                        {phase && (
                          <span style={{ fontSize:'8px', fontWeight:'800', color:phaseColor(phase), background:phaseColor(phase)+'22', padding:'2px 5px', borderRadius:'3px', letterSpacing:'0.5px', flexShrink:0 }}>
                            {phase}
                          </span>
                        )}
                        {isRecovery && (
                          <span style={{ fontSize:'8px', fontWeight:'800', color:'#F59E0B', background:'#F59E0B22', padding:'2px 5px', borderRadius:'3px', letterSpacing:'0.5px', flexShrink:0 }}>
                            RECOVERY
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:'11px', color:'var(--t3)', marginTop:'2px', fontFamily:"'JetBrains Mono',monospace", display:'flex', gap:'8px' }}>
                        <span>{lead.phone || '—'}</span>
                        {lead.state && <span style={{ color:'var(--t4)' }}>· {lead.state}</span>}
                        {lead.age   && <span style={{ color:'var(--t4)' }}>· {lead.age}</span>}
                      </div>
                    </div>

                    <div style={{ display:'flex', gap:'5px', flexShrink:0 }}>
                      {/* SMS */}
                      <button
                        onClick={() => { const cat = suggestSeqCat(lead); setSeqCat(cat); setSmsMode('quick'); setSmsDraft({ lead }); }}
                        title="Send text"
                        style={{ padding:'6px 9px', background: lead.smsSeq ? 'var(--blue-dim)' : 'var(--surface-2)', color: lead.smsSeq ? 'var(--blue)' : 'var(--t2)', border:`1px solid ${lead.smsSeq ? 'var(--blue-mid)' : 'var(--border)'}`, borderRadius:'6px', fontSize:'13px', cursor:'pointer' }}
                      >{lead.smsSeq ? `💬${lead.smsStep||0}` : '💬'}</button>
                      {/* Open lead */}
                      <button
                        onClick={() => onOpen(lead.id)}
                        title="Open full lead"
                        style={{ padding:'6px 9px', background:'var(--surface-2)', color:'var(--t2)', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}
                      >↗</button>
                      {/* Quick disposition toggle */}
                      <button
                        onClick={() => setInlineDisp(prev => ({ ...prev, [lead.id]: !showDisp }))}
                        title="Quick disposition"
                        style={{ padding:'6px 9px', background: showDisp ? 'var(--blue-dim)' : 'var(--surface-2)', color: showDisp ? 'var(--blue)' : 'var(--t2)', border:`1px solid ${showDisp ? 'var(--blue-mid)' : 'var(--border)'}`, borderRadius:'6px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}
                      >≡</button>
                    </div>
                  </div>

                  {/* Disposition row */}
                  {showDisp && (
                    <div style={{ padding:'10px 12px', background:'var(--surface-2)', borderTop:'1px solid var(--border)' }}>
                      <div style={{ fontSize:'9px', fontWeight:'800', color:'var(--t3)', letterSpacing:'1.2px', marginBottom:'8px' }}>DISPOSITION</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                        {QUICK_DISPS.map(d => (
                          <button
                            key={d.id}
                            onClick={() => handleDispose(lead.id, d.id)}
                            style={{ padding:'4px 10px', fontSize:'11px', fontWeight:'700', color:d.color, background:d.color+'18', border:`1px solid ${d.color}44`, borderRadius:'6px', cursor:'pointer' }}
                          >{d.label}</button>
                        ))}
                        <button
                          onClick={() => setInlineDisp(prev => ({ ...prev, [lead.id]: false }))}
                          style={{ padding:'4px 10px', fontSize:'11px', fontWeight:'600', color:'var(--t4)', background:'transparent', border:'1px solid var(--border)', borderRadius:'6px', cursor:'pointer' }}
                        >Dismiss</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SMS MODAL ── */}
      {smsDraft && (() => {
        const lead      = smsDraft.lead;
        const firstName = lead.firstName || lead.name?.split(' ')[0] || '[Name]';
        const cal       = calendlyUrl || '';
        const seq       = SMS_SEQUENCES[seqCat];
        const lastSentStep = (lead.smsSeq === seqCat) ? (lead.smsStep || 0) : 0;
        const nextStep  = Math.min(lastSentStep + 1, 16);
        const seqText   = seq.texts.find(t => t.step === nextStep);
        const bodyText  = seqText ? seqText.body(firstName, cal) : '';
        const isLinkText = seqText?.hasLink || false;

        const doMarkSent = () => {
          if (onUpdate) onUpdate(lead.id, { smsSeq: seqCat, smsStep: nextStep });
          setSmsDraft(null);
        };

        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
            onClick={() => setSmsDraft(null)}>
            <div style={{ background:'var(--surface)', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'500px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', border:'1px solid var(--border)' }}
              onClick={e => e.stopPropagation()}>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <div>
                  <div style={{ fontWeight:'800', fontSize:'14px', color:'var(--t1)', fontFamily:"'Syne',sans-serif" }}>Text {firstName}</div>
                  <div style={{ fontSize:'11px', color:'var(--t3)', fontFamily:"'JetBrains Mono',monospace", marginTop:'2px' }}>{lead.phone}</div>
                </div>
                <button onClick={() => setSmsDraft(null)} style={{ background:'none', border:'none', fontSize:'22px', color:'var(--t3)', cursor:'pointer', lineHeight:1 }}>×</button>
              </div>

              <div style={{ display:'flex', gap:'6px', marginBottom:'16px', background:'var(--surface-2)', borderRadius:'10px', padding:'4px' }}>
                {[['quick','Quick Templates'],['sequence','Nurture Sequence']].map(([m, label]) => (
                  <button key={m} onClick={() => setSmsMode(m)} style={{ flex:1, padding:'7px', borderRadius:'8px', border:'none', fontSize:'11px', fontWeight:'700', cursor:'pointer', background: smsMode===m ? 'var(--blue)' : 'transparent', color: smsMode===m ? '#fff' : 'var(--t3)' }}>{label}</button>
                ))}
              </div>

              {smsMode === 'quick' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {smsTemplates(lead).map((t, i) => (
                    <div key={i} style={{ background:'var(--surface-2)', borderRadius:'10px', padding:'12px 14px', border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:'10px', fontWeight:'800', color:'var(--t3)', letterSpacing:'1px', marginBottom:'6px' }}>{t.label.toUpperCase()}</div>
                      <div style={{ fontSize:'12px', color:'var(--t2)', lineHeight:'1.5', marginBottom:'10px' }}>{t.body}</div>
                      <div style={{ display:'flex', gap:'8px' }}>
                        <button onClick={() => { navigator.clipboard.writeText(t.body).catch(()=>{}); setCopiedId(i); setTimeout(()=>setCopiedId(null),2000); }}
                          style={{ flex:1, padding:'7px', background:copiedId===i?'var(--green-dim)':'var(--blue-dim)', color:copiedId===i?'var(--green)':'var(--blue)', border:`1px solid ${copiedId===i?'#6EE7B7':'var(--blue-mid)'}`, borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}
                        >{copiedId===i ? '✓ Copied!' : '📋 Copy'}</button>
                        <a href={`sms:${lead.phone?.replace(/\D/g,'')}?body=${encodeURIComponent(t.body)}`}
                          style={{ flex:1, padding:'7px', background:'#2563EB', color:'#fff', border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer', textDecoration:'none', textAlign:'center', display:'block' }}
                        >📱 Open SMS</a>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop:'4px', fontSize:'10px', color:'var(--t4)', textAlign:'center', fontWeight:'600' }}>Copy → paste into your text app · Or use "Open SMS" on mobile</div>
                </div>
              )}

              {smsMode === 'sequence' && (
                <div>
                  <div style={{ marginBottom:'14px' }}>
                    <div style={{ fontSize:'10px', fontWeight:'800', color:'var(--t3)', letterSpacing:'1px', marginBottom:'8px' }}>SEQUENCE TYPE — GENERAL LIFE</div>
                    <div style={{ display:'flex', gap:'6px' }}>
                      {Object.entries(SMS_SEQUENCES).map(([key, s]) => (
                        <button key={key} onClick={() => setSeqCat(key)} style={{ flex:1, padding:'8px 4px', borderRadius:'8px', border:`2px solid ${seqCat===key ? s.color : 'var(--border)'}`, background: seqCat===key ? s.color+'22' : 'var(--surface-2)', color: seqCat===key ? s.color : 'var(--t3)', fontSize:'10px', fontWeight:'800', cursor:'pointer', lineHeight:'1.3' }}>
                          {s.label}
                          {lead.smsSeq===key && <span style={{ display:'block', fontSize:'9px', opacity:0.8 }}>step {lead.smsStep||0}/16</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                    <div style={{ fontSize:'11px', fontWeight:'700', color: seq.color }}>{seq.label} · Step {nextStep} of 16</div>
                    {isLinkText && (
                      <div style={{ fontSize:'10px', fontWeight:'700', color: cal ? '#F59E0B' : '#EF4444', background: cal ? '#FEF3C722' : '#FEE2E222', border:`1px solid ${cal ? '#F59E0B' : '#EF4444'}`, borderRadius:'6px', padding:'3px 8px' }}>
                        {cal ? '🔗 Has link' : '⚠️ Needs Calendly URL'}
                      </div>
                    )}
                  </div>

                  <div style={{ background:'var(--surface-2)', borderRadius:'4px', height:'4px', marginBottom:'14px', overflow:'hidden' }}>
                    <div style={{ width:`${((nextStep-1)/16)*100}%`, height:'100%', background: seq.color, borderRadius:'4px', transition:'width 0.3s' }} />
                  </div>

                  <div style={{ background:'var(--surface-2)', borderRadius:'12px', padding:'14px', border:`1px solid ${seq.color}44`, marginBottom:'14px' }}>
                    <div style={{ fontSize:'12px', color:'var(--t1)', lineHeight:'1.6', whiteSpace:'pre-wrap' }}>{bodyText}</div>
                  </div>

                  {isLinkText && !cal && (
                    <div style={{ background:'#FEE2E2', borderRadius:'8px', padding:'10px 12px', marginBottom:'12px', border:'1px solid #FCA5A5' }}>
                      <div style={{ fontSize:'11px', fontWeight:'700', color:'#DC2626', marginBottom:'2px' }}>A2P Pending — Calendly link blocked</div>
                      <div style={{ fontSize:'10px', color:'#991B1B' }}>Add your Calendly URL in Settings first. Texts without links are safe to send now.</div>
                    </div>
                  )}

                  <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                    <button onClick={() => { navigator.clipboard.writeText(bodyText).catch(()=>{}); setCopiedId('seq'); setTimeout(()=>setCopiedId(null),2000); }}
                      style={{ flex:1, padding:'9px', background:copiedId==='seq'?'var(--green-dim)':'var(--blue-dim)', color:copiedId==='seq'?'var(--green)':'var(--blue)', border:`1px solid ${copiedId==='seq'?'#6EE7B7':'var(--blue-mid)'}`, borderRadius:'8px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}
                    >{copiedId==='seq' ? '✓ Copied!' : '📋 Copy'}</button>
                    <a href={`sms:${lead.phone?.replace(/\D/g,'')}?body=${encodeURIComponent(bodyText)}`}
                      style={{ flex:1, padding:'9px', background:'#2563EB', color:'#fff', border:'none', borderRadius:'8px', fontSize:'11px', fontWeight:'700', cursor:'pointer', textDecoration:'none', textAlign:'center', display:'block' }}
                    >📱 Open SMS</a>
                  </div>
                  <button onClick={doMarkSent}
                    style={{ width:'100%', padding:'10px', background: nextStep >= 16 ? 'var(--surface-2)' : seq.color, color: nextStep >= 16 ? 'var(--t3)' : '#fff', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'800', cursor:'pointer' }}
                  >{nextStep >= 16 ? '✓ Mark Sent — Sequence Complete' : `✓ Mark Sent → Advance to Step ${nextStep + 1}`}</button>
                  <div style={{ marginTop:'10px', fontSize:'10px', color:'var(--t4)', textAlign:'center', fontWeight:'600' }}>Mark Sent saves progress to lead · Copy/Open SMS first, then mark</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
