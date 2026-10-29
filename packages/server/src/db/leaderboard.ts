import fs from 'fs';
import path from 'path';

export interface LeaderboardEntry {
  deviceId: string;
  nickname: string;
  matchesPlayed: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  damage: number;
  kdRatio: number;
  lastUpdated: number;
}

export class LeaderboardDB {
  private filePath: string;
  private entries: Map<string, LeaderboardEntry> = new Map();

  constructor() {
    const dataDir = process.env.DB_PATH || path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, 'leaderboard.json');
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: LeaderboardEntry[] = JSON.parse(raw);
        for (const item of list) {
          this.entries.set(item.deviceId, item);
        }
        console.log(`[LeaderboardDB] Loaded ${this.entries.size} player records.`);
      }
    } catch (err) {
      console.warn('[LeaderboardDB] Failed to load, starting empty:', err);
    }
  }

  private save() {
    try {
      const list = Array.from(this.entries.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('[LeaderboardDB] Error saving leaderboard:', err);
    }
  }

  public recordPlayerStats(data: {
    deviceId: string;
    nickname: string;
    isWin: boolean;
    kills: number;
    deaths: number;
    assists: number;
    headshots: number;
    damage: number;
  }) {
    let entry = this.entries.get(data.deviceId);
    if (!entry) {
      entry = {
        deviceId: data.deviceId,
        nickname: data.nickname,
        matchesPlayed: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        headshots: 0,
        damage: 0,
        kdRatio: 0,
        lastUpdated: Date.now()
      };
      this.entries.set(data.deviceId, entry);
    }

    entry.nickname = data.nickname;
    entry.matchesPlayed++;
    if (data.isWin) entry.wins++;
    entry.kills += data.kills;
    entry.deaths += data.deaths;
    entry.assists += data.assists;
    entry.headshots += data.headshots;
    entry.damage += data.damage;
    entry.kdRatio = entry.deaths > 0 ? Number((entry.kills / entry.deaths).toFixed(2)) : entry.kills;
    entry.lastUpdated = Date.now();

    this.save();
  }

  public getTopKills(limit: number = 50): LeaderboardEntry[] {
    return Array.from(this.entries.values())
      .sort((a, b) => b.kills - a.kills)
      .slice(0, limit);
  }

  public getTopKD(limit: number = 50): LeaderboardEntry[] {
    return Array.from(this.entries.values())
      .filter((e) => e.kills >= 10) // minimum 10 kills to rank on K/D
      .sort((a, b) => b.kdRatio - a.kdRatio)
      .slice(0, limit);
  }
}

export const leaderboardDB = new LeaderboardDB();
