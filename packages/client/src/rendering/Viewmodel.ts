import * as THREE from 'three';

export class Viewmodel {
  public group: THREE.Group;
  private weaponMesh: THREE.Group;
  private camera: THREE.Camera;

  // Bobbing & sway state
  private bobTime: number = 0;
  private lastYaw: number = 0;
  private lastPitch: number = 0;
  private currentSwayX: number = 0;
  private currentSwayY: number = 0;

  // Base viewmodel offset relative to camera
  private basePosition = new THREE.Vector3(0.24, -0.22, -0.42);

  constructor(camera: THREE.Camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.camera.add(this.group);

    this.weaponMesh = this.createProceduralWeapon();
    this.group.add(this.weaponMesh);
    this.group.position.copy(this.basePosition);
  }

  private createProceduralWeapon(): THREE.Group {
    const root = new THREE.Group();

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.8,
      roughness: 0.3
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.2,
      roughness: 0.8
    });

    // Receiver / Body
    const bodyGeo = new THREE.BoxGeometry(0.06, 0.09, 0.45);
    const body = new THREE.Mesh(bodyGeo, metalMat);
    body.position.set(0, 0, 0);
    root.add(body);

    // Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 12);
    const barrel = new THREE.Mesh(barrelGeo, metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.35);
    root.add(barrel);

    // Magazine
    const magGeo = new THREE.BoxGeometry(0.045, 0.16, 0.08);
    const mag = new THREE.Mesh(magGeo, darkMat);
    mag.position.set(0, -0.11, -0.05);
    mag.rotation.x = 0.15;
    root.add(mag);

    // Grip
    const gripGeo = new THREE.BoxGeometry(0.045, 0.14, 0.06);
    const grip = new THREE.Mesh(gripGeo, darkMat);
    grip.position.set(0, -0.1, 0.12);
    grip.rotation.x = -0.35;
    root.add(grip);

    // Iron sights / Top rail
    const railGeo = new THREE.BoxGeometry(0.03, 0.02, 0.3);
    const rail = new THREE.Mesh(railGeo, metalMat);
    rail.position.set(0, 0.055, -0.05);
    root.add(rail);

    return root;
  }

  public update(dt: number, speed: number, isGrounded: boolean, yaw: number, pitch: number, isSprinting: boolean) {
    // 1. Mouse Sway
    const deltaYaw = yaw - this.lastYaw;
    const deltaPitch = pitch - this.lastPitch;
    this.lastYaw = yaw;
    this.lastPitch = pitch;

    const targetSwayX = -deltaYaw * 0.035;
    const targetSwayY = deltaPitch * 0.035;

    this.currentSwayX += (targetSwayX - this.currentSwayX) * Math.min(1.0, 10.0 * dt);
    this.currentSwayY += (targetSwayY - this.currentSwayY) * Math.min(1.0, 10.0 * dt);

    // 2. Weapon Bobbing
    let bobFreq = 0;
    let bobAmpX = 0;
    let bobAmpY = 0;

    if (isGrounded && speed > 0.1) {
      bobFreq = isSprinting ? 12.0 : 8.0;
      bobAmpX = isSprinting ? 0.035 : 0.015;
      bobAmpY = isSprinting ? 0.03 : 0.012;
      this.bobTime += dt * bobFreq;
    } else {
      // Idle breathing sway
      this.bobTime += dt * 1.5;
      bobAmpX = 0.002;
      bobAmpY = 0.003;
    }

    const bobX = Math.sin(this.bobTime) * bobAmpX;
    const bobY = Math.abs(Math.cos(this.bobTime)) * bobAmpY;

    // 3. Sprint weapon lowering
    const sprintLowerY = isSprinting ? -0.08 : 0;
    const sprintRotateZ = isSprinting ? -0.3 : 0;

    // Apply combined offsets
    this.group.position.x = this.basePosition.x + this.currentSwayX + bobX;
    this.group.position.y = this.basePosition.y + this.currentSwayY - bobY + sprintLowerY;
    this.group.position.z = this.basePosition.z;

    this.weaponMesh.rotation.y = this.currentSwayX * 2.0;
    this.weaponMesh.rotation.x = -this.currentSwayY * 2.0;
    this.weaponMesh.rotation.z = sprintRotateZ;
  }
}
