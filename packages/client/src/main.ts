import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { WAREHOUSE_MAP } from '@warehouse-strike/shared';
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
import { NetworkController } from './net/NetworkController';
import { RoomLobby } from './ui/RoomLobby';

async function bootstrap() {
  console.log('[Warehouse Strike] Initializing Phase 4 Authoritative Networking & Multiplayer...');
  await RAPIER.init();

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const clickToPlayEl = document.getElementById('click-to-play');
  const connStatusEl = document.getElementById('connection-status');
  const roomInfoEl = document.getElementById('room-info');

  // WebGL2 Renderer
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

  // Warehouse Map & Colliders
  const warehouse = new WarehouseWorld(scene, rapierWorld);
  await warehouse.build();

  // Audio Engine & VFX
  const audio = new ProceduralAudio();
  const vfx = new VFXManager(scene);

  // Target Dummies for solo target practice
  const dummies: TargetDummy[] = [
    new TargetDummy(scene, 'dummy_near', -18, 0, -10, Math.PI / 4),
    new TargetDummy(scene, 'dummy_center_mid', 0, 0, 0, Math.PI),
    new TargetDummy(scene, 'dummy_center_far', 16, 0, 0, Math.PI),
    new TargetDummy(scene, 'dummy_catwalk_sniper', 8, 3.5, 19.5, Math.PI),
    new TargetDummy(scene, 'dummy_office', 0, 0, -18, Math.PI / 2)
  ];

  // Character Controller
  const startSpawn = WAREHOUSE_MAP.spawns[0];
  const charController = new CharacterController(rapierWorld, camera, startSpawn.x, startSpawn.y, startSpawn.z);

  // Viewmodel
  const viewmodel = new Viewmodel(camera);

  // Input Manager
  const inputManager = new InputManager(canvas);
  inputManager.setLook(startSpawn.yaw, 0);

  // Debug Overlay (F3)
  const debugOverlay = new DebugOverlay(renderer);
  inputManager.onDebugToggle = () => debugOverlay.toggle();

  // Weapon System & HUD
  const weaponManager = new WeaponManager(camera, audio, vfx);
  const weaponHUD = new WeaponHUD();
  weaponManager.onHit = (result) => weaponHUD.showHit(result);

  // Input Callbacks
  inputManager.onReload = () => weaponManager.startReload();
  inputManager.onSlot1 = () => weaponManager.switchSlot(1);
  inputManager.onSlot2 = () => weaponManager.switchSlot(2);
  inputManager.onSwapPrimary = () => weaponManager.togglePrimaryWeapon();
  inputManager.onToggleZoom = () => weaponManager.toggleOperatorZoom();

  // Network Controller & Lobby
  const networkController = new NetworkController(scene, charController, audio);
  const roomLobby = new RoomLobby();

  try {
    if (connStatusEl) connStatusEl.innerText = 'Connecting to room...';
    const room = await networkController.connect();
    roomLobby.bindRoom(room);

    if (connStatusEl) connStatusEl.innerText = `Connected (${room.sessionId})`;
    if (roomInfoEl) roomInfoEl.innerText = `Room: ${room.state.roomCode} | 60Hz Netcode Active`;

    room.onStateChange((state) => {
      if (roomInfoEl) {
        roomInfoEl.innerText = `Room: ${state.roomCode} | State: ${state.matchState} | Score: [Alpha ${state.alphaKills} - Bravo ${state.bravoKills}]`;
      }
    });

    // Listen to authoritative hit events from server
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
  });

  // Render & Simulation Loop
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
    if (input.isShooting && inputManager.isLocked && networkController.isLocalAlive) {
      // Gather remote players meshes for local client raycast feedback
      const remoteMeshes: THREE.Mesh[] = [];
      for (const [_, remote] of networkController.remotePlayers.entries()) {
        if (remote.isAlive) {
          remoteMeshes.push(remote.headMesh, remote.torsoMesh, remote.legsMesh);
        }
      }

      const fired = weaponManager.tryFire(now, charController.isSprinting, dummies, warehouse.mapGroup);
      if (fired) {
        // Send authoritative fire intent to Colyseus server with camera aim direction
        const aimDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        networkController.sendFireIntent(weaponManager.activeWeapon.id, camera.position, aimDir);
      }
    }

    // 3. Apply Camera Recoil
    const effectivePitch = input.pitch + weaponManager.recoilSystem.currentPitchRecoil;
    const effectiveYaw = input.yaw + weaponManager.recoilSystem.currentYawRecoil;

    // 4. Update Character Controller (Client Prediction)
    input.pitch = effectivePitch;
    input.yaw = effectiveYaw;
    charController.update(input, dt);

    // 5. Send input stream to authoritative server
    networkController.sendInput(input);

    // 6. Step Local Rapier Physics World
    rapierWorld.step();

    // 7. Update Weapon Manager
    weaponManager.update(
      dt,
      input.isAiming,
      charController.isCrouched,
      charController.isSprinting,
      charController.horizontalSpeed,
      dummies
    );

    // 8. Update Viewmodel
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

    // 9. Update Network Controller (Entity Interpolation & Server Reconciliation)
    networkController.update(Date.now(), camera.position);

    // 10. Update VFX
    vfx.update(dt);

    // 11. Render 3D Scene
    renderer.render(scene, camera);

    // 12. Update Weapon HUD & Debug Overlay
    weaponHUD.update(dt, weaponManager);
    debugOverlay.update(charController);
  }

  renderLoop();
}

bootstrap().catch((err) => {
  console.error('[Warehouse Strike] Fatal error:', err);
});
