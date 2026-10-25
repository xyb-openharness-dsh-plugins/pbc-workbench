# PBC 临床试验登记快照 · 2026-10-25

> **登记 ≠ 有效 ≠ 安全 ≠ 可入组。** 本目录只是把登记库里已经公开的记录抄了一份，
> 让患者能拿着去问医生；它不是推荐，也不是入组资格判断。

## 1. 这些文件是什么

| 文件 | 内容 |
| --- | --- |
| `trials-2026.jsonl` | 每条一行 JSON（主产物，便于 diff 与审计） |
| `pbc_cancer_trials_2026.sqlite` | 同样内容的 sqlite（`trials` 表 + `source_states` 表 + `query_log` 表） |
| `manifest.json` | 采集口径、检索词、逐来源终态、文件 sha256 |

三处条数必须一致，脚本里有硬断言：`manifest.recordCount == jsonl 行数 == sqlite trials 行数`。

**采集脚本**：`scripts/fetch-pbc-trials-2026.mjs`（唯一入口 = `unified-trial-mcp`，MCP stdio；
不自己拼 URL、不抓页面）。重跑：

```bash
node scripts/fetch-pbc-trials-2026.mjs --dry-run   # 只看计划与来源状态
node scripts/fetch-pbc-trials-2026.mjs             # 真实采集（会覆盖本目录三个文件）
```

## 2. 本轮结果（实测，2026-10-25）

**479 条**：`chinadrugtrials` 93 条 + `ictrp` 386 条。

### 逐来源终态（`source_states` 表原样）

| 来源 | 终态 | 上游终态 | 真的查过？ | 这一格意味着什么 |
| --- | --- | --- | --- | --- |
| `chinadrugtrials` | `ready` | `SUCCESS` | ✅ 是 | 命中 41 条（上游自报总数 41），可当"该通道查到了" |
| `ictrp` | **`truncated`** | `SUCCESS` | ✅ 是 | 命中 200 条但**被单次上限截断**，`isLowerBound=true`；不能当"全部命中" |
| `chictr_online` | `unconfigured` | `NOT_ENABLED` | ❌ 否 | 本机未配置 ChiCTR 在线服务目录 |
| `chictr_pancreatic_archive` | `unconfigured` | `NEEDS_SETUP` | ❌ 否 | 离线语料只有胰腺癌，PBC 无覆盖 |
| `xyb_chinadrugtrials_archive` | `unconfigured` | `NEEDS_SETUP` | ❌ 否 | 未配置 XYB 归档目录 |
| `ctv` | `unconfigured` | `NEEDS_SETUP` | ❌ 否 | 未配置 CTV 上游/本地索引 |

**6 个来源里只有 2 个真的查过。** 这一点必须进界面：试验页不能说"共 479 项相关试验"，
而要说"在已配置的 2 个通道里查到 479 条登记记录，另有 4 个通道本轮没查"。

### 检索口径（8 条，中文为主）

| 检索词 | 说明 | 命中 |
| --- | --- | --- |
| 原发性胆汁性胆管炎 | 中文现用标准名（PBC） | 41 |
| 原发性胆汁性肝硬化 | 中文旧名（文献与登记仍在用） | 54 |
| 胆汁性胆管炎 | 中文宽口径 | 42 |
| 原发性胆汁性胆管炎 熊去氧胆酸 | 一线药语境 | 0 |
| primary biliary cholangitis | 英文标准名 | 200（截断） |
| primary biliary cirrhosis | 英文旧名 | 200（截断） |
| PBC ursodeoxycholic acid | 英文一线药语境 | 69 |
| PBC pruritus | 症状语境（瘙痒是主要诉求） | 25 |

各次检索逐条落 `query_log` 表，可复核。

## 3. 数据质量：这 479 条长什么样

- **93 条 CDE 记录里，绝大多数是"生物等效性试验"，受试者是健康人，不是 PBC 患者。**
  例如"奥贝胆酸片在中国健康人体的生物等效性试验"。这是 PBC 药物研发的真实面貌
  （仿制药一致性评价 + 少量新药），但它**不回答**"我能不能参加"。
  → 界面必须在卡上直说「健康受试者试验」，且**不做"可能适合你"的匹配**。
- **`ictrp` 的 386 条里含大量非 PBC 的英文命中**（"primary biliary" 作为词组会带到别的胆汁性疾病）。
  标题相关性未做二次人工核读，全部原样保留。**不做自动过滤**：过滤掉别人找不到的线索没人发现，
  留着错的总比悄悄丢掉对的好。界面给"来源 + 原始标题 + 登记号"，让用户自己判断。
- **`dates.registered` 全部为空**（0/479）。CDE 通道这一字段本次未返回。
  → 界面**不显示"登记日期"占位为"未知"以外的任何推测**；排序不能用日期，改用 recordId 保证稳定。
- `recruitmentStatus` 有值但**是登记时的状态**（"已完成"/"招募中"），可能早已过期 →
  卡上标「登记状态，未核实」，且不给"现在还能报名"的暗示。

## 4. 诚实边界（会被写进界面与导出文件）

1. **未查 ≠ 没有。** 4 个未配置通道对 PBC 一条都没查过；杭州/中国患者常去的 ChiCTR 恰好就在未查之列。
2. **截断 ≠ 全部。** `ictrp` 只拿到前 200 条。
3. **登记 ≠ 在招募。** 状态是登记时点，没有实时核验。
4. **本仓不做匹配。** 不做纳排判定、不评分、不推荐；只做"抄录 + 可追溯 + 带你去问医生"。
5. **私有仓，不做投稿。** 这是个人使用的工作台，不对外提供"临床试验信息平台"服务。

## 5. 复核方法

```bash
node -e "const{DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('research/pbc-cancer/pbc_cancer_trials_2026.sqlite');console.log(d.prepare('select count(*) n from trials').get(), d.prepare('select source_id,state,queried from source_states').all())"
shasum -a 256 research/pbc-cancer/trials-2026.jsonl research/pbc-cancer/pbc_cancer_trials_2026.sqlite
```

sha256 应与 `manifest.json` 的 `files` 段一致。
