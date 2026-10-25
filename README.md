# 小管宝 DuctPal · 原发性胆汁性胆管炎（PBC）患者工作台

> 把散落的生化化验、用药与漏服、痒与累、并发症筛查整理成**可核对、可回溯、带得去门诊**的资料。
> 本机优先（数据只落用户资料目录），不做诊断、不做治疗建议、不做分期分级判定。

## 这是什么（以及不是什么）

- **是**：一个长期病程的记录与回顾工具。核心闭环 = *一次化验 → 看到与这张单子参考上限的对照 → 同日记一次痒/累 → 复诊前导出快照*。
- **不是**：不是病历系统、不是用药建议器、不是"应答判定器"。分级只做 **CTCAE v5.0 对照**，
  不计算 GLOBE / UK-PBC / 巴黎 / 巴塞罗那等应答评分（属医生口径）。

## 当前状态（如实标注）

| 项 | 状态 | 说明 |
| --- | --- | --- |
| M0 骨架 + 接线 | ✅ | `npm run check` → `staticPass: true, errors: []`；`config.root` 注入与声明双向齐 |
| M1 调研 / 规格 / 交互路径 | ✅ 文档完成，**待 G1 签认** | 9 一级 / 30 二级；一级重名率 **11.1%**（1/9） |
| 用户研究 | ⛔ **0 访谈** | 场景中"患者原话"全部是**改写句（假设）**，不是一手引语 |
| 指南出处层（G1–G3 指南部分） | ⛔ 未做 | 中文指南原件未取得 → 界面**不出现**任何指南页码 |
| HTML 原型 | ⏳ | M2 |
| 数据模型冻结 | ⏳ | M3 |
| 临床试验库 | ⏳ **未查过** | M4；离线语料对 PBC **未配置**（仅胰腺癌） |
| 开发版 / 装机 / 发布 | ⏳ | M5 / M6 / M7 |

> **没有实测就不写"通过"。** 上表的状态就是本轮的真实进度；截图与真机证据在 M2/M6 补入
> （README 截图规则见 starter `docs/33-README-SCREENSHOTS.md`，至少 4 张 + 折叠收/展态）。

## 三条产品底线

1. **原型是唯一视觉基准**，开发版与它逐字符对齐（`public/` 差异只允许字号三处 / `[hidden]` / dev-only）。
2. **数据只有一个来源**：`demo/build-demo-data.mjs` 同时产出 `demo/demo-data.sqlite` 与 `prototypes/v0.2/demo-data.js`。
3. **判定权归医生**：所有判定类字段不落库（无 `diagnosis` / `risk_level` / `response` / `stage` 列），
   界面只并列"指南/标准怎么写的"与"你的记录是什么"。

## 文档入口

| 文档 | 作用 |
| --- | --- |
| [SPEC](docs/SPEC.md) | 范围与不做、ADR |
| [DEV-REQUIREMENTS](docs/DEV-REQUIREMENTS-2026-10-25.md) | 强约束（每条带错误来源）+ 我替你定的默认值 |
| [DIFF-MATRIX](docs/DIFF-MATRIX.md) | 与乳腺基准/宫颈样板的差异 + 重名率实测 |
| [SCENARIOS](docs/SCENARIOS.md) | S01–S16（患者原话=改写假设 / 页面接住 / 明确不做什么） |
| [PATIENT-FLOW](docs/PATIENT-FLOW.md) | 三条真实时刻 → 页面树反推 |
| [INTERACTION-DESIGN](docs/INTERACTION-DESIGN.md) | 16 条场景路径 + CRUD 双通道 + IP1–IP10 |
| [METRIC-GRADING](docs/METRIC-GRADING.md) | 启用哪些 CTCAE 项、为什么不做瘙痒分级 |
| [GUIDELINE-BRIDGE](docs/GUIDELINE-BRIDGE.md) | 四问筛结论：**指南层本轮未做**及补做条件 |
| [CLINICAL-DATA-2026](docs/CLINICAL-DATA-2026.md) | 试验库口径与缺口（未查过就写未查过） |
| [DEV-PLAN](docs/DEV-PLAN.md) | 里程碑唯一进度表（✅/🔧/⏳） |

## 开发与验收

```bash
npm run check        # 语法 + 装包合同 + 宿主注册契约
npm run test         # 单测（M3+ 起补齐）
npm run audit        # 家族一致性（fail 不交付）
npm run release:check
```

需要 Node.js 22+。宿主 peers 范围只是模板基线，以目标 Desktop 实际依赖为准。静态检查绿 **不代表**已装进 Desktop。

## 医学免责

本工具只做**信息整理与就诊准备**，不构成医疗建议，不替代医生判断。所有数值与结论以原始报告与主诊医生意见为准。
