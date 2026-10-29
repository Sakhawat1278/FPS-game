# Warehouse Strike 🎮

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Colyseus](https://img.shields.io/badge/Colyseus-0.15-orange.svg)](https://colyseus.io/)
[![Three.js](https://img.shields.io/badge/Three.js-0.186-black.svg)](https://threejs.org/)
[![Rapier3D WASM](https://img.shields.io/badge/Rapier3D-WASM-purple.svg)](https://rapier.rs/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Warehouse Strike** is a high-performance, browser-based, server-authoritative 5v5 multiplayer first-person shooter set in a 70m × 45m industrial warehouse. It features instant link-click matchmaking, competitive FPS netcode, unified client/server WASM physics, procedural PBR materials, and real-time Web Audio 3D convolution reverb.

---

## 🌟 Key Features

* **Instant Link-Click Join (`?room=CODE`)**: Click an invite link or enter a 6-character room code. No downloads, accounts, or sign-ups required.
* **5v5 Team Deathmatch**: Alpha (Blue) vs. Bravo (Orange) with automatic team balancing, 50-kill score limit or 10-minute match timer.
* **Competitive Netcode**:
  * Authoritative **60 Hz** server simulation loop with 30 Hz snapshot streaming.
  * Client-side prediction with sequence-numbered input buffering.
  * Server reconciliation against authoritative kinematic state.
  * Snapshot interpolation with ~100 ms smoothing buffer for all remote soldiers.
  * Server-side **lag compensation** with 300 ms rolling history buffer for rewinding and raycasting targets accurately up to 250 ms ping.
* **Weapon Arsenal**:
  * **M416**: Full-auto assault rifle (700 RPM, 30 rounds, 4-shot body kill, 2-shot headshot, 1.4× ADS zoom, recoil pattern).
  * **Operator**: High-caliber bolt-action sniper rifle (5 rounds, 1-shot kill anywhere on head/torso/legs, dual 4× and 8× scope zoom with sniper crosshair overlay).
  * **Desert Eagle**: Hard-hitting semi-automatic sidearm (7 rounds, 2-shot body kill, 1-shot headshot).
* **Industrial Warehouse Map (70m × 45m)**:
  * Competitive 3-lane design: North Catwalk & Ramps, Central Cargo Floor (shipping containers), and South Pallet Racks.
  * PBR concrete floor with expansion joints and reflective puddles, corrugated metal shipping containers, industrial hazard stripes, wooden pallets, and structural I-beams.
* **Web Audio Spatial Sound Engine**:
  * 3D spatial audio listener tracking camera orientation and distance attenuation.
  * Surface-aware footsteps (concrete boot steps vs. hollow metal catwalk grating).
  * 1.8-second synthesized warehouse impulse response for convolution reverb.
  * Tactical countdown beeps (3-2-1), match start horns, and victory/defeat stingers.
* **Full Tactical HUD & Settings**:
  * Dynamic 5-second kill feed with weapon icons, headshot indicators, and kill streak callouts (Killing Spree, Rampage, Unstoppable).
  * Interactive `Tab` scoreboard (kills, deaths, assists, headshots, damage, ping).
  * Comprehensive settings modal: Key rebinding table, FOV slider (70–110°), audio sliders, and live interactive crosshair customizer.
  * Solo test bot feature (`F4` or "🤖 Fill Bots (5v5)" button) allowing instant 5v5 lobby filling for offline practice.

---

## 🕹️ Controls

| Action | Primary Key | Alternate |
|---|---|---|
| **Move** | `W` `A` `S` `D` | Arrow Keys |
| **Look / Aim** | `Mouse Movement` | — |
| **Fire** | `Left Mouse Button` | — |
| **Aim Down Sights (ADS)** | `Right Mouse Button` | Hold or Toggle (Settings) |
| **Switch Scope Zoom (Operator)** | `Z` | `Middle Click` / Scroll |
| **Reload** | `R` | — |
| **Sprint** | `Left Shift` | — |
| **Crouch** | `C` | `Left Ctrl` |
| **Jump** | `Space` | — |
| **Primary Weapon** | `1` | `Q` |
| **Secondary Weapon (Deagle)** | `2` | `Q` |
| **Scoreboard** | `Tab` (Hold) | — |
| **Pause / Settings** | `Esc` | — |
| **Debug Info (FPS / Physics)** | `F3` | — |
| **Dev Bot Fill (5v5 Solo)** | `F4` | Lobby Button |

---

## 🔫 Weapons Specification

| Weapon | Category | Fire Mode | RPM | Mag Size | Body Dmg | Head Dmg | Falloff Range | ADS Zoom |
|---|---|---|---|---|---|---|---|---|
| **M416** | Primary | Full-Auto | 700 | 30 / 120 | 22 | 44 (2×) | > 40m (0.7×) | 1.4× Zoom |
| **Operator** | Primary | Bolt-Action | 45 | 5 / 20 | **100** (1-shot) | **100** (1-shot) | None | 4.0× / 8.0× Scope |
| **Desert Eagle** | Secondary | Semi-Auto | 260 | 7 / 28 | 55 | **110** (1-shot) | > 25m (0.7×) | 1.1× Zoom |

---

## 🏗️ Architecture & Monorepo Structure

```
warehouse-strike/
├── packages/
│   ├── shared/            # Types, schemas, weapon configs, map definitions, kinematic math
│   │   ├── src/config/    # WEAPONS, MATCH_RULES, PLAYER_PHYSICS_RULES
│   │   ├── src/maps/      # 70m x 45m Warehouse collider bounds, spawns, cover boxes
│   │   ├── src/physics/   # Unified kinematic movement & acceleration logic
│   │   └── src/protocol/  # Colyseus schemas & network message payloads
│   ├── server/            # Authoritative 60 Hz Colyseus server (Node.js)
│   │   ├── src/rooms/     # WarehouseRoom game loop, matchmaking, hit resolution
│   │   ├── src/systems/   # LagCompensation (rolling 300ms buffer), AntiCheat
│   │   └── src/db/        # Persistent SQLite / JSON Global Leaderboard
│   └── client/            # High-performance Three.js / Vite client
│       ├── src/core/      # Rapier character controller & input manager
│       ├── src/weapons/   # Viewmodel, recoil system, spread bloom, ADS
│       ├── src/world/     # Realistic PBR warehouse world & procedural textures
│       ├── src/audio/     # Web Audio 3D spatial engine & convolution reverb
│       ├── src/net/       # NetworkController, prediction, reconciliation
│       └── src/ui/        # HUD, KillFeed, Scoreboard, Settings, Lobby
├── tools/                 # Headless 100-bot load testing & network verification scripts
├── tests/unit/            # Automated Vitest test suite
├── Dockerfile             # Multi-stage production container
├── render.yaml            # Render Blueprint deployment spec
└── fly.toml               # Fly.io deployment spec
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
* Node.js (v20+ or v22+)
* pnpm (v9+ or v12+)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/warehouse-strike.git
cd warehouse-strike

# Install workspace dependencies
pnpm install
```

### Running Locally
```bash
# Starts both Colyseus server and Vite client concurrently
pnpm dev
```

* **Client**: Open [http://localhost:5173](http://localhost:5173) in your browser.
* **Server**: Runs on `ws://localhost:2567` (Health check at [http://localhost:2567/health](http://localhost:2567/health)).
* **Multi-Client Testing**: Open two browser tabs or private windows; share the room code or invite link to start a 5v5 match.

---

## 🧪 Testing & Verification

### Automated Unit Tests
Run the Vitest test suite covering weapon damage/falloff, recoil recovery, player kinematics, room code entropy, anti-cheat limits, and match scoring rules:
```bash
pnpm test
```

### 100-Bot Load Test
Simulate 10 concurrent rooms and 100 concurrent headless players streaming 30 Hz input:
```bash
pnpm test:load
```
* **Performance Results**:
  * 10 rooms, 100 concurrent players.
  * Over 21,000 input messages streamed.
  * **0.58 KB/s** average bandwidth per client downstream (Budget: < 30 KB/s).
  * Zero server crashes or dropped rooms.

---

## 🌐 Production Deployment

The project includes a multi-stage `Dockerfile` that builds all packages and configures the Express server to serve both static client assets and WebSocket traffic from a single port.

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP & WebSocket port | `2567` |
| `NODE_ENV` | Environment mode | `production` |
| `DB_PATH` | Persistent directory path for leaderboard database | `./data` |
| `TICK_RATE` | Server simulation tick frequency (Hz) | `60` |
| `MAX_ROOMS` | Maximum concurrent active matches | `10` |

### Deploying with Docker
```bash
# Build the production container
docker build -t warehouse-strike .

# Run the container
docker run -p 2567:2567 -e PORT=2567 warehouse-strike
```
Navigate to `http://localhost:2567` to play the unified build.

### Free Hosting on Render
1. Push your repository to GitHub.
2. In the Render Dashboard, click **New +** -> **Blueprint**.
3. Select your repository. Render automatically reads `render.yaml` to spin up a Docker Web Service with persistent disk storage for the leaderboard database.
4. Open the generated `https://<your-app>.onrender.com` URL to play!

### Deploying on Fly.io
```bash
# Authenticate and launch app using fly.toml
fly launch
fly deploy
```

---

## 🔒 Security & Anti-Cheat

* **Speed Clamping**: Maximum horizontal displacement validated every tick (`maxSpeed = 8.1 m/s`); teleportation and speedhacks are clamped immediately.
* **Authoritative Cooldowns**: Weapon fire rates, reload timers, and weapon switch times are enforced server-side.
* **Input Rate Limiting**: Max 120 messages/sec per client.
* **Nickname Sanitization**: HTML tags stripped, profanity filtered, bounded to 2–16 alphanumeric characters.
* **Lag Rewind Bounds**: Timestamp rewind clamped to maximum 250 ms to prevent replay attacks.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE). All textures, 3D meshes, and sound effects are 100% procedural and free of copyright or external dependencies.
