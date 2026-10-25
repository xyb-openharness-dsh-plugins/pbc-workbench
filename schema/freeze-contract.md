# schema 冻结合同（0001_initial.sql）

- 冻结日期：2026-10-25
- 冻结版本：**v1.0**
- `sha256`：`78c720f1c98be5438da7d4aa9ce2d42f0da5670d30f53ed8386baed7f61ae9a6`
- 文件：`schema/0001_initial.sql`（唯一初始迁移）

## 内容边界

本文件冻结的是**结构**，不是数据：

1. **表清单（22 张）**：profiles / fibrosis_records / comorbidities / documents / parse_candidates /
   lab_panels / lab_items / symptom_logs / medications / adherence_events / regimen_changes /
   screening_sections / screening_records / section_titles / questions / todos / pathway_phases /
   trial_records / trial_bookmarks / export_snapshots / source_states / migrations
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

## 修改规则

- 任何结构变化**只能新增** `0002_*.sql` 起的迁移；**不改 0001**，不改本文件的 sha256 记录。
- 发布前发现漏列（如分节 `*_title`）也走 `ALTER TABLE ... ADD COLUMN`。
- `migrations` 表记录每次应用的 checksum；`npm run check:schema` 比对。

## 校验命令

```bash
node scripts/check-schema.mjs      # 应用全部 000N_*.sql（内存库），比对表/列、断言无判读列
shasum -a 256 schema/0001_initial.sql   # 与上面 sha256 一致
```
