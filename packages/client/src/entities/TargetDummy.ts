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

  // Raycast Hitboxes & Visual Meshes
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

    // High-performance tactical firing-range dummy materials
    const steelBaseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.5 });
    const hostileBodyMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.5, metalness: 0.2 });
    const targetCenterMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3, metalness: 0.1 });
    const headTargetMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4, metalness: 0.3 });
    const rifleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8, metalness: 0.6 });

    // 1. Steel Stand Base
    const standGeo = new THREE.CylinderGeometry(0.35, 0.38, 0.08, 12);
    const stand = new THREE.Mesh(standGeo, steelBaseMat);
    stand.position.set(0, 0.04, 0);
    stand.receiveShadow = true;
    this.group.add(stand);

    // 2. Legs / Support Pillars (Raycast target: body)
    const legsGeo = new THREE.BoxGeometry(0.44, 0.76, 0.26);
    this.legsMesh = new THREE.Mesh(legsGeo, steelBaseMat);
    this.legsMesh.position.set(0, 0.44, 0);
    this.legsMesh.castShadow = true;
    this.legsMesh.receiveShadow = true;
    this.legsMesh.userData = { dummy: this, part: 'body' };
    this.group.add(this.legsMesh);

    // 3. Torso / Ballistic Armor Plate (Raycast target: body)
    const bodyGeo = new THREE.BoxGeometry(0.52, 0.62, 0.30);
    this.bodyMesh = new THREE.Mesh(bodyGeo, hostileBodyMat);
    this.bodyMesh.position.set(0, 1.13, 0);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.userData = { dummy: this, part: 'body' };
    this.group.add(this.bodyMesh);

    // Bullseye Target Disc on Torso
    const discGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.02, 12);
    const targetDisc = new THREE.Mesh(discGeo, targetCenterMat);
    targetDisc.rotation.x = Math.PI / 2;
    targetDisc.position.set(0, 1.13, -0.16);
    this.group.add(targetDisc);

    // 4. Head Target Silhouette (Raycast target: head)
    const headGeo = new THREE.SphereGeometry(0.18, 12, 12);
    this.headMesh = new THREE.Mesh(headGeo, headTargetMat);
    this.headMesh.position.set(0, 1.62, 0);
    this.headMesh.castShadow = true;
    this.headMesh.userData = { dummy: this, part: 'head' };
    this.group.add(this.headMesh);

    // Steel Helmet Plate
    const helmetGeo = new THREE.SphereGeometry(0.20, 12, 12, 0, Math.PI * 2, 0, Math.PI / 1.8);
    const helmet = new THREE.Mesh(helmetGeo, steelBaseMat);
    helmet.position.set(0, 1.63, 0);
    helmet.castShadow = true;
    this.group.add(helmet);

    // 5. Training Weapon Prop Silhouette
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.44), rifleMat);
    gunBody.position.set(0.18, 1.05, -0.22);
    gunBody.castShadow = true;
    this.group.add(gunBody);

    // 6. Floating Health Bar
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

  public destroy() {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
