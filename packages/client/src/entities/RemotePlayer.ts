import * as THREE from 'three';
import { PlayerSchema } from '@warehouse-strike/shared';
import { SoldierCharacter } from '../rendering/SoldierCharacter';

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

  // 3D Winter Soldier Character with M416 and procedural skeletal animation
  public soldier: SoldierCharacter;

  // Invisible hitboxes for raycast damage detection
  public headMesh: THREE.Mesh;
  public torsoMesh: THREE.Mesh;
  public legsMesh: THREE.Mesh;
  private shieldMesh: THREE.Mesh;

  // Nameplate
  private nameplateMesh: THREE.Mesh;

  // Interpolation buffer
  private snapshots: StateSnapshot[] = [];
  private interpolationDelayMs: number = 100;

  public position = new THREE.Vector3();
  private prevPosition = new THREE.Vector3();
  private lastUpdateTime: number = 0;

  public yaw: number = 0;
  public pitch: number = 0;
  public isCrouched: boolean = false;
  public isAlive: boolean = true;
  public team: string = 'alpha';

  constructor(scene: THREE.Scene, schema: PlayerSchema) {
    this.scene = scene;
    this.sessionId = schema.sessionId;
    this.team = schema.team;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // 1. Attach 3D Winter Soldier Character Model
    this.soldier = new SoldierCharacter(schema.team);
    this.group.add(this.soldier.group);

    // 2. Invisible Raycast Hitboxes aligned with Winter Soldier skeleton
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });

    // Legs hitbox
    const legsGeo = new THREE.BoxGeometry(0.44, 0.78, 0.32);
    this.legsMesh = new THREE.Mesh(legsGeo, hitMat);
    this.legsMesh.position.set(0, 0.39, 0);
    this.legsMesh.userData = { remotePlayer: this, part: 'body' };
    this.group.add(this.legsMesh);

    // Torso hitbox
    const torsoGeo = new THREE.BoxGeometry(0.50, 0.60, 0.36);
    this.torsoMesh = new THREE.Mesh(torsoGeo, hitMat);
    this.torsoMesh.position.set(0, 1.07, 0);
    this.torsoMesh.userData = { remotePlayer: this, part: 'body' };
    this.group.add(this.torsoMesh);

    // Head hitbox (Precision headshot sphere)
    const headGeo = new THREE.SphereGeometry(0.19, 12, 12);
    this.headMesh = new THREE.Mesh(headGeo, hitMat);
    this.headMesh.position.set(0, 1.64, 0);
    this.headMesh.userData = { remotePlayer: this, part: 'head' };
    this.group.add(this.headMesh);

    // 3. Spawn protection shield aura
    const shieldGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const shieldColor = schema.team === 'alpha' ? 0x38bdf8 : 0xfb923c;
    const shieldMat = new THREE.MeshBasicMaterial({
      color: shieldColor,
      transparent: true,
      opacity: 0.28,
      wireframe: true
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.set(0, 1.0, 0);
    this.shieldMesh.visible = schema.isSpawnProtected;
    this.group.add(this.shieldMesh);

    // 4. Nameplate
    this.nameplateMesh = this.createNameplate(schema.name, schema.team);
    this.group.add(this.nameplateMesh);

    this.position.set(schema.x, schema.y, schema.z);
    this.prevPosition.copy(this.position);
    this.group.position.set(schema.x, schema.y, schema.z);
    this.pushSnapshot(schema);
  }

  private createNameplate(name: string, team: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
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
    mesh.position.set(0, 2.15, 0);
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

    if (this.snapshots.length > 20) this.snapshots.shift();
    this.shieldMesh.visible = schema.isSpawnProtected;
    this.isAlive = schema.isAlive;
    this.isCrouched = schema.isCrouching;
  }

  public update(now: number, cameraPosition: THREE.Vector3) {
    this.nameplateMesh.lookAt(cameraPosition.x, this.nameplateMesh.position.y + this.group.position.y, cameraPosition.z);

    if (this.snapshots.length === 0) return;

    let dt = this.lastUpdateTime > 0 ? (now - this.lastUpdateTime) / 1000 : 0.016;
    dt = Math.max(0.001, Math.min(0.1, dt));
    this.lastUpdateTime = now;

    const renderTime = now - this.interpolationDelayMs;

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
      this.isCrouched = alpha > 0.5 ? s1.isCrouched : s0.isCrouched;
    } else {
      const latest = this.snapshots[this.snapshots.length - 1];
      this.position.set(latest.x, latest.y, latest.z);
      this.yaw = latest.yaw;
      this.pitch = latest.pitch;
      this.isCrouched = latest.isCrouched;
    }

    // Calculate movement velocity
    const dx = this.position.x - this.prevPosition.x;
    const dz = this.position.z - this.prevPosition.z;
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    const calculatedSpeed = dt > 0 ? horizontalDistance / dt : 0;
    this.prevPosition.copy(this.position);

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;

    // Update Winter Soldier procedural kinematics (walk strides, sprint, crouch, aim pitch)
    this.soldier.update(dt, {
      speed: calculatedSpeed,
      isGrounded: true,
      isCrouched: this.isCrouched,
      isSprinting: calculatedSpeed > 5.0,
      pitch: this.pitch,
      yaw: this.yaw,
      isAlive: this.isAlive
    });
  }

  public destroy() {
    this.soldier.destroy();
    this.scene.remove(this.group);
  }
}
