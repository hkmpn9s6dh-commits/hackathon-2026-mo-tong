import './styles.css';
import { Game } from './game';

const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
if (!canvas) throw new Error('missing #stage');

const game = new Game(canvas);

// pointer position drives the in-canvas brush cursor
canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  game.setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top });
});
canvas.addEventListener('pointerleave', () => game.setPointer(null));

// a tiny hook so the end-to-end test can drive the real build without dials
declare global {
  interface Window {
    __moTong?: {
      snapshot: () => unknown;
      solve: () => void;
      jump: (i: number) => void;
      start: () => void;
      next: () => void;
      game: Game;
    };
  }
}

window.__moTong = {
  snapshot: () => game.snapshot(),
  solve: () => game.solveForTest(),
  jump: (i: number) => game.jumpTo(i),
  start: () => {
    const btn = document.querySelector<HTMLButtonElement>('[data-act="start"]');
    btn?.click();
  },
  next: () => {
    const btn = document.querySelector<HTMLButtonElement>('[data-act="next"]');
    btn?.click();
  },
  game,
};
