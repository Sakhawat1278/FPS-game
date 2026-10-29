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

  // Rigged Bones (Character Creator Humanoid)
  private pelvis?: THREE.Bone;
  private waist?: THREE.Bone;
  private spine1?: THREE.Bone;
  private spine2?: THREE.Bone;
  private head?: THREE.Bone;
  private thighL?: THREE.Bone;
  private calfL?: THREE.Bone;
  private thighR?: THREE.Bone;
  private calfR?: THREE.Bone;
  private upperarmR?: THREE.Bone;
  private lowerarmR?: THREE.Bone;
  private upperarmL?: THREE.Bone;
  private lowerarmL?: THREE.Bone;
  private handR?: THREE.Bone;
  private handL?: THREE.Bone;

  // Rest transforms
  private restPelvisPos = new THREE.Vector3();
  private restPelvisRot = new THREE.Euler();
  private restWaistRot = new THREE.Euler();
  private restSpine1Rot = new THREE.Euler();
  private restSpine2Rot = new THREE.Euler();
  private restHeadRot = new THREE.Euler();
  private restThighLRot = new THREE.Euler();
  private restCalfLRot = new THREE.Euler();
  private restThighRRot = new THREE.Euler();
  private restCalfRRot = new THREE.Euler();
  private restUpperarmRRot = new THREE.Euler();
  private restLowerarmRRot = new THREE.Euler();
  private restUpperarmLRot = new THREE.Euler();
  private restLowerarmLRot = new THREE.Euler();
  private restHandRRot = new THREE.Euler();
  private restHandLRot = new THREE.Euler();

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
          '/models/character/tactical_soldier.glb',
          (gltf) => {
            console.log('[SoldierCharacter] Full Tactical Gear Soldier loaded successfully!');
            const root = gltf.scene;

            // Optimize meshes and shadows
            root.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.frustumCulled = true;

                // Major silhouette meshes cast shadow (plate vest, kitel jacket, pants, helmet, boots)
                const name = mesh.name || '';
                const isSilhouette =
                  name.includes('Plate') ||
                  name.includes('Kitel') ||
                  name.includes('Pants') ||
                  name.includes('Helmet') ||
                  name.includes('Boots') ||
                  name.includes('HeadMasked');

                mesh.castShadow = isSilhouette;
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
            console.error('[SoldierCharacter] Failed to load tactical soldier model:', err);
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
      console.warn('[SoldierCharacter] Fallback geometry activated:', err);
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

    this.pelvis = find('CC_Base_Pelvis_02') || find('CC_Base_Hip_01');
    this.waist = find('CC_Base_Waist_033');
    this.spine1 = find('CC_Base_Spine01_034');
    this.spine2 = find('CC_Base_Spine02_035');
    this.head = find('CC_Base_Head_038');

    this.thighL = find('CC_Base_L_Thigh_03');
    this.calfL = find('CC_Base_L_Calf_04');
    this.thighR = find('CC_Base_R_Thigh_018');
    this.calfR = find('CC_Base_R_Calf_021');

    this.upperarmR = find('CC_Base_R_Upperarm_074');
    this.lowerarmR = find('CC_Base_R_Forearm_077');
    this.handR = find('CC_Base_R_Hand_081');

    this.upperarmL = find('CC_Base_L_Upperarm_050');
    this.lowerarmL = find('CC_Base_L_Forearm_051');
    this.handL = find('CC_Base_L_Hand_055');

    // Save rest transforms
    if (this.pelvis) {
      this.restPelvisPos.copy(this.pelvis.position);
      this.restPelvisRot.copy(this.pelvis.rotation);
    }
    if (this.waist) this.restWaistRot.copy(this.waist.rotation);
    if (this.spine1) this.restSpine1Rot.copy(this.spine1.rotation);
    if (this.spine2) this.restSpine2Rot.copy(this.spine2.rotation);
    if (this.head) this.restHeadRot.copy(this.head.rotation);

    if (this.thighL) this.restThighLRot.copy(this.thighL.rotation);
    if (this.calfL) this.restCalfLRot.copy(this.calfL.rotation);
    if (this.thighR) this.restThighRRot.copy(this.thighR.rotation);
    if (this.calfR) this.restCalfRRot.copy(this.calfR.rotation);

    if (this.upperarmR) this.restUpperarmRRot.copy(this.upperarmR.rotation);
    if (this.lowerarmR) this.restLowerarmRRot.copy(this.lowerarmR.rotation);
    if (this.handR) this.restHandRRot.copy(this.handR.rotation);

    if (this.upperarmL) this.restUpperarmLRot.copy(this.upperarmL.rotation);
    if (this.lowerarmL) this.restLowerarmLRot.copy(this.lowerarmL.rotation);
    if (this.handL) this.restHandLRot.copy(this.handL.rotation);

    this.applyTacticalArmPose(0, 0);
  }

  private attachAssaultRifle() {
    if (!this.handR) return;

    this.rifle = this.buildM416Mesh();

    // Scale compensation: The CC3 Armature has scale 0.01 (FBX unit conversion).
    // Scaling the rifle by 100.0 restores it to full realistic 1:1 scale (0.84m length).
    this.rifle.scale.set(100.0, 100.0, 100.0);

    // Orientation: Rotated to point barrel straight down -Z in world coordinates
    this.rifle.rotation.set(1.4923, -0.6782, -0.7985);

    // Position: Center the pistol grip directly in the palm of CC_Base_R_Hand_081
    this.rifle.position.set(-2.0, 4.0, -3.0);

    this.handR.add(this.rifle);
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

    // 5. Pistol Grip (Centered near local origin for precise hand placement)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.13, 0.048), tanPolymer);
    grip.position.set(0, -0.06, 0.08);
    grip.rotation.x = -0.36;
    grip.castShadow = true;
    root.add(grip);

    // 6. Tactical Stock & Buffer Tube
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), darkMetal);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.02, 0.18);
    root.add(tube);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.09, 0.15), tanPolymer);
    stock.position.set(0, 0.0, 0.24);
    stock.castShadow = true;
    root.add(stock);

    // 7. Holographic Sight
    const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.03, 0.10), darkMetal);
    sightBase.position.set(0, 0.075, -0.08);
    const sightGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.032, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65, roughness: 0.1 })
    );
    sightGlass.position.set(0, 0.082, -0.08);
    root.add(sightBase, sightGlass);

    // 8. Muzzle Flash Sprite
    const flashGeo = new THREE.OctahedronGeometry(0.08, 0);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffedd5, transparent: true, opacity: 0 });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.position.set(0, 0.025, -0.70);
    root.add(this.muzzleFlashMesh);

    return root;
  }

  private attachTeamInsignia() {
    const isAlpha = this.team === 'alpha';
    const insigniaColor = isAlpha ? 0x2563eb : 0xea580c;
    const glowColor = isAlpha ? 0x60a5fa : 0xfb923c;

    const patchGeo = new THREE.BoxGeometry(0.06, 0.10, 0.02);
    const patchMat = new THREE.MeshStandardMaterial({
      color: insigniaColor,
      emissive: glowColor,
      emissiveIntensity: 0.5,
      roughness: 0.5,
      metalness: 0.3
    });

    const patch = new THREE.Mesh(patchGeo, patchMat);
    patch.position.set(0.22, 1.40, 0.0);
    patch.rotation.y = Math.PI / 2;
    this.modelGroup.add(patch);
  }

  private applyTacticalArmPose(sprintLerp: number, breathing: number) {
    if (!this.upperarmR || !this.lowerarmR || !this.handR || !this.upperarmL || !this.lowerarmL || !this.handL) return;

    // Tactical Ready Stance:
    // Right arm firmly holds pistol grip with stock tucked into shoulder
    const baseUpperRX = 0.70 - sprintLerp * 0.35 + breathing * 0.05;
    const baseUpperRY = -0.20;
    const baseUpperRZ = 0.40;

    const baseLowerRX = 0.90;
    const baseLowerRY = 0.10;
    const baseLowerRZ = 0.30;

    const baseHandRX = 0.10;
    const baseHandRY = -0.05;
    const baseHandRZ = -0.15;

    // Left arm extends across chest, left hand supporting the front handguard
    const baseUpperLX = 1.05 - sprintLerp * 0.35 + breathing * 0.05;
    const baseUpperLY = 0.40;
    const baseUpperLZ = -0.60;

    const baseLowerLX = 0.35;
    const baseLowerLY = -0.15;
    const baseLowerLZ = 1.10;

    const baseHandLX = 0.20;
    const baseHandLY = 0.10;
    const baseHandLZ = 0.25;

    this.upperarmR.rotation.set(baseUpperRX, baseUpperRY, baseUpperRZ);
    this.lowerarmR.rotation.set(baseLowerRX, baseLowerRY, baseLowerRZ);
    this.handR.rotation.set(baseHandRX, baseHandRY, baseHandRZ);

    this.upperarmL.rotation.set(baseUpperLX, baseUpperLY, baseUpperLZ);
    this.lowerarmL.rotation.set(baseLowerLX, baseLowerLY, baseLowerLZ);
    this.handL.rotation.set(baseHandLX, baseHandLY, baseHandLZ);
  }

  public update(dt: number, state: SoldierKinematicState) {
    if (!this.isReady || !this.group.visible) return;

    this.idleTime += dt;
    const breathing = Math.sin(this.idleTime * 2.2) * 0.015;

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

    // Aim Pitch Tracking
    this.aimPitch += (state.pitch - this.aimPitch) * Math.min(1.0, 14.0 * dt);

    // 1. Spine Kinematics & Aim Pitch
    if (this.spine1 && this.spine2) {
      const forwardLean = this.sprintWeight * 0.22 + this.crouchAmount * 0.12;

      this.spine1.rotation.x = this.restSpine1Rot.x + forwardLean * 0.4 - this.aimPitch * 0.45 + breathing * 0.3;
      this.spine2.rotation.x = this.restSpine2Rot.x + forwardLean * 0.3 - this.aimPitch * 0.45 + breathing * 0.7;

      if (this.head) {
        this.head.rotation.x = this.restHeadRot.x - this.aimPitch * 0.10;
      }
    }

    // 2. Arm Kinematics & Weapon Sway (Stock to shoulder, two-handed grip on M416)
    this.applyTacticalArmPose(this.sprintWeight, breathing);

    // 3. Legs & Pelvis Kinematics (Walking, Sprinting, Crouching)
    if (this.pelvis && this.thighL && this.thighR && this.calfL && this.calfR) {
      const isMoving = state.speed > 0.25;

      if (isMoving) {
        const cadence = state.isSprinting ? Math.max(6.5, state.speed * 2.8) : Math.max(3.8, state.speed * 2.4);
        this.walkCycle += dt * cadence;

        const baseAmp = state.isSprinting ? 0.78 : 0.46;
        const swingAmp = baseAmp * (1.0 - this.crouchAmount * 0.35);

        const sinWalk = Math.sin(this.walkCycle);

        // CC3 Thighs swing forward/backward along local Y axis
        this.thighL.rotation.y = this.restThighLRot.y + sinWalk * swingAmp + this.crouchAmount * 0.65;
        this.thighR.rotation.y = this.restThighRRot.y - sinWalk * swingAmp + this.crouchAmount * 0.65;

        // Knees bend backward along local X axis on backward swing
        const kneeAmp = swingAmp * (state.isSprinting ? 1.4 : 1.2);
        const flexL = Math.max(0, -sinWalk) * kneeAmp;
        const flexR = Math.max(0, sinWalk) * kneeAmp;

        this.calfL.rotation.x = this.restCalfLRot.x - flexL - this.crouchAmount * 0.85;
        this.calfR.rotation.x = this.restCalfRRot.x - flexR - this.crouchAmount * 0.85;

        // Hip Bobbing
        const bob = Math.abs(sinWalk) * (state.isSprinting ? 0.055 : 0.026);
        this.pelvis.position.y = this.restPelvisPos.y - this.crouchAmount * 0.38 + bob;
      } else {
        // Idle return to rest with breathing bob
        const returnSpeed = Math.min(1.0, 8.0 * dt);
        this.thighL.rotation.y += (this.restThighLRot.y + this.crouchAmount * 0.65 - this.thighL.rotation.y) * returnSpeed;
        this.thighR.rotation.y += (this.restThighRRot.y + this.crouchAmount * 0.65 - this.thighR.rotation.y) * returnSpeed;
        this.calfL.rotation.x += (this.restCalfLRot.x - this.crouchAmount * 0.85 - this.calfL.rotation.x) * returnSpeed;
        this.calfR.rotation.x += (this.restCalfRRot.x - this.crouchAmount * 0.85 - this.calfR.rotation.x) * returnSpeed;

        this.pelvis.position.y += (this.restPelvisPos.y - this.crouchAmount * 0.38 + breathing * 0.02 - this.pelvis.position.y) * returnSpeed;
      }
    }
  }

  private createFallbackMesh() {
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
