import { settingsManager, GameSettings } from '../settings/SettingsManager';

export class SettingsModal {
  private element: HTMLElement;
  public isVisible: boolean = false;
  private currentTab: string = 'controls';
  private waitingForKey: string | null = null;
  private previewCanvas: HTMLCanvasElement | null = null;

  constructor() {
    const el = document.createElement('div');
    el.id = 'settings-modal-overlay';
    el.style.display = 'none';
    el.innerHTML = `
      <div class="settings-card">
        <div class="settings-header">
          <h2>SETTINGS</h2>
          <button id="btn-close-settings" class="btn-icon">✕</button>
        </div>

        <div class="settings-nav">
          <button class="nav-btn active" data-tab="controls">Controls</button>
          <button class="nav-btn" data-tab="video">Video</button>
          <button class="nav-btn" data-tab="audio">Audio</button>
          <button class="nav-btn" data-tab="crosshair">Crosshair</button>
          <button class="nav-btn" data-tab="accessibility">Accessibility</button>
        </div>

        <div class="settings-content" id="settings-tab-content">
          <!-- Dynamic Content rendered by tab -->
        </div>

        <div class="settings-footer">
          <button id="btn-reset-settings" class="btn-secondary">Reset to Defaults</button>
          <button id="btn-save-settings" class="btn-primary">Apply & Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    this.element = el;

    this.setupListeners();
    this.injectStyles();
  }

  private setupListeners() {
    this.element.querySelector('#btn-close-settings')?.addEventListener('click', () => this.hide());
    this.element.querySelector('#btn-save-settings')?.addEventListener('click', () => {
      settingsManager.save();
      this.hide();
    });
    this.element.querySelector('#btn-reset-settings')?.addEventListener('click', () => {
      settingsManager.resetDefaults();
      this.renderCurrentTab();
    });

    const navButtons = this.element.querySelectorAll('.nav-btn');
    navButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        navButtons.forEach((b) => b.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
        this.currentTab = (e.target as HTMLElement).getAttribute('data-tab') || 'controls';
        this.renderCurrentTab();
      });
    });

    // Key rebind capture
    window.addEventListener('keydown', (e) => {
      if (this.waitingForKey) {
        e.preventDefault();
        e.stopPropagation();
        (settingsManager.current.controls.bindings as any)[this.waitingForKey] = e.code;
        this.waitingForKey = null;
        this.renderCurrentTab();
      }
    });
  }

  public show() {
    this.isVisible = true;
    this.element.style.display = 'flex';
    document.exitPointerLock();
    this.renderCurrentTab();
  }

  public hide() {
    this.isVisible = false;
    this.element.style.display = 'none';
  }

  private renderCurrentTab() {
    const container = this.element.querySelector('#settings-tab-content');
    if (!container) return;
    const s = settingsManager.current;

    if (this.currentTab === 'controls') {
      container.innerHTML = `
        <div class="settings-row">
          <label>Mouse Sensitivity (${s.controls.sensitivity.toFixed(1)})</label>
          <input type="range" id="inp-sens" min="0.5" max="6.0" step="0.1" value="${s.controls.sensitivity}">
        </div>
        <div class="settings-row">
          <label>ADS Multiplier (${s.controls.adsMultiplier.toFixed(1)}×)</label>
          <input type="range" id="inp-ads-mult" min="0.2" max="1.5" step="0.05" value="${s.controls.adsMultiplier}">
        </div>
        <div class="settings-row checkbox">
          <label><input type="checkbox" id="inp-invert-y" ${s.controls.invertY ? 'checked' : ''}> Invert Mouse Y-Axis</label>
        </div>

        <h3 class="sub-header">Key Bindings (Click to rebind)</h3>
        <div class="bindings-grid">
          ${Object.entries(s.controls.bindings).map(([action, code]) => `
            <div class="binding-item">
              <span class="binding-action">${action.toUpperCase()}</span>
              <button class="btn-bind ${this.waitingForKey === action ? 'waiting' : ''}" data-action="${action}">
                ${this.waitingForKey === action ? 'Press key...' : code.replace('Key', '')}
              </button>
            </div>
          `).join('')}
        </div>
      `;

      container.querySelector('#inp-sens')?.addEventListener('input', (e: any) => {
        s.controls.sensitivity = parseFloat(e.target.value);
        this.renderCurrentTab();
      });
      container.querySelector('#inp-ads-mult')?.addEventListener('input', (e: any) => {
        s.controls.adsMultiplier = parseFloat(e.target.value);
        this.renderCurrentTab();
      });
      container.querySelector('#inp-invert-y')?.addEventListener('change', (e: any) => {
        s.controls.invertY = e.target.checked;
      });

      container.querySelectorAll('.btn-bind').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          this.waitingForKey = (e.target as HTMLElement).getAttribute('data-action');
          this.renderCurrentTab();
        });
      });

    } else if (this.currentTab === 'video') {
      container.innerHTML = `
        <div class="settings-row">
          <label>Field of View (FOV: ${s.video.fov}°)</label>
          <input type="range" id="inp-fov" min="70" max="110" step="1" value="${s.video.fov}">
        </div>
        <div class="settings-row">
          <label>Graphics Quality Preset</label>
          <select id="inp-preset">
            <option value="auto" ${s.video.preset === 'auto' ? 'selected' : ''}>Auto (Target 60 FPS)</option>
            <option value="low" ${s.video.preset === 'low' ? 'selected' : ''}>Low (Maximum Performance)</option>
            <option value="medium" ${s.video.preset === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${s.video.preset === 'high' ? 'selected' : ''}>High (Recommended)</option>
            <option value="ultra" ${s.video.preset === 'ultra' ? 'selected' : ''}>Ultra</option>
          </select>
        </div>
        <div class="settings-row checkbox">
          <label><input type="checkbox" id="inp-bloom" ${s.video.bloom ? 'checked' : ''}> Subtle Bloom & Glow</label>
        </div>
        <div class="settings-row">
          <button id="btn-fullscreen" class="btn-secondary" style="width: 100%;">Toggle Fullscreen (F)</button>
        </div>
      `;

      container.querySelector('#inp-fov')?.addEventListener('input', (e: any) => {
        s.video.fov = parseInt(e.target.value, 10);
        this.renderCurrentTab();
      });
      container.querySelector('#inp-preset')?.addEventListener('change', (e: any) => {
        s.video.preset = e.target.value;
      });
      container.querySelector('#inp-bloom')?.addEventListener('change', (e: any) => {
        s.video.bloom = e.target.checked;
      });
      container.querySelector('#btn-fullscreen')?.addEventListener('click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
      });

    } else if (this.currentTab === 'audio') {
      container.innerHTML = `
        <div class="settings-row">
          <label>Master Volume (${Math.round(s.audio.master * 100)}%)</label>
          <input type="range" id="inp-vol-master" min="0" max="1" step="0.05" value="${s.audio.master}">
        </div>
        <div class="settings-row">
          <label>Sound Effects / Gunfire (${Math.round(s.audio.sfx * 100)}%)</label>
          <input type="range" id="inp-vol-sfx" min="0" max="1" step="0.05" value="${s.audio.sfx}">
        </div>
        <div class="settings-row">
          <label>Footsteps (${Math.round(s.audio.footsteps * 100)}%)</label>
          <input type="range" id="inp-vol-feet" min="0" max="1" step="0.05" value="${s.audio.footsteps}">
        </div>
        <div class="settings-row">
          <label>Hitmarker & Headshot Volume (${Math.round(s.audio.hit * 100)}%)</label>
          <input type="range" id="inp-vol-hit" min="0" max="1" step="0.05" value="${s.audio.hit}">
        </div>
      `;

      container.querySelector('#inp-vol-master')?.addEventListener('input', (e: any) => {
        s.audio.master = parseFloat(e.target.value);
        this.renderCurrentTab();
      });
      container.querySelector('#inp-vol-sfx')?.addEventListener('input', (e: any) => {
        s.audio.sfx = parseFloat(e.target.value);
        this.renderCurrentTab();
      });
      container.querySelector('#inp-vol-feet')?.addEventListener('input', (e: any) => {
        s.audio.footsteps = parseFloat(e.target.value);
        this.renderCurrentTab();
      });
      container.querySelector('#inp-vol-hit')?.addEventListener('input', (e: any) => {
        s.audio.hit = parseFloat(e.target.value);
        this.renderCurrentTab();
      });

    } else if (this.currentTab === 'crosshair') {
      container.innerHTML = `
        <div class="crosshair-editor-grid">
          <div class="ch-controls">
            <div class="settings-row">
              <label>Reticle Style</label>
              <div class="btn-group">
                <button class="btn-opt ${s.crosshair.style === 'cross' ? 'active' : ''}" data-style="cross">Cross</button>
                <button class="btn-opt ${s.crosshair.style === 'dot' ? 'active' : ''}" data-style="dot">Dot</button>
                <button class="btn-opt ${s.crosshair.style === 'circle' ? 'active' : ''}" data-style="circle">Circle</button>
              </div>
            </div>
            <div class="settings-row">
              <label>Color</label>
              <input type="color" id="inp-ch-color" value="${s.crosshair.color}">
            </div>
            <div class="settings-row">
              <label>Size (${s.crosshair.size}px)</label>
              <input type="range" id="inp-ch-size" min="6" max="30" step="1" value="${s.crosshair.size}">
            </div>
            <div class="settings-row">
              <label>Thickness (${s.crosshair.thickness}px)</label>
              <input type="range" id="inp-ch-thick" min="1" max="6" step="1" value="${s.crosshair.thickness}">
            </div>
            <div class="settings-row">
              <label>Center Gap (${s.crosshair.gap}px)</label>
              <input type="range" id="inp-ch-gap" min="1" max="20" step="1" value="${s.crosshair.gap}">
            </div>
          </div>
          <div class="ch-preview-box">
            <div class="preview-title">LIVE PREVIEW</div>
            <canvas id="ch-preview-canvas" width="160" height="160"></canvas>
          </div>
        </div>
      `;

      this.previewCanvas = container.querySelector('#ch-preview-canvas');
      this.drawCrosshairPreview();

      container.querySelectorAll('.btn-opt').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          s.crosshair.style = (e.target as HTMLElement).getAttribute('data-style') as any;
          this.renderCurrentTab();
        });
      });
      container.querySelector('#inp-ch-color')?.addEventListener('input', (e: any) => {
        s.crosshair.color = e.target.value;
        this.drawCrosshairPreview();
      });
      container.querySelector('#inp-ch-size')?.addEventListener('input', (e: any) => {
        s.crosshair.size = parseInt(e.target.value, 10);
        this.renderCurrentTab();
      });
      container.querySelector('#inp-ch-thick')?.addEventListener('input', (e: any) => {
        s.crosshair.thickness = parseInt(e.target.value, 10);
        this.renderCurrentTab();
      });
      container.querySelector('#inp-ch-gap')?.addEventListener('input', (e: any) => {
        s.crosshair.gap = parseInt(e.target.value, 10);
        this.renderCurrentTab();
      });

    } else if (this.currentTab === 'accessibility') {
      container.innerHTML = `
        <div class="settings-row">
          <label>Color Blind Palette</label>
          <select id="inp-cb-mode">
            <option value="none" ${s.accessibility.colorBlindMode === 'none' ? 'selected' : ''}>Standard (Alpha Blue vs Bravo Orange)</option>
            <option value="deuteranopia" ${s.accessibility.colorBlindMode === 'deuteranopia' ? 'selected' : ''}>Deuteranopia / Protanopia (Cyan vs Amber)</option>
            <option value="protanopia" ${s.accessibility.colorBlindMode === 'protanopia' ? 'selected' : ''}>Tritanopia (Teal vs Pink)</option>
          </select>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 8px;">
          Adjusts team uniforms, nameplate colors, and scoreboard contrast for clear visual distinction.
        </p>
      `;

      container.querySelector('#inp-cb-mode')?.addEventListener('change', (e: any) => {
        s.accessibility.colorBlindMode = e.target.value;
      });
    }
  }

  private drawCrosshairPreview() {
    if (!this.previewCanvas) return;
    const ctx = this.previewCanvas.getContext('2d')!;
    const c = settingsManager.current.crosshair;
    const w = this.previewCanvas.width;
    const h = this.previewCanvas.height;
    const cx = w / 2;
    const cy = h / 2;

    // Dark grey warehouse background
    ctx.fillStyle = '#1e242e';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = c.color;
    ctx.fillStyle = c.color;
    ctx.lineWidth = c.thickness;

    if (c.style === 'cross') {
      // Top
      ctx.beginPath();
      ctx.moveTo(cx, cy - c.gap);
      ctx.lineTo(cx, cy - c.gap - c.size);
      ctx.stroke();
      // Bottom
      ctx.beginPath();
      ctx.moveTo(cx, cy + c.gap);
      ctx.lineTo(cx, cy + c.gap + c.size);
      ctx.stroke();
      // Left
      ctx.beginPath();
      ctx.moveTo(cx - c.gap, cy);
      ctx.lineTo(cx - c.gap - c.size, cy);
      ctx.stroke();
      // Right
      ctx.beginPath();
      ctx.moveTo(cx + c.gap, cy);
      ctx.lineTo(cx + c.gap + c.size, cy);
      ctx.stroke();
    } else if (c.style === 'dot') {
      ctx.beginPath();
      ctx.arc(cx, cy, c.thickness * 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.style === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, c.gap + c.size / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      #settings-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(11, 13, 16, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 120;
        backdrop-filter: blur(8px);
      }
      .settings-card {
        background: #111827;
        border: 1px solid #374151;
        width: 90%;
        max-width: 650px;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 16px 40px rgba(0,0,0,0.85);
      }
      .settings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .settings-header h2 { font-size: 20px; font-weight: 900; color: #f3f4f6; letter-spacing: 1px; }
      .btn-icon { background: none; border: none; font-size: 18px; color: #9ca3af; cursor: pointer; }
      .settings-nav { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid #374151; padding-bottom: 8px; }
      .nav-btn {
        background: none; border: none; color: #9ca3af; font-size: 13px; font-weight: 700; padding: 6px 12px; cursor: pointer; border-radius: 4px;
      }
      .nav-btn.active { color: #38bdf8; background: rgba(56, 189, 248, 0.1); }
      .settings-content { min-height: 280px; max-height: 380px; overflow-y: auto; padding-right: 6px; }
      .settings-row { margin-bottom: 16px; }
      .settings-row label { display: block; font-size: 13px; font-weight: 600; color: #e5e7eb; margin-bottom: 6px; }
      .settings-row.checkbox label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
      .settings-row input[type="range"] { width: 100%; accent-color: #0284c7; }
      .settings-row select { width: 100%; background: #1f2937; border: 1px solid #374151; color: #f3f4f6; padding: 8px; border-radius: 4px; }
      .sub-header { font-size: 13px; font-weight: 800; color: #f59e0b; margin: 18px 0 10px 0; }
      .bindings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .binding-item { display: flex; justify-content: space-between; align-items: center; background: #1f2937; padding: 6px 10px; border-radius: 4px; }
      .binding-action { font-size: 11px; font-weight: 700; color: #94a3b8; }
      .btn-bind { background: #374151; border: 1px solid #4b5563; color: #f3f4f6; font-family: monospace; font-size: 12px; padding: 4px 10px; border-radius: 3px; cursor: pointer; }
      .btn-bind.waiting { background: #d97706; color: #ffffff; animation: pulse 1s infinite; }
      .crosshair-editor-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; }
      .ch-preview-box { display: flex; flex-direction: column; align-items: center; justify-content: center; background: #1f2937; border-radius: 8px; border: 1px solid #374151; padding: 12px; }
      .preview-title { font-size: 11px; font-weight: 800; color: #94a3b8; margin-bottom: 10px; }
      #ch-preview-canvas { border: 1px solid #374151; border-radius: 6px; }
      .btn-group { display: flex; gap: 6px; }
      .btn-opt { background: #1f2937; border: 1px solid #374151; color: #9ca3af; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
      .btn-opt.active { background: #0284c7; color: #ffffff; border-color: #38bdf8; }
      .settings-footer { display: flex; justify-content: space-between; margin-top: 20px; border-top: 1px solid #374151; padding-top: 14px; }
      .btn-secondary { background: #374151; border: none; color: #e5e7eb; padding: 8px 16px; border-radius: 4px; font-size: 13px; cursor: pointer; }
      .btn-primary { background: #0284c7; border: none; color: #ffffff; padding: 8px 20px; border-radius: 4px; font-size: 13px; font-weight: 700; cursor: pointer; }
    `;
    document.head.appendChild(style);
  }
}

