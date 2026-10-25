# 变更记录

只增不删；每条写清"改了什么 + 为什么 + 用户可见结果"。版本号与 VERSION、package.json 三处必须一致。

## 0.1.0 — 2026-10-25

- 由社区脚手架 dsh-wb-cli@1.5.4 初始化，仅有注册骨架与健康接口，无业务功能。

## 未发布 — M1（2026-10-25）

- 新增 `docs/` 九件：SPEC / DEV-REQUIREMENTS-2026-10-25 / DIFF-MATRIX / SCENARIOS / PATIENT-FLOW /
  USER-RESEARCH / INTERACTION-DESIGN / METRIC-GRADING / GUIDELINE-BRIDGE / CLINICAL-DATA-2026 / DEV-PLAN。
- 差异化实测：9 一级 / 30 二级；与乳腺基准一级重名率 11.1%（1/9），刻意不同三处（一图秀降级、症状独立成线、并发症筛查按系统分节）。
- 医学层诚实边界：**0 访谈**；中文指南原件未取得 → G1–G3 指南部分不做；药名标「获批状态未核实」。
- 资产：`assets/reference/ctcae/`（CTCAE v5.0 公开参考件 + README）；`guidebooks/manifest.json`（空登记 + 原因）。

## 0.1.0 — 2026-10-25

- 由社区脚手架 dsh-wb-cli@1.5.4 初始化，仅有注册骨架与健康接口，无业务功能。
- **接线前置修复**：`cordis.patch.yml` 补 `config.root: !!js dshHomePath('pbc')`；`dsh/index.js` 声明 `Config.root`
  （只补一边会被 `check-workbench-package` ⑤ 判为"注入但未声明"，装机后重启回内存库）。
