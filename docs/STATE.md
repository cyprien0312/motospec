# motospec — 短期记忆

> 本 repo 的**唯一**状态与待办来源。别处只能链接过来，不许另起清单。
> 最后更新：2026-08-03（首次建立，状态经实跑核对）

## 现在是什么状态

- **能跑吗**：能。`npm test` → **259 tests / 259 pass / 0 fail**（2026-08-03 本机实跑，24 个 test 文件）
- **跑在哪**：**没有 bundler、没有 build step**，纯 ES modules 静态服务（`npm run dev` 那种说法是错的，
  别照着做）。
  - 本机：`motospec-dev` systemd user service 常驻 **:5173**（active，LAN `http://192.168.1.153:5173`）
  - 线上：**`main` 每次 push 由 Vercel 自动部署**
  - crontab **每天 23:00** `scripts/auto-archive.sh`：`git add -A` + commit + push。
    **后果：会话结束时留在工作区的半成品，当晚就会上线**——别把树留在半坏状态
- **上次动它**：2026-07-29，`feat(scan): 加 inspect_scan_file.py`。
  最近一批工作集中在 **3D scan → chassis/linkage pipeline**（5 个连续 commit，07-29 收尾）
- **git**：`main`，与 origin 同步，工作区干净

## 待办

| 优先级 | 事项 | 不做会怎样 |
|---|---|---|
| P1 | **测试数对不上**：本机 259/259，而 `CLAUDE.md` 记的 Windows baseline 是 **272/272**（同为 2026-08-03）。差 13 个，原因未查 | 两台机器跑出不同的用例数，任何一边都不能当作"全绿"的依据 |
| P1 | `CHANGELOG.md` 顶部仍是 `## Unreleased — MotoSPEC v5 parity, first batch`，而 07-29 的 3D scan pipeline 没进 changelog | 对外看不出这个项目最近做了最大的一块功能 |
| P2 | scan pipeline 的四组实验数据写在 `scan/README.md`，`verify_claims.py` 可复跑，但**没接进 `npm test`** | 改了 scan 相关代码不会红，得有人记得手动跑 |
| P2 | 改了 `index.html` / `src/` / `data/` 之后 `MotoSPEC.exe` 需要重新 build（`windows-launcher/build.ps1`），没有任何检查守住 | exe 静默地服务旧文件，Windows 那边看到的是过期版本 |

工程侧的局限清单已经有专门文件：**`docs/LIMITATIONS.md`**（每条标 刻意/待做/无法），
改 `formulas.js` / `linkage.js` / `logger-export.js` / `sensitivity.js` 的物理或 gating 时要同步它。
本文件只放状态与待办，不重复那份。

## 已放弃（附原因，别再提）

- ~~继续做 `~/moto-frame-mvp`~~ — 静态 HTML 原型，已被本项目取代（见 `~/CLAUDE.md`）

## 最近关掉的

- （首次建立，暂无）
