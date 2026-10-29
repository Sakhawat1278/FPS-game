import { Client } from 'colyseus.js';
import { WarehouseRoomState } from '../packages/shared/src/index';

async function testConnection() {
  console.log('[Test] Connecting to ws://localhost:2567 ...');
  const client = new Client('ws://localhost:2567');

  try {
    const room = await client.joinOrCreate<WarehouseRoomState>('warehouse_room', {
      nickname: 'TestSoldier'
    });

    room.onStateChange.once((state) => {
      console.log('[Test] Initial state synced! Room Code:', state.roomCode, 'Players:', state.players.size);
    });

    // Test ping message
    const sendTime = Date.now();
    room.onMessage('pong', (echoTime: number) => {
      console.log(`[Test] Pong received! Round-trip latency: ${Date.now() - echoTime} ms`);
      setTimeout(() => {
        room.leave();
        console.log('[Test] PASS: All Phase 1 network foundation tests succeeded!');
        process.exit(0);
      }, 50);
    });

    room.send('ping', sendTime);

    setTimeout(() => {
      console.error('[Test] Timeout waiting for pong');
      process.exit(1);
    }, 5000);
  } catch (err) {
    console.error('[Test] Failed to connect:', err);
    process.exit(1);
  }
}

testConnection();
