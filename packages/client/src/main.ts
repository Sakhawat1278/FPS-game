import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Client, Room } from 'colyseus.js';
import { WarehouseRoomState, WAREHOUSE_MAP } from '@warehouse-strike/shared';
import { InputManager } from './core/InputManager';
import { WarehouseWorld } from './world/WarehouseWorld';
import { CharacterController } from './core/CharacterController';
import { Viewmodel } from './rendering/Viewmodel';
import { DebugOverlay } from './ui/DebugOverlay';
import { ProceduralAudio } from './audio/ProceduralAudio';
import { VFXManager } from './rendering/VFXManager';
import { WeaponManager } from './weapons/WeaponManager';
import { TargetDummy } from './entities/TargetDummy';
import { WeaponHUD } from './ui/WeaponHUD';

async function bootstrap() {
  console.log('[Warehouse Strike] Initializing Phase 3 Weapons & Combat...');
  await RAPIER.init();

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const clickToPlayEl = document.getElementById('click-to-play');
  const connStatusEl = document.getElementById('connection-status');
  const roomInfoEl = document.getElementById('room-info');

  // Setup WebGL2 Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Scene & Camera
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1117);
  scene.fog = new THREE.FogExp2(0x0e1117, 0.016);

  const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.05, 500);
  scene.add(camera);

  // Physics World (Gravity: -24 m/s^2)
  const rapierWorld = new RAPIER.World({ x: 0, y: -24.0, z: 0 });

  // Build Warehouse Map & Colliders
  const warehouse = new WarehouseWorld(scene, rapierWorld);
  await warehouse.build();

  // Audio Engine
  const audio = new ProceduralAudio();

  // Visual Effects Manager (Tracers, Muzzle flash, Impacts)
  const vfx = new VFXManager(scene);

  // Target Dummies placed at strategic tactical combat ranges
  const dummies: TargetDummy[] = [
    new TargetDummy(scene, 'dummy_near', -18, 0, -10, Math.PI / 4), // Close range near spawn (10m)
    new TargetDummy(scene, 'dummy_center_mid', 0, 0, 0, Math.PI), // Mid-range center aisle (28m)
    new TargetDummy(scene, 'dummy_center_far', 16, 0, 0, Math.PI), // Far center aisle (44m)
    new TargetDummy(scene, 'dummy_catwalk_sniper', 8, 3.5, 19.5, Math.PI), // Elevated sniper dummy on catwalk!
    new TargetDummy(scene, 'dummy_office', 0, 0, -18, Math.PI / 2) // Close-quarters office dummy
  ];

  // Weapon System
  const weaponManager = new WeaponManager(camera, audio, vfx);

  // Weapon HUD & Reticle
  const weaponHUD = new WeaponHUD();
  weaponManager.onHit = (result) => weaponHUD.showHit(result);

  // Character Controller (West Alpha spawn)
  const startSpawn = WAREHOUSE_MAP.spawns[0];
  const charController = new CharacterController(rapierWorld, camera, startSpawn.x, startSpawn.y, startSpawn.z);

  // Viewmodel (Procedural M416 / Operator / Desert Eagle)
  const viewmodel = new Viewmodel(camera);

  // Input Manager
  const inputManager = new InputManager(canvas);
  inputManager.setLook(startSpawn.yaw, 0);

  // Input Callbacks
  inputManager.onReload = () => weaponManager.startReload();
  inputManager.onSlot1 = () => weaponManager.switchSlot(1);
  inputManager.onSlot2 = () => weaponManager.switchSlot(2);
  inputManager.onSwapPrimary = () => weaponManager.togglePrimaryWeapon();
  inputManager.onToggleZoom = () => weaponManager.toggleOperatorZoom();

  // Debug Overlay (F3)
  const debugOverlay = new DebugOverlay(renderer);
  inputManager.onDebugToggle = () => debugOverlay.toggle();

  // Resize handling
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Setup Colyseus Client
  const serverUrl = window.location.hostname === 'localhost'
    ? 'ws://localhost:2567'
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

  const colyseusClient = new Client(serverUrl);

  try {
    if (connStatusEl) connStatusEl.innerText = 'Connecting to server...';
    const room: Room<WarehouseRoomState> = await colyseusClient.joinOrCreate<WarehouseRoomState>('warehouse_room', {
      nickname: 'Gunner_1'
    });

    if (connStatusEl) connStatusEl.innerText = `Connected (${room.sessionId})`;
    if (roomInfoEl) roomInfoEl.innerText = `Room: ${room.state.roomCode} | Phase 3 Weapons Verified`;

    room.onStateChange((state) => {
      if (roomInfoEl) {
        roomInfoEl.innerText = `Room: ${state.roomCode} | State: ${state.matchState} | Players: ${state.players.size}`;
      }
    });
  } catch (err) {
    console.warn('[Colyseus] Running offline:', err);
    if (connStatusEl) connStatusEl.innerText = 'Offline Mode (Standalone Combat Sandbox)';
  }

  // Animation & Physics Loop
  let lastTime = performance.now();
  let clientTick = 0;

  function renderLoop() {
    requestAnimationFrame(renderLoop);

    const now = performance.now();
    let dt = (now - lastTime) / 1000;
    lastTime = now;

    dt = Math.min(0.05, Math.max(0.001, dt));
    clientTick++;

    if (clickToPlayEl) {
      clickToPlayEl.style.opacity = inputManager.isLocked ? '0' : '1';
    }

    // 1. Sample player input
    const input = inputManager.sampleInput(clientTick);

    // 2. Weapon Firing Logic
    if (input.isShooting && inputManager.isLocked) {
      weaponManager.tryFire(now, charController.isSprinting, dummies, warehouse.mapGroup);
    }

    // 3. Apply Camera Recoil (adds upward pitch & horizontal kick)
    const effectivePitch = input.pitch + weaponManager.recoilSystem.currentPitchRecoil;
    const effectiveYaw = input.yaw + weaponManager.recoilSystem.currentYawRecoil;

    // 4. Update Character Controller
    // Pass effective look angles so camera and movement align
    input.pitch = effectivePitch;
    input.yaw = effectiveYaw;
    charController.update(input, dt);

    // 5. Step Physics World
    rapierWorld.step();

    // 6. Update Weapon Manager (ADS zoom, spread, reload timer, dummy updates)
    weaponManager.update(
      dt,
      input.isAiming,
      charController.isCrouched,
      charController.isSprinting,
      charController.horizontalSpeed,
      dummies
    );

    // 7. Update Viewmodel (3D gun mesh, sway, bob, recoil kick)
    viewmodel.setWeapon(weaponManager.activeWeapon.id);
    viewmodel.update(
      dt,
      charController.horizontalSpeed,
      charController.isGrounded,
      input.yaw,
      input.pitch,
      charController.isSprinting,
      weaponManager.isAiming,
      weaponManager.recoilSystem.viewmodelKickZ,
      weaponManager.recoilSystem.viewmodelKickPitch
    );

    // 8. Update Visual Effects (Tracers travel, impact sparks)
    vfx.update(dt);

    // 9. Render 3D Scene
    renderer.render(scene, camera);

    // 10. Update Weapon HUD (Ammo, dynamic crosshair spread, scope, hitmarkers)
    weaponHUD.update(dt, weaponManager);

    // 11. Update Debug Overlay
    debugOverlay.update(charController);
  }

  renderLoop();
}

bootstrap().catch((err) => {
  console.error('[Warehouse Strike] Fatal bootstrap error:', err);
});
