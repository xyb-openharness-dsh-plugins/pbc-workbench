# 数据主体—关系—表 · PBC

> 冻结版见 `schema/0001_initial.sql` + `schema/freeze-contract.md`（sha256 已钉；现为 **v1.3**，0001–0004 四个迁移，24 张表）。
> 校验：`node scripts/check-schema.mjs`（应用全部迁移 → 比对表清单 → 断言无判读列 → 核 sha256）。

## 1. 实体—关系

```
profiles (档案级, 1)
 ├─ fibrosis_records       纤维化：检查方式 + 报告原文（方式不互算）
 ├─ comorbidities          合并症（可 private）
 ├─ documents              事实层①：原件（sha256 / 解析状态）
 │   ├─ parse_candidates   事实层②：候选（AI/MinerU 产出，pending→accepted/rejected）
 │   └─ parse_jobs         解析台账（running→success/partial/failed；无外键，重试新增行）
 ├─ lab_panels ─ lab_items 事实层④：指标（一次化验 = 1 panel + N item；item 可带自己的 lab_name）
 ├─ symptom_logs           表达面：痒/累（不落 grade）
 ├─ medications / adherence_events
 ├─ regimen_changes        换线：仅医生原话（无应答判定）
 ├─ screening_sections / screening_records   并发症按系统分节
 ├─ section_titles         分节标题（读模型直接取）
 ├─ questions / todos      问题与待办（更正=新增版本；due 恒 NULL）
 ├─ pathway_phases         折叠卡五块 detail（阶段与日期是列）
 ├─ trial_bookmarks ── trial_records          试验（登记状态，未核实）
 └─ export_snapshots       导出产物（含 data_cutoff）
source_states               采集来源终态（coverage + completeness）
migrations                  迁移 ledger（checksum）
```

## 2. 四契约落地

| 契约 | 落地方式 | 断言 |
| --- | --- | --- |
| ① 看法恒不为结论 | 无 `is_conclusion`；**全库无** diagnosis/risk_level/response/stage/grade 列 | `check-schema` 扫全部列 |
| ② 缺值不造假 | 可选列显式 NULL；三态 `positive/negative/untested` | `antibody_*` 有 CHECK 约束 |
| ③ 更正只新增版本 | `questions.superseded_by`；无 DELETE 语义 | 单测断言旧行仍在 |
| ④ 事实四层不合并 | documents / parse_candidates / 记录表 / lab_items 四层分表 | 表清单本身 |

**分级不落库**：`grade` 是派生值，读取时由 `dsh/ctcae.js` 按 CTCAE v5.0 现算（标准会升版，落库 = 把旧标准写成历史事实）。

## 3. 关键列与陷阱

| 列 | 为什么这样 | 陷阱 |
| --- | --- | --- |
| `lab_items.ref_low` / `ref_high` | ×ULN 必须用**这张单子**的上限 | 两列都可空；写入先挡 `null/undefined/''` 再 `Number()`（`Number(null)===0`） |
| `lab_items.value_text` | 非数值结果（"阴性"） | `value_num` 必须保持 NULL，不许写 0 |
| `medications.dose_text` | 患者抄录原文（含"×5 片/日"） | 不换算成 mg/kg |
| `medications.in_use` | `using` 是保留字 | 禁写 `using` |
| `todos.due` | 本仓不发提醒 | 恒 NULL |
| `symptom_logs.*` | 表达面，无 CTCAE 分级 | `fatigue_1_3` CHECK 1–3 |
| `section_titles.scope` | 一表多域（labs/symptoms/screening/…) | 同域内 `section_key` 唯一 |
| `lab_items.lab_name` | 汇总单会混本院与外院，参考区间不同却来源写成一个 → 用户以为自己记错 | 为空回落 `lab_panels.lab_name`；不要"取第一条"当整张单子的来源 |
| `parse_jobs.state` | "解析中"只活在这里，不写进 `documents.parse_state` | 重试新增一行，旧失败行保留；`document_id` 可空且不建外键 |

## 4. 持久化与选型

- **等级 A（本机 SQLite）**：数据只落用户资料目录（`dshHomePath('pbc')`），不静默上传；卸载不删数据。
- 规模：单用户，万级行；查询以"按档案 + 日期"为主（已建 4 个索引）。
- 并发写入者：1（单机桌面应用）；WAL 模式。

| 数据类别 | 权威位置 | 读写责任 | 来源/revision | 失效规则 |
| --- | --- | --- | --- | --- |
| 已确认事实 | SQLite 记录表 | 服务端写入，需用户确认 | `source_kind` / `src_doc` | 永不自动失效 |
| 原件 | 用户资料目录 `documents/` | 只增 | sha256 | 不自动删 |
| 候选 | `parse_candidates` | 用户逐项裁决 | document_id | rejected 保留留痕 |
| 派生值（分级/节奏） | 内存 | 读取时算 | 标准版本常量 | 标准升版即变 |

## 5. 前端与业务流程变化矩阵

| 变化情境 | 不变的事实/关系 | 改哪层 | 迁移 | 验收 |
| --- | --- | --- | --- | --- |
| 改导航/布局 | 全部表 | 读模型 + 前端 | 无 | ui-parity 绿 |
| 新增普通指标（如 IgM） | 表结构不变 | `LABELS` + `ctcae.js` 可选 | 无 | 单测覆盖 |
| 新增分节 | `section_titles` 加行 | 读模型 | 无（数据，不是结构） | 分节标题断言 |
| 步骤插入/跳过 | 流程在读模型里 | 读模型 | 无 | 路径表更新 |
| 来源更正 | 记录表 | 新增版本行 | 无 | 旧版本仍可查 |
| 候选→接受 | 候选表 + 记录表 | 服务端命令 | 无 | 拒收零副作用 |
| 旧库升级 | 0001 不动 | 新增 000N | **必须** | 迁移幂等单测 |

## 6. 未决项

| # | 未决 | 影响 | 何时定 |
| --- | --- | --- | --- |
| U1 | 是否需要"照护者代记"字段（`recorded_by`） | 双主体范围 | 拿到访谈后（G1 外） |
| U2 | 导出格式是否要 PDF | `export_snapshots.format` 已枚举 | M5（先 txt/md） |
| U3 | 试验结果池是否全局共享 | `trial_records.profile_key` 可空 | M4 采集后 |
