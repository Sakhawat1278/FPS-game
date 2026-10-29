import * as THREE from 'three';
import { WEAPONS, WeaponData, WeaponId } from '@warehouse-strike/shared';
import { AudioEngine } from '../audio/AudioEngine';
import { VFXManager } from '../rendering/VFXManager';
import { TargetDummy, DummyHitResult } from '../entities/TargetDummy';
import { RecoilSystem } from './RecoilSystem';

export class WeaponManager {
  private camera: THREE.PerspectiveCamera;
  private audio: AudioEngine;
  private vfx: VFXManager;
  public recoilSystem: RecoilSystem;

  // Loadout
  public primaryId: WeaponId = 'm416'; // or 'operator'
  public activeSlot: 1 | 2 = 1;

  // Ammo tracking
  public ammoState: Record<WeaponId, { mag: number; reserve: number }> = {
    m416: { mag: 30, reserve: 120 },
    operator: { mag: 5, reserve: 20 },
    deagle: { mag: 7, reserve: 35 }
  };

  // Timing
  private lastFireTime: number = 0;
  public isReloading: boolean = false;
  private reloadTimer: number = 0;
  private isCyclingBolt: boolean = false;
  private boltTimer: number = 0;
  private shotCount: number = 0;

  // Sprint-to-fire transition state
  public isSprintTransitioning: boolean = false;
  public sprintRecoveryTimer: number = 0;

  // ADS state
  public isAiming: boolean = false;
  public operatorZoomIndex: number = 0; // 0 for 4x, 1 for 8x
  public currentFOV: number = 90;
  public baseFOV: number = 90;

  // Hit callbacks
  public onHit?: (result: DummyHitResult) => void;
  public onReloadStart?: (isEmpty: boolean) => void;

  constructor(camera: THREE.PerspectiveCamera, audio: AudioEngine, vfx: VFXManager) {
    this.camera = camera;
    this.audio = audio;
    this.vfx = vfx;
    this.recoilSystem = new RecoilSystem();
  }

  public get activeWeapon(): WeaponData {
    const id = this.activeSlot === 1 ? this.primaryId : 'deagle';
    return WEAPONS[id];
  }

  public get activeAmmo() {
    return this.ammoState[this.activeWeapon.id];
  }

  public switchSlot(slot: 1 | 2) {
    if (this.activeSlot === slot || this.isReloading) return;
    this.activeSlot = slot;
    this.isAiming = false;
    this.isCyclingBolt = false;
    this.isSprintTransitioning = false;
    this.sprintRecoveryTimer = 0;
    this.audio.playDryFire();
    console.log(`[WeaponManager] Switched to ${this.activeWeapon.name}`);
  }

  public togglePrimaryWeapon() {
    this.primaryId = this.primaryId === 'm416' ? 'operator' : 'm416';
    if (this.activeSlot === 1) {
      this.isAiming = false;
      this.isReloading = false;
    }
  }

  public toggleOperatorZoom() {
    if (this.activeWeapon.id === 'operator' && this.isAiming) {
      this.operatorZoomIndex = (this.operatorZoomIndex + 1) % 2;
    }
  }

  public tryFire(
    now: number,
    isSprinting: boolean,
    dummies: TargetDummy[],
    staticMapGroup: THREE.Group
  ): boolean {
    if (this.isReloading || this.isCyclingBolt) return false;

    const weapon = this.activeWeapon;
    const ammo = this.activeAmmo;

    // Smooth sprint-to-fire shift: if sprinting, initiate sprint recovery delay (~0.20s) and walk
    if (isSprinting && !this.isSprintTransitioning) {
      this.isSprintTransitioning = true;
      this.sprintRecoveryTimer = weapon.sprintToFireTime || 0.20;
      return false;
    }

    if (this.isSprintTransitioning) {
      if (this.sprintRecoveryTimer > 0) {
        return false; // Still shifting up from sprint to fire
      }
      this.isSprintTransitioning = false;
    }

    // Check fire rate cooldown
    if (now - this.lastFireTime < weapon.fireInterval * 1000) {
      return false;
    }

    // Check Ammo
    if (ammo.mag <= 0) {
      this.audio.playDryFire();
      this.lastFireTime = now;
      this.startReload();
      return false;
    }

    // Consume round
    ammo.mag--;
    this.lastFireTime = now;
    this.shotCount++;

    // Play gunshot audio
    if (weapon.id === 'm416') this.audio.playM416();
    else if (weapon.id === 'operator') this.audio.playOperator();
    else if (weapon.id === 'deagle') this.audio.playDeagle();

    // Bolt action cycle for Operator
    if (weapon.id === 'operator' && ammo.mag > 0) {
      this.isCyclingBolt = true;
      this.boltTimer = weapon.boltCycleTime || 1.3;
      setTimeout(() => this.audio.playBoltCycle(), 300);
    }

    // Apply Recoil & Spread bloom
    this.recoilSystem.applyRecoil(weapon);

    // Muzzle flash at true barrel position
    const isM4 = weapon.id === 'm416';
    const muzzleOffset = isM4
      ? (this.isAiming ? new THREE.Vector3(0.0, 0.001, -0.78) : new THREE.Vector3(0.071, -0.001, -0.72))
      : new THREE.Vector3(0.2, -0.15, -0.5);
    const muzzlePos = this.camera.position.clone().add(
      muzzleOffset.applyQuaternion(this.camera.quaternion)
    );
    this.vfx.triggerMuzzleFlash(muzzlePos);

    // Hitscan Raycasting with Spread
    this.performHitscan(weapon, muzzlePos, dummies, staticMapGroup);

    return true;
  }

