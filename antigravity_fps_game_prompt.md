# ANTIGRAVITY MASTER PROMPT: "WAREHOUSE STRIKE" — Browser-Based Multiplayer 5v5 FPS

> Paste this whole document into Antigravity as the project brief. Work through it phase by phase. Do not skip the verification steps.

---

## 0. HOW YOU (ANTIGRAVITY) MUST WORK

1. **Plan first.** Before writing code, produce an implementation plan artifact covering the architecture, folder structure and phase breakdown from this document. Wait for no approval; proceed once the plan is written.
2. **Build in phases (Section 14).** Each phase must end in a runnable, tested state. Never leave the project in a broken state between phases.
3. **Verify in the browser.** After each phase, launch the dev server, open the game with the browser agent, and confirm the phase's acceptance criteria. For multiplayer, open at least two browser tabs/clients.
4. **Commit often** with clear messages (git init at start).
5. **Everything is data-driven.** Weapon stats, map spawn points, game rules and network rates live in config files, not hard-coded in logic.
6. **No placeholder shortcuts.** No "TODO: implement later" for anything required by this spec. If an asset cannot be sourced, generate a procedural fallback and note it in `ASSETS.md`.
7. **Original work only.** The game is inspired by the genre (fast arcade team shooters like Hazmob FPS) but must use its own name ("Warehouse Strike"), its own UI, and no copied assets, code, logos or maps from any existing game.
8. Keep a running `PROGRESS.md` listing finished phases, known issues and next steps.

---

## 1. PRODUCT OVERVIEW

**Warehouse Strike** is a free, browser-based, first-person, multiplayer online shooter for friendly matches. Players open a link, enter a nickname (no account, no login), create or join a private room via a code or invite link, and play **5v5 Team Deathmatch** on a single realistic **warehouse** map.

**Design pillars**
- **Instant:** link click → in the game in under 10 seconds.
- **Responsive:** 60 FPS on a mid-range laptop; input feels instant even at 80–120 ms ping.
- **Fair:** server-authoritative; clients are never trusted.
- **Realistic look:** physically based rendering, believable lighting, grounded weapon feel. Not cartoonish.
- **Friendly:** private rooms with invite codes; no matchmaking against strangers required.

**Target:** Desktop browsers (latest Chrome, Edge, Firefox) with keyboard and mouse. Mobile/touch is out of scope.

---

## 2. TECH STACK (chosen for performance and advanced features)

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict mode) everywhere | Shared types between client and server |
| Build | **Vite** + pnpm workspaces (monorepo: `client`, `server`, `shared`) | Fast dev loop |
| Rendering | **Three.js** (WebGL2) with **pmndrs/postprocessing** | Mature, performant, large ecosystem |
| Physics / collision | **Rapier (WASM, `@dimforge/rapier3d-compat`)** for the character controller and world collision, run **identically on client and server** | Deterministic-enough movement prediction, fast |
| Networking | **Colyseus** (Node.js, WebSocket) for rooms, matchmaking by room code and state sync, plus custom binary messages for input and events | Built-in room lifecycle, easy invite codes, free-host friendly |
| Audio | **Web Audio API** (use Howler.js or a thin custom wrapper) with positional 3D audio | Low latency spatial sound |
| UI | **Plain DOM/CSS overlay** (or Preact) on top of the canvas for HUD and menus; no heavy framework in the render loop | Keeps frame time low |
| Persistence | Small server-side **SQLite (better-sqlite3)** or JSON file for the optional global leaderboard | No accounts needed |
| Tooling | ESLint, Prettier, Vitest, Playwright (for multiplayer smoke tests) | Quality |

If you find a clearly better choice for any layer while building, you may swap it, but document the reason in `DECISIONS.md`.

---

## 3. CORE GAMEPLAY SPEC

