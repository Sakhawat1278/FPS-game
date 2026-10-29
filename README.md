# Warehouse Strike 🎮

A browser-based, server-authoritative 5v5 multiplayer first-person shooter set in an industrial warehouse.

## Features
- **Instant Matchmaking**: Click an invite link or enter a 6-character room code; no accounts or downloads required.
- **5v5 Team Deathmatch**: Alpha (Blue) vs. Bravo (Orange) with auto-balance, 50-kill limit or 10-minute round timer.
- **Weapon Arsenal**:
  - **M416**: Versatile full-auto assault rifle with recoil compensation.
  - **Operator**: High-caliber bolt-action sniper rifle with dual 4× / 8× scope (one-shot kill anywhere).
  - **Desert Eagle**: Hard-hitting semi-automatic sidearm (1-shot headshot).
- **Competitive Netcode**: Server-authoritative 60 Hz tick simulation, client-side prediction, server reconciliation, entity interpolation, and ~250 ms lag-compensated hit validation.
- **3D Positional Audio**: Dynamic spatial audio, reverberant warehouse acoustics, and distance attenuation.

---

## Tech Stack
- **Language**: TypeScript (Strict Mode)
- **Engine / Renderer**: Three.js (WebGL2) & `pmndrs/postprocessing`
- **Physics**: `@dimforge/rapier3d-compat` (WASM, shared between client & server)
- **Networking**: Colyseus (Node.js / WebSockets)
- **Monorepo / Build**: pnpm workspaces + Vite

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- pnpm (v8+)

### Installation
```bash
pnpm install
```

### Development
Start both the server and client concurrently:
```bash
pnpm dev
```
* Client: `http://localhost:5173`
* Server: `http://localhost:2567` (Health check at `http://localhost:2567/health`)

---

## Controls (Default)
| Action | Key |
|---|---|
| Move | `W` `A` `S` `D` |
| Look | `Mouse` |
| Fire | `Left Mouse Button` |
| ADS / Scope | `Right Mouse Button` (Z or Scroll switches 4× / 8× on Operator) |
| Reload | `R` |
| Sprint | `Left Shift` |
| Crouch | `Left Ctrl` or `C` |
| Jump | `Space` |
| Switch Weapons | `1` / `2` / `Q` / `Mouse Wheel` |
| Scoreboard | `Tab` (Hold) |
| Pause / Menu | `Esc` |
| Fullscreen | `F` |
| Debug Overlay | `F3` |

