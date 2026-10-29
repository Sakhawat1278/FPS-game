export interface KillFeedItem {
  killerName: string;
  killerTeam: 'alpha' | 'bravo';
  victimName: string;
  victimTeam: 'alpha' | 'bravo';
  weaponId: string;
  isHeadshot: boolean;
  streak?: string;
}

export class KillFeed {
  private container: HTMLElement;

  constructor() {
    const el = document.createElement('div');
    el.id = 'kill-feed-container';
    document.body.appendChild(el);
    this.container = el;
    this.injectStyles();
  }

  public addEntry(item: KillFeedItem, localPlayerName: string) {
    const row = document.createElement('div');
    const isLocalInvolved = item.killerName === localPlayerName || item.victimName === localPlayerName;
    row.className = `kill-feed-entry ${isLocalInvolved ? 'highlighted' : ''}`;

    const killerColor = item.killerTeam === 'alpha' ? '#60a5fa' : '#fb923c';
    const victimColor = item.victimTeam === 'alpha' ? '#60a5fa' : '#fb923c';

    const hsIcon = item.isHeadshot ? '<span class="kf-hs">🎯 HS</span>' : '';
    const streakHtml = item.streak ? `<div class="kf-streak">${item.streak}</div>` : '';

    row.innerHTML = `
      ${streakHtml}
      <div class="kf-main">
        <span class="kf-name" style="color: ${killerColor}">${item.killerName}</span>
        <span class="kf-weapon">[${item.weaponId.toUpperCase()}]</span>
        ${hsIcon}
        <span class="kf-name" style="color: ${victimColor}">${item.victimName}</span>
      </div>
    `;

    this.container.appendChild(row);

    // Keep max 5 entries
    while (this.container.children.length > 5) {
      this.container.removeChild(this.container.firstChild!);
    }

    // Auto-fade after 5 seconds
    setTimeout(() => {
      row.style.opacity = '0';
      row.style.transform = 'translateX(20px)';
      setTimeout(() => {
        if (row.parentNode === this.container) {
          this.container.removeChild(row);
        }
      }, 300);
    }, 5000);
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      #kill-feed-container {
        position: absolute;
        top: 24px;
        right: 24px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        pointer-events: none;
        z-index: 60;
      }
      .kill-feed-entry {
        background: rgba(17, 24, 39, 0.85);
        border: 1px solid rgba(75, 85, 99, 0.4);
        padding: 5px 12px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;
        color: #e5e7eb;
        backdrop-filter: blur(6px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        animation: slideInRight 0.2s ease;
      }
      .kill-feed-entry.highlighted {
        border-color: #f59e0b;
        background: rgba(30, 41, 59, 0.95);
      }
      .kf-main {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .kf-name { font-weight: 700; }
      .kf-weapon {
        font-size: 11px;
        color: #94a3b8;
        background: rgba(0, 0, 0, 0.4);
        padding: 2px 6px;
        border-radius: 3px;
      }
      .kf-hs {
        font-size: 11px;
        font-weight: 800;
        color: #ef4444;
      }
      .kf-streak {
        font-size: 11px;
        font-weight: 800;
        color: #f59e0b;
        letter-spacing: 0.5px;
        text-align: right;
        margin-bottom: 2px;
      }
      @keyframes slideInRight {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  }
}

