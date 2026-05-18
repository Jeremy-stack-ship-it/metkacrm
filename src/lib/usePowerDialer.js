// ============================================================
// usePowerDialer.js — v1.0
// Power Dialer engine extracted from DialView.jsx
//
// Timing:
//   Attempt 1 → 18s → auto-hang → wait for disconnect → Attempt 2
//   Attempt 2 → 30s → auto-hang → log no_answer → advance
//
// Usage:
//   const pd = usePowerDialer({ queue, dialLead, twilioDevice, setOpenId, handleDisposition, callStatus });
//   pd.pdStart()  — begin session through pdQueue (phase-due leads only)
//   pd.pdStop()   — end session, capture session log
//   pd.fireDisp() — disposition a lead + auto-advance if in PD mode
// ============================================================

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { isDueToday, getActiveSession } from './phaseEngine.js';

const ATTEMPT1_SEC = 18;
const ATTEMPT2_SEC = 30;
const KEEP_CALL_DISPS = new Set(['callback', 'appointment_booked']);

export function usePowerDialer({ queue, openId, dialLead, twilioDevice, setOpenId, handleDisposition, callStatus }) {
  // ── PD queue: due-today leads filtered to active session slot (v3.12) ──
  // When a session is live, only surface leads whose slot matches the session.
  // Between sessions: surface all due-today leads so the field is never dark.
  const pdQueue = useMemo(() => {
    const base = (queue || []).filter(isDueToday);
    const sess  = getActiveSession(new Date());
    return sess ? base.filter(l => (l.slot || 'AM') === sess.slot) : base;
  }, [queue]);

  // ── State ──
  const [pdMode,           setPdMode]           = useState(false);
  const [pdIdx,            setPdIdx]            = useState(0);
  const [pdAttempt,        setPdAttempt]        = useState(1);
  const [pdCountdown,      setPdCountdown]      = useState(null);
  const [pdStatus,         setPdStatus]         = useState('idle'); // idle | dialing | answered | pausing
  const [pdLockedQueue,    setPdLockedQueue]    = useState([]);
  const [pdPendingAttempt2, setPdPendingAttempt2] = useState(false);
  const [pdSessionStart,   setPdSessionStart]   = useState(null);
  const [pdSessionLog,     setPdSessionLog]     = useState(null);

  // ── Refs ──
  const pdTimerRef   = useRef(null);
  const pdTimeoutRef = useRef(null);
  const pdAdvanceRef = useRef(null);

  // ── Clear all timers ──
  const pdClearTimers = useCallback(() => {
    if (pdTimerRef.current)   { clearInterval(pdTimerRef.current);  pdTimerRef.current   = null; }
    if (pdTimeoutRef.current) { clearTimeout(pdTimeoutRef.current); pdTimeoutRef.current = null; }
    if (pdAdvanceRef.current) { clearTimeout(pdAdvanceRef.current); pdAdvanceRef.current = null; }
    setPdCountdown(null);
  }, []);

  // ── Advance to next lead in locked queue ──
  const pdAdvanceToNext = useCallback((lockedQueue, nextIdx) => {
    pdClearTimers();
    setPdStatus('pausing');
    pdAdvanceRef.current = setTimeout(() => {
      if (nextIdx >= lockedQueue.length) {
        setPdStatus('idle'); setPdIdx(0); setPdMode(false);
        return;
      }
      const nextLead = lockedQueue[nextIdx];
      setPdIdx(nextIdx);
      setPdAttempt(1);
      setPdStatus('dialing');
      setOpenId(nextLead.id);
      dialLead(nextLead);

      let secs = ATTEMPT1_SEC;
      setPdCountdown(secs);
      pdTimerRef.current = setInterval(() => { secs -= 1; setPdCountdown(secs); }, 1000);
      pdTimeoutRef.current = setTimeout(() => {
        if (twilioDevice) twilioDevice.disconnectAll();
        pdClearTimers();
        setPdAttempt(2); setPdStatus('pausing'); setPdPendingAttempt2(true);
      }, ATTEMPT1_SEC * 1000);
    }, 1500);
  }, [dialLead, twilioDevice, setOpenId, pdClearTimers]);

  // ── Start PD session ──
  const pdStart = useCallback(() => {
    if (!pdQueue || !pdQueue.length) {
      alert('No leads due today in your current queue. Switch to ALL or adjust your filters.');
      return;
    }
    const locked = [...pdQueue];
    // If a lead is already open and it's in the queue, start there instead of index 0
    const openIdx = openId ? locked.findIndex(l => l.id === openId) : -1;
    const startIdx = openIdx >= 0 ? openIdx : 0;
    setPdLockedQueue(locked);
    setPdIdx(startIdx); setPdAttempt(1); setPdStatus('dialing'); setPdMode(true);
    setPdSessionStart(Date.now()); setPdSessionLog(null);

    const lead = locked[startIdx];
    setOpenId(lead.id);
    dialLead(lead);

    let secs = ATTEMPT1_SEC;
    setPdCountdown(secs);
    pdTimerRef.current = setInterval(() => { secs -= 1; setPdCountdown(secs); }, 1000);
    pdTimeoutRef.current = setTimeout(() => {
      if (twilioDevice) twilioDevice.disconnectAll();
      pdClearTimers();
      setPdAttempt(2); setPdStatus('pausing'); setPdPendingAttempt2(true);
    }, ATTEMPT1_SEC * 1000);
  }, [pdQueue, openId, dialLead, twilioDevice, setOpenId, pdClearTimers]);

  // ── Stop PD session ──
  const pdStop = useCallback(() => {
    const endTs = Date.now();
    setPdSessionLog(prev => {
      if (!pdSessionStart || pdIdx < 0) return prev;
      return { start: pdSessionStart, end: endTs, dialsCount: pdIdx + 1, totalQueued: pdLockedQueue.length };
    });
    setPdSessionStart(null);
    pdClearTimers();
    if (twilioDevice) twilioDevice.disconnectAll();
    setPdStatus('idle'); setPdIdx(0); setPdAttempt(1); setPdPendingAttempt2(false); setPdLockedQueue([]); setPdMode(false);
  }, [twilioDevice, pdClearTimers, pdSessionStart, pdIdx, pdLockedQueue]);

  // ── Disposition + auto-advance when PD is active ──
  const fireDisp = useCallback((dispId) => {
    if (!KEEP_CALL_DISPS.has(dispId) && twilioDevice) {
      twilioDevice.disconnectAll();
    }
    handleDisposition(dispId);
    if (pdMode && (pdStatus === 'answered' || pdStatus === 'dialing')) {
      pdClearTimers();
      pdAdvanceToNext(pdLockedQueue, pdIdx + 1);
    }
  }, [handleDisposition, twilioDevice, pdMode, pdStatus, pdClearTimers, pdAdvanceToNext, pdLockedQueue, pdIdx]);

  // ── Effect: answered call → stop countdown ──
  useEffect(() => {
    if (pdMode && pdStatus === 'dialing' && callStatus === 'connected') {
      pdClearTimers(); setPdStatus('answered');
    }
  }, [callStatus, pdMode, pdStatus, pdClearTimers]);

  // ── Effect: fire attempt 2 after attempt 1 disconnects ──
  useEffect(() => {
    if (pdMode && pdPendingAttempt2 && callStatus === null) {
      setPdPendingAttempt2(false);
      const currentLead = pdLockedQueue[pdIdx];
      if (!currentLead) return;
      setPdStatus('dialing');
      dialLead(currentLead);
      setPdCountdown(null);
    }
  }, [callStatus, pdMode, pdPendingAttempt2, pdLockedQueue, pdIdx, dialLead]);

  // ── Cleanup on unmount ──
  useEffect(() => () => pdClearTimers(), [pdClearTimers]);

  // ── Display helpers ──
  const currentPdLead = pdMode && pdLockedQueue.length > 0 ? pdLockedQueue[pdIdx] : null;
  const pdBg     = pdStatus === 'answered' ? '#1A3A5C' : pdStatus === 'pausing' ? '#252D3D' : '#171E2D';
  const pdAccent = pdStatus === 'answered' ? '#3B82F6' : pdStatus === 'pausing' ? '#64748B' : '#3B82F6';

  return {
    pdQueue,
    pdMode, pdStatus, pdIdx, pdLockedQueue, pdAttempt, pdCountdown,
    pdSessionLog,
    currentPdLead, pdBg, pdAccent,
    pdStart, pdStop, fireDisp,
  };
}
