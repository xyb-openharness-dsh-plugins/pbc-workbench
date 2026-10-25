# 开发计划（DEV-PLAN）· PBC v0.1

> **里程碑进度只认这一份。** 数字与其他文档打架时，以本文为准并当场修正另一处。
> 状态记号：✅ 实测通过 / 🔧 骨架或部分 / ⏳ 未开始 / ⛔ 本轮不做。

## 1. 里程碑表

| 里程碑 | 内容 | 判据（命令/截图） | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| **M0 骨架** | 认领 Issue + 私有仓 + `dsh-wb-cli init` + 接线前置 + 文档体系 + 基线 check | `npm run check` 退出码 0 且 `staticPass: true` | ✅ | Issue #35（`claimed`）；仓 `pbc-workbench`；init 168 文件；check `staticPass:true, errors:[]`；`config.root` 警告已消 |
| **M1 调研 SPEC** | 三路调研（医学/用户/家族对比）+ DIFF-MATRIX（重名率实测）+ SPEC/USER-RESEARCH/SCENARIOS/PATIENT-FLOW/INTERACTION-DESIGN | 文档齐全 + 重名率 ≤70% + 孤儿页=0 论证 | ✅ 待 G1 签认 | 重名率 **11.1%（1/9）**；0 访谈如实；指南层未做（原件未取得） |
| **M2 原型** | demo 单一源 + 四件套 + 折叠卡 + 窄宽 + HVT X1–X4 + 独立评审 | `file://` 可开；页签穷举 0 孤儿；X1–X4 出计数；DESIGN-REVIEW P0=0 | 🔧 原型与探针全绿；独立评审重新启动中 | `probe-prototype.py` → `ok:true, problems:[]`：nav 9 / subs 30 / visited 30 / 空视图 0 / chart path 3 / 折叠卡 3 张默认全收起、展开 5 块 / AI 一键含病情上下文且未自动发送 / 三档宽度溢出 0；7 张 README 截图 1440×940@2x |
| **M3 数据模型** | schema/0001 + freeze-contract sha256 + 无判读列断言 | `npm run check:schema` + sha256 一致 | ✅ 待 G3 签认 | `check-schema` → `tables:24（0001–0004）· judgementColumns:0 · 0001 sha256 与合同一致`；反向验证：注入 `risk_level` 后检查器变红（已留痕 §3.1） |
| **M4 临床库** | `fetch-pbc-trials-2026.mjs` + 四件套 | manifest=jsonl=sqlite | ✅ | **479 条**（chinadrugtrials 93 + ictrp 386）；6 源里 **2 源真查过**、4 源如实"未配置"；ictrp 标 `truncated`（`isLowerBound=true`）；`recordCount === jsonl行数 === sqlite行数` |
| **M5 开发版** | 七步移植 + MinerU 六部件 + apiBase 契约 + test 五套 | `npm run check` 全绿 + parity | ✅ | `npm run check` 全绿（**74 test** 全过）；`npm run audit` **37/37**；`probe-dev.py` → `ok:true`：接口态（无横幅）、nav 9 / visited 30 / chart path 3 / 折叠卡 3 展开 15 块 / 草稿含上下文未发送 / 三档溢出 0 / 非 200 响应 0 |
| **M6 装机** | 升版 → pack → 四要素对照 → pnpm add → bundles → 重启 → 真机走查 | 宿主信号 + 真机截图 | 🔧 包已装、**界面层待验** | 包 `0.2.3`（sha256 `1e8e6dbb…`）装进 `~/.dsh/profiles/desktop`（devDependencies + bundles 双登记）；副本与 tgz `diff -rq` 逐文件一致；装机副本探针（假宿主）通过、`<root>/xyb-pbc.sqlite` 真落盘；修掉三个宿主语境 bug（无鉴权能力放行 / `null` 当状态码崩服务 / `health.build` 取错来源）。**真机走查未做——需用户重启 Harness**（Agent 不自行重启宿主）。 |
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

## 5. M2–M5 落地记录（实测）

### M2 原型（`probe-prototype.py` 全绿）

- 唯一数据源 `demo/build-demo-data.mjs`：固定种子 LCG，重跑逐字节可复现；两家实验室参考区间刻意不同
  （A 院 ALP 上限 120 / B 院 135），且 2026-09 那张 ALP 的 `refHigh` 刻意留 `null`（演示 `needsUln`）。
- 产物 `prototypes/v0.2/{index.html,style.css,app.js,demo-data.js}`；折叠卡用原生 `details/summary`，
  打印规则 `@media print{.phase-detail{display:grid!important}}` 在 `style.css:189-193`。

### M3 数据模型（正反验证，防假绿）

- 正向：`check-schema` 五项断言全绿（表清单 24 / 无判读列 / `section_titles` 四列 / sha256 / `ref_*` 可空）。
- 反向：临时往 `symptom_logs` 注入 `risk_level TEXT` → 检查器报两条错
  （`出现判定列（禁止）：symptom_logs.risk_level`、`0001 sha256 不一致…（禁止改初始迁移）`），恢复后回绿。
- 0002–0004 三次追加均未改 0001，合同升到 v1.3。

