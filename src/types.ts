export type TowerKind = "lance" | "cryo" | "mortar" | "arc" | "laser";

export type ModuleCat = "pow" | "rate" | "rng";

export type EnemyKind = "scout" | "runner" | "swarm" | "brute" | "wraith" | "boss";

export type TargetMode = "first" | "last" | "strong" | "close";

export type GameStatus = "menu" | "playing" | "victory" | "defeat";

export interface Vec2 {
  x: number;
  y: number;
}

export interface TowerLevelStats {
  dmg: number;
  range: number; // in hex units (0 = unlimited / laser beam)
  rate: number; // shots (or beam ticks) per second
  splash?: number; // hex units (mortar)
  slow?: number; // 0..1 slow factor (cryo)
  chain?: number; // bounce count (arc)
  chainRange?: number; // hex units (arc)
  width?: number; // half-width px (laser beam)
  beamDur?: number; // seconds a laser beam stays on
  cool?: number; // seconds between laser beams
}

export interface TowerDef {
  name: string;
  color: string;
  cost: number;
  upgradeCosts: number[]; // [level2, level3]
  groundOnly?: boolean;
  desc: string;
  levels: TowerLevelStats[];
}

export interface EnemyDef {
  hp: number;
  speed: number; // hexes / second
  bounty: number;
  armor: number; // flat damage reduction
  flying?: boolean;
  boss?: boolean;
  slowResist?: number; // 0..1 fraction of slow ignored
  radius: number; // fraction of hex size
  color: string;
  leakDamage: number;
  name: string;
}

export interface WaveGroup {
  kind: EnemyKind;
  count: number;
  gap: number; // seconds between spawns inside the group
  delay: number; // seconds before the group starts
}

export interface Wave {
  groups: WaveGroup[];
}
