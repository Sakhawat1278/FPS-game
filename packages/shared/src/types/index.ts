import { TeamId } from '../config/rules';
import { WeaponId } from '../config/weapons';

export type MatchState = 'lobby' | 'countdown' | 'in_progress' | 'sudden_death' | 'match_end';

export interface PlayerInput {
  seq: number;
  tick: number;
  timestamp: number;
  moveForward: number; // -1 to 1
  moveRight: number; // -1 to 1
  yaw: number; // radians
  pitch: number; // radians
  isSprinting: boolean;
  isCrouching: boolean;
  isJumping: boolean;
  isShooting: boolean;
  isAiming: boolean;
  weaponSlotRequested?: number; // 1 (primary), 2 (secondary)
  reloadRequested?: boolean;
}

export interface PlayerStats {
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  damage: number;
  shotsFired: number;
  shotsHit: number;
  longestStreak: number;
  currentStreak: number;
}

export interface KillFeedEntry {
  id: string;
  killerId: string;
  killerName: string;
  killerTeam: TeamId;
  victimId: string;
  victimName: string;
  victimTeam: TeamId;
  weaponId: WeaponId;
  isHeadshot: boolean;
  timestamp: number;
}

