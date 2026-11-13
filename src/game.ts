import { Sound } from './audio';
import { catmullRom, clamp, dist, lerp, type Vec2 } from './core/geom';
import { blendStyle, extractStyle, loudestTraits, NEUTRAL_STYLE, planShadow, type ShadowPlan, type Style } from './core/learn';
import { BOARD, BRUSH_R, buildAllLevels, DOT_R, GOAL_R, type Level } from './core/levels';
import { blockedByHazard, evaluateStroke, scoreLevel } from './core/stroke';
import { CINNABAR, drawBrushPath, drawInkChild, INK, makeDotSprite, makeHazardSprite, makeSealSprite } from './render/ink';
import { makePaperTexture, paperPath } from './render/paper';
import { UI } from './ui';

const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

export const LOGICAL_W = 1200;
export const LOGICAL_H = 750;

export type Phase = 'title' | 'brief' | 'shadow' | 'draw' | 'walk' | 'result' | 'finale';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
}

export interface LevelMemory {
  level: Level;
  stroke: Vec2[];
  taken: number[];
  claimed: number[];
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ui: UI;
  private sound = new Sound();

  private paper: HTMLCanvasElement;
  private inkLayer: HTMLCanvasElement;
  private inkCtx: CanvasRenderingContext2D;
  private dotSprite: HTMLCanvasElement;
  private dotSpriteSmall: HTMLCanvasElement;
  private hazardSprites = new Map<number, HTMLCanvasElement>();
  private sealSprite: HTMLCanvasElement;

  private levels: Level[] = buildAllLevels();
  levelIndex = 0;
  style: Style = { ...NEUTRAL_STYLE };
  phase: Phase = 'title';

  private stroke: Vec2[] = [];
  private drawing = false;
  private drawStartedAt = 0;
  private lastPoint: Vec2 | null = null;
  private attempts = 0;
  private blockedFlash = 0;
  private hintFlash = '';
  private hintUntil = 0;

  private walkPath: Vec2[] = [];
  private walkT = 0;
  private walkDuration = 1;
  private childAt: Vec2;
  private childFacing = 1;
  private childSquash = 0;

  private shadow: ShadowPlan | null = null;
  private shadowPhaseT = 0;
  private shadowDrawing = 0;

  claimed = new Set<number>();
  taken = new Set<number>();
  private particles: Particle[] = [];
  private memories: LevelMemory[] = [];

  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private dpr = 1;
  private lastFrame = 0;
  private rafId = 0;
  autoMode = false;
  private autoT = 0;
  private autoPath: Vec2[] = [];
  private titleT = 0;
  private demoPath: Vec2[] = catmullRom(
    [
      { x: 604, y: 566 },
      { x: 700, y: 470 },
      { x: 792, y: 528 },
      { x: 884, y: 372 },
      { x: 966, y: 236 },
    ],
    5,
  );
  private demoDots: Vec2[] = [0.22, 0.46, 0.7, 0.9].map((u) => positionAt(this.demoPath, u));

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d unavailable');
    this.ctx = ctx;
    this.ui = new UI(this);

    this.paper = makePaperTexture(LOGICAL_W, LOGICAL_H);
    this.inkLayer = document.createElement('canvas');
    this.inkLayer.width = LOGICAL_W;
    this.inkLayer.height = LOGICAL_H;
    this.inkCtx = this.inkLayer.getContext('2d')!;
    this.dotSprite = makeDotSprite(DOT_R);
    this.dotSpriteSmall = makeDotSprite(12);
    this.sealSprite = makeSealSprite(84, '墨');
    for (const l of this.levels) {
      for (const h of l.hazards) this.hazardSprites.set(l.id * 1000 + h.id, makeHazardSprite(h.r, h.seed));
    }

