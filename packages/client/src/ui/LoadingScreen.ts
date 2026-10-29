export class LoadingScreen {
  private element: HTMLElement;
  private progressBarEl: HTMLElement | null = null;
  private statusTextEl: HTMLElement | null = null;
  private tipsEl: HTMLElement | null = null;

  private tips: string[] = [
    'The Operator sniper rifle kills in exactly one shot anywhere on the body or head.',
    'Sprint is disabled while firing — slow down or ADS to return accurate fire.',
    'Catwalks on the right flank provide long sightlines, but offer limited cover.',
    'Health regenerates at 5 HP/s after 6 seconds of avoiding damage.',
    'Desert Eagle headshots are instant kills against full-health enemies.'
  ];

  constructor() {
    const el = document.createElement('div');
    el.id = 'loading-screen';
    el.innerHTML = `
      <div class="loading-content">
        <h1 class="game-logo">WAREHOUSE STRIKE</h1>
        <div class="game-subtitle">BROWSER-BASED MULTIPLAYER 5v5 FPS</div>

        <div class="progress-container">
          <div id="loading-progress-bar" class="progress-bar"></div>
        </div>

        <div id="loading-status-text" class="status-text">INITIALIZING ENGINE & TEXTURES...</div>

        <div class="tip-box">
          <span class="tip-badge">TACTICAL TIP</span>
          <span id="loading-tip-text" class="tip-text">${this.tips[0]}</span>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    this.element = el;

    this.progressBarEl = el.querySelector('#loading-progress-bar');
    this.statusTextEl = el.querySelector('#loading-status-text');
    this.tipsEl = el.querySelector('#loading-tip-text');

    this.startTipRotation();
    this.injectStyles();
  }

  private startTipRotation() {
    let index = 0;
    setInterval(() => {
      index = (index + 1) % this.tips.length;
      if (this.tipsEl) this.tipsEl.innerText = this.tips[index];
    }, 4000);
  }

  public setProgress(percent: number, status?: string) {
    if (this.progressBarEl) this.progressBarEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    if (status && this.statusTextEl) this.statusTextEl.innerText = status;
  }

  public showColdStartNotice() {
    if (this.statusTextEl) {
      this.statusTextEl.innerText = 'Waking up server instance... (Free tier spin-up, please wait)';
      this.statusTextEl.style.color = '#f59e0b';
    }
  }

  public finish() {
    this.setProgress(100, 'READY!');
    setTimeout(() => {
      this.element.style.opacity = '0';
      setTimeout(() => {
        this.element.style.display = 'none';
      }, 500);
    }, 400);
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      #loading-screen {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #0b0d10;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 150;
        transition: opacity 0.5s ease;
      }
      .loading-content {
        text-align: center;
        width: 90%;
        max-width: 520px;
      }
      .game-logo {
        font-size: 38px;
        font-weight: 900;
        letter-spacing: 3px;
        color: #f3f4f6;
        text-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
      }
      .game-subtitle {
        font-size: 12px;
        font-weight: 700;
        color: #38bdf8;
        letter-spacing: 2px;
        margin: 6px 0 36px 0;
      }
      .progress-container {
        width: 100%;
        height: 6px;
        background: #1f2937;
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 12px;
      }
      .progress-bar {
        width: 25%;
        height: 100%;
        background: linear-gradient(90deg, #0284c7, #38bdf8);
        border-radius: 3px;
        transition: width 0.3s ease;
      }
      .status-text {
        font-family: monospace;
        font-size: 12px;
        font-weight: 700;
        color: #94a3b8;
        letter-spacing: 1px;
        margin-bottom: 30px;
      }
      .tip-box {
        background: rgba(31, 41, 55, 0.6);
        border: 1px solid #374151;
        padding: 12px 18px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .tip-badge {
        font-size: 10px;
        font-weight: 800;
        background: #f59e0b;
        color: #000000;
        padding: 3px 6px;
        border-radius: 3px;
        white-space: nowrap;
      }
      .tip-text {
        font-size: 12px;
        color: #e5e7eb;
        text-align: left;
      }
    `;
    document.head.appendChild(style);
  }
}

