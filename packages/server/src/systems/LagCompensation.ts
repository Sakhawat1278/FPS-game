import { HistoricalHitbox } from '@warehouse-strike/shared';

export interface HitboxRaycastResult {
  hit: boolean;
  victimId: string;
  isHeadshot: boolean;
  hitDistance: number;
  hitPoint: { x: number; y: number; z: number };
}

export class LagCompensation {
  // Circular history buffers: playerId -> list of snapshots
  private history: Map<string, HistoricalHitbox[]> = new Map();
  private maxBufferMs = 300; // Keep 300ms buffer (rewind allowed up to 250ms)

  public recordSnapshot(playerId: string, state: HistoricalHitbox) {
    let list = this.history.get(playerId);
    if (!list) {
      list = [];
      this.history.set(playerId, list);
    }

    state.timestamp = Number(state.timestamp);
    list.push(state);

    // Evict old entries beyond maxBufferMs
    const cutoff = state.timestamp - this.maxBufferMs;
    while (list.length > 0 && list[0].timestamp < cutoff) {
      list.shift();
    }
  }

  public removePlayer(playerId: string) {
    this.history.delete(playerId);
  }

  public getRewoundPosition(playerId: string, targetTimeVal: number | any, nowVal: number | any): { x: number; y: number; z: number; isCrouched: boolean } | null {
    const list = this.history.get(playerId);
    if (!list || list.length === 0) return null;

    const targetTime = Number(targetTimeVal);
    const now = Number(nowVal);

    // Clamp rewind to max 250 ms in past (Anti-cheat / spec requirement)
    const minAllowedTime = now - 250;
    const clampedTime = Math.max(minAllowedTime, Math.min(now, targetTime));

    if (clampedTime <= list[0].timestamp) {
      return { x: list[0].x, y: list[0].y, z: list[0].z, isCrouched: list[0].isCrouched };
    }
    if (clampedTime >= list[list.length - 1].timestamp) {
      const last = list[list.length - 1];
      return { x: last.x, y: last.y, z: last.z, isCrouched: last.isCrouched };
    }

    // Binary / linear search for surrounding frames
    for (let i = 0; i < list.length - 1; i++) {
      const t0 = list[i].timestamp;
      const t1 = list[i + 1].timestamp;

      if (clampedTime >= t0 && clampedTime <= t1) {
        const factor = (t1 - t0) > 0 ? (clampedTime - t0) / (t1 - t0) : 0;
        return {
          x: list[i].x + (list[i + 1].x - list[i].x) * factor,
          y: list[i].y + (list[i + 1].y - list[i].y) * factor,
          z: list[i].z + (list[i + 1].z - list[i].z) * factor,
          isCrouched: list[i + 1].isCrouched
        };
      }
    }

    const last = list[list.length - 1];
    return { x: last.x, y: last.y, z: last.z, isCrouched: last.isCrouched };
  }

  // Intersects a ray with player's head and body hitboxes
  public raycastTarget(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    targetPos: { x: number; y: number; z: number; isCrouched: boolean }
  ): { hit: boolean; isHeadshot: boolean; distance: number } {
    // Eye/head center height
    const eyeY = targetPos.y + (targetPos.isCrouched ? 1.05 : 1.62);
    const headRadius = 0.22;

    // Test head sphere
    const headDist = this.intersectRaySphere(origin, dir, { x: targetPos.x, y: eyeY, z: targetPos.z }, headRadius);
    if (headDist !== null && headDist > 0) {
      return { hit: true, isHeadshot: true, distance: headDist };
    }

    // Test body box (half-extents: hx: 0.35, hy: targetPos.isCrouched ? 0.5 : 0.75, hz: 0.35)
    const bodyHeight = targetPos.isCrouched ? 1.0 : 1.5;
    const bodyCenterY = targetPos.y + bodyHeight / 2;
    const bodyDist = this.intersectRayAABB(
      origin,
      dir,
      { x: targetPos.x - 0.38, y: targetPos.y, z: targetPos.z - 0.38 },
      { x: targetPos.x + 0.38, y: targetPos.y + bodyHeight, z: targetPos.z + 0.38 }
    );

    if (bodyDist !== null && bodyDist > 0) {
      return { hit: true, isHeadshot: false, distance: bodyDist };
    }

    return { hit: false, isHeadshot: false, distance: Infinity };
  }

  private intersectRaySphere(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    center: { x: number; y: number; z: number },
    radius: number
  ): number | null {
    const ox = origin.x - center.x;
    const oy = origin.y - center.y;
    const oz = origin.z - center.z;

    const b = ox * dir.x + oy * dir.y + oz * dir.z;
    const c = (ox * ox + oy * oy + oz * oz) - radius * radius;
    const d = b * b - c;

    if (d < 0) return null;
    const t = -b - Math.sqrt(d);
    return t > 0 ? t : null;
  }

  private intersectRayAABB(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    min: { x: number; y: number; z: number },
    max: { x: number; y: number; z: number }
  ): number | null {
    let tmin = (min.x - origin.x) / (dir.x || 1e-9);
    let tmax = (max.x - origin.x) / (dir.x || 1e-9);
    if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

    let tymin = (min.y - origin.y) / (dir.y || 1e-9);
    let tymax = (max.y - origin.y) / (dir.y || 1e-9);
    if (tymin > tymax) [tymin, tymax] = [tymax, tymin];

    if (tmin > tymax || tymin > tmax) return null;
    if (tymin > tmin) tmin = tymin;
    if (tymax < tmax) tmax = tymax;

    let tzmin = (min.z - origin.z) / (dir.z || 1e-9);
    let tzmax = (max.z - origin.z) / (dir.z || 1e-9);
    if (tzmin > tzmax) [tzmin, tzmax] = [tzmax, tzmin];

    if (tmin > tzmax || tzmin > tmax) return null;
    if (tzmin > tmin) tmin = tzmin;

    return tmin > 0 ? tmin : null;
  }
}
