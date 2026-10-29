import { describe, it, expect } from 'vitest';
import { WEAPONS, HEALTH_RULES } from '../../packages/shared/src/index';

describe('Weapon Data and Damage System', () => {
  it('should define all three required weapons: M416, Operator, and Desert Eagle', () => {
    expect(WEAPONS.m416).toBeDefined();
    expect(WEAPONS.operator).toBeDefined();
    expect(WEAPONS.deagle).toBeDefined();
  });

  it('Operator guarantees a 1-shot kill on any body hit (head, torso, legs)', () => {
    const op = WEAPONS.operator;
    expect(op.damage.head).toBeGreaterThanOrEqual(HEALTH_RULES.maxHealth);
    expect(op.damage.body).toBeGreaterThanOrEqual(HEALTH_RULES.maxHealth);
    expect(op.damage.legs).toBeGreaterThanOrEqual(HEALTH_RULES.maxHealth);
    expect(op.damage.body).toBe(100);
  });

  it('M416 deals 22 body damage and 44 head damage at close range', () => {
    const m4 = WEAPONS.m416;
    expect(m4.damage.body).toBe(22);
    expect(m4.damage.head).toBe(44);
    expect(m4.damage.head).toBe(m4.damage.body * 2);
  });

  it('Desert Eagle should deal 2-shot kill to body (55 dmg) and 1-shot kill to head (110 dmg)', () => {
    const deagle = WEAPONS.deagle;
    expect(deagle.damage.head).toBeGreaterThanOrEqual(HEALTH_RULES.maxHealth);
    expect(deagle.damage.body * 2).toBeGreaterThanOrEqual(HEALTH_RULES.maxHealth);
    expect(deagle.damage.head).toBe(110);
    expect(deagle.damage.body).toBe(55);
  });

  it('M416 applies damage falloff multiplier past falloffStartMeters (40m)', () => {
    const m4 = WEAPONS.m416;
    expect(m4.damage.falloffStartMeters).toBe(40);
    expect(m4.damage.falloffMultiplier).toBe(0.7);

    const closeDamage = m4.damage.body;
    const farDamage = Math.round(closeDamage * (m4.damage.falloffMultiplier || 1.0));
    expect(farDamage).toBeLessThan(closeDamage);
  });

  it('all weapons have positive reload times, magazine sizes, and fire intervals', () => {
    for (const [id, weapon] of Object.entries(WEAPONS)) {
      expect(weapon.magSize).toBeGreaterThan(0);
      expect(weapon.fireInterval).toBeGreaterThan(0);
      expect(weapon.reloadTimeTactical).toBeGreaterThan(0);
      expect(weapon.reloadTimeEmpty).toBeGreaterThanOrEqual(weapon.reloadTimeTactical);
    }
  });
});
