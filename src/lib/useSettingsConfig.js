/**
 * useSettingsConfig — v3.14 refactor
 *
 * Centralises all persisted settings state that was previously scattered
 * across App.jsx useState declarations and the initial load useEffect.
 *
 * Each config group uses a lazy useState initializer so localStorage is
 * read exactly once on mount — no need for a separate load useEffect.
 *
 * Covers: Financial · Gmail · Sequence Engine · Twilio · Callback Presets · Calendly
 */

import { useState, useCallback } from 'react';

// ── localStorage keys (must match App.jsx constants — never rename) ──
const LS_FINANCIAL  = 'metka-financial-config-v1';
const LS_GMAIL      = 'metka-gmail-config-v1';
const LS_SEQ_CONFIG = 'metka-seq-config-v1';
const LS_TWILIO     = 'metka-twilio-config-v1';
const LS_CB_PRESETS = 'metka-cb-presets-v1';
const LS_CALENDLY   = 'metka-calendly-v1';

// ── Defaults (exported so SettingsView can reference them for reset) ──
export const DEFAULT_FINANCIAL = {
  monthlyOverhead: 3921,
  monthlyNetNeeded: 2121,
  avgPayoutPct: 55,
  appsGoalWeek: 5,
  contractLevel: '85%',
  contractTarget: '100%',
};

export const DEFAULT_GMAIL     = { address: '', signature: '' };
export const DEFAULT_SEQ       = { appsScriptUrl: '', calendlyUrl: '', agentPhone: '' };
export const DEFAULT_TWILIO    = { accountSid: '', authToken: '', fromNumber: '' };
export const DEFAULT_CB_PRESETS = [
  { id: '2h',     label: '2 Hours',     minOffset: 120,  daysAhead: 0, hour: null },
  { id: 'tom_am', label: 'Tomorrow AM', minOffset: null, daysAhead: 1, hour: 9   },
  { id: 'tom_pm', label: 'Tomorrow PM', minOffset: null, daysAhead: 1, hour: 14  },
  { id: 'week',   label: 'Next Week',   minOffset: null, daysAhead: 7, hour: 9   },
];

// ── Safe localStorage read helper ────────────────────────────────────
const readLS = (key, def) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : def;
  } catch {
    return def;
  }
};

// ── Hook ─────────────────────────────────────────────────────────────
export const useSettingsConfig = () => {

  // ── Financial ──────────────────────────────────────────────────────
  const [financialConfig, setFinancialConfig] = useState(() => ({
    ...DEFAULT_FINANCIAL, ...readLS(LS_FINANCIAL, {}),
  }));
  const [financialDraft, setFinancialDraft] = useState(() => ({
    ...DEFAULT_FINANCIAL, ...readLS(LS_FINANCIAL, {}),
  }));
  const [financialSaved, setFinancialSaved] = useState(false);

  // ── Gmail ──────────────────────────────────────────────────────────
  const [gmailConfig, setGmailConfig] = useState(() => ({
    ...DEFAULT_GMAIL, ...readLS(LS_GMAIL, {}),
  }));
  const [gmailDraft, setGmailDraft] = useState(() => ({
    ...DEFAULT_GMAIL, ...readLS(LS_GMAIL, {}),
  }));
  const [gmailSaved, setGmailSaved] = useState(false);

  // ── Sequence Engine ────────────────────────────────────────────────
  const [seqConfig, setSeqConfig] = useState(() => ({
    ...DEFAULT_SEQ, ...readLS(LS_SEQ_CONFIG, {}),
  }));
  const [seqDraft, setSeqDraft] = useState(() => ({
    ...DEFAULT_SEQ, ...readLS(LS_SEQ_CONFIG, {}),
  }));
  const [seqSaved, setSeqSaved] = useState(false);

  // ── Twilio ─────────────────────────────────────────────────────────
  const [twilioConfig, setTwilioConfig] = useState(() => ({
    ...DEFAULT_TWILIO, ...readLS(LS_TWILIO, {}),
  }));
  const [twilioDraft, setTwilioDraft] = useState(() => ({
    ...DEFAULT_TWILIO, ...readLS(LS_TWILIO, {}),
  }));
  const [twilioSaved, setTwilioSaved] = useState(false);

  // ── Callback presets ───────────────────────────────────────────────
  const [callbackPresets, setCallbackPresets] = useState(() =>
    readLS(LS_CB_PRESETS, DEFAULT_CB_PRESETS)
  );

  // ── Calendly ───────────────────────────────────────────────────────
  const [calendlyUrl,      setCalendlyUrl]      = useState(() => localStorage.getItem(LS_CALENDLY) || '');
  const [calendlyDraft,    setCalendlyDraft]    = useState(() => localStorage.getItem(LS_CALENDLY) || '');
  const [showCalendlyCfg,  setShowCalendlyCfg]  = useState(false);
  const [calendlyTargetId, setCalendlyTargetId] = useState(null);

  // ── Persist helpers ────────────────────────────────────────────────
  const saveFinancial = useCallback(cfg => {
    setFinancialConfig(cfg);
    setFinancialDraft(cfg);
    try { localStorage.setItem(LS_FINANCIAL, JSON.stringify(cfg)); } catch {}
    setFinancialSaved(true);
    setTimeout(() => setFinancialSaved(false), 2000);
  }, []);

  const saveGmail = useCallback(cfg => {
    setGmailConfig(cfg);
    setGmailDraft(cfg);
    try { localStorage.setItem(LS_GMAIL, JSON.stringify(cfg)); } catch {}
    setGmailSaved(true);
    setTimeout(() => setGmailSaved(false), 2000);
  }, []);

  const saveSeq = useCallback(cfg => {
    setSeqConfig(cfg);
    setSeqDraft(cfg);
    try { localStorage.setItem(LS_SEQ_CONFIG, JSON.stringify(cfg)); } catch {}
    setSeqSaved(true);
    setTimeout(() => setSeqSaved(false), 2000);
  }, []);

  const saveTwilio = useCallback(cfg => {
    setTwilioConfig(cfg);
    setTwilioDraft(cfg);
    try { localStorage.setItem(LS_TWILIO, JSON.stringify(cfg)); } catch {}
    setTwilioSaved(true);
    setTimeout(() => setTwilioSaved(false), 2000);
  }, []);

  const saveCalendly = useCallback(url => {
    setCalendlyUrl(url);
    setCalendlyDraft(url);
    try { localStorage.setItem(LS_CALENDLY, url); } catch {}
  }, []);

  return {
    // Financial
    financialConfig, setFinancialConfig,
    financialDraft,  setFinancialDraft,
    financialSaved,  setFinancialSaved,
    saveFinancial,
    // Gmail
    gmailConfig,  setGmailConfig,
    gmailDraft,   setGmailDraft,
    gmailSaved,   setGmailSaved,
    saveGmail,
    // Sequence Engine
    seqConfig,  setSeqConfig,
    seqDraft,   setSeqDraft,
    seqSaved,   setSeqSaved,
    saveSeq,
    // Twilio
    twilioConfig,  setTwilioConfig,
    twilioDraft,   setTwilioDraft,
    twilioSaved,   setTwilioSaved,
    saveTwilio,
    // Callback presets
    callbackPresets, setCallbackPresets,
    // Calendly
    calendlyUrl,      setCalendlyUrl,
    calendlyDraft,    setCalendlyDraft,
    showCalendlyCfg,  setShowCalendlyCfg,
    calendlyTargetId, setCalendlyTargetId,
    saveCalendly,
    // Exported defaults
    DEFAULT_FINANCIAL,
  };
};
