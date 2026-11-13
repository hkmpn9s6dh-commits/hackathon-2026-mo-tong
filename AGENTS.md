# AGENTS.md — 这个仓库怎么造

从比赛模板（v5.6）改写给单人作业。

## 1. 四道闸

- **闸 A —— 我们对要做的东西达成一致了吗？** 先写演示脚本，再写能用命令判定的验收条件（`docs/01-SPEC.md`），同时交 `docs/07-UI.md` §1–4：风格预设、尺子、一个记忆点、主屏规格。过闸 A 之后范围只减不增。
- **闸 B —— 整个流程走完了吗？** 每一步都过 `scripts/verify.sh`：类型检查、单元检查、构建、卫生检查、浏览器端到端。红的不过夜。
- **闸 C —— 你能证明它能用吗？** 全新 clone、只照 README 跑，必须能构建能玩；每条验收条件都有 `proof/` 里的证据或 verify.sh 里的一条命令。
- **闸 D —— 评委第一眼会停下来吗？** 主屏和至少 5 张外部尺子混在一起盲排，交给没参与制作的模型排名；必须排在至少 3 张尺子之上。

## 2. 干活的规矩

1. 每完成一条验收条件就推一次分支，断了不丢。
2. 一场比赛一个仓库。
3. 主屏先上真环境（GitHub Pages）再谈完成；提交版还要能在魔搭创空间静态托管下跑。
4. 仓库不放密钥；`verify.sh` 会扫 key 形态的字符串。
5. 界面文字最少 16px（标签类除外）；正文对比度 ≥ 4.5:1。
6. 无障碍算完成的一部分：键盘可达、焦点可见、`prefers-reduced-motion` 下不抖。

## 3. 完成的定义

- [x] 闸 A：`docs/00-BRIEF.md`、`docs/01-SPEC.md`、`docs/07-UI.md` §1–4
- [x] 闸 B：`bash scripts/verify.sh` 全绿
- [x] 闸 C：全新 clone 可构建，`proof/` 有逐条证据
- [x] 闸 D：盲排记录在 `proof/rank/`
- [x] 包装：演示视频、封面、提交文案、创作手记
- [x] 线上可玩；仓库公开且有许可证；`ms_deploy.json` 可直接装进创空间

## 4. 目录

```
src/core/     纯逻辑：几何、关卡、笔画判定、学习模型（可在 Node 里单测）
src/render/   纸、墨、朱砂、印章的绘制
src/game.ts   状态机、输入、动画、收卷
src/ui.ts     HUD 与卡片
scripts/      verify.sh、e2e.mjs、shots.mjs、record.mjs、cover.mjs
docs/         00 BRIEF · 01 SPEC · 04 PROOF · 05 SUBMISSION · 06 STEPS · 07 UI
proof/        证据：截图、盲排、clone 记录
```
