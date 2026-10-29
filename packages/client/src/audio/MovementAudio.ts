import { AudioEngine } from './AudioEngine';
import { CharacterController } from '../core/CharacterController';

export class MovementAudio {
  private audioEngine: AudioEngine;
  private footstepTimer: number = 0;
  private wasInAir: boolean = false;

  constructor(audioEngine: AudioEngine) {
    this.audioEngine = audioEngine;
  }

  public update(dt: number, charController: CharacterController) {
    const isGrounded = charController.isGrounded;
    const speed = charController.horizontalSpeed;
    const y = charController.position.y;
    const isCatwalk = y >= 2.8; // Elevated catwalk / mezzanine area

    // 1. Landing Detection
    if (!this.wasInAir && !isGrounded) {
      this.wasInAir = true;
    } else if (this.wasInAir && isGrounded) {
      this.wasInAir = false;
      this.audioEngine.playLand();
    }

    // 2. Footstep Cadence
    if (isGrounded && speed > 0.5) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        let interval = 0.48; // Normal walk
        let speedMult = 0.8;

        if (charController.isSprinting) {
          interval = 0.32; // Sprinting fast pace
          speedMult = 1.2;
        } else if (charController.isCrouched) {
          interval = 0.70; // Slow quiet crouch
          speedMult = 0.45;
        }

        this.footstepTimer = interval;
        this.audioEngine.playFootstep(isCatwalk, speedMult);
      }
    } else {
      this.footstepTimer = 0.1;
    }
  }
}
