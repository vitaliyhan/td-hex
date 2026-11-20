# HEXDEFENSE

Neon hexagonal maze tower defence. Vanilla TypeScript + Canvas 2D, no runtime
dependencies. Vite for dev/build, vitest for the core math.

```
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # typecheck + production bundle
npm run test     # hex/path unit tests
```

## How to play

- Build towers anywhere on the hex grid — enemies re-path around them in real
  time, so maze your enemies into kill zones. You can never fully block the lane
  (the ghost turns red).
- Towers: **LANCE** (beam, single target), **CRYO** (slow aura), **MORTAR**
  (splash, cannot hit flyers), **ARC** (chain lightning), **LASER** (piercing
  beam that crosses the whole map and hits everything in its line; rotation
  auto-tracks or can be LOCKED — click the map to aim it).
- Every tower takes **separate module upgrades** — POWER, SPEED and RANGE ×3
  tiers each — on top of the three main levels. Sell always returns 70% of
  everything invested.
- The outer hex ring is a boundary wall: it defines the arena edges, towers
  can't be built on it and ground enemies can't cross it. Spawn and core are
  the two gates.
- Enemies: scouts, runners, swarms, armored brutes, flying wraiths (they ignore
  the maze and beeline for the core), bosses on waves 10/20.
- 20 hand-tuned waves, then endless scaling. High score persists in
  localStorage.

Hotkeys: `1–4` pick tower, click build, click a tower to upgrade/sell, `Esc`
cancel, `Space` pause, `M` mute, `N` start next wave.
Dev assist: add `?wave=10&gold=9999` to the URL.

## Structure

- `src/hex.ts`, `src/grid.ts`, `src/path.ts` — axial/offset hex math and the
  BFS flow field that drives enemy movement (unit-tested in `tests/`).
- `src/game.ts` — game state machine: waves, economy, placement, input.
- `src/towers.ts`, `src/enemies.ts`, `src/projectiles.ts`, `src/waves.ts`-equivalent tables in `config.ts`.
- `src/render/` — layered Canvas renderer: additive pre-rendered glow sprites,
  procedural neon sprites, particle FX.
- `src/audio.ts` — WebAudio-synthesised SFX and ambient hum (no audio files).
