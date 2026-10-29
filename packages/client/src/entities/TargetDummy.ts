import * as THREE from 'three';
import { SoldierCharacter } from '../rendering/SoldierCharacter';

export interface DummyHitResult {
  hit: boolean;
  isHeadshot: boolean;
  damage: number;
  remainingHealth: number;
  isKilled: boolean;
  point: THREE.Vector3;
}

export class TargetDummy {
  public group: THREE.Group;
  public id: string;
  public maxHealth: number = 100;
  public health: number = 100;
  public isAlive: boolean = true;

  // 3D Tactical Gear Soldier model with M416
  public soldier: SoldierCharacter;

  // Invisible Raycast Hitboxes
  public headMesh: THREE.Mesh;
  public bodyMesh: THREE.Mesh;
  public legsMesh: THREE.Mesh;

  // Floating Health Bar
  private healthBarMesh: THREE.Mesh;
  private healthBarBg: THREE.Mesh;

  // Respawn timer
  private respawnTimer: number = 0;
  private basePosition: THREE.Vector3;
  private baseRotation: THREE.Euler;

  constructor(scene: THREE.Scene, id: string, x: number, y: number, z: number, yaw: number = 0) {
    this.id = id;
    this.basePosition = new THREE.Vector3(x, y, z);
    this.baseRotation = new THREE.Euler(0, yaw, 0);

    this.group = new THREE.Group();
    this.group.position.copy(this.basePosition);
    this.group.rotation.copy(this.baseRotation);
    scene.add(this.group);

    // 1. Attach 3D Full Tactical Gear Soldier with M416 assault rifle
    this.soldier = new SoldierCharacter('bravo');
    this.group.add(this.soldier.group);

    // 2. Invisible Hitboxes aligned with 3D Tactical Soldier
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });

    // Legs
    const legsGeo = new THREE.BoxGeometry(0.44, 0.76, 0.32);
    this.legsMesh = new THREE.Mesh(legsGeo, hitMat);
    this.legsMesh.position.set(0, 0.44, 0);
    this.legsMesh.userData = { dummy: this, part: 'body' };
    this.group.add(this.legsMesh);

    // Torso / Ballistic Plate
    const bodyGeo = new THREE.BoxGeometry(0.52, 0.62, 0.34);
    this.bodyMesh = new THREE.Mesh(bodyGeo, hitMat);
    this.bodyMesh.position.set(0, 1.13, 0);
    this.bodyMesh.userData = { dummy: this, part: 'body' };
    this.group.add(this.bodyMesh);

    // Head (Headshot target sphere)
    const headGeo = new THREE.SphereGeometry(0.19, 12, 12);
    this.headMesh = new THREE.Mesh(headGeo, hitMat);
    this.headMesh.position.set(0, 1.62, 0);
    this.headMesh.userData = { dummy: this, part: 'head' };
    this.group.add(this.headMesh);

    // 3. Floating Health Bar
    const bgGeo = new THREE.PlaneGeometry(0.65, 0.08);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x0f172a, side: THREE.DoubleSide });
    this.healthBarBg = new THREE.Mesh(bgGeo, bgMat);
    this.healthBarBg.position.set(0, 2.05, 0);
    this.group.add(this.healthBarBg);

    const barGeo = new THREE.PlaneGeometry(0.63, 0.06);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
    this.healthBarMesh = new THREE.Mesh(barGeo, barMat);
    this.healthBarMesh.position.set(0, 2.05, 0.005);
    this.group.add(this.healthBarMesh);
  }

  public takeDamage(amount: number, isHeadshot: boolean, hitPoint: THREE.Vector3): DummyHitResult {
    if (!this.isAlive) {
      return { hit: false, isHeadshot: false, damage: 0, remainingHealth: 0, isKilled: false, point: hitPoint };
    }

    this.health = Math.max(0, this.health - amount);

    // Update health bar scale
    const healthPercent = this.health / this.maxHealth;
    this.healthBarMesh.scale.x = Math.max(0.001, healthPercent);
    this.healthBarMesh.position.x = -(0.63 * (1 - healthPercent)) / 2;

    // Color code health
    const mat = this.healthBarMesh.material as THREE.MeshBasicMaterial;
    if (healthPercent > 0.5) mat.color.setHex(0x10b981);
    else if (healthPercent > 0.25) mat.color.setHex(0xf59e0b);
    else mat.color.setHex(0xef4444);

    let isKilled = false;
    if (this.health <= 0) {
      isKilled = true;
      this.isAlive = false;
      this.respawnTimer = 3.0; // 3 seconds respawn
      this.soldier.update(0.016, {
        speed: 0,
        isGrounded: true,
        isCrouched: false,
        isSprinting: false,
        pitch: 0,
        isAlive: false
      });
      this.group.rotation.x = -Math.PI / 2;
      this.group.position.y = 0.2;
    }

    return {
      hit: true,
      isHeadshot,
      damage: amount,
      remainingHealth: this.health,
      isKilled,
      point: hitPoint
    };
  }

  public update(dt: number, cameraPosition: THREE.Vector3) {
    // Face health bar to camera
    this.healthBarBg.lookAt(cameraPosition.x, this.healthBarBg.position.y + this.group.position.y, cameraPosition.z);
    this.healthBarMesh.quaternion.copy(this.healthBarBg.quaternion);

    // Update 3D Tactical Soldier idle breathing & rifle stance
    if (this.isAlive) {
      this.soldier.update(dt, {
        speed: 0,
        isGrounded: true,
        isCrouched: false,
        isSprinting: false,
        pitch: 0,
        isAlive: true
      });
    }

    // Respawn countdown
    if (!this.isAlive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
    }
  }

  public respawn() {
    this.isAlive = true;
    this.health = this.maxHealth;
    this.group.position.copy(this.basePosition);
    this.group.rotation.copy(this.baseRotation);
    this.healthBarMesh.scale.x = 1.0;
    this.healthBarMesh.position.x = 0;
    (this.healthBarMesh.material as THREE.MeshBasicMaterial).color.setHex(0x10b981);

    this.soldier.update(0.016, {
      speed: 0,
      isGrounded: true,
      isCrouched: false,
      isSprinting: false,
      pitch: 0,
      isAlive: true
    });
  }

  public destroy() {
    this.soldier.destroy();
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
