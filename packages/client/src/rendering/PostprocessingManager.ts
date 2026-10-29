import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra' | 'auto';

export class PostprocessingManager {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloomPass: UnrealBloomPass;

  public currentPreset: QualityPreset = 'high';
  private frameTimes: number[] = [];
  private lastAutoAdjust: number = performance.now();

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;

    // ACES Filmic Tone Mapping (Natural, eye-friendly exposure)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;

    // Setup Effect Composer
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Subtle bloom (no blinding glares)
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.bloomPass = new UnrealBloomPass(resolution, 0.12, 0.3, 0.92);
    this.composer.addPass(this.bloomPass);

    this.applyPreset('high');
  }

  public setPreset(preset: QualityPreset) {
    this.currentPreset = preset;
    if (preset !== 'auto') {
      this.applyPreset(preset);
    }
  }

  private applyPreset(preset: 'low' | 'medium' | 'high' | 'ultra') {
    switch (preset) {
      case 'low':
        this.renderer.setPixelRatio(1.0);
        this.renderer.shadowMap.enabled = false;
        this.bloomPass.enabled = false;
        break;
      case 'medium':
        this.renderer.setPixelRatio(1.0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        this.bloomPass.enabled = true;
        this.bloomPass.strength = 0.1;
        this.bloomPass.threshold = 0.94;
        break;
      case 'high':
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.bloomPass.enabled = true;
        this.bloomPass.strength = 0.12;
        this.bloomPass.threshold = 0.92;
        break;
      case 'ultra':
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.bloomPass.enabled = true;
        this.bloomPass.strength = 0.18;
        this.bloomPass.threshold = 0.90;
        break;
    }
  }

  public resize(width: number, height: number) {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  public render(dtMs: number) {
    // Dynamic Auto quality tuning based on measured frame time
    if (this.currentPreset === 'auto') {
      this.frameTimes.push(dtMs);
      if (this.frameTimes.length > 60) this.frameTimes.shift();

      const now = performance.now();
      if (now - this.lastAutoAdjust > 3000 && this.frameTimes.length >= 30) {
        this.lastAutoAdjust = now;
        const avgFt = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        if (avgFt > 18.0) {
          // FPS dropped below 55 -> step down to Medium
          this.applyPreset('medium');
        } else if (avgFt < 14.0) {
          // Smooth 70+ FPS -> step up to High
          this.applyPreset('high');
        }
      }
    }

    this.composer.render();
  }
}

