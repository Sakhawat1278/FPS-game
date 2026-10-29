import { WeaponManager } from '../weapons/WeaponManager';
import { DummyHitResult } from '../entities/TargetDummy';
import { settingsManager } from '../settings/SettingsManager';

export class WeaponHUD {
  private container: HTMLElement;
  private ammoEl: HTMLElement | null = null;
  private weaponNameEl: HTMLElement | null = null;
  private fireModeEl: HTMLElement | null = null;
  private slotPillsEl: HTMLElement | null = null;
  private reloadPromptEl: HTMLElement | null = null;

  // Crosshair
  private crosshairEl: HTMLElement | null = null;
  private chTop: HTMLElement | null = null;
  private chBottom: HTMLElement | null = null;
  private chLeft: HTMLElement | null = null;
  private chRight: HTMLElement | null = null;

  // Scope
  private scopeOverlayEl: HTMLElement | null = null;
  private scopeZoomEl: HTMLElement | null = null;

  // Hitmarker
  private hitmarkerEl: HTMLElement | null = null;
  private hitmarkerTimer: number = 0;
  private hitTextEl: HTMLElement | null = null;

  constructor() {
    this.container = document.body;
    this.setupHUD();
  }

  private setupHUD() {
    // 1. Crosshair Container
    const ch = document.createElement('div');
    ch.id = 'dynamic-crosshair';
    ch.innerHTML = `
      <div class="ch-line ch-top"></div>
      <div class="ch-line ch-bottom"></div>
      <div class="ch-line ch-left"></div>
      <div class="ch-line ch-right"></div>
      <div class="ch-dot"></div>
    `;
    this.container.appendChild(ch);
    this.crosshairEl = ch;
    this.chTop = ch.querySelector('.ch-top');
    this.chBottom = ch.querySelector('.ch-bottom');
    this.chLeft = ch.querySelector('.ch-left');
    this.chRight = ch.querySelector('.ch-right');

    // 2. Sniper Scope Overlay
    const scope = document.createElement('div');
    scope.id = 'sniper-scope-overlay';
    scope.style.display = 'none';
    scope.innerHTML = `
      <div class="scope-vignette"></div>
      <div class="scope-reticle-h"></div>
      <div class="scope-reticle-v"></div>
      <div class="scope-circle"></div>
      <div id="scope-zoom-text" class="scope-zoom">4× ZOOM [Z / SCROLL]</div>
    `;
    this.container.appendChild(scope);
    this.scopeOverlayEl = scope;
    this.scopeZoomEl = scope.querySelector('#scope-zoom-text');

    // 3. Hitmarker Overlay
    const hm = document.createElement('div');
    hm.id = 'hitmarker-container';
    hm.style.display = 'none';
    hm.innerHTML = `
      <div class="hm-line hm-1"></div>
      <div class="hm-line hm-2"></div>
      <div class="hm-line hm-3"></div>
      <div class="hm-line hm-4"></div>
      <div id="hit-feedback-text"></div>
    `;
    this.container.appendChild(hm);
    this.hitmarkerEl = hm;
    this.hitTextEl = hm.querySelector('#hit-feedback-text');

    // 4. Weapon / Ammo Card (Bottom-Right)
    const card = document.createElement('div');
    card.id = 'weapon-hud-card';
    card.innerHTML = `
      <div class="wh-top">
        <span id="wh-name">M416</span>
        <span id="wh-firemode">[AUTO]</span>
      </div>
      <div class="wh-ammo">
        <span id="wh-mag">30</span>
        <span id="wh-reserve">/ 120</span>
      </div>
      <div id="wh-reload-prompt" style="display: none;">RELOADING...</div>
      <div class="wh-slots" id="wh-slots">
        <span class="slot-badge active" id="slot-1-badge">[1] M416</span>
        <span class="slot-badge" id="slot-2-badge">[2] DESERT EAGLE</span>
      </div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">
        1/2 Swap Slot · Q Swap Primary · R Reload · LMB Fire · RMB ADS
      </div>
    `;
    this.container.appendChild(card);

    this.weaponNameEl = card.querySelector('#wh-name');
    this.fireModeEl = card.querySelector('#wh-firemode');
    this.ammoEl = card.querySelector('#wh-mag');
    this.slotPillsEl = card.querySelector('#wh-slots');
    this.reloadPromptEl = card.querySelector('#wh-reload-prompt');

    // Add HUD Styles
    this.injectStyles();
  }

