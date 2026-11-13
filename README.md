# 墨童 · Mo Tong

**一个会学你的小妖怪。** 在宣纸上画一笔，墨童照着走；你走得越多，它越像你——连你偷懒抄的那条近路，也学得会。

> An ink-wash one-stroke game: you draw a single line on rice paper, a little ink spirit walks it, and a shadow learns your habits — then competes with you for the cinnabar.

- 线上试玩：https://hkmpn9s6dh-commits.github.io/hackathon-2026-mo-tong/
- 参赛：AI+∞ 开发者创作大赛 第三期「AI 造游戏」（魔搭社区 × Qoder × 盛趣游戏）
- 纯前端、无后端、无外部接口、无字体外链：所有画面与声音都是代码现画的。

## 怎么玩

1. 按住**墨童**拖动：一笔连起所有**朱砂**，收笔落在**墨**印上。
2. 笔尖碰不得**墨渍**，撞上就停住；墨量有限，笔路可以回撤。
3. 第 4 关起，**墨影**先走一步——它用你的习惯走，还会顺手抢走你的朱砂。
4. 七关结束，收卷：你这一局的每一笔都在那页册页上，可下载。

手机可用：竖屏也能玩（建议横屏）。

## 它是怎么「学」的

墨影不是写死的脚本。每完成一关，游戏从你那一笔里估五个习性：

| 参数 | 从笔画里怎么读 | 它怎么用 |
|---|---|---|
| 绕远 `detour` | 笔路长度 ÷ 近似最优巡游长度 | 数值高，墨影就绕一个鼓包走 |
| 贴边 `hug` | 笔路到最近墨渍的平均余量 | 数值高，它就贴着墨渍边缘走 |
| 贪近 `greedy` | 你取朱砂的顺序与「最近优先」的一致度 | 数值高，它就按最近优先改访问顺序 |
| 摆幅 `sway` | 笔路相对自身平滑线的偏差 | 数值高，它的路线就带正弦抖动 |
| 行笔 `tempo` | 笔路长度 ÷ 落笔时长 | 决定它走多快 |

估出来的参数用指数平滑进人物模型（`src/core/learn.ts` 的 `extractStyle` / `blendStyle`），再由 `planShadow` 变形成一条具体的路线。为了关卡一定能通，墨影最多抢走 40% 的朱砂——这是设计上的保护，不是模型的假设，写在代码注释与测试里。

五个参数、四种形变、抢点上限，全部可以在 Node 里单测（`test/core.test.ts`）。

## 跑起来

```bash
npm ci
npm run dev        # http://localhost:5183
npm run build      # 产物在 dist/
npm run preview    # 预览构建产物
bash scripts/verify.sh   # 类型 + 单元 + 构建 + 卫生 + 浏览器端到端
```

需要 Node 20+（开发时用 22.22.2）。浏览器端到端需要 Playwright 的 Chromium：`npx playwright install chromium`，或设置 `CHROME_PATH`。

## 结构

```
src/core/     rng · geom · levels · stroke · learn —— 纯逻辑，无 DOM，可单测
src/render/   paper（纸与远山）· ink（笔触、朱砂、墨渍、印、墨童）
src/game.ts   状态机、输入、行走动画、收卷
src/ui.ts     题跋式 HUD、结算纸片
scripts/      verify.sh · e2e.mjs · shots.mjs · record.mjs · cover.mjs
docs/         00-BRIEF · 01-SPEC · 04-PROOF · 05-SUBMISSION · 06-SUBMIT-STEPS · 07-UI
```

技术：TypeScript（strict）+ Vite，零运行时依赖。画面全部 Canvas 2D 程序化绘制；音效全部 WebAudio 合成（`src/audio.ts`），仓库里没有一个音频或图片文件。

## 部署

- **GitHub Pages**：`bash scripts/deploy.sh`（把 `dist/` 推到 `gh-pages`）。
- **魔搭创空间（静态）**：仓库根已有 `ms_deploy.json`（`sdk_type: static`）；创空间的仓库根目录直接放 `index.html` 与 `assets/`（构建产物，不要带 `dist/` 这一层）。

## 许可

MIT，见 [LICENSE](LICENSE)。
