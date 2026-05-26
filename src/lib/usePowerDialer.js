// ============================================================
// usePowerDialer.js — v1.4
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
import { isDueToday, getActiveSession, masterQueueSort, SESSIONS } from './phaseEngine.js';

const ATTEMPT1_SEC = 18;
const ATTEMPT2_SEC = 30;
const KEEP_CALL_DISPS = new Set(['callback']);

export function usePowerDialer({ queue, openId, dialLead, twilioDevice, setOpenId, handleDisposition, callStatus, selectedSlot }) {
  // ── PD queue: due-today leads filtered to selected (or time-active) session slot ──
  const pdQueue = useMemo(() => {
    // v3.30 — cap at session capacity so POWER DIAL badge matches the 40-lead session limit.
    // Uses getActiveSession for time-based slot; falls back to selectedSlot override.
    const sess = getActiveSession(new Date());
    const capacity = sess ? sess.capacity : 40;
    const activeSlot = selectedSlot || (sess ? sess.slot : null);
    const base = (queue || []).filter(isDueToday);
    const slotFiltered = activeSlot
      ? base.filter(l => (l.slot || 'AM') === activeSlot)
      : base;
    return slotFiltered.sort(masterQueueSort).slice(0, capacity);
  }, [queue, selectedSlot]);

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
  // overrideLeads: optional pre-filtered array (used when starting from a slot tile
  // to avoid React state timing issues — tile computes the list synchronously).
  const pdStart = useCallback((overrideLeads) => {
    const workQueue = (overrideLeads && overrideLeads.length > 0) ? overrideLeads : pdQueue;
    if (!workQueue || !workQueue.length) {
      alert('No leads due today in this session slot.');
      return;
    }
    const locked = [...workQueue];
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

  // ── Effect: start ring countdown when call goes live ────────────────────────
  // Starts on 'connecting' OR 'ringing' — whichever fires first.
  // Some carriers never fire the 'ringing' event (goes connecting→connected directly),
  // so relying on 'ringing' alone leaves no-answer calls ringing forever.
  // The ringTimerStartedRef guard prevents a second timer if both events fire.
  // fireDisp intentionally removed from deps — not used inside this effect.
  useEffect(() => {
    if (!pdMode || pdStatus !== 'dialing') return;
    if (callStatus !== 'connecting' && callStatus !== 'ringing') return;
    if (ringTimerStartedRef.current) return; // already running — do not spawn another

    ringTimerStartedRef.current = true;

    if (pdAttempt === 1) {
      // Attempt 1: 18-second countdown, then auto-hang and queue attempt 2
      let secs = ATTEMPT1_SEC;
      setPdCountdown(secs);

      pdTimerRef.current = setInterval(() => {
        secs -= 1;
        setPdCountdown(secs);
      }, 1000);

      pdTimeoutRef.current = setTimeout(() => {
        if (twilioDevice) twilioDevice.disconnectAll();
        pdClearTimers(); // also resets ringTimerStartedRef
        setPdAttempt(2); setPdStatus('pausing'); setPdPendingAttempt2(true);
      }, ATTEMPT1_SEC * 1000);
    } else {
      // Attempt 2: no timer — agent manually dispositions (answered or no_answer)
      setPdCountdown(null);
    }
  // pdCountdown intentionally excluded — updating it every second must not re-run this effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus, pdMode, pdStatus, pdAttempt, twilioDevice, pdClearTimers]);


  // ── Effect: someone picked up — cancel ring timer immediately ──────────────
  // If Twilio fires 'connected' while the 18-second ring timer is still running,
  // clear it so we don't auto-hang up on a live conversation.
  useEffect(() => {
    if (!pdMode) return;
    if (callStatus === 'connected') {
      pdClearTimers();           // kills the 18s timeout + interval
      setPdStatus('answered');   // UI shows answered state
    }
  }, [callStatus, pdMode, pdClearTimers]);

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
