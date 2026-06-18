import { useState, useEffect } from 'react';
import { Device } from '@twilio/voice-sdk';

/**
 * useTwilioDevice — Twilio Voice SDK state + lifecycle.
 * Extracted from App.jsx (Fix #3 — god component reduction).
 *
 * @param {Function} upd      — lead field updater (from leadMgr)
 * @param {Function} logDial  — dial event logger (from leadMgr)
 */
export function useTwilioDevice({ upd, logDial }) {
  const [twilioDevice,      setTwilioDevice]      = useState(null);
  const [useTwilioCalling,  setUseTwilioCalling]  = useState(() => localStorage.getItem('metka-use-twilio-calling') === 'true');
  const [tokenServiceUrl,   setTokenServiceUrl]   = useState(() => localStorage.getItem('metka-twilio-token-url') || '');
  const [tokenUrlDraft,     setTokenUrlDraft]     = useState(() => localStorage.getItem('metka-twilio-token-url') || '');
  const [voiceDeviceStatus, setVoiceDeviceStatus] = useState('idle'); // idle | registering | ready | error
  const [activeCall,        setActiveCall]        = useState(null);
  const [activeCallLead,    setActiveCallLead]    = useState(null);
  const [callStatus,        setCallStatus]        = useState(null); // null | 'connecting' | 'ringing' | 'connected'
  const [callMuted,         setCallMuted]         = useState(false);
  const [callElapsed,       setCallElapsed]       = useState(0);

  // Device lifecycle — boot/teardown when toggle or URL changes
  useEffect(() => {
    if (!useTwilioCalling || !tokenServiceUrl) {
      if (twilioDevice) { try { twilioDevice.destroy(); } catch(e){} setTwilioDevice(null); }
      setVoiceDeviceStatus('idle');
      return;
    }
    setVoiceDeviceStatus('registering');
    fetch(tokenServiceUrl)
      .then(r => r.json())
      .then(data => {
        const token = data.token || data.accessToken || data.access_token;
        if (!token) throw new Error('No token in response');
        // v3.85 — REVERTED the v3.83 call-path experiment (opus codecPreferences +
        // ANC audioConstraints) to isolate an "immediate hangup on dial" regression.
        // Back to the known-good device config that ran clean through v3.79.
        // ANC will be reintroduced ALONE and tested in isolation once dialing is
        // confirmed stable. See CHANGELOG v3.85.
        const device = new Device(token, { logLevel: 1 });
        device.on('ready',           () => setVoiceDeviceStatus('ready'));
        device.on('registered',      () => setVoiceDeviceStatus('ready'));
        device.on('error',           () => setVoiceDeviceStatus('error'));
        device.on('tokenWillExpire', () => {
          fetch(tokenServiceUrl).then(r => r.json()).then(d => {
            const t = d.token || d.accessToken || d.access_token;
            if (t) device.updateToken(t);
          }).catch(() => {});
        });
        device.register();
        setTwilioDevice(device);
      })
      .catch(() => setVoiceDeviceStatus('error'));
    return () => { if (twilioDevice) { try { twilioDevice.destroy(); } catch(e){} } };
  }, [useTwilioCalling, tokenServiceUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Call elapsed timer — only ticks when connected
  useEffect(() => {
    if (callStatus !== 'connected') return;
    const iv = setInterval(() => setCallElapsed(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, [callStatus]);

  // Central dial function — Twilio browser call or tel: fallback
  const dialLead = (lead) => {
    const phoneClean = (lead.phone || '').replace(/\D/g, '');
    if (!phoneClean) return;

    // DNC / removed guard
    const HARD_STOPS = ['dnc', 'not_interested', 'withdrawn', 'chargeback'];
    if (HARD_STOPS.includes(lead.disposition) || lead.stage === 'removed') {
      const label = lead.disposition === 'dnc' ? 'DNC' : lead.stage === 'removed' ? 'Removed' : 'Not Interested';
      const go = window.confirm(
        `⛔ ${label} — ${lead.name || 'This lead'} is marked ${label}.\n\nDial anyway? (This may be a compliance risk.)`
      );
      if (!go) return;
    }
    if (useTwilioCalling && twilioDevice) {
      setActiveCallLead(lead);
      setCallStatus('connecting');
      setCallElapsed(0);
      setCallMuted(false);
      twilioDevice.connect({ params: { To: '+1' + phoneClean } })
        .then(call => {
          setActiveCall(call);
          // Fire 'ringing' status when carrier confirms the phone is ringing
          // Power dialer uses this event to start its ring timer
          call.on('ringing', () => setCallStatus('ringing'));
          call.on('accept', () => {
            setCallStatus('connected');
            // Auto-clear callback badge when call connects
            if (lead.nextCallback) {
              const cb = new Date(lead.nextCallback);
              const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
              if (cb <= endToday) {
                upd(lead.id, { nextCallback: null });
              } else {
                const rolled = new Date(cb.getTime() + 24 * 60 * 60 * 1000);
                upd(lead.id, { nextCallback: rolled.toISOString() });
              }
            }
          });
          call.on('disconnect', () => { setActiveCall(null); setActiveCallLead(null); setCallStatus(null); setCallElapsed(0); setCallMuted(false); });
          call.on('error',      () => { setActiveCall(null); setActiveCallLead(null); setCallStatus(null); setCallElapsed(0); setCallMuted(false); });
        });
      logDial(lead.id);
    } else {
      window.location.href = 'tel:' + phoneClean;
      logDial(lead.id);
    }
  };

  const hangUp     = () => { if (activeCall) activeCall.disconnect(); };
  const toggleMute = () => { if (activeCall) { const m = !callMuted; activeCall.mute(m); setCallMuted(m); } };
  const sendDigit  = (digit) => { if (activeCall) activeCall.sendDigits(digit); };

  return {
    twilioDevice,      setTwilioDevice,
    useTwilioCalling,  setUseTwilioCalling,
    tokenServiceUrl,   setTokenServiceUrl,
    tokenUrlDraft,     setTokenUrlDraft,
    voiceDeviceStatus, setVoiceDeviceStatus,
    activeCall,        setActiveCall,
    activeCallLead,    setActiveCallLead,
    callStatus,        setCallStatus,
    callMuted,         setCallMuted,
    callElapsed,       setCallElapsed,
    dialLead,
    hangUp,
    toggleMute,
    sendDigit,
  };
}
