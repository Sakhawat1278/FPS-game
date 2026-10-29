import { WarehouseRoomState, PlayerSchema } from '@warehouse-strike/shared';
import { Room } from 'colyseus.js';

export class RoomLobby {
  private container: HTMLElement;
  private lobbyEl: HTMLElement | null = null;
  private roomCodeEl: HTMLElement | null = null;
  private alphaListEl: HTMLElement | null = null;
  private bravoListEl: HTMLElement | null = null;
  private startBtnEl: HTMLElement | null = null;
  private copyNoticeEl: HTMLElement | null = null;

  constructor() {
    this.container = document.body;
    this.setupUI();
  }

  private setupUI() {
    const el = document.createElement('div');
    el.id = 'room-lobby-modal';
    el.innerHTML = `
      <div class="lobby-card">
        <div class="lobby-header">
          <h2>WAREHOUSE STRIKE LOBBY</h2>
          <div class="room-code-badge">
            ROOM CODE: <span id="lobby-room-code">------</span>
          </div>
          <div class="lobby-actions">
            <button id="btn-copy-code" class="btn-sm">Copy Code</button>
            <button id="btn-copy-link" class="btn-sm btn-primary">Copy Invite Link</button>
          </div>
          <div id="copy-notice" style="display: none;" class="copy-notice">Copied to clipboard!</div>
        </div>

        <div class="teams-container">
          <!-- Alpha Team -->
          <div class="team-column alpha">
            <div class="team-header">
              <h3>ALPHA TEAM (BLUE)</h3>
              <button id="btn-join-alpha" class="btn-switch">Switch</button>
            </div>
            <ul id="alpha-player-list" class="player-list"></ul>
          </div>

          <!-- Bravo Team -->
          <div class="team-column bravo">
            <div class="team-header">
              <h3>BRAVO TEAM (ORANGE)</h3>
              <button id="btn-join-bravo" class="btn-switch">Switch</button>
            </div>
            <ul id="bravo-player-list" class="player-list"></ul>
          </div>
        </div>

        <div class="lobby-footer">
          <div id="lobby-status-text">Waiting for players (min 2 to start)...</div>
          <button id="btn-start-match" class="btn-large btn-start" style="display: none;">START MATCH</button>
        </div>
      </div>
    `;

    this.container.appendChild(el);
    this.lobbyEl = el;
    this.roomCodeEl = el.querySelector('#lobby-room-code');
    this.alphaListEl = el.querySelector('#alpha-player-list');
    this.bravoListEl = el.querySelector('#bravo-player-list');
    this.startBtnEl = el.querySelector('#btn-start-match');
    this.copyNoticeEl = el.querySelector('#copy-notice');

    this.setupListeners();
    this.injectStyles();
  }

