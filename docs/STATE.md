# motospec — 真相源

> 本 repo 的**唯一**状态与待办来源。别处只能链接过来，不许另起清单。
> 最后更新：2026-08-03（首次建立，状态经实跑核对）

## 现在是什么状态

- **能跑吗**：能。`npm test` → **259 tests / 259 pass / 0 fail**（2026-08-03 实跑）
- **跑在哪**：纯前端本地应用，`npm run dev`（Vite，`--host` 可局域网访问）。
  唯一的自动任务是 crontab **每天 23:00** `scripts/auto-archive.sh` → `logs/auto-archive.log`
- **上次动它**：2026-07-29，`feat(scan): 加 inspect_scan_file.py`。
  最近一批工作集中在 **3D scan → chassis/linkage pipeline**（5 个连续 commit，07-29 收尾）
- **git**：`main`，与 origin 同步，工作区干净

## 待办

| 优先级 | 事项 | 不做会怎样 |
|---|---|---|
| P1 | `CHANGELOG.md` 顶部仍是 `## Unreleased — MotoSPEC v5 parity, first batch`，而 07-29 的 3D scan pipeline 没进 changelog | 对外看不出这个项目最近做了最大的一块功能 |
| P2 | scan pipeline 的四组实验数据写在 `scan/README.md`，`verify_claims.py` 可复跑，但**没接进 `npm test`** | 改了 scan 相关代码不会红，得有人记得手动跑 |
| P2 | repo 里有 `MotoSPEC.exe`、`backups/`、`motospec_v5_unpacked`（后者在 home 下） | 分不清哪些是产物、哪些是参考资料、哪些该归档 |

## 已放弃（附原因，别再提）

- ~~继续做 `~/moto-frame-mvp`~~ — 静态 HTML 原型，已被本项目取代（见 `~/CLAUDE.md`）

## 最近关掉的

- （首次建立，暂无）
