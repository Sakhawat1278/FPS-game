import * as THREE from 'three';
import { Client, Room } from 'colyseus.js';
import {
  WarehouseRoomState,
  PlayerInput,
  FireIntentMessage,
  HitEventMessage,
  PlayerSpawnMessage,
  WeaponId
} from '@warehouse-strike/shared';
import { CharacterController } from '../core/CharacterController';
import { RemotePlayer } from '../entities/RemotePlayer';
import { ProceduralAudio } from '../audio/ProceduralAudio';

export class NetworkController {
  public client: Client;
  public room: Room<WarehouseRoomState> | null = null;
  private scene: THREE.Scene;
  private charController: CharacterController;
  private audio: ProceduralAudio;

  // Remote players map
  public remotePlayers: Map<string, RemotePlayer> = new Map();

  // Client Prediction & Input Buffer
  private unackedInputs: PlayerInput[] = [];

  // Death / Spawn state
  public isLocalAlive: boolean = true;
  public deathCamOverlayEl: HTMLElement | null = null;
  public spawnProtectionEl: HTMLElement | null = null;

  // Callbacks
  public onHitEvent?: (event: HitEventMessage) => void;

  constructor(scene: THREE.Scene, charController: CharacterController, audio: ProceduralAudio) {
    this.scene = scene;
    this.charController = charController;
    this.audio = audio;

    const serverUrl = window.location.hostname === 'localhost'
      ? 'ws://localhost:2567'
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    this.client = new Client(serverUrl);

    this.setupDeathUI();
  }

  private setupDeathUI() {
    // Death Camera Overlay
    const deathEl = document.createElement('div');
    deathEl.id = 'death-cam-overlay';
    deathEl.style.display = 'none';
    deathEl.innerHTML = `
      <div class="death-title">YOU WERE ELIMINATED</div>
      <div id="death-killer" class="death-killer">by Enemy Soldier</div>
      <div class="death-timer">Respawning in <span id="death-countdown">3</span>s...</div>
    `;
    document.body.appendChild(deathEl);
    this.deathCamOverlayEl = deathEl;

    // Spawn Protection Banner
    const protEl = document.createElement('div');
    protEl.id = 'spawn-protection-banner';
    protEl.style.display = 'none';
    protEl.innerText = '🛡️ SPAWN PROTECTION ACTIVE (2s)';
    document.body.appendChild(protEl);
    this.spawnProtectionEl = protEl;

    const style = document.createElement('style');
    style.innerHTML = `
      #death-cam-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(185, 28, 28, 0.4);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 100;
        backdrop-filter: blur(4px);
      }
      .death-title {
        font-size: 36px;
        font-weight: 900;
        letter-spacing: 2px;
        color: #ef4444;
        text-shadow: 0 2px 10px rgba(0,0,0,0.8);
      }
      .death-killer {
        font-size: 20px;
        color: #f3f4f6;
        margin: 10px 0 16px 0;
      }
      .death-timer {
        font-size: 16px;
        color: #e5e7eb;
        background: rgba(0,0,0,0.6);
        padding: 6px 16px;
        border-radius: 6px;
      }
      #spawn-protection-banner {
        position: absolute;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(2, 132, 199, 0.85);
        border: 1px solid #38bdf8;
        color: #ffffff;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.5px;
        padding: 6px 18px;
        border-radius: 20px;
        pointer-events: none;
        box-shadow: 0 0 12px rgba(56, 189, 248, 0.6);
        animation: pulse 1s infinite;
      }
    `;
    document.head.appendChild(style);
  }

  public async connect(): Promise<Room<WarehouseRoomState>> {
    // Check URL query parameters for invite code: e.g. ?room=XYZ123
    const urlParams = new URLSearchParams(window.location.search);
    const roomCodeFromUrl = urlParams.get('room');

    const options: any = {
      nickname: 'Soldier_' + Math.floor(Math.random() * 900 + 100)
    };
    if (roomCodeFromUrl) {
      options.roomCode = roomCodeFromUrl.trim().toUpperCase();
    }

    this.room = await this.client.joinOrCreate<WarehouseRoomState>('warehouse_room', options);
    console.log(`[NetworkController] Connected to Room: ${this.room.state.roomCode} (ID: ${this.room.id})`);

    // Synchronize current URL without reloading so the player can copy the link
    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?room=${this.room.state.roomCode}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);