  private setupListeners() {
    const btnCopyCode = document.getElementById('btn-copy-code');
    const btnCopyLink = document.getElementById('btn-copy-link');

    btnCopyCode?.addEventListener('click', () => {
      const code = this.roomCodeEl?.innerText;
      if (code && code !== '------') {
        navigator.clipboard.writeText(code);
        this.showNotice('Room code copied!');
      }
    });

    btnCopyLink?.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href);
      this.showNotice('Invite link copied!');
    });
  }

  private showNotice(msg: string) {
    if (!this.copyNoticeEl) return;
    this.copyNoticeEl.innerText = msg;
    this.copyNoticeEl.style.display = 'block';
    setTimeout(() => {
      if (this.copyNoticeEl) this.copyNoticeEl.style.display = 'none';
    }, 2000);
  }

  public bindRoom(room: Room<WarehouseRoomState>) {
    if (this.roomCodeEl) this.roomCodeEl.innerText = room.state.roomCode;

    // Switch team listeners
    document.getElementById('btn-join-alpha')?.addEventListener('click', () => {
      room.send('select_team', 'alpha');
    });
    document.getElementById('btn-join-bravo')?.addEventListener('click', () => {
      room.send('select_team', 'bravo');
    });

    // Start match listener
    this.startBtnEl?.addEventListener('click', () => {
      room.send('start_match');
    });

    room.onStateChange((state) => {
      if (this.roomCodeEl) this.roomCodeEl.innerText = state.roomCode;

      // Hide lobby once match starts
      if (state.matchState === 'in_progress' || state.matchState === 'countdown') {
        if (this.lobbyEl) this.lobbyEl.style.display = 'none';
        return;
      } else {
        if (this.lobbyEl) this.lobbyEl.style.display = 'flex';
      }

      this.updatePlayerLists(state, room.sessionId);
    });
  }

  private updatePlayerLists(state: WarehouseRoomState, mySessionId: string) {
    if (!this.alphaListEl || !this.bravoListEl) return;

    this.alphaListEl.innerHTML = '';
    this.bravoListEl.innerHTML = '';

    let isHost = false;

    state.players.forEach((player: PlayerSchema, sessionId: string) => {
      if (sessionId === mySessionId && player.isHost) {
        isHost = true;
      }

      const li = document.createElement('li');
      li.className = 'player-item';
      li.innerHTML = `
        <span class="player-name">${player.name} ${player.isHost ? '👑' : ''} ${sessionId === mySessionId ? '(You)' : ''}</span>
        <span class="player-loadout">${player.primaryWeaponId.toUpperCase()}</span>
      `;

      if (player.team === 'alpha') {
        this.alphaListEl!.appendChild(li);
      } else {
        this.bravoListEl!.appendChild(li);
      }
    });

    // Show host Start Match button
    if (this.startBtnEl) {
      this.startBtnEl.style.display = isHost ? 'block' : 'none';
    }
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      #room-lobby-modal {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(11, 13, 16, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 90;
        backdrop-filter: blur(8px);
      }
      .lobby-card {
        background: #111827;
        border: 1px solid #374151;
        width: 90%;
        max-width: 680px;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      }
      .lobby-header {
        text-align: center;
        margin-bottom: 20px;
      }
      .lobby-header h2 {
        font-size: 22px;
        font-weight: 800;
        letter-spacing: 1px;
        color: #f3f4f6;
      }
      .room-code-badge {
        font-family: monospace;
        font-size: 18px;
        font-weight: 700;
        color: #38bdf8;
        margin: 8px 0;
      }
      .lobby-actions {
        display: flex;
        justify-content: center;
        gap: 10px;
      }
      .copy-notice {
        font-size: 12px;
        color: #10b981;
        margin-top: 6px;
      }
      .teams-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 20px;
      }
      .team-column {
        background: #1f2937;
        border-radius: 8px;
        padding: 14px;
        border: 1px solid #374151;
      }
      .team-column.alpha { border-top: 4px solid #3b82f6; }
      .team-column.bravo { border-top: 4px solid #f97316; }
      .team-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .team-header h3 {
        font-size: 13px;
        font-weight: 700;
        color: #e5e7eb;
      }
      .player-list {
        list-style: none;
        min-height: 120px;
      }
      .player-item {
        display: flex;
        justify-content: space-between;
        padding: 6px 8px;
        background: #111827;
        border-radius: 4px;
        margin-bottom: 6px;
        font-size: 13px;
      }
      .player-name { font-weight: 600; color: #f3f4f6; }
      .player-loadout { font-size: 11px; color: #9ca3af; }
      .lobby-footer {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }
      #lobby-status-text {
        font-size: 13px;
        color: #94a3b8;
      }
      .btn-sm {
        background: #374151;
        border: 1px solid #4b5563;
        color: #f3f4f6;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
      }
      .btn-primary { background: #0284c7; border-color: #38bdf8; }
      .btn-switch {
        background: #374151;
        border: none;
        color: #e5e7eb;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        cursor: pointer;
      }
      .btn-large {
        background: #10b981;
        border: none;
        color: #ffffff;
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 1px;
        padding: 10px 32px;
        border-radius: 6px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }
}