### M4 临床库（诚实边界）

- 环境修复：`unified-trial-mcp` 的 `doctor` 报 `OK ictrp` 只代表入口文件存在；
  真正判据是 `ictrp-mcp-service/npm` 的 `node dist/cli/setup-cli.js doctor`（venv + sidecar）。
  装完 venv 后 ictrp 才真能查（详见 `docs/CLINICAL-DATA-2026.md` §2.1）。
- 两个聚合 bug 已修并留痕：①零命中查询会把 `SUCCESS` 覆盖成 `NO_RESULTS`（改为"必须有命中才升降级"）
  ②截断没被判出来（新增 `effectiveState()`，`isLowerBound` / `rowsReturned>=requestedLimit` 一律落 `truncated`）。

### M5 开发版（三条链路 + 五处返工）

- 七步移植完成：`dsh/` 13 文件 / `lib/` 5 文件 / `public/` 四件套 / `schema/` 四迁移 / `test/` 九套。
- **apiBase 定稿契约**：`lib/api-base.js` 只禁"交界重复"（`/(^|\/)api$/`），
  不用 `includes('/api')` 一刀切（`/api/pbc`、`/mount/api/v2` 都合法）；守卫**不抛异常**只返回 `{ok:false,code}`。
- **demo-parity 逐字段对齐**（26 号契约）：跑 `.tmp/deep.mjs` 用 `isDeepStrictEqual` 逐档案比，
  一次性暴露七类差异（多 `dept`/`inUse`/`visibility`/`sectionTitle`/`parseState`、
  `questions`/`documents` 的 id 用了库自增导致 B 档案错位、`labs` 的实验室名被面板级覆盖），全部修完后 A/B 双双 `deep equal OK`。
- **测试暴露的三个真实产品 bug**（不是测试写错）：
  1. `num()` 把 `'<5'` 变成 `NaN` → 分级当成 0 级（"低于检出下限"显示成"正常"）；
  2. 绝对阈值型缺下限时声称 `approx:true` 却根本没借到值 → 补 `GENERIC_LOW`（口径：下限可以借，上限不能借）；
  3. `migrate()` 在事务里跑 `PRAGMA journal_mode = WAL` → 报 `cannot change into wal mode from within a transaction`，
     改为在 `BEGIN` 之前单独执行。
- 五处**判据返工**（都是判据本身写错，不是放宽要求，逐条留痕在提交信息与测试注释里）：
  ①`check-host-contract` 被注释里的散文误伤 → 先 `stripComments()`；
  ②`customFrame` 写成 `'true' === 'true'` 不是字面量 → 注入裸 `true`；
  ③`ui-parity` 的 title 归一化漏了渠道词（原型/开发版）→ 归一化时一并替换；
  ④"不许自建聊天框"用字面禁词误伤免责 toast → 改成禁 `function (mockReply|agentReply|fakeReply)`；
  ⑤`probe-dev.py` 的 A2 找"已连上"字样，而接口态**根本不渲染横幅** → 改断言横幅不存在。

### M6 装机（包已装、界面层待验）

- **目标 profile 是实测出来的，不是猜的**：本机 Desktop app 进程行末是 `~/.dsh/profiles/desktop`，
  Web GUI 端口 56166；本机**不存在** `~/Library/Application Support/dsh-desktop/harness`，
  所以 06 号文档里那条 2026-10-18 的结论在本机不适用。装机方式照抄该 profile 既有约定
  （`devDependencies` 的 `file:` tgz + `dsh.profile.bundles` 双登记）。
- **联网 `pnpm install` 不可用**：会去 `git ls-remote https://github.com/molly-ovo/dsh-workbuddy-oauth.git`
  并超时 75s（该依赖在 lockfile 里已钉 codeload tarball、`node_modules` 里也已存在）。
  用 `NODE_OPTIONS= corepack pnpm install --offline --no-frozen-lockfile` 可成。
- **装机副本探针（假宿主）实测出三个只有宿主语境才暴露的真 bug**（dev 语境一个都罩不住）：
  1. 宿主没给 `connection.requestRejection` 时**跳过鉴权继续放行** → 改 503 `AUTH_UNAVAILABLE`；
  2. 宿主"不拒绝"返回 `null`，用 `!== undefined` 判 → `writeHead(null)` 抛
     `ERR_HTTP_INVALID_STATUS_CODE: Invalid status code: null`，**整条服务链熄火**（不是 500）→ 改真值判；
  3. `health.build` 从 `package.json` 取（无该字段）→ 永远 `null`、界面构建日期空白 → 改从 `lib/version.js` 取。
- 鉴权逻辑抽到 `dsh/auth.js` 的 `createAuthorized({api, connection})` —— `dsh/index.js` 顶部 import
  了 Schemastery，单测环境没有那份 peer，逻辑留在里面就没法测。新增 `test/host-auth.test.mjs` 7 条。
- **界面层验收（ACC-04 以后）未做**：需要用户重启 Harness 才能加载新包，Agent 不自行重启宿主。
  按 06 号"三层验收"口径，现在到"配置层 + 包层"，**不能写装机通过**。