### 3.1 Match format
- **Mode:** Team Deathmatch only. Two teams: **Alpha** (blue) vs **Bravo** (orange). **5v5**, max 10 players per room.
- **Win condition:** first team to **50 kills** or the highest team kills when the **10-minute** timer ends. Ties go to sudden death (next kill wins).
- **Flow:** Lobby → countdown (10 s) → match → end-of-match results/leaderboard (15 s) → return to lobby for a rematch.
- **Room can start with fewer than 10 players** (host presses Start; minimum 2 players, at least 1 per team). Late joiners may join a running match if a slot is free and are auto-assigned to the smaller team.
- **Teams:** auto-balanced; the host or players may switch teams in the lobby if the target team has room.
- **Respawn:** 3-second death cam (spectate killer), then respawn at a team spawn point farthest from enemies; **2-second spawn protection** (invulnerable, ends early on firing).
- **Friendly fire:** off.

### 3.2 Player
- Health **100**. Regenerates at 5 HP/s after 6 s without taking damage.
- Movement: walk 4.2 m/s, sprint 6.5 m/s (cannot fire while sprinting), crouch 2.2 m/s, jump (~1.1 m height), air control limited. Smooth acceleration/friction, stairs and small ledges (step height 0.35 m) handled by the character controller, no bunny-hopping speed gain.
- Stamina: none (unlimited sprint) to keep it arcade-friendly.
- Fall damage: none. Out-of-bounds kill volume exists.
- Player collider: capsule, 1.8 m standing / 1.2 m crouching. Head hitbox sphere, torso box, limbs boxes (server-side hit detection).
- Camera FOV default 90 (adjustable 70–110).

### 3.3 Weapons (all **hitscan**, server-validated, configured in `shared/config/weapons.ts`)

Players choose a **primary** (M416 or Operator) before each spawn; **Desert Eagle is always the sidearm**. Quick-swap with `1`/`2`/`Q`.

| | **M416 (assault rifle)** | **Operator (sniper rifle)** | **Desert Eagle (pistol)** |
|---|---|---|---|
| Fire mode | Full-auto | Bolt-action, semi | Semi-auto |
| Damage body / head | 22 / 44 | **100 / 100 (one shot = one kill, any hit on the body or head)** | 55 / 110 (head = kill) |
| Fire rate | ~700 RPM | ~45 RPM (bolt cycle 1.3 s) | ~240 RPM |
| Magazine / reserve | 30 / 120 | 5 / 20 | 7 / 35 |
| Reload | 2.2 s (tactical), 2.6 s (empty) | 3.0 s | 1.8 s |
| ADS | 1.4× zoom, tight spread | **Two scope zoom levels (4× / 8×)**, scope overlay | 1.1× |
| Recoil | Learnable vertical-biased pattern with slight horizontal variation; recovery when stopped | Heavy single kick, camera recovers | Strong kick per shot |
| Spread | Small hip spread growing with sustained fire and movement | **Large hip/no-scope spread (accurate only when scoped and standing still-ish); sway when scoped, reduced when crouched** | Medium |
| Range falloff | Damage falls to 70% beyond 40 m | None | Falls to 60% beyond 25 m |
| Extras | Muzzle flash, shell ejection, tracer every 3rd round | Loud shot, long tracer, scope glint visible to enemies at distance | Heavy muzzle flash |

Notes:
- Operator "one hit, one kill": any hit that lands on a player, including legs, kills. State this clearly in the weapon config and the in-game info panel.
- All weapon animations (draw, idle, fire, reload, ADS, sprint, inspect optional) are required. Procedural sway and bob must be supplied for the first-person view model.
- Hit markers (white), headshot marker (red) and kill confirmation sound are required.
- **Lag compensation:** the server stores ~250 ms of past player hitbox positions and rewinds to the shooter's perceived time when validating a shot.

### 3.4 Scoring
- 1 point to the team per kill (suicides subtract 0, give no point).
- Individual stats: kills, deaths, assists (≥ 30 damage within 5 s before the kill), headshots, damage, accuracy, longest streak.
- Kill streak announcements in the feed (3, 5, 7+) are text only.

---

## 4. MAP: "WAREHOUSE" (single map, realistic, competitive layout)

Build **one** high-quality industrial warehouse map. Size roughly **70 m × 45 m** with a ceiling height around 9–12 m. Requirements:

- **Layout for 5v5:** two team spawn rooms/zones at opposite ends, each protected from direct sightlines to the other.
- **Three lanes:** 
  - Center aisle with shelves and pallets (mid-range fights, Desert Eagle/M416).
  - Left flank: tight corridors and offices (close-range).
  - Right flank: loading dock with trucks/containers and an elevated catwalk (long sightlines for the Operator, with counter-cover).
