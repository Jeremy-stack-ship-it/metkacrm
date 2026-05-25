// ============================================================
// usePowerDialer.js — v1.3
// Power Dialer engine extracted from DialView.jsx
//
// Timing:
//   Attempt 1 → waits for 'ringing' event → 18s → auto-hang → Attempt 2
//   Attempt 2 → waits for 'ringing' event → 30s → auto-hang → log no_answer → advance
//
// Ring timer uses a ref guard (ringTimerStartedRef) instead of pdCountdown state
// to prevent the effect from spawning multiple timeouts when pdCountdown updates.
// ============================================================

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { isDueToday, getActiveSession } from './phaseEngine.js';

const ATTEMPT1_SEC = 18;
const ATTEMPT2_SEC = 30;
const KEEP_CALL_DISPS = new Set(['callback']);

export function usePowerDialer({ queue, openId, dialLead, twilioDevice, setOpenId, handleDisposition, callStatus }) {
  // ── PD queue: due-today leads filtered to active session slot ──
  const pdQueue = useMemo(() => {
    const base = (queue || []).filter(isDueToday);
    const sess  = getActiveSession(new Date());
    return sess ? base.filter(l => (l.slot || 'AM') === sess.slot) : base;
  }, [queue]);

  // ── State ──
  const [pdMode,             setPdMode]             = useState(false);
  const [pdIdx,              setPdIdx]              = useState(0);
  const [pdAttempt,          setPdAttempt]          = useState(1);
  const [pdCountdown,        setPdCountdown]        = useState(null);
  const [pdStatus,           setPdStatus]           = useState('idle');
  const [pdLockedQueue,      setPdLockedQueue]      = useState([]);
  const [pdPendingAttempt2,  setPdPendingAttempt2]  = useState(false);
  const [pdSessionStart,     setPdSessionStart]     = useState(null);
  const [pdSessionLog,       setPdSessionLog]       = useState(null);

  // ── Refs ──
  const pdTimerRef          = useRef(null);
  const pdTimeoutRef        = useRef(null);
  const pdAdvanceRef        = useRef(null);
  // Guard: prevents the ring-timer effect from spawning multiple timeouts.
  // Stored in a ref so it doesn't trigger re-renders or effect re-runs.
  const ringTimerStartedRef = useRef(false);

  // ── Clear all timers ──
  const pdClearTimers = useCallback(() => {
    if (pdTimerRef.current)   { clearInterval(pdTimerRef.current);  pdTimerRef.current   = null; }
    if (pdTimeoutRef.current) { clearTimeout(pdTimeoutRef.current); pdTimeoutRef.current = null; }
    if (pdAdvanceRef.current) { clearTimeout(pdAdvanceRef.current); pdAdvanceRef.current = null; }
    setPdCountdown(null);
    ringTimerStartedRef.current = false;
  }, []);

  // ── Advance to next lead ──
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
      // Ring timer starts when 'ringing' fires — see useEffect below
    }, 1500);
  }, [dialLead, setOpenId, pdClearTimers]);

  // ── Start PD session ──
  const pdStart = useCallback(() => {
    if (!pdQueue || !pdQueue.length) {
      alert('No leads due today in your current queue. Switch to ALL or adjust your filters.');
      return;
    }
    const locked = [...pdQueue];
    const openIdx = openId ? locked.findIndex(l => l.id === openId) : -1;
    const startIdx = openIdx >= 0 ? openIdx : 0;
    setPdLockedQueue(locked);
    setPdIdx(startIdx); setPdAttempt(1); setPdStatus('dialing'); setPdMode(true);
    setPdSessionStart(Date.now()); setPdSessionLog(null);

    const lead = locked[startIdx];
    setOpenId(lead.id);
    dialLead(lead);
    // Ring timer starts when 'ringing' fires — see useEffect below
  }, [pdQueue, openId, dialLead, setOpenId]);

  // ── Stop PD session ──
  const pdStop = useCallback(() => {
    const endTs = Date.now();
    setPdSessionLog(() => {
      if (!pdSessionStart || pdIdx < 0) return null;
      return { start: pdSessionStart, end: endTs, dialsCount: pdIdx + 1, totalQueued: pdLockedQueue.length };
    });
    setPdSessionStart(null);
    pdClearTimers();
    if (twilioDevice) twilioDevice.disconnectAll();
    setPdStatus('idle'); setPdIdx(0); setPdAttempt(1); setPdPendingAttempt2(false); setPdLockedQueue([]); setPdMode(false);
  }, [twilioDevice, pdClearTimers, pdSessionStart, pdIdx, pdLockedQueue]);

  // ── Disposition + auto-advance ──
  const fireDisp = useCallback((dispId) => {
    if (!KEEP_CALL_DISPS.has(dispId) && twilioDevice) {
      twilioDevice.disconnectAll();
    }
    handleDisposition(dispId);
    if (pdMode && (pdStatus === 'answered' || pdStatus === 'dialing' || pdStatus === 'pausing')) {
      pdClearTimers();
      pdAdvanceToNext(pdLockedQueue, pdIdx + 1);
    }
  }, [handleDisposition, twilioDevice, pdMode, pdStatus, pdClearTimers, pdAdvanceToNext, pdLockedQueue, pdIdx]);

  // ── Effect: start ring countdown ONCE when carrier confirms ringing ──
  // Uses ringTimerStartedRef as the guard — NOT pdCountdown state — so that
  // the countdown updating every second does not re-trigger this effect and
  // spawn additional timeouts.
  useEffect(() => {
    if (!pdMode || pdStatus !== 'dialing' || callStatus !== 'ringing') return;
    if (ringTimerStartedRef.current) return; // already running — do not spawn another

    ringTimerStartedRef.current = true;

    const totalSecs = pdAttempt === 1 ? ATTEMPT1_SEC : ATTEMPT2_SEC;
    let secs = totalSecs;
    setPdCountdown(secs);

    pdTimerRef.current = setInterval(() => {
      secs -= 1;
      setPdCountdown(secs);
    }, 1000);

    pdTimeoutRef.current = setTimeout(() => {
      if (twilioDevice) twilioDevice.disconnectAll();
      pdClearTimers(); // also resets ringTimerStartedRef
      if (pdAttempt === 1) {
        setPdAttempt(2); setPdStatus('pausing'); setPdPendingAttempt2(true);
      } else {
        fireDisp('no_answer');
      }
    }, totalSecs * 1000);
  // pdCountdown intentionally excluded — updating it every second must not re-run this effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus, pdMode, pdStatus, pdAttempt, twilioDevice, fireDisp, pdClearTimers]);

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
