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

  // Upper body group for pitch tilting
  private upperBody: THREE.Group;
  public headMesh: THREE.Mesh;
  public torsoMesh: THREE.Mesh;
  public legsMesh: THREE.Mesh;
  private weaponMesh: THREE.Group;
  private shieldMesh: THREE.Mesh;

  // Nameplate
  private nameplateMesh: THREE.Mesh;

  // Interpolation buffer
  private snapshots: StateSnapshot[] = [];
  private interpolationDelayMs: number = 100;

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

    // Team Armor Colors
    const isAlpha = schema.team === 'alpha';
    const armorColor = isAlpha ? 0x1d4ed8 : 0xc2410c; // Blue vs Orange
    const accentColor = isAlpha ? 0x38bdf8 : 0xfb923c;
    const camoMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.1 });
    const armorMat = new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.5, metalness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, metalness: 0.2 });

    // 1. Lower Body / Legs
    const legsGeo = new THREE.BoxGeometry(0.44, 0.78, 0.28);
    this.legsMesh = new THREE.Mesh(legsGeo, camoMat);
    this.legsMesh.position.set(0, 0.39, 0);
    this.legsMesh.castShadow = true;
    this.legsMesh.userData = { remotePlayer: this, part: 'body' };
    this.group.add(this.legsMesh);

    // Combat Boots
    const bootGeo = new THREE.BoxGeometry(0.18, 0.16, 0.28);
    const leftBoot = new THREE.Mesh(bootGeo, darkMat);
    leftBoot.position.set(-0.12, 0.08, 0.04);
    const rightBoot = new THREE.Mesh(bootGeo, darkMat);
    rightBoot.position.set(0.12, 0.08, 0.04);
    this.group.add(leftBoot);
    this.group.add(rightBoot);

    // 2. Upper Body Group (Pivots at waist for looking up/down)
    this.upperBody = new THREE.Group();
    this.upperBody.position.set(0, 0.78, 0);
    this.group.add(this.upperBody);

    // Torso Under-suit
    const torsoGeo = new THREE.BoxGeometry(0.48, 0.58, 0.3);
    this.torsoMesh = new THREE.Mesh(torsoGeo, camoMat);
    this.torsoMesh.position.set(0, 0.29, 0);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.userData = { remotePlayer: this, part: 'body' };
    this.upperBody.add(this.torsoMesh);

    // Tactical Ballistic Vest (with team colors)
    const vestGeo = new THREE.BoxGeometry(0.52, 0.42, 0.34);
    const vest = new THREE.Mesh(vestGeo, armorMat);
    vest.position.set(0, 0.32, 0);
    vest.castShadow = true;
    this.upperBody.add(vest);

    // Ammo pouches on chest
    const pouchGeo = new THREE.BoxGeometry(0.11, 0.16, 0.08);
    const p1 = new THREE.Mesh(pouchGeo, darkMat);
    p1.position.set(-0.14, 0.24, 0.19);
    const p2 = new THREE.Mesh(pouchGeo, darkMat);
    p2.position.set(0, 0.24, 0.19);
    const p3 = new THREE.Mesh(pouchGeo, darkMat);
    p3.position.set(0.14, 0.24, 0.19);
    this.upperBody.add(p1, p2, p3);

    // 3. Head & Tactical Helmet
    const headGeo = new THREE.SphereGeometry(0.17, 16, 16);
    this.headMesh = new THREE.Mesh(headGeo, darkMat);
    this.headMesh.position.set(0, 0.72, 0);
    this.headMesh.castShadow = true;
    this.headMesh.userData = { remotePlayer: this, part: 'head' };
    this.upperBody.add(this.headMesh);

    // Combat Helmet with team stripe
    const helmetGeo = new THREE.SphereGeometry(0.19, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.7);
    const helmet = new THREE.Mesh(helmetGeo, armorMat);
    helmet.position.set(0, 0.74, 0);
    this.upperBody.add(helmet);

    // Night vision mount & goggles visor
    const visorGeo = new THREE.BoxGeometry(0.24, 0.07, 0.1);
    const visorMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.2, metalness: 0.8 });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.73, 0.14);
    this.upperBody.add(visor);

    // 4. Weapon held in hands
    this.weaponMesh = this.buildWeaponMesh();
    this.weaponMesh.position.set(0.18, 0.32, -0.32);
    this.upperBody.add(this.weaponMesh);

    // 5. Spawn protection shield aura
    const shieldGeo = new THREE.SphereGeometry(1.15, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25, wireframe: true });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.set(0, 1.0, 0);
    this.shieldMesh.visible = schema.isSpawnProtected;
    this.group.add(this.shieldMesh);

    // 6. Nameplate
    this.nameplateMesh = this.createNameplate(schema.name, schema.team);
    this.group.add(this.nameplateMesh);

    this.group.position.set(schema.x, schema.y, schema.z);
    this.pushSnapshot(schema);
  }

  private buildWeaponMesh(): THREE.Group {
    const root = new THREE.Group();
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.25 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.45), gunMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8), gunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.35);
    root.add(body, barrel);
    return root;
  }

  private createNameplate(name: string, team: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
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
  }

  public update(now: number, cameraPosition: THREE.Vector3) {
    this.nameplateMesh.lookAt(cameraPosition.x, this.nameplateMesh.position.y + this.group.position.y, cameraPosition.z);

    if (this.snapshots.length === 0) return;

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
    } else {
      const latest = this.snapshots[this.snapshots.length - 1];
      this.position.set(latest.x, latest.y, latest.z);
      this.yaw = latest.yaw;
      this.pitch = latest.pitch;
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    this.upperBody.rotation.x = this.pitch; // Smooth aim pitch tracking

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
