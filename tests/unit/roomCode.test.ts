import { describe, it, expect } from 'vitest';
import { generateRoomCode } from '../../packages/server/src/utils/roomCode';

describe('Room Code Generation and Validation', () => {
  it('generates a 6-character uppercase alphanumeric code', () => {
    const code = generateRoomCode(6);
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('excludes easily confused characters (0, O, 1, I) to prevent typos', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode(6);
      expect(code).not.toContain('0');
      expect(code).not.toContain('O');
      expect(code).not.toContain('1');
      expect(code).not.toContain('I');
    }
  });

  it('generates unique codes across 1,000 iterations', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      set.add(generateRoomCode(6));
    }
    // High collision entropy check
    expect(set.size).toBeGreaterThan(990);
  });
});

