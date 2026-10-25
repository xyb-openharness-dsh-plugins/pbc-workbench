# 发布与回滚记录

## 当前状态（2026-10-25 · 包版本 0.2.4）

版本/tag/commit：`0.2.4` / 未打 tag / 见 `git log -1`（本轮 P0 修复后尚未提交时本文先落，随提交一起更新）。
变更的功能 ID：M6 装机接线（无新业务功能；修的是"装进宿主才走到"的三个缺陷）。
用户授权范围：用户在开工时授权"独立走完 M0–M9"，其中 M6 允许安装到本机 Desktop；
**Git push / Release / 市场投稿未获单独授权**，故下表这三行保持"未执行"。

家族一致性：`npm run audit` → **37/37 通过 · 0 失败 · 0 待人工**。
（历史：M1 时点 24/30 · 6 失败，M5 收口时清零；本轮修 `check-install` 判据后仍 37/37。）
源码检查：`npm run check` 退出 0 —— 版本一致性 7 处、语法 52 文件、schema 24 表 / 0 判读列、
医疗表述 30 个实现文件 0 处越界、演示库与 schema 同构、**85 个测试全绿**、宿主注册契约符合。
包检查/大小/hash：`release/ductpal-dsh-pbc-workbench-0.2.4.tgz`，
`7c5d18da8fb727087a95d3ea2a45873ab9ba74612a89eee3db3c7933ba53e241`，50 files / 3.4 MiB。
包内四要素已逐项核对（`dsh` 块 / `cordis.patch.yml` 的 `config.root` / `lib/client.js` 540 行无"接入骨架" / 版本同源）。
实机证据：装机副本探针（假宿主 + 真库）通过 —— `health.version=0.2.4`、
`POST /symptoms` 201 且 `persisted:true`、症状条数 7→8、`itch=99` 回 400 带 `field`、
`GET /export/A.md` 200 且七段齐；`<root>/xyb-pbc.sqlite` 真落盘。
**重启后的真机走查未做**，见下表"Desktop 界面层"。

README/许可证/素材来源/运行依赖/更新说明：README 五段式已更新至 0.2.4，并嵌入 7 张开发版实渲截图（`docs/screenshots/readme-*-0.2.4.png`）；`NOTICE.md` 记 CTCAE v5.0
公开参考件来源；运行依赖仅 `node:sqlite`/`node:zlib`（Node ≥22），无第三方运行时。
演示数据清单已清理或明确示例环境：演示数据只进 `demo/` 与 `prototypes/`，界面在演示态有横幅明示；
包内不含任何 `.sqlite`（`files` 白名单无 `demo/demo-data.sqlite`）。
数据库迁移与旧包兼容：0001 冻结（sha256 `78c720f1…`），0002–0004 只增列/只加表，**未改 0001**；
旧包回退到 0.2.2 可读 0.2.4 建的库（`0002`–`0004` 全部只增列/增表，可前向读取）。**注意**：0.2.4 起有 `POST /symptoms` 写入通路，回退到 0.2.3 后这些症状记录还在库里、只是旧界面不能新增。
可用备份：装机前 `~/.dsh/profiles/desktop/{package.json,pnpm-lock.yaml}` 已备份到 `/tmp/desktop-*.bak`。
市场分发来源：**不投稿**（仓库 private，按 BACKLOG §四 病种仓一律 private；市场要求公开仓 + 有效许可证）。

若任务要求本机更新：最终已安装版本 **0.2.4** / Profile **`~/.dsh/profiles/desktop`** /
安装副本与 tgz `diff -rq` 逐文件一致 / **打开确认本次修改：未做（等用户重启 Harness）**。

| 动作 | 目标 | 真实结果/URL/证据 | 状态 |
| --- | --- | --- | --- |
| 本地安装 | Desktop/profile | `~/.dsh/profiles/desktop`，devDependencies + bundles 双登记，`check-install` ✓ | **已执行** |
| Harness 重启 | Desktop app | Agent 不自行重启宿主；重启后可复跑装机副本探针 | 未执行（等用户） |
| 真机走查（ACC-04 以后） | Desktop 界面层 | 需重启后新建会话再打开工作台 | 未执行 |
| Git push | 远端/分支/commit | `origin/main` 已推（PBC 仓）；starter 分支 `pbc-recycle-1.5.8` 已推 | **已执行** |
| starter 回流 PR | `xyb-workbench-starter` | https://github.com/xyb-openharness-dsh-plugins/xyb-workbench-starter/pull/2 （1.5.8，40 test 全绿） | **已开 PR，待评审** |
| BACKLOG 状态回填 | `xyb-openharness-dsh-plugins/.github` | https://github.com/xyb-openharness-dsh-plugins/.github/pull/43 （#63 → 🟡 v0.2.4） | **已开 PR，待合并** |
| Release/tag | tag/产物/hash | tag `v0.2.4` 与 GitHub Release 待 M7 | 未执行 |
| 市场 PR | 官方目录仓库 | 私有仓不可投稿（BACKLOG §四） | 不适用 |
| 上架 | 公开 catalog | 同上 | 不适用 |

市场状态说明：**本仓 private，按组织规则不投稿市场**（`docs/10-MARKET-PUBLISHING.md` 要求公开 GitHub 仓库 +
有效许可证）。"本地安装成功"不推断"市场可见"，"Git push"也不等于"发布"。

回滚步骤/数据兼容检查/已知限制：
1. 回滚 = 把 `devDependencies` 的 `file:` 指回 `0.2.2` 的 tgz 并 `rm -rf node_modules/@ductpal-dsh` 后重装；
   库结构向后兼容（0002–0004 只增），旧包能读新库。
2. 数据在 `~/.dsh/pbc/xyb-pbc.sqlite`，回滚不动数据；如需彻底重来，删该目录即可（会退回内存演示库）。
3. 已知限制：重启后的界面层未验；MinerU 需用户自备 Token（未配置时解析按钮会如实说"未配置"）；
   试验库 6 个来源里只有 2 个真的查过（其 4 个落 `unconfigured`），界面按"未查过"文案显示。
