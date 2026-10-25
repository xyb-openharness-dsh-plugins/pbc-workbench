# 临床数据（试验库）· PBC · 2026

## 1. 口径

- 唯一入口：`unified-trial-mcp`（统一临床试验检索 MCP）。**不自己拼 URL、不抓页面**。
- 通道：在线 `ictrp`（WHO ICTRP）/ `ctv`（ClinicalTrials.gov 深度）/ `chictr_online`（ChiCTR 实时）/ `chinadrugtrials`（CDE，含 PI）。
- **离线语料仅覆盖胰腺癌**（ChiCTR 468 条 + 小胰宝归档 139 条）→ 对 PBC 属**未配置 / 无覆盖**，
  必须在 sqlite 来源终态与本文如实声明，**不能算"已查过"**。
- 状态栏一律「登记状态，未核实」；**登记 ≠ 有效 ≠ 安全 ≠ 可入组**。

## 2. 采集状态（M4 实测，2026-10-25）

| 项 | 状态 |
| --- | --- |
| 采集脚本 | ✅ `scripts/fetch-pbc-trials-2026.mjs`（支持 `--dry-run`；唯一入口 unified-trial-mcp stdio） |
| `chinadrugtrials`（CDE） | ✅ **已查过**：`SUCCESS`，命中 41 条（上游自报总数 41） |
| `ictrp`（WHO ICTRP） | ✅ **已查过但被截断**：`SUCCESS` + `isLowerBound=true` → 落 `truncated`，只拿到前 200 条 |
| `chictr_online` | ⛔ **未查过**：`NOT_ENABLED`（未配置 ChiCTR 在线服务目录） |
| `chictr_pancreatic_archive` | ⛔ **未配置**：离线语料仅胰腺癌，对 PBC 无覆盖 |
| `xyb_chinadrugtrials_archive` | ⛔ **未配置**：未配置 XYB 归档目录 |
| `ctv` | ⛔ **未查过**：`NEEDS_SETUP`（未配置上游服务或本地索引） |
| 数据截止日 | **2026-10-25** |
| 落库条数 | **479**（CDE 93 + ICTRP 386），manifest=jsonl=sqlite 三处一致 |

> **6 个来源里只有 2 个真的查过。** 界面与导出文件必须这样表述，不许写成"共 479 项相关试验"。

### 2.1 环境修复记录（可复现）

首次运行时 `ictrp` 返回 `FAILED / UPSTREAM_UNKNOWN_ERROR`。定位过程：`npm run doctor` 显示
`OK ictrp`（仅表示入口文件存在），但 ICTRP bundle 自带的 `node dist/cli/setup-cli.js doctor` 报
`venv: no interpreter` + `sidecar: not answering at http://127.0.0.1:8849/health`。
执行 `node dist/cli/setup-cli.js setup` 建 venv（python 依赖装好）后，通道恢复 `SUCCESS`。
**教训**：`doctor` 的 `OK` 只说明"配置指向存在"，不说明"能跑通"；真正判据是 `search_trials` 的逐来源终态。

## 3. 一致性断言（M4 验收）

- `manifest.json` 记录数 = `trials-2026.jsonl` 行数 = `pbc_cancer_trials_2026.sqlite` 行数。
- 逐来源终态落库：`ready / timeout / unconfigured / partial / truncated`，并同时存 `coverage` 与 `completeness`。
- 0 条结果必须带该来源**自己的覆盖声明**，不得写成"不存在"。
- sha256 与实算一致。

## 4. 已知缺口（当前，如实）

| # | 缺口 | 影响 | 处置 |
| --- | --- | --- | --- |
| G1 | 4 个通道未配置/未查（chictr_online / chictr 离线 / xyb 归档 / ctv） | 特别是 ChiCTR（中文患者最常用）一条没查 | 界面明示"本轮只查了 2 个通道"；不写"没有" |
| G2 | `ictrp` 结果被单次上限截断（200 条） | 命中数被低估 | 落 `truncated` + `isLowerBound`；界面标"未取全" |
| G3 | 93 条 CDE 记录多为**健康受试者生物等效性试验** | 与"患者能不能参加"无关 | 卡上直说"健康受试者试验"，不做匹配 |
| G4 | `dates.registered` 全空（0/479） | 无法按登记日期排序/展示 | 显示"登记日期未提供"，排序用 recordId |
| G5 | CDE 的 PI 字段本次未出现在输出里 | 无法展示研究者 | 标"未提供"，不猜 |
| G6 | 标题相关性未做人工核读（ICTRP 有跨病种噪声） | 含非 PBC 条目 | 原样保留 + 逐条显示来源与登记号，不做自动过滤 |
| G7 | 未做实时招募状态核验 | 状态可能过期 | 一律"登记状态，未核实"；不暗示现在可报名 |

> ChiCTR 若后续需要 Cookie：只放 `cookie.env`（0600），日志永不打印；本仓不绕过任何验证码/WAF。
