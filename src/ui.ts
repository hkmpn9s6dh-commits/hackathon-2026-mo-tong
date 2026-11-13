import { clamp } from './core/geom';
import { describeStyle } from './core/learn';
import type { Game } from './game';

const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

export class UI {
  private hud: HTMLElement;
  private levelNum: HTMLElement;
  private levelTitle: HTMLElement;
  private inkFill: HTMLElement;
  private hint: HTMLElement;
  private habitList: HTMLElement;
  private habitEmpty: HTMLElement;
  private overlay: HTMLElement;
  private titleLayer: HTMLElement;
  private btnAuto: HTMLButtonElement;
  private btnRetry: HTMLButtonElement;
  private btnMute: HTMLButtonElement;

  constructor(game: Game) {
    void game;
    this.hud = must('hud');
    this.levelNum = must('level-num');
    this.levelTitle = must('level-title');
    this.inkFill = must('ink-fill');
    this.hint = must('hint');
    this.habitList = must('habit-list');
    this.habitEmpty = must('habit-empty');
    this.overlay = must('overlay');
    this.titleLayer = must('title');
    this.btnAuto = must('btn-auto') as HTMLButtonElement;
    this.btnRetry = must('btn-retry') as HTMLButtonElement;
    this.btnMute = must('btn-mute') as HTMLButtonElement;
  }

  layout(x: number, y: number, w: number, _h: number): void {
    const scale = w / 1200;
    const t = `translate(${x}px, ${y}px) scale(${scale})`;
    this.hud.style.transform = t;
    this.titleLayer.style.transform = t;
  }

  renderTitle(onStart: () => void): void {
    this.titleLayer.classList.add('on');
    this.titleLayer.innerHTML = `
      <div class="t-title">墨童</div>
      <div class="t-rule"></div>
      <div class="t-sub">一个会学你的小妖怪</div>
      <p class="t-line">在宣纸上落一笔，墨童照着走。<br />走得越多，它越像你——<br />连你偷懒抄的那条近路，也学得会。</p>
      <button class="t-seal" type="button" data-act="start"><span>落</span><span>笔</span></button>
      <p class="t-foot"><b>MO TONG</b> · 按住拖动 · 一笔成画 · 约 6 分钟</p>
    `;
    this.titleLayer.querySelector<HTMLElement>('[data-act="start"]')?.addEventListener('click', onStart);
  }

  hideTitle(): void {
    this.titleLayer.classList.remove('on');
    this.titleLayer.innerHTML = '';
  }

  setPhase(phase: string): void {
    const showHud = phase === 'draw' || phase === 'walk' || phase === 'shadow' || phase === 'result' || phase === 'brief';
    this.hud.style.opacity = showHud ? '1' : '0';
    this.hud.style.transition = 'opacity 260ms ease';
    this.btnAuto.style.display = phase === 'draw' ? '' : 'none';
    this.btnRetry.style.display = phase === 'draw' ? '' : 'none';
  }

  syncHud(game: Game): void {
    const lvl = game.level;
    const idx = game.levelIndex;
    this.levelNum.textContent = `第${NUMERALS[idx] ?? idx + 1}关`;
    this.levelTitle.textContent = lvl.name;
    this.setInk(1);
    const traits = describeStyle(game.style);
    const learned = game.style.samples > 0;
    this.habitEmpty.style.display = learned ? 'none' : '';
    this.habitList.innerHTML = learned
      ? traits
          .map((t) => {
            const v = clamp(t.value, 0, 1);
            const dots = v > 0.66 ? '●●●' : v > 0.33 ? '●●○' : '●○○';
            return `<li><b class="h-label">${t.label}</b><span class="h-mark">${dots}</span><span class="h-word">${t.word}</span></li>`;
          })
          .join('')
      : '';
  }

  setInk(fraction: number): void {
    this.inkFill.style.width = `${Math.round(clamp(fraction, 0, 1) * 100)}%`;
  }

  setHint(text: string): void {
    this.hint.textContent = text;
    this.hint.style.color = '';
  }

  flashHint(text: string): void {
    this.hint.textContent = text;
    this.hint.style.color = 'var(--cinnabar-deep)';
  }

  setMuted(muted: boolean): void {
    this.btnMute.textContent = muted ? '静' : '声';
    this.btnMute.style.opacity = muted ? '0.35' : '0.6';
  }

  onAuto(fn: () => void): void {
    this.btnAuto.addEventListener('click', fn);
  }

  onRetry(fn: () => void): void {
    this.btnRetry.addEventListener('click', fn);
  }

  onMute(fn: () => void): void {
    this.btnMute.addEventListener('click', fn);
  }

  showCard(html: string): void {
    this.overlay.innerHTML = `<div class="card">${html}</div>`;
    this.overlay.style.pointerEvents = 'auto';
  }

  hideCard(): void {
    this.overlay.innerHTML = '';
    this.overlay.style.pointerEvents = 'none';
  }

  bindCardAction(act: string, fn: () => void): void {
    const el = this.overlay.querySelector<HTMLElement>(`[data-act="${act}"]`);
    el?.addEventListener('click', fn);
  }
}

function must(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}
