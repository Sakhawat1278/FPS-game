export type TeamId = 'alpha' | 'bravo';

export interface MatchRules {
  teamSize: number;
  maxPlayers: number;
  minPlayersToStart: number;
  scoreLimit: number; // 50 kills
  timeLimitSeconds: number; // 600 seconds (10 min)
  countdownSeconds: number; // 10 seconds
  resultsSeconds: number; // 15 seconds
  respawnDelaySeconds: number; // 3 seconds
  spawnProtectionSeconds: number; // 2 seconds
  friendlyFire: boolean;
}

export interface PlayerPhysicsRules {
  walkSpeed: number; // 4.2 m/s
  sprintSpeed: number; // 6.5 m/s
  crouchSpeed: number; // 2.2 m/s
  jumpHeight: number; // 1.1 m
  gravity: number; // 22.0 m/s^2 for snappy FPS feel
  stepHeight: number; // 0.35 m
  airControlMultiplier: number;
  acceleration: number;
  friction: number;
  capsuleRadius: number; // 0.38 m
  standingCapsuleHeight: number; // 1.8 m
  crouchingCapsuleHeight: number; // 1.2 m
}

export interface HealthRules {
  maxHealth: number; // 100
  regenRatePerSecond: number; // 5 HP/s
  regenDelaySeconds: number; // 6s after taking damage
}

export interface NetworkRules {
  serverTickRate: number; // 60 Hz
  snapshotRate: number; // 30 Hz
  inputBatchRate: number; // 60 Hz
  maxRewindMs: number; // 250 ms lag compensation limit
  interpolationDelayMs: number; // 100 ms buffer for remote players
  reconnectGracePeriodSeconds: number; // 30s
  emptyRoomDisposeSeconds: number; // 60s
}

export const MATCH_RULES: MatchRules = {
  teamSize: 5,
  maxPlayers: 10,
  minPlayersToStart: 2,
  scoreLimit: 50,
  timeLimitSeconds: 600,
  countdownSeconds: 10,
  resultsSeconds: 15,
  respawnDelaySeconds: 3,
  spawnProtectionSeconds: 2,
  friendlyFire: false
};

export const PLAYER_PHYSICS_RULES: PlayerPhysicsRules = {
  walkSpeed: 4.2,
  sprintSpeed: 6.5,
  crouchSpeed: 2.2,
  jumpHeight: 1.1,
  gravity: 24.0,
  stepHeight: 0.35,
  airControlMultiplier: 0.25,
  acceleration: 45.0,
  friction: 35.0,
  capsuleRadius: 0.38,
  standingCapsuleHeight: 1.8,
  crouchingCapsuleHeight: 1.2
};

export const HEALTH_RULES: HealthRules = {
  maxHealth: 100,
  regenRatePerSecond: 5,
  regenDelaySeconds: 6
};

export const NETWORK_RULES: NetworkRules = {
  serverTickRate: 60,
  snapshotRate: 30,
  inputBatchRate: 60,
  maxRewindMs: 250,
  interpolationDelayMs: 100,
  reconnectGracePeriodSeconds: 30,
  emptyRoomDisposeSeconds: 60
};

