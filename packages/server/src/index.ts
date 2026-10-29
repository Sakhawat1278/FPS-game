import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { monitor } from '@colyseus/monitor';
import { WarehouseRoom } from './rooms/WarehouseRoom';
import { leaderboardDB } from './db/leaderboard';

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint required by Section 11
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    game: 'Warehouse Strike',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: Date.now()
  });
});

// Global leaderboard endpoint
app.get('/api/leaderboard', (req, res) => {
  res.status(200).json({
    topKills: leaderboardDB.getTopKills(50),
    topKD: leaderboardDB.getTopKD(50)
  });
});

app.post('/api/leaderboard/record', (req, res) => {
  try {
    const { deviceId, nickname, isWin, kills, deaths, assists, headshots, damage } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'Missing deviceId' });
    leaderboardDB.recordPlayerStats({
      deviceId,
      nickname: nickname || 'Soldier',
      isWin: Boolean(isWin),
      kills: Number(kills || 0),
      deaths: Number(deaths || 0),
      assists: Number(assists || 0),
      headshots: Number(headshots || 0),
      damage: Number(damage || 0)
    });
    res.status(200).json({ status: 'ok' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Colyseus dashboard monitor
app.use('/colyseus', monitor());

const server = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server
  })
});

// Register Warehouse room handler
gameServer.define('warehouse_room', WarehouseRoom);

server.listen(port, () => {
  console.log(`===============================================`);
  console.log(`  WAREHOUSE STRIKE - GAME SERVER RUNNING      `);
  console.log(`  Port: ${port}                                `);
  console.log(`  Health Check: http://localhost:${port}/health`);
  console.log(`  Colyseus Monitor: http://localhost:${port}/colyseus`);
  console.log(`===============================================`);
});

