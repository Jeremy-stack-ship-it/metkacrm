/**
 * useImportHandlers — v3.14
 *
 * Owns all CSV import / field-mapping / backup state and handlers.
 * Previously scattered across ~90 lines of App.jsx.
 *
 * State managed:
 *   importModal, importPreview, replaceConfirm,
 *   fieldMapModal, csvRawText, csvHeaders, fieldMapDraft,
 *   saveMappingCb, savedMapping
 *
 * Handlers returned:
 *   handleFile, confirmImport, confirmFieldMapping, restoreBackup
 *
 * @param {Object} opts
 * @param {Array}    opts.leads          Current lead array (read-only inside hook)
 * @param {Function} opts.saveLeads      Persist + sync leads
 * @param {Function} opts.backfillLead   Phase-assign leads on import
 * @param {Function} opts.setBackupExists Signal to App.jsx that a backup now exists
 */

import { useState, useCallback } from 'react';
import LZString from 'lz-string';
import { FIELD_MAP_DEFS } from '../constants.js';
import { autoDetectMapping, parseCSV } from './csvParser.js';

// ── localStorage keys (must match App.jsx — never rename) ────────────
const LS_BACKUP  = 'metka-crm-backup-v1';
const LS_MAPPING = 'metka-field-mapping-v1';

// ── Safe lazy initializer for saved column mapping ───────────────────
const loadSavedMapping = () => {
  try {
    const raw = localStorage.getItem(LS_MAPPING);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

export const useImportHandlers = ({ leads, saveLeads, backfillLead, setBackupExists }) => {

  // ── Import modal state ─────────────────────────────────────────────
  const [importModal,    setImportModal]    = useState(false);
  const [importPreview,  setImportPreview]  = useState(null);
  const [replaceConfirm, setReplaceConfirm] = useState('');

  // ── Field-mapping modal state ──────────────────────────────────────
  const [fieldMapModal,  setFieldMapModal]  = useState(false);
  const [csvRawText,     setCsvRawText]     = useState('');
  const [csvHeaders,     setCsvHeaders]     = useState([]);
  const [fieldMapDraft,  setFieldMapDraft]  = useState({});
  const [saveMappingCb,  setSaveMappingCb]  = useState(true);

  // ── Saved column mapping (lazy-loaded from localStorage) ──────────
  const [savedMapping, setSavedMapping] = useState(loadSavedMapping);

  // ── handleFile: reads CSV, auto-detects mapping, opens FieldMapModal ──
  const handleFile = useCallback(e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const txt = ev.target.result;
      const firstLine = txt.split(/\r?\n/)[0] || '';
      const headers = firstLine.split(',').map(h => h.replace(/^"|"$/g, '').trim());
      const lowerHeaders = headers.map(h => h.toLowerCase());
      const autoMap = autoDetectMapping(lowerHeaders);
      // Build draft: prefer saved column names, fall back to auto-detect
      const draft = {};
      const allKeys = [
        ...FIELD_MAP_DEFS.map(f => f.key),
        'score', 'tier', 'daysOld', 'flags', 'rationale', 'leadLevel', 'importStage',
      ];
      allKeys.forEach(k => {
        if (savedMapping[k] !== undefined) {
          const savedIdx = lowerHeaders.indexOf(savedMapping[k].toLowerCase());
          draft[k] = savedIdx > -1 ? savedIdx : (autoMap[k] ?? -1);
        } else {
          draft[k] = autoMap[k] ?? -1;
        }
      });
      setCsvRawText(txt);
      setCsvHeaders(headers);
      setFieldMapDraft(draft);
      setFieldMapModal(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [savedMapping]);

  // ── confirmFieldMapping: persist mapping, parse CSV, open ImportModal ──
  const confirmFieldMapping = useCallback(() => {
    if (saveMappingCb) {
      const toSave = {};
      Object.entries(fieldMapDraft).forEach(([k, idx]) => {
        if (idx > -1 && csvHeaders[idx]) toSave[k] = csvHeaders[idx].toLowerCase();
      });
      setSavedMapping(toSave);
      try { localStorage.setItem(LS_MAPPING, JSON.stringify(toSave)); } catch {}
    }
    const parsed = parseCSV(csvRawText, fieldMapDraft);
    const existing = new Set(leads.map(l => l.phone.replace(/\D/g, '')));
    setImportPreview({
      all: parsed,
      newLeads: parsed.filter(l => !existing.has(l.phone.replace(/\D/g, ''))),
      dupes:    parsed.filter(l =>  existing.has(l.phone.replace(/\D/g, ''))),
    });
    setFieldMapModal(false);
    setImportModal(true);
  }, [saveMappingCb, fieldMapDraft, csvHeaders, csvRawText, leads]);

  // ── confirmImport: auto-backup, phase-assign, merge/replace leads ──
  const confirmImport = useCallback(mode => {
    if (!importPreview) return;
    // Auto-backup before any destructive import
    try {
      const snap = LZString.compressToUTF16(JSON.stringify(leads));
      localStorage.setItem(LS_BACKUP, snap);
      setBackupExists(true);
    } catch {}
    // Assign phase schedules to imported leads
    const withPhases = arr => arr.map(l => backfillLead(l));
    saveLeads(
      mode === 'append'
        ? [...withPhases(importPreview.newLeads), ...leads]
        : withPhases(importPreview.all)
    );
    setImportModal(false);
    setImportPreview(null);
    setReplaceConfirm('');
  }, [importPreview, leads, saveLeads, backfillLead, setBackupExists]);

  // ── restoreBackup: decompress + load the pre-import snapshot ──────
  const restoreBackup = useCallback(() => {
    const raw = localStorage.getItem(LS_BACKUP);
    if (!raw) { alert('No backup found.'); return; }
    try {
      const dec = LZString.decompressFromUTF16(raw);
      const arr = JSON.parse(dec);
      if (Array.isArray(arr) && arr.length > 0) {
        saveLeads(arr);
        alert('✓ Restored ' + arr.length + ' leads from backup.');
      }
    } catch { alert('Backup could not be read.'); }
  }, [saveLeads]);

  return {
    // Import modal
    importModal,    setImportModal,
    importPreview,  setImportPreview,
    replaceConfirm, setReplaceConfirm,
    // Field-mapping modal
    fieldMapModal,  setFieldMapModal,
    csvRawText,     setCsvRawText,
    csvHeaders,     setCsvHeaders,
    fieldMapDraft,  setFieldMapDraft,
    saveMappingCb,  setSaveMappingCb,
    savedMapping,   setSavedMapping,
    // Handlers
    handleFile,
    confirmFieldMapping,
    confirmImport,
    restoreBackup,
  };
};
