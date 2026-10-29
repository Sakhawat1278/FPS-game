import { describe, it, expect } from 'vitest';
import { WEAPONS } from '../../packages/shared/src/index';

describe('Recoil and Spread Bloom Dynamics', () => {
  it('each weapon defines pattern recoil properties and spread bloom ranges', () => {
    for (const [_, weapon] of Object.entries(WEAPONS)) {
      expect(weapon.recoil.pitchKick).toBeGreaterThan(0);
      expect(weapon.recoil.recoverySpeed).toBeGreaterThan(0);
      expect(weapon.spread.baseHipSpread).toBeGreaterThan(0);
      expect(weapon.spread.maxHipSpread).toBeGreaterThanOrEqual(weapon.spread.baseHipSpread);
      expect(weapon.spread.adsSpreadMultiplier).toBeLessThan(1.0);
    }
  });

  it('Operator has high hipfire spread but pinpoint accuracy when scoped', () => {
    const op = WEAPONS.operator;
    expect(op.spread.baseHipSpread).toBe(0.18);
    expect(op.spread.adsSpreadMultiplier).toBe(0.001); // Near zero spread when ADS scoped
  });

  it('M416 has balanced pitch kick and rapid recovery speed', () => {
    const m4 = WEAPONS.m416;
    expect(m4.recoil.pitchKick).toBe(0.024);
    expect(m4.recoil.recoverySpeed).toBe(10);
    expect(m4.spread.baseHipSpread).toBe(0.035);
  });
});
