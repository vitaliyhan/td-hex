import type { EnemyDef, EnemyKind, ModuleCat, TowerDef, TowerKind, Wave } from "./types";

export const PALETTE = {
  lance: "#34e7ff",
  cryo: "#6fb7ff",
  mortar: "#ffb547",
  arc: "#ff3df2",
  laser: "#dff3ff",
  gold: "#ffb547",
  red: "#ff4d5e",
  green: "#62ff8f",
  wraith: "#b46bff",
  core: "#34e7ff",
  spawn: "#ff3df2",
};

const B_COLS = 15;
const B_ROWS = 11;
const B_SPAWN = { col: 0, row: 5 };
const B_CORE = { col: B_COLS - 1, row: 5 };

/** the outer ring of the grid forms the arena wall; spawn & core stay as gateways */
function boundaryWalls(): Array<readonly [number, number]> {
  const gates = new Set([`${B_SPAWN.col},${B_SPAWN.row}`, `${B_CORE.col},${B_CORE.row}`]);
  const out: Array<readonly [number, number]> = [];
  for (let col = 0; col < B_COLS; col++) {
    for (let row = 0; row < B_ROWS; row++) {
      const ring = col === 0 || col === B_COLS - 1 || row === 0 || row === B_ROWS - 1;
      if (ring && !gates.has(`${col},${row}`)) out.push([col, row] as const);
    }
  }
  return out;
}

export const BOARD = {
  cols: B_COLS,
  rows: B_ROWS,
  hexSize: 34,
  spawn: B_SPAWN,
  core: B_CORE,
  /** impassable boundary wall — defines the map edges; no interior walls */
  walls: boundaryWalls(),
};

export const ECON = {
  startGold: 260,
  startLives: 20,
  sellRatio: 0.7,
  waveBonus: (wave: number): number => 30 + 5 * wave,
};

export const TOWER_DEFS: Record<TowerKind, TowerDef> = {
  lance: {
    name: "LANCE",
    color: PALETTE.lance,
    cost: 90,
    upgradeCosts: [110, 160],
    desc: "Rapid beam. Single target.",
    levels: [
      { dmg: 8, range: 2.6, rate: 2.5 },
      { dmg: 14, range: 2.9, rate: 2.8 },
      { dmg: 22, range: 3.2, rate: 3.0 },
    ],
  },
  cryo: {
    name: "CRYO",
    color: PALETTE.cryo,
    cost: 110,
    upgradeCosts: [130, 180],
    desc: "Chill aura. Slows everything.",
    levels: [
      { dmg: 4, range: 2.2, rate: 1.2, slow: 0.35 },
      { dmg: 7, range: 2.5, rate: 1.4, slow: 0.45 },
      { dmg: 11, range: 2.8, rate: 1.6, slow: 0.55 },
    ],
  },
  mortar: {
    name: "MORTAR",
    color: PALETTE.mortar,
    cost: 160,
    upgradeCosts: [200, 280],
    groundOnly: true,
    desc: "Arcing shell. Splash. Cannot hit flyers.",
    levels: [
      { dmg: 24, range: 3.2, rate: 0.7, splash: 1.0 },
      { dmg: 44, range: 3.5, rate: 0.75, splash: 1.1 },
      { dmg: 78, range: 3.8, rate: 0.8, splash: 1.2 },
    ],
  },
  arc: {
    name: "ARC",
    color: PALETTE.arc,
    cost: 140,
    upgradeCosts: [170, 240],
    desc: "Chain lightning.",
    levels: [
      { dmg: 12, range: 2.4, rate: 1.1, chain: 3, chainRange: 1.8 },
      { dmg: 20, range: 2.6, rate: 1.2, chain: 4, chainRange: 2.0 },
      { dmg: 32, range: 2.8, rate: 1.3, chain: 5, chainRange: 2.2 },
    ],
  },
  laser: {
    name: "LASER",
    color: PALETTE.laser,
    cost: 220,
    upgradeCosts: [260, 320],
    desc: "Piercing beam across the whole map. Hits everything in its line. Lock its rotation.",
    levels: [
      { dmg: 6, range: 0, rate: 8, width: 5, beamDur: 0.75, cool: 1.4 },
      { dmg: 10, range: 0, rate: 9, width: 6, beamDur: 0.9, cool: 1.2 },
      { dmg: 16, range: 0, rate: 10, width: 7, beamDur: 1.1, cool: 1.0 },
    ],
  },
};

/** base costs of the three per-tower module lines; tier n costs base * n (uncapped) */
export const MODULE_BASE: Record<ModuleCat, number> = { pow: 60, rate: 55, rng: 50 };

