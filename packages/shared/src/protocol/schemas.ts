import { Schema, type, MapSchema } from '@colyseus/schema';

export class PlayerSchema extends Schema {
  @type('string') id: string = '';
  @type('string') sessionId: string = '';
  @type('string') name: string = 'Soldier';
  @type('string') team: string = 'alpha'; // 'alpha' | 'bravo'
  @type('boolean') isHost: boolean = false;
  @type('boolean') isReady: boolean = false;

  // Position & Orientation
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') z: number = 0;
  @type('number') yaw: number = 0;
  @type('number') pitch: number = 0;
  @type('number') vx: number = 0;
  @type('number') vy: number = 0;
  @type('number') vz: number = 0;

  // State
  @type('number') health: number = 100;
  @type('boolean') isAlive: boolean = true;
  @type('boolean') isSpawnProtected: boolean = false;
  @type('boolean') isCrouching: boolean = false;
  @type('boolean') isSprinting: boolean = false;
  @type('boolean') isAiming: boolean = false;

  // Weapon
  @type('string') primaryWeaponId: string = 'm416';
  @type('string') activeWeaponId: string = 'm416';
  @type('number') ammoInMag: number = 30;
  @type('number') ammoReserve: number = 120;
  @type('boolean') isReloading: boolean = false;

  // Scoreboard
  @type('uint16') kills: number = 0;
  @type('uint16') deaths: number = 0;
  @type('uint16') assists: number = 0;
  @type('uint16') headshots: number = 0;
  @type('uint32') damage: number = 0;
  @type('uint16') ping: number = 0;

  // Reconciliation
  @type('uint32') lastProcessedInput: number = 0;
}

export class WarehouseRoomState extends Schema {
  @type('string') roomCode: string = '';
  @type('string') hostSessionId: string = '';
  @type('string') matchState: string = 'lobby'; // 'lobby' | 'countdown' | 'in_progress' | 'sudden_death' | 'match_end'
  @type('number') timeRemaining: number = 600;
  @type('number') countdownRemaining: number = 10;
  @type('uint16') alphaKills: number = 0;
  @type('uint16') bravoKills: number = 0;
  @type('string') winningTeam: string = '';
  @type('uint32') serverTick: number = 0;

  @type({ map: PlayerSchema })
  players = new MapSchema<PlayerSchema>();
}

