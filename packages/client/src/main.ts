import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { WAREHOUSE_MAP } from '@warehouse-strike/shared';
import { InputManager } from './core/InputManager';
import { RealisticWarehouse } from './world/RealisticWarehouse';
import { CharacterController } from './core/CharacterController';
import { Viewmodel } from './rendering/Viewmodel';
import { SoldierCharacter } from './rendering/SoldierCharacter';
import { DebugOverlay } from './ui/DebugOverlay';
import { AudioEngine } from './audio/AudioEngine';
import { MovementAudio } from './audio/MovementAudio';
import { VFXManager } from './rendering/VFXManager';
import { WeaponManager } from './weapons/WeaponManager';
import { TargetDummy } from './entities/TargetDummy';
import { WeaponHUD } from './ui/WeaponHUD';
import { NetworkController } from './net/NetworkController';
import { RoomLobby } from './ui/RoomLobby';
import { MatchHeaderHUD } from './ui/MatchHeaderHUD';
import { KillFeed, KillFeedItem } from './ui/KillFeed';
import { Scoreboard } from './ui/Scoreboard';
import { MatchEndScreen } from './ui/MatchEndScreen';
import { PauseMenu } from './ui/PauseMenu';
import { PostprocessingManager } from './rendering/PostprocessingManager';
import { SettingsModal } from './ui/SettingsModal';
import { LoadingScreen } from './ui/LoadingScreen';
import { settingsManager } from './settings/SettingsManager';

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem('warehouse_strike_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem('warehouse_strike_device_id', id);
  }
  return id;
}

