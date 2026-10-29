import { Room, Client } from 'colyseus';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  WarehouseRoomState,
  PlayerSchema,
  MATCH_RULES,
  NETWORK_RULES,
  HEALTH_RULES,
  PLAYER_PHYSICS_RULES,
  WEAPONS,
  WAREHOUSE_MAP,
  PlayerInput,
  FireIntentMessage,
  HitEventMessage,
  computeDesiredMovement,
  applyAcceleration,
  SpawnPoint,
  WeaponId
} from '@warehouse-strike/shared';
import { generateRoomCode } from '../utils/roomCode';
import { LagCompensation } from '../systems/LagCompensation';
import { antiCheat } from '../systems/AntiCheat';

export interface JoinOptions {
  nickname?: string;
  roomCode?: string;
  deviceId?: string;
}

interface DamageInstance {
  attackerId: string;
  amount: number;
  timestamp: number;
}

interface ServerPlayerData {
  characterController: RAPIER.KinematicCharacterController;
  rigidBody: RAPIER.RigidBody;
  standingColliderDesc: RAPIER.ColliderDesc;
  crouchingColliderDesc: RAPIER.ColliderDesc;
  activeCollider: RAPIER.Collider;
  lastDamageTime: number;
  lastFireTime: number;
  spawnProtectionEndTime: number;
  respawnTimer: number;
  isGrounded: boolean;
  currentStreak: number;
  deviceId?: string;
  damageHistory: DamageInstance[];
  isBot?: boolean;
  reloadEndTime?: number;
}

export class WarehouseRoom extends Room<WarehouseRoomState> {
  maxClients = MATCH_RULES.maxPlayers;
  private rapierWorld!: RAPIER.World;
  private lagCompensation: LagCompensation = new LagCompensation();
  private serverData: Map<string, ServerPlayerData> = new Map();
  public lastTickDurationMs: number = 0;

  async onCreate(options: JoinOptions) {
    this.setState(new WarehouseRoomState());

    // Generate room code (guarantee valid 6-character code)
    if (options.roomCode && options.roomCode.trim().length > 0 && options.roomCode.toUpperCase() !== 'UNDEFINED') {
      this.state.roomCode = options.roomCode.trim().toUpperCase();
    } else {
      this.state.roomCode = generateRoomCode(6);
    }
    this.setMetadata({ roomCode: this.state.roomCode });

    this.autoDispose = true;

    // Initialize Rapier World on Server
    await RAPIER.init();
    this.rapierWorld = new RAPIER.World({ x: 0, y: -PLAYER_PHYSICS_RULES.gravity, z: 0 });

    // Build static map collision hulls on server
    const staticBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const staticBody = this.rapierWorld.createRigidBody(staticBodyDesc);
    for (const c of WAREHOUSE_MAP.colliders) {
      const desc = RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz).setTranslation(c.x, c.y, c.z);
      if (c.rotationY) {
        desc.setRotation({
          x: 0,
          y: Math.sin(c.rotationY / 2),
          z: 0,
          w: Math.cos(c.rotationY / 2)
        });
      }
      this.rapierWorld.createCollider(desc, staticBody);
    }

