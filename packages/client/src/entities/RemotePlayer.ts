import * as THREE from 'three';
import { PlayerSchema } from '@warehouse-strike/shared';

interface StateSnapshot {
  timestamp: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  isCrouched: boolean;
  isAlive: boolean;
}

export class RemotePlayer {
  public sessionId: string;
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Visual Meshes
  public headMesh: THREE.Mesh;
  public torsoMesh: THREE.Mesh;
  public legsMesh: THREE.Mesh;
  private weaponMesh: THREE.Mesh;
  private shieldMesh: THREE.Mesh;

  // Overhead Tag
  private nameplateMesh: THREE.Mesh;

  // Snapshot Interpolation Buffer
  private snapshots: StateSnapshot[] = [];
  private interpolationDelayMs: number = 100; // ~100ms render buffer

  // Current interpolated values
  public position = new THREE.Vector3();
  public yaw: number = 0;
  public pitch: number = 0;
  public isAlive: boolean = true;
  public team: string = 'alpha';

  constructor(scene: THREE.Scene, schema: PlayerSchema) {
    this.scene = scene;
    this.sessionId = schema.sessionId;
    this.team = schema.team;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Team Accent Colors: Blue for Alpha, Orange for Bravo
    const teamColor = schema.team === 'alpha' ? 0x2563eb : 0xea580c;
    const bodyMat = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.6, metalness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7, metalness: 0.2 });

    // Legs
    const legsGeo = new THREE.BoxGeometry(0.44, 0.8, 0.28);
    this.legsMesh = new THREE.Mesh(legsGeo, darkMat);
    this.legsMesh.position.set(0, 0.4, 0);
    this.legsMesh.castShadow = true;
    this.legsMesh.userData = { remotePlayer: this, part: 'body' };
    this.group.add(this.legsMesh);

    // Torso / Body
    const torsoGeo = new THREE.BoxGeometry(0.5, 0.65, 0.32);
    this.torsoMesh = new THREE.Mesh(torsoGeo, bodyMat);
    this.torsoMesh.position.set(0, 1.125, 0);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.userData = { remotePlayer: this, part: 'body' };
    this.group.add(this.torsoMesh);

    // Head
    const headGeo = new THREE.SphereGeometry(0.18, 16, 16);
    this.headMesh = new THREE.Mesh(headGeo, bodyMat);
    this.headMesh.position.set(0, 1.62, 0);
    this.headMesh.castShadow = true;
    this.headMesh.userData = { remotePlayer: this, part: 'head' };
    this.group.add(this.headMesh);

    // Weapon held in hands
    const gunGeo = new THREE.BoxGeometry(0.08, 0.1, 0.55);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });
    this.weaponMesh = new THREE.Mesh(gunGeo, gunMat);
    this.weaponMesh.position.set(0.2, 1.15, -0.3);
    this.group.add(this.weaponMesh);

    // Spawn protection shield aura (semi-transparent glowing sphere)
    const shieldGeo = new THREE.SphereGeometry(1.1, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25,
      wireframe: true
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.set(0, 1.0, 0);
    this.shieldMesh.visible = schema.isSpawnProtected;
    this.group.add(this.shieldMesh);

    // Overhead Nameplate Canvas
    this.nameplateMesh = this.createNameplate(schema.name, schema.team);
    this.group.add(this.nameplateMesh);

    // Initial position
    this.group.position.set(schema.x, schema.y, schema.z);
    this.pushSnapshot(schema);
  }

  private createNameplate(name: string, team: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(17, 24, 39, 0.75)';
    ctx.roundRect(10, 10, 236, 44, 8);
    ctx.fill();

    ctx.fillStyle = team === 'alpha' ? '#60a5fa' : '#fb923c';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(name, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const planeGeo = new THREE.PlaneGeometry(0.8, 0.2);
    const planeMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(planeGeo, planeMat);
    mesh.position.set(0, 2.05, 0);
    return mesh;
  }

  public pushSnapshot(schema: PlayerSchema) {
    this.snapshots.push({
      timestamp: Date.now(),
      x: schema.x,
      y: schema.y,
      z: schema.z,
      yaw: schema.yaw,
      pitch: schema.pitch,
      isCrouched: schema.isCrouching,
      isAlive: schema.isAlive
    });

    // Keep up to 20 snapshots (~600ms)
    if (this.snapshots.length > 20) {
      this.snapshots.shift();
    }

    this.shieldMesh.visible = schema.isSpawnProtected;
    this.isAlive = schema.isAlive;
  }

  public update(now: number, cameraPosition: THREE.Vector3) {
    // Face nameplate to camera
    this.nameplateMesh.lookAt(cameraPosition.x, this.nameplateMesh.position.y + this.group.position.y, cameraPosition.z);

    if (this.snapshots.length === 0) return;

    // Render target time = 100 ms in the past (Entity Interpolation)
    const renderTime = now - this.interpolationDelayMs;

    // Find surrounding snapshots
    let s0: StateSnapshot | null = null;
    let s1: StateSnapshot | null = null;

    for (let i = 0; i < this.snapshots.length - 1; i++) {
      if (renderTime >= this.snapshots[i].timestamp && renderTime <= this.snapshots[i + 1].timestamp) {
        s0 = this.snapshots[i];
        s1 = this.snapshots[i + 1];
        break;
      }
    }

    if (s0 && s1) {
      const alpha = (renderTime - s0.timestamp) / (s1.timestamp - s0.timestamp);
      this.position.set(
        THREE.MathUtils.lerp(s0.x, s1.x, alpha),
        THREE.MathUtils.lerp(s0.y, s1.y, alpha),
        THREE.MathUtils.lerp(s0.z, s1.z, alpha)
      );
      this.yaw = THREE.MathUtils.lerp(s0.yaw, s1.yaw, alpha);
      this.pitch = THREE.MathUtils.lerp(s0.pitch, s1.pitch, alpha);
    } else {
      // Latest snapshot fallback
      const latest = this.snapshots[this.snapshots.length - 1];
      this.position.set(latest.x, latest.y, latest.z);
      this.yaw = latest.yaw;
      this.pitch = latest.pitch;
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;

    // Handle dead posture
    if (!this.isAlive) {
      this.group.rotation.x = -Math.PI / 2;
      this.group.position.y = 0.2;
    } else {
      this.group.rotation.x = 0;
    }
  }

  public destroy() {
    this.scene.remove(this.group);
  }
}
