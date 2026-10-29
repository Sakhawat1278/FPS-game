# ARCHITECTURAL DECISIONS (ADR)

## ADR 001: Monorepo Structure & Package Management
* **Status**: Accepted
* **Context**: Need strict type sharing between client, server, and shared physics/weapons configurations.
* **Decision**: pnpm workspaces with `@warehouse-strike/shared`, `@warehouse-strike/server`, and `@warehouse-strike/client`.
* **Rationale**: pnpm is fast, uses disk space efficiently, and enforces strict boundary checks between workspace packages.

## ADR 002: Physics Engine Selection
* **Status**: Accepted
* **Context**: Player movement and hit prediction require deterministic-enough character controller logic on both client and server.
* **Decision**: `@dimforge/rapier3d-compat` (WASM).
* **Rationale**: Rapier runs identically in Node.js and modern WebAssembly-enabled browsers.

## ADR 003: Networking Architecture
* **Status**: Accepted
* **Context**: Real-time 5v5 multiplayer FPS requires room management, delta compression, client prediction, and server-side hit validation.
* **Decision**: Colyseus 0.15 (WebSocket) with schema delta sync (20–30 Hz) and authoritative 60 Hz simulation tick.
* **Rationale**: Colyseus provides built-in room matchmaking, invite code mechanics, and auto-disposal, while enabling custom binary messaging for high-frequency input streams.

## ADR 004: Rendering & UI Stack
* **Status**: Accepted
* **Context**: Target 60 FPS on integrated laptop GPUs and 120+ FPS on dedicated GPUs.
* **Decision**: Three.js (WebGL2) with `pmndrs/postprocessing` for 3D graphics, combined with standard lightweight DOM/CSS for HUD and menus.
* **Rationale**: Keeping heavy JS UI frameworks out of the 3D render loop prevents garbage collection frame drops and keeps render latencies minimal.

