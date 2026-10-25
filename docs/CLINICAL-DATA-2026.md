# 临床数据（试验库）· PBC · 2026

## 1. 口径

- 唯一入口：`unified-trial-mcp`（统一临床试验检索 MCP）。**不自己拼 URL、不抓页面**。
- 通道：在线 `ictrp`（WHO ICTRP）/ `ctv`（ClinicalTrials.gov 深度）/ `chictr_online`（ChiCTR 实时）/ `chinadrugtrials`（CDE，含 PI）。
- **离线语料仅覆盖胰腺癌**（ChiCTR 468 条 + 小胰宝归档 139 条）→ 对 PBC 属**未配置 / 无覆盖**，
  必须在 sqlite 来源终态与本文如实声明，**不能算"已查过"**。
- 状态栏一律「登记状态，未核实」；**登记 ≠ 有效 ≠ 安全 ≠ 可入组**。

## 2. 采集状态（M4 更新）

| 项 | 状态 |
| --- | --- |
| 采集脚本 | 🔧 `scripts/fetch-pbc-trials-2026.mjs`（M4 建） |
| 在线四通道 | ⏳ **未查过**（M4 执行；本文件在 M4 前不写任何"已查"结论） |
| 离线语料（chictr/xyb_cde/ctv_index） | ⛔ **未配置**（该语料只有胰腺癌） |
| 数据截止日 | 待 M4 落库时写入 |

## 3. 一致性断言（M4 验收）

- `manifest.json` 记录数 = `trials-2026.jsonl` 行数 = `pbc_cancer_trials_2026.sqlite` 行数。
- 逐来源终态落库：`ready / timeout / unconfigured / partial / truncated`，并同时存 `coverage` 与 `completeness`。
- 0 条结果必须带该来源**自己的覆盖声明**，不得写成"不存在"。
- sha256 与实算一致。

## 4. 已知缺口（当前）

- 无任何真实采集结果；`research/pbc-cancer/` 尚未创建。
- CDE 通道的 PI 字段是否可得未核验。
- ChiCTR 需 Cookie 时，只放 `cookie.env`（0600），日志永不打印。
