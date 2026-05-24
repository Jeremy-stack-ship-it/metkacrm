
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
 * v3.0  Session 3  Twilio Browser Calling, Messages tab (loader stubbed — see loadTwilioComms)
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
import ContactsView from './components/ContactsView.jsx';
import PipelineView from './components/PipelineView.jsx';
import ScriptsView from './components/ScriptsView.jsx';
import TemplatesView from './components/TemplatesView.jsx';
import SettingsView from './components/SettingsView.jsx';
import { STATE_TZ, STAGES, DISPS, BC, BL, NC, FIELD_MAP_DEFS,
  UW_STUCK_DAYS, UW_ACTIVE_STAGES, UW_VISIBLE_STAGES, DEFAULT_REQS,
  daysInUW, isUWStuck, reqStats,
  fmt, fmtDate, currency, chip, inp } from './constants.js';
// ── Library Modules (v3.6) ───────────────────────────────────────
import { sbUpsertLead, sbUpsertAll, sbDeleteLead, sbReconcileDeletes, sbLoadAll, sbSaveActivity, sbAppendActivity, sbLoadActivity } from './lib/supabaseSync.js';
import { backfillLead, applyPhaseTransition, getPhasePriority, isDueToday, SCHED_COLS, assignSlot } from './lib/phaseEngine.js';
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
import ImportModal from './components/ImportModal.jsx';
import NavSidebar from './components/NavSidebar.jsx';
import AppHeader from './components/AppHeader.jsx';
import AddLeadForm from './components/AddLeadForm.jsx';
import ScriptPanel from './components/ScriptPanel.jsx';
import { priority, autoFollowUp, openCalendlyPopup } from './lib/leadScoring.js';
import { useContactFilters } from './lib/useContactFilters.js';
import { useTwilioDevice } from './lib/useTwilioDevice.js';
import { useSettingsConfig } from './lib/useSettingsConfig.js';

// ── SUPABASE CLIENT ──────────────────────────────────────────────
// (All Supabase functions imported from lib/supabaseSync.js v3.6)
import { supabase } from './lib/supabaseSync.js';
import AppointmentConfirmModal from './components/AppointmentConfirmModal';

