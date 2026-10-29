import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WeaponId } from '@warehouse-strike/shared';

export class Viewmodel {
  public group: THREE.Group;
  private camera: THREE.Camera;

  // Weapon meshes per ID
  private weapons: Record<WeaponId, THREE.Group>;
  private activeId: WeaponId = 'm416';

  // Animated Rigged Hands & M4 Weapon Pack
  private mixer?: THREE.AnimationMixer;
  private actions: Map<string, THREE.AnimationAction> = new Map();
  public isM4Loaded: boolean = false;

  // Bobbing & sway state
  private bobTime: number = 0;
  private lastYaw: number = 0;
  private lastPitch: number = 0;
  private currentSwayX: number = 0;
  private currentSwayY: number = 0;

  // Offsets
  private defaultHipPosition = new THREE.Vector3(0.22, -0.20, -0.42);
  private defaultAdsPosition = new THREE.Vector3(0.0, -0.145, -0.32);
  private m4HipPosition = new THREE.Vector3(0.02, -0.045, -0.15);
  private m4AdsPosition = new THREE.Vector3(-0.038, 0.035, -0.05);
  private m4HipRotation = new THREE.Vector3(0.0, 0.0, 0.0);
  private m4AdsRotation = new THREE.Vector3(0.055, -0.032, 0.0);
  private currentBasePos = new THREE.Vector3().copy(this.m4HipPosition);
  private currentBaseRot = new THREE.Vector3();

