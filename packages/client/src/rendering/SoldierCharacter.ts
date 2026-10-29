import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface SoldierKinematicState {
  speed: number;
  isGrounded: boolean;
  isCrouched: boolean;
  isSprinting: boolean;
  pitch: number;
  yaw?: number;
  isAlive: boolean;
  isFiring?: boolean;
}

export class SoldierCharacter {
  public group: THREE.Group;
  public modelGroup: THREE.Group;
  public isReady: boolean = false;

  // Cached template
  private static templatePromise: Promise<THREE.Group> | null = null;
  private static cachedTemplate: THREE.Group | null = null;

  // Rigged Bones
  private pelvis?: THREE.Bone;
  private spine1?: THREE.Bone;
  private spine2?: THREE.Bone;
  private spine3?: THREE.Bone;
  private head?: THREE.Bone;
  private thighL?: THREE.Bone;
  private calfL?: THREE.Bone;
  private thighR?: THREE.Bone;
  private calfR?: THREE.Bone;
  private upperarmR?: THREE.Bone;
  private lowerarmR?: THREE.Bone;
  private upperarmL?: THREE.Bone;
  private lowerarmL?: THREE.Bone;
  private weaponSocket?: THREE.Object3D;

  // Rest transforms
  private restPelvisPos = new THREE.Vector3();
  private restPelvisRot = new THREE.Euler();
  private restSpine1Rot = new THREE.Euler();
  private restSpine2Rot = new THREE.Euler();
  private restSpine3Rot = new THREE.Euler();
  private restHeadRot = new THREE.Euler();
  private restThighLRot = new THREE.Euler();
  private restCalfLRot = new THREE.Euler();
  private restThighRRot = new THREE.Euler();
  private restCalfRRot = new THREE.Euler();
  private restUpperarmRRot = new THREE.Euler();
  private restLowerarmRRot = new THREE.Euler();
  private restUpperarmLRot = new THREE.Euler();
  private restLowerarmLRot = new THREE.Euler();

  // Weapon
  public rifle?: THREE.Group;
  private muzzleFlashMesh?: THREE.Mesh;
  private muzzleFlashTimer: number = 0;

  // Kinematic cycle state
  private walkCycle: number = 0;
  private idleTime: number = 0;
  private crouchAmount: number = 0;
  private sprintWeight: number = 0;
  private aimPitch: number = 0;
  private team: string;

  constructor(team: string = 'alpha') {
    this.team = team;
    this.group = new THREE.Group();
    this.modelGroup = new THREE.Group();
    this.group.add(this.modelGroup);

    // Initial orientation: facing forward (-Z)
    this.modelGroup.rotation.y = Math.PI;

    this.init();
  }

