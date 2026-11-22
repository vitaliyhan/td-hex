import { ENEMY_DEFS, TOWER_DEFS, TOWER_ORDER, getWave } from "./config";
import type { Game } from "./game";
import type { TowerKind } from "./types";

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
};

function glyph(kind: TowerKind, color: string): string {
  switch (kind) {
    case "lance":
      return `<svg width="30" height="30" viewBox="0 0 34 34"><path d="M17 3 L22 25 L17 20 L12 25 Z" fill="${color}22" stroke="${color}" stroke-width="2"/><line x1="17" y1="3" x2="17" y2="31" stroke="${color}" stroke-width="1.4"/></svg>`;
    case "cryo":
      return `<svg width="30" height="30" viewBox="0 0 34 34"><g stroke="${color}" stroke-width="2"><line x1="4" y1="17" x2="30" y2="17"/><line x1="10.5" y1="4.5" x2="23.5" y2="29.5"/><line x1="23.5" y1="4.5" x2="10.5" y2="29.5"/></g><circle cx="17" cy="17" r="3" fill="${color}"/></svg>`;
    case "mortar":
      return `<svg width="30" height="30" viewBox="0 0 34 34"><line x1="14" y1="20" x2="27" y2="8" stroke="${color}" stroke-width="5"/><circle cx="12" cy="22" r="6" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
    case "arc":
      return `<svg width="30" height="30" viewBox="0 0 34 34"><circle cx="17" cy="17" r="11" fill="none" stroke="${color}" stroke-width="1.8" stroke-dasharray="14 7"/><circle cx="17" cy="17" r="6" fill="none" stroke="${color}" stroke-width="1.8" stroke-dasharray="9 5"/><circle cx="17" cy="17" r="2.4" fill="${color}"/></svg>`;
    case "laser":
      return `<svg width="30" height="30" viewBox="0 0 34 34"><polygon points="13,7 23,17 13,27" fill="${color}22" stroke="${color}" stroke-width="2"/><line x1="13" y1="17" x2="2" y2="17" stroke="${color}" stroke-width="1.4"/><line x1="23" y1="17" x2="33" y2="17" stroke="${color}" stroke-width="2.6"/></svg>`;
  }
}

export class UI {
  private game: Game;
  private el = {
    topbar: $("topbar"),
    gold: $("gold"),
    lives: $("lives"),
    wave: $("wave"),
    waveinfo: $("waveinfo"),
    buildbar: $("buildbar"),
    wavebar: $("wavebar"),
    preview: $("preview"),
    startWave: $("btn-startwave") as HTMLButtonElement,
    auto: $("auto") as HTMLInputElement,
    select: $("selectpanel"),
    spName: $("sp-name"),
    spStats: $("sp-stats"),
    spTarget: $("sp-target"),
    spRotRow: $("sp-rotrow"),
    spRot: $("sp-rot"),
    spPow: $("sp-pow") as HTMLButtonElement,
    spRate: $("sp-rate") as HTMLButtonElement,
    spRng: $("sp-rng") as HTMLButtonElement,
    spUpgrade: $("sp-upgrade") as HTMLButtonElement,
    spSell: $("sp-sell") as HTMLButtonElement,
    overlay: $("overlay"),
    ovMenu: $("ov-menu"),
    ovEnd: $("ov-end"),
    endTitle: $("end-title"),
    endStats: $("end-stats"),
    btnContinue: $("btn-continue") as HTMLButtonElement,
    bestline: $("bestline"),
    btnMute: $("btn-mute"),
    btnPause: $("btn-pause"),
  };
  private cards = new Map<TowerKind, HTMLButtonElement>();
  private speedBtns: HTMLButtonElement[] = [];
  private cache = new Map<string, string>();
  private lastSelId = 0;

  constructor(game: Game) {
    this.game = game;
    this.buildCards();
    this.bind();
    this.updateBestLine();
  }

  private buildCards(): void {
    TOWER_ORDER.forEach((kind, i) => {
      const def = TOWER_DEFS[kind];
      const btn = document.createElement("button");
      btn.className = "tcard";
      btn.innerHTML = `<div class="glyph">${glyph(kind, def.color)}</div>
        <div class="tname" style="color:${def.color}">${def.name}</div>
        <div class="tcost">${def.cost}g</div>
        <div class="tkey">${i + 1}</div>`;
      btn.addEventListener("click", () => {
        this.game.audio.ensure();
        this.game.setPlacing(this.game.placing === kind ? null : kind);
      });
      this.cards.set(kind, btn);
      this.el.buildbar.appendChild(btn);
    });
  }

  private bind(): void {
    const g = this.game;
    $("btn-start").addEventListener("click", () => g.start());
    $("btn-again").addEventListener("click", () => location.reload());
    this.el.btnContinue.addEventListener("click", () => g.continueEndless());
    this.el.startWave.addEventListener("click", () => {
      g.audio.ensure();
      g.startWave();
    });
    this.el.auto.addEventListener("change", () => g.setAuto(this.el.auto.checked));
    [1, 2, 3].forEach((n) => {
      const b = $(`btn-speed${n}`) as HTMLButtonElement;
      b.addEventListener("click", () => g.setSpeed(n));
      this.speedBtns[n - 1] = b;
    });
    this.el.btnPause.addEventListener("click", () => g.togglePause());
    $("btn-money").addEventListener("click", () => {
      g.audio.ensure();
      g.addMoney(100);
    });
    this.el.btnMute.addEventListener("click", () => {
      g.audio.ensure();
      g.audio.setMuted(!g.audio.muted);
    });
    $("sp-close").addEventListener("click", () => g.select(null));
    this.el.spTarget.addEventListener("click", () => g.cycleTargetMode());
    this.el.spRot.addEventListener("click", () => g.toggleRotation());
    this.el.spPow.addEventListener("click", () => g.buyModule("pow"));
    this.el.spRate.addEventListener("click", () => g.buyModule("rate"));
    this.el.spRng.addEventListener("click", () => g.buyModule("rng"));
    this.el.spUpgrade.addEventListener("click", () => g.upgradeSelected());
    this.el.spSell.addEventListener("click", () => g.sellSelected());
  }

  private setText(key: string, el: HTMLElement, txt: string): void {
    if (this.cache.get(key) !== txt) {
      this.cache.set(key, txt);
      el.textContent = txt;
    }
  }

  refresh(): void {
    const g = this.game;

    // overlay / hud visibility
    const playing = g.status === "playing";
    const menu = g.status === "menu";
    this.el.overlay.classList.toggle("hidden", playing);
    this.el.ovMenu.classList.toggle("hidden", !menu);
    this.el.ovEnd.classList.toggle("hidden", menu);
    this.el.topbar.classList.toggle("hidden", menu);
    this.el.buildbar.classList.toggle("hidden", !playing);
    this.el.wavebar.classList.toggle("hidden", !playing);
    this.el.select.classList.toggle("hidden", !playing || !g.selected);

    if (menu) return;

    this.setText("gold", this.el.gold, String(g.gold));
    this.setText("lives", this.el.lives, String(g.lives));
    this.el.lives.classList.toggle("low", g.lives <= 5);
    const total = g.endless ? "∞" : "20";
    this.setText("wave", this.el.wave, `${g.waveRunning ? g.waveNumber : g.wavesCompleted}/${total}`);
    this.setText("waveinfo", this.el.waveinfo, g.paused ? "PAUSED" : g.waveRunning ? "IN PROGRESS" : "PREP");

    // speed / pause buttons
    this.speedBtns.forEach((b, i) => b.classList.toggle("on", g.speed === i + 1 && !g.paused));
    this.el.btnPause.classList.toggle("on", g.paused);
    this.el.btnMute.textContent = g.audio.muted ? "🔇" : "♪";

    // build cards
    for (const [kind, btn] of this.cards) {
      btn.classList.toggle("sel", g.placing === kind);
      btn.classList.toggle("unaffordable", g.gold < TOWER_DEFS[kind].cost);
    }

    // wave preview
    const w = g.waveNumber;
    const groups = getWave(w).groups;
    const parts = groups.map((gr) => {
      const flying = ENEMY_DEFS[gr.kind].flying ? "✈" : "";
      return `${gr.count}× ${ENEMY_DEFS[gr.kind].name}${flying}`;
    });
    this.setText("preview", this.el.preview, `NEXT WAVE ${w} · ${parts.join(" · ")}`);
    const running = g.waveRunning;
    this.el.startWave.classList.toggle("hidden", running);
    this.el.auto.parentElement?.classList.toggle("hidden", running);
    this.el.startWave.textContent = `START WAVE ${w}`;
    this.el.startWave.disabled = g.autoStart && !running;

    // select panel
    if (g.selected) this.refreshSelect();
  }

  private refreshSelect(): void {
    const g = this.game;
    const t = g.selected!;
    if (this.lastSelId !== t.id) {
      this.lastSelId = t.id;
      this.el.spName.textContent = `${t.def.name} · L${t.level + 1}`;
    }
    const laser = t.kind === "laser";
    const st = t.stats;
    const nb = t.level < 2 ? t.def.levels[t.level + 1] : null;
    const nx = nb
      ? {
          dmg: Math.round(nb.dmg * Math.pow(1.15, t.powT)),
          rate: Math.round(nb.rate * (1 + 0.12 * t.rateT) * 100) / 100,
          range: nb.range > 0 ? Math.round((nb.range + 0.25 * t.rngT) * 100) / 100 : 0,
          width: nb.width !== undefined ? nb.width + 1.5 * t.rngT : undefined,
          slow: nb.slow,
          chain: nb.chain,
          splash: nb.splash,
        }
      : null;
    const row = (k: string, v: string, up?: string | number): string =>
      `<span class="k">${k}</span> ${v}${up !== undefined ? ` <span class="up">→ ${up}</span>` : ""}<br>`;
    let html = row(laser ? "DMG/TICK" : "DMG", `${st.dmg}`, nx ? nx.dmg : undefined);
    html += row(laser ? "TICKS" : "RATE", laser ? `${st.rate}/s` : `${st.rate}/s`, nx ? nx.rate : undefined);
    if (st.range > 0) html += row("RANGE", st.range.toFixed(1), nx?.range ? nx.range.toFixed(1) : undefined);
    if (st.width !== undefined) html += row("BEAM WIDTH", `${st.width}`, nx?.width ? `${nx.width}` : undefined);
    if (st.slow !== undefined) html += row("SLOW", `${Math.round(st.slow * 100)}%`, nx ? `${Math.round(nx.slow! * 100)}%` : undefined);
    if (st.chain !== undefined) html += row("CHAIN", `${st.chain}`, nx ? nx.chain : undefined);
    if (st.splash !== undefined) html += row("SPLASH", st.splash.toFixed(1), nx ? nx.splash?.toFixed(1) : undefined);
    if (t.def.groundOnly) html += `<span class="k">ground only</span>`;
    if (laser) html += `<br><span class="k">beam crosses the whole map · click the map to aim it</span>`;
    this.el.spStats.innerHTML = html;

    this.el.spTarget.textContent = `TARGET: ${t.targetMode.toUpperCase()}`;
    this.el.spTarget.classList.toggle("hidden", laser);
    this.el.spRotRow.classList.toggle("hidden", !laser);
    if (laser) {
      const locked = t.fixedAngle !== null;
      this.el.spRot.textContent = `ROTATION: ${locked ? "LOCKED" : "AUTO"}`;
      this.el.spRot.classList.toggle("on", locked);
    }

    for (const [cat, btn] of [["pow", this.el.spPow], ["rate", this.el.spRate], ["rng", this.el.spRng]] as const) {
      const tier = t.moduleTier(cat);
      const cost = t.moduleCost(cat);
      btn.textContent = tier === 0 ? `${cat.toUpperCase()}  ${cost}g` : `${cat.toUpperCase()} +${tier}  ${cost}g`;
      btn.disabled = g.gold < cost;
    }

    const cost = t.upgradeCost;
    if (cost === null) {
      this.el.spUpgrade.textContent = "MAX LEVEL";
      this.el.spUpgrade.disabled = true;
    } else {
      this.el.spUpgrade.textContent = `UP ${cost}g`;
      this.el.spUpgrade.disabled = g.gold < cost;
    }
    this.el.spSell.textContent = `SELL +${t.sellValue}g`;
  }

  private updateBestLine(): void {
    const b = this.game.best;
    this.el.bestline.textContent = b ? `BEST · WAVE ${b.wave} · SCORE ${b.score}` : "NO RUN ON RECORD";
  }

  showEnd(): void {
    const g = this.game;
    const win = g.status === "victory";
    this.el.endTitle.textContent = win ? "SECTOR CLEARED" : "CORE BREACHED";
    this.el.endTitle.style.color = win ? "#eaf8ff" : "#ffd9dd";
    this.el.endTitle.style.textShadow = win
      ? "0 0 26px rgba(52,231,255,0.75), 0 0 80px rgba(52,231,255,0.35)"
      : "0 0 26px rgba(255,77,94,0.8), 0 0 80px rgba(255,77,94,0.35)";
    const b = g.best;
    this.el.endStats.innerHTML =
      `waves cleared <b>${g.wavesCompleted}</b> · kills <b>${g.kills}</b><br>` +
      `core integrity <b>${g.lives}</b> · score <b>${g.score}</b><br>` +
      `best — wave <b>${b?.wave ?? 0}</b> · score <b>${b?.score ?? 0}</b>`;
    this.el.btnContinue.classList.toggle("hidden", !win);
  }
}