export const TOWER_ORDER: TowerKind[] = ["lance", "cryo", "mortar", "arc", "laser"];

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  scout: { hp: 32, speed: 1.6, bounty: 6, armor: 0, radius: 0.34, color: "#34e7ff", leakDamage: 1, name: "Scout" },
  runner: { hp: 24, speed: 2.7, bounty: 5, armor: 0, radius: 0.28, color: "#62ff8f", leakDamage: 1, name: "Runner" },
  swarm: { hp: 13, speed: 2.0, bounty: 2, armor: 0, radius: 0.2, color: "#ff8a3d", leakDamage: 1, name: "Swarm" },
  brute: { hp: 190, speed: 0.85, bounty: 22, armor: 3, radius: 0.46, color: "#ff4d5e", leakDamage: 2, name: "Brute" },
  wraith: { hp: 55, speed: 1.25, bounty: 14, armor: 1, flying: true, radius: 0.32, color: "#b46bff", leakDamage: 1, name: "Wraith" },
  boss: { hp: 1250, speed: 0.72, bounty: 160, armor: 6, boss: true, slowResist: 0.5, radius: 0.62, color: "#ff3df2", leakDamage: 5, name: "BOSS" },
};

/** HP multiplier for a given wave number */
export function waveHpMult(w: number): number {
  if (w <= 20) return 1 + 0.13 * (w - 1);
  return waveHpMult(20) * Math.pow(1.105, w - 20);
}

/** bounty multiplier (keeps economy relevant in endless) */
export function waveBountyMult(w: number): number {
  return w <= 20 ? 1 : 1 + 0.035 * (w - 20);
}

const g = (
  kind: EnemyKind,
  count: number,
  gap: number,
  delay = 0,
): { kind: EnemyKind; count: number; gap: number; delay: number } => ({ kind, count, gap, delay });

export const WAVE_TABLE: Wave[] = [
  { groups: [g("scout", 6, 0.8)] },
  { groups: [g("scout", 10, 0.7)] },
  { groups: [g("runner", 8, 0.6)] },
  { groups: [g("scout", 8, 0.6), g("brute", 2, 1.2, 2)] },
  { groups: [g("swarm", 16, 0.25)] },
  { groups: [g("runner", 10, 0.5), g("scout", 8, 0.5, 1)] },
  { groups: [g("brute", 4, 1.1), g("scout", 10, 0.45, 1.5)] },
  { groups: [g("runner", 14, 0.4)] },
  { groups: [g("swarm", 24, 0.2), g("brute", 3, 1.0, 1.5)] },
  { groups: [g("boss", 1, 1, 0), g("runner", 10, 0.5, 2)] },
  { groups: [g("wraith", 6, 0.9)] },
  { groups: [g("runner", 16, 0.35), g("wraith", 4, 1.0, 2)] },
  { groups: [g("brute", 6, 0.9), g("scout", 16, 0.4, 1.5)] },
  { groups: [g("wraith", 10, 0.7)] },
  { groups: [g("swarm", 30, 0.15), g("runner", 10, 0.5, 2)] },
  { groups: [g("brute", 8, 0.8), g("wraith", 6, 0.8, 1.5)] },
  { groups: [g("runner", 20, 0.3), g("swarm", 20, 0.2, 2)] },
  { groups: [g("wraith", 8, 0.7), g("brute", 6, 0.9, 1), g("scout", 16, 0.35, 2.5)] },
  { groups: [g("runner", 24, 0.25), g("swarm", 30, 0.15, 2)] },
  { groups: [g("boss", 2, 4, 0), g("wraith", 8, 0.7, 2), g("brute", 4, 1.2, 3)] },
];

/** endless-mode wave generator for w > 20 */
export function endlessWave(w: number): Wave {
  const t = w - 20;
  const kind = ([
    ["runner", "wraith"],
    ["brute", "swarm"],
    ["wraith", "scout"],
    ["swarm", "runner"],
    ["brute", "wraith"],
  ] as const)[t % 5];
  const groups: Wave["groups"] = [
    g(kind[0], 10 + t * 2, Math.max(0.15, 0.5 - t * 0.02)),
    g(kind[1], 6 + t, Math.max(0.3, 0.8 - t * 0.03), 1.5),
  ];
  if (t % 5 === 0) groups.unshift(g("boss", 1 + Math.floor(t / 10), 3, 0));
  return { groups };
}

export function getWave(w: number): Wave {
  return w <= 20 ? WAVE_TABLE[w - 1] : endlessWave(w);
}

export const SPEED_OPTIONS = [1, 2, 3] as const;

export const DEV = {
  /** ?wave=10&gold=9999 — jump to a game state for testing / balance */
  read(): { wave: number | null; gold: number | null } {
    const p = new URLSearchParams(location.search);
    const wave = p.get("wave") ? parseInt(p.get("wave")!, 10) : null;
    const gold = p.get("gold") ? parseInt(p.get("gold")!, 10) : null;
    return { wave, gold };
  },
};
