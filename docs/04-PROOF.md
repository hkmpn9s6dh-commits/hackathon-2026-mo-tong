# 04 — PROOF：它真的能用

> 闸 C 的证据页。每条验收条件配一条命令或一份证据；任何人都能照着重跑。

## 1. 全新 clone（闸 C 硬门槛）

见 `proof/clone-check.md`：从 GitHub 拉一份全新副本，只照 README 跑 `npm ci && bash scripts/verify.sh`，17 项全部通过（输出原文在文件里）。

## 2. 命令证据

| 条件 | 命令 | 最近一次结果 |
|---|---|---|
| AC-1/3/4 关卡可解、墨渍不压路线、种子可复现 | `npx vitest run` | 23 passed |
| AC-2/5 阻挡与完成判定 | 同上 | 23 passed |
| AC-6/7 学习模型与墨影 | 同上 | 23 passed |
| AC-8 构建与相对路径 | `bash scripts/verify.sh` | all checks passed |
| AC-9/10/11 浏览器全流程、真实鼠标拖动、光标可见、无 console 错误、414px | `node scripts/e2e.mjs` | 12 checks passed |
| AC-12 创空间静态 | `ms_deploy.json` + 根 `index.html` | 见 §4 |
| AC-13 无密钥 | `verify.sh` 的 `no api keys committed` | PASS |

单元检查的原文（2026-11-13）：

```
 ✓ test/core.test.ts (23 tests) 799ms
   Test Files  1 passed (1)
        Tests  23 passed (23)
```

浏览器端到端的原文（2026-11-13，本地生产构建）：

```
PASS  title screen
PASS  system cursor is never hidden
PASS  starts on level 1 in draw phase
PASS  brush cursor in the play phase
PASS  a press far from the child still draws ink
PASS  tracing the route with a real mouse completes level 1
PASS  shadow takes at least one dot before the player draws
PASS  shadow never takes more than 40 % of the dots
PASS  shadow level still solvable with the reference route
PASS  final level reaches a result card
PASS  finale composes a scroll
PASS  no horizontal overflow at 414px
PASS  no console errors
```

## 3. 截图

- `proof/shots/01-title.png` 标题页
- `proof/shots/02-drawing.png` 落笔与行走
- `proof/shots/03-result.png` 结算纸片
- `proof/shots/04-shadow-level.png` 墨影先走
- `proof/shots/05-finale.png` 收卷册页
- `proof/shots/06-mobile.png` 414px 竖屏

（`node scripts/shots.mjs` 可一键重出。）

## 4. 线上与创空间

- GitHub Pages：https://hkmpn9s6dh-commits.github.io/hackathon-2026-mo-tong/
- 创空间：**待用户部署**（步骤见 `06-SUBMIT-STEPS.md`）。静态托管要求根目录 `index.html` + `assets/`，本仓库 `ms_deploy.json` 已按 `sdk_type: static` 写好。
- 线上实测：对 Pages 地址跑 `BASE_URL=https://hkmpn9s6dh-commits.github.io/hackathon-2026-mo-tong/ node scripts/e2e.mjs`，10 项全过（2026-11-13）。
- 创空间部署后的冒烟：把 `BASE_URL` 指到创空间地址，同一套 10 项应全过。

## 4.5 用户报的两个 bug（2026-11-13 已修，已加回归）

1. **首页鼠标几乎看不见**：`#stage { cursor: none }` 把系统指针整屏藏了，只有按钮上能偶然露出原生指针。改为：`default` / 落笔时 `crosshair`，画布内的笔尖圆环改成按逻辑坐标绘制（原来用的是 CSS 像素，位置是错的）。回归：`system cursor is never hidden`、`brush cursor in the play phase`。
2. **第一关怎么拖都拖不动**：起笔点必须在墨童 64px 内，否则**一点墨都不出**；即使起笔成功，一笔不完整就静默清空。改为：**纸上任意位置按下都从墨童起笔**（连向指针的那一段照旧受墨渍阻挡），被挡时给明确提示；放弃的笔画以淡墨淡出而不是瞬间消失；失败原因用画布顶部的大字提示（原来是 16px 小字，容易被忽略）。回归：`a press far from the child still draws ink`、`tracing the route with a real mouse completes level 1`。

## 5. 已知边界（如实写在前面）

1. **墨影是「学风格」，不是「学策略」**：它估计的是五个连续参数（绕远/贴边/贪近/摆幅/行笔），不是逐帧模仿动作。所以它复现的是「你走路的脾气」，不是「你在这一格会怎么点」。
2. **抢点上限定死 40%**：`planShadow` 里有一行 `Math.floor(dots * 0.4)`。这是为了保证关卡一定可通；如果放开，习性强的人会把关卡抢成死局。
3. **没有本地存档**：「再来一局」清空全部习性。评委每次刷新都是同一个起点，这是刻意的。
4. **没有接任何云端模型**：本机到 Google/OpenAI 的接口不可达（见 `00-BRIEF.md` 的环境实测表），且接云端会让「点开就能玩」不成立。
5. **字体依赖系统**：`KaiTi` 缺失时回落衬线体，字形会变，但不影响可读性。
6. **竖屏手机上「收卷」偏小**：1080×720 的册页在 414px 宽下只有约 320px，七格里能看清笔迹、看不清关名。建议横屏或桌面看；这是取舍——竖屏优先保证按钮和正文可用。
7. **盲排的两位评委只有档位差**：一位 reasoning 档、一位 lite 档，底层模型家族无法从运行记录核实，按「两位独立、非作者」记录，已在 `proof/rank/RESULTS.md` 标注为下一场要补的弱点。
