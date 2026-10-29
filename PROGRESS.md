# PROGRESS: Warehouse Strike

## Phase Roadmap & Status

- [x] **Phase 1 — Foundation**: Monorepo, tooling, git, Vite client, Colyseus server, shared package, CI scripts, README skeleton. *(COMPLETED)*
- [ ] **Phase 2 — Single-player core**: Renderer, pointer-lock controls, Rapier character controller (walk/sprint/crouch/jump), greybox warehouse with collision, debug overlay. *(NEXT)*
- [ ] **Phase 3 — Weapons**: Data-driven weapon system, M416 / Operator / Desert Eagle with animations, recoil, spread, ADS, scope, reload, ammo, hit detection vs dummies, HUD, impacts, tracers.
- [ ] **Phase 4 — Networking**: Rooms with codes & invite links, lobby, authoritative server loop, prediction & reconciliation, interpolation, server-side hit validation with lag compensation, health, death, respawn, spawn protection.
- [ ] **Phase 5 — Match logic & UI**: Team Deathmatch rules, team assignment, scoreboard, kill feed, timer, end-of-match leaderboard, rematch, host controls, reconnection, global leaderboard.
- [ ] **Phase 6 — Final art & map**: Replace greybox with realistic warehouse (PBR, lighting, props, LODs), realistic character models & animations, weapon models, VFX, post-processing & quality presets.
- [ ] **Phase 7 — Audio**: Sound effects, positional audio, reverb, occlusion filter, mixer settings.
- [ ] **Phase 8 — Settings & polish**: Settings panel, key rebinding, crosshair editor, loading screens, error states, cold-start UI, accessibility options.
- [ ] **Phase 9 — Optimization & hardening**: Profiling & optimization (draw calls, GC, memory, bandwidth), anti-cheat checks, load tests, cross-browser checks.
- [ ] **Phase 10 — Deployment & docs**: Dockerfile, free-host config, live URL verification, final README, ASSETS.md and DECISIONS.md.

---

## Known Issues
* None at start of Phase 1.

---

## Next Steps
1. Finish Phase 1 setup (server room scaffold, basic client canvas scene).
2. Install pnpm dependencies.
3. Verify that `pnpm dev` launches both server and client without errors.
4. Verify HTTP `/health` and WebSocket endpoints.
5. Commit Phase 1 to Git.

