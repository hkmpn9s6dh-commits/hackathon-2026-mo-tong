import './styles.css';
import { Game } from './game';
import { watchForUpdates } from './update-check';

const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
if (!canvas) throw new Error('missing #stage');

const game = new Game(canvas);
watchForUpdates();

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