  constructor(camera: THREE.Camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.camera.add(this.group);

    // Dedicated Viewmodel Studio Light Rig (matches Sketchfab showcase lighting)
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 3.2);
    keyLight.position.set(0.6, 1.2, 0.4);
    this.group.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.8);
    fillLight.position.set(-1.0, 0.4, -0.2);
    this.group.add(fillLight);

    const underLight = new THREE.DirectionalLight(0xffedd5, 1.4);
    underLight.position.set(0.1, -1.0, -0.3);
    this.group.add(underLight);

    const vmAmbient = new THREE.AmbientLight(0xffffff, 1.2);
    this.group.add(vmAmbient);

    // Build models for all three weapons
    this.weapons = {
      m416: this.buildM416(),
      operator: this.buildOperator(),
      deagle: this.buildDeagle()
    };

    // Add all to viewmodel group, hide inactive
    for (const [id, mesh] of Object.entries(this.weapons)) {
      this.group.add(mesh);
      mesh.visible = id === this.activeId;
    }

    this.group.position.copy(this.m4HipPosition);

    // Load animated rigged M416 with FPS Hands
    this.loadM4Model();
  }

  private loadM4Model() {
    const loader = new GLTFLoader();
    loader.load(
      '/models/m4/scene.gltf',
      (gltf) => {
        console.log('[Viewmodel] Loaded M4 FPS Weapon Animations Pack (v.1) with Rigged Hands!');
        const model = gltf.scene;

        // Wrapper to isolate transforms
        const wrapper = new THREE.Group();
        wrapper.name = 'm4_fps_animated';
        // Rotate 180 deg around Y so weapon & hands face forward down camera view (-Z)
        model.rotation.y = Math.PI;
        wrapper.add(model);

        // Find FPS_Camera bone and align it exactly to camera eye origin (0, 0, 0)
        let fpsCamNode: THREE.Object3D | null = null;
        model.traverse((child) => {
          if (child.name === 'FPS_Camera' || child.name === 'FPS_Camera_j_01') {
            if (!fpsCamNode) fpsCamNode = child;
          }
        });

        wrapper.updateMatrixWorld(true);
        if (fpsCamNode) {
          const camPos = new THREE.Vector3();
          (fpsCamNode as THREE.Object3D).getWorldPosition(camPos);
          model.position.sub(camPos);
        } else {
          model.position.set(0.0109, -1.5393, -0.1006);
        }

        // Traversal for PBR materials & textures setup
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = false;
            child.receiveShadow = false; // Prevent environmental shadow acne
            const mesh = child as THREE.Mesh;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat) {
              mat.depthWrite = true;
              mat.depthTest = true;
              mat.roughness = 0.55;
              mat.metalness = mat.name.includes('M4') ? 0.12 : 0.02;
              if (mat.map) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
                mat.map.anisotropy = 8;
                mat.map.needsUpdate = true;
              }
              if (mat.normalMap) {
                mat.normalMap.anisotropy = 8;
                mat.normalScale.set(1.2, 1.2);
                mat.normalMap.needsUpdate = true;
              }
              mat.needsUpdate = true;
            }
          }
        });

        // Initialize Animation Mixer
        this.mixer = new THREE.AnimationMixer(model);

        for (const clip of gltf.animations) {
          // Normalize start times of baked timeline
          const minTime = Math.min(...clip.tracks.map((t) => t.times[0]));
          if (minTime > 0) {
            for (const track of clip.tracks) {
              for (let i = 0; i < track.times.length; i++) {
                track.times[i] -= minTime;
              }
            }
            clip.resetDuration();
          }

          const action = this.mixer.clipAction(clip);
          if (clip.name === 'Fire') {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = false;
            action.timeScale = 3.2; // Snappy automatic fire cycle for 700 RPM
          } else if (clip.name === 'Reload') {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            action.timeScale = 1.65; // Matches 2.2s tactical reload
          } else if (clip.name === 'Reload_Empty') {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            action.timeScale = 1.36; // Matches 2.8s empty reload
          } else if (clip.name === 'Draw') {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            action.timeScale = 1.4;
          } else if (clip.name === 'Holster') {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
          this.actions.set(clip.name, action);
        }

        // Replace procedural placeholder
        const oldM4 = this.weapons.m416;
        this.group.remove(oldM4);
        this.weapons.m416 = wrapper;
        this.group.add(wrapper);
        wrapper.visible = this.activeId === 'm416';
        this.isM4Loaded = true;

        // Play initial draw animation
        this.playDraw();
      },
      undefined,
      (err) => {
        console.warn('[Viewmodel] Fallback to procedural M4 model:', err);
      }
    );
  }

  public playFire() {
    if (this.activeId === 'm416' && this.actions.has('Fire')) {
      const fire = this.actions.get('Fire')!;
      fire.reset();
      fire.play();
    }
  }

  public playReload(isEmpty: boolean = false) {
    if (this.activeId === 'm416') {
      const actionName = isEmpty ? 'Reload_Empty' : 'Reload';
      const reload = this.actions.get(actionName) || this.actions.get('Reload');
      if (reload) {
        reload.reset();
        reload.play();
      }
    }
  }

  public playDraw() {
    if (this.activeId === 'm416' && this.actions.has('Draw')) {
      const draw = this.actions.get('Draw')!;
      draw.reset();
      draw.play();
    }
  }

  public setWeapon(id: WeaponId) {
    if (this.activeId === id) return;
    this.activeId = id;
    for (const [key, mesh] of Object.entries(this.weapons)) {
      mesh.visible = key === id;
    }
    if (id === 'm416') {
      this.playDraw();
    }
  }

  private buildM416(): THREE.Group {
    const root = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8, roughness: 0.3 });
    const polymerMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.1, roughness: 0.85 });
    const tanMat = new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: 0.2, roughness: 0.7 });

    // Upper/Lower Receiver
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.08, 0.38), metalMat);
    root.add(body);

    // Handguard / Shroud
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.065, 0.25), tanMat);
    handguard.position.set(0, 0.005, -0.28);
    root.add(handguard);

    // Barrel & Flash Hider
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 10), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.005, -0.46);
    root.add(barrel);

    // Curved Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.07), polymerMat);
    mag.position.set(0, -0.11, -0.06);
    mag.rotation.x = 0.2;
    root.add(mag);

    // Pistol Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.13, 0.05), polymerMat);
    grip.position.set(0, -0.09, 0.12);
    grip.rotation.x = -0.35;
    root.add(grip);

    // Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.09, 0.18), tanMat);
    stock.position.set(0, -0.01, 0.26);
    root.add(stock);

    // Holo Sight / Optic
    const optic = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.045, 0.08), metalMat);
    optic.position.set(0, 0.062, -0.04);
    root.add(optic);

    return root;
  }

  private buildOperator(): THREE.Group {
    const root = new THREE.Group();
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.25 });
    const oliveChassis = new THREE.MeshStandardMaterial({ color: 0x365314, metalness: 0.2, roughness: 0.7 });

    // Heavy Sniper Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.085, 0.55), oliveChassis);
    root.add(chassis);

    // Long Fluted Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.55, 12), darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, -0.52);
    root.add(barrel);

    // Heavy Muzzle Brake
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.08), darkMetal);
    brake.position.set(0, 0.015, -0.81);
    root.add(brake);

    // High Power Sniper Scope Tube
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.28, 16), darkMetal);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.08, -0.05);
    root.add(scopeTube);

    // Scope Mount Rings
    const ring1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.025), darkMetal);
    ring1.position.set(0, 0.055, 0.04);
    const ring2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.025), darkMetal);
    ring2.position.set(0, 0.055, -0.14);
    root.add(ring1);
    root.add(ring2);

    // Bolt Handle
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8), darkMetal);
    bolt.rotation.z = Math.PI / 2.5;
    bolt.position.set(0.045, 0.035, 0.06);
    root.add(bolt);

    // Small sniper magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.08, 0.09), darkMetal);
    mag.position.set(0, -0.075, -0.06);
    root.add(mag);

    // Sniper Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.24), oliveChassis);
    stock.position.set(0, -0.02, 0.38);
    root.add(stock);

    return root;
  }

  private buildDeagle(): THREE.Group {
    const root = new THREE.Group();
    const chromeSlide = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });
    const blackGrip = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.1, roughness: 0.9 });

    // Heavy Slide
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.24), chromeSlide);
    slide.position.set(0, 0.015, -0.02);
    root.add(slide);

    // Frame & Trigger Guard
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.035, 0.22), chromeSlide);
    frame.position.set(0, -0.02, -0.02);
    root.add(frame);

    // Thick Handgun Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.13, 0.065), blackGrip);
    grip.position.set(0, -0.085, 0.055);
    grip.rotation.x = -0.28;
    root.add(grip);

    // Front/Rear Sights
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.012), chromeSlide);
    frontSight.position.set(0, 0.046, -0.13);
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.012, 0.01), chromeSlide);
    rearSight.position.set(0, 0.046, 0.09);
    root.add(frontSight);
    root.add(rearSight);

    return root;
  }

  public update(
    dt: number,
    speed: number,
    isGrounded: boolean,
    yaw: number,
    pitch: number,
    isSprinting: boolean,
    isAiming: boolean,
    kickZ: number,
    kickPitch: number
  ) {
    // Step AnimationMixer
    if (this.mixer) {
      this.mixer.update(dt);
    }

    // 1. Mouse Sway
    const deltaYaw = yaw - this.lastYaw;
    const deltaPitch = pitch - this.lastPitch;
    this.lastYaw = yaw;
    this.lastPitch = pitch;

    const targetSwayX = -deltaYaw * 0.03;
    const targetSwayY = deltaPitch * 0.03;

    this.currentSwayX += (targetSwayX - this.currentSwayX) * Math.min(1.0, 10.0 * dt);
    this.currentSwayY += (targetSwayY - this.currentSwayY) * Math.min(1.0, 10.0 * dt);

    // 2. Weapon Bobbing
    let bobFreq = 0;
    let bobAmpX = 0;
    let bobAmpY = 0;

    if (isGrounded && speed > 0.1 && !isAiming) {
      bobFreq = isSprinting ? 12.0 : 8.0;
      bobAmpX = isSprinting ? 0.035 : 0.015;
      bobAmpY = isSprinting ? 0.03 : 0.012;
      this.bobTime += dt * bobFreq;
    } else {
      // Idle breathing sway
      this.bobTime += dt * 1.5;
      bobAmpX = isAiming ? 0.0005 : 0.002;
      bobAmpY = isAiming ? 0.0008 : 0.003;
    }

    const bobX = Math.sin(this.bobTime) * bobAmpX;
    const bobY = Math.abs(Math.cos(this.bobTime)) * bobAmpY;

    // 3. Stance transitions (Hip vs ADS vs Sprint)
    const isM4 = this.activeId === 'm416' && this.isM4Loaded;
    const hipPos = isM4 ? this.m4HipPosition : this.defaultHipPosition;
    const adsPos = isM4 ? this.m4AdsPosition : this.defaultAdsPosition;
    const targetPos = isAiming ? adsPos : hipPos;

    const targetRot = isM4 && isAiming ? this.m4AdsRotation : this.m4HipRotation;

    this.currentBasePos.lerp(targetPos, Math.min(1.0, 14.0 * dt));
    this.currentBaseRot.lerp(targetRot, Math.min(1.0, 14.0 * dt));

    const sprintLowerY = isSprinting ? -0.09 : 0;
    const sprintRotateZ = isSprinting ? -0.35 : 0;

    // Dampen sway in ADS for rock-solid iron sight aiming
    const swayDamp = isAiming ? 0.35 : 1.0;

    // Hide Operator mesh during full ADS scope overlay
    const isOperatorScope = this.activeId === 'operator' && isAiming;
    this.group.visible = !isOperatorScope;

    // Apply combined position (base + sway + bob + recoil kick + sprint)
    this.group.position.x = this.currentBasePos.x + this.currentSwayX * swayDamp + bobX;
    this.group.position.y = this.currentBasePos.y + this.currentSwayY * swayDamp - bobY + sprintLowerY;
    this.group.position.z = this.currentBasePos.z + kickZ;

    // Apply rotation (base ADS alignment + mouse sway + recoil pitch + sprint)
    this.group.rotation.y = this.currentBaseRot.y + this.currentSwayX * 1.8 * swayDamp;
    this.group.rotation.x = this.currentBaseRot.x - this.currentSwayY * 1.8 * swayDamp - kickPitch;
    this.group.rotation.z = this.currentBaseRot.z + sprintRotateZ;
  }
}
