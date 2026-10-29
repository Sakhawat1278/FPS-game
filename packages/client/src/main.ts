import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Client, Room } from 'colyseus.js';
import { WarehouseRoomState, WAREHOUSE_MAP } from '@warehouse-strike/shared';
import { InputManager } from './core/InputManager';
import { WarehouseWorld } from './world/WarehouseWorld';
import { CharacterController } from './core/CharacterController';
import { Viewmodel } from './rendering/Viewmodel';
import { DebugOverlay } from './ui/DebugOverlay';

async function bootstrap() {
  console.log('[Warehouse Strike] Initializing Rapier WASM physics...');
  await RAPIER.init();
  console.log('[Warehouse Strike] Rapier WASM loaded successfully!');

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
  scene.fog = new THREE.FogExp2(0x0e1117, 0.018);

  const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.05, 500);
  scene.add(camera);

  // Physics World (Gravity: -24 m/s^2)
  const rapierWorld = new RAPIER.World({ x: 0, y: -24.0, z: 0 });

  // Build Warehouse Map & Colliders
  const warehouse = new WarehouseWorld(scene, rapierWorld);
  await warehouse.build();

  // Character Controller & Spawn Selection (West Alpha spawn)
  const startSpawn = WAREHOUSE_MAP.spawns[0];
  const charController = new CharacterController(rapierWorld, camera, startSpawn.x, startSpawn.y, startSpawn.z);

  // Input Manager
  const inputManager = new InputManager(canvas);
  inputManager.setLook(startSpawn.yaw, 0);

  // Viewmodel (FP Gun & Arms)
  const viewmodel = new Viewmodel(camera);

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
      nickname: 'Alpha_1'
    });

    if (connStatusEl) connStatusEl.innerText = `Connected (${room.sessionId})`;
    if (roomInfoEl) roomInfoEl.innerText = `Room: ${room.state.roomCode} | Phase 2 Single-Player Core`;

    room.onStateChange((state) => {
      if (roomInfoEl) {
        roomInfoEl.innerText = `Room: ${state.roomCode} | State: ${state.matchState} | Players: ${state.players.size}`;
      }
    });
  } catch (err) {
    console.warn('[Colyseus] Server connection failed, running standalone offline mode:', err);
    if (connStatusEl) connStatusEl.innerText = 'Offline Mode (Standalone Single-Player)';
  }

  // Animation & Physics Loop
  let lastTime = performance.now();
  let clientTick = 0;

  function renderLoop() {
    requestAnimationFrame(renderLoop);

    const now = performance.now();
    let dt = (now - lastTime) / 1000;
    lastTime = now;

    // Clamp dt to avoid spiral of death on tab refocus
    dt = Math.min(0.05, Math.max(0.001, dt));
    clientTick++;

    // Update click to play banner
    if (clickToPlayEl) {
      clickToPlayEl.style.opacity = inputManager.isLocked ? '0' : '1';
    }

    // Sample player keyboard/mouse input
    const input = inputManager.sampleInput(clientTick);

    // Update Kinematic Character Physics
    charController.update(input, dt);

    // Step Rapier Physics World
    rapierWorld.step();

    // Update First-Person Viewmodel sway and bobbing
    viewmodel.update(
      dt,
      charController.horizontalSpeed,
      charController.isGrounded,
      input.yaw,
      input.pitch,
      charController.isSprinting
    );

    // Render 3D Scene
    renderer.render(scene, camera);

    // Update Debug Overlay telemetry
    debugOverlay.update(charController);
  }

  renderLoop();
}

bootstrap().catch((err) => {
  console.error('[Warehouse Strike] Fatal bootstrap error:', err);
});
