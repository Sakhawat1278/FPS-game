import { WarehouseRoomState, PlayerSchema } from '@warehouse-strike/shared';
import { Room } from 'colyseus.js';

export class MatchEndScreen {
  private element: HTMLElement;
  private isShown: boolean = false;
  private winnerTitleEl: HTMLElement | null = null;
  private mvpCardEl: HTMLElement | null = null;
  private rematchBtnEl: HTMLElement | null = null;

  constructor() {
    const el = document.createElement('div');
    el.id = 'match-end-screen';
    el.style.display = 'none';
    el.innerHTML = `
      <div class="end-card">
        <h1 id="end-winner-title">MATCH FINISHED</h1>
        <div id="end-mvp-card" class="mvp-box">
          <div class="mvp-label">MATCH MVP 🏆</div>
          <div id="mvp-name" class="mvp-player-name">Player</div>
          <div id="mvp-stats" class="mvp-stats">0 Kills · 0 Headshots</div>
        </div>
        <div class="end-actions">
          <button id="btn-rematch" class="btn-rematch" style="display: none;">START REMATCH (HOST)</button>
          <button id="btn-leave-match" class="btn-leave">Leave Match</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    this.element = el;

    this.winnerTitleEl = el.querySelector('#end-winner-title');
    this.mvpCardEl = el.querySelector('#end-mvp-card');
    this.rematchBtnEl = el.querySelector('#btn-rematch');

    this.setupListeners();
    this.injectStyles();
  }

  private setupListeners() {
    document.getElementById('btn-leave-match')?.addEventListener('click', () => {
      window.location.href = window.location.origin;
    });
  }

  public bindRoom(room: Room<WarehouseRoomState>) {
    this.rematchBtnEl?.addEventListener('click', () => {
      room.send('request_rematch');
    });

    room.onStateChange((state) => {
      if (state.matchState === 'match_end') {
        this.show(state, room.sessionId);
      } else {
        this.hide();
      }
    });
  }

  public show(state: WarehouseRoomState, mySessionId: string) {
    if (this.isShown) return;
    this.isShown = true;
    this.element.style.display = 'flex';

    if (this.winnerTitleEl) {
      const winner = state.winningTeam.toUpperCase();
      this.winnerTitleEl.innerText = `${winner} TEAM VICTORY!`;
      this.winnerTitleEl.style.color = winner === 'ALPHA' ? '#60a5fa' : '#fb923c';
    }

    // Determine MVP (highest kills, tiebreak by damage)
    let mvp: PlayerSchema | null = null;
    let isHost = false;

    state.players.forEach((p, sid) => {
      if (sid === mySessionId && p.isHost) isHost = true;
      if (!mvp || p.kills > mvp.kills || (p.kills === mvp.kills && p.damage > mvp.damage)) {
        mvp = p;
      }
    });

    if (mvp) {
      const mvpNameEl = document.getElementById('mvp-name');
      const mvpStatsEl = document.getElementById('mvp-stats');
      if (mvpNameEl) mvpNameEl.innerText = (mvp as PlayerSchema).name;
      if (mvpStatsEl) mvpStatsEl.innerText = `${(mvp as PlayerSchema).kills} Kills · ${(mvp as PlayerSchema).headshots} Headshots · ${(mvp as PlayerSchema).damage} Damage`;
    }

    if (this.rematchBtnEl) {
      this.rematchBtnEl.style.display = isHost ? 'block' : 'none';
    }
  }

  public hide() {
    this.isShown = false;
    this.element.style.display = 'none';
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      #match-end-screen {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(11, 13, 16, 0.92);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 95;
        backdrop-filter: blur(10px);
        animation: fadeIn 0.4s ease;
      }
      .end-card {
        background: #111827;
        border: 2px solid #374151;
        width: 90%;
        max-width: 580px;
        border-radius: 14px;
        padding: 32px;
        text-align: center;
        box-shadow: 0 20px 50px rgba(0,0,0,0.9);
      }
      #end-winner-title {
        font-size: 32px;
        font-weight: 900;
        letter-spacing: 2px;
        margin-bottom: 24px;
      }
      .mvp-box {
        background: rgba(31, 41, 55, 0.7);
        border: 1px solid #4b5563;
        padding: 18px;
        border-radius: 8px;
        margin-bottom: 28px;
      }
      .mvp-label {
        font-size: 13px;
        font-weight: 800;
        color: #f59e0b;
        letter-spacing: 1px;
        margin-bottom: 6px;
      }
      .mvp-player-name {
        font-size: 24px;
        font-weight: 800;
        color: #f3f4f6;
        margin-bottom: 4px;
      }
      .mvp-stats {
        font-family: monospace;
        font-size: 14px;
        color: #94a3b8;
      }
      .end-actions {
        display: flex;
        justify-content: center;
        gap: 14px;
      }
      .btn-rematch {
        background: #10b981;
        border: none;
        color: #ffffff;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 1px;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
      }
      .btn-leave {
        background: #374151;
        border: 1px solid #4b5563;
        color: #f3f4f6;
        font-size: 14px;
        padding: 12px 20px;
        border-radius: 6px;
        cursor: pointer;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }
}

