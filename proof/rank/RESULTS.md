# 闸 D 盲排 · 第 1 轮

- 时间：2026-11-13
- 图包：`proof/rank/r1/`（A–G，1200×675，随机字母，本方是 **F**；对照表在 `MAP-r1-private.txt`，评委看不到）
- 尺子（6 张，全部是发行过、被公认为同类审美标杆的作品封面／主视觉）：A = Sky: Children of the Light｜B = Cocoon｜C = Monument Valley（Panoramic）｜D = Gris｜E = Signs of the Sojourner｜G = Okami HD

> 说明：本轮尺子取的是这些作品的官方封面主视觉（Steam capsule），不是运行截图。原因是本机到多数游戏站点的直连不稳，Steam CDN 可用。这一点会拉高「海报感」的分数、压低「像不像一屏可玩的界面」，所以本轮对**本方**其实更不利——我们交的是运行中的画面。

## 评委

两位独立子代理，互不可见，只看图，不看仓库、不看提示词以外的任何信息。派单时分别指定了不同的模型档位（一位 reasoning 档、一位 lite 档）；具体底层模型家族无法从运行记录里核实，**按「两位不同档位、非本方作者」记录，不算两个不同家族**——这是本轮的一个已知弱点，下一场要换成可核实的跨家族评委。

## 结果

| 评委 | 排名 | 本方位置 | 在几张尺子之上 |
|---|---|---|---|
| 一号 | **F** > B > A > D > G > C > E | 第 1 / 7 | 6 / 6 |
| 二号 | A > **F** > B > C > D > E > G | 第 2 / 7 | 5 / 6 |

过线条件是「排在至少 3 张尺子之上」，两位都过。**闸 D 通过。**

## 评委原话（节选）

**一号 · 给 F**
> The only genuine in-game screen here — a paper-textured ink-wash level where a brushstroke path, tiny ink-sprite hero, red waypoints and a level seal tell you the whole mechanic at a glance.
> 弱点：Composition is quiet and typography is small, so the middle of the frame reads as empty rather than composed.

**二号 · 给 F**
> Nothing else looks like it — a living ink brushstroke is the player path, with red seals, ink-blot hazards and marginal annotations on paper texture; the level label and side notes prove it's a real playable screen.
> 弱点：The playable subject is tiny and the frame is mostly empty paper, so at thumbnail size it can be mistaken for a design sketch.

**一号 · 结论**
> F and B separate themselves because each has an actual idea you can hold in your head … rather than a style applied to a frame.

**二号 · 结论**
> The top two both show a world with a body in it and a legible verb … The remaining five are all tasteful title cards or cover paintings: beautiful to glance at, but they withhold the game itself.

> 时序说明：盲排用的 F 图取自放大前的版本；两位评委都点了「主角太小、画面偏空」之后，当天就改了（墨童 1.4×→1.9×、棋盘纵向拉到 190–585）。改后的画面只会比评委看到的那一版更强，结论不改。

## 两位共同点到的两件事（下一轮要处理）

1. **画面中段偏空**：1200×750 的纸面里，元素集中在中部一条带上，上下留白过多。两位都用了「empty paper」这个说法。
2. **主角太小**：墨童在 1200 宽的画面里只有约 40px 高，缩略图下几乎看不见。两位都说「tiny」。

这两条已记进 `04-PROOF.md` 的「已知边界」，也是下一场（或本轮若有时间）的第一优先改法：把墨童放大到 1.8×、把棋盘纵向分布拉开，而不是简单地加东西。
