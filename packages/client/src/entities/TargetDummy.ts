import * as THREE from 'three';

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

  // Meshes for raycasting
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

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xc2410c, // Tactical orange hostile dummy
      roughness: 0.6,
      metalness: 0.2
    });

    const headMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Bright red head target
      roughness: 0.4,
      metalness: 0.3
    });

    const legMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.8
    });

    // 1. Legs
    const legsGeo = new THREE.BoxGeometry(0.46, 0.8, 0.3);
    this.legsMesh = new THREE.Mesh(legsGeo, legMat);
    this.legsMesh.position.set(0, 0.4, 0);
    this.legsMesh.castShadow = true;
    this.legsMesh.userData = { dummy: this, part: 'body' };
    this.group.add(this.legsMesh);

    // 2. Torso / Body
    const bodyGeo = new THREE.BoxGeometry(0.52, 0.65, 0.32);
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.set(0, 1.125, 0);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.userData = { dummy: this, part: 'body' };
    this.group.add(this.bodyMesh);

    // 3. Head (Hitbox sphere)
    const headGeo = new THREE.SphereGeometry(0.18, 16, 16);
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.set(0, 1.62, 0);
    this.headMesh.castShadow = true;
    this.headMesh.userData = { dummy: this, part: 'head' };
    this.group.add(this.headMesh);

    // 4. Floating Health Bar
    const bgGeo = new THREE.PlaneGeometry(0.6, 0.08);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x1f2937, side: THREE.DoubleSide });
    this.healthBarBg = new THREE.Mesh(bgGeo, bgMat);
    this.healthBarBg.position.set(0, 1.95, 0);
    this.group.add(this.healthBarBg);

    const barGeo = new THREE.PlaneGeometry(0.58, 0.06);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
    this.healthBarMesh = new THREE.Mesh(barGeo, barMat);
    this.healthBarMesh.position.set(0, 1.95, 0.005);
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
    this.healthBarMesh.position.x = -(0.58 * (1 - healthPercent)) / 2;

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
      this.group.rotation.x = -Math.PI / 2; // Knocked down
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
  }
}
