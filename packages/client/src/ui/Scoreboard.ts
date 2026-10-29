import { WarehouseRoomState, PlayerSchema } from '@warehouse-strike/shared';

export class Scoreboard {
  private element: HTMLElement;
  private isVisible: boolean = false;
  private alphaTableBody: HTMLElement | null = null;
  private bravoTableBody: HTMLElement | null = null;
  private alphaTotalEl: HTMLElement | null = null;
  private bravoTotalEl: HTMLElement | null = null;

  constructor() {
    const el = document.createElement('div');
    el.id = 'tab-scoreboard-overlay';
    el.style.display = 'none';
    el.innerHTML = `
      <div class="sb-card">
        <div class="sb-header">
          <h2>TEAM DEATHMATCH SCOREBOARD</h2>
          <div class="sb-sub">HOLD TAB TO VIEW</div>
        </div>

        <div class="sb-grid">
          <!-- Alpha Team Table -->
          <div class="sb-team-col alpha">
            <div class="sb-team-bar">
              <span class="sb-team-name">ALPHA TEAM</span>
              <span id="sb-alpha-total" class="sb-team-score">0 KILLS</span>
            </div>
            <table class="sb-table">
              <thead>
                <tr>
                  <th style="text-align: left;">PLAYER</th>
                  <th>K</th>
                  <th>D</th>
                  <th>A</th>
                  <th>HS</th>
                  <th>DMG</th>
                </tr>
              </thead>
              <tbody id="sb-alpha-tbody"></tbody>
            </table>
          </div>

          <!-- Bravo Team Table -->
          <div class="sb-team-col bravo">
            <div class="sb-team-bar">
              <span class="sb-team-name">BRAVO TEAM</span>
              <span id="sb-bravo-total" class="sb-team-score">0 KILLS</span>
            </div>
            <table class="sb-table">
              <thead>
                <tr>
                  <th style="text-align: left;">PLAYER</th>
                  <th>K</th>
                  <th>D</th>
                  <th>A</th>
                  <th>HS</th>
                  <th>DMG</th>
                </tr>
              </thead>
              <tbody id="sb-bravo-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    this.element = el;

    this.alphaTableBody = el.querySelector('#sb-alpha-tbody');
    this.bravoTableBody = el.querySelector('#sb-bravo-tbody');
    this.alphaTotalEl = el.querySelector('#sb-alpha-total');
    this.bravoTotalEl = el.querySelector('#sb-bravo-total');

    this.injectStyles();
  }

  public setVisible(visible: boolean) {
    this.isVisible = visible;
    this.element.style.display = this.isVisible ? 'flex' : 'none';
  }

  public update(state: WarehouseRoomState, mySessionId: string) {
    if (!this.isVisible || !this.alphaTableBody || !this.bravoTableBody) return;

    if (this.alphaTotalEl) this.alphaTotalEl.innerText = `${state.alphaKills} KILLS`;
    if (this.bravoTotalEl) this.bravoTotalEl.innerText = `${state.bravoKills} KILLS`;

    this.alphaTableBody.innerHTML = '';
    this.bravoTableBody.innerHTML = '';

    const alphaPlayers: PlayerSchema[] = [];
    const bravoPlayers: PlayerSchema[] = [];

    state.players.forEach((p) => {
      if (p.team === 'alpha') alphaPlayers.push(p);
      else bravoPlayers.push(p);
    });

    // Sort by kills descending
    alphaPlayers.sort((a, b) => b.kills - a.kills);
    bravoPlayers.sort((a, b) => b.kills - a.kills);

    const renderRows = (players: PlayerSchema[], tbody: HTMLElement) => {
      for (const p of players) {
        const isMe = p.sessionId === mySessionId;
        const tr = document.createElement('tr');
        if (isMe) tr.className = 'sb-row-me';

        tr.innerHTML = `
          <td style="text-align: left; font-weight: 700;">${p.name} ${isMe ? '(You)' : ''}</td>
          <td style="color: #10b981; font-weight: 800;">${p.kills}</td>
          <td style="color: #ef4444;">${p.deaths}</td>
          <td style="color: #f59e0b;">${p.assists}</td>
          <td style="color: #a855f7;">${p.headshots}</td>
          <td style="color: #94a3b8;">${p.damage}</td>
        `;
        tbody.appendChild(tr);
      }
    };

    renderRows(alphaPlayers, this.alphaTableBody);
    renderRows(bravoPlayers, this.bravoTableBody);
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      #tab-scoreboard-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(11, 13, 16, 0.75);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 80;
        backdrop-filter: blur(6px);
      }
      .sb-card {
        background: #111827;
        border: 1px solid #374151;
        width: 90%;
        max-width: 820px;
        border-radius: 10px;
        padding: 24px;
        box-shadow: 0 12px 36px rgba(0,0,0,0.85);
      }
      .sb-header {
        text-align: center;
        margin-bottom: 20px;
      }
      .sb-header h2 {
        font-size: 20px;
        font-weight: 900;
        letter-spacing: 1.5px;
        color: #f3f4f6;
      }
      .sb-sub {
        font-size: 11px;
        color: #94a3b8;
        letter-spacing: 1px;
      }
      .sb-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .sb-team-col {
        background: #1f2937;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid #374151;
      }
      .sb-team-bar {
        display: flex;
        justify-content: space-between;
        padding: 8px 14px;
        font-family: monospace;
        font-weight: 800;
        font-size: 13px;
      }
      .sb-team-col.alpha .sb-team-bar { background: #1e3a8a; color: #93c5fd; }
      .sb-team-col.bravo .sb-team-bar { background: #7c2d12; color: #fdba74; }
      .sb-table {
        width: 100%;
        border-collapse: collapse;
        font-family: monospace;
        font-size: 12px;
      }
      .sb-table th {
        background: #111827;
        color: #9ca3af;
        padding: 6px 10px;
        text-align: center;
        font-weight: 700;
      }
      .sb-table td {
        padding: 8px 10px;
        text-align: center;
        border-top: 1px solid rgba(75, 85, 99, 0.3);
      }
      .sb-row-me {
        background: rgba(59, 130, 246, 0.18);
        border-left: 3px solid #38bdf8;
      }
    `;
    document.head.appendChild(style);
  }
}

