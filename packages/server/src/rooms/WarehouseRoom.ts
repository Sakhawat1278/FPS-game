import { Room, Client } from 'colyseus';
import {
  WarehouseRoomState,
  PlayerSchema,
  MATCH_RULES,
  NETWORK_RULES
} from '@warehouse-strike/shared';
import { generateRoomCode } from '../utils/roomCode';

export interface JoinOptions {
  nickname?: string;
  roomCode?: string;
}

export class WarehouseRoom extends Room<WarehouseRoomState> {
  maxClients = MATCH_RULES.maxPlayers;
  private tickInterval: any = null;

  onCreate(options: JoinOptions) {
    this.setState(new WarehouseRoomState());

    // Generate room code
    this.state.roomCode = options.roomCode || generateRoomCode(6);
    this.setMetadata({ roomCode: this.state.roomCode });

    // Auto dispose empty rooms after configured duration
    this.autoDispose = true;

    // Simulation tick at 60 Hz
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000 / NETWORK_RULES.serverTickRate);

    // State patch rate at 30 Hz
    this.setPatchRate(1000 / NETWORK_RULES.snapshotRate);

    console.log(`[WarehouseRoom] Created room code: ${this.state.roomCode} (ID: ${this.roomId})`);

    // Register message listeners
    this.onMessage('ping', (client, timestamp: number) => {
      client.send('pong', timestamp);
    });

    this.onMessage('select_team', (client, team: 'alpha' | 'bravo') => {
      const player = this.state.players.get(client.sessionId);
      if (player && this.state.matchState === 'lobby') {
        const teamCount = Array.from(this.state.players.values()).filter(p => p.team === team).length;
        if (teamCount < MATCH_RULES.teamSize) {
          player.team = team;
        }
      }
    });

    this.onMessage('select_primary', (client, weaponId: string) => {
      const player = this.state.players.get(client.sessionId);
      if (player && (weaponId === 'm416' || weaponId === 'operator')) {
        player.primaryWeaponId = weaponId;
        if (player.activeWeaponId === 'm416' || player.activeWeaponId === 'operator') {
          player.activeWeaponId = weaponId;
        }
      }
    });

    this.onMessage('toggle_ready', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && this.state.matchState === 'lobby') {
        player.isReady = !player.isReady;
      }
    });

    this.onMessage('start_match', (client) => {
      if (client.sessionId === this.state.hostSessionId && this.state.matchState === 'lobby') {
        const totalPlayers = this.state.players.size;
        const alphaPlayers = Array.from(this.state.players.values()).filter(p => p.team === 'alpha').length;
        const bravoPlayers = Array.from(this.state.players.values()).filter(p => p.team === 'bravo').length;

        // Check minimum player condition
        if (totalPlayers >= MATCH_RULES.minPlayersToStart && alphaPlayers > 0 && bravoPlayers > 0) {
          this.state.matchState = 'countdown';
          this.state.countdownRemaining = MATCH_RULES.countdownSeconds;
          console.log(`[WarehouseRoom ${this.state.roomCode}] Match countdown started`);
        }
      }
    });
  }

  onJoin(client: Client, options: JoinOptions) {
    const player = new PlayerSchema();
    player.id = client.id;
    player.sessionId = client.sessionId;

    // Sanitize nickname (2-16 chars, fallback to 'Soldier')
    let rawName = (options.nickname || 'Soldier').trim().replace(/<[^>]*>?/gm, '');
    if (rawName.length < 2) rawName = 'Soldier';
    if (rawName.length > 16) rawName = rawName.substring(0, 16);
    player.name = rawName;

    // First player is host
    if (this.state.players.size === 0) {
      player.isHost = true;
      this.state.hostSessionId = client.sessionId;
    }

    // Auto-balance team
    const alphaCount = Array.from(this.state.players.values()).filter(p => p.team === 'alpha').length;
    const bravoCount = Array.from(this.state.players.values()).filter(p => p.team === 'bravo').length;
    player.team = alphaCount <= bravoCount ? 'alpha' : 'bravo';

    this.state.players.set(client.sessionId, player);
    console.log(`[WarehouseRoom ${this.state.roomCode}] Player joined: ${player.name} (${player.team})`);
  }

  onLeave(client: Client, consented?: boolean) {
    console.log(`[WarehouseRoom ${this.state.roomCode}] Player left: ${client.sessionId}`);
    this.state.players.delete(client.sessionId);

    // Host migration
    if (client.sessionId === this.state.hostSessionId && this.state.players.size > 0) {
      const nextHostSession = this.state.players.keys().next().value;
      if (nextHostSession) {
        this.state.hostSessionId = nextHostSession;
        const newHost = this.state.players.get(nextHostSession);
        if (newHost) newHost.isHost = true;
        console.log(`[WarehouseRoom ${this.state.roomCode}] Host migrated to: ${newHost?.name}`);
      }
    }
  }

  update(deltaTime: number) {
    this.state.serverTick++;
    const dtSeconds = deltaTime / 1000;

    // Handle lobby/countdown timer
    if (this.state.matchState === 'countdown') {
      this.state.countdownRemaining -= dtSeconds;
      if (this.state.countdownRemaining <= 0) {
        this.state.matchState = 'in_progress';
        this.state.timeRemaining = MATCH_RULES.timeLimitSeconds;
        console.log(`[WarehouseRoom ${this.state.roomCode}] Match IN PROGRESS!`);
      }
    } else if (this.state.matchState === 'in_progress') {
      this.state.timeRemaining -= dtSeconds;
      if (this.state.timeRemaining <= 0) {
        this.state.matchState = 'match_end';
      }
    }
  }

  onDispose() {
    console.log(`[WarehouseRoom ${this.state.roomCode}] Disposed`);
  }
}

