import { WarehouseRoomState } from '@warehouse-strike/shared';

export class MatchHeaderHUD {
  private element: HTMLElement;
  private alphaScoreEl: HTMLElement | null = null;
  private bravoScoreEl: HTMLElement | null = null;
  private timerEl: HTMLElement | null = null;

  constructor() {
    const el = document.createElement('div');
    el.id = 'match-header-hud';
    el.innerHTML = `
      <div class="team-score alpha">
        <span class="score-tag">ALPHA</span>
        <span id="score-alpha-val" class="score-val">0</span>
      </div>
      <div class="match-center-timer">
        <div id="match-timer-val" class="timer-digits">10:00</div>
        <div class="score-limit-text">FIRST TO 50</div>
      </div>
      <div class="team-score bravo">
        <span id="score-bravo-val" class="score-val">0</span>
        <span class="score-tag">BRAVO</span>
      </div>
    `;
    document.body.appendChild(el);
    this.element = el;

    this.alphaScoreEl = el.querySelector('#score-alpha-val');
    this.bravoScoreEl = el.querySelector('#score-bravo-val');
    this.timerEl = el.querySelector('#match-timer-val');

    this.injectStyles();
  }

  public update(state: WarehouseRoomState) {
    if (this.alphaScoreEl) this.alphaScoreEl.innerText = state.alphaKills.toString();
    if (this.bravoScoreEl) this.bravoScoreEl.innerText = state.bravoKills.toString();

    if (this.timerEl) {
      if (state.matchState === 'countdown') {
        this.timerEl.innerText = `STARTING: ${Math.ceil(state.countdownRemaining)}`;
        this.timerEl.style.color = '#f59e0b';
      } else if (state.matchState === 'sudden_death') {
        this.timerEl.innerText = 'SUDDEN DEATH!';
        this.timerEl.style.color = '#ef4444';
      } else {
        const totalSecs = Math.max(0, Math.floor(state.timeRemaining));
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        this.timerEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        this.timerEl.style.color = '#f3f4f6';
      }
    }
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      #match-header-hud {
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        background: rgba(17, 24, 39, 0.9);
        border: 1px solid rgba(75, 85, 99, 0.5);
        border-radius: 8px;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
        pointer-events: none;
        z-index: 55;
        overflow: hidden;
      }
      .team-score {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 18px;
        font-family: monospace;
      }
      .team-score.alpha {
        background: rgba(37, 99, 235, 0.25);
        border-right: 1px solid rgba(75, 85, 99, 0.5);
      }
      .team-score.bravo {
        background: rgba(234, 88, 12, 0.25);
        border-left: 1px solid rgba(75, 85, 99, 0.5);
      }
      .score-tag {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 1px;
      }
      .team-score.alpha .score-tag { color: #60a5fa; }
      .team-score.bravo .score-tag { color: #fb923c; }
      .score-val {
        font-size: 24px;
        font-weight: 900;
        color: #ffffff;
      }
      .match-center-timer {
        padding: 6px 20px;
        text-align: center;
      }
      .timer-digits {
        font-family: monospace;
        font-size: 18px;
        font-weight: 800;
        color: #f3f4f6;
      }
      .score-limit-text {
        font-size: 10px;
        font-weight: 700;
        color: #94a3b8;
        letter-spacing: 0.5px;
      }
    `;
    document.head.appendChild(style);
  }
}