  public showHit(result: DummyHitResult) {
    if (!this.hitmarkerEl) return;
    this.hitmarkerEl.style.display = 'block';
    this.hitmarkerTimer = 0.22; // 220ms

    const isHead = result.isHeadshot;
    const isKill = result.isKilled;

    const lines = this.hitmarkerEl.querySelectorAll('.hm-line');
    lines.forEach((l) => {
      (l as HTMLElement).style.background = isHead || isKill ? '#ef4444' : '#ffffff';
    });

    if (this.hitTextEl) {
      if (isKill) {
        this.hitTextEl.innerText = isHead ? `KILL CONFIRMED! (+${result.damage} HEADSHOT)` : `KILL CONFIRMED! (+${result.damage})`;
        this.hitTextEl.style.color = '#ef4444';
      } else {
        this.hitTextEl.innerText = isHead ? `HEADSHOT -${result.damage}` : `-${result.damage}`;
        this.hitTextEl.style.color = isHead ? '#f87171' : '#38bdf8';
      }
    }
  }

  public update(dt: number, wm: WeaponManager) {
    const weapon = wm.activeWeapon;
    const ammo = wm.activeAmmo;

    // 1. Hitmarker fade
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      if (this.hitmarkerTimer <= 0 && this.hitmarkerEl) {
        this.hitmarkerEl.style.display = 'none';
      }
    }

    // 2. Weapon & Ammo info
    if (this.weaponNameEl) this.weaponNameEl.innerText = weapon.name;
    if (this.fireModeEl) this.fireModeEl.innerText = `[${weapon.fireMode.toUpperCase()}]`;
    if (this.ammoEl) {
      this.ammoEl.innerText = ammo.mag.toString();
      this.ammoEl.style.color = ammo.mag === 0 ? '#ef4444' : (ammo.mag <= 5 ? '#f59e0b' : '#ffffff');
    }
    const resEl = document.getElementById('wh-reserve');
    if (resEl) resEl.innerText = `/ ${ammo.reserve}`;

    // Reload prompt
    if (this.reloadPromptEl) {
      this.reloadPromptEl.style.display = wm.isReloading ? 'block' : 'none';
    }

    // Slot pills highlight
    const s1 = document.getElementById('slot-1-badge');
    const s2 = document.getElementById('slot-2-badge');
    if (s1 && s2) {
      if (wm.activeSlot === 1) {
        s1.className = 'slot-badge active';
        s1.innerText = `[1] ${wm.primaryId.toUpperCase()}`;
        s2.className = 'slot-badge';
      } else {
        s1.className = 'slot-badge';
        s1.innerText = `[1] ${wm.primaryId.toUpperCase()}`;
        s2.className = 'slot-badge active';
      }
    }

    // 3. Dynamic Crosshair spread expansion
    const isOperatorScoped = weapon.id === 'operator' && wm.isAiming;