    // Setup room listeners
    this.setupRoomEvents();
    return this.room;
  }

  private setupRoomEvents() {
    if (!this.room) return;

    // Track remote player additions
    this.room.state.players.onAdd((player, sessionId) => {
      if (sessionId === this.room!.sessionId) {
        console.log(`[NetworkController] Local player initialized on team: ${player.team}`);
        this.charController.respawnAt(player.x, player.y, player.z);
        return;
      }

      console.log(`[NetworkController] Remote player joined: ${player.name} (${sessionId})`);
      const remote = new RemotePlayer(this.scene, player);
      this.remotePlayers.set(sessionId, remote);

      player.onChange(() => {
        remote.pushSnapshot(player);
      });
    });

    // Track remote player removals
    this.room.state.players.onRemove((_, sessionId) => {
      const remote = this.remotePlayers.get(sessionId);
      if (remote) {
        remote.destroy();
        this.remotePlayers.delete(sessionId);
      }
    });

    // Hit events from server
    this.room.onMessage('hit_event', (event: HitEventMessage) => {
      if (this.onHitEvent) this.onHitEvent(event);

      // Local player was the victim
      if (event.victimId === this.room!.sessionId) {
        if (event.isKill) {
          this.isLocalAlive = false;
          if (this.deathCamOverlayEl) {
            this.deathCamOverlayEl.style.display = 'flex';
            const killerEl = this.deathCamOverlayEl.querySelector('#death-killer');
            if (killerEl) killerEl.textContent = `Eliminated by ${event.shooterName} (${event.weaponId.toUpperCase()})`;
          }
        }
      }
    });

    // Spawn events from server
    this.room.onMessage('spawn_event', (event: PlayerSpawnMessage) => {
      if (event.playerId === this.room!.sessionId) {
        this.isLocalAlive = true;
        if (this.deathCamOverlayEl) this.deathCamOverlayEl.style.display = 'none';
        this.charController.respawnAt(event.x, event.y, event.z);
      }
    });
  }

  public sendInput(input: PlayerInput) {
    if (!this.room || !this.isLocalAlive) return;

    // Send input stream to server
    this.room.send('player_input', input);
    this.unackedInputs.push(input);

    // Keep up to 60 unacknowledged inputs (1 second)
    if (this.unackedInputs.length > 60) {
      this.unackedInputs.shift();
    }
  }

  public sendFireIntent(weaponId: WeaponId, origin: THREE.Vector3, direction: THREE.Vector3) {
    if (!this.room || !this.isLocalAlive) return;

    const msg: FireIntentMessage = {
      seq: performance.now(),
      timestamp: Date.now(),
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      weaponId
    };

    this.room.send('fire_intent', msg);
  }

  public update(now: number, cameraPosition: THREE.Vector3) {
    // Update remote players with snapshot interpolation
    for (const [_, remote] of this.remotePlayers.entries()) {
      remote.update(now, cameraPosition);
    }

    // Server Reconciliation
    if (this.room) {
      const localSchema = this.room.state.players.get(this.room.sessionId);
      if (localSchema && this.isLocalAlive) {
        // Discard inputs processed by server
        this.unackedInputs = this.unackedInputs.filter(inp => inp.seq > localSchema.lastProcessedInput);

        // Distance check between local prediction and authoritative server
        const dist = Math.hypot(
          this.charController.position.x - localSchema.x,
          this.charController.position.z - localSchema.z
        );

        // Reconcile if rubber-band difference exceeds 0.25m
        if (dist > 0.25) {
          this.charController.position.x = localSchema.x;
          this.charController.position.z = localSchema.z;
          this.charController.rigidBody.setTranslation(
            { x: localSchema.x, y: localSchema.y, z: localSchema.z },
            true
          );
        }

        // Spawn protection banner
        if (this.spawnProtectionEl) {
          this.spawnProtectionEl.style.display = localSchema.isSpawnProtected ? 'block' : 'none';
        }
      }
    }
  }
}
