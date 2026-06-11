
/*
 * METKA FIELD OPS CRM
 * ─────────────────────────────────────────
 * v1.0  Session 1  Base CRM — queue, pipeline, scripts, CSV import
 * v1.1  Session 1  UX redesign — Syne/DM Sans/JetBrains, CSS vars, stage stepper
 * v1.2  Session 1  Hybrid layout — slim sidebar, contacts database, top stats
 * v2.0  Session 2  Replaced Google Sheets with Supabase cloud sync
 * v2.1  Session 2  Click-to-Dial auto-tracking integrated
 * v2.2  Session 2  Underwriting Tracker — carrier/policy/premium, pending reqs, >7d stuck flag
 * v2.3  Session 2  Activity Tracker — daily dials/contacts/appts vs goals, dashboard, append-only event log
 * v3.0  Session 3  Twilio Browser Calling (Voice SDK)
 * v3.1  Session 3  Phase Lifecycle Engine — P1/P2/P3/M2/EXIT + Today's Block dial engine
 * v3.4  Session 3  Auto Follow-Up Scheduler
 * v3.5  Session 3  Activity log migrated to individual Supabase rows (append-only)
 * v3.6  Session 3  Financial Targets config card in Settings
 * ─────────────────────────────────────────
 * ACTIVE localStorage KEYS (never rename — data lives here between sessions):
 * metka-crm-leads-v3        Lead array (LZ-compressed)
 * metka-crm-scripts-v3      Script library
 * metka-templates-v1        SMS templates
 * metka-auth-v1             Auth session (12hr TTL)
 * metka-activity-v1         Activity event log
 * metka-activity-goals-v1   Daily activity targets
 * metka-use-twilio-calling  Boolean — browser calling toggle
 * metka-twilio-token-url    Twilio Function URL for access token
 * ─────────────────────────────────────────
 * LEAD SCHEMA v3.x (all fields):
 * Core: id, name, firstName, lastName, phone, email,
 * state, city, county, zip, age, loanAmount,
 * leadType, assignDate, bucket, stage, disposition,
 * lastContact, nextCallback, pdfUrl, notes[]
 * Health (optional): tobacco, dob, height, weight, medications, healthIssues, driveLink
 * UW (optional): carrier, policyNumber, expectedPremium,
 * submittedDate, policyIssueDate, pendingReqs[]
 *   — pendingReqs item: {id, label, done, completedAt}
 * Phase (v3.1): phase, phase_start, next_dial,
 * p1_1…p1_7, p2_1…p2_5, p3_1…p3_5
 * Appointment (v3.14): apptType ('household_audit'|'policy_review'|'annual_review'|'birthday'),
 * apptConfirmed (bool — set true after showed/no-show/reschedule resolved)
 * ─────────────────────────────────────────
 * ACTIVITY EVENT SCHEMA:
 * {id, ts (ISO), date ('YYYY-MM-DD' local), type ('dial'|'contact'|'appointment'),
 *  leadId, leadName, source ('auto'|'manual')}
 * GOALS: {dials, contacts, appointments} — daily targets, editable in Activity tab
 * ─────────────────────────────────────────
 * EXTERNAL SERVICES:
 * Supabase:  https://brskbcdaefmkcgctlhlb.supabase.co  (leads + activity tables)
 * Twilio:    Browser calling via Voice SDK + REST Messages (loader not yet wired)
 * Calendly:  Popup widget injected via window.Calendly for appointment booking
 * ─────────────────────────────────────────
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import LZString from 'lz-string';
import { createClient } from '@supabase/supabase-js';
// Device imported inside lib/useTwilioDevice.js
import TodaysBlock from './components/TodaysBlock';
import DashboardTab from './components/DashboardTab';
import CallBar from './components/CallBar';
import HourlyStats from './components/HourlyStats';
import ContactDetail, { StageStepper, UnderwritingCard } from './components/ContactDetail.jsx';
import MessagesView from './components/MessagesView.jsx';
import ContactsView from './components/ContactsView.jsx';
import PipelineView from './components/PipelineView.jsx';
import LeadOrdersView from './components/LeadOrdersView.jsx'; // v3.51 — economics
import ScriptsView from './components/ScriptsView.jsx';
import TemplatesView from './components/TemplatesView.jsx';
import SettingsView from './components/SettingsView.jsx';
import { STATE_TZ, STAGES, DISPS, BC, BL, NC, FIELD_MAP_DEFS,
  UW_STUCK_DAYS, UW_ACTIVE_STAGES, UW_VISIBLE_STAGES, DEFAULT_REQS,
  daysInUW, isUWStuck, reqStats,
  fmt, fmtDate, currency, chip, inp } from './constants.js';
// ── Library Modules (v3.6) ───────────────────────────────────────
import { sbUpsertLead, sbUpsertAll, sbDeleteLead, sbReconcileDeletes, sbLoadAll, sbSaveActivity, sbAppendActivity, sbLoadActivity, sbLoadSeqStats, sbBeaconFlush, sbSendSms } from './lib/supabaseSync.js';
import { backfillLead, getPhasePriority, isDueToday, SCHED_COLS, assignSlot, normalizePhaseSchedule, migrateAgedPhases, processMissedSlots, dryRunAgeRebase, RESURRECTION_ACTIVE, resurrectBucketC, dryRunResurrection } from './lib/phaseEngine.js'; // v3.44-48 phase machine
import { buildDispositionPatch } from './lib/dispositionEngine.js'; // v3.43 — F3 unified disposition logic
import { assignLeadOrders, orderRollup, medianDaysToBE } from './lib/leadOrders.js'; // v3.51 — economics
import { DEFAULT_GOALS, CONTACT_DISPS, ACTIVITY_TYPES, dayKey, TODAY_KEY, lastNDays, weekKeys, monthKeys, aggregateActivity, fmtTime, goalTone, makeActivityManager } from './lib/activityLog.js';
import { makeLeadManager } from './lib/leads.js';
import LoginGate, { useAuth } from './components/LoginGate.jsx';
import DEFAULT_SCRIPTS from './lib/defaultScripts.js';
import { parseBucket, parseDisp, parseStage, autoDetectMapping, parseCSV } from './lib/csvParser.js';
import CallbackQueue from './components/CallbackQueue.jsx';
import ActivityDashboard from './components/ActivityDashboard.jsx';
import DialView from './components/DialView.jsx';
import FieldMapModal from './components/FieldMapModal.jsx';
import { ccExchangeCode } from './lib/ccIntegration.js';
import AppointmentsView from './components/AppointmentsView.jsx';
import CCTab from './components/CCTab.jsx';
import SequenceTab from './components/SequenceTab.jsx';
import ImportModal from './components/ImportModal.jsx';
import NavSidebar from './components/NavSidebar.jsx';
import AppHeader from './components/AppHeader.jsx';
import AddLeadForm from './components/AddLeadForm.jsx';
import ScriptPanel from './components/ScriptPanel.jsx';
import { priority, openCalendlyPopup } from './lib/leadScoring.js'; // v3.43 — autoFollowUp moved into dispositionEngine
import { masterQueueSort } from './lib/phaseEngine';
import { useContactFilters } from './lib/useContactFilters.js';
import { useTwilioDevice } from './lib/useTwilioDevice.js';
import { useSettingsConfig } from './lib/useSettingsConfig.js';
import { useSupabaseHydration } from './lib/useSupabaseHydration.js';
import SequenceRunsTab from './components/SequenceRunsTab.jsx';
import { useImportHandlers } from './lib/useImportHandlers.js';
import AIPanel from './components/AIPanel.jsx';

// ── SUPABASE CLIENT ──────────────────────────────────────────────
// (All Supabase functions imported from lib/supabaseSync.js v3.6)
import { supabase } from './lib/supabaseSync.js';
import AppointmentConfirmModal from './components/AppointmentConfirmModal';

// ============================================================
// DASHBOARD TAB — Ministry of Protection HQ
// Self-contained React component. No external deps.
// Props: leads (array), activity (array), goals (object)
// ============================================================

// ── STORAGE & CONSTANTS ──────────────────────────────────────────
const LS_LEADS     = "metka-crm-leads-v3";
const LS_SCRIPTS   = "metka-crm-scripts-v3";
const LS_ACTIVITY  = "metka-activity-v1";        // v2.3
const LS_GOALS     = "metka-activity-goals-v1";  // v2.3
const LS_BACKUP      = "metka-crm-backup-v1";      // v2.6 pre-import snapshot
const LS_LAST_EXPORT = "metka-last-export-v1";     // v3.1 weekly backup reminder
const LS_MAPPING   = "metka-field-mapping-v1";   // v2.6 saved CSV column mapping
const LS_OPEN_ID   = "metka-open-id-v1";         // v3.0 persist queue position
const LS_SESSION   = "metka-session-v1";          // v3.0 dialing session
const LS_DELETED_IDS  = "metka-deleted-ids-v1";      // v3.14 tombstone map { [id]: deletedAtTs } for sync merge


// ── CONSTANTS + HELPERS ← imported from ./constants.js ─────────────

// ── ACTIVITY TRACKER: Imported from lib/activityLog.js (v3.6) ──────
// Constants: DEFAULT_GOALS, CONTACT_DISPS, ACTIVITY_TYPES
// Helpers: dayKey, TODAY_KEY, lastNDays, weekKeys, monthKeys
// Aggregation: aggregateActivity, fmtTime, goalTone
// (All previously defined inline above — now imported for modularity)

// ── priority, autoFollowUp, openCalendlyPopup → lib/leadScoring.js ─────

const todayStr=()=>new Date().toDateString();

const SEEDS=[
  {id:"s1",name:"Robert Dale Hutchins",firstName:"Robert",lastName:"Hutchins",phone:"(405) 555-0142",state:"OK",city:"Tulsa",age:"54",email:"rhutchins@email.com",leadType:"Mortgage Protection",loanAmount:"187000",bucket:"A",stage:"new",disposition:"not_called",lastContact:null,nextCallback:null,notes:[],pdfUrl:""},
  {id:"s2",name:"Patricia Lynn Odom",firstName:"Patricia",lastName:"Odom",phone:"(918) 555-0388",state:"OK",city:"Broken Arrow",age:"47",email:"",leadType:"Mortgage Protection",loanAmount:"224000",bucket:"A",stage:"contacted",disposition:"callback",lastContact:"2026-04-20",nextCallback:"2026-04-22T10:00",notes:[{ts:"2026-04-20T09:15:00",type:"call",text:"Spoke briefly. Husband was at work. She said call back Tuesday morning. Seemed interested."},{ts:"2026-04-18T14:00:00",type:"call",text:"No answer. VM left."}],pdfUrl:""},
];

// ── STYLE HELPERS ────────────────────────────────────────────────
// chip + inp style helpers ← imported from ./constants.js

function MetkaCRM(){
  const [leads,setLeads]=useState([]);
  const ITEMS_PER_PAGE = 50;
  const [loading,setLoading]=useState(true);
  // v3.24 — init view from URL hash so browser back/forward works
  // v3.24 — slot-launch signal: dashboard AM/PM tiles set this, DialView consumes + clears it
  const [pendingDialSlot, setPendingDialSlot] = useState(null);

  // v3.24 — init view from URL hash so browser back/forward works
  const [view,setView]=useState(() => {
    const hash = window.location.hash.replace('#','');
    const VALID = new Set(['dashboard','dial','contacts','pipeline','scripts','templates','settings','today']);
    return VALID.has(hash) ? hash : 'dashboard';
  });
  const [openId,setOpenId]=useState(null);
  const [detailTab,setDetailTab]=useState("activity");
  const [noteText,setNoteText]=useState("");
  const [noteType,setNoteType]=useState("call");
  const [cbDate,setCbDate]=useState("");
  const [cbTime,setCbTime]=useState("");
  const [addForm,setAddForm]=useState(false);
  const [newL,setNewL]=useState({name:"",phone:"",state:"OK",bucket:"A",leadType:"Mortgage Protection"});
  const [scripts,setScripts]=useState(DEFAULT_SCRIPTS);
  const [scriptType,setScriptType]=useState("Mortgage Protection");
  const [scriptSection,setScriptSection]=useState("phone");
  const [editingScript,setEditingScript]=useState(false);
  const [templates,setTemplates]=useState({});
  const [newTemplateName,setNewTemplateName]=useState("");
  const [newTemplateText,setNewTemplateText]=useState("");
  const [notificationsEnabled,setNotificationsEnabled]=useState(true);
  const [newReqText,setNewReqText]=useState(""); // v2.2 — scratch input for adding custom reqs
  // v3.7 — Appointment Show Confirmation (inline gate in LIVE tab)
  const [confirmReschedule, setConfirmReschedule] = useState(false);
  const [confirmCbDate, setConfirmCbDate] = useState("");
  const [confirmCbTime, setConfirmCbTime] = useState("");
  // v3.8 — Unified Dial View state
  const [dialSortMode, setDialSortMode] = useState("priority");
  const [dialRightTab, setDialRightTab] = useState("script");
  const [navOpen, setNavOpen] = useState(true); // v3.9 — collapses on dial view, hamburger to restore
  // v2.3 — Activity Tracker state
  const [activity,setActivity]=useState([]);
  const [seqStats,setSeqStats]=useState(null); // sequence_runs summaries (v3.21)
  const [goals,setGoals]=useState(DEFAULT_GOALS);
  const [activityRange,setActivityRange]=useState("today"); // today|week|month
  const [editingGoals,setEditingGoals]=useState(false);
  const [goalsDraft,setGoalsDraft]=useState(DEFAULT_GOALS);
  const fileRef=useRef();

  // Contacts Search & Filter State (extracted → lib/useContactFilters.js)
  const {
    searchQuery, setSearchQuery,
    filterBucket, setFilterBucket,
    filterStage, setFilterStage,
    filterDisp, setFilterDisp,
    queueMode, setQueueMode,
    filterState, setFilterState,
    filterTimezone, setFilterTimezone,
    filterMonth, setFilterMonth,
    showFilters, setShowFilters,
    page, setPage,
  } = useContactFilters();
  const [prevView, setPrevView] = useState("contacts");
  const [clockNow, setClockNow]     = useState(new Date());
  const [dupeLead, setDupeLead]     = useState(null);
  // ── Settings config (extracted → lib/useSettingsConfig.js v3.14) ──────────
  const {
    financialConfig, setFinancialConfig, financialDraft, setFinancialDraft, financialSaved, setFinancialSaved, saveFinancial,
    gmailConfig, setGmailConfig, gmailDraft, setGmailDraft, gmailSaved, setGmailSaved, saveGmail,
    seqConfig, setSeqConfig, seqDraft, setSeqDraft, seqSaved, setSeqSaved, saveSeq,
    twilioConfig, setTwilioConfig, twilioDraft, setTwilioDraft, twilioSaved, setTwilioSaved, saveTwilio,
    callbackPresets, setCallbackPresets,
    calendlyUrl, setCalendlyUrl, calendlyDraft, setCalendlyDraft,
    showCalendlyCfg, setShowCalendlyCfg, calendlyTargetId, setCalendlyTargetId, saveCalendly,
    aiConfig, setAiConfig, aiDraft, setAiDraft, aiSaved, setAiSaved, saveAi,
    DEFAULT_FINANCIAL,
  } = useSettingsConfig();
  const [backupExists, setBackupExists]       = useState(false);
  const [supaStatus, setSupaStatus]           = useState("idle"); // idle | syncing | ok | error
  // v4.0 — Twilio Voice state (extracted → lib/useTwilioDevice.js, wired after leadMgr)
  // v3.0 — Dialing session
  const [session, setSession]                 = useState(()=>{ try{ const s=localStorage.getItem(LS_SESSION); return s?JSON.parse(s):null; }catch{ return null; }});
  const [sessionPaused, setSessionPaused]     = useState(false);
  const [dialSessionActive, setDialSessionActive] = useState(false); // v3.2 — TODAY tab shifts to queue when active
  // v3.0 — Exclude filters
  const [exclBucket, setExclBucket]           = useState("none");
  const [exclStage, setExclStage]             = useState("none");
  const [exclDisp, setExclDisp]               = useState("none");

  // Page state + reset-on-filter-change lives in useContactFilters hook
  useEffect(() => { try{ if(openId) localStorage.setItem(LS_OPEN_ID,openId); else localStorage.removeItem(LS_OPEN_ID); }catch{} }, [openId]);

  // v4.0 — Twilio Voice Device/Call state lives in useTwilioDevice hook (wired after leadMgr below)

  // ── CONSTANT CONTACT OAUTH CALLBACK (v4.1) ─────────────────────────────
  // Handles the /cc-callback route when CC redirects back after authorization.
  // Runs once on mount; cleans up the URL after processing.
  useEffect(() => {
    if (window.location.pathname !== '/cc-callback') return;
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const errCode = params.get('error');
    const errDesc = params.get('error_description');

    // CC sent back an error (e.g. access_denied, invalid_request)
    if (!code) {
      ccClearTokens();
      if (errCode) {
        alert('Constant Contact denied access.\n\nError: ' + errCode + '\n' + (errDesc || '') + '\n\nGo to Settings → Connect Constant Contact to retry.');
      }
      window.location.replace('/');
      return;
    }

    ccExchangeCode(code)
      .then(() => { window.location.replace('/'); })
      .catch(err => {
        ccClearTokens();
        alert('Constant Contact token exchange failed — go to Settings and tap Connect to retry.\n\nDetail: ' + err.message);
        window.location.replace('/');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

 useEffect(()=>{
    try{
      // Load Leads
      const r = localStorage.getItem(LS_LEADS);
      let initialLeads = SEEDS;
      if (r) {
        try {
          // Try decompressing first (new format), fall back to raw JSON (old format)
          const decompressed = LZString.decompressFromUTF16(r);
          initialLeads = JSON.parse(decompressed || r);
        } catch { initialLeads = SEEDS; }
      }
      // v3.11 — One-time backfill: build phase schedule for any Bucket A lead missing one.
      // Prevents all 466 leads from flooding the Today queue simultaneously.
      // Safe: only touches leads with no existing phase; skips EXIT/DNC leads.
      const SKIP_DISPS = new Set(['dnc','not_interested','withdrawn','chargeback','appointment_booked','no_sale']);
      let backfillCount = 0;
      const backfilledLeads = initialLeads.map(l => {
        if (l.bucket !== 'A') return l;
        if (l.phase) return l; // already has a schedule
        if (SKIP_DISPS.has(l.disposition)) return l;
        backfillCount++;
        return backfillLead(l);
      });
      if (backfillCount > 0) {
        initialLeads = backfilledLeads;
        // Persist immediately so backfill doesn't re-run next load
        try {
          localStorage.setItem(LS_LEADS, LZString.compressToUTF16(JSON.stringify(initialLeads)));
        } catch(e) { console.warn('[CRM v3.11] Could not persist backfill:', e); }
        console.log(`[CRM v3.11] Backfilled ${backfillCount} Bucket A leads with phase schedules`);
      }

      // v3.12 — Slot backfill: assign AM/PM slot to any lead missing one
      let slotCount = 0;
      const slottedLeads = initialLeads.map(l => {
        if (l.slot) return l;
        slotCount++;
        return { ...l, slot: assignSlot(l) };
      });
      if (slotCount > 0) {
        initialLeads = slottedLeads;
        try {
          localStorage.setItem(LS_LEADS, LZString.compressToUTF16(JSON.stringify(initialLeads)));
        } catch(e) { console.warn('[CRM v3.12] Could not persist slot backfill:', e); }
        console.log(`[CRM v3.12] Assigned session slots to ${slotCount} leads`);
      }

      // v3.23 — One-time AM/PM slot rebalance: fix upload-day clustering from odd/even day algo.
      // Old assignSlot used day-of-month parity — all leads uploaded on odd days got AM.
      // This migration forces a 50/50 index-based split across ALL existing leads.
      // Runs once (flag stored in localStorage). New leads use the fixed ID-hash assignSlot.
      const LS_SLOT_REBALANCE = 'metka-slot-rebalance-v2';
      if (!localStorage.getItem(LS_SLOT_REBALANCE)) {
        console.log('[CRM v3.23] Running one-time AM/PM slot rebalance...');
        initialLeads = initialLeads.map((l, idx) => ({ ...l, slot: idx % 2 === 0 ? 'AM' : 'PM' }));
        localStorage.setItem(LS_SLOT_REBALANCE, '1');
        try {
          localStorage.setItem(LS_LEADS, LZString.compressToUTF16(JSON.stringify(initialLeads)));
        } catch(e) { console.warn('[CRM v3.23] Could not persist slot rebalance:', e); }
        console.log(`[CRM v3.23] Rebalanced ${initialLeads.length} leads to 50/50 AM/PM`);
      }

      // v3.32 — Re-rebalance: Supabase hydration was silently wiping slot assignments
      // (remote lead objects don't carry slot field; newest-_ts merge took full remote object).
      // Fixed in useSupabaseHydration v3.32. This migration repairs all leads that lost their slot.
      // Uses ID-hash assignSlot (deterministic — same lead always gets same slot).
      const LS_SLOT_REBALANCE_V3 = 'metka-slot-rebalance-v3';
      if (!localStorage.getItem(LS_SLOT_REBALANCE_V3)) {
        console.log('[CRM v3.32] Repairing slot assignments wiped by Supabase hydration...');
        const before = initialLeads.filter(l => !l.slot).length;
        initialLeads = initialLeads.map(l => l.slot ? l : { ...l, slot: assignSlot(l) });
        localStorage.setItem(LS_SLOT_REBALANCE_V3, '1');
        try {
          localStorage.setItem(LS_LEADS, LZString.compressToUTF16(JSON.stringify(initialLeads)));
        } catch(e) { console.warn('[CRM v3.32] Could not persist slot repair:', e); }
        console.log(`[CRM v3.32] Repaired ${before} leads missing slot assignment`);
      }

      // v3.15 — Phase date normalization: repair leads whose next_dial is past-due.
      // Leads imported months ago have stale next_dial dates and flood Today queue every session.
      // Repairs next_dial to the earliest future slot; nulls it when all slots are exhausted.
      // Idempotent — safe to run on every startup.
      let normCount = 0;
      const normalizedLeads = initialLeads.map(l => {
        const patch = normalizePhaseSchedule(l);
        if (!patch) return l;
        normCount++;
        return { ...l, ...patch };
      });
      if (normCount > 0) {
        initialLeads = normalizedLeads;
        try {
          localStorage.setItem(LS_LEADS, LZString.compressToUTF16(JSON.stringify(initialLeads)));
        } catch(e) { console.warn('[CRM v3.15] Could not persist phase normalization:', e); }
        console.log(`[CRM v3.15] Normalized past-due phase schedules on ${normCount} leads`);
      }

      // v3.44 — CALENDAR PHASE ENGINE startup pass (replaces v3.42 spreadOverdueLeads).
      // (a) Aged-phase migration: day 61+ → M2 (tiered, schedule wiped), day 181+ → M3.
      //     No lead ever goes silently dark after p3_5 — Jeremy's "no age-kill" M3 decision.
      // (b) Missed-slot auto-log: slots >24h past are consumed as no-answer and the
      //     schedule marches on (missed-block philosophy locked 2026-06-10). Events
      //     only for slots missed since last app open; older slots consume silently.
      // Changed leads get a fresh _ts and push to Supabase below (audit F7 fix).
      const LS_LAST_SEEN = 'metka-last-seen-v1';
      const _lastSeenIso = localStorage.getItem(LS_LAST_SEEN);
      const _changedIds = new Set();
      const _tsNow = Date.now();
      // v3.48 — Bucket C resurrection (flag-gated; dry-run logs until approved)
      if (RESURRECTION_ACTIVE) {
        let _resCount = 0;
        initialLeads = initialLeads.map(l => {
          const p = resurrectBucketC(l);
          if (!p) return l;
          _resCount++; _changedIds.add(l.id);
          return { ...l, ...p, _ts: _tsNow };
        });
        if (_resCount) console.log('[CRM v3.48] RESURRECTION APPLIED: ' + _resCount + ' Bucket C leads → M3');
      } else {
        const _res = dryRunResurrection(initialLeads);
        console.log('[CRM v3.48] BUCKET C RESURRECTION (dry-run, NOT applied): ' +
          _res.candidates + ' candidates → M3 · ' + _res.terminals + ' true terminals stay EXIT · ' +
          _res.clients + ' clients excluded (5 R\'s track)');
      }

      let _agedCount = 0;
      initialLeads = initialLeads.map(l => {
        const p = migrateAgedPhases(l);
        if (!p) return l;
        _agedCount++; _changedIds.add(l.id);
        return { ...l, ...p, _ts: _tsNow };
      });
      const _ms = processMissedSlots(initialLeads, _lastSeenIso);
      if (_ms.changedIds.size > 0) {
        initialLeads = _ms.leads.map(l => _ms.changedIds.has(l.id) ? { ...l, _ts: _tsNow } : l);
        _ms.changedIds.forEach(id => _changedIds.add(id));
      }
      if (_changedIds.size > 0) {
        try {
          localStorage.setItem(LS_LEADS, LZString.compressToUTF16(JSON.stringify(initialLeads)));
        } catch(e) { console.warn('[CRM v3.44] Could not persist phase migration:', e); }
        // F7 — push migrated subset to Supabase so the cloud never drifts
        const _changedLeads = initialLeads.filter(l => _changedIds.has(l.id));
        sbUpsertAll(_changedLeads).catch(e => console.warn('[CRM v3.44] migration push failed:', e.message));
        console.log(`[CRM v3.44] Phase migration: ${_agedCount} leads → M2/M3; ${_ms.changedIds.size} leads had missed slots consumed (${_ms.events.length} auto-logged, ${_ms.silentCount} silent)`);
      }
      if (_ms.events.length > 0) {
        // Auto-logged missed-block dials → activity log (localStorage + Supabase)
        try {
          const rawAct = localStorage.getItem(LS_ACTIVITY);
          const curAct = rawAct ? JSON.parse(rawAct) : [];
          const nextAct = [..._ms.events, ...curAct];
          localStorage.setItem(LS_ACTIVITY, JSON.stringify(nextAct.slice(0, 2000)));
        } catch {}
        sbSaveActivity(_ms.events).catch(() => {});
      }
      localStorage.setItem(LS_LAST_SEEN, new Date().toISOString());

      // v3.51 — one-time lead-order clustering: every historical lead gets a
      // leadOrderId (source + level + assign-week). Economics needs cohorts.
      const LS_ORDER_BACKFILL = 'metka-order-backfill-v2'; // v3.52 — re-cluster after field-map bug fix
      if (!localStorage.getItem(LS_ORDER_BACKFILL)) {
        const _ord = assignLeadOrders(initialLeads);
        if (_ord.changed > 0) {
          initialLeads = _ord.leads;
          try {
            localStorage.setItem(LS_LEADS, LZString.compressToUTF16(JSON.stringify(initialLeads)));
          } catch(e) { console.warn('[CRM v3.51] order backfill persist failed:', e); }
          console.log(`[CRM v3.51] Lead-order backfill: ${_ord.changed} leads clustered into orders`);
        }
        localStorage.setItem(LS_ORDER_BACKFILL, '1');
      }

      // v3.47 — S3b age re-base DRY-RUN (re-base is OFF until Jeremy approves).
      // Prints projected phase distribution; changes NOTHING.
      try {
        const _proj = dryRunAgeRebase(initialLeads);
        console.log('[CRM v3.47] AGE RE-BASE PROJECTION (dry-run, NOT applied): ' +
          'current ' + JSON.stringify(_proj.current) + ' → projected ' + JSON.stringify(_proj.projected) +
          ' · ' + _proj.moved + ' leads would shift basis');
      } catch(e) { console.warn('[CRM v3.47] projection failed:', e.message); }

      // v3.38 — One-time phone dedup: removes duplicate leads sharing the same phone number.
      // Newest _ts wins. Tombstones removed IDs so Supabase hydration doesn't re-add them.
      const LS_PHONE_DEDUP = 'metka-phone-dedup-v1';
      if (!localStorage.getItem(LS_PHONE_DEDUP)) {
        console.log('[CRM v3.38] Running one-time phone dedup...');
        const _phoneMap = new Map();
        const _noPhone = [];
        initialLeads.forEach(l => {
          const p = (l.phone || '').replace(/\D/g, '');
          if (!p) { _noPhone.push(l); return; }
          const ex = _phoneMap.get(p);
          if (!ex || (l._ts || 0) >= (ex._ts || 0)) _phoneMap.set(p, l);
        });
        const _deduped = [...Array.from(_phoneMap.values()), ..._noPhone];
        const _removed = initialLeads.length - _deduped.length;
        if (_removed > 0) {
          // Tombstone removed IDs so hydration doesn't re-add them from Supabase
          let _tombstones = {};
          try { _tombstones = JSON.parse(localStorage.getItem(LS_DELETED_IDS) || '{}'); } catch {}
          const _keptIds = new Set(_deduped.map(l => l.id));
          const _now38 = Date.now();
          initialLeads.forEach(l => { if (!_keptIds.has(l.id)) _tombstones[l.id] = _now38; });
          try { localStorage.setItem(LS_DELETED_IDS, JSON.stringify(_tombstones)); } catch {}
          initialLeads = _deduped;
          try {
            localStorage.setItem(LS_LEADS, LZString.compressToUTF16(JSON.stringify(initialLeads)));
          } catch(e) { console.warn('[CRM v3.38] Could not persist phone dedup:', e); }
          console.log(`[CRM v3.38] Phone dedup: removed ${_removed} duplicate leads`);
        }
        localStorage.setItem(LS_PHONE_DEDUP, '1');
      }

      setLeads(initialLeads);

      // Load Scripts & Templates
      const rs = localStorage.getItem(LS_SCRIPTS);
      const t = localStorage.getItem("metka-templates-v1");
      if(rs) setScripts(JSON.parse(rs));
      if(t) setTemplates(JSON.parse(t)); else setTemplates({
        "gl_01_opener":      {name:"GL/DLHA — 1. Opener + TCPA",        text:"Hey {first_name}, this is Jeremy Metka your Field Underwriter following up with the life insurance quotes you requested. I can call you later today, or I can ask you a few questions over text to get your offers. Are you ok with answering a couple of basic medical questions over text to get better pricing? Reply STOP to opt out."},
        "mp_01_opener":      {name:"MP — 1. Opener + TCPA",              text:"Hey {first_name}, this is Jeremy Metka your Field Underwriter following up on your mortgage protection request. I can call you later today, or ask a few quick questions over text to get your options ready. Are you ok with a couple of basic questions over text? Reply STOP to opt out."},
        "hpa_01_opener":     {name:"HPA Form — 1. Opener",               text:"Hey {first_name}, Jeremy Metka here — Senior Field Underwriter with Ministry of Protection. Got your Household Protection Audit request. Happy to walk through everything over text or set up a quick call — which works better for you? Reply STOP to opt out."},
        "q_02_verify":       {name:"Q2 — Verify Info",                   text:"Hi {first_name}, let's start by confirming your submitted info: {name}, {age}, {state}. Is this correct?"},
        "q_03_health":       {name:"Q3 — Health History",                text:"Excellent {first_name}. Do you have any history of medical conditions of any kind (e.g., high blood pressure, heart conditions, sleep apnea, stroke, cancer, diabetes, or depression)?"},
        "q_04_coverage":     {name:"Q4 — Coverage Amount",               text:"Excellent, and how much coverage are you looking for?"},
        "q_05_who_else":     {name:"Q5 — Anyone Else",                   text:"Easy enough — are you looking for coverage on anyone else or just yourself?"},
        "q_06_book_call":    {name:"Q6 — Book the Call",                 text:"That's all the info I need to go to work on your options. Since there are a few different ways we can get your family protected, I wanted to jump on a 7 minute call to show you what you qualify for. Would it be better for you to do that in the morning, afternoon or evening?"},
        "appt_07_reminder":  {name:"Appt — Reminder (24hr)",             text:"Hi {first_name}, this is Jeremy with a friendly reminder for our appointment on {date} at {time}. Reply YES to confirm."},
        "appt_08_confirmed": {name:"Appt — Post-YES Confirmation",       text:"My pleasure, we will talk then. Feel free to reach out with anything in the meantime."},
        "appt_09_save_num":  {name:"Appt — Save Number + Card",          text:"Perfect — please save my name in your phone, I'll call from this number. For ease here is my digital business card: https://hihello.me/p/6cc69b25-86ec-4c39-a45b-fd48bee85403"},
      });
      
      if(!r) localStorage.setItem(LS_LEADS,JSON.stringify(SEEDS));

      // v2.3 — Load Activity log + goals
      const a = localStorage.getItem(LS_ACTIVITY);
      if(a){ try{ const arr=JSON.parse(a); if(Array.isArray(arr)) setActivity(arr); }catch{} }
      // v2.6 — Check if backup exists
      if(localStorage.getItem(LS_BACKUP)) setBackupExists(true);
      // v4.0 — Restore Twilio Voice calling toggle
      const savedTokenUrl = localStorage.getItem('metka-twilio-token-url') || '';
      if(savedTokenUrl){ setTokenServiceUrl(savedTokenUrl); setTokenUrlDraft(savedTokenUrl); }
      // v3.0 — Restore last open lead
      const savedOpenId = localStorage.getItem(LS_OPEN_ID);
      if(savedOpenId) setOpenId(savedOpenId);
      const g = localStorage.getItem(LS_GOALS);
      if(g){
        try{
          const gp=JSON.parse(g);
          const merged={...DEFAULT_GOALS, ...gp};
          setGoals(merged); setGoalsDraft(merged);
        }catch{}
      }
    }catch(e){
      console.error("Persistence Error:", e);
      setLeads(SEEDS);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // ── Supabase cloud hydration (extracted → lib/useSupabaseHydration.js v3.14) ──
  useSupabaseHydration(setLeads, setActivity, setSupaStatus);

  // ── Load sequence run history from Supabase (v3.21) ─────────────
  useEffect(() => {
    sbLoadSeqStats(14).then(rows => { if (rows) setSeqStats(rows); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SAVE: local-first, Supabase cloud sync (non-blocking) ──
const saveLeads = useCallback((next, opts = {}) => {
  // Deduplicate by ID — last occurrence wins (most recent update)
  const seen = new Map();
  next.forEach(l => seen.set(l.id, l));
  const deduped = Array.from(seen.values());
  if (deduped.length !== next.length) console.warn(`[saveLeads] Removed ${next.length - deduped.length} duplicate IDs`);
  // v3.14 — stamp _ts on any lead that doesn't have one yet (new leads, imports, first run)
  const _now = Date.now();
  next = deduped.map(l => l._ts ? l : { ...l, _ts: _now });
  setLeads(next);
  try {
    const stringData = JSON.stringify(next);
    // Use LZ-String to compress the massive lead array
    const compressed = LZString.compressToUTF16(stringData);
    localStorage.setItem(LS_LEADS, compressed);
    console.log("Saved & Compressed. Size reduction: " + (100 - Math.round((compressed.length / stringData.length) * 100)) + "%");
  } catch (e) {
    alert("Storage Full! Even with compression, the browser cannot save more leads.");
  }

  // v2.6 — push to Supabase (bulk upsert, non-blocking)
  if (!opts.skipSupa) {
    setSupaStatus("syncing");
    sbUpsertAll(next).then(() => setSupaStatus("ok")).catch(e => { console.warn('[Supabase] saveLeads error:', e.message); setSupaStatus("error"); });
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
  // v3.12 — single-lead persist used by upd() functional updater (avoids stale-closure race in PD mode)
  // Writes compressed localStorage + fires Supabase single-row upsert. Does NOT call setLeads (already done).
  const persistLeads = useCallback((next, updatedLead) => {
    // v3.14 — stamp _ts on the modified lead so per-lead merge has an accurate timestamp
    const stamped = updatedLead ? { ...updatedLead, _ts: Date.now() } : updatedLead;
    const toStore = stamped
      ? next.map(l => l.id === stamped.id ? stamped : l)
      : next;
    try {
      const stringData = JSON.stringify(toStore);
      const compressed = LZString.compressToUTF16(stringData);
      localStorage.setItem(LS_LEADS, compressed);
    } catch (e) {
      alert("Storage Full! Even with compression, the browser cannot save more leads.");
    }
    // v3.27 — wire Supabase failure to supaStatus so ERR badge fires on per-lead saves too
    if (stamped) {
      setSupaStatus('syncing');
      dirtyLeadIds.current.add(stamped.id);          // v3.34 — mark dirty
      sbUpsertLead(stamped)
        .then(() => { dirtyLeadIds.current.delete(stamped.id); setSupaStatus('ok'); })
        .catch(() => setSupaStatus('error'));          // stays dirty — beacon will flush
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSupaStatus]);


  // v3.34 — Dirty-lead tracker: keeps IDs of leads written locally but not yet
  // confirmed by Supabase. On tab close / visibility-hidden, beacon-flush them
  // so cross-browser/cross-device hydration always has the freshest data.
  const dirtyLeadIds = React.useRef(new Set());
  const dirtyLeadsRef = React.useRef([]);  // mirror of leads for beforeunload (avoids stale closure)

  // Keep dirtyLeadsRef current so beforeunload can read latest state
  React.useEffect(() => { dirtyLeadsRef.current = leads; }, [leads]);

  // beforeunload + visibilitychange: flush dirty leads with keepalive fetch
  React.useEffect(() => {
    const flush = () => {
      const ids = dirtyLeadIds.current;
      if (ids.size === 0) return;
      const toFlush = dirtyLeadsRef.current.filter(l => ids.has(l.id));
      if (toFlush.length > 0) {
        sbBeaconFlush(toFlush);
        console.log(`[v3.34] Beacon flush: ${toFlush.length} dirty leads pushed on close`);
      }
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const saveScripts=next=>{setScripts(next);try{localStorage.setItem(LS_SCRIPTS,JSON.stringify(next));}catch{}};
  const saveTemplates=next=>{setTemplates(next);try{localStorage.setItem("metka-templates-v1",JSON.stringify(next));}catch{}};

  // v2.3 — Activity log persistence
  // v3.5 — localStorage only. Supabase writes happen per-event in logActivity (append-only).
  //         Bulk sbSaveActivity is reserved for startup repair when remote is behind local.
  const saveActivity=useCallback(next=>{
    setActivity(next);
    try{localStorage.setItem(LS_ACTIVITY,JSON.stringify(next.slice(0,2000)));}catch{}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  // v3.13 — Functional-updater append for activity events fired inside leads.js upd().
  // Uses setActivity(prev=>) so it always reads current state — fixes 0/20 CONTACTS / 0/5 APPTS bug
  // caused by stale `activity` snapshot in makeLeadManager closure during rapid PD dialing.
  const appendActivity = useCallback(evs => {
    setActivity(prev => {
      const next = [...evs, ...prev];
      // Cap localStorage at 2000 events to stay under the 5MB limit.
      // Full history lives in Supabase; local only needs recent data for aggregation.
      try { localStorage.setItem(LS_ACTIVITY, JSON.stringify(next.slice(0, 2000))); } catch {}
      return next;
    });
  }, []);
  const saveGoals=next=>{
    setGoals(next);
    try{localStorage.setItem(LS_GOALS,JSON.stringify(next));}catch{}
  };
  // ── ACTIVITY + LEAD MANAGEMENT: Factory Pattern (v3.6, memoized) ───────────
  // Wrapped in useMemo so downstream components don't re-render on unrelated state changes.
  // saveLeads + saveActivity are useCallback([]) — stable refs, safe as useMemo deps.
  const activityMgr = useMemo(
    () => makeActivityManager(setActivity, leads, saveActivity, appendActivity), // v3.13 — appendActivity fixes manual +1 button
    [leads, saveActivity, appendActivity] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const leadMgr = useMemo(
    () => makeLeadManager(
      leads, activity, saveLeads, saveActivity, setOpenId, setView, prevView,
      newL, setNewL, setDupeLead, setAddForm,
      cbDate, cbTime, setCbDate, setCbTime,
      noteText, setNoteText, noteType,
      setLeads, persistLeads,  // v3.12 — functional updater + single-lead persist
      appendActivity           // v3.13 — functional updater for activity events (fixes stale closure)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, saveLeads, saveActivity, prevView,
     newL, cbDate, cbTime, noteText, setNoteText, noteType]
  );
  const { undoLastActivity, logActivity } = activityMgr;
  const { upd, addNote, logDial, lockCB, deleteLead, addLead } = leadMgr;

  // v4.0 — Twilio Voice SDK (extracted → lib/useTwilioDevice.js)
  // Called here so upd + logDial are already resolved from leadMgr above.
  const {
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
  } = useTwilioDevice({ upd, logDial });

  // ── Import handlers (extracted → lib/useImportHandlers.js v3.14) ────────────────────────
  // Placed here so saveLeads, backfillLead, and setBackupExists are all resolved.
  const {
    importModal,    setImportModal,
    importPreview,  setImportPreview,
    replaceConfirm, setReplaceConfirm,
    fieldMapModal,  setFieldMapModal,
    csvRawText,     setCsvRawText,
    csvHeaders,     setCsvHeaders,
    fieldMapDraft,  setFieldMapDraft,
    saveMappingCb,  setSaveMappingCb,
    savedMapping,   setSavedMapping,
    handleFile,
    confirmFieldMapping,
    confirmImport,
    restoreBackup,
  } = useImportHandlers({ leads, saveLeads, backfillLead, setBackupExists });

  const addTemplate=()=>{
    if(!newTemplateName.trim()||!newTemplateText.trim()) return;
    const key=`t_${Date.now()}`;
    saveTemplates({...templates,[key]:{name:newTemplateName,text:newTemplateText}});
    setNewTemplateName("");setNewTemplateText("");
  };
  const deleteTemplate=key=>{
    const next={...templates};delete next[key];saveTemplates(next);
  };
  const interpolate=(text,lead)=>{
    if(!lead) return text;
    return text
      .replace(/\[FIRST_NAME\]/g,lead.firstName||lead.name||"")
      .replace(/\[CITY\]/g,lead.city||"your area")
      .replace(/\[STATE\]/g,lead.state||"")
      .replace(/\[LOAN_AMOUNT\]/g,currency(lead.loanAmount)||"your mortgage amount")
      .replace(/\[AGE\]/g,lead.age||"__")
      .replace(/\[TIME\]/g,"__________")
      .replace(/\[DATE\]/g,"__________")
      .replace(/\[DAY\]/g,"__________")
      .replace(/\[TIME PERIOD\]/g,"a while back")
      .replace(/\[LEAD TYPE\]/g,lead.leadType||"life insurance");
  };

  // ── LIVE SCRIPT TOKEN RENDERER ───────────────────────────────────

  // ── UW helpers (operate on the open lead) ──
  const initUWReqs=id=>{
    const list=DEFAULT_REQS.map((label,i)=>({id:`r${Date.now()}_${i}`,label,done:false}));
    upd(id,{pendingReqs:list});
  };
  // v3.36 — functional updaters eliminate stale-closure data loss on pendingReqs.
  const toggleUWReq=(id,reqId)=>{
    upd(id, cur => {
      const list=(cur.pendingReqs||[]).map(r=>r.id===reqId?{...r,done:!r.done,completedAt:!r.done?new Date().toISOString():null}:r);
      return {pendingReqs:list};
    });
  };
  const removeUWReq=(id,reqId)=>{
    upd(id, cur => ({pendingReqs:(cur.pendingReqs||[]).filter(r=>r.id!==reqId)}));
  };
  const addUWReq=(id,label)=>{
    if(!label || !label.trim()) return;
    upd(id, cur => ({pendingReqs:[...(cur.pendingReqs||[]),{id:`r${Date.now()}`,label:label.trim(),done:false}]}));
    setNewReqText("");
  };
// Rebuild queue order from live priority scores.
  // No session: queue is already live-sorted — just flashes the count as confirmation.
  // Active session: re-sorts all leads fresh, updates session.ids, keeps current lead at top.
  const refreshQueueOrder = () => {
    const freshSorted = [...leads]
      .filter(l => l.stage !== 'removed' && !['dnc','not_interested','withdrawn','chargeback'].includes(l.disposition))
      .sort((a, b) => priority(b) - priority(a))
      .slice(0, ITEMS_PER_PAGE)
      .map(l => l.id);

    if (session) {
      const currentId = session.ids[session.idx] || null;
      // Keep the current lead at position 0 so you don't lose your place
      let newIds = [...freshSorted];
      if (currentId) {
        const pos = newIds.indexOf(currentId);
        if (pos > 0) { newIds.splice(pos, 1); newIds.unshift(currentId); }
        else if (pos === -1) { newIds.unshift(currentId); } // lead was filtered out, force it back
      }
      const updated = { ...session, ids: newIds, idx: 0, total: newIds.length };
      setSession(updated);
      try { localStorage.setItem(LS_SESSION, JSON.stringify(updated)); } catch {}
      if (currentId) setOpenId(currentId);
    }
    // No session — queue useMemo already reflects live priority, no action needed.
    // The button press itself triggers a re-render that confirms the order is current.
  };

  // ── POWER DIAL TODAY — Phase Engine queue (v3.9) ─────────────────
  // Filters leads using isDueToday() (phase-aware) and sorts by getPhasePriority().
  // Starts a locked session in the dial view — auto-advances on every disposition.
  const todayLeads  = useMemo(() => leads.filter(isDueToday).sort((a, b) => getPhasePriority(b) - getPhasePriority(a)), [leads]);
  const todayCount  = useMemo(() => todayLeads.length, [todayLeads]);

  const handleDisposition = (dispId) => {
    if (!open) return;

    // v3.4 — capture nextId BEFORE upd() so queue state is frozen at this moment
    // (upd → setLeads → queue recalculates on next render — reading after causes -1 index jumps)
    let nextId = null;
    let sessionComplete = false;
    const inDialer = view === "dial" && !sessionPaused;

    if (inDialer) {
      if (session) {
        const nextIdx = session.idx + 1;
        if (nextIdx < session.ids.length) {
          nextId = session.ids[nextIdx];
          const updated = {...session, idx: nextIdx};
          setSession(updated);
          try{localStorage.setItem(LS_SESSION, JSON.stringify(updated));}catch{}
        } else {
          sessionComplete = true;
        }
      } else {
        // Free queue mode — find current position before queue changes
        const currentIndex = queue.findIndex(l => l.id === open.id);
        if (currentIndex >= 0) {
          nextId = queue[currentIndex + 1]?.id || null;
        }
        // currentIndex === -1 means lead isn't in queue (opened from contacts) — don't advance
      }
    }

    // v3.43 — F3: unified disposition logic. buildDispositionPatch is the single
    // source of truth (stage map, phase transition, auto-callbacks, disposition
    // notes, direct-VM counter). Computed inside the functional updater from the
    // FRESHEST lead state — also fixes the stale `open` read on directVmCount.
    upd(open.id, (freshestLead) => buildDispositionPatch(freshestLead, dispId));

    // v3.4 — advance to next lead (nextId captured pre-upd, no index-jump risk)
    if (inDialer) {
      if (sessionComplete) {
        setSession(null);
        try{localStorage.removeItem(LS_SESSION);}catch{}
        setTimeout(()=>{ setOpenId(null); setDialSessionActive(false); alert("✅ Session complete! "+session.total+" leads worked."); }, 150);
        return;
      }
      if (nextId) {
        setTimeout(() => { setOpenId(nextId); setNoteText(""); setDetailTab("live"); }, 150);
      } else {
        setTimeout(() => setOpenId(null), 150);
      }
    }
  };
// ── Named callbacks hoisted out of JSX (v3.14 cleanup) ──────────────────────
  // TodaysBlock — phase-aware disposition handler
  // v3.39 — functional updater: phasePatch computed from freshest lead state inside setLeads(prev=>)
  const handleTodayDispose = useCallback((id, dispId) => {
    // v3.43 — F3: identical patch to the dial view. TodaysBlock dispositions now
    // get auto-callbacks (no_show 24h, follow-up 96h), disposition notes, and
    // direct-VM handling they previously silently lost.
    upd(id, (freshLead) => buildDispositionPatch(freshLead, dispId));
  }, [upd]); // eslint-disable-line react-hooks/exhaustive-deps

  // DashboardTab — start a locked dial session from the priority queue widget
const queue = useMemo(() => {
  // During an active session, keep all session leads visible regardless of calledToday.
  // Agent needs the full list in front of them — leads shouldn't vanish as they work through them.
  const inSession = !!(session && session.ids && session.ids.length > 0);
  const sessionIdSet = inSession ? new Set(session.ids) : null;

  // Dispositions that mean "done for now — schedule out, leave queue"
  // Only these trigger hiding/sinking. Dialing alone (lastContact stamp) does NOT.
  const SINK_DISPS = ['no_answer','vm_left','direct_vm','follow_up_needed','chargeback','hung_up'];
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
  const dispositionedToday = (l) =>
    SINK_DISPS.includes(l.disposition) &&
    l.lastContact && l.lastContact === todayStr;

  const filtered = [...leads].filter(l => {
    // Ghost Protocol: hard-remove all terminal dispositions + removed stage
    if(l.stage === 'removed') return false;
    if(['dnc','not_interested','withdrawn','chargeback'].includes(l.disposition)) return false;
    // Hide leads that were dispositioned today with a far-out callback (no_answer, vm_left, etc.)
    // Leads that were merely dialed (no disposition yet) stay in queue — dial click alone is not enough.
    if(dispositionedToday(l)) return false;
    return true;
  });

  // QUEUE LOCK: When a session is active, freeze order to the snapshot captured at session start.
  // Exception: leads worked this session (workedToday + no near callback) sink to the bottom —
  // they're done for now but stay accessible if needed.
  if (session && session.ids && session.ids.length > 0) {
    const posMap = new Map(session.ids.map((id, i) => [id, i]));
    return filtered.sort((a, b) => {
      const aWorked = dispositionedToday(a);
      const bWorked = dispositionedToday(b);
      // Sink worked leads below all unworked leads
      if (aWorked !== bWorked) return aWorked ? 1 : -1;
      // Both same status — preserve original session order
      const posA = posMap.has(a.id) ? posMap.get(a.id) : 99999;
      const posB = posMap.has(b.id) ? posMap.get(b.id) : 99999;
      if (posA !== posB) return posA - posB;
      return masterQueueSort(a, b); // v3.26 — composite tiebreaker
    }); // v3.26 — no slice: DialQueuePanel and rebalanceSession need the full pool
  }

  // No active session — sort by composite phase priority
  // v3.26 — no slice: passing full filtered pool so DialQueuePanel/rebalanceSession
  // can search all eligible leads, not just the first 50
  return filtered
    .sort(masterQueueSort);
}, [leads, session]);
  const open=useMemo(()=>leads.find(l=>l.id===openId),[leads,openId]);

  const filteredContacts=useMemo(()=>{
    return leads.filter(l => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.city && l.city.toLowerCase().includes(q));

      const matchesBucket = filterBucket === "all" || l.bucket === filterBucket;
      const matchesStage = filterStage === "all" || l.stage === filterStage;
      const matchesDisp = filterDisp === "all" || l.disposition === filterDisp;
      const notExclBucket = exclBucket === "none" || l.bucket !== exclBucket;
      const notExclStage  = exclStage  === "none" || l.stage  !== exclStage;
      const notExclDisp   = exclDisp   === "none" || l.disposition !== exclDisp;

      const matchesState = filterState === "all" || (l.state||"").toUpperCase() === filterState;
      const lTz = STATE_TZ[(l.state||"").toUpperCase()];
      const matchesTimezone = filterTimezone === "all" || lTz === filterTimezone;
      const matchesMonth = filterMonth === "all" || (() => {
        if (!l.assignDate) return false;
        const d = new Date(l.assignDate);
        if (isNaN(d)) return false;
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === filterMonth;
      })();
      return matchesSearch && matchesBucket && matchesStage && matchesDisp && matchesState && matchesTimezone && matchesMonth && notExclBucket && notExclStage && notExclDisp;
    }).sort((a, b) => {
      if (!queueMode) return (a.name > b.name) ? 1 : -1;
      const _n = Date.now();
      const _48H = 172800000;
      const qs = (lead) => {
        const bkt = lead.bucket || "C";
        const dp = lead.disposition || "not_called";
        if (lead.stage === 'removed' || ["dnc","not_interested","withdrawn","chargeback"].includes(dp)) return -9999;
        const lc = lead.lastContact ? new Date(lead.lastContact).getTime() : 0;
        const am = lead.assignDate  ? new Date(lead.assignDate).getTime()  : 0;
        const ms = lc ? _n - lc : Infinity;
        const cb = lead.nextCallback ? new Date(lead.nextCallback).getTime() : 0;
        const cbOD = cb && cb <= _n;
        const cbTD = cb && new Date(cb).toDateString() === new Date().toDateString();
        let sc = bkt==="A" ? 30000 : bkt==="B" ? 20000 : 10000;
        if (bkt === "A") {
          if (cbOD) sc += 5000;
          else if (cbTD) sc += 4000;
          else if (!lc) sc += 3000 + (am / 1e10);
          else if (ms >= _48H) sc += 2000 + (_48H / ms) * 1000;
        } else {
          if (cbOD) sc += 5000;
          else if (cbTD) sc += 4000;
          else if (dp === "not_called") sc += 3000 + (am / 1e10);
          else sc += (am / 1e10);
        }
        return sc;
      };
      return qs(b) - qs(a);
    });
  }, [leads, searchQuery, filterBucket, filterStage, filterDisp, queueMode, filterState, filterTimezone, filterMonth, exclBucket, exclStage, exclDisp]);

  // Available months derived from assignDate for the month filter
  const availableMonths = useMemo(() => {
    const months = new Set();
    leads.forEach(l => {
      if (l.assignDate) {
        const d = new Date(l.assignDate);
        if (!isNaN(d)) {
          months.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
        }
      }
    });
    return [...months].sort().reverse();
  }, [leads]);

  const startDialSession = useCallback((orderedIds) => {
    const ids = (orderedIds && orderedIds.length > 0) ? orderedIds : queue.map(l => l.id);
    if (ids.length === 0) { alert('No priority leads in queue right now.'); return; }
    const s = { ids, idx: 0, total: ids.length, startedAt: new Date().toISOString() };
    setSession(s); setSessionPaused(false);
    try { localStorage.setItem(LS_SESSION, JSON.stringify(s)); } catch {}
    setOpenId(ids[0]); setDialSessionActive(true); setView('dial'); setNoteText(''); setDetailTab('live');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, setSession, setSessionPaused, setOpenId, setDialSessionActive, setView, setNoteText, setDetailTab]);

// Calculate total pages and slice the array for the current page
  const totalPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE);
  const paginatedContacts = useMemo(() => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    return filteredContacts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredContacts, page]);

  // Live clock — ticks every minute for TCPA indicator
  // v3.9 — Auto-collapse nav when entering dial view, restore when leaving
  useEffect(() => { setNavOpen(view !== "dial"); }, [view]);

  // v3.24 — browser back/forward: sync view <-> URL hash
  // Push a new history entry whenever view changes (except on initial load)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const current = window.location.hash.replace('#','');
    if (current !== view) window.history.pushState({ view }, '', '#' + view);
  }, [view]);
  // Listen for popstate (back/forward button)
  useEffect(() => {
    function onPop(e) {
      const prev = (e.state && e.state.view) || window.location.hash.replace('#','') || 'dashboard';
      const VALID = new Set(['dashboard','dial','contacts','pipeline','scripts','templates','settings','today']);
      setView(VALID.has(prev) ? prev : 'dashboard');
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClockNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Calendly widget — load script + CSS once on mount, suppress auto-injected badge
  useEffect(() => {
    if (document.getElementById('calendly-widget-script')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://assets.calendly.com/assets/external/widget.css';
    document.head.appendChild(link);
    // Hide the floating badge Calendly auto-injects — we control our own trigger buttons
    const hide = document.createElement('style');
    hide.id = 'calendly-badge-hide';
    hide.textContent = '#calendly-badge-widget, .calendly-badge-widget { display: none !important; }';
    document.head.appendChild(hide);
    const script = document.createElement('script');
    script.id = 'calendly-widget-script';
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // v3.28 — focus-visible + .sr-only rules moved to index.css

  // Calendly — listen for booking confirmation, auto-write appointment time to lead.
  // v3.5 — 'leads' removed from deps. Listener only rebuilds when the target lead changes
  // (i.e. when you open a new popup), not on every dial/disposition that mutates leads.
  useEffect(() => {
    const handler = (e) => {
      if (!e.data || e.data.event !== 'calendly.event_scheduled') return;
      const payload   = e.data.payload || {};
      const startTime = payload.event?.start_time;
      if (!startTime || !calendlyTargetId) return;
      // Build a structured note with Calendly event details (v3.12)
      const eventName  = payload.event?.name || payload.event_type?.name || 'Appointment';
      const startLocal = new Date(startTime).toLocaleString('en-US', { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
      const targetLead = leads.find(l => l.id === calendlyTargetId);
      const newNote    = { ts: new Date().toISOString(), type: 'appointment', text: `📅 Calendly booked — ${eventName} · ${startLocal}` };
      upd(calendlyTargetId, {
        disposition: 'appointment_booked',
        stage: 'appointment_set',
        nextCallback: new Date(startTime).toISOString(),
        notes: [...(targetLead?.notes || []), newNote]
      });
      logActivity('appointment', calendlyTargetId, 'auto');
      setCalendlyTargetId(null);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [calendlyTargetId]); // eslint-disable-line


  const TZ_IANA = {ET:"America/New_York",CT:"America/Chicago",MT:"America/Denver",PT:"America/Los_Angeles",AT:"America/Anchorage",HT:"Pacific/Honolulu"};
  const tcpaInfo = useMemo(() => {
    if (!open || !open.state) return null;
    const ltz = STATE_TZ[(open.state||"").toUpperCase()];
    const tzName = TZ_IANA[ltz];
    if (!tzName) return null;
    const localTimeStr = new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit",hour12:true,timeZone:tzName}).format(clockNow);
    const localH = parseInt(new Intl.DateTimeFormat("en-US",{hour:"numeric",hour12:false,timeZone:tzName}).format(clockNow), 10);
    const safe = localH >= 8 && localH < 21;
    return { timeStr: localTimeStr, ltz, safe };
  }, [open?.id, open?.state, clockNow]);

  const stats=useMemo(()=>{
    const now=new Date();
    return{
      total:leads.length,
      hot:leads.filter(l=>l.bucket==="A"&&l.stage!=="removed"&&!["dnc","not_interested","withdrawn","chargeback"].includes(l.disposition)).length,
      cbToday:leads.filter(l=>l.nextCallback&&new Date(l.nextCallback).toDateString()===todayStr()).length,
      overdue:leads.filter(l=>l.nextCallback&&new Date(l.nextCallback)<now&&new Date(l.nextCallback).toDateString()!==todayStr()).length,
      pipe:leads.filter(l=>["appointment_set","follow_up","app_submitted","underwriting"].includes(l.stage)).length,
      issued:leads.filter(l=>l.stage==="issued").length,
      uwStuck:leads.filter(l=>isUWStuck(l)).length, // v2.2
    };
  },[leads]);

  // v3.1 — Backup reminder state
  const backupLastExport = localStorage.getItem(LS_LAST_EXPORT);
  const backupDaysSince  = backupLastExport ? Math.floor((Date.now()-new Date(backupLastExport).getTime())/(1000*60*60*24)) : null;
  const backupNeedsAlert = backupDaysSince === null || backupDaysSince >= 7;
  const backupColor      = backupDaysSince === null ? "#DC2626" : backupDaysSince >= 14 ? "#DC2626" : "#D97706";
  const backupBg         = backupDaysSince === null ? "#FEF2F2" : backupDaysSince >= 14 ? "#FEF2F2" : "#FFFBEB";
  const backupBorder     = backupDaysSince === null ? "#FCA5A5" : backupDaysSince >= 14 ? "#FCA5A5" : "#FCD34D";

  // v2.3 — Activity aggregations (today/week/month/last-7)
  const activityStats=useMemo(()=>{
    const today  = aggregateActivity(activity, [TODAY_KEY()]);
    const week   = aggregateActivity(activity, weekKeys());
    const month  = aggregateActivity(activity, monthKeys());
    const last7  = lastNDays(7);
    const last7Agg = aggregateActivity(activity, last7.map(d=>d.key));
    const days   = activityRange==="month" ? monthKeys().length : activityRange==="week" ? 7 : 1;
    const view   = activityRange==="month" ? month : activityRange==="week" ? week : today;
    // Conversion rates (use today snapshot for the headline)
    const contactRate = today.dials>0 ? Math.round((today.contacts/today.dials)*100) : 0;
    const setRate     = today.contacts>0 ? Math.round((today.appointments/today.contacts)*100) : 0;
    return { today, week, month, last7, last7Agg, view, days, contactRate, setRate };
  },[activity, activityRange]);

  // Unread SMS count for nav badge
  const unreadSmsCount = React.useMemo(() =>
    (leads || []).filter(l => l && l.smsUnread).length
  , [leads]);

  if(loading) return React.createElement("div",{style:{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--t3)",fontSize:"13px",fontFamily:"'Inter',sans-serif"}},"Loading Metka Field Ops…");

  // ── ScriptPanel → components/ScriptPanel.jsx ─────────────────────────
  // StageStepper ← moved to components/ContactDetail.jsx

  // UnderwritingCard ← moved to components/ContactDetail.jsx

  // ── APP RENDER ───────────────────────────────────────────────────
  return React.createElement("div",{style:{display:"flex",height:"100vh",background:"var(--bg)",color:"var(--t1)",fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden"}},

    // ── 1. DARK SIDEBAR (hamburger-controlled on dial view) ──
    React.createElement(NavSidebar, { view, setView, navOpen, unreadSms: unreadSmsCount }),

    // ── 2. MAIN WORKSPACE COLUMN ──
    React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}},

      // ── TOP HEADER ──
      React.createElement(AppHeader, {
        view, navOpen, setNavOpen,
        activityStats, goals, stats,
        supaStatus, setView,
        setAddForm, fileRef, handleFile,
      }),

      // ── ADD FORM BAR ──
      React.createElement(AddLeadForm, {
        addForm, newL, setNewL, scripts, addLead,
        setAddForm, dupeLead, setDupeLead, setOpenId, setView,
      }),

      // ── FIELD MAPPING MODAL ──
      fieldMapModal && React.createElement(FieldMapModal, {
        csvHeaders,
        fieldMapDraft, setFieldMapDraft,
        saveMappingCb, setSaveMappingCb,
        savedMapping,
        confirmFieldMapping,
        onClose: () => setFieldMapModal(false),
      }),

      // ── IMPORT MODAL ──
      importModal && importPreview && React.createElement(ImportModal, {
        importPreview, leads,
        replaceConfirm, setReplaceConfirm,
        confirmImport,
        onClose: () => { setImportModal(false); setImportPreview(null); setReplaceConfirm(""); },
      }),

      // ── VIEW ROUTER ──
      React.createElement("div",{style:{flex:1,display:"flex",overflow:"hidden"}},

        // ── TODAY'S BLOCK VIEW (v3.1 — Phase Lifecycle Engine) ──
        view==="today" && !dialSessionActive && React.createElement(TodaysBlock, {
          leads,
          onDispose: handleTodayDispose,
          onOpen: (id) => { setOpenId(id); setPrevView("today"); setView("contact"); setDetailTab("activity"); },
          onUpdate: upd,
          calendlyUrl,
        }),

        // ── DASHBOARD VIEW ──
        view==="dashboard" && React.createElement(DashboardTab, {
          leads, activity, goals, financialConfig,
          setView, setOpenId, setPrevView,
          refreshQueueOrder, startDialSession,
          seqStats,
          onStartDialSlot: (slot) => { setPendingDialSlot(slot); setView('dial'); },
        }),

        // ── CALLBACK QUEUE VIEW (v3.1) ──
        view==="callbacks" && React.createElement(CallbackQueue, {
          leads, upd, setOpenId, setView, setSession, setSessionPaused, setNoteText, setDetailTab,
        }),

        // ── APPOINTMENTS VIEW (v3.14) ──
        view==="appointments" && React.createElement(AppointmentsView, {
          leads, upd, logActivity,
          setOpenId, setView, setPrevView,
        }),

        // ── CC TAB (v3.15) ──
        view==="cc" && React.createElement(CCTab, { leads }),

        // ── SEQUENCE TAB (v3.16) ──
        view==="sequence" && React.createElement(SequenceTab, {
          leads, upd,
          setOpenId, setView, setPrevView, seqStats,
        }),

        // ── ACTIVITY VIEW (v2.3) ──
        view==="activity" && React.createElement(ActivityDashboard, {
          activityStats, activityRange, setActivityRange,
          goals, goalsDraft, setGoalsDraft, editingGoals, setEditingGoals, saveGoals,
          activity, saveActivity, logActivity,
          setOpenId, setView, setDetailTab,
        }),

        // ── UNIFIED DIAL VIEW (v3.8) — replaces queue + powerdial ──
        view==="dial" && React.createElement(DialView, {
          leads, queue, session, setSession, sessionPaused, setSessionPaused, setDialSessionActive,
          dialSortMode, setDialSortMode, dialRightTab, setDialRightTab,
          openId, setOpenId, open, upd,
          dialLead, useTwilioCalling, twilioDevice,
          hangUp, callStatus,
          activeCall, activeCallLead, callMuted, callElapsed, toggleMute,
          todayLeads,
          noteText, setNoteText, noteType, setNoteType, addNote,
          handleDisposition,
          confirmCbDate, setConfirmCbDate, confirmCbTime, setConfirmCbTime,
          confirmReschedule, setConfirmReschedule,
          tcpaInfo, detailTab, setDetailTab,
          scripts, scriptType, setScriptType, scriptSection, setScriptSection,
          templates, calendlyUrl, setCalendlyTargetId,
          refreshQueueOrder, openCalendlyPopup, logActivity,
          sendSms: async (phone, body, leadId) => {
            try {
              await sbSendSms(phone, body, leadId);
              upd(leadId, (fresh) => ({
                notes: [{ ts: new Date().toISOString(), type: 'note', text: '📱 SMS sent: ' + body.slice(0, 80) + (body.length > 80 ? '\u2026' : '') }, ...(fresh.notes || [])]
              }));
            } catch(e) { alert('SMS failed: ' + e.message); }
          },
          todayCount:
          setView, setPrevView,
          callbackPresets, setCallbackPresets,
          pendingDialSlot, clearPendingDialSlot: () => setPendingDialSlot(null),
        }),


        view==="contacts" && React.createElement(ContactsView, {
          leads, searchQuery, setSearchQuery,
          showFilters, setShowFilters,
          filterBucket, setFilterBucket,
          filterStage, setFilterStage,
          filterDisp, setFilterDisp,
          filterState, setFilterState,
          filterTimezone, setFilterTimezone,
          filterMonth, setFilterMonth,
          exclBucket, setExclBucket,
          exclStage, setExclStage,
          exclDisp, setExclDisp,
          filteredContacts, paginatedContacts,
          page, setPage, totalPages, ITEMS_PER_PAGE,
          availableMonths,
          queueMode, setQueueMode,
          setSession, setSessionPaused,
          setOpenId, setPrevView, setView, setDetailTab,
          dialLead, useTwilioCalling, twilioDevice,
          upd, saveLeads,
        }),

        // ── CONTACT DETAIL PAGE VIEW ──
        view==="contact" && open && React.createElement(ContactDetail, {
          logActivity, // v3.50 — saveMeeting 'Held' → audit_ran
          open, prevView, setView,
          upd, logDial, dialLead, deleteLead,
          tcpaInfo,
          noteType, setNoteType, noteText, setNoteText, addNote,
          cbDate, setCbDate, cbTime, setCbTime, lockCB,
          handleDisposition,
          openCalendlyPopup, calendlyUrl, setCalendlyTargetId,
          newReqText, setNewReqText,
          initUWReqs, toggleUWReq, removeUWReq, addUWReq,
          sendSms: async (phone, body, leadId) => {
            try {
              await sbSendSms(phone, body, leadId);
              upd(leadId, (fresh) => ({
                notes: [{ ts: new Date().toISOString(), type: 'note', text: '📱 SMS sent: ' + body.slice(0, 80) + (body.length > 80 ? '\u2026' : '') }, ...(fresh.notes || [])]
              }));
            } catch(e) { alert('SMS failed: ' + e.message); }
          },
          selfApplyUrl: 'https://apply.quility.com/#/symmetry/raq/SFG0092434?redirect_url=https%3A%2F%2Fyourlivingbenefit.com%2F&leadtype=Life%20Insurance&producttype=Life%20Insurance',
        }),

        // ── MESSAGES VIEW ──
        view==="messages" && React.createElement(MessagesView, {
          leads,
          sendSms: async (phone, body, leadId) => {
            try {
              await sbSendSms(phone, body, leadId);
              upd(leadId, (fresh) => ({
                notes: [{ ts: new Date().toISOString(), type: 'note', text: '📱 SMS sent: ' + body.slice(0, 80) + (body.length > 80 ? '\u2026' : '') }, ...(fresh.notes || [])]
              }));
            } catch(e) { alert('SMS failed: ' + e.message); }
          },
          upd,
          setView, setOpenId,
          setPrevView,
          onRefresh: () => window.location.reload(),
        }),

        // ── PIPELINE VIEW ──
        view==="orders" && React.createElement(LeadOrdersView, { leads }),

        view==="pipeline" && React.createElement(PipelineView, {
          leads,
          useTwilioCalling, twilioDevice,
          dialLead,
          setPrevView, setOpenId, setView, setDetailTab,
          upd,
        }),

        // ── SCRIPTS VIEW ──
        view==="scripts" && React.createElement(ScriptsView, {
          scripts, saveScripts,
          scriptType, setScriptType,
          scriptSection, setScriptSection,
          editingScript, setEditingScript,
          interpolate,
        }),

        // ── TEMPLATES VIEW ──
        view==="templates" && React.createElement(TemplatesView, {
          templates,
          newTemplateName, setNewTemplateName,
          newTemplateText, setNewTemplateText,
          addTemplate, deleteTemplate,
        }),

        // ── SETTINGS VIEW ──
        view==="settings" && React.createElement(SettingsView, {
          leads, setLeads, saveLeads,
          voiceDeviceStatus,
          useTwilioCalling, setUseTwilioCalling,
          tokenUrlDraft, setTokenUrlDraft, setTokenServiceUrl,
          notificationsEnabled, setNotificationsEnabled,
          twilioConfig, setTwilioConfig,
          twilioDraft, setTwilioDraft,
          twilioSaved, setTwilioSaved,
          financialConfig, setFinancialConfig,
          financialDraft, setFinancialDraft,
          financialSaved, setFinancialSaved,
          gmailConfig, setGmailConfig,
          gmailDraft, setGmailDraft,
          gmailSaved, setGmailSaved,
          seqConfig, setSeqConfig,
          seqDraft, setSeqDraft,
          seqSaved, setSeqSaved,
          backfillLead, SCHED_COLS, assignSlot,
          backupNeedsAlert, backupDaysSince, backupBg, backupBorder, backupColor,
          backupExists, restoreBackup,
          templates, scripts,
          saveScripts, saveTemplates,
          aiConfig, aiDraft, setAiDraft, aiSaved, setAiSaved, saveAi,
        })
      )
    ),


           // ── FLOATING CALL CONTROL BAR ──
        view !== 'dial' && React.createElement(CallBar, {activeCall, callStatus, callElapsed, callMuted, activeCallLead, toggleMute, hangUp, sendDigit}),

    // ── AI PANEL (floating) ──
    React.createElement(AIPanel, { activeLead: open, aiConfig }),

    // ── APPOINTMENT CONFIRMATION MODAL ── full-screen lock, no escape
    (open && open.disposition === 'appointment_booked' && open.nextCallback && new Date(open.nextCallback) < new Date() && !open.apptConfirmed) &&
      React.createElement(AppointmentConfirmModal, {
        open, upd, logActivity, fmt,
        onAdvance: () => setOpenId(null),
      })
  );
}

export default MetkaCRM;
