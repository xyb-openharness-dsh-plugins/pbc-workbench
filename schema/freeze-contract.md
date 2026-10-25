# schema 冻结合同（0001_initial.sql）

- 冻结日期：2026-10-25
- 冻结版本：**v1.3**（v1.0 → v1.1 新增 `0002_demo_meta_and_method_text.sql`；v1.1 → v1.2 新增 `0003_parse_jobs.sql`；
  v1.2 → v1.3 新增 `0004_lab_item_lab_name.sql`。三次追加都未改 0001，表数量 22→24 后不再变）
- `0001` 的 `sha256`：`78c720f1c98be5438da7d4aa9ce2d42f0da5670d30f53ed8386baed7f61ae9a6`
- 文件：`schema/0001_initial.sql`（初始迁移，**永不修改**）+ `schema/0002_*.sql` / `0003_*.sql` / `0004_*.sql`（只增）

## 内容边界

本文件冻结的是**结构**，不是数据：

1. **表清单（24 张）**：profiles / fibrosis_records / comorbidities / documents / parse_candidates /
   lab_panels / lab_items / symptom_logs / medications / adherence_events / regimen_changes /
   screening_sections / screening_records / section_titles / questions / todos / pathway_phases /
   trial_records / trial_bookmarks / export_snapshots / source_states / migrations / demo_meta / parse_jobs
2. **四契约**：
   - 看法恒不为结论：**无 `is_conclusion`，无 `diagnosis` / `risk_level` / `response` / `stage` / `grade` 列**；
   - 缺值不造假：可选列一律显式 `NULL`；「没记」≠「阴性」≠「正常」；
   - 更正只新增版本：`questions.superseded_by` 指向新行，不物理删；
   - 事实四层不合并：`documents`（原件）/ `parse_candidates`（候选）/ 记录表 / `lab_items`（指标）分表存放。
3. **参考值落库**：`lab_items.ref_low` / `ref_high` 可空，但**必须来自这张化验单**；
   写入前先挡 `null/undefined/''` 再 `Number()`（`Number(null)===0` 陷阱）。
4. **保留字**：`using` → `in_use`。
5. **分节标题**：`section_titles.section_title` + `screening_sections.section_title` 落库，读模型直接取。
6. **提醒**：`todos.due` 恒为 `NULL`（本仓不发提醒）。
7. **`demo_meta` 只存演示批次信息**（`generatedAt` 之类），**不存任何患者事实**；
   由 0002 引入，是 23 张表里唯一没有 `profile_key` 的业务表。
8. **分类与原文分开**：`fibrosis_records.method` 是 CHECK 枚举（用于筛选），
   `method_text`（0002 引入）是报告原文（用于显示）。**不许把原文塞进枚举**，
   也不许只留枚举让界面显示英文代码。
9. **解析台账与文档状态分开**（`parse_jobs`，0003 引入）：重试**新增一行**，旧失败行保留；
   **「解析中」不写进 `documents.parse_state`**——那份文档可能只是在排队，进程重启就会永远卡在 parsing。
   `parse_jobs.document_id` 可空且**不建外键**（解析到连 document 都没建出来时也要留痕），
   一致性由 `dsh/import.js` 的 `#startJob` / `#finishJob` 保证。

## 修改规则

- 任何结构变化**只能新增** `0002_*.sql` 起的迁移；**不改 0001**，不改本文件的 sha256 记录。
- 发布前发现漏列（如分节 `*_title`）也走 `ALTER TABLE ... ADD COLUMN`。
- `migrations` 表记录每次应用的 checksum；`npm run check:schema` 比对。
- 表清单变化时**只改上面第 1 条的清单与张数**，`0001` 的 sha256 永远不动。

## 校验命令

```bash
node scripts/check-schema.mjs      # 应用全部 000N_*.sql（内存库），比对表/列、断言无判读列
shasum -a 256 schema/0001_initial.sql   # 与上面 sha256 一致
```
9. **解析台账与文档状态分开**：`parse_jobs`（0003 引入）只记"谁在什么时候解析了什么、结果如何"，
   **`documents.parse_state` 不写"解析中"**（那个状态只活在 `parse_jobs.state='running'` 里）。
   重试新增一行、旧失败行保留；`document_id` 可空且**不建外键**（台账不该因为删了原件就消失）。
10. **实验室名逐条独立**：`lab_items.lab_name`（0004 引入，可空）优先于 `lab_panels.lab_name`。
    一张汇总单会同时抄本院与外院结果，只留面板级会把外院那条标成主院 ——
    参考区间不同却来源写成一个，用户核对时会以为自己记错了。为空时回落面板级。
