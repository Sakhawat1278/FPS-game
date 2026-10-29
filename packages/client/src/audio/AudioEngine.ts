import * as THREE from 'three';

export interface SoundSettings {
  masterVolume: number;
  sfxVolume: number;
  footstepsVolume: number;
  hitVolume: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  public isUnlocked: boolean = false;

  // Audio Graph Buses
  private masterGain!: GainNode;
  private sfxGain!: GainNode;
  private footstepGain!: GainNode;
  private hitGain!: GainNode;

  // Warehouse Convolution Reverb
  private reverbNode!: ConvolverNode;
  private reverbGain!: GainNode;

  // Active Voice Limiting (max 32 concurrent voices)
  private activeVoicesCount: number = 0;
  private maxVoices: number = 32;

  // Real Audio Samples Cache
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private pendingPreloads: Map<string, Promise<ArrayBuffer>> = new Map();

  // Settings
  public settings: SoundSettings = {
    masterVolume: 1.0,
    sfxVolume: 0.9,
    footstepsVolume: 0.75,
    hitVolume: 0.9
  };

  constructor() {
    // Pre-fetch realistic audio files immediately so they are cached in RAM
    this.preloadAudio('m416_fire', '/audio/m416_fire.mp3');

    const unlock = () => {
      this.initContext();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
  }

  public preloadAudio(key: string, url: string) {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .catch((err) => {
        console.warn(`[AudioEngine] Could not pre-fetch ${url}:`, err);
        return new ArrayBuffer(0);
      });
    this.pendingPreloads.set(key, promise);
  }

  private async decodePreloadedAudio() {
    if (!this.ctx) return;
    for (const [key, promise] of this.pendingPreloads.entries()) {
      if (this.audioBuffers.has(key)) continue;
      try {
        const arrayBuf = await promise;
        if (arrayBuf.byteLength > 0) {
          const audioBuf = await this.ctx.decodeAudioData(arrayBuf.slice(0));
          this.audioBuffers.set(key, audioBuf);
          console.log(`[AudioEngine] Successfully cached authentic audio: "${key}"`);
        }
      } catch (err) {
        console.warn(`[AudioEngine] Failed to decode audio "${key}":`, err);
      }
    }
  }

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isUnlocked = true;

    // Build Master Audio Graph
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.settings.masterVolume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(this.settings.sfxVolume, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    this.footstepGain = this.ctx.createGain();
    this.footstepGain.gain.setValueAtTime(this.settings.footstepsVolume, this.ctx.currentTime);
    this.footstepGain.connect(this.masterGain);

    this.hitGain = this.ctx.createGain();
    this.hitGain.gain.setValueAtTime(this.settings.hitVolume, this.ctx.currentTime);
    this.hitGain.connect(this.masterGain);

    // Build Warehouse Impulse Response (1.8s decay, concrete acoustics)
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this.buildWarehouseImpulse(1.8, 2.5);

    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.setValueAtTime(0.35, this.ctx.currentTime); // 35% wet reverb
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);

    // Decode preloaded authentic samples
    this.decodePreloadedAudio();
  }

  private buildWarehouseImpulse(duration: number, decay: number): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext not ready');
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.ctx.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    // Initial pre-delay for 70m warehouse room reflections
    const preDelaySamples = Math.floor(sampleRate * 0.025); // 25ms pre-delay

    for (let i = 0; i < length; i++) {
      if (i < preDelaySamples) {
        left[i] = 0;
        right[i] = 0;
      } else {
        const t = (i - preDelaySamples) / length;
        const envelope = Math.exp(-t * decay);
        left[i] = (Math.random() * 2 - 1) * envelope;
        right[i] = (Math.random() * 2 - 1) * envelope;
      }
    }

