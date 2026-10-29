import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { monitor } from '@colyseus/monitor';
import { WarehouseRoom } from './rooms/WarehouseRoom';

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
    timestamp: Date.now()
  });
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

