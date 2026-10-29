export class PauseMenu {
  private element: HTMLElement;
  public isVisible: boolean = false;
  private canvas: HTMLCanvasElement;
  private leaderboardModalEl: HTMLElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const el = document.createElement('div');
    el.id = 'pause-menu-modal';
    el.style.display = 'none';
    el.innerHTML = `
      <div class="pause-card">
        <h2>WAREHOUSE STRIKE</h2>
        <div class="pause-sub">PAUSED</div>
        <div class="pause-btn-list">
          <button id="btn-pause-resume" class="btn-pause btn-primary">Resume</button>
          <button id="btn-pause-lb" class="btn-pause">Global Leaderboard</button>
          <button id="btn-pause-leave" class="btn-pause btn-danger">Leave Match</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    this.element = el;

    this.setupLeaderboardModal();
    this.setupListeners();
    this.injectStyles();
  }

  private setupLeaderboardModal() {
    const lb = document.createElement('div');
    lb.id = 'leaderboard-modal';
    lb.style.display = 'none';
    lb.innerHTML = `
      <div class="lb-card">
        <div class="lb-header">
          <h2>GLOBAL LEADERBOARD (TOP 50)</h2>
          <button id="btn-close-lb" class="btn-close">✕</button>
        </div>
        <div class="lb-tabs">
          <button id="tab-kills" class="tab-btn active">Top Kills</button>
          <button id="tab-kd" class="tab-btn">Top K/D Ratio</button>
        </div>
        <div class="lb-scroll">
          <table class="lb-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>PLAYER</th>
                <th>KILLS</th>
                <th>DEATHS</th>
                <th>K/D</th>
                <th>WINS</th>
              </tr>
            </thead>
            <tbody id="lb-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    document.body.appendChild(lb);
    this.leaderboardModalEl = lb;

    document.getElementById('btn-close-lb')?.addEventListener('click', () => {
      if (this.leaderboardModalEl) this.leaderboardModalEl.style.display = 'none';
    });
  }

  private setupListeners() {
    document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
      this.hide();
      this.canvas.requestPointerLock();
    });

    document.getElementById('btn-pause-lb')?.addEventListener('click', () => {
      this.showLeaderboard();
    });

    document.getElementById('btn-pause-leave')?.addEventListener('click', () => {
      window.location.href = window.location.origin;
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        this.toggle();
      }
    });
  }

  public toggle() {
    this.isVisible = !this.isVisible;
    this.element.style.display = this.isVisible ? 'flex' : 'none';
    if (this.isVisible) {
      document.exitPointerLock();
    }
  }

  public hide() {
    this.isVisible = false;
    this.element.style.display = 'none';
  }

  private async showLeaderboard() {
    if (!this.leaderboardModalEl) return;
    this.leaderboardModalEl.style.display = 'flex';

    try {
      const serverUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:2567/api/leaderboard'
        : `${window.location.protocol}//${window.location.host}/api/leaderboard`;

      const res = await fetch(serverUrl);
      const data = await res.json();
      this.renderLeaderboardRows(data.topKills || []);

      document.getElementById('tab-kills')?.addEventListener('click', () => {
        this.renderLeaderboardRows(data.topKills || []);
      });
      document.getElementById('tab-kd')?.addEventListener('click', () => {
        this.renderLeaderboardRows(data.topKD || []);
      });
    } catch (err) {
      console.warn('Failed to load global leaderboard:', err);
    }
  }

  private renderLeaderboardRows(list: any[]) {
    const tbody = document.getElementById('lb-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    list.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 800; color: #f59e0b;">#${index + 1}</td>
        <td style="font-weight: 700;">${item.nickname}</td>
        <td style="color: #10b981; font-weight: 800;">${item.kills}</td>
        <td style="color: #ef4444;">${item.deaths}</td>
        <td style="color: #38bdf8; font-weight: 700;">${item.kdRatio}</td>
        <td>${item.wins}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      #pause-menu-modal, #leaderboard-modal {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(11, 13, 16, 0.88);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 110;
        backdrop-filter: blur(8px);
      }
      .pause-card, .lb-card {
        background: #111827;
        border: 1px solid #374151;
        border-radius: 12px;
        padding: 30px;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0,0,0,0.85);
      }
      .pause-card { width: 340px; }
      .lb-card { width: 90%; max-width: 680px; }
      .pause-card h2 { font-size: 20px; font-weight: 900; color: #f3f4f6; }
      .pause-sub { font-size: 12px; color: #9ca3af; margin: 4px 0 20px 0; letter-spacing: 1px; }
      .pause-btn-list { display: flex; flex-direction: column; gap: 10px; }
      .btn-pause {
        background: #1f2937;
        border: 1px solid #374151;
        color: #f3f4f6;
        padding: 12px;
        font-size: 14px;
        font-weight: 700;
        border-radius: 6px;
        cursor: pointer;
      }
      .btn-primary { background: #0284c7; border-color: #38bdf8; }
      .btn-danger { color: #f87171; border-color: rgba(239, 68, 68, 0.4); }
      .lb-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .btn-close { background: none; border: none; color: #9ca3af; font-size: 18px; cursor: pointer; }
      .lb-tabs { display: flex; gap: 10px; margin-bottom: 16px; }
      .tab-btn { background: #1f2937; border: 1px solid #374151; color: #9ca3af; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; }
      .tab-btn.active { background: #0284c7; color: #ffffff; border-color: #38bdf8; }
      .lb-scroll { max-height: 380px; overflow-y: auto; }
      .lb-table { width: 100%; border-collapse: collapse; font-family: monospace; font-size: 13px; }
      .lb-table th { background: #1f2937; padding: 8px; color: #94a3b8; }
      .lb-table td { padding: 8px; border-bottom: 1px solid #1f2937; }
    `;
    document.head.appendChild(style);
  }
}