- Second-level **catwalks and mezzanine** reachable by stairs and ladders-free ramps, with railings and cover.
- **Cover density** tuned so no lane is a single 40 m open sightline without cover; sniper lanes must be counterable.
- Details: stacked shipping containers, pallet racks, forklifts, crates, barrels, concrete pillars, roll-up doors, skylights with volumetric light shafts, hanging industrial lamps, puddles with reflections, decals (stains, cracks), signage in an original design.
- **Performance rules:** modular kit with **instanced meshes**, merged static geometry per zone, baked or pre-computed lighting (lightmaps or light probes) combined with 2–4 dynamic shadow-casting lights at most, **occlusion via zone/portal culling** or per-zone visibility toggles, LODs for props, KTX2/Basis compressed textures, Draco/Meshopt compressed GLBs.
- **Collision:** simplified collision meshes (not the render meshes), built into the Rapier world on both client and server. Shared map data format at `shared/maps/warehouse.json` (spawns, bounds, kill volumes, collision primitives) plus the GLB for visuals.
- **Spawn points:** at least 8 per team plus 6 neutral fallback points, each with facing direction. Spawn selection avoids points visible to or within 12 m of enemies.
- Include a **minimap-free** design (no minimap) but provide a simple **map overview** in the lobby/loading screen.

---

## 5. GRAPHICS (realistic, but runs well)

- **PBR materials** (albedo/normal/ORM) with an HDRI environment (indoor warehouse feel) for image-based lighting.
- Post-processing chain (all toggleable by quality preset): SMAA or TAA, SSAO/GTAO, subtle bloom, ACES filmic tone mapping, mild vignette, light film grain (off by default), motion blur OFF by default, depth-based fog / volumetric-style light shafts via cheap billboarded cones or fog shaders.
- Shadows: cascaded or single directional + a few spot lights; shadow map sizes per preset.
- Character models: realistic soldier models with **two team skins** (blue/orange accents), skeletal animations (idle, walk, run, strafe, crouch, jump, aim, fire, reload, death) using a shared skeleton, **GPU skinning**, animation blending, LOD/impostors at distance. Visible enemy weapons held in hands.
- First-person arms + weapon view model rendered in a **separate pass/camera** with its own FOV so it never clips into walls, with a small wall-proximity weapon lowering effect.
- VFX: muzzle flash (sprite + light flicker), tracers, bullet impacts per surface (concrete, metal, wood, dirt dust) with decals (pooled, max ~60), shell casings, blood is **off** (use a subtle hit flash/puff for a friendly, lower-gore tone), dust motes in light shafts.
- **Quality presets:** Low / Medium / High / Ultra (resolution scale, shadows, SSAO, MSAA/SMAA, texture size, draw distance, particles). An **Auto** mode adjusts the preset based on measured frame time.
- **Targets:** 60 FPS at 1080p on integrated-GPU laptops on Low–Medium; 120+ FPS on a dedicated GPU on High. Keep draw calls under ~300 and triangles under ~1.5M visible.

### Asset sourcing
You must source or create assets without paid licenses. In order of preference:
1. **CC0 / permissive-licensed** assets: Poly Haven (HDRIs, PBR textures, models), Kenney, ambientCG, Quaternius, Sketchfab (only CC0/CC-BY with attribution), Mixamo-compatible animations only if licence allows redistribution.
2. Procedurally generated geometry/textures/audio as a fallback.
Record every asset, source URL and licence in `ASSETS.md`. If a high-quality CC0 gun model for the M416, a bolt-action sniper (Operator) or the Desert Eagle is unavailable, build **original-designed** stand-ins with the same silhouette type; do not name or ship another game's weapon models. The in-game names remain M416, Operator and Desert Eagle.

---

## 6. NETWORKING ARCHITECTURE

