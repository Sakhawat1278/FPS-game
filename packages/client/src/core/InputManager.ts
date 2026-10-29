import { PlayerInput } from '@warehouse-strike/shared';
import { settingsManager } from '../settings/SettingsManager';

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

  // Sequencer
  private seq: number = 0;

  // Custom callbacks
  public onDebugToggle?: () => void;
  public onReload?: () => void;
  public onSlot1?: () => void;
  public onSlot2?: () => void;
  public onSwapPrimary?: () => void;
  public onToggleZoom?: () => void;
  public onTogglePerspective?: () => void;

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

      const s = settingsManager.current.controls;
      const baseSens = s.sensitivity * 0.001;
      const invert = s.invertY ? -1 : 1;

      this.yaw -= e.movementX * baseSens;
      this.pitch -= e.movementY * baseSens * invert;

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

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    window.addEventListener('wheel', (e) => {
      if (!this.isPointerLocked) return;
      if (this.onToggleZoom) this.onToggleZoom();
    });

    // Keyboard keys (using dynamic rebindable keycodes)
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      this.keys[code] = true;
      const b = settingsManager.current.controls.bindings;

      if (code === b.scoreboard) {
        e.preventDefault();
        this.isTabDown = true;
      } else if (code === 'F3') {
        e.preventDefault();
        if (this.onDebugToggle) this.onDebugToggle();
      } else if (code === b.reload) {
        if (this.onReload) this.onReload();
      } else if (code === b.slot1) {
        if (this.onSlot1) this.onSlot1();
      } else if (code === b.slot2) {
        if (this.onSlot2) this.onSlot2();
      } else if (code === b.swapWeapon) {
        if (this.onSwapPrimary) this.onSwapPrimary();
      } else if (code === 'KeyZ') {
        if (this.onToggleZoom) this.onToggleZoom();
      } else if (code === 'KeyV') {
        if (this.onTogglePerspective) this.onTogglePerspective();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      const b = settingsManager.current.controls.bindings;
      if (codeOrTab(e.code, b.scoreboard)) {
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

    const b = settingsManager.current.controls.bindings;
    let moveForward = 0;
    let moveRight = 0;

    if (this.keys[b.forward]) moveForward += 1;
    if (this.keys[b.backward]) moveForward -= 1;
    if (this.keys[b.right]) moveRight += 1;
    if (this.keys[b.left]) moveRight -= 1;

    const isSprinting = Boolean(this.keys[b.sprint]);
    const isCrouching = Boolean(this.keys[b.crouch]);
    const isJumping = Boolean(this.keys[b.jump]);

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

function codeOrTab(code: string, bound: string): boolean {
  return code === bound || (bound === 'Tab' && code === 'Tab');
}

