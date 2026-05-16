import { describe, it, expect } from 'vitest';
import {
  phaseFromBucket,
  getPhasePriority,
  isDueToday,
  applyPhaseTransition,
} from '../lib/phaseEngine.js';

// ── phaseFromBucket ────────────────────────────────────────────────────────
describe('phaseFromBucket', () => {
  const recentDate = new Date(Date.now() - 5 * 86400000).toISOString().substring(0, 10);
  const oldDate    = new Date(Date.now() - 45 * 86400000).toISOString().substring(0, 10);
  const ancientDate = new Date(Date.now() - 200 * 86400000).toISOString().substring(0, 10);

  it('Bucket A, 5 days old → P1', () => {
    expect(phaseFromBucket({ bucket: 'A', assignDate: recentDate })).toBe('P1');
  });

  it('Bucket A, 45 days old → P3', () => {
    expect(phaseFromBucket({ bucket: 'A', assignDate: oldDate })).toBe('P3');
  });

  it('Bucket B within 180 days → M2', () => {
    expect(phaseFromBucket({ bucket: 'B', assignDate: recentDate })).toBe('M2');
  });

  it('Bucket B older than 180 days → EXIT', () => {
    expect(phaseFromBucket({ bucket: 'B', assignDate: ancientDate })).toBe('EXIT');
  });

  it('Bucket C → EXIT always', () => {
    expect(phaseFromBucket({ bucket: 'C', assignDate: recentDate })).toBe('EXIT');
  });
});

// ── getPhasePriority ───────────────────────────────────────────────────────
describe('getPhasePriority', () => {
  it('no_sale disposition → 100 (highest)', () => {
    expect(getPhasePriority({ disposition: 'no_sale' })).toBe(100);
  });

  it('P1 phase → 80', () => {
    expect(getPhasePriority({ phase: 'P1', disposition: '' })).toBe(80);
  });

  it('M2 phase → 50', () => {
    expect(getPhasePriority({ phase: 'M2', disposition: '' })).toBe(50);
  });

  it('Bucket A with no phase → 40', () => {
    expect(getPhasePriority({ bucket: 'A', disposition: '', phase: null })).toBe(40);
  });

  it('Bucket B → 30', () => {
    expect(getPhasePriority({ bucket: 'B', disposition: '', phase: null })).toBe(30);
  });
});

// ── applyPhaseTransition ───────────────────────────────────────────────────
describe('applyPhaseTransition', () => {
  it('dnc → sets phase EXIT and clears next_dial', () => {
    const patch = applyPhaseTransition({ phase: 'P1' }, 'dnc');
    expect(patch.phase).toBe('EXIT');
    expect(patch.next_dial).toBeNull();
  });

  it('not_interested → EXIT', () => {
    const patch = applyPhaseTransition({}, 'not_interested');
    expect(patch.phase).toBe('EXIT');
  });

  it('no_show → resets to P1', () => {
    const patch = applyPhaseTransition({}, 'no_show');
    expect(patch.phase).toBe('P1');
  });
});
