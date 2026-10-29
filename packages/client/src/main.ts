import * as THREE from 'three';
import { Client, Room } from 'colyseus.js';
import { WEAPONS, MATCH_RULES, WarehouseRoomState } from '@warehouse-strike/shared';

// Verify shared package imports
console.log('[Warehouse Strike] Loaded shared config:', {
  weapons: Object.keys(WEAPONS),
  matchRules: MATCH_RULES
});

// Setup Three.js WebGL Scene
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1117);
scene.fog = new THREE.FogExp2(0x0e1117, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0, 1.5, 0);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// Industrial Floor Grid
const gridHelper = new THREE.GridHelper(70, 70, 0x38bdf8, 0x1f2937);
gridHelper.position.y = 0;
scene.add(gridHelper);

const floorGeo = new THREE.PlaneGeometry(70, 45);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x161b22,
  roughness: 0.8,
  metalness: 0.2
});
const floorMesh = new THREE.Mesh(floorGeo, floorMat);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

// Center Prototype Crate
const crateGeo = new THREE.BoxGeometry(2, 2, 2);
const crateMat = new THREE.MeshStandardMaterial({
  color: 0x2563eb,
  roughness: 0.4,
  metalness: 0.6
});
const crate = new THREE.Mesh(crateGeo, crateMat);
crate.position.set(0, 1, 0);
crate.castShadow = true;
crate.receiveShadow = true;
scene.add(crate);

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// UI elements
const connStatusEl = document.getElementById('connection-status');
const roomInfoEl = document.getElementById('room-info');
const fpsEl = document.getElementById('dbg-fps');

// Setup Colyseus Client
const serverUrl = window.location.hostname === 'localhost' 
  ? 'ws://localhost:2567' 
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

const colyseusClient = new Client(serverUrl);

async function connectToServer() {
  try {
    if (connStatusEl) connStatusEl.innerText = 'Connecting to server...';
    const room: Room<WarehouseRoomState> = await colyseusClient.joinOrCreate<WarehouseRoomState>('warehouse_room', {
      nickname: 'Cadet_' + Math.floor(Math.random() * 1000)
    });

    if (connStatusEl) {
      connStatusEl.innerText = `Connected (ID: ${room.sessionId})`;
    }
    if (roomInfoEl) {
      roomInfoEl.innerText = `Room Code: ${room.state.roomCode} | Phase 1 Verified`;
    }

    room.onStateChange((state) => {
      if (roomInfoEl) {
        roomInfoEl.innerText = `Room: ${state.roomCode} | State: ${state.matchState} | Players: ${state.players.size}`;
      }
    });

    console.log('[Colyseus] Joined room successfully:', room.id, room.state.roomCode);
  } catch (err) {
    console.error('[Colyseus] Connection error:', err);
    if (connStatusEl) {
      connStatusEl.innerText = 'Server offline (run pnpm dev)';
    }
  }
}

connectToServer();

// Render loop & FPS calculation
let frameCount = 0;
let lastTime = performance.now();
let lastFpsTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  frameCount++;

  if (now - lastFpsTime >= 1000) {
    if (fpsEl) fpsEl.innerText = frameCount.toString();
    frameCount = 0;
    lastFpsTime = now;
  }

  // Smooth rotation for test object
  crate.rotation.y += 0.01;
  crate.rotation.x += 0.005;

  renderer.render(scene, camera);
}

animate();

