# 开发计划（DEV-PLAN）· PBC v0.1

> **里程碑进度只认这一份。** 数字与其他文档打架时，以本文为准并当场修正另一处。
> 状态记号：✅ 实测通过 / 🔧 骨架或部分 / ⏳ 未开始 / ⛔ 本轮不做。

## 1. 里程碑表

| 里程碑 | 内容 | 判据（命令/截图） | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| **M0 骨架** | 认领 Issue + 私有仓 + `dsh-wb-cli init` + 接线前置 + 文档体系 + 基线 check | `npm run check` 退出码 0 且 `staticPass: true` | ✅ | Issue #35（`claimed`）；仓 `pbc-workbench`；init 168 文件；check `staticPass:true, errors:[]`；`config.root` 警告已消 |
| **M1 调研 SPEC** | 三路调研（医学/用户/家族对比）+ DIFF-MATRIX（重名率实测）+ SPEC/USER-RESEARCH/SCENARIOS/PATIENT-FLOW/INTERACTION-DESIGN | 文档齐全 + 重名率 ≤70% + 孤儿页=0 论证 | 🔧 | 重名率 **11.1%（1/9）**；0 访谈如实；指南层未做（原件未取得） |
| **M2 原型** | demo 单一源 + 四件套 + 折叠卡 + 窄宽 + HVT X1–X4 + 独立评审 | `file://` 可开；页签穷举 0 孤儿；X1–X4 出计数；DESIGN-REVIEW P0=0 | ⏳ | — |
| **M3 数据模型** | schema/0001 + freeze-contract sha256 + 无判读列断言 | `npm run check:schema` + sha256 一致 | ⏳ | — |
| **M4 临床库** | `fetch-pbc-trials-2026.mjs` + 四件套 | manifest=jsonl=sqlite | ⏳ | 未查过（不写"已查"） |
| **M5 开发版** | 七步移植 + MinerU 六部件 + apiBase 契约 + test 五套 | `npm run check` 全绿 + parity | ⏳ | — |
| **M6 装机** | 升版 → pack → 四要素对照 → pnpm add → bundles → 重启 → 真机走查 | 宿主信号 + 真机截图 | ⏳ | — |
| **M7 发布** | tag + release + CHANGELOG | release 附 tgz + sha256 | ⏳ | — |
| **M8 回填** | BACKLOG 状态行（31 号） | PR 合并 | ⏳ | — |
| **M9 回流** | DEV-REQUIREMENTS 追补 / starter LESSONS / 编号文档 / 检查器清单 | `npm run check` + `dsh-wb-cli audit` | ⏳ | — |

## 2. M0 落地记录（实测）

- `gh issue create` → **#35**，`/claim` 后标签 `claim, claimed, triage`，assignee `samqin123`。
- `gh repo create ... --private` → 私有仓建立。
- `dsh-wb-cli init`（starter 1.5.4）→ **168 文件**；`.dsh-wb-starter.json` 记录 version 1.5.4。
- **接线前置修两处**：
  1. `cordis.patch.yml` 补 `config.root: !!js dshHomePath('pbc')`（注释放条目后，不放首行）；
  2. `dsh/index.js` 声明 `Config.root` —— 否则 `check-workbench-package` ⑤ 报警"注入了但没声明"，
     装机后表现为"能打开、每次重启回内存库"。
- 基线 `npm run check`：`staticPass: true`，`errors: []`；剩余 warning 为"peer 范围/tgz/UI 需另验"（正常项）。

## 3. 关键决策记录（ADR 摘要）

| # | 决策 | 理由 | 影响 |
| --- | --- | --- | --- |
| A1 | 9 一级 / 30 二级，设置走顶栏 | 家族 8–10 / 24–30；配置不占一级注意力 | DIFF-MATRIX §1 |
| A2 | 一图秀降为二级 | PBC 指标同源 | 与基准结构刻意不同（D1） |
| A3 | 症状独立成一级「痒与累」 | 无客观替代、夜间加重高频 | D2 |
| A4 | 不接指南页码层 | 原件未取得；虚构页码比不做更糟 | G1–G3 指南部分不做 |
| A5 | 瘙痒/乏力不套 CTCAE | 无绝对数值界限；按 23 号只启用有界限项 | METRIC-GRADING §1 |

## 4. 风险与阻塞

| 风险 | 当前状态 | 处置 |
| --- | --- | --- |
| 0 访谈 | 阻断"需求已确认" | 场景全部标假设；G1 签认时明示 |
| 指南原件缺失 | 阻断 G1 出处/G2 节奏/G3 分级 | 只做 CTCAE；取得原件后补 |
| NMPA 412 反爬 | 阻断"获批状态"核实 | 药名一律标「未核实」 |
| 外网检索通道 | web_search 无凭据 | 用 NCBI E-utilities 取真实 PMID；其余标未核实 |
| 私有仓 → 市场投稿不可用 | 本轮不投稿 | M9 记录 |
