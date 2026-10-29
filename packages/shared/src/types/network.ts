import { WeaponId } from '../config/weapons';
import { TeamId } from '../config/rules';
import { PlayerInput } from './index';

export interface FireIntentMessage {
  seq: number;
  timestamp: number; // Client render timestamp (used for lag rewind)
  origin: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  weaponId: WeaponId;
}

export interface HitEventMessage {
  shooterId: string;
  shooterName: string;
  victimId: string;
  victimName: string;
  victimTeam: TeamId;
  weaponId: WeaponId;
  damage: number;
  isHeadshot: boolean;
  isKill: boolean;
  victimHealth: number;
}

export interface PlayerSpawnMessage {
  playerId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  spawnProtectionUntil: number;
}

export interface HistoricalHitbox {
  timestamp: number;
  x: number;
  y: number;
  z: number;
  isCrouched: boolean;
  isAlive: boolean;
}