- **Authoritative server** (Colyseus room) running a **fixed 60 Hz simulation tick** (30 Hz acceptable if profiling demands it; keep it configurable) and sending state snapshots at **20–30 Hz** using Colyseus schema delta compression / compact binary encoding.
- **Client:**
  - Sends input commands (move axes, look yaw/pitch, buttons, sequence number, client tick) every client frame batched at 60 Hz.
  - **Client-side prediction** with the same Rapier movement code from `shared/`, and **server reconciliation** (replay unacknowledged inputs after a correction). Smooth small corrections visually.
  - **Entity interpolation** for remote players (render ~100 ms in the past with buffering, brief extrapolation up to 150 ms).
  - Weapon fire is **predicted locally** (muzzle flash, sound, recoil, tracer) while hit/damage results are **confirmed by the server**.
- **Server-side hit validation** using lag compensation (Section 3.3). The client only sends "fire" intent with timestamp, aim direction and sequence; it never reports hits.
- **Room system:**
  - "Create Room" generates a **6-character uppercase alphanumeric code** (no ambiguous chars like O/0/I/1) and an **invite link**: `https://<host>/?room=ABC234` which auto-joins after the nickname prompt.
  - "Join Room" accepts a code. Handle full, invalid, in-progress and closed-room errors with clear messages.
  - Rooms are private (unlisted), auto-dispose when empty after 60 s, and the **host migrates** to the longest-present player if the host leaves.
  - Host controls: start match, kick player, switch/balance teams, restart match.
  - Reconnection: a player who drops can rejoin within 30 s with the same session token and keep their slot and score.
- **Anti-cheat / robustness** (basic but real):
  - Server validates move speed, fire rate, ammo, reload timing, weapon switch cooldown and line-of-sight.
  - Rate limiting and message size limits; schema validation for every incoming message; sanitize nicknames (2–16 chars, profanity filter, no HTML).
  - Never trust client timestamps for gameplay beyond bounded rewind (max 250 ms).
- **Ping / network UI:** show ping, packet loss indicator, and FPS (toggle in settings).
- **Bandwidth budget:** under ~30 KB/s per client downstream with 10 players.

---

## 7. USER INTERFACE & FLOW

### Screens
1. **Main menu:** game logo, nickname input (saved in localStorage), buttons **Create Room**, **Join Room** (code input), **Settings**, **How to Play**.
2. **Room lobby:** room code with **Copy Code** and **Copy Invite Link** buttons, team columns (Alpha/Bravo, 5 slots each), player list with ping and host badge, **Start Match** (host only), loadout selection (primary: M416 or Operator), team switch, ready indicators, text-free (no chat required).
3. **Loading screen:** map name and tips while assets load, with a progress bar. Lazy-load heavy assets after the menu appears so the first screen shows quickly.
4. **In-game HUD:** crosshair (customizable), health bar, ammo (mag/reserve) and weapon name, team scores and timer at top center, **kill feed** at top right (killer, weapon icon, headshot icon, victim; max 5 entries, fade after 5 s, own kills highlighted), damage direction indicators, hit markers, kill banner, spawn protection indicator, ping/FPS (optional), sniper scope overlay.
5. **Scoreboard (hold Tab):** both teams, columns: player, kills, deaths, assists, headshots, damage, ping; own row highlighted; team totals.
6. **Pause/Esc menu:** resume, settings, leave match (releases pointer lock gracefully).
7. **End-of-match screen / leaderboard:** winning team banner, full-team leaderboard with MVP highlight, top stats (most kills, most headshots, best accuracy), buttons **Rematch** (host) and **Leave**.
8. **Global leaderboard (optional page from main menu):** top 50 players by total kills and by K/D, tied to an **anonymous device ID** stored in localStorage plus the chosen nickname. Server stores aggregated stats from completed matches only (SQLite). Document that free hosts may wipe the disk and provide an env var to point at a persistent DB path.

### Settings panel (persist to localStorage, apply live)
- **Controls:** mouse sensitivity, ADS sensitivity multiplier, invert Y, **full key rebinding** (move, jump, crouch, sprint, reload, fire, ADS, swap weapon, scoreboard), toggle vs hold for ADS/crouch.
- **Video:** FOV (70–110), quality preset (Auto/Low/Medium/High/Ultra), resolution scale, individual toggles (shadows, SSAO, antialiasing, bloom), VSync/FPS cap, fullscreen, show FPS/ping, brightness.
- **Audio:** master, SFX, music (menu only; optional), hit sound volume, enable/disable sound-effect categories.
- **Crosshair:** style (dot/cross/circle), colour, size, thickness, gap, opacity with live preview.
- **Reset to defaults** button.

