import { PlayerInput } from '@warehouse-strike/shared';

export class InputManager {
  private canvas: HTMLCanvasElement;
  private isPointerLocked: boolean = false;

  // Key states
  private keys: Record<string, boolean> = {};
  public isLmbDown: boolean = false;
  public isRmbDown: boolean = false;
  public isTabDown: boolean = false;

  // Look angles (radians)
  public yaw: number = 0;
  public pitch: number = 0;

  // Sensitivity
  public mouseSensitivity: number = 0.0022;

  // Sequencer
  private seq: number = 0;

  // Custom callbacks
  public onDebugToggle?: () => void;
  public onReload?: () => void;
  public onSlot1?: () => void;
  public onSlot2?: () => void;
  public onSwapPrimary?: () => void;
  public onToggleZoom?: () => void;

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

    // Mouse movement
    document.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked) return;

      this.yaw -= e.movementX * this.mouseSensitivity;
      this.pitch -= e.movementY * this.mouseSensitivity;

      // Clamp pitch to [-89 deg, +89 deg] in radians
      const maxPitch = (89 * Math.PI) / 180;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });

    // Mouse buttons
    window.addEventListener('mousedown', (e) => {
      if (!this.isPointerLocked) return;
      if (e.button === 0) this.isLmbDown = true;
      if (e.button === 2) this.isRmbDown = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isLmbDown = false;
      if (e.button === 2) this.isRmbDown = false;
    });

    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Mouse wheel for Operator zoom / swap
    window.addEventListener('wheel', (e) => {
      if (!this.isPointerLocked) return;
      if (this.onToggleZoom) this.onToggleZoom();
    });

    // Keyboard keys
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      this.keys[code] = true;

      if (code === 'Tab') {
        e.preventDefault();
        this.isTabDown = true;
      } else if (code === 'F3') {
        e.preventDefault();
        if (this.onDebugToggle) this.onDebugToggle();
      } else if (code === 'KeyR') {
        if (this.onReload) this.onReload();
      } else if (code === 'Digit1') {
        if (this.onSlot1) this.onSlot1();
      } else if (code === 'Digit2') {
        if (this.onSlot2) this.onSlot2();
      } else if (code === 'KeyQ') {
        if (this.onSwapPrimary) this.onSwapPrimary();
      } else if (code === 'KeyZ') {
        if (this.onToggleZoom) this.onToggleZoom();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Tab') {
        e.preventDefault();
        this.isTabDown = false;
      }
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
      isShooting: this.isLmbDown,
      isAiming: this.isRmbDown
    };
  }
}