    // Fixed 60 Hz simulation loop
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000 / NETWORK_RULES.serverTickRate);

    // 30 Hz snapshot rate
    this.setPatchRate(1000 / NETWORK_RULES.snapshotRate);

    console.log(`[WarehouseRoom] Created authoritative 60Hz room: ${this.state.roomCode}`);

    // Register message listeners
    this.setupMessageHandlers();
  }

  private setupMessageHandlers() {
    this.onMessage('ping', (client, timestamp: number) => {
      client.send('pong', timestamp);
    });

    // Client continuous input stream
    this.onMessage('player_input', (client, input: PlayerInput) => {
      const now = Date.now();
      if (!antiCheat.checkMessageRateLimit(client.sessionId, now)) return;

      const player = this.state.players.get(client.sessionId);
      const data = this.serverData.get(client.sessionId);
      if (!player || !data || !player.isAlive) return;

      // Update orientation
      player.yaw = input.yaw;
      player.pitch = input.pitch;
      player.lastProcessedInput = input.seq;

      // Update stance collider
      if (input.isCrouching !== player.isCrouching) {
        player.isCrouching = input.isCrouching;
        this.rapierWorld.removeCollider(data.activeCollider, false);
        const desc = player.isCrouching ? data.crouchingColliderDesc : data.standingColliderDesc;
        data.activeCollider = this.rapierWorld.createCollider(desc, data.rigidBody);
      }

      // Compute kinematic horizontal acceleration
      const dt = 1 / NETWORK_RULES.serverTickRate;
      const { desiredVx, desiredVz, canSprint } = computeDesiredMovement(
        input,
        {
          x: player.x,
          y: player.y,
          z: player.z,
          vx: player.vx,
          vy: player.vy,
          vz: player.vz,
          yaw: input.yaw,
          pitch: input.pitch,
          isGrounded: data.isGrounded,
          isCrouching: player.isCrouching,
          isSprinting: player.isSprinting
        },
        dt
      );

      player.isSprinting = canSprint;

      const { vx, vz } = applyAcceleration(player.vx, player.vz, desiredVx, desiredVz, data.isGrounded, dt);
      player.vx = vx;
      player.vz = vz;

      // Vertical gravity & jumping
      if (data.isGrounded) {
        player.vy = 0;
        if (input.isJumping) {
          player.vy = Math.sqrt(2 * PLAYER_PHYSICS_RULES.gravity * PLAYER_PHYSICS_RULES.jumpHeight);
          data.isGrounded = false;
        }
      } else {
        player.vy -= PLAYER_PHYSICS_RULES.gravity * dt;
        player.vy = Math.max(-50, player.vy);
      }

      // Rapier Character step
      const movement = { x: player.vx * dt, y: player.vy * dt, z: player.vz * dt };
      data.characterController.computeColliderMovement(data.activeCollider, movement);
      const corrected = data.characterController.computedMovement();
      data.isGrounded = data.characterController.computedGrounded();

      const curTrans = data.rigidBody.translation();
      const nx = curTrans.x + corrected.x;
      const ny = curTrans.y + corrected.y;
      const nz = curTrans.z + corrected.z;

      // Speedhack validation & displacement clamping
      const { valid, clampedX, clampedZ } = antiCheat.validateSpeed(
        { x: curTrans.x, z: curTrans.z },
        { x: nx, z: nz },
        dt
      );
      const finalX = valid ? nx : clampedX;
      const finalZ = valid ? nz : clampedZ;

      data.rigidBody.setNextKinematicTranslation({ x: finalX, y: ny, z: finalZ });
      player.x = finalX;
      player.y = ny;
      player.z = finalZ;
    });

    // Authoritative Fire Intent & Lag Compensation
    this.onMessage('fire_intent', (client, msg: FireIntentMessage) => {
      const now = Date.now();
      if (!antiCheat.checkMessageRateLimit(client.sessionId, now)) return;
      this.processShot(client.sessionId, msg.weaponId, msg.origin, msg.direction, msg.timestamp, now);
    });

    // Authoritative Reload Request
    this.onMessage('reload_start', (client) => {
      const player = this.state.players.get(client.sessionId);
      const data = this.serverData.get(client.sessionId);
      if (!player || !data || !player.isAlive || player.isReloading) return;
      const weapon = WEAPONS[player.activeWeaponId as WeaponId];
      if (!weapon || player.ammoInMag >= weapon.magSize || player.ammoReserve <= 0) return;

      player.isReloading = true;
      const reloadDuration = player.ammoInMag === 0 ? weapon.reloadTimeEmpty : weapon.reloadTimeTactical;
      data.reloadEndTime = Date.now() + (reloadDuration * 1000);
    });

    // Authoritative Weapon Switch Request
    this.onMessage('switch_weapon', (client, weaponId: WeaponId) => {
      const player = this.state.players.get(client.sessionId);
      const data = this.serverData.get(client.sessionId);
      if (!player || !data || !player.isAlive) return;
      if (!WEAPONS[weaponId]) return;

      player.activeWeaponId = weaponId;
      player.isReloading = false;
      data.reloadEndTime = 0;
      data.lastFireTime = Date.now() + 200; // switch delay
    });

    // Dev-only feature: Fill lobby with 5v5 bots
    this.onMessage('dev_fill_bots', (client) => {
      if (client.sessionId === this.state.hostSessionId) {
        this.fillWithBots();
      }
    });

    this.onMessage('select_team', (client, team: 'alpha' | 'bravo') => {
      const player = this.state.players.get(client.sessionId);
      if (player && this.state.matchState === 'lobby') {
        player.team = team;
      }
    });

    this.onMessage('start_match', (client) => {
      if (client.sessionId === this.state.hostSessionId && this.state.matchState === 'lobby') {
        this.state.matchState = 'in_progress';
        this.state.timeRemaining = MATCH_RULES.timeLimitSeconds;
        console.log(`[WarehouseRoom ${this.state.roomCode}] Match started by host!`);
      }
    });

    this.onMessage('request_rematch', (client) => {
      if (client.sessionId === this.state.hostSessionId && this.state.matchState === 'match_end') {
        this.state.matchState = 'countdown';
        this.state.countdownRemaining = MATCH_RULES.countdownSeconds;
        this.state.alphaKills = 0;
        this.state.bravoKills = 0;
        this.state.winningTeam = '';
        this.state.timeRemaining = MATCH_RULES.timeLimitSeconds;

        for (const player of this.state.players.values()) {
          player.kills = 0;
          player.deaths = 0;
          player.assists = 0;
          player.headshots = 0;
          player.damage = 0;
          player.health = HEALTH_RULES.maxHealth;
          player.isAlive = true;
          player.isSpawnProtected = true;
          player.ammoInMag = 30;
          player.ammoReserve = 120;
          player.isReloading = false;
        }

        console.log(`[WarehouseRoom ${this.state.roomCode}] Rematch initiated by host!`);
      }
    });
  }

  onJoin(client: Client, options: JoinOptions) {
    const player = new PlayerSchema();
    player.id = client.id;
    player.sessionId = client.sessionId;

    let rawName = antiCheat.sanitizeNickname(options.nickname || 'Soldier');
    player.name = rawName;

    if (this.state.players.size === 0) {
      player.isHost = true;
      this.state.hostSessionId = client.sessionId;
    }

    // Auto-balance team
    const alphaCount = Array.from(this.state.players.values()).filter(p => p.team === 'alpha').length;
    const bravoCount = Array.from(this.state.players.values()).filter(p => p.team === 'bravo').length;
    player.team = alphaCount <= bravoCount ? 'alpha' : 'bravo';

    // Select optimal spawn point
    const spawn = this.selectSpawnPoint(player.team as 'alpha' | 'bravo');
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    player.yaw = spawn.yaw;

    // Create Rapier RigidBody on Server
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z);
    const rigidBody = this.rapierWorld.createRigidBody(bodyDesc);

    const radius = PLAYER_PHYSICS_RULES.capsuleRadius;
    const sHalf = (PLAYER_PHYSICS_RULES.standingCapsuleHeight - 2 * radius) / 2;
    const cHalf = (PLAYER_PHYSICS_RULES.crouchingCapsuleHeight - 2 * radius) / 2;

    const standingColliderDesc = RAPIER.ColliderDesc.capsule(sHalf, radius).setTranslation(0, sHalf + radius, 0);
    const crouchingColliderDesc = RAPIER.ColliderDesc.capsule(cHalf, radius).setTranslation(0, cHalf + radius, 0);

    const standingCollider = this.rapierWorld.createCollider(standingColliderDesc, rigidBody);
    const crouchingCollider = this.rapierWorld.createCollider(crouchingColliderDesc, rigidBody);

    const characterController = this.rapierWorld.createCharacterController(0.02);
    characterController.enableAutostep(PLAYER_PHYSICS_RULES.stepHeight, 0.2, true);
    characterController.enableSnapToGround(PLAYER_PHYSICS_RULES.stepHeight);
    characterController.setSlideEnabled(true);

    player.isSpawnProtected = true;
    const now = Date.now();

    this.serverData.set(client.sessionId, {
      characterController,
      rigidBody,
      standingColliderDesc,
      crouchingColliderDesc,
      activeCollider: standingCollider,
      lastDamageTime: now,
      lastFireTime: 0,
      spawnProtectionEndTime: now + MATCH_RULES.spawnProtectionSeconds * 1000,
      respawnTimer: 0,
      isGrounded: true,
      currentStreak: 0,
      deviceId: options.deviceId,
      damageHistory: []
    });

    this.state.players.set(client.sessionId, player);
    console.log(`[WarehouseRoom ${this.state.roomCode}] Player joined: ${player.name} (${player.team})`);
  }

  onLeave(client: Client, consented?: boolean) {
    console.log(`[WarehouseRoom ${this.state.roomCode}] Player left: ${client.sessionId}`);
    antiCheat.removeClient(client.sessionId);
    const data = this.serverData.get(client.sessionId);
    if (data) {
      this.rapierWorld.removeRigidBody(data.rigidBody);
      this.serverData.delete(client.sessionId);
    }
    this.lagCompensation.removePlayer(client.sessionId);
    this.state.players.delete(client.sessionId);

    // Host migration
    if (client.sessionId === this.state.hostSessionId && this.state.players.size > 0) {
      const nextHostSession = this.state.players.keys().next().value;
      if (nextHostSession) {
        this.state.hostSessionId = nextHostSession;
        const newHost = this.state.players.get(nextHostSession);
        if (newHost) newHost.isHost = true;
      }
    }
  }

  update(deltaTime: number) {
    const tickStart = performance.now();
    this.state.serverTick++;
    const now = Date.now();
    const dtSeconds = deltaTime / 1000;

    // 1. Step Rapier physics world on server
    this.rapierWorld.step();

    // 2. Process each player (reloads, spawn protection, respawns, regen)
    for (const [sessionId, player] of this.state.players.entries()) {
      const data = this.serverData.get(sessionId);
      if (!data) continue;

      // Handle Reload completion
      if (player.isReloading && data.reloadEndTime && now >= data.reloadEndTime) {
        player.isReloading = false;
        data.reloadEndTime = 0;
        const weapon = WEAPONS[player.activeWeaponId as WeaponId];
        if (weapon) {
          const needed = weapon.magSize - player.ammoInMag;
          const taken = Math.min(needed, player.ammoReserve);
          player.ammoInMag += taken;
          player.ammoReserve -= taken;
        }
      }

      // Record snapshot for lag compensation buffer
      this.lagCompensation.recordSnapshot(sessionId, {
        timestamp: now,
        x: player.x,
        y: player.y,
        z: player.z,
        isCrouched: player.isCrouching,
        isAlive: player.isAlive
      });

      // Spawn protection expiration
      if (player.isSpawnProtected && now >= data.spawnProtectionEndTime) {
        player.isSpawnProtected = false;
      }

      // Dead Player Respawn Countdown
      if (!player.isAlive) {
        data.respawnTimer -= dtSeconds;
        if (data.respawnTimer <= 0) {
          this.respawnPlayer(player, data, now);
        }
      } else {
        // Health Regeneration (5 HP/s after 6s no damage)
        if (player.health < HEALTH_RULES.maxHealth && (now - data.lastDamageTime) >= HEALTH_RULES.regenDelaySeconds * 1000) {
          player.health = Math.min(HEALTH_RULES.maxHealth, player.health + HEALTH_RULES.regenRatePerSecond * dtSeconds);
        }
      }
    }

    // 3. Dev Bots AI loop (simple autonomous patrol and engagement)
    if (this.state.matchState === 'in_progress') {
      for (const [sessionId, player] of this.state.players.entries()) {
        const data = this.serverData.get(sessionId);
        if (!data || !data.isBot || !player.isAlive) continue;

        // Find nearest living enemy
        let nearestEnemy: PlayerSchema | null = null;
        let minDist = Infinity;
        for (const [otherId, other] of this.state.players.entries()) {
          if (otherId === sessionId || !other.isAlive || other.team === player.team) continue;
          const d = Math.hypot(other.x - player.x, other.z - player.z);
          if (d < minDist) {
            minDist = d;
            nearestEnemy = other;
          }
        }

        if (nearestEnemy) {
          const dx = nearestEnemy.x - player.x;
          const dz = nearestEnemy.z - player.z;
          player.yaw = Math.atan2(-dx, -dz);

          // Move toward enemy if beyond 8m
          if (minDist > 8) {
            const moveSpeed = PLAYER_PHYSICS_RULES.walkSpeed;
            const normX = dx / minDist;
            const normZ = dz / minDist;
            const moveStep = { x: normX * moveSpeed * dtSeconds, y: -9.8 * dtSeconds, z: normZ * moveSpeed * dtSeconds };
            data.characterController.computeColliderMovement(data.activeCollider, moveStep);
            const corrected = data.characterController.computedMovement();
            const curTrans = data.rigidBody.translation();
            const nx = curTrans.x + corrected.x;
            const ny = curTrans.y + corrected.y;
            const nz = curTrans.z + corrected.z;
            data.rigidBody.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
            player.x = nx;
            player.y = ny;
            player.z = nz;
          }

          // Bot shooting if in range (< 32m) and cooldown elapsed
          if (minDist < 32 && now - data.lastFireTime >= 450) {
            if (player.ammoInMag <= 0) {
              if (!player.isReloading) {
                player.isReloading = true;
                data.reloadEndTime = now + 2500;
              }
            } else {
              const aimDir = {
                x: dx / minDist + (Math.random() - 0.5) * 0.08,
                y: (nearestEnemy.y + 1.2 - (player.y + 1.5)) / minDist + (Math.random() - 0.5) * 0.06,
                z: dz / minDist + (Math.random() - 0.5) * 0.08
              };
              const mag = Math.hypot(aimDir.x, aimDir.y, aimDir.z);
              aimDir.x /= mag;
              aimDir.y /= mag;
              aimDir.z /= mag;

              this.processShot(
                sessionId,
                player.activeWeaponId as WeaponId,
                { x: player.x, y: player.y + 1.5, z: player.z },
                aimDir,
                now,
                now
              );
            }
          }
        }
      }
    }

    // 4. Match Timer
    if (this.state.matchState === 'in_progress') {
      this.state.timeRemaining -= dtSeconds;
      if (this.state.timeRemaining <= 0) {
        this.state.matchState = 'match_end';
        if (this.state.alphaKills > this.state.bravoKills) this.state.winningTeam = 'alpha';
        else if (this.state.bravoKills > this.state.alphaKills) this.state.winningTeam = 'bravo';
        else this.state.matchState = 'sudden_death'; // Ties go to sudden death per spec
      }
    }

    this.lastTickDurationMs = performance.now() - tickStart;
  }

  public fillWithBots() {
    const botNames = ['Ghost', 'Soap', 'Price', 'Roach', 'Gaz', 'Yuri', 'Frost', 'Sandman', 'Grinch', 'Truck'];
    let idx = 0;

    while (this.state.players.size < MATCH_RULES.maxPlayers) {
      const botSessionId = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const alphaCount = Array.from(this.state.players.values()).filter(p => p.team === 'alpha').length;
      const bravoCount = Array.from(this.state.players.values()).filter(p => p.team === 'bravo').length;
      const team: 'alpha' | 'bravo' = alphaCount <= bravoCount ? 'alpha' : 'bravo';

      const botName = `[BOT] ${botNames[idx % botNames.length]}`;
      idx++;

      this.createBotPlayer(botSessionId, botName, team);
    }
  }

  private createBotPlayer(sessionId: string, name: string, team: 'alpha' | 'bravo') {
    const player = new PlayerSchema();
    player.id = sessionId;
    player.sessionId = sessionId;
    player.name = name;
    player.team = team;
    player.primaryWeaponId = 'm416';
    player.activeWeaponId = 'm416';
    player.ammoInMag = 30;
    player.ammoReserve = 120;
    player.health = 100;
    player.isAlive = true;
    player.isSpawnProtected = true;

    const spawn = this.selectSpawnPoint(team);
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    player.yaw = spawn.yaw;

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z);
    const rigidBody = this.rapierWorld.createRigidBody(bodyDesc);

    const radius = PLAYER_PHYSICS_RULES.capsuleRadius;
    const sHalf = (PLAYER_PHYSICS_RULES.standingCapsuleHeight - 2 * radius) / 2;
    const cHalf = (PLAYER_PHYSICS_RULES.crouchingCapsuleHeight - 2 * radius) / 2;

    const standingColliderDesc = RAPIER.ColliderDesc.capsule(sHalf, radius).setTranslation(0, sHalf + radius, 0);
    const crouchingColliderDesc = RAPIER.ColliderDesc.capsule(cHalf, radius).setTranslation(0, cHalf + radius, 0);

    const standingCollider = this.rapierWorld.createCollider(standingColliderDesc, rigidBody);

    const characterController = this.rapierWorld.createCharacterController(0.02);
    characterController.enableAutostep(PLAYER_PHYSICS_RULES.stepHeight, 0.2, true);
    characterController.enableSnapToGround(PLAYER_PHYSICS_RULES.stepHeight);
    characterController.setSlideEnabled(true);

    const now = Date.now();
    this.serverData.set(sessionId, {
      characterController,
      rigidBody,
      standingColliderDesc,
      crouchingColliderDesc,
      activeCollider: standingCollider,
      lastDamageTime: now,
      lastFireTime: 0,
      spawnProtectionEndTime: now + MATCH_RULES.spawnProtectionSeconds * 1000,
      respawnTimer: 0,
      isGrounded: true,
      currentStreak: 0,
      damageHistory: [],
      isBot: true
    });

    this.state.players.set(sessionId, player);
    console.log(`[WarehouseRoom ${this.state.roomCode}] Added Dev Bot: ${name} (${team})`);
  }

  private processShot(
    shooterSessionId: string,
    weaponId: WeaponId,
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    timestamp: number,
    now: number
  ) {
    const shooter = this.state.players.get(shooterSessionId);
    const shooterData = this.serverData.get(shooterSessionId);
    if (!shooter || !shooterData || !shooter.isAlive || shooter.isSprinting || shooter.isReloading) return;

    const weapon = WEAPONS[weaponId];
    if (!weapon) return;

    // Cancel shooter's spawn protection on firing (per spec)
    if (shooter.isSpawnProtected) {
      shooter.isSpawnProtected = false;
      shooterData.spawnProtectionEndTime = 0;
    }

    // Rate limiting / cooldown check
    if (now - shooterData.lastFireTime < (weapon.fireInterval * 1000 * 0.85)) {
      return; // anti-cheat fire rate violation
    }
    shooterData.lastFireTime = now;

    // Check Ammo
    if (shooter.ammoInMag <= 0) return;
    shooter.ammoInMag--;

    // Perform Server-Side Lag Rewind against all other players
    let closestHit: { victim: PlayerSchema; isHeadshot: boolean; dist: number } | null = null;

    for (const [victimSessionId, victim] of this.state.players.entries()) {
      if (victimSessionId === shooterSessionId || !victim.isAlive) continue;

      // Friendly fire check
      if (!MATCH_RULES.friendlyFire && victim.team === shooter.team) continue;

      // Spawn protection check
      if (victim.isSpawnProtected) continue;

      // Rewind victim to client perceived time
      const rewound = this.lagCompensation.getRewoundPosition(victimSessionId, timestamp, now);
      if (!rewound) continue;

      const rayResult = this.lagCompensation.raycastTarget(origin, direction, rewound);
      if (rayResult.hit) {
        if (!closestHit || rayResult.distance < closestHit.dist) {
          closestHit = { victim, isHeadshot: rayResult.isHeadshot, dist: rayResult.distance };
        }
      }
    }

    // Resolve Hit Result
    if (closestHit) {
      const victim = closestHit.victim;
      const victimData = this.serverData.get(victim.sessionId);
      if (!victimData) return;

      // Calculate Damage with falloff
      let damage = closestHit.isHeadshot ? weapon.damage.head : weapon.damage.body;
      if (weapon.damage.falloffStartMeters && closestHit.dist > weapon.damage.falloffStartMeters) {
        damage = Math.round(damage * (weapon.damage.falloffMultiplier || 1.0));
      }

      // Apply Damage
      victim.health = Math.max(0, victim.health - damage);
      victimData.lastDamageTime = now;
      victimData.damageHistory.push({ attackerId: shooterSessionId, amount: damage, timestamp: now });

      shooter.damage += damage;
      if (closestHit.isHeadshot) shooter.headshots++;

      let isKill = false;
      let streakText: string | undefined;

      if (victim.health <= 0) {
        isKill = true;
        victim.isAlive = false;
        victim.deaths++;
        shooter.kills++;
        shooterData.currentStreak++;
        victimData.currentStreak = 0;
        victimData.respawnTimer = MATCH_RULES.respawnDelaySeconds;

        // Streak announcements (Section 3.4)
        if (shooterData.currentStreak === 3) streakText = 'KILLING SPREE (3 STREAK)!';
        else if (shooterData.currentStreak === 5) streakText = 'RAMPAGE (5 STREAK)!';
        else if (shooterData.currentStreak >= 7 && shooterData.currentStreak % 2 === 1) streakText = `UNSTOPPABLE (${shooterData.currentStreak} STREAK)!`;

        // Assist check: >= 30 damage within last 5000 ms before kill (Section 3.4)
        const fiveSecAgo = now - 5000;
        const assistMap = new Map<string, number>();
        for (const dh of victimData.damageHistory) {
          if (dh.timestamp >= fiveSecAgo && dh.attackerId !== shooterSessionId) {
            assistMap.set(dh.attackerId, (assistMap.get(dh.attackerId) || 0) + dh.amount);
          }
        }
        for (const [attackerId, totalDmg] of assistMap.entries()) {
          if (totalDmg >= 30) {
            const assister = this.state.players.get(attackerId);
            if (assister) {
              assister.assists++;
              console.log(`[WarehouseRoom] Assist awarded to: ${assister.name} (${totalDmg} dmg)`);
            }
          }
        }
        victimData.damageHistory = [];

        // Team Score
        if (shooter.team === 'alpha') this.state.alphaKills++;
        else this.state.bravoKills++;

        // Broadcast Kill Feed event
        this.broadcast('kill_feed_event', {
          killerName: shooter.name,
          killerTeam: shooter.team,
          victimName: victim.name,
          victimTeam: victim.team,
          weaponId: weapon.id,
          isHeadshot: closestHit.isHeadshot,
          streak: streakText
        });

        // Check Win Condition
        if (this.state.alphaKills >= MATCH_RULES.scoreLimit) {
          this.state.matchState = 'match_end';
          this.state.winningTeam = 'alpha';
        } else if (this.state.bravoKills >= MATCH_RULES.scoreLimit) {
          this.state.matchState = 'match_end';
          this.state.winningTeam = 'bravo';
        }
      }

      // Broadcast hit event
      const hitEvent: HitEventMessage = {
        shooterId: shooterSessionId,
        shooterName: shooter.name,
        victimId: victim.sessionId,
        victimName: victim.name,
        victimTeam: victim.team as any,
        weaponId: weapon.id,
        damage,
        isHeadshot: closestHit.isHeadshot,
        isKill,
        victimHealth: victim.health
      };

      this.broadcast('hit_event', hitEvent);
    }
  }

  private selectSpawnPoint(team: 'alpha' | 'bravo'): SpawnPoint {
    const candidates = WAREHOUSE_MAP.spawns.filter(s => s.team === team || s.team === 'neutral');
    if (candidates.length === 0) return WAREHOUSE_MAP.spawns[0];

    // Pick spawn furthest from any enemy player
    let bestSpawn = candidates[0];
    let maxMinDist = -1;

    for (const spawn of candidates) {
      let minDistToEnemy = Infinity;
      for (const [_, other] of this.state.players.entries()) {
        if (other.isAlive && other.team !== team) {
          const d = Math.hypot(spawn.x - other.x, spawn.z - other.z);
          if (d < minDistToEnemy) minDistToEnemy = d;
        }
      }
      if (minDistToEnemy > maxMinDist) {
        maxMinDist = minDistToEnemy;
        bestSpawn = spawn;
      }
    }

    return bestSpawn;
  }

  private respawnPlayer(player: PlayerSchema, data: ServerPlayerData, now: number) {
    const spawn = this.selectSpawnPoint(player.team as 'alpha' | 'bravo');
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    player.yaw = spawn.yaw;
    player.health = HEALTH_RULES.maxHealth;
    player.isAlive = true;
    player.isSpawnProtected = true;
    player.ammoInMag = WEAPONS[player.primaryWeaponId as keyof typeof WEAPONS]?.magSize || 30;

    data.spawnProtectionEndTime = now + MATCH_RULES.spawnProtectionSeconds * 1000;
    data.rigidBody.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true);

    this.broadcast('spawn_event', {
      playerId: player.sessionId,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      yaw: spawn.yaw,
      spawnProtectionUntil: data.spawnProtectionEndTime
    });
  }
}