// ── TWILIO COMMS LOADER ──────────────────────────────────────────
// TODO: implement real Twilio REST call when Messages tab is activated.
// Endpoint: GET https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
// Params: To or From = phone, PageSize = 50
// Auth: Basic base64(`${accountSid}:${authToken}`)
// Map r.messages → {id:m.sid, ts:m.date_sent, type:'sms',
//   direction:m.direction.includes('inbound')?'inbound':'outbound',
//   body:m.body, status:m.status, sid:m.sid}
const loadTwilioComms = async (phone, config) => { // eslint-disable-line no-unused-vars
  if (!config?.accountSid || !config?.authToken || !config?.fromNumber) return [];
  return []; // not yet implemented — returns empty thread until Twilio Messages tab is wired up
};
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
  const [view,setView]=useState("dashboard");
  const [openId,setOpenId]=useState(null);
  const [detailTab,setDetailTab]=useState("activity");
  const [noteText,setNoteText]=useState("");
  const [noteType,setNoteType]=useState("call");
  const [cbDate,setCbDate]=useState("");
  const [cbTime,setCbTime]=useState("");
  const [addForm,setAddForm]=useState(false);
  const [newL,setNewL]=useState({name:"",phone:"",state:"OK",bucket:"A",leadType:"Mortgage Protection"});
  const [importModal,setImportModal]=useState(false);
  const [importPreview,setImportPreview]=useState(null);
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
  const [healthOpen, setHealthOpen] = useState(false);
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
    DEFAULT_FINANCIAL,
  } = useSettingsConfig();
  const [backupExists, setBackupExists]       = useState(false);
  const [supaStatus, setSupaStatus]           = useState("idle"); // idle | syncing | ok | error
  const [replaceConfirm, setReplaceConfirm]   = useState("");
  const [fieldMapModal, setFieldMapModal]     = useState(false);
  const [csvRawText, setCsvRawText]           = useState("");
  const [csvHeaders, setCsvHeaders]           = useState([]);
  const [fieldMapDraft, setFieldMapDraft]     = useState({});
  const [saveMappingCb, setSaveMappingCb]     = useState(true);
  const [savedMapping, setSavedMapping]       = useState({});
  const [commsCache, setCommsCache]           = useState({}); // {leadId: [{id,ts,type,direction,body,status}]}
  const [commsLoading, setCommsLoading]       = useState(false);
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
      // v2.6 — Load saved field mapping
      const fm = localStorage.getItem(LS_MAPPING);
      if(fm){ try{ setSavedMapping(JSON.parse(fm)); }catch{} }
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

    // v3.14 — Per-lead _ts merge: Supabase is source of truth on a per-lead basis.
    // Replaces the fragile array-length comparison with accurate per-lead timestamp comparison.
    // Deleted leads are tracked via LS_DELETED_IDS tombstone map so they can't ghost-walk back.
    setSupaStatus("syncing");

    // Load + auto-prune deletion tombstones
    let deletedIds = {};
    try {
      const raw = localStorage.getItem(LS_DELETED_IDS);
      if (raw) deletedIds = JSON.parse(raw);
    } catch {}
    const _tombstoneCutoff = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days
    let _tombstonePruned = false;
    Object.keys(deletedIds).forEach(id => {
      if (deletedIds[id] < _tombstoneCutoff) { delete deletedIds[id]; _tombstonePruned = true; }
    });
    if (_tombstonePruned) {
      try { localStorage.setItem(LS_DELETED_IDS, JSON.stringify(deletedIds)); } catch {}
    }

    sbLoadAll().then(remote => {
      if (!remote) { setSupaStatus("error"); return; }

      setLeads(prev => {
        if (remote.length === 0) {
          // Supabase is empty — first run or wiped. Push local up.
          console.log('[v3.14] Supabase empty — seeding from localStorage');
          sbUpsertAll(prev).then(() => setSupaStatus("ok")).catch(() => setSupaStatus("error"));
          sbReconcileDeletes(prev).catch(() => {});
          return prev;
        }

        // Per-lead merge: newest _ts wins per ID
        const merged = new Map();
        // Seed with local leads
        prev.forEach(l => merged.set(l.id, l));
        // Walk remote: add new IDs, overwrite if remote lead is newer
        let remoteAdded = 0;
        remote.forEach(r => {
          if (deletedIds[r.id]) return; // intentionally deleted locally — skip
          const local = merged.get(r.id);
          if (!local) {
            merged.set(r.id, r); // lead exists only in remote (added on another device)
            remoteAdded++;
          } else if ((r._ts || 0) > (local._ts || 0)) {
            merged.set(r.id, r); // remote is newer — take it
          }
          // else: local is newer or equal — keep local (already in map)
        });

        const result = Array.from(merged.values());
        console.log(`[v3.14] Hydration merge: local=${prev.length} remote=${remote.length} result=${result.length} remoteAdded=${remoteAdded}`);

        // Update localStorage cache with merged result
        try {
          localStorage.setItem(LS_LEADS, LZString.compressToUTF16(JSON.stringify(result)));
        } catch {}

        // If remote had leads we didn't have locally, push merged set up to Supabase
        if (remoteAdded > 0) {
          sbUpsertAll(result).catch(() => {});
        }

        setSupaStatus("ok");
        sbReconcileDeletes(result).catch(() => {});
        return result;
      });
    }).catch(() => setSupaStatus("error"));

    // v3.1 — Load activity log from Supabase (local wins if it has more events)
    sbLoadActivity().then(remote => {
      if (remote && Array.isArray(remote) && remote.length > 0) {
        setActivity(prev => {
          if (remote.length >= prev.length) {
            try { localStorage.setItem(LS_ACTIVITY, JSON.stringify(remote)); } catch {}
            return remote;
          }
          // Local has more — push it up to repair Supabase
          sbSaveActivity(prev).catch(()=>{});
          return prev;
        });
      }
    }).catch(()=>{});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

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
    if (stamped) sbUpsertLead(stamped);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveScripts=next=>{setScripts(next);try{localStorage.setItem(LS_SCRIPTS,JSON.stringify(next));}catch{}};
  const saveTemplates=next=>{setTemplates(next);try{localStorage.setItem("metka-templates-v1",JSON.stringify(next));}catch{}};

  // v2.3 — Activity log persistence
  // v3.5 — localStorage only. Supabase writes happen per-event in logActivity (append-only).
  //         Bulk sbSaveActivity is reserved for startup repair when remote is behind local.
  const saveActivity=useCallback(next=>{
    setActivity(next);
    try{localStorage.setItem(LS_ACTIVITY,JSON.stringify(next));}catch{}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  // v3.13 — Functional-updater append for activity events fired inside leads.js upd().
  // Uses setActivity(prev=>) so it always reads current state — fixes 0/20 CONTACTS / 0/5 APPTS bug
  // caused by stale `activity` snapshot in makeLeadManager closure during rapid PD dialing.
  const appendActivity = useCallback(evs => {
    setActivity(prev => {
      const next = [...evs, ...prev];
      try { localStorage.setItem(LS_ACTIVITY, JSON.stringify(next)); } catch {}
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
  } = useTwilioDevice({ upd, logDial });

  const handleFile=e=>{
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const txt=ev.target.result;
      const firstLine=txt.split(/\r?\n/)[0]||"";
      // Parse headers preserving original case for display
      const headers=firstLine.split(",").map(h=>h.replace(/^"|"$/g,"").trim());
      const lowerHeaders=headers.map(h=>h.toLowerCase());
      // Auto-detect mapping
      const autoMap=autoDetectMapping(lowerHeaders);
      // Build initial draft: prefer saved column names, fall back to auto-detect
      const draft={};
      // Include all keys (displayed + hidden)
      const allKeys=[...FIELD_MAP_DEFS.map(f=>f.key),"score","tier","daysOld","flags","rationale","leadLevel","importStage"];
      allKeys.forEach(k=>{
        if(savedMapping[k]!==undefined){
          const savedIdx=lowerHeaders.indexOf(savedMapping[k].toLowerCase());
          draft[k]=savedIdx>-1?savedIdx:(autoMap[k]??-1);
        } else {
          draft[k]=autoMap[k]??-1;
        }
      });
      setCsvRawText(txt);
      setCsvHeaders(headers);
      setFieldMapDraft(draft);
      setFieldMapModal(true);
    };
    reader.readAsText(file); e.target.value="";
  };
  const confirmImport=mode=>{
    if(!importPreview) return;
    // Auto-backup current leads before any import
    try{
      const snap=LZString.compressToUTF16(JSON.stringify(leads));
      localStorage.setItem(LS_BACKUP,snap);
      setBackupExists(true);
    }catch{}
    // v3.1 — auto-assign phases to imported leads that don't have one
    const withPhases = (arr) => arr.map(l => backfillLead(l));
    saveLeads(mode==="append"
      ? [...withPhases(importPreview.newLeads),...leads]
      : withPhases(importPreview.all)
    );
    setImportModal(false);setImportPreview(null);setReplaceConfirm("");
  };
  const confirmFieldMapping=()=>{
    // Optionally persist the mapping by column name (not index, so it survives different CSVs)
    if(saveMappingCb){
      const toSave={};
      Object.entries(fieldMapDraft).forEach(([k,idx])=>{
        if(idx>-1 && csvHeaders[idx]) toSave[k]=csvHeaders[idx].toLowerCase();
      });
      setSavedMapping(toSave);
      try{localStorage.setItem(LS_MAPPING,JSON.stringify(toSave));}catch{}
    }
    // Parse CSV with confirmed mapping
    const parsed=parseCSV(csvRawText,fieldMapDraft);
    const existing=new Set(leads.map(l=>l.phone.replace(/\D/g,"")));
    setImportPreview({
      all:parsed,
      newLeads:parsed.filter(l=>!existing.has(l.phone.replace(/\D/g,""))),
      dupes:parsed.filter(l=>existing.has(l.phone.replace(/\D/g,"")))
    });
    setFieldMapModal(false);
    setImportModal(true);
  };
  const restoreBackup=()=>{
    const raw=localStorage.getItem(LS_BACKUP);
    if(!raw){alert("No backup found.");return;}
    try{
      const dec=LZString.decompressFromUTF16(raw);
      const arr=JSON.parse(dec);
      if(Array.isArray(arr)&&arr.length>0){
        saveLeads(arr);
        alert("✓ Restored "+arr.length+" leads from backup.");
      }
    }catch{alert("Backup could not be read.");}
  };
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
  const toggleUWReq=(id,reqId)=>{
    const lead=leads.find(l=>l.id===id);
    if(!lead) return;
    const list=(lead.pendingReqs||[]).map(r=>r.id===reqId?{...r,done:!r.done,completedAt:!r.done?new Date().toISOString():null}:r);
    upd(id,{pendingReqs:list});
  };
  const removeUWReq=(id,reqId)=>{
    const lead=leads.find(l=>l.id===id);
    if(!lead) return;
    upd(id,{pendingReqs:(lead.pendingReqs||[]).filter(r=>r.id!==reqId)});
  };
  const addUWReq=(id,label)=>{
    if(!label || !label.trim()) return;
    const lead=leads.find(l=>l.id===id);
    if(!lead) return;
    upd(id,{pendingReqs:[...(lead.pendingReqs||[]),{id:`r${Date.now()}`,label:label.trim(),done:false}]});
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

    // v3.4 — auto-schedule next callback based on disposition
    const followUpDate = dispId !== 'callback' ? autoFollowUp(dispId) : undefined;
    const cbPatch = followUpDate !== undefined ? { nextCallback: followUpDate } : {};

    // Save the disposition — full stage map wired to every disposition
    const DISP_STAGE_MAP = {
      vm_left:            "contacted",
      callback:           "contacted",
      hung_up:            "contacted",
      no_show:            "contacted",
      appointment_booked: "appointment_set",
      follow_up_needed:   "follow_up",
      not_interested:     "removed",
      dnc:                "removed",
      withdrawn:          "removed",
      chargeback:         "removed",
    };
    const stagePatch = DISP_STAGE_MAP[dispId] ? { stage: DISP_STAGE_MAP[dispId] } : {};
    // v3.1 — apply phase lifecycle transition
    const phasePatch = applyPhaseTransition(open, dispId);

    // v3.7 — auto-log disposition as a note (callback already logged by handleCbPreset/Custom in DialView)
    const DISP_NOTE_TEXT = {
      no_answer:      "📵 No Answer — dialed, no response",
      vm_left:        "📬 Voicemail Left",
      follow_up:      "🔄 Follow Up flagged",
      not_interested: "🚫 Not Interested",
      hung_up:        "📴 Hung Up",
      dnc:            "⛔ Do Not Call — file closed",
      no_show:        "❌ No-Show — appointment missed",
    };
    const noteText = DISP_NOTE_TEXT[dispId];
    const notePatch = noteText
      ? { notes: [{ ts: new Date().toISOString(), type: "call", text: noteText }, ...(open.notes || [])] }
      : {};

    upd(open.id, {disposition: dispId, lastContact: new Date().toLocaleDateString('en-CA'), ...stagePatch, ...phasePatch, ...cbPatch, ...notePatch});

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
const queue = useMemo(() => {
  // During an active session, keep all session leads visible regardless of calledToday.
  // Agent needs the full list in front of them — leads shouldn't vanish as they work through them.
  const inSession = !!(session && session.ids && session.ids.length > 0);
  const sessionIdSet = inSession ? new Set(session.ids) : null;

  // Dispositions that mean "done for now — schedule out, leave queue"
  // Only these trigger hiding/sinking. Dialing alone (lastContact stamp) does NOT.
  const SINK_DISPS = ['no_answer','vm_left','follow_up_needed','chargeback','hung_up'];
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
      return priority(b) - priority(a);
    }).slice(0, ITEMS_PER_PAGE);
  }

  // No active session — sort by live priority
  return filtered
    .sort((a,b) => priority(b) - priority(a))
    .slice(0, ITEMS_PER_PAGE);
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

// Calculate total pages and slice the array for the current page
  const totalPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE);
  const paginatedContacts = useMemo(() => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    return filteredContacts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredContacts, page]);

  // Live clock — ticks every minute for TCPA indicator
  // v3.9 — Auto-collapse nav when entering dial view, restore when leaving
  useEffect(() => { setNavOpen(view !== "dial"); }, [view]);

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

  // v3.8 — Global a11y styles: focus-visible ring + sr-only utility
  useEffect(() => {
    if (document.getElementById('crm-a11y-styles')) return;
    const style = document.createElement('style');
    style.id = 'crm-a11y-styles';
    style.textContent = [
      '*:focus-visible { outline: 2px solid #5DCAA5 !important; outline-offset: 2px !important; }',
      '.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }'
    ].join('\n');
    document.head.appendChild(style);
  }, []);

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

  if(loading) return React.createElement("div",{style:{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--t3)",fontSize:"13px",fontFamily:"'Inter',sans-serif"}},"Loading Metka Field Ops…");

  // ── ScriptPanel → components/ScriptPanel.jsx ─────────────────────────
  // StageStepper ← moved to components/ContactDetail.jsx

  // UnderwritingCard ← moved to components/ContactDetail.jsx

  // ── APP RENDER ───────────────────────────────────────────────────
  return React.createElement("div",{style:{display:"flex",height:"100vh",background:"var(--bg)",color:"var(--t1)",fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden"}},

    // ── 1. DARK SIDEBAR (hamburger-controlled on dial view) ──
    React.createElement(NavSidebar, { view, setView, navOpen }),

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
          onDispose: (id, dispId) => {
            // Compute phase transition patch
            const lead = leads.find(l => l.id === id);
            const phasePatch = lead ? applyPhaseTransition(lead, dispId) : {};
            const DISP_STAGE_MAP = {
              vm_left:            "contacted",
              callback:           "contacted",
              hung_up:            "contacted",
              no_show:            "contacted",
              appointment_booked: "appointment_set",
              follow_up_needed:   "follow_up",
              not_interested:     "removed",
              dnc:                "removed",
              withdrawn:          "removed",
              chargeback:         "removed",
            };
            const stagePatch = DISP_STAGE_MAP[dispId] ? { stage: DISP_STAGE_MAP[dispId] } : {};
            upd(id, { disposition: dispId, lastContact: new Date().toLocaleDateString('en-CA'), ...stagePatch, ...phasePatch });
          },
          onOpen: (id) => { setOpenId(id); setPrevView("today"); setView("contact"); setDetailTab("activity"); },
          onUpdate: upd,
          calendlyUrl,
        }),

	// ── DASHBOARD VIEW ──
	 view==="dashboard" && React.createElement(DashboardTab, {leads, activity, goals, financialConfig, setView, setOpenId, setPrevView, refreshQueueOrder, startDialSession: (orderedIds) => {
	   // orderedIds = IDs in the exact order shown on the dashboard dial queue widget.
	   // Falls back to App-level queue if called without them.
	   const ids = (orderedIds && orderedIds.length > 0) ? orderedIds : queue.map(l=>l.id);
	   if(ids.length===0){alert("No priority leads in queue right now.");return;}
	   const s={ids,idx:0,total:ids.length,startedAt:new Date().toISOString()};
	   setSession(s); setSessionPaused(false);
	   try{localStorage.setItem(LS_SESSION,JSON.stringify(s));}catch{}
	   setOpenId(ids[0]); setDialSessionActive(true); setView('dial'); setNoteText(""); setDetailTab("live");
	 }}),

        // ── CALLBACK QUEUE VIEW (v3.1) ──
        view==="callbacks" && React.createElement(CallbackQueue, {
          leads, setOpenId, setView, setSession, setSessionPaused, setNoteText, setDetailTab,
        }),

        // ── APPOINTMENTS VIEW (v3.14) ──
        view==="appointments" && React.createElement(AppointmentsView, {
          leads, upd, logActivity,
          setOpenId, setView, setPrevView,
        }),

        // ── CC TAB (v3.15) ──
        view==="cc" && React.createElement(CCTab, { leads }),

        // ── ACTIVITY VIEW (v2.3) ──
        view==="activity" && React.createElement(ActivityDashboard, {
          activityStats, activityRange, setActivityRange,
          goals, goalsDraft, setGoalsDraft, editingGoals, setEditingGoals, saveGoals,
          activity, saveActivity, logActivity,
          setOpenId, setView, setDetailTab,
        }),

        // ── UNIFIED DIAL VIEW (v3.8) — replaces queue + powerdial ──
        view==="dial" && React.createElement(DialView, {
          queue, session, setSession, sessionPaused, setSessionPaused, setDialSessionActive,
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
          todayCount,
          setView, setPrevView,
          callbackPresets, setCallbackPresets,
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
          open, prevView, setView,
          upd, logDial, dialLead, deleteLead,
          tcpaInfo,
          noteType, setNoteType, noteText, setNoteText, addNote,
          cbDate, setCbDate, cbTime, setCbTime, lockCB,
          handleDisposition,
          openCalendlyPopup, calendlyUrl, setCalendlyTargetId,
          newReqText, setNewReqText,
          initUWReqs, toggleUWReq, removeUWReq, addUWReq,
        }),

        // ── PIPELINE VIEW ──
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
        })
      )
    ),


           // ── FLOATING CALL CONTROL BAR ──
        view !== 'dial' && React.createElement(CallBar, {activeCall, callStatus, callElapsed, callMuted, activeCallLead, toggleMute, hangUp}),

    // ── APPOINTMENT CONFIRMATION MODAL ── full-screen lock, no escape
    (open && open.disposition === 'appointment_booked' && open.nextCallback && new Date(open.nextCallback) < new Date() && !open.apptConfirmed) &&
      React.createElement(AppointmentConfirmModal, {
        open, upd, logActivity, fmt,
        onAdvance: () => setOpenId(null),
      })
  );
}

export default MetkaCRM;
