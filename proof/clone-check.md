# 闸 C · 全新 clone 举证

- 时间：2026-11-13 09:24（北京）
- 机器：💻家用笔记本 2 号（Win11 · Node 22.22.2）
- 命令：只照 README 走，不额外装东西

```
git clone --depth 1 https://github.com/hkmpn9s6dh-commits/hackathon-2026-mo-tong
cd hackathon-2026-mo-tong
npm ci
bash scripts/verify.sh
```

## 输出原文

```
Mo Tong verification (full)
-------------------------------------------------------
node available                                   PASS
npm available                                    PASS
typescript type check                            PASS
core unit checks (23)                            PASS
production build                                 PASS
dist/index.html exists                           PASS
asset paths are relative (pages + static space)  PASS
MIT licence present                              PASS
README has run instructions                      PASS
ModelScope static deploy manifest                PASS
docs/00-BRIEF.md                                 PASS
docs/01-SPEC.md                                  PASS
docs/07-UI.md                                    PASS
docs/05-SUBMISSION.md                            PASS
no api keys committed                            PASS
browser end-to-end (9 checks)                    PASS
-------------------------------------------------------
all checks passed
EXIT:0
```

## 说明

- `npm ci` 用仓库里的 `package-lock.json`，45 个包。
- 验证脚本自己起一个静态服务器（`python -m http.server`），把这次构建出来的 `dist/` 喂给 Playwright 跑完 10 项浏览器检查后关掉；所以记录里的端到端跑的就是**这份 clone 的产物**。
- 全新 clone 里没有缓存、没有 `node_modules`、没有 `dist`。