    if (isOperatorScoped) {
      if (this.crosshairEl) this.crosshairEl.style.display = 'none';
      if (this.scopeOverlayEl) {
        this.scopeOverlayEl.style.display = 'block';
        if (this.scopeZoomEl) {
          const zoomLevel = wm.operatorZoomIndex === 0 ? '4×' : '8×';
          this.scopeZoomEl.innerText = `${zoomLevel} ZOOM [Z / SCROLL TO TOGGLE]`;
        }
      }
    } else {
      if (this.scopeOverlayEl) this.scopeOverlayEl.style.display = 'none';
      if (this.crosshairEl) {
        this.crosshairEl.style.display = 'flex';
        const chSettings = settingsManager.current.crosshair;

        // Apply custom crosshair color, size, thickness
        const lines = this.crosshairEl.querySelectorAll('.ch-line') as NodeListOf<HTMLElement>;
        lines.forEach((l) => {
          l.style.background = chSettings.color;
          l.style.boxShadow = `0 0 3px ${chSettings.color}`;
        });

        const chDot = this.crosshairEl.querySelector('.ch-dot') as HTMLElement;
        if (chDot) {
          chDot.style.background = chSettings.color;
          chDot.style.display = chSettings.style === 'dot' || chSettings.style === 'cross' ? 'block' : 'none';
        }

        if (this.chTop && this.chBottom) {
          this.chTop.style.width = `${chSettings.thickness}px`;
          this.chTop.style.height = `${chSettings.size}px`;
          this.chBottom.style.width = `${chSettings.thickness}px`;
          this.chBottom.style.height = `${chSettings.size}px`;
          this.chTop.style.display = chSettings.style === 'dot' ? 'none' : 'block';
          this.chBottom.style.display = chSettings.style === 'dot' ? 'none' : 'block';
        }

        if (this.chLeft && this.chRight) {
          this.chLeft.style.height = `${chSettings.thickness}px`;
          this.chLeft.style.width = `${chSettings.size}px`;
          this.chRight.style.height = `${chSettings.thickness}px`;
          this.chRight.style.width = `${chSettings.size}px`;
          this.chLeft.style.display = chSettings.style === 'dot' ? 'none' : 'block';
          this.chRight.style.display = chSettings.style === 'dot' ? 'none' : 'block';
        }

        // Base gap + spread dynamic expansion
        const gapPx = Math.round(wm.recoilSystem.currentSpread * 350) + chSettings.gap;
        if (this.chTop) this.chTop.style.transform = `translateY(-${gapPx}px)`;
        if (this.chBottom) this.chBottom.style.transform = `translateY(${gapPx}px)`;
        if (this.chLeft) this.chLeft.style.transform = `translateX(-${gapPx}px)`;
        if (this.chRight) this.chRight.style.transform = `translateX(${gapPx}px)`;
      }
    }
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      /* Dynamic Crosshair */
      #dynamic-crosshair {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ch-line {
        position: absolute;
        background: #38bdf8;
        box-shadow: 0 0 3px rgba(2, 132, 199, 0.8);
        border-radius: 1px;
      }
      .ch-top, .ch-bottom { width: 2px; height: 10px; }
      .ch-left, .ch-right { width: 10px; height: 2px; }
      .ch-dot {
        width: 3px;
        height: 3px;
        background: #38bdf8;
        border-radius: 50%;
      }

      /* Hitmarker */
      #hitmarker-container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 32px;
        height: 32px;
        pointer-events: none;
      }
      .hm-line {
        position: absolute;
        width: 9px;
        height: 2px;
        background: #ffffff;
      }
      .hm-1 { top: 6px; left: 6px; transform: rotate(45deg); }
      .hm-2 { top: 6px; right: 6px; transform: rotate(-45deg); }
      .hm-3 { bottom: 6px; left: 6px; transform: rotate(-45deg); }
      .hm-4 { bottom: 6px; right: 6px; transform: rotate(45deg); }
      #hit-feedback-text {
        position: absolute;
        top: -30px;
        left: 50%;
        transform: translateX(-50%);
        font-family: monospace;
        font-size: 13px;
        font-weight: 700;
        white-space: nowrap;
        text-shadow: 0 1px 4px rgba(0,0,0,0.8);
      }

      /* Sniper Scope */
      #sniper-scope-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 50;
      }
      .scope-vignette {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at center, transparent 38%, black 42%, black 100%);
      }
      .scope-circle {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 50vh;
        height: 50vh;
        border: 2px solid rgba(255, 255, 255, 0.35);
        border-radius: 50%;
      }
      .scope-reticle-h {
        position: absolute;
        top: 50%;
        left: calc(50% - 25vh);
        width: 50vh;
        height: 1px;
        background: rgba(255, 255, 255, 0.6);
      }
      .scope-reticle-v {
        position: absolute;
        top: calc(50% - 25vh);
        left: 50%;
        width: 1px;
        height: 50vh;
        background: rgba(255, 255, 255, 0.6);
      }
      .scope-zoom {
        position: absolute;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        font-family: monospace;
        font-size: 14px;
        font-weight: 700;
        color: #38bdf8;
        letter-spacing: 1px;
        background: rgba(0, 0, 0, 0.7);
        padding: 4px 12px;
        border-radius: 4px;
      }

      /* Weapon HUD Card */
      #weapon-hud-card {
        position: absolute;
        bottom: 24px;
        right: 24px;
        background: rgba(17, 24, 39, 0.88);
        border: 1px solid rgba(75, 85, 99, 0.5);
        padding: 16px 20px;
        border-radius: 8px;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        min-width: 260px;
      }
      .wh-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: #f3f4f6;
        margin-bottom: 6px;
      }
      #wh-firemode {
        font-size: 12px;
        color: #38bdf8;
      }
      .wh-ammo {
        display: flex;
        align-items: baseline;
        gap: 6px;
        font-family: monospace;
      }
      #wh-mag {
        font-size: 38px;
        font-weight: 800;
        line-height: 1;
      }
      #wh-reserve {
        font-size: 18px;
        color: #94a3b8;
      }
      #wh-reload-prompt {
        font-size: 12px;
        font-weight: 700;
        color: #f59e0b;
        letter-spacing: 1px;
        margin-top: 4px;
        animation: pulse 1s infinite;
      }
      .wh-slots {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }
      .slot-badge {
        font-size: 12px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 4px;
        background: #1f2937;
        color: #94a3b8;
        border: 1px solid #374151;
      }
      .slot-badge.active {
        background: #0284c7;
        color: #ffffff;
        border-color: #38bdf8;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
    `;
    document.head.appendChild(style);
  }
}