### Default controls
`W A S D` move · `Mouse` look · `LMB` fire · `RMB` ADS/scope (Operator: `RMB` toggles zoom, `Scroll`/`Z` switches 4×/8×) · `R` reload · `Shift` sprint · `Ctrl`/`C` crouch · `Space` jump · `1`/`2`/`Q`/`Wheel` swap weapons · `Tab` scoreboard · `Esc` menu · `F` fullscreen.

---

## 8. AUDIO

- **Sound effects (all required):** per-weapon fire (close and distant variants with reverb tail for the warehouse), dry fire, reload stages (mag out, mag in, bolt), bolt cycle for the Operator, weapon draw/swap, footsteps by surface and speed (walk/sprint/crouch, concrete/metal grating), jump and land, bullet impacts per surface, whizz-by near-miss, hit marker tick, headshot "ding", death sound, kill confirmation, spawn sound, UI clicks/hover, match start/end stingers, countdown beeps.
- **3D positional audio** with distance attenuation, occlusion approximation (low-pass filter when no line of sight), and a convolution or algorithmic **reverb** for the warehouse space.
- Audio buffers decoded once and pooled; max concurrent voices limit (e.g., 32) with priority to the local player's sounds.
- Music: optional light ambient menu loop (CC0), off in match.
- Audio must unlock correctly after the first user gesture (browser autoplay policy).

---

## 9. PROJECT STRUCTURE

```
warehouse-strike/
├─ package.json  (pnpm workspace)
├─ README.md  ASSETS.md  DECISIONS.md  PROGRESS.md
├─ packages/
│  ├─ shared/        # types, config (weapons, rules), movement/physics code, map data, protocol schema
│  ├─ server/        # Colyseus app, rooms, game loop, lag compensation, persistence
│  └─ client/        # Vite app: renderer, input, UI, audio, netcode, assets
├─ tools/            # asset pipeline scripts (gltf-transform optimize, KTX2 encode), bot/load-test clients
├─ tests/            # vitest unit tests, playwright multiplayer smoke tests
└─ Dockerfile  render.yaml (or fly.toml)
```

Code quality rules: strict TypeScript, no `any` in shared code, small modules, clear separation between simulation (shared, deterministic where possible) and presentation (client only). No per-frame heap allocations in hot paths (reuse vectors/quaternions, use object pools for tracers, decals, particles).

---

## 10. PERFORMANCE REQUIREMENTS (must be measured and reported)

- Add a built-in **debug overlay** (toggle `F3`): FPS, frame time, draw calls, triangles, memory, ping, server tick time, snapshot size.
- Client: 60 FPS stable target; no GC spikes over 8 ms; initial load under ~15 MB over the wire for the critical path (lazy-load the rest); first interactive menu under 3 s on broadband.
- Server: handle at least **10 concurrent rooms (100 players)** on a single small free-tier instance (0.1–0.5 vCPU, 512 MB RAM); tick time under 5 ms per room.
- Provide a **bot load-test script** (headless clients) to verify these numbers and a dev-only option to fill a room with simple AI bots for solo testing (bots are dev/test only, not a shipped feature).

---

## 11. FREE HOSTING & DEPLOYMENT

- Containerize with a `Dockerfile` (multi-stage). The server also serves the built client static files so one service hosts everything (WebSocket + HTTP on the same port).
- Provide ready-to-use deployment configs and step-by-step instructions in `README.md` for **at least one free host with WebSocket support** (Render, Fly.io, Railway or similar; check their current free tiers), using the **cheapest/free** option and noting its limits (cold starts, sleeping, ephemeral disk).
- Add a lightweight `/health` endpoint, and an in-client "Waking up server…" state to handle cold starts gracefully.
- Environment variables: `PORT`, `PUBLIC_URL`, `DB_PATH`, `MAX_ROOMS`, `TICK_RATE`.
- HTTPS/WSS compatible. Use a CDN-friendly asset layout with hashed filenames and long cache headers.
- Optional: static client hosted separately (e.g., Cloudflare Pages) with the server on the free host; document both options.

---

## 12. SECURITY, PRIVACY & POLISH

