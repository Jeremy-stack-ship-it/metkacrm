import { describe, it, expect } from 'vitest';
import { priority, autoFollowUp } from '../lib/leadScoring.js';

// ── priority ───────────────────────────────────────────────────────────────
describe('priority', () => {
  it('returns 0 for null/undefined', () => {
    expect(priority(null)).toBe(0);
    expect(priority(undefined)).toBe(0);
  });

  it('DNC → -9999 (hard floor)', () => {
    expect(priority({ disposition: 'dnc' })).toBe(-9999);
  });

  it('not_interested → -9999', () => {
    expect(priority({ disposition: 'not_interested' })).toBe(-9999);
  });

  it('issued stage → -100 (soft sink)', () => {
    expect(priority({ stage: 'issued', disposition: '' })).toBe(-100);
  });

  it('app_submitted stage → -100', () => {
    expect(priority({ stage: 'app_submitted', disposition: '' })).toBe(-100);
  });

  it('overdue callback scores ≥ 1000', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
    const lead = { disposition: 'callback', nextCallback: yesterday, bucket: 'A' };
    expect(priority(lead)).toBeGreaterThanOrEqual(1000);
  });

  it('fresh Bucket A lead scores higher than fresh Bucket B lead', () => {
    const assignDate = new Date().toISOString().substring(0, 10);
    const a = priority({ bucket: 'A', assignDate, disposition: '', stage: 'new' });
    const b = priority({ bucket: 'B', assignDate, disposition: '', stage: 'new' });
    expect(a).toBeGreaterThan(b);
  });

  it('Bucket A no other signals beats Bucket B', () => {
    const old = '2020-01-01';
    const a = priority({ bucket: 'A', assignDate: old, disposition: '', stage: 'new' });
    const b = priority({ bucket: 'B', assignDate: old, disposition: '', stage: 'new' });
    expect(a).toBeGreaterThan(b);
  });
});

// ── autoFollowUp ───────────────────────────────────────────────────────────
describe('autoFollowUp', () => {
  it('dnc → null (clear callback)', () => {
    expect(autoFollowUp('dnc')).toBeNull();
  });

  it('not_interested → null', () => {
    expect(autoFollowUp('not_interested')).toBeNull();
  });

  it('no_answer → returns a date string in the future', () => {
    const result = autoFollowUp('no_answer');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(new Date(result).getTime()).toBeGreaterThan(Date.now() - 86400000);
  });

  it('vm_left → returns a date string', () => {
    const result = autoFollowUp('vm_left');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('appointment_booked → undefined (preserve existing callback)', () => {
    expect(autoFollowUp('appointment_booked')).toBeUndefined();
  });
});