  public static preload(): Promise<THREE.Group> {
    if (this.cachedTemplate) {
      return Promise.resolve(this.cachedTemplate);
    }
    if (!this.templatePromise) {
      this.templatePromise = new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(
          '/models/character/winter_soldier.glb',
          (gltf) => {
            console.log('[SoldierCharacter] Winter Soldier character model loaded successfully!');
            const root = gltf.scene;
            root.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.frustumCulled = true;
                // Only primary body & head cast shadows to keep shadow map rendering ultra fast (saves ~100k skinned vertices per shadow pass)
                const name = mesh.name || '';
                const isMainSilhouette = name.includes('Equip_02') || name.includes('Equip_03') || name.includes('Head');
                mesh.castShadow = isMainSilhouette;
                mesh.receiveShadow = false;

                const m = mesh.material as THREE.MeshStandardMaterial;
                if (m) {
                  m.roughness = Math.max(0.35, m.roughness ?? 0.5);
                  m.needsUpdate = true;
                }
              }
            });
            this.cachedTemplate = root;
            resolve(root);
          },
          undefined,
          (err) => {
            console.error('[SoldierCharacter] Failed to load Winter Soldier model:', err);
            reject(err);
          }
        );
      });
    }
    return this.templatePromise;
  }

  private async init() {
    try {
      const template = await SoldierCharacter.preload();
      const clone = SkeletonUtils.clone(template) as THREE.Group;
      this.modelGroup.add(clone);

      this.bindSkeleton(clone);
      this.attachAssaultRifle();
      this.attachTeamInsignia();
      this.isReady = true;
    } catch (err) {
      console.warn('[SoldierCharacter] Falling back to procedural proxy geometry:', err);
      this.createFallbackMesh();
    }
  }

  private bindSkeleton(root: THREE.Group) {
    const find = (name: string): any => {
      let bone: any = null;
      root.traverse((c) => {
        if (c.name === name) bone = c;
      });
      return bone;
    };

    this.pelvis = find('pelvis_09');
    this.spine1 = find('spine_01_010');
    this.spine2 = find('spine_02_011');
    this.spine3 = find('spine_03_012');
    this.head = find('head_0146');

    this.thighL = find('thigh_l_0286');
    this.calfL = find('calf_l_0287');
    this.thighR = find('thigh_r_0315');
    this.calfR = find('calf_r_0316');

    this.upperarmR = find('upperarm_r_081');
    this.lowerarmR = find('lowerarm_r_082');
    this.upperarmL = find('upperarm_l_016');
    this.lowerarmL = find('lowerarm_l_017');

    this.weaponSocket = find('hand_rSocket_0109') || find('weapon_r_0103') || find('hand_r_083');

    // Save rest rotations
    if (this.pelvis) {
      this.restPelvisPos.copy(this.pelvis.position);
      this.restPelvisRot.copy(this.pelvis.rotation);
    }
    if (this.spine1) this.restSpine1Rot.copy(this.spine1.rotation);
    if (this.spine2) this.restSpine2Rot.copy(this.spine2.rotation);
    if (this.spine3) this.restSpine3Rot.copy(this.spine3.rotation);
    if (this.head) this.restHeadRot.copy(this.head.rotation);

    if (this.thighL) this.restThighLRot.copy(this.thighL.rotation);
    if (this.calfL) this.restCalfLRot.copy(this.calfL.rotation);
    if (this.thighR) this.restThighRRot.copy(this.thighR.rotation);
    if (this.calfR) this.restCalfRRot.copy(this.calfR.rotation);

    if (this.upperarmR) this.restUpperarmRRot.copy(this.upperarmR.rotation);
    if (this.lowerarmR) this.restLowerarmRRot.copy(this.lowerarmR.rotation);
    if (this.upperarmL) this.restUpperarmLRot.copy(this.upperarmL.rotation);
    if (this.lowerarmL) this.restLowerarmLRot.copy(this.lowerarmL.rotation);

    // Initial tactical combat arm pose
    this.applyTacticalArmPose(0);
  }

  private attachAssaultRifle() {
    if (!this.weaponSocket) return;

    this.rifle = this.buildM416Mesh();
    // Socket offset & orientation calibrated to right palm grip pointing along character aim
    this.rifle.position.set(-0.02, 0.04, -0.05);
    this.rifle.rotation.set(1.8162, 1.0983, -0.2758);

    this.weaponSocket.add(this.rifle);
  }

  private buildM416Mesh(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'soldier_m416';

    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.88,
      roughness: 0.28
    });
    const tanPolymer = new THREE.MeshStandardMaterial({
      color: 0x57534e,
      metalness: 0.15,
      roughness: 0.8
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      metalness: 0.6,
      roughness: 0.4
    });

    // 1. Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.08, 0.34), darkMetal);
    receiver.position.set(0, 0.02, -0.05);
    receiver.castShadow = true;
    root.add(receiver);

    // 2. Handguard / Quad Rail
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.065, 0.24), tanPolymer);
    handguard.position.set(0, 0.025, -0.32);
    handguard.castShadow = true;
    root.add(handguard);

    // 3. Barrel & Flash Hider
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 10), darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.025, -0.52);
    barrel.castShadow = true;
    root.add(barrel);

    const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.05, 8), darkMetal);
    flashHider.rotation.x = Math.PI / 2;
    flashHider.position.set(0, 0.025, -0.64);
    root.add(flashHider);

    // 4. Curved STANAG 30-round Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.17, 0.065), accentMat);
    mag.position.set(0, -0.08, -0.12);
    mag.rotation.x = 0.22;
    mag.castShadow = true;
    root.add(mag);

    // 5. Pistol Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.13, 0.048), tanPolymer);
    grip.position.set(0, -0.06, 0.08);
    grip.rotation.x = -0.36;
    grip.castShadow = true;
    root.add(grip);

    // 6. Adjustable Tactical Stock & Buffer Tube
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), darkMetal);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.02, 0.18);
    root.add(tube);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.09, 0.15), tanPolymer);
    stock.position.set(0, 0.0, 0.24);
    stock.castShadow = true;
    root.add(stock);

    // 7. Holographic Tactical Sight on top rail
    const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.03, 0.10), darkMetal);
    sightBase.position.set(0, 0.075, -0.08);
    const sightGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.032, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65, roughness: 0.1 })
    );
    sightGlass.position.set(0, 0.082, -0.08);
    root.add(sightBase, sightGlass);

    // 8. Muzzle Flash Sprite (Triggered on fire)
    const flashGeo = new THREE.OctahedronGeometry(0.08, 0);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffedd5, transparent: true, opacity: 0 });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.position.set(0, 0.025, -0.70);
    root.add(this.muzzleFlashMesh);

    return root;
  }

  private attachTeamInsignia() {
    // Add glowing tactical shoulder patch
    const isAlpha = this.team === 'alpha';
    const insigniaColor = isAlpha ? 0x2563eb : 0xea580c;
    const glowColor = isAlpha ? 0x60a5fa : 0xfb923c;

    const patchGeo = new THREE.BoxGeometry(0.08, 0.12, 0.02);
    const patchMat = new THREE.MeshStandardMaterial({
      color: insigniaColor,
      emissive: glowColor,
      emissiveIntensity: 0.45,
      roughness: 0.5,
      metalness: 0.3
    });

    const patch = new THREE.Mesh(patchGeo, patchMat);
    patch.position.set(0.24, 1.42, 0.0);
    patch.rotation.y = Math.PI / 2;
    this.modelGroup.add(patch);
  }

  private applyTacticalArmPose(sprintLerp: number) {
    if (!this.upperarmR || !this.lowerarmR || !this.upperarmL || !this.lowerarmL) return;

    // Ready Stance:
    // Right arm firmly grasps grip at chest level
    const baseUpperRY = this.restUpperarmRRot.y + 0.45;
    const baseUpperRZ = this.restUpperarmRRot.z - 0.65;
    const baseLowerRY = this.restLowerarmRRot.y + 0.35;
    const baseLowerRZ = this.restLowerarmRRot.z - 0.45;

    // Left arm grips forward handguard across chest
    const baseUpperLY = this.restUpperarmLRot.y + 0.55;
    const baseUpperLZ = this.restUpperarmLRot.z - 0.75;
    const baseLowerLY = this.restLowerarmLRot.y - 0.45;
    const baseLowerLZ = this.restLowerarmLRot.z - 0.65;

    // When sprinting: drop into tactical low-ready carry
    const sprintDropZ = sprintLerp * 0.35;
    const sprintCarryY = sprintLerp * 0.15;

    this.upperarmR.rotation.y = baseUpperRY + sprintCarryY;
    this.upperarmR.rotation.z = baseUpperRZ + sprintDropZ;
    this.lowerarmR.rotation.y = baseLowerRY;
    this.lowerarmR.rotation.z = baseLowerRZ;

    this.upperarmL.rotation.y = baseUpperLY - sprintCarryY;
    this.upperarmL.rotation.z = baseUpperLZ + sprintDropZ;
    this.lowerarmL.rotation.y = baseLowerLY;
    this.lowerarmL.rotation.z = baseLowerLZ;
  }

  public update(dt: number, state: SoldierKinematicState) {
    if (!this.isReady || !this.group.visible) return;

    // Handle Muzzle Flash decay
    if (this.muzzleFlashMesh) {
      if (state.isFiring) {
        this.muzzleFlashTimer = 0.06;
        (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
        this.muzzleFlashMesh.scale.setScalar(1.0 + Math.random() * 0.5);
      } else if (this.muzzleFlashTimer > 0) {
        this.muzzleFlashTimer -= dt;
        const op = Math.max(0, this.muzzleFlashTimer / 0.06);
        (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = op * 0.9;
      }
    }

    // Death / Ragdoll pose
    if (!state.isAlive) {
      this.modelGroup.rotation.x = -Math.PI / 2;
      this.modelGroup.position.y = 0.22;
      return;
    } else {
      this.modelGroup.rotation.x = 0;
    }

    // Smooth Crouch Weight
    const targetCrouch = state.isCrouched ? 1.0 : 0.0;
    this.crouchAmount += (targetCrouch - this.crouchAmount) * Math.min(1.0, 10.0 * dt);

    // Smooth Sprint Weight
    const targetSprint = state.isSprinting && state.speed > 5.0 ? 1.0 : 0.0;
    this.sprintWeight += (targetSprint - this.sprintWeight) * Math.min(1.0, 8.0 * dt);

    // Aim Pitch Tracking (smooth interpolation)
    this.aimPitch += (state.pitch - this.aimPitch) * Math.min(1.0, 14.0 * dt);

    // 1. Spine Kinematics & Aim Pitch
    if (this.spine1 && this.spine2 && this.spine3) {
      // Idle Breathing Wave
      this.idleTime += dt;
      const breathing = Math.sin(this.idleTime * 2.2) * 0.015;

      // Sprint Torso Lean (forward into run)
      const forwardLean = this.sprintWeight * 0.22 + this.crouchAmount * 0.12;

      this.spine1.rotation.z = this.restSpine1Rot.z + forwardLean * 0.4;
      this.spine2.rotation.z = this.restSpine2Rot.z + forwardLean * 0.3 - this.aimPitch * 0.45;
      this.spine3.rotation.z = this.restSpine3Rot.z + forwardLean * 0.3 - this.aimPitch * 0.45 + breathing;

      if (this.head) {
        this.head.rotation.z = this.restHeadRot.z - this.aimPitch * 0.10;
      }
    }

    // 2. Arm Kinematics & Weapon Sway
    this.applyTacticalArmPose(this.sprintWeight);

    // 3. Legs & Pelvis Kinematics (Walking, Sprinting, Crouching)
    if (this.pelvis && this.thighL && this.thighR && this.calfL && this.calfR) {
      const isMoving = state.speed > 0.25;

      if (isMoving) {
        // Cadence scales dynamically with actual velocity
        const cadence = state.isSprinting ? Math.max(6.5, state.speed * 2.8) : Math.max(3.8, state.speed * 2.4);
        this.walkCycle += dt * cadence;

        // Leg Swing Amplitude
        const baseAmp = state.isSprinting ? 0.82 : 0.48;
        // Suppress swing amplitude when crouched
        const swingAmp = baseAmp * (1.0 - this.crouchAmount * 0.35);

        const sinWalk = Math.sin(this.walkCycle);

        // Left / Right Thigh pitch swing
        this.thighL.rotation.z = this.restThighLRot.z + sinWalk * swingAmp + this.crouchAmount * 0.65;
        this.thighR.rotation.z = this.restThighRRot.z - sinWalk * swingAmp + this.crouchAmount * 0.65;

        // Knee / Calf flexion on back-swing
        const kneeAmp = swingAmp * (state.isSprinting ? 1.45 : 1.25);
        const flexL = Math.max(0, -sinWalk) * kneeAmp;
        const flexR = Math.max(0, sinWalk) * kneeAmp;

        this.calfL.rotation.z = this.restCalfLRot.z - flexL - this.crouchAmount * 0.85;
        this.calfR.rotation.z = this.restCalfRRot.z - flexR - this.crouchAmount * 0.85;

        // Vertical Hip Bob
        const bob = Math.abs(sinWalk) * (state.isSprinting ? 0.055 : 0.028);
        this.pelvis.position.y = this.restPelvisPos.y - this.crouchAmount * 0.38 + bob;
      } else {
        // Idle Stance: smooth return to rest
        const returnSpeed = Math.min(1.0, 8.0 * dt);
        this.thighL.rotation.z += (this.restThighLRot.z + this.crouchAmount * 0.65 - this.thighL.rotation.z) * returnSpeed;
        this.thighR.rotation.z += (this.restThighRRot.z + this.crouchAmount * 0.65 - this.thighR.rotation.z) * returnSpeed;
        this.calfL.rotation.z += (this.restCalfLRot.z - this.crouchAmount * 0.85 - this.calfL.rotation.z) * returnSpeed;
        this.calfR.rotation.z += (this.restCalfRRot.z - this.crouchAmount * 0.85 - this.calfR.rotation.z) * returnSpeed;

        const breathingBob = Math.sin(this.idleTime * 2.2) * 0.008;
        this.pelvis.position.y += (this.restPelvisPos.y - this.crouchAmount * 0.38 + breathingBob - this.pelvis.position.y) * returnSpeed;
      }
    }
  }

  private createFallbackMesh() {
    // High-tech stylized proxy if GLTF fails
    const mat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.3), mat);
    body.position.set(0, 0.9, 0);
    this.modelGroup.add(body);
  }

  public destroy() {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}