- No accounts, no personal data. Only nickname and anonymous device ID are stored.
- Sanitize all user text everywhere (nicknames) to prevent injection.
- Rate-limit room creation per IP, cap rooms and players, and add basic abuse protections (kick, ban-for-session by host).
- Handle edge cases: pointer lock lost, tab hidden (pause input, keep alive), window resize, WebGL context loss, WebSocket drop (auto-reconnect UI), full rooms, host leaving mid-match.
- Accessibility basics: colour-blind friendly team colours option, adjustable HUD scale, subtitles are not needed.

---

## 13. TESTING & ACCEPTANCE

**Automated**
- Unit tests (Vitest) for: movement/collision, weapon damage and falloff, recoil patterns, lag-compensation rewind, room-code generation and validation, scoring and win conditions.
- Playwright smoke test that opens 2+ clients, creates a room by code, joins via invite link, starts a match, fires, scores a kill and sees the feed and scoreboard update.
- Bot-based load test described in Section 10.

**Manual acceptance checklist (verify with the browser agent where possible and record results in `PROGRESS.md`)**
- [ ] Create room → code and link shown → second tab joins via link with no login.
- [ ] 5v5 fills correctly; teams balanced; host can start; late join works.
- [ ] Movement feels responsive at simulated 100 ms latency with no visible rubber-banding in normal play.
- [ ] M416 recoil is controllable; Operator kills in exactly one hit on any body part; Desert Eagle kills with one headshot.
- [ ] Kill feed, scoreboard (Tab), end-of-match leaderboard and scores are accurate and consistent between clients.
- [ ] Respawn, spawn protection and spawn selection work; no spawn camping from direct sight.
- [ ] Settings change live and persist after reload; key rebinding works.
- [ ] Sound effects all present and positional.
- [ ] Meets the performance targets in Section 10 and runs on the free host.

---

## 14. BUILD PHASES (do them in this order; each ends runnable and verified)

**Phase 1 — Foundation:** monorepo, tooling, git, Vite client, Colyseus server, shared package, CI scripts, README skeleton.
**Phase 2 — Single-player core:** renderer, pointer-lock controls, Rapier character controller (walk/sprint/crouch/jump), a greybox warehouse with collision, debug overlay.
**Phase 3 — Weapons:** data-driven weapon system, M416/Operator/Desert Eagle with animations (procedural placeholders OK at this stage), recoil, spread, ADS, scope, reload, ammo, hit detection against dummy targets, HUD, impacts, tracers.
**Phase 4 — Networking:** rooms with codes and invite links, lobby, authoritative server loop, prediction and reconciliation, interpolation, server-side hit validation with lag compensation, health, death, respawn, spawn protection.
**Phase 5 — Match logic & UI:** Team Deathmatch rules, team assignment, scoreboard, kill feed, timer, end-of-match leaderboard, rematch, host controls, reconnection, global leaderboard with persistence.
**Phase 6 — Final art & map:** replace the greybox with the realistic warehouse (PBR, lighting, props, LODs), realistic character models and animations, final weapon models, VFX, post-processing and quality presets.
**Phase 7 — Audio:** all sound effects, positional audio, reverb, occlusion filter, mixer settings.
**Phase 8 — Settings & polish:** complete settings panel, key rebinding, crosshair editor, loading screens, error states, cold-start UI, accessibility options.
**Phase 9 — Optimization & hardening:** profile and optimize (draw calls, GC, texture memory, bandwidth), anti-cheat checks, load tests, cross-browser checks.
**Phase 10 — Deployment & docs:** Dockerfile, free-host config, deploy and verify with a live URL, final README (setup, controls, architecture, deployment, troubleshooting), final `ASSETS.md` and `DECISIONS.md`.

---

## 15. DEFINITION OF DONE

The project is done when, from a clean clone, `pnpm install && pnpm dev` starts both server and client locally, a friend can open the deployed free-host link, enter a nickname, receive or enter a room code, and play a complete, stable, good-looking 5v5 Team Deathmatch on the Warehouse map with M416, Operator and Desert Eagle, with kill feed, scoreboard, leaderboard, sound effects and a full settings panel, meeting all requirements and acceptance criteria above.

**Begin now: write the implementation plan artifact, then start Phase 1.**
