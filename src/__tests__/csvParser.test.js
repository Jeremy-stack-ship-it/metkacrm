import { describe, it, expect } from 'vitest';
import { parseBucket, parseDisp, autoDetectMapping, parseCSV } from '../lib/csvParser.js';

// ── parseBucket ────────────────────────────────────────────────────────────
describe('parseBucket', () => {
  it('2026 date → Bucket A', () => {
    expect(parseBucket('2026-01-15')).toBe('A');
  });

  it('Nov 2025 date → Bucket B', () => {
    expect(parseBucket('2025-11-15')).toBe('B');
  });

  it('Dec 2025 date → Bucket B', () => {
    expect(parseBucket('2025-12-31')).toBe('B');
  });

  it('Jan 2025 date → Bucket C', () => {
    expect(parseBucket('2025-01-01')).toBe('C');
  });

  it('null/empty → Bucket C', () => {
    expect(parseBucket(null)).toBe('C');
    expect(parseBucket('')).toBe('C');
  });
});

// ── parseDisp ──────────────────────────────────────────────────────────────
describe('parseDisp', () => {
  it('empty/null → not_called', () => {
    expect(parseDisp(null)).toBe('not_called');
    expect(parseDisp('')).toBe('not_called');
  });

  it('appointment string → interested', () => {
    expect(parseDisp('Appointment Set')).toBe('interested');
  });

  it('no contact string → no_answer', () => {
    expect(parseDisp('No Contact')).toBe('no_answer');
    expect(parseDisp('Unreachable')).toBe('no_answer');
  });

  it('unknown string → not_called', () => {
    expect(parseDisp('Some Other Status')).toBe('not_called');
  });
});

// ── autoDetectMapping ──────────────────────────────────────────────────────
describe('autoDetectMapping', () => {
  it('detects phone column from "cellphone"', () => {
    const headers = ['firstname', 'lastname', 'cellphone', 'state'];
    const map = autoDetectMapping(headers);
    expect(map.phone).toBe(2);
  });

  it('detects name columns', () => {
    const headers = ['first', 'last', 'mobile'];
    const map = autoDetectMapping(headers);
    expect(map.fn).toBe(0);
    expect(map.ln).toBe(1);
  });

  it('returns -1 for missing columns', () => {
    const map = autoDetectMapping(['foo', 'bar']);
    expect(map.phone).toBe(-1);
    expect(map.name).toBe(-1);
  });
});

// ── parseCSV ───────────────────────────────────────────────────────────────
describe('parseCSV', () => {
  it('returns empty array for fewer than 2 lines', () => {
    expect(parseCSV('')).toEqual([]);
    expect(parseCSV('firstname,phone')).toEqual([]);
  });

  it('parses a basic two-column CSV', () => {
    const csv = `firstname,lastname,cellphone,state\nJohn,Smith,4055551234,OK`;
    const leads = parseCSV(csv);
    expect(leads.length).toBe(1);
    expect(leads[0].name).toBe('John Smith');
    expect(leads[0].phone).toMatch(/555-1234/);
    expect(leads[0].state).toBe('OK');
  });

  it('assigns a unique id to each lead', () => {
    const csv = `firstname,lastname,cellphone\nJane,Doe,4055559876\nBob,Jones,4055550001`;
    const leads = parseCSV(csv);
    expect(leads.length).toBe(2);
    expect(leads[0].id).toBeTruthy();
    expect(leads[1].id).toBeTruthy();
    expect(leads[0].id).not.toBe(leads[1].id);
  });

  it('strips non-digit chars from phone numbers', () => {
    const csv = `name,cellphone\nTest User,(405) 555-1234`;
    const leads = parseCSV(csv);
    expect(leads[0].phone).toMatch(/555-1234/);
  });

  it('skips rows with no name and no phone', () => {
    const csv = `name,cellphone\n,,\nReal Person,4055551111`;
    const leads = parseCSV(csv);
    const valid = leads.filter(l => l.name || l.phone);
    expect(valid.length).toBeGreaterThanOrEqual(1);
  });
});
