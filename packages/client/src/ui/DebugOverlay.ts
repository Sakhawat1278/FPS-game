import * as THREE from 'three';
import { CharacterController } from '../core/CharacterController';

export class DebugOverlay {
  private element: HTMLElement;
  private isVisible: boolean = true;
  private renderer: THREE.WebGLRenderer;

  // Telemetry items
  private fpsEl: HTMLElement | null = null;
  private frameTimeEl: HTMLElement | null = null;
  private drawCallsEl: HTMLElement | null = null;
  private trianglesEl: HTMLElement | null = null;
  private posEl: HTMLElement | null = null;
  private speedEl: HTMLElement | null = null;
  private stanceEl: HTMLElement | null = null;
  private groundedEl: HTMLElement | null = null;

  // FPS calculation
  private frameCount: number = 0;
  private lastFpsTime: number = performance.now();
  private lastFrameTime: number = performance.now();
  private currentFps: number = 60;
  private currentFrameMs: number = 16.6;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.element = document.getElementById('debug-overlay') as HTMLElement;
    this.setupUI();
  }

  private setupUI() {
    if (!this.element) return;

    this.element.innerHTML = `
      <div style="font-weight: bold; color: #f59e0b; margin-bottom: 4px;">[F3] WAREHOUSE STRIKE TELEMETRY</div>
      <div>FPS: <span id="dbg-fps" style="color: #10b981;">60</span> (<span id="dbg-ft">16.6</span> ms)</div>
      <div>Draw Calls: <span id="dbg-dc" style="color: #60a5fa;">0</span> | Triangles: <span id="dbg-tris" style="color: #60a5fa;">0</span></div>
      <div>Pos: <span id="dbg-pos" style="color: #e5e7eb;">0.0, 0.0, 0.0</span></div>
      <div>Speed: <span id="dbg-speed" style="color: #e5e7eb;">0.0</span> m/s</div>
      <div>Stance: <span id="dbg-stance" style="color: #a78bfa;">Standing</span> | Grounded: <span id="dbg-grounded" style="color: #10b981;">YES</span></div>
      <div style="color: #9ca3af; font-size: 11px; margin-top: 4px;">Physics: Rapier WASM | Renderer: WebGL2</div>
    `;

    this.fpsEl = document.getElementById('dbg-fps');
    this.frameTimeEl = document.getElementById('dbg-ft');
    this.drawCallsEl = document.getElementById('dbg-dc');
    this.trianglesEl = document.getElementById('dbg-tris');
    this.posEl = document.getElementById('dbg-pos');
    this.speedEl = document.getElementById('dbg-speed');
    this.stanceEl = document.getElementById('dbg-stance');
    this.groundedEl = document.getElementById('dbg-grounded');
  }

  public toggle() {
    this.isVisible = !this.isVisible;
    if (this.element) {
      this.element.style.display = this.isVisible ? 'block' : 'none';
    }
  }

  public update(charController: CharacterController) {
    const now = performance.now();
    this.frameCount++;
    this.currentFrameMs = now - this.lastFrameTime;
    this.lastFrameTime = now;

    if (now - this.lastFpsTime >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;

      if (this.isVisible) {
        if (this.fpsEl) this.fpsEl.innerText = this.currentFps.toString();
        if (this.frameTimeEl) this.frameTimeEl.innerText = this.currentFrameMs.toFixed(1);
        if (this.drawCallsEl) this.drawCallsEl.innerText = this.renderer.info.render.calls.toString();
        if (this.trianglesEl) this.trianglesEl.innerText = this.renderer.info.render.triangles.toString();
      }
    }

    if (this.isVisible) {
      if (this.posEl) {
        this.posEl.innerText = `${charController.position.x.toFixed(1)}, ${charController.position.y.toFixed(1)}, ${charController.position.z.toFixed(1)}`;
      }
      if (this.speedEl) {
        this.speedEl.innerText = charController.horizontalSpeed.toFixed(1);
      }
      if (this.stanceEl) {
        let stance = 'Standing';
        if (charController.isCrouched) stance = 'Crouched';
        else if (charController.isSprinting) stance = 'Sprinting';
        this.stanceEl.innerText = stance;
      }
      if (this.groundedEl) {
        this.groundedEl.innerText = charController.isGrounded ? 'YES' : 'NO';
        this.groundedEl.style.color = charController.isGrounded ? '#10b981' : '#f87171';
      }
    }
  }
}

