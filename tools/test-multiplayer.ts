import { Client } from 'colyseus.js';
import { WarehouseRoomState, HitEventMessage } from '../packages/shared/src/index';

async function testMultiplayer() {
  console.log('[Multiplayer Test] Connecting 2 clients to ws://localhost:2567 ...');
  const client1 = new Client('ws://localhost:2567');
  const client2 = new Client('ws://localhost:2567');

  try {
    // 1. Client 1 creates room
    const room1 = await client1.joinOrCreate<WarehouseRoomState>('warehouse_room', {
      nickname: 'AlphaShooter'
    });
    await new Promise<void>((resolve) => room1.onStateChange.once(() => resolve()));
    console.log(`[Test] Client 1 joined room: ${room1.state.roomCode} (Session: ${room1.sessionId})`);

    // 2. Client 2 joins the exact same room by code
    const room2 = await client2.joinOrCreate<WarehouseRoomState>('warehouse_room', {
      roomCode: room1.state.roomCode,
      nickname: 'BravoTarget'
    });
    await new Promise<void>((resolve) => room2.onStateChange.once(() => resolve()));
    console.log(`[Test] Client 2 joined room: ${room2.state.roomCode} (Session: ${room2.sessionId})`);

    // Wait for state sync
    await new Promise((r) => setTimeout(r, 600));

    // Force teams to Alpha and Bravo
    room1.send('select_team', 'alpha');
    room2.send('select_team', 'bravo');
    await new Promise((r) => setTimeout(r, 300));

    // Wait until spawn protection expires or shooter cancels it by shooting
    console.log('[Test] Testing server-side hit validation & lag compensation...');

    // Client 2 sets up hit listener
    let hitReceived = false;
    room2.onMessage('hit_event', (event: HitEventMessage) => {
      console.log(`[Test] Client 2 received HIT EVENT from ${event.shooterName}! Damage: ${event.damage}, Headshot: ${event.isHeadshot}, Remaining HP: ${event.victimHealth}`);
      hitReceived = true;
    });

    // Client 1 sends fire intent aimed at Client 2's position
    const p2State = room1.state.players.get(room2.sessionId);
    if (!p2State) {
      throw new Error('Client 2 player not found in room state');
    }

    // Wait 2.2 seconds for spawn protection to drop
    console.log('[Test] Waiting 2.2s for spawn protection to clear...');
    await new Promise((r) => setTimeout(r, 2200));

    // Shooter fires Operator directly at target
    const origin = { x: p2State.x - 5, y: p2State.y + 1.2, z: p2State.z };
    const direction = { x: 1, y: 0, z: 0 }; // Straight along X towards target

    console.log(`[Test] Client 1 firing Operator at Client 2 (pos: ${p2State.x}, ${p2State.y}, ${p2State.z})...`);
    room1.send('fire_intent', {
      seq: 1,
      timestamp: Date.now(),
      origin,
      direction,
      weaponId: 'operator'
    });

    // Wait for hit resolution
    await new Promise((r) => setTimeout(r, 800));

    if (hitReceived) {
      console.log('[Test] SUCCESS: Server validated hit via lag compensation and broadcasted hit event!');
      room1.leave();
      room2.leave();
      process.exit(0);
    } else {
      console.error('[Test] FAIL: Hit event not received in time');
      room1.leave();
      room2.leave();
      process.exit(1);
    }
  } catch (err) {
    console.error('[Test] Fatal test error:', err);
    process.exit(1);
  }
}

testMultiplayer();
