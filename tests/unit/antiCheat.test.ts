import { describe, it, expect } from 'vitest';
import { AntiCheat } from '../../packages/server/src/systems/AntiCheat';

describe('AntiCheat Security Verification', () => {
  const ac = new AntiCheat();

  it('sanitizes malicious nickname inputs by removing HTML and illegal symbols', () => {
    const raw = '<script>alert("hack")</script>Player#1';
    const clean = ac.sanitizeNickname(raw);
    expect(clean).not.toContain('<');
    expect(clean).not.toContain('>');
    expect(clean).not.toContain('"');
    expect(clean.length).toBeLessThanOrEqual(16);
  });

  it('clamps nickname length between 2 and 16 characters with default fallback', () => {
    expect(ac.sanitizeNickname('')).toBe('Soldier');
    expect(ac.sanitizeNickname('A')).toBe('Soldier');
    expect(ac.sanitizeNickname('SuperDuperLongNameExceedingMaxChars')).toHaveLength(16);
  });

  it('validates normal walking movement displacements without clamping', () => {
    const dt = 1 / 60; // 16.6ms
    // Move 0.1 meter in 16.6ms = ~6.0 m/s (legit sprint)
    const result = ac.validateSpeed({ x: 0, z: 0 }, { x: 0.1, z: 0 }, dt);
    expect(result.valid).toBe(true);
    expect(result.clampedX).toBe(0.1);
  });

  it('detects and clamps speedhack teleports to max horizontal displacement', () => {
    const dt = 1 / 60;
    // Attempting to move 10 meters in 1 tick = 600 m/s (speedhack!)
    const result = ac.validateSpeed({ x: 0, z: 0 }, { x: 10, z: 0 }, dt);
    expect(result.valid).toBe(false);
    expect(result.clampedX).toBeLessThan(0.2); // Clamped to ~8.1 m/s * dt = ~0.135m
    expect(result.clampedX).toBeGreaterThan(0);
  });

  it('enforces message rate limits per client', () => {
    const clientId = 'speedy_client_1';
    const now = Date.now();

    // 120 messages should pass
    for (let i = 0; i < 120; i++) {
      expect(ac.checkMessageRateLimit(clientId, now)).toBe(true);
    }

    // 121st message in the same second window should be rejected
    expect(ac.checkMessageRateLimit(clientId, now)).toBe(false);

    // Resets after 1000ms
    expect(ac.checkMessageRateLimit(clientId, now + 1001)).toBe(true);
  });
});
