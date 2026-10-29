import { PlayerInput } from '@warehouse-strike/shared';

export class InputManager {
  private canvas: HTMLCanvasElement;
  private isPointerLocked: boolean = false;

  // Key states
  private keys: Record<string, boolean> = {};
  
  // Look angles (radians)
  public yaw: number = 0;
  public pitch: number = 0;

  // Sensitivity
  public mouseSensitivity: number = 0.0022;

  // Sequencer
  private seq: number = 0;

  // Custom callback for toggles (e.g. F3)
  public onDebugToggle?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupListeners();
  }

  private setupListeners() {
    this.canvas.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked) return;

      this.yaw -= e.movementX * this.mouseSensitivity;
      this.pitch -= e.movementY * this.mouseSensitivity;

      // Clamp pitch to [-89 deg, +89 deg] in radians
      const maxPitch = (89 * Math.PI) / 180;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      this.keys[code] = true;

      if (code === 'F3') {
        e.preventDefault();
        if (this.onDebugToggle) this.onDebugToggle();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  public get isLocked(): boolean {
    return this.isPointerLocked;
  }

  public setLook(yaw: number, pitch: number) {
    this.yaw = yaw;
    this.pitch = pitch;
  }

  public sampleInput(tick: number): PlayerInput {
    this.seq++;

    let moveForward = 0;
    let moveRight = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveForward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveForward -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveRight += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveRight -= 1;

    const isSprinting = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const isCrouching = Boolean(this.keys['ControlLeft'] || this.keys['KeyC']);
    const isJumping = Boolean(this.keys['Space']);

    return {
      seq: this.seq,
      tick,
      timestamp: performance.now(),
      moveForward,
      moveRight,
      yaw: this.yaw,
      pitch: this.pitch,
      isSprinting,
      isCrouching,
      isJumping,
      isShooting: false,
      isAiming: false
    };
  }
}