    const first = this.levels[0];
    this.childAt = { ...first.start };

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    this.bindUi();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
    this.showTitle();
  }

  get level(): Level {
    return this.levels[this.levelIndex];
  }

  // ---------------------------------------------------------------- layout

  private resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    const pad = Math.max(16, Math.min(w, h) * 0.03);
    this.scale = Math.min((w - pad * 2) / LOGICAL_W, (h - pad * 2) / LOGICAL_H);
    this.offsetX = (w - LOGICAL_W * this.scale) / 2;
    this.offsetY = (h - LOGICAL_H * this.scale) / 2;
    this.ui.layout(this.offsetX, this.offsetY, LOGICAL_W * this.scale, LOGICAL_H * this.scale);
  }

  private toLogical(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.offsetX) / this.scale,
      y: (clientY - rect.top - this.offsetY) / this.scale,
    };
  }

  // ---------------------------------------------------------------- input

  private bindInput(): void {
    const down = (e: PointerEvent) => {
      if (this.phase !== 'draw') return;
      const p = this.toLogical(e.clientX, e.clientY);
      if (dist(p, this.level.start) > 64) {
        this.flash('从墨童身上起笔。');
        return;
      }
      this.sound.ensure();
      this.canvas.setPointerCapture(e.pointerId);
      this.drawing = true;
      this.autoMode = false;
      this.drawStartedAt = performance.now();
      this.stroke = [{ ...this.level.start }];
      this.lastPoint = { ...this.level.start };
      this.childAt = { ...this.level.start };
      this.blockedFlash = 0;
    };
    const move = (e: PointerEvent) => {
      if (!this.drawing) return;
      const p = this.toLogical(e.clientX, e.clientY);
      this.extendStroke(p);
    };
    const up = () => {
      if (!this.drawing) return;
      this.drawing = false;
      this.sound.brushOff();
      this.finishStroke();
    };
    this.canvas.addEventListener('pointerdown', down);
    this.canvas.addEventListener('pointermove', move);
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    this.canvas.addEventListener('pointerleave', up);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private extendStroke(p: Vec2): void {
    const last = this.lastPoint;
    if (!last) return;
    if (dist(last, p) < 3.2) return;
    const step: Vec2 = { x: p.x, y: p.y };
    if (step.x < BOARD.x0 || step.x > BOARD.x1 || step.y < BOARD.y0 || step.y > BOARD.y1) return;
    if (blockedByHazard(last, step, this.level)) {
      if (this.blockedFlash <= 0) {
        this.blockedFlash = 0.45;
        this.sound.bump();
      }
      return;
    }
    this.stroke.push(step);
    this.lastPoint = step;
    this.childFacing = step.x >= last.x ? 1 : -1;
    this.childAt = step;
    const speed = dist(last, step);
    this.childSquash = clamp(speed / 14, 0, 1);
    this.sound.brush(speed);
    if (this.strokeLength() > this.level.inkBudget) {
      this.drawing = false;
      this.sound.brushOff();
      this.flash('墨用完了。');
      this.finishStroke(true);
    }
  }

  private strokeLength(): number {
    let total = 0;
    for (let i = 1; i < this.stroke.length; i++) total += dist(this.stroke[i - 1], this.stroke[i]);
    return total;
  }

  private finishStroke(overBudget = false): void {
    if (this.stroke.length < 3) {
      this.stroke = [];
      this.lastPoint = null;
      return;
    }
    const result = evaluateStroke(this.stroke, this.level, this.claimed);
    const missing = this.level.dots.filter((d) => !this.claimed.has(d.id) && !result.dots.includes(d.id)).length;
    if (!result.complete) {
      this.attempts += 1;
      if (overBudget) this.flash('墨用完了，重来一笔。');
      else if (!result.reachedGoal) this.flash('收笔要落在印上。');
      else if (missing > 0) this.flash(`还差 ${missing} 颗朱砂。`);
      else this.flash('再试一笔。');
      this.stroke = [];
      this.lastPoint = null;
      this.childAt = { ...this.level.start };
      return;
    }
    this.beginWalk(this.stroke, result.dots, performance.now() - this.drawStartedAt);
  }

  private beginWalk(path: Vec2[], _dots: number[], drawMs: number): void {
    this.walkPath = path.slice();
    this.walkT = 0;
    this.walkDuration = clamp(this.strokeLengthOf(path) / 340, 0.5, 2.4);
    this.pendingDrawMs = drawMs;
    this.taken = new Set();
    this.phase = 'walk';
    this.ui.setPhase('walk');
    this.ui.setHint('墨童上路了。');
  }

  private pendingDrawMs = 0;

  private strokeLengthOf(path: Vec2[]): number {
    let total = 0;
    for (let i = 1; i < path.length; i++) total += dist(path[i - 1], path[i]);
    return total;
  }

  // ---------------------------------------------------------------- flow

  private bindUi(): void {
    this.ui.onAuto(() => this.autoPlay());
    this.ui.onRetry(() => this.retryLevel());
    this.ui.onMute(() => {
      this.sound.setMuted(!this.sound.muted);
      this.ui.setMuted(this.sound.muted);
    });
  }

  showTitle(): void {
    this.phase = 'title';
    this.ui.setPhase('title');
    this.ui.hideCard();
    this.titleT = 0;
    this.ui.renderTitle(() => {
      this.ui.hideTitle();
      this.startLevel(0, true);
    });
  }

  startLevel(index: number, reset = false): void {
    this.levelIndex = clamp(index, 0, this.levels.length - 1);
    if (reset && index === 0) {
      this.style = { ...NEUTRAL_STYLE };
      this.memories = [];
      this.attempts = 0;
    }
    this.claimed = new Set();
    this.taken = new Set();
    this.stroke = [];
    this.lastPoint = null;
    this.particles = [];
    this.attempts = 0;
    this.inkCtx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    this.childAt = { ...this.level.start };
    this.ui.hideCard();
    this.ui.hideTitle();
    this.ui.syncHud(this);
    this.ui.setHint(this.level.hint);
    this.ui.setPhase('brief');

    if (this.level.shadow) {
      this.shadow = planShadow(this.level, this.style, this.levelIndex);
      this.shadowPhaseT = 0;
      this.shadowDrawing = 0;
      this.phase = 'shadow';
      this.ui.setPhase('shadow');
      this.sound.airy();
    } else {
      this.shadow = null;
      this.phase = 'draw';
      this.ui.setPhase('draw');
    }
  }

  private enterDraw(): void {
    this.phase = 'draw';
    this.ui.setPhase('draw');
    this.ui.setHint(this.level.hint);
  }

  retryLevel(): void {
    this.startLevel(this.levelIndex);
  }

  autoPlay(): void {
    if (this.phase !== 'draw') return;
    this.autoMode = true;
    this.autoT = 0;
    this.autoPath = humanise(this.level.solution);
    this.stroke = [{ ...this.level.start }];
    this.lastPoint = { ...this.level.start };
    this.drawStartedAt = performance.now();
  }

  // ---------------------------------------------------------------- loop

  private loop(now: number): void {
    const dt = this.lastFrame ? Math.min(48, now - this.lastFrame) : 16;
    this.lastFrame = now;
    this.update(dt / 1000);
    this.render(now / 1000);
    this.rafId = requestAnimationFrame(this.loop);
  }

  private update(dt: number): void {
    if (this.blockedFlash > 0) this.blockedFlash = Math.max(0, this.blockedFlash - dt);
    if (this.phase === 'title') this.titleT += dt;
    this.updateParticles(dt);

    if (this.phase === 'shadow' && this.shadow) {
      this.shadowPhaseT += dt;
      const drawTime = 0.75;
      const walkTime = 1.15;
      if (this.shadowPhaseT < drawTime) {
        this.shadowDrawing = this.shadowPhaseT / drawTime;
      } else if (this.shadowPhaseT < drawTime + walkTime) {
        this.shadowDrawing = 1;
        const u = (this.shadowPhaseT - drawTime) / walkTime;
        this.claimAlongShadow(u);
      } else {
        this.enterDraw();
        this.ui.setHint(this.level.hint);
      }
    }

    if (this.phase === 'walk') {
      this.walkT += dt / this.walkDuration;
      const u = clamp(this.walkT, 0, 1);
      const eased = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const pos = positionAt(this.walkPath, eased);
      this.childAt = pos;
      // collect as we pass
      for (const d of this.level.dots) {
        if (this.claimed.has(d.id) || this.taken.has(d.id)) continue;
        if (dist(pos, d) <= d.r + 9) {
          this.taken.add(d.id);
          this.burst(d.x, d.y, CINNABAR, 18);
          this.sound.pluck(this.taken.size - 1);
        }
      }
      if (this.walkT >= 1) {
        this.completeWalk();
      }
    }

    if (this.autoMode && this.phase === 'draw') {
      this.autoT += dt;
      const u = clamp(this.autoT / 1.4, 0, 1);
      const target = positionAt(this.autoPath.length > 1 ? this.autoPath : this.level.solution, u);
      if (!this.lastPoint) this.lastPoint = { ...this.level.start };
      const steps = 2;
      for (let i = 0; i < steps; i++) {
        const mid = {
          x: lerp(this.lastPoint.x, target.x, (i + 1) / steps),
          y: lerp(this.lastPoint.y, target.y, (i + 1) / steps),
        };
        if (!blockedByHazard(this.lastPoint, mid, this.level)) this.extendStroke(mid);
      }
      if (u >= 1) {
        this.autoMode = false;
        this.drawing = false;
        this.finishStroke();
      }
    }
  }

  private claimAlongShadow(u: number): void {
    if (!this.shadow) return;
    const pos = positionAt(this.shadow.path, u);
    this.childAt = pos;
    for (const id of this.shadow.claims) {
      if (this.claimed.has(id)) continue;
      const dot = this.level.dots.find((d) => d.id === id);
      if (!dot) continue;
      if (dist(pos, dot) <= dot.r + 12) {
        this.claimed.add(id);
        this.burst(dot.x, dot.y, '#3a332c', 10);
        this.sound.shadowNote(this.claimed.size - 1);
      }
    }
  }

  private completeWalk(): void {
    const result = evaluateStroke(this.walkPath, this.level, this.claimed);
    const sample = extractStyle(this.walkPath, this.level, this.pendingDrawMs);
    this.style = blendStyle(this.style, sample);
    this.memories.push({ level: this.level, stroke: this.walkPath.slice(), taken: [...this.taken], claimed: [...this.claimed] });
    this.phase = 'result';
    this.ui.setPhase('result');
    this.ui.setHint('');
    this.ui.syncHud(this);
    this.sound.seal();
    this.burst(this.level.goal.x, this.level.goal.y, '#bb9647', 22);

    const pts = scoreLevel(result, this.level, this.claimed.size);
    const traits = loudestTraits(this.style, 2);
    const last = this.levelIndex === this.levels.length - 1;
    this.ui.showCard(`
      <p class="eyebrow">${NUMERALS[this.levelIndex] ? `第${NUMERALS[this.levelIndex]}关` : `第${this.levelIndex + 1}关`} · ${this.level.name}</p>
      <h2>收笔落印</h2>
      <div class="result-row">
        <div><b>${this.taken.size}</b><span>朱砂</span></div>
        <div><b>${this.claimed.size}</b><span>被它抢走</span></div>
        <div><b>${Math.round((result.length / this.level.inkBudget) * 100)}%</b><span>用墨</span></div>
        <div><b>${pts}</b><span>这一笔</span></div>
      </div>
      <p class="learned">墨影学会了 ${traits.map((t) => `<em>${t.word}</em>`).join(' 与 ')}</p>
      <button class="seal-btn" type="button" data-act="${last ? 'finale' : 'next'}">${last ? '收 卷' : '下 一 关'}</button>
    `);
    this.ui.bindCardAction('next', () => this.startLevel(this.levelIndex + 1));
    this.ui.bindCardAction('finale', () => this.showFinale());
  }

  showFinale(): void {
    this.phase = 'finale';
    this.ui.setPhase('finale');
    this.sound.finish();
    const traits = loudestTraits(this.style, 3);
    const line = traits.map((t) => t.word).join(' · ');
    const canvas = this.composeScroll();
    this.ui.showCard(`
      <p class="eyebrow">终 · 对影</p>
      <h2>收卷</h2>
      <p class="sub">这是你这一局留下的画</p>
      <div id="finale-holder"></div>
      <p class="learned">墨影的性情：<em>${line}</em></p>
      <div class="cta">
        <button class="primary" data-act="download">存 下 这 幅 画</button>
        <button class="plain" data-act="again">再 来 一 局</button>
      </div>
    `);
    const holder = document.getElementById('finale-holder');
    canvas.className = 'finale-canvas';
    holder?.appendChild(canvas);
    this.ui.bindCardAction('download', () => {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mo-tong.png';
      a.click();
    });
    this.ui.bindCardAction('again', () => {
      this.levels = buildAllLevels();
      this.ui.hideCard();
      this.startLevel(0, true);
    });
  }

  /** A landscape album leaf: every finished level as a small plate, plus the colophon. */
  private composeScroll(): HTMLCanvasElement {
    const W = 1080;
    const H = 720;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.drawImage(this.paper, 0, 0, LOGICAL_W, LOGICAL_H, 0, 0, W, H);
    g.fillStyle = 'rgba(247,242,229,0.5)';
    g.fillRect(0, 0, W, H);

    const cols = 4;
    const rows = 2;
    const gutter = 18;
    const padX = 40;
    const padTop = 54;
    const colophon = 128;
    const cellW = (W - padX * 2 - colophon - gutter * (cols - 1)) / cols;
    const cellH = (H - padTop - 34 - gutter * (rows - 1)) / rows;
    const scale = Math.min(cellW / LOGICAL_W, cellH / LOGICAL_H) * 0.94;

    this.memories.forEach((mem, i) => {
      const cx = padX + (i % cols) * (cellW + gutter);
      const cy = padTop + Math.floor(i / cols) * (cellH + gutter);
      g.save();
      g.beginPath();
      g.rect(cx, cy, cellW, cellH);
      g.clip();
      g.translate(cx + cellW / 2, cy + cellH / 2);
      g.scale(scale, scale);
      g.translate(-LOGICAL_W / 2, -LOGICAL_H / 2);
      drawBrushPath(g, mem.stroke, { width: 12, alpha: 0.88, wet: 0.55, seed: 11 });
      for (const d of mem.level.dots) {
        g.globalAlpha = 0.8;
        g.drawImage(this.dotSpriteSmall, d.x - 30, d.y - 30, 60, 60);
      }
      g.restore();
      g.strokeStyle = 'rgba(23,19,15,0.1)';
      g.lineWidth = 1;
      g.strokeRect(cx + 0.5, cy + 0.5, cellW - 1, cellH - 1);
      g.fillStyle = 'rgba(23,19,15,0.4)';
      g.font = `17px "KaiTi","STKaiti",serif`;
      g.fillText(mem.level.name, cx + cellW - 44, cy + cellH - 12);
    });

    // colophon on the right edge
    g.save();
    g.translate(W - 92, 64);
    g.fillStyle = 'rgba(23,19,15,0.8)';
    g.font = `30px "KaiTi","STKaiti",serif`;
    ['墨', '童'].forEach((ch, i) => g.fillText(ch, 0, i * 38));
    g.font = `12px "Songti SC","SimSun",serif`;
    g.fillStyle = 'rgba(23,19,15,0.5)';
    const now = new Date();
    const stamp = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    [...stamp].forEach((ch, i) => g.fillText(ch, 4, 120 + i * 14));
    g.restore();

    g.drawImage(this.sealSprite, W - 122, H - 128, 72, 72);
    return c;
  }

  private burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 150;
      const life = 0.4 + Math.random() * 0.7;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 20,
        life,
        max: life,
        size: 0.8 + Math.random() * 2.2,
        color,
        gravity: 90,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 0.985;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  // ---------------------------------------------------------------- render

  private render(time: number): void {
    const ctx = this.ctx;
    const k = this.dpr * this.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(k, 0, 0, k, this.dpr * this.offsetX, this.dpr * this.offsetY);

    if (this.phase === 'title') {
      this.drawTitleScene(ctx, time);
      return;
    }

    // paper with its shadow
    ctx.save();
    const path = paperPath(LOGICAL_W, LOGICAL_H, 8);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#efe6d4';
    ctx.fill(path);
    ctx.restore();

    ctx.save();
    ctx.clip(path);
    ctx.drawImage(this.paper, 0, 0);
    ctx.drawImage(this.inkLayer, 0, 0);

    const lvl = this.level;
    this.drawHazards(ctx, lvl, time);

    // a hairline between the sheet and the marginalia column
    ctx.save();
    ctx.strokeStyle = 'rgba(23,19,15,0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1012, 118);
    ctx.lineTo(1012, 632);
    ctx.stroke();
    ctx.restore();

    // goal seal
    const active = this.phase === 'draw';
    const pulse = 1 + Math.sin(time * 2) * (active ? 0.03 : 0.012);
    ctx.save();
    ctx.globalAlpha = active ? 0.95 : 0.55;
    ctx.translate(lvl.goal.x, lvl.goal.y);
    ctx.scale(pulse, pulse);
    ctx.drawImage(this.sealSprite, -lvl.goal.r * 1.35, -lvl.goal.r * 1.35, lvl.goal.r * 2.7, lvl.goal.r * 2.7);
    ctx.restore();

    // dots
    for (const d of lvl.dots) {
      if (this.taken.has(d.id)) continue;
      const claimed = this.claimed.has(d.id);
      ctx.save();
      ctx.globalAlpha = claimed ? 0.22 : 1;
      const s = claimed ? 0.55 : 1 + Math.sin(time * 2.2 + d.id) * 0.03;
      ctx.translate(d.x, d.y);
      ctx.scale(s, s);
      if (claimed) ctx.filter = 'grayscale(1)';
      ctx.drawImage(this.dotSprite, -d.r * 2.5, -d.r * 2.5, d.r * 5, d.r * 5);
      ctx.restore();
    }

    // the shadow's route
    if (this.shadow && (this.phase === 'shadow' || this.phase === 'draw' || this.phase === 'walk')) {
      const pts = this.shadow.path.slice(0, Math.max(2, Math.ceil(this.shadow.path.length * this.shadowDrawing)));
      ctx.save();
      ctx.globalAlpha = this.phase === 'shadow' ? 0.5 : 0.2;
      drawBrushPath(ctx, pts, { color: '#54483d', width: 6.2, alpha: 0.55, wet: 0.25, seed: 7 });
      ctx.restore();
    }

    // current stroke
    if (this.stroke.length > 1) {
      ctx.save();
      ctx.globalAlpha = 1;
      drawBrushPath(ctx, this.stroke, { width: 9.6, wet: 0.65, seed: 3 });
      ctx.restore();
    }

    // start ring while drawing
    if (this.phase === 'draw' && this.stroke.length === 0) {
      const r = 34 + Math.sin(time * 2.4) * 3;
      ctx.save();
      ctx.strokeStyle = 'rgba(23,19,15,0.22)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.arc(lvl.start.x, lvl.start.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    this.drawShadowChild(ctx, time);
    this.drawChild(ctx, time);
    this.drawParticles(ctx);

    if (this.blockedFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.blockedFlash * 0.5;
      ctx.fillStyle = 'rgba(120,20,12,0.12)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.restore();
    }
    ctx.restore();

    // cursor: a small brush dot while drawing
    if (this.phase === 'draw') this.drawCursor(ctx);
  }

  /** The title screen is the game itself, idling: a stroke drawn, a walk, a reset. */
  private drawTitleScene(ctx: CanvasRenderingContext2D, time: number): void {
    const cycle = 8.4;
    const t = this.titleT % cycle;
    const drawTime = 2.7;
    const walkTime = 2.7;
    const progress = clamp(t / drawTime, 0, 1);
    const walkU = clamp((t - drawTime) / walkTime, 0, 1);

    const path = paperPath(LOGICAL_W, LOGICAL_H, 8);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#efe6d4';
    ctx.fill(path);
    ctx.restore();

    ctx.save();
    ctx.clip(path);
    ctx.drawImage(this.paper, 0, 0);

    for (let i = 0; i < this.demoDots.length; i++) {
      const d = this.demoDots[i];
      const pulse = 1 + Math.sin(time * 2 + i) * 0.03;
      const taken = walkU > (i + 1) / (this.demoDots.length + 0.4);
      ctx.save();
      ctx.globalAlpha = taken ? 0.18 : 1;
      ctx.translate(d.x, d.y);
      ctx.scale(pulse, pulse);
      ctx.drawImage(this.dotSprite, -DOT_R * 2.5, -DOT_R * 2.5, DOT_R * 5, DOT_R * 5);
      ctx.restore();
    }

    const shown = this.demoPath.slice(0, Math.max(2, Math.floor(this.demoPath.length * progress)));
    if (t < drawTime + walkTime) {
      ctx.save();
      ctx.globalAlpha = 0.95;
      drawBrushPath(ctx, shown, { width: 9.4, wet: 0.6, seed: 5 });
      ctx.restore();
      const head = shown[shown.length - 1];
      if (head) drawInkChild(ctx, head.x, head.y, time, { scale: 1.35, squash: 0.2, facing: 1 });
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(this.sealSprite, 1040, 604, 76, 76);
    ctx.restore();
  }

  private drawHazards(ctx: CanvasRenderingContext2D, lvl: Level, time: number): void {
    for (const h of lvl.hazards) {
      const sprite = this.hazardSprites.get(lvl.id * 1000 + h.id);
      if (!sprite) continue;
      const s = 1 + Math.sin(time * 0.9 + h.id) * 0.012;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.scale(s, s);
      const size = h.r * 3.4;
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  private drawChild(ctx: CanvasRenderingContext2D, time: number): void {
    const isShadowPhase = this.phase === 'shadow';
    const pos = isShadowPhase && this.shadow ? positionAt(this.shadow.path, clamp(this.shadowPhaseT / 1.9 - 0.15, 0, 1)) : this.childAt;
    drawInkChild(ctx, pos.x, pos.y, time, {
      facing: this.childFacing,
      squash: this.phase === 'walk' ? 0.4 : this.childSquash * 0.5,
      scale: 1.4,
    });
  }

  private drawShadowChild(ctx: CanvasRenderingContext2D, time: number): void {
    if (!this.shadow) return;
    if (this.phase === 'walk' || this.phase === 'result') {
      const p = positionAt(this.shadow.path, 0.86);
      ctx.save();
      drawInkChild(ctx, p.x - 18, p.y + 6, time * 1.3, {
        alpha: 0.32,
        color: '#2b2520',
        eyeColor: 'rgba(184,55,42,0.75)',
        scale: 1.05,
        facing: -1,
      });
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.6), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawCursor(ctx: CanvasRenderingContext2D): void {
    const mouse = this.pointer;
    if (!mouse) return;
    ctx.save();
    ctx.globalAlpha = this.drawing ? 0.55 : 0.3;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, this.drawing ? 3 : 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private pointer: Vec2 | null = null;

  setPointer(p: Vec2 | null): void {
    this.pointer = p;
  }

  private flash(msg: string): void {
    this.hintFlash = msg;
    this.hintUntil = performance.now() + 2200;
    this.ui.flashHint(msg);
  }

  get transientHint(): string {
    return performance.now() < this.hintUntil ? this.hintFlash : '';
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
  }

  // ---------------------------------------------------------------- test hooks

  snapshot() {
    return {
      phase: this.phase,
      level: this.levelIndex,
      dots: this.level.dots.length,
      taken: this.taken.size,
      claimed: this.claimed.size,
      budget: this.level.inkBudget,
      strokeLen: Math.round(this.strokeLength()),
      style: { ...this.style },
      finished: this.memories.length,
    };
  }

  /** used by the end-to-end test: solve the current level with the reference route */
  solveForTest(): void {
    if (this.phase !== 'draw') return;
    this.autoPlay();
  }

  /** used by tests to jump straight to a level, replaying the shadow in fast-forward */
  jumpTo(index: number): void {
    this.startLevel(index);
    if (this.phase === 'shadow') {
      for (let i = 0; i <= 40; i++) this.claimAlongShadow(i / 40);
      this.shadowPhaseT = 99;
      this.enterDraw();
    }
  }
}

export function positionAt(path: readonly Vec2[], u: number): Vec2 {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return { ...path[0] };
  const total = pathLength(path);
  let target = clamp(u, 0, 1) * total;
  for (let i = 1; i < path.length; i++) {
    const seg = dist(path[i - 1], path[i]);
    if (target <= seg) {
      const t = seg === 0 ? 0 : target / seg;
      return { x: lerp(path[i - 1].x, path[i].x, t), y: lerp(path[i - 1].y, path[i].y, t) };
    }
    target -= seg;
  }
  return { ...path[path.length - 1] };
}

/** A slightly wobbly copy of the reference route, so the demo reads as a hand, not a machine. */
function humanise(path: readonly Vec2[]): Vec2[] {
  return path.map((p, i) => {
    const prev = path[Math.max(0, i - 1)];
    const next = path[Math.min(path.length - 1, i + 1)];
    const len = Math.max(1, Math.hypot(next.x - prev.x, next.y - prev.y));
    const nx = -(next.y - prev.y) / len;
    const ny = (next.x - prev.x) / len;
    const wobble = Math.sin(i * 0.21) * 2.6 + Math.sin(i * 0.07) * 3.4;
    return { x: p.x + nx * wobble, y: p.y + ny * wobble };
  });
}

function pathLength(path: readonly Vec2[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += dist(path[i - 1], path[i]);
  return total;
}

export const GOAL_RADIUS = GOAL_R;
export const BRUSH_RADIUS = BRUSH_R;
