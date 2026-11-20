export interface BestRecord {
  wave: number;
  score: number;
}

const KEY = "hexdefense.best.v1";

export function loadBest(): BestRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as BestRecord;
    if (typeof p.wave !== "number" || typeof p.score !== "number") return null;
    return p;
  } catch {
    return null;
  }
}

export function saveBest(wave: number, score: number): BestRecord {
  const cur = loadBest();
  const rec: BestRecord = {
    wave: Math.max(cur?.wave ?? 0, wave),
    score: Math.max(cur?.score ?? 0, score),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* storage unavailable (private mode etc.) — high score just won't persist */
  }
  return rec;
}