async function bootstrap() {
  console.log('[Warehouse Strike] Initializing Phase 8 Settings & Polish...');
  const loadingScreen = new LoadingScreen();
  loadingScreen.setProgress(15, 'INITIALIZING RAPIER WASM...');

  await RAPIER.init();
  loadingScreen.setProgress(35, 'SETTING UP WEBGL2 RENDERER...');

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const clickToPlayEl = document.getElementById('click-to-play');
  const connStatusEl = document.getElementById('connection-status');
  const roomInfoEl = document.getElementById('room-info');

  const deviceId = getOrCreateDeviceId();

  // WebGL2 Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Scene & Camera - High-Contrast Morning Atmosphere
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x38bdf8);
  scene.fog = new THREE.FogExp2(0xb45309, 0.0008);

  const initialFOV = settingsManager.current.video.fov || 90;
  const camera = new THREE.PerspectiveCamera(initialFOV, window.innerWidth / window.innerHeight, 0.01, 500);
  scene.add(camera);

  // Rapier Physics
  const rapierWorld = new RAPIER.World({ x: 0, y: -24.0, z: 0 });

  // Realistic Big Map PvP Arena
  loadingScreen.setProgress(55, 'LOADING BIG MAP PVP ARENA & 3D ASSETS...');
  const warehouse = new RealisticWarehouse(scene, rapierWorld);
  await warehouse.build();

  // Generate realistic PBR environment reflections from sunrise sky
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  scene.environment = pmremGenerator.fromScene(scene, 0.04).texture;

  // Postprocessing Chain (ACES Filmic, Unreal Bloom)
  loadingScreen.setProgress(75, 'INITIALIZING POSTPROCESSING & AUDIO...');
  const postprocessing = new PostprocessingManager(renderer, scene, camera);

  // Audio Engine & 3D Movement Soundscape
  const audio = new AudioEngine();
  const movementAudio = new MovementAudio(audio);
  const vfx = new VFXManager(scene);

  // Target Dummies placed throughout Big Map PvP Arena (in clear open areas)
  const dummies: TargetDummy[] = [
    new TargetDummy(scene, 'dummy_alpha_front', 0.0, 1.0, 12.0, 0),
    new TargetDummy(scene, 'dummy_bravo_front', 0.0, 1.0, 28.0, Math.PI),
    new TargetDummy(scene, 'dummy_west_corridor', -15.0, 1.0, 21.5, Math.PI / 2),
    new TargetDummy(scene, 'dummy_east_corridor', 15.0, 1.0, 21.5, -Math.PI / 2),
    new TargetDummy(scene, 'dummy_alpha_flank', -7.5, 1.0, 12.0, 0)
  ];

  // Character Controller
  const startSpawn = WAREHOUSE_MAP.spawns[0];
  const charController = new CharacterController(rapierWorld, camera, startSpawn.x, startSpawn.y, startSpawn.z);

  // Viewmodel & Local 3D Soldier Model
  const viewmodel = new Viewmodel(camera);
  const localSoldier = new SoldierCharacter('alpha');
  scene.add(localSoldier.group);
  localSoldier.group.visible = false;

  // Input Manager
  const inputManager = new InputManager(canvas);
  inputManager.setLook(startSpawn.yaw, 0);

  // Weapons & HUD
  const weaponManager = new WeaponManager(camera, audio, vfx);
  const weaponHUD = new WeaponHUD();
  weaponManager.onHit = (result) => weaponHUD.showHit(result);

  // Phase 5 UI Elements
  const matchHeader = new MatchHeaderHUD();
  const killFeed = new KillFeed();
  const scoreboard = new Scoreboard();
  const matchEndScreen = new MatchEndScreen();
  const pauseMenu = new PauseMenu(canvas);
  const roomLobby = new RoomLobby();
  const settingsModal = new SettingsModal();

  // Settings Buttons
  pauseMenu.onOpenSettings = () => settingsModal.show();
  roomLobby.onOpenSettings = () => settingsModal.show();

  // Apply Live Settings Updates
  settingsManager.subscribe((s) => {
    weaponManager.baseFOV = s.video.fov;
    camera.fov = s.video.fov;
    camera.updateProjectionMatrix();
    postprocessing.setPreset(s.video.preset);
    audio.settings.masterVolume = s.audio.master;
    audio.settings.sfxVolume = s.audio.sfx;
    audio.settings.footstepsVolume = s.audio.footsteps;
    audio.settings.hitVolume = s.audio.hit;
  });

  // Input Callbacks
  weaponManager.onReloadStart = (isEmpty: boolean) => {
    networkController.sendReload();
    viewmodel.playReload(isEmpty);
  };
  inputManager.onReload = () => {
    weaponManager.startReload();
  };
  inputManager.onSlot1 = () => {
    weaponManager.switchSlot(1);
    viewmodel.setWeapon(weaponManager.activeWeapon.id);
    networkController.sendSwitchWeapon(weaponManager.activeWeapon.id);
  };
  inputManager.onSlot2 = () => {
    weaponManager.switchSlot(2);
    viewmodel.setWeapon(weaponManager.activeWeapon.id);
    networkController.sendSwitchWeapon(weaponManager.activeWeapon.id);
  };
  inputManager.onSwapPrimary = () => {
    weaponManager.togglePrimaryWeapon();
    viewmodel.setWeapon(weaponManager.activeWeapon.id);
    networkController.sendSwitchWeapon(weaponManager.activeWeapon.id);
  };
  inputManager.onToggleZoom = () => weaponManager.toggleOperatorZoom();
  inputManager.onTogglePerspective = () => {
    charController.isThirdPerson = !charController.isThirdPerson;
    console.log('[Camera] Perspective toggled:', charController.isThirdPerson ? 'Third Person' : 'First Person');
  };

  // Dev Bot Fill (Lobby button or F4 shortcut)
  roomLobby.onFillBots = () => networkController.sendFillBots();
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F4') {
      networkController.sendFillBots();
      console.log('[Dev] Requested bot fill for room (5v5)');
    }
  });

  // Debug Overlay (F3)
  const debugOverlay = new DebugOverlay(renderer);
  inputManager.onDebugToggle = () => debugOverlay.toggle();

  // Network Controller
  const networkController = new NetworkController(scene, charController, audio);
  let localPlayerName = 'Soldier';
  let lastCountdownSec = -1;

  try {
    if (connStatusEl) connStatusEl.innerText = 'Connecting to room...';
    const room = await networkController.connect();
    roomLobby.bindRoom(room);
    matchEndScreen.bindRoom(room);
    loadingScreen.finish();

    if (connStatusEl) connStatusEl.innerText = `Connected (${room.sessionId})`;
    if (roomInfoEl) roomInfoEl.innerText = `Room: ${room.state.roomCode} | Realistic PBR Warehouse`;

    room.onMessage('kill_feed_event', (item: KillFeedItem) => {
      killFeed.addEntry(item, localPlayerName);
    });

    room.onStateChange((state) => {
      const me = state.players.get(room.sessionId);
      if (me) localPlayerName = me.name;

      // Audio countdown beeps
      if (state.matchState === 'countdown') {
        const sec = Math.ceil(state.countdownRemaining);
        if (sec !== lastCountdownSec) {
          lastCountdownSec = sec;
          if (sec <= 3 && sec > 0) audio.playCountdownBeep(false);
          else if (sec === 0) {
            audio.playCountdownBeep(true);
            audio.playMatchStartStinger();
          }
        }
      }

      matchHeader.update(state);
      scoreboard.update(state, room.sessionId);

      if (roomInfoEl) {
        roomInfoEl.innerText = `Room: ${state.roomCode} | State: ${state.matchState} | Score: [Alpha ${state.alphaKills} - Bravo ${state.bravoKills}]`;
      }
    });

    networkController.onHitEvent = (event) => {
      if (event.shooterId === room.sessionId) {
        weaponHUD.showHit({
          hit: true,
          isHeadshot: event.isHeadshot,
          damage: event.damage,
          remainingHealth: event.victimHealth,
          isKilled: event.isKill,
          point: new THREE.Vector3()
        });
      }
    };
  } catch (err) {
    console.error('[Network] Connection failed:', err);
    if (connStatusEl) connStatusEl.innerText = 'Offline Mode';
  }

  // Resize handling
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    postprocessing.resize(window.innerWidth, window.innerHeight);
  });

  // Render Loop
  let lastTime = performance.now();
  let clientTick = 0;
  const _aimDir = new THREE.Vector3();

  function renderLoop() {
    requestAnimationFrame(renderLoop);

    const now = performance.now();
    let dt = (now - lastTime) / 1000;
    lastTime = now;

    dt = Math.min(0.05, Math.max(0.001, dt));
    clientTick++;

    if (clickToPlayEl) {
      clickToPlayEl.style.opacity = inputManager.isLocked && !pauseMenu.isVisible ? '0' : '1';
    }

    scoreboard.setVisible(inputManager.isTabDown);

    const input = inputManager.sampleInput(clientTick);

    let firedThisFrame = false;

    // Firing Logic (Sprint-to-fire shift and firing)
    if (input.isShooting && inputManager.isLocked && networkController.isLocalAlive && !pauseMenu.isVisible) {
      // Shooting while running initiates sprint-to-fire shift and auto-walk
      if (charController.isSprinting && !weaponManager.isSprintTransitioning) {
        charController.isSprinting = false;
        input.isSprinting = false;
      }
      const fired = weaponManager.tryFire(now, charController.isSprinting, dummies, warehouse.mapGroup);
      if (fired) {
        firedThisFrame = true;
        _aimDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
        networkController.sendFireIntent(weaponManager.activeWeapon.id, camera.position, _aimDir);
        viewmodel.playFire();
      }
    }

    // While shifting from sprint to fire, force player to auto-walk
    if (weaponManager.isSprintTransitioning) {
      charController.isSprinting = false;
      input.isSprinting = false;
    }

    // Recoil
    const effectivePitch = input.pitch + weaponManager.recoilSystem.currentPitchRecoil;
    const effectiveYaw = input.yaw + weaponManager.recoilSystem.currentYawRecoil;

    // Movement & Kinematics
    input.pitch = effectivePitch;
    input.yaw = effectiveYaw;
    charController.update(input, dt);

    networkController.sendInput(input);
    rapierWorld.step();

    const effectiveSprinting = charController.isSprinting && !weaponManager.isSprintTransitioning;

    weaponManager.update(
      dt,
      input.isAiming,
      charController.isCrouched,
      effectiveSprinting,
      charController.horizontalSpeed,
      dummies
    );

    viewmodel.setWeapon(weaponManager.activeWeapon.id);
    viewmodel.update(
      dt,
      charController.horizontalSpeed,
      charController.isGrounded,
      input.yaw,
      input.pitch,
      effectiveSprinting,
      weaponManager.isAiming,
      weaponManager.recoilSystem.viewmodelKickZ,
      weaponManager.recoilSystem.viewmodelKickPitch
    );

    // Update Local Soldier Character & Perspective Toggle
    localSoldier.group.position.copy(charController.position);
    localSoldier.group.rotation.y = input.yaw;
    localSoldier.group.visible = charController.isThirdPerson;
    viewmodel.group.visible = !charController.isThirdPerson;

    if (charController.isThirdPerson) {
      localSoldier.update(dt, {
        speed: charController.horizontalSpeed,
        isGrounded: charController.isGrounded,
        isCrouched: charController.isCrouched,
        isSprinting: effectiveSprinting,
        pitch: input.pitch,
        yaw: input.yaw,
        isAlive: networkController.isLocalAlive,
        isFiring: firedThisFrame
      });
    }

    // Update target dummies
    for (const d of dummies) {
      d.update(dt, camera.position);
    }

    networkController.update(Date.now(), camera.position);
    vfx.update(dt);

    // 10. Update 3D Audio Listener & Footsteps / Jump Sounds
    audio.updateListener(camera);
    movementAudio.update(dt, charController);

    // 11. Render through Postprocessing Composer
    postprocessing.render(dt * 1000);

    weaponHUD.update(dt, weaponManager);
    debugOverlay.update(charController);
  }

  renderLoop();
}

bootstrap().catch((err) => {
  console.error('[Warehouse Strike] Fatal error:', err);
});
