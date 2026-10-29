import { WeaponData } from '@warehouse-strike/shared';

export class RecoilSystem {
  // Accumulated recoil displacement currently applied to camera
  public currentPitchRecoil: number = 0;
  public currentYawRecoil: number = 0;

  // Viewmodel kick
  public viewmodelKickZ: number = 0; // backward kick
  public viewmodelKickPitch: number = 0; // upward muzzle flip

  // Dynamic Spread
  public currentSpread: number = 0.035;

  // Sniper Sway
  private swayTime: number = 0;
  public swayOffsetX: number = 0;
  public swayOffsetY: number = 0;

  public applyRecoil(weapon: WeaponData) {
    const r = weapon.recoil;
    this.currentPitchRecoil += r.pitchKick;

    const yawKick = r.yawKickMin + Math.random() * (r.yawKickMax - r.yawKickMin);
    this.currentYawRecoil += yawKick;

    this.viewmodelKickZ += r.cameraKick * 1.5;
    this.viewmodelKickPitch += r.pitchKick * 1.8;

    // Spread bloom per shot
    this.currentSpread = Math.min(weapon.spread.maxHipSpread, this.currentSpread + 0.02);
  }

  public update(
    dt: number,
    weapon: WeaponData,
    isAiming: boolean,
    isCrouching: boolean,
    isSprinting: boolean,
    speed: number
  ) {
    // 1. Recoil Recovery (smooth return towards 0)
    const recoveryRate = weapon.recoil.recoverySpeed;
    this.currentPitchRecoil = Math.max(0, this.currentPitchRecoil - recoveryRate * dt);

    if (Math.abs(this.currentYawRecoil) > 0.0001) {
      const step = recoveryRate * dt;
      if (Math.abs(this.currentYawRecoil) <= step) {
        this.currentYawRecoil = 0;
      } else {
        this.currentYawRecoil -= Math.sign(this.currentYawRecoil) * step;
      }
    }

    // Viewmodel recovery
    this.viewmodelKickZ = Math.max(0, this.viewmodelKickZ - 14.0 * dt);
    this.viewmodelKickPitch = Math.max(0, this.viewmodelKickPitch - 14.0 * dt);

    // 2. Dynamic Spread Calculation
    let targetSpread = weapon.spread.baseHipSpread;
    if (isAiming) {
      targetSpread *= weapon.spread.adsSpreadMultiplier;
    } else {
      if (isSprinting) {
        targetSpread += weapon.spread.sprintSpreadPenalty;
      } else if (speed > 0.5) {
        targetSpread += weapon.spread.moveSpreadPenalty;
      }
    }

    // Spread approach target
    if (this.currentSpread > targetSpread) {
      this.currentSpread = Math.max(targetSpread, this.currentSpread - weapon.spread.spreadRecoverySpeed * dt);
    } else {
      this.currentSpread += (targetSpread - this.currentSpread) * Math.min(1.0, 10.0 * dt);
    }

    // 3. Sniper Scope Sway
    if (isAiming && weapon.id === 'operator') {
      this.swayTime += dt * 2.0;
      let swayAmp = weapon.spread.scopeSwayAmount;
      if (isCrouching) swayAmp *= weapon.spread.crouchSwayMultiplier;

      this.swayOffsetX = Math.sin(this.swayTime) * swayAmp;
      this.swayOffsetY = Math.cos(this.swayTime * 1.5) * swayAmp;
    } else {
      this.swayOffsetX = 0;
      this.swayOffsetY = 0;
    }
  }
}