  private performHitscan(
    weapon: WeaponData,
    muzzlePos: THREE.Vector3,
    dummies: TargetDummy[],
    staticMapGroup: THREE.Group
  ) {
    // Calculate spread angle
    const spread = this.recoilSystem.currentSpread;
    const spreadAngle = (Math.random() - 0.5) * spread;
    const spreadPitch = (Math.random() - 0.5) * spread;

    // Ray direction with spread and sniper sway
    const rayDir = new THREE.Vector3(
      spreadAngle + this.recoilSystem.swayOffsetX,
      spreadPitch + this.recoilSystem.swayOffsetY,
      -1
    ).normalize().applyQuaternion(this.camera.quaternion);

    const raycaster = new THREE.Raycaster(this.camera.position, rayDir, 0.1, 500);

    // Gather raycast targets: Dummy hitboxes + Static map colliders
    const raycastableMeshes: THREE.Mesh[] = [];
    for (const d of dummies) {
      if (d.isAlive) {
        raycastableMeshes.push(d.headMesh, d.bodyMesh, d.legsMesh);
      }
    }
    staticMapGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        raycastableMeshes.push(child as THREE.Mesh);
      }
    });

    const hits = raycaster.intersectObjects(raycastableMeshes, false);

    let endPoint = this.camera.position.clone().add(rayDir.clone().multiplyScalar(100));

    if (hits.length > 0) {
      const hit = hits[0];
      endPoint = hit.point;

      // Check if hit a dummy
      const dummy = hit.object.userData?.dummy as TargetDummy | undefined;
      const part = hit.object.userData?.part as 'head' | 'body' | undefined;

      if (dummy && part) {
        const isHeadshot = part === 'head';
        const distance = this.camera.position.distanceTo(hit.point);

        // Calculate Damage with Falloff
        let damage = isHeadshot ? weapon.damage.head : weapon.damage.body;

        if (weapon.damage.falloffStartMeters && distance > weapon.damage.falloffStartMeters) {
          const mult = weapon.damage.falloffMultiplier || 1.0;
          damage = Math.round(damage * mult);
        }

        // Apply damage to dummy
        const result = dummy.takeDamage(damage, isHeadshot, hit.point);

        // Play feedback sounds
        if (isHeadshot) {
          this.audio.playHeadshotDing();
        } else {
          this.audio.playHitmarker();
        }

        if (this.onHit) this.onHit(result);
      } else if (hit.face) {
        // Hit static warehouse surface -> spawn sparks/dust
        this.vfx.spawnImpact(hit.point, hit.face.normal);
      }
    }

    // Tracer logic (M416 every 3rd shot; Operator & Deagle every shot)
    if (this.shotCount % weapon.tracerInterval === 0) {
      this.vfx.spawnTracer(muzzlePos, endPoint);
    }
  }

  public startReload() {
    const weapon = this.activeWeapon;
    const ammo = this.activeAmmo;

    if (this.isReloading || ammo.mag >= weapon.magSize || ammo.reserve <= 0) return;

    const isEmpty = ammo.mag === 0;
    this.isReloading = true;
    this.isAiming = false;
    this.reloadTimer = isEmpty ? weapon.reloadTimeEmpty : weapon.reloadTimeTactical;
    this.audio.playReload();
    if (this.onReloadStart) this.onReloadStart(isEmpty);
    console.log(`[WeaponManager] Reloading ${weapon.name} (${this.reloadTimer}s, empty: ${isEmpty})...`);
  }

  public update(
    dt: number,
    isAimingInput: boolean,
    isCrouching: boolean,
    isSprinting: boolean,
    speed: number,
    dummies: TargetDummy[]
  ) {
    const weapon = this.activeWeapon;
    const ammo = this.activeAmmo;

    // 0. Handle Sprint-to-Fire Transition Timer
    if (this.isSprintTransitioning) {
      this.sprintRecoveryTimer -= dt;
      if (this.sprintRecoveryTimer <= 0) {
        this.sprintRecoveryTimer = 0;
        this.isSprintTransitioning = false;
      }
    }

    // 1. Handle Reload Progress
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const needed = weapon.magSize - ammo.mag;
        const taken = Math.min(needed, ammo.reserve);
        ammo.mag += taken;
        ammo.reserve -= taken;
        console.log(`[WeaponManager] Reload complete! Mag: ${ammo.mag}/${ammo.reserve}`);
      }
    }

    // 2. Handle Bolt Action Cycle for Operator
    if (this.isCyclingBolt) {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) {
        this.isCyclingBolt = false;
      }
    }

    // 3. Handle ADS FOV Transitions
    this.isAiming = isAimingInput && !this.isReloading && !isSprinting;

    let targetFOV = this.baseFOV;
    if (this.isAiming) {
      if (weapon.id === 'operator') {
        const zoom = (weapon.adsZoom as number[])[this.operatorZoomIndex] || 4.0;
        targetFOV = this.baseFOV / zoom; // 22.5 deg (4x) or 11.25 deg (8x)
      } else {
        const zoom = weapon.adsZoom as number;
        targetFOV = this.baseFOV / zoom;
      }
    }

    const zoomSpeed = weapon.id === 'operator' ? 16.0 : 12.0;
    this.currentFOV += (targetFOV - this.currentFOV) * Math.min(1.0, zoomSpeed * dt);
    this.camera.fov = this.currentFOV;
    this.camera.updateProjectionMatrix();

    // 4. Update Recoil & Spread System
    this.recoilSystem.update(dt, weapon, this.isAiming, isCrouching, isSprinting, speed);

    // 5. Update Target Dummies
    for (const d of dummies) {
      d.update(dt, this.camera.position);
    }
  }
}

