export type WeaponId = 'm416' | 'operator' | 'deagle';
export type WeaponCategory = 'primary' | 'secondary';
export type FireMode = 'auto' | 'semi' | 'bolt';

export interface WeaponRecoilConfig {
  pitchKick: number; // upward kick in radians/degrees
  yawKickMin: number; // horizontal variation min
  yawKickMax: number; // horizontal variation max
  recoverySpeed: number; // recovery speed towards origin
  cameraKick: number;
}

export interface WeaponSpreadConfig {
  baseHipSpread: number;
  maxHipSpread: number;
  moveSpreadPenalty: number;
  sprintSpreadPenalty: number;
  adsSpreadMultiplier: number;
  spreadRecoverySpeed: number;
  scopeSwayAmount: number;
  crouchSwayMultiplier: number;
}

export interface WeaponDamageConfig {
  body: number;
  head: number;
  legs?: number;
  falloffStartMeters?: number;
  falloffMultiplier?: number; // e.g. 0.7 for 70% beyond falloffStart
}

export interface WeaponData {
  id: WeaponId;
  name: string;
  category: WeaponCategory;
  fireMode: FireMode;
  damage: WeaponDamageConfig;
  rpm: number; // rounds per minute
  fireInterval: number; // seconds between shots
  boltCycleTime?: number; // bolt cycle seconds for bolt action
  magSize: number;
  reserveAmmo: number;
  reloadTimeTactical: number;
  reloadTimeEmpty: number;
  adsZoom: number | number[]; // 1.4 for M416, [4, 8] for Operator, 1.1 for Deagle
  recoil: WeaponRecoilConfig;
  spread: WeaponSpreadConfig;
  tracerInterval: number; // e.g. 3 for M416 (every 3rd round)
  scopeGlint?: boolean;
  notes?: string;
}

export const WEAPONS: Record<WeaponId, WeaponData> = {
  m416: {
    id: 'm416',
    name: 'M416',
    category: 'primary',
    fireMode: 'auto',
    damage: {
      body: 22,
      head: 44,
      falloffStartMeters: 40,
      falloffMultiplier: 0.7
    },
    rpm: 700,
    fireInterval: 60 / 700, // ~0.0857s
    magSize: 30,
    reserveAmmo: 120,
    reloadTimeTactical: 2.2,
    reloadTimeEmpty: 2.6,
    adsZoom: 1.4,
    recoil: {
      pitchKick: 0.024,
      yawKickMin: -0.006,
      yawKickMax: 0.009,
      recoverySpeed: 10.0,
      cameraKick: 0.015
    },
    spread: {
      baseHipSpread: 0.035,
      maxHipSpread: 0.12,
      moveSpreadPenalty: 0.04,
      sprintSpreadPenalty: 0.08,
      adsSpreadMultiplier: 0.2,
      spreadRecoverySpeed: 4.0,
      scopeSwayAmount: 0.002,
      crouchSwayMultiplier: 0.5
    },
    tracerInterval: 3
  },
  operator: {
    id: 'operator',
    name: 'Operator',
    category: 'primary',
    fireMode: 'bolt',
    damage: {
      body: 100,
      head: 100,
      legs: 100, // One shot = one kill on any body part
      falloffStartMeters: 999,
      falloffMultiplier: 1.0
    },
    rpm: 45,
    fireInterval: 60 / 45,
    boltCycleTime: 1.3,
    magSize: 5,
    reserveAmmo: 20,
    reloadTimeTactical: 3.0,
    reloadTimeEmpty: 3.0,
    adsZoom: [4.0, 8.0],
    recoil: {
      pitchKick: 0.11,
      yawKickMin: -0.015,
      yawKickMax: 0.015,
      recoverySpeed: 4.5,
      cameraKick: 0.08
    },
    spread: {
      baseHipSpread: 0.18, // Large hip/no-scope spread
      maxHipSpread: 0.35,
      moveSpreadPenalty: 0.15,
      sprintSpreadPenalty: 0.25,
      adsSpreadMultiplier: 0.001, // pinpoint when scoped & still
      spreadRecoverySpeed: 2.0,
      scopeSwayAmount: 0.012,
      crouchSwayMultiplier: 0.4
    },
    tracerInterval: 1,
    scopeGlint: true,
    notes: 'One shot = one kill on any body hit.'
  },
  deagle: {
    id: 'deagle',
    name: 'Desert Eagle',
    category: 'secondary',
    fireMode: 'semi',
    damage: {
      body: 55,
      head: 110, // Headshot is instant kill (100 HP)
      falloffStartMeters: 25,
      falloffMultiplier: 0.6
    },
    rpm: 240,
    fireInterval: 60 / 240, // 0.25s
    magSize: 7,
    reserveAmmo: 35,
    reloadTimeTactical: 1.8,
    reloadTimeEmpty: 1.8,
    adsZoom: 1.1,
    recoil: {
      pitchKick: 0.065,
      yawKickMin: -0.012,
      yawKickMax: 0.012,
      recoverySpeed: 8.0,
      cameraKick: 0.04
    },
    spread: {
      baseHipSpread: 0.045,
      maxHipSpread: 0.14,
      moveSpreadPenalty: 0.04,
      sprintSpreadPenalty: 0.09,
      adsSpreadMultiplier: 0.35,
      spreadRecoverySpeed: 5.0,
      scopeSwayAmount: 0.003,
      crouchSwayMultiplier: 0.6
    },
    tracerInterval: 1
  }
};

