import { PLAYER_PHYSICS_RULES } from '@warehouse-strike/shared';

export class AntiCheat {
  // Max legitimate horizontal speed = sprint speed (6.5 m/s) + 20% margin for jumping/slopes
  private static MAX_HORIZONTAL_SPEED = PLAYER_PHYSICS_RULES.sprintSpeed * 1.25; // ~8.1 m/s

  // Message rate limit (max 120 messages/sec per client)
  private messageCounters: Map<string, { count: number; resetTime: number }> = new Map();

  public checkMessageRateLimit(clientId: string, now: number): boolean {
    let entry = this.messageCounters.get(clientId);
    if (!entry || now >= entry.resetTime) {
      entry = { count: 1, resetTime: now + 1000 };
      this.messageCounters.set(clientId, entry);
      return true;
    }

    entry.count++;
    if (entry.count > 120) {
      return false; // Rate limit exceeded
    }
    return true;
  }

  public removeClient(clientId: string) {
    this.messageCounters.delete(clientId);
  }

  public validateSpeed(
    lastPos: { x: number; z: number },
    newPos: { x: number; z: number },
    dtSeconds: number
  ): { valid: boolean; clampedX: number; clampedZ: number } {
    if (dtSeconds <= 0) return { valid: true, clampedX: newPos.x, clampedZ: newPos.z };

    const dx = newPos.x - lastPos.x;
    const dz = newPos.z - lastPos.z;
    const distance = Math.hypot(dx, dz);
    const speed = distance / dtSeconds;

    if (speed > AntiCheat.MAX_HORIZONTAL_SPEED) {
      // Speedhack or teleport detected: clamp to max allowed displacement
      const maxDistance = AntiCheat.MAX_HORIZONTAL_SPEED * dtSeconds;
      const factor = maxDistance / distance;
      return {
        valid: false,
        clampedX: lastPos.x + dx * factor,
        clampedZ: lastPos.z + dz * factor
      };
    }

    return { valid: true, clampedX: newPos.x, clampedZ: newPos.z };
  }

  public sanitizeNickname(raw: string): string {
    let name = raw.replace(/<[^>]*>?/gm, '').trim();
    // Filter profanity / malicious patterns
    name = name.replace(/[^\w\s-]/gi, '');
    if (name.length < 2) name = 'Soldier';
    if (name.length > 16) name = name.substring(0, 16);
    return name;
  }
}

export const antiCheat = new AntiCheat();

