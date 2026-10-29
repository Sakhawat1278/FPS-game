# ARCHITECTURAL DECISIONS (ADR): Warehouse Strike

This document logs all key architectural and design choices made during the development of Warehouse Strike.

---

## ADR 001: Monorepo Structure & Package Management
* **Status**: Accepted (Phase 1)
* **Context**: Need strict type sharing between client, server, and shared physics/weapons configurations.
* **Decision**: pnpm workspaces with `@warehouse-strike/shared`, `@warehouse-strike/server`, and `@warehouse-strike/client`.
* **Rationale**: pnpm is fast, uses disk space efficiently, and enforces strict boundary checks between workspace packages.

---

## ADR 002: Unified Client/Server Physics Engine
* **Status**: Accepted (Phase 2)
* **Context**: Player movement, jumping, stair-stepping, and collision prediction require deterministic-enough character controller logic on both client and server.
* **Decision**: `@dimforge/rapier3d-compat` (WASM).
* **Rationale**: Rapier compiles to WebAssembly and runs identically in Node.js on the server and in the browser on the client, avoiding discrepancies between client prediction and server verification.

---

## ADR 003: Networking Architecture & State Sync
* **Status**: Accepted (Phase 4)
* **Context**: Real-time 5v5 multiplayer FPS requires room management, delta compression, client prediction, and server-side hit validation.
* **Decision**: Colyseus 0.15 (WebSocket) with schema delta sync (30 Hz) and authoritative 60 Hz simulation tick.
* **Rationale**: Colyseus provides built-in room matchmaking, invite code mechanics, and auto-disposal, while enabling custom binary messaging for high-frequency input streams (`player_input`).

---

## ADR 004: Rendering & UI Stack Separation
* **Status**: Accepted (Phase 2 & Phase 5)
* **Context**: Target 60 FPS on integrated laptop GPUs and 120+ FPS on dedicated GPUs.
* **Decision**: Three.js (WebGL2) with `pmndrs/postprocessing` for 3D graphics, combined with standard lightweight DOM/CSS for HUD and menus.
* **Rationale**: Keeping heavy JS UI frameworks (e.g. React/Vue) out of the 3D render loop prevents garbage collection frame drops and keeps render latencies minimal.

---

## ADR 005: Server-Side Lag Compensation via Rolling Buffer
* **Status**: Accepted (Phase 4 & Phase 9)
* **Context**: Players with 50–200 ms latency perceive enemies at past positions. Client-authoritative hit registration enables aimbots and spoofing.
* **Decision**: The server maintains a 300 ms rolling circular snapshot buffer of all player capsule and head hitbox transforms. When a fire intent is received, the server rewinds victim positions to `t_fire = clamp(now - rtt/2, now - 250ms, now)` and performs ray-capsule and ray-sphere intersection tests.
* **Rationale**: Completely server-authoritative, prevents hit spoofing, while ensuring hit registration feels instantaneous and fair to shooters up to 250 ms ping.

---

## ADR 006: Procedural Asset Synthesis for Zero-Download Startup
* **Status**: Accepted (Phase 3 & Phase 6)
* **Context**: The game must load instantly upon clicking a link (< 15 MB initial transfer budget; first interactive menu under 3 seconds).
* **Decision**: Synthesize all PBR textures (concrete, corrugated metal, hazard stripes, wood pallets, safety orange steel) on HTML5 canvases dynamically, and synthesize all audio procedurally using the Web Audio API.
* **Rationale**: Total bundle size over the wire is under **1.8 MB** (gzip), enabling instant page loads without downloading hundreds of megabytes of binary assets.

---

## ADR 007: Web Audio Spatial Engine with Synthesized Convolution Reverb
* **Status**: Accepted (Phase 7)
* **Context**: Industrial warehouses feature cavernous acoustics with long reverberation decays and distinctive surface footstep materials.
* **Decision**: Implement a custom Web Audio graph with a `ConvolverNode` loaded with an algorithmically generated 1.8-second exponential noise impulse response. Audio sources pass through `PannerNodes` with inverse-distance attenuation and low-pass filtering.
* **Rationale**: Zero external audio downloads required, high acoustic fidelity, and spatialized 3D audio cues for footsteps and gunshots.

---

## ADR 008: Zero-Allocation Hot Loops & GC Object Pooling
* **Status**: Accepted (Phase 9)
* **Context**: JavaScript garbage collection pauses (> 8 ms) cause stutter and frame drops in real-time FPS games.
* **Decision**: Hot rendering loops (`requestAnimationFrame` and server `update(dt)`) reuse pre-allocated vectors (`_aimDir`), quats, and raycasters. Visual tracers and particle systems utilize object pools (`tracerPool`, `impactPool`) with fixed capacity caps.
* **Rationale**: Zero heap allocation spikes during sustained 60 FPS combat, ensuring buttery-smooth frame pacing.

---

## ADR 009: Anti-Cheat Clamping & Strict Input Validation
* **Status**: Accepted (Phase 9)
* **Context**: Preventing speedhacks, fire rate exploits, message flooding, and nickname script injection.
* **Decision**: Implement an `AntiCheat` system that clamps horizontal displacement if calculated velocity exceeds sprint speed + 25% margin (8.1 m/s), enforces a 120 msg/sec rate limit per client, validates fire rate cooldowns server-side, and sanitizes nicknames.
* **Rationale**: Robust server-side protection against common browser-based cheats while allowing legitimate movement, sliding, and jumping.

---

## ADR 010: Multi-Stage Containerization with Unified Single-Port Hosting
* **Status**: Accepted (Phase 10)
* **Context**: Free hosting providers (Render, Fly.io, Railway) typically expose only a single HTTP/WebSocket port.
* **Decision**: Build a multi-stage Dockerfile that compiles both client and server, and configures the Express/Colyseus server to serve static production client assets from `packages/client/dist` on the same port as the WebSocket server (`process.env.PORT`).
* **Rationale**: Single-container, single-port deployment that works out of the box on all cloud hosts with no extra reverse-proxy configuration.