    return buffer;
  }

  // Update 3D Listener coordinates each frame
  public updateListener(camera: THREE.Camera) {
    if (!this.ctx || !this.isUnlocked) return;

    const p = camera.position;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.setValueAtTime(p.x, this.ctx.currentTime);
      l.positionY.setValueAtTime(p.y, this.ctx.currentTime);
      l.positionZ.setValueAtTime(p.z, this.ctx.currentTime);
      l.forwardX.setValueAtTime(f.x, this.ctx.currentTime);
      l.forwardY.setValueAtTime(f.y, this.ctx.currentTime);
      l.forwardZ.setValueAtTime(f.z, this.ctx.currentTime);
      l.upX.setValueAtTime(u.x, this.ctx.currentTime);
      l.upY.setValueAtTime(u.y, this.ctx.currentTime);
      l.upZ.setValueAtTime(u.z, this.ctx.currentTime);
    } else {
      // Legacy fallback
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
  }

  // Create 3D Spatial Panner Node
  private createPanner(pos: THREE.Vector3, isOccluded: boolean = false): { panner: PannerNode; filter: BiquadFilterNode } {
    if (!this.ctx) throw new Error('No AudioContext');

    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 3.0; // sounds loud within 3m
    panner.maxDistance = 120.0;
    panner.rolloffFactor = 1.1;

    panner.positionX.setValueAtTime(pos.x, this.ctx.currentTime);
    panner.positionY.setValueAtTime(pos.y, this.ctx.currentTime);
    panner.positionZ.setValueAtTime(pos.z, this.ctx.currentTime);

    // Occlusion Low-Pass Filter (muffled behind warehouse walls)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isOccluded ? 850 : 18000, this.ctx.currentTime);

    filter.connect(panner);
    panner.connect(this.sfxGain);
    panner.connect(this.reverbNode); // Send to warehouse reverb bus!

    return { panner, filter };
  }

  // -------------------------------------------------------------
  // LOCAL WEAPON SOUNDS (Punchy Transients + Warehouse Reverb)
  // -------------------------------------------------------------
  public playM416() {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    const sample = this.audioBuffers.get('m416_fire');
    if (sample) {
      // Play authentic recorded gunshot with dynamic pitch variance for organic firing feel
      const source = this.ctx.createBufferSource();
      source.buffer = sample;
      source.playbackRate.setValueAtTime(0.97 + Math.random() * 0.06, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.95, t);

      source.connect(gain);
      gain.connect(this.sfxGain);
      gain.connect(this.reverbNode);
      source.start(t);
      return;
    }

    // Procedural fallback
    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.025));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    gain.connect(this.reverbNode); // send to warehouse reverb
    noise.start(t);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);

    oscGain.gain.setValueAtTime(0.7, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playOperator() {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.6;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    gain.connect(this.reverbNode);
    noise.start(t);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.25);

    oscGain.gain.setValueAtTime(1.0, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  public playDeagle() {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.04));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(1.5, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    gain.connect(this.reverbNode);
    noise.start(t);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);

    oscGain.gain.setValueAtTime(0.8, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  public playBoltCycle() {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;
    [0.1, 0.45].forEach((offset) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, t + offset);
      osc.frequency.exponentialRampToValueAtTime(250, t + offset + 0.06);

      gain.gain.setValueAtTime(0.3, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.06);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.06);
    });
  }

  public playReload() {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    osc1.frequency.setValueAtTime(600, t);
    osc1.frequency.exponentialRampToValueAtTime(180, t + 0.08);
    g1.gain.setValueAtTime(0.4, t);
    g1.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    osc1.connect(g1);
    g1.connect(this.sfxGain);
    osc1.start(t);
    osc1.stop(t + 0.08);

    const osc2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc2.frequency.setValueAtTime(350, t + 0.5);
    osc2.frequency.exponentialRampToValueAtTime(850, t + 0.58);
    g2.gain.setValueAtTime(0.4, t + 0.5);
    g2.gain.exponentialRampToValueAtTime(0.01, t + 0.58);
    osc2.connect(g2);
    g2.connect(this.sfxGain);
    osc2.start(t + 0.5);
    osc2.stop(t + 0.58);
  }

  public playDryFire() {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(950, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.035);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.035);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.035);
  }

  public playShellCasingDrop() {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    // Metallic ping / tink of spent brass casing bouncing on ground
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const baseFreq = 2600 + Math.random() * 800;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, t + 0.05);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playHitmarker() {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.04);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);

    osc.connect(gain);
    gain.connect(this.hitGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  public playHeadshotDing() {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2600, t);
    osc.frequency.setValueAtTime(2600, t + 0.12);

    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.hitGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  // -------------------------------------------------------------
  // FOOTSTEPS & JUMP/LAND SOUNDS
  // -------------------------------------------------------------
  public playFootstep(isCatwalk: boolean, speedMultiplier: number = 1.0) {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (isCatwalk) {
      // Metal grating resonant clink
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(380, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.08);

      gain.gain.setValueAtTime(0.28 * speedMultiplier, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    } else {
      // Concrete heavy boot impact
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.07);

      gain.gain.setValueAtTime(0.22 * speedMultiplier, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    }

    osc.connect(gain);
    gain.connect(this.footstepGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  public playSpatialFootstep(pos: THREE.Vector3, isCatwalk: boolean, isOccluded: boolean = false) {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;
    const { filter } = this.createPanner(pos, isOccluded);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isCatwalk ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isCatwalk ? 350 : 130, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(filter);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  public playJump() {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.linearRampToValueAtTime(220, t + 0.12);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    osc.connect(gain);
    gain.connect(this.footstepGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  public playLand() {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    // Heavy landing thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.footstepGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // -------------------------------------------------------------
  // SPATIAL WEAPON FIRE (Remote gunshots with distance falloff & reverb)
  // -------------------------------------------------------------
  public playSpatialGunfire(pos: THREE.Vector3, weaponId: string, isOccluded: boolean = false) {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;
    const { filter } = this.createPanner(pos, isOccluded);

    if (weaponId === 'm416' && this.audioBuffers.has('m416_fire')) {
      const source = this.ctx.createBufferSource();
      source.buffer = this.audioBuffers.get('m416_fire')!;
      source.playbackRate.setValueAtTime(0.97 + Math.random() * 0.06, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.85, t);

      source.connect(gain);
      gain.connect(filter);
      gain.connect(this.reverbNode);
      source.start(t);
      return;
    }

    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.04));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = this.ctx.createGain();
    const vol = weaponId === 'operator' ? 1.0 : 0.75;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    noise.connect(gain);
    gain.connect(filter);
    noise.start(t);
  }

  // -------------------------------------------------------------
  // BULLET NEAR-MISS WHIZZ-BY & IMPACTS
  // -------------------------------------------------------------
  public playBulletWhizzby() {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    // High velocity Doppler zip
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(3200, t);
    osc.frequency.exponentialRampToValueAtTime(750, t + 0.06);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // -------------------------------------------------------------
  // MATCH COUNTDOWN & STINGERS
  // -------------------------------------------------------------
  public playCountdownBeep(isFinalGo: boolean = false) {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    if (isFinalGo) {
      osc.frequency.setValueAtTime(1600, t);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    } else {
      osc.frequency.setValueAtTime(800, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t);
      osc.stop(t + 0.12);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
  }

  public playMatchStartStinger() {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    // Uplifting military brass chord
    [440, 554.37, 659.25].forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.2);
    });
  }

  public playVictoryStinger() {
    if (!this.ctx || !this.isUnlocked) return;
    const t = this.ctx.currentTime;

    // Triumphant fanfare
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const startT = t + idx * 0.12;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startT);

      gain.gain.setValueAtTime(0.3, startT);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.8);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startT);
      osc.stop(startT + 0.8);
    });
  }
}
