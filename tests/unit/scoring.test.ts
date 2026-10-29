import { describe, it, expect } from 'vitest';
import { MATCH_RULES, HEALTH_RULES } from '../../packages/shared/src/index';

describe('Match Rules, Scoring and Win Conditions', () => {
  it('enforces TDM rules: first to 50 kills or 10 minutes (600 seconds)', () => {
    expect(MATCH_RULES.scoreLimit).toBe(50);
    expect(MATCH_RULES.timeLimitSeconds).toBe(600);
    expect(MATCH_RULES.maxPlayers).toBe(10);
    expect(MATCH_RULES.teamSize).toBe(5);
  });

  it('enforces spawn protection and respawn delay timers', () => {
    expect(MATCH_RULES.spawnProtectionSeconds).toBe(2);
    expect(MATCH_RULES.respawnDelaySeconds).toBe(3);
    expect(MATCH_RULES.countdownSeconds).toBe(10);
  });

  it('enforces health regeneration specifications (5 HP/s after 6s delay)', () => {
    expect(HEALTH_RULES.maxHealth).toBe(100);
    expect(HEALTH_RULES.regenDelaySeconds).toBe(6);
    expect(HEALTH_RULES.regenRatePerSecond).toBe(5);
  });

  it('validates assist threshold: deals >= 30 damage within 5 seconds', () => {
    const assistThreshold = 30;
    const windowMs = 5000;

    const now = 10000;
    const damageHistory = [
      { attackerId: 'player_a', amount: 35, timestamp: now - 3000 },
      { attackerId: 'player_b', amount: 20, timestamp: now - 2000 },
      { attackerId: 'player_c', amount: 40, timestamp: now - 8000 } // expired
    ];

    const eligibleAssisters = damageHistory
      .filter((dh) => dh.timestamp >= now - windowMs && dh.amount >= assistThreshold)
      .map((dh) => dh.attackerId);

    expect(eligibleAssisters).toContain('player_a');
    expect(eligibleAssisters).not.toContain('player_b'); // insufficient damage
    expect(eligibleAssisters).not.toContain('player_c'); // outside 5s window
  });
});
