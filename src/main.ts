import "../style.css";
import { Game } from "./game";
import { Renderer } from "./render/renderer";
import { UI } from "./ui";
import { TOWER_ORDER } from "./config";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const game = new Game();
const renderer = new Renderer(canvas);
const ui = new UI(game);
// debug / automation hook
(globalThis as unknown as { __game: Game }).__game = game;

function fit(): void {
  renderer.resize();
  renderer.computeView(game.grid.boardWidth, game.grid.boardHeight);
}
window.addEventListener("resize", fit);
fit();

canvas.addEventListener("pointermove", (e) => {
  const p = renderer.clientToWorld(e.clientX, e.clientY);
  game.pointerMove(p.x, p.y);
});
canvas.addEventListener("pointerdown", (e) => {
  const p = renderer.clientToWorld(e.clientX, e.clientY);
  game.pointerDown(e.button, p.x, p.y);
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const k = e.key;
  if (k >= "1" && k <= "5") {
    const kind = TOWER_ORDER[+k - 1];
    if (kind && game.status === "playing") game.setPlacing(game.placing === kind ? null : kind);
  } else if (k === "Escape") {
    game.cancel();
  } else if (k === " ") {
    e.preventDefault();
    if (game.status === "playing") game.togglePause();
  } else if (k === "m" || k === "M") {
    game.audio.ensure();
    game.audio.setMuted(!game.audio.muted);
  } else if (k === "n" || k === "N") {
    if (game.status === "playing" && !game.waveRunning) game.startWave();
  } else if (k === "g" || k === "G") {
    // dev assist for balance passes
    game.devAddGold(500);
  }
});

const STEP = 1 / 120;
let last = performance.now();
let acc = 0;
let lastStatus = game.status;
let lastW = 0;
let lastH = 0;

function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (game.status === "playing" && !game.paused) {
    acc += dt * game.speed;
    let n = 0;
    while (acc >= STEP && n < 24) {
      game.update(STEP);
      acc -= STEP;
      n++;
    }
    if (acc > STEP) acc = 0;
  } else {
    // keeps fx and menu animations alive outside the active simulation
    game.update(dt);
    acc = 0;
  }

  if (canvas.clientWidth !== lastW || canvas.clientHeight !== lastH) {
    lastW = canvas.clientWidth;
    lastH = canvas.clientHeight;
    fit();
  }
  renderer.computeView(game.grid.boardWidth, game.grid.boardHeight);
  renderer.draw(game);
  if (game.status !== lastStatus) {
    if (game.status === "victory" || game.status === "defeat") ui.showEnd();
    lastStatus = game.status;
  }
  ui.refresh();
}
requestAnimationFrame(frame);
