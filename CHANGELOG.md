# 变更记录

只增不删；每条写清"改了什么 + 为什么 + 用户可见结果"。版本号与 VERSION、package.json 三处必须一致。

## 0.1.0 — 2026-10-25

- 由社区脚手架 dsh-wb-cli@1.5.4 初始化，仅有注册骨架与健康接口，无业务功能。
- **接线前置修复**：`cordis.patch.yml` 补 `config.root: !!js dshHomePath('pbc')`；`dsh/index.js` 声明 `Config.root`
  （只补一边会被 `check-workbench-package` ⑤ 判为"注入但未声明"，装机后重启回内存库）。

## 未发布 — M1（2026-10-25）

- 新增 `docs/` 九件：SPEC / DEV-REQUIREMENTS-2026-10-25 / DIFF-MATRIX / SCENARIOS / PATIENT-FLOW /
  USER-RESEARCH / INTERACTION-DESIGN / METRIC-GRADING / GUIDELINE-BRIDGE / CLINICAL-DATA-2026 / DEV-PLAN。
- 差异化实测：9 一级 / 30 二级；与乳腺基准一级重名率 11.1%（1/9），刻意不同三处（一图秀降级、症状独立成线、并发症筛查按系统分节）。
- 医学层诚实边界：**0 访谈**；中文指南原件未取得 → G1–G3 指南部分不做；药名标「获批状态未核实」。
- 资产：`assets/reference/ctcae/`（CTCAE v5.0 公开参考件 + README）；`guidebooks/manifest.json`（空登记 + 原因）。

## 未发布 — M2 原型（2026-10-25）

- 新增唯一数据源 `demo/build-demo-data.mjs`：固定种子 LCG，重跑逐字节可复现；产出
  `prototypes/v0.2/demo-data.js` 与 `demo/demo-data.sqlite`（后者按编号跑 `schema/00*.sql` + 真实 `seedDemo`，
  **不再手抄 DDL** —— 手抄必然与 schema 分叉，分叉后演示库就验不了读模型）。
- 新增原型四件套 `prototypes/v0.2/{index.html,style.css,app.js,demo-data.js}`：9 一级 / 30 二级；
  折叠卡五块 + 默认全收起 + 打印展开规则；`svg.chart` 用 Fritsch–Carlson 单调三次平滑；
  AI 一键派发 `pbc:agent-draft` 并把提示词 + 病情上下文写进输入框、不自动发送。
- 新增 `scripts/probe-prototype.py`（真 Chrome 无头，A1–A9 判据）与 `scripts/shoot-readme.py`
  （1440×940@2x，7 张 README 截图）。实测 `ok:true, problems:[]`。

## 未发布 — M3 数据模型（2026-10-25）

- `schema/0001_initial.sql` 冻结为 22 表，`sha256 78c720f1…`；`schema/freeze-contract.md` 钉住。
- 后续追加 `0002_demo_meta_and_method_text.sql`、`0003_parse_jobs.sql`、`0004_lab_item_lab_name.sql`，
  **三次都没改 0001**，合同升到 v1.3（24 表）。
- `scripts/check-schema.mjs` 五项断言：表清单比对 / 无判读列扫描 / `section_titles` 四列 / sha256 / `ref_*` 可空。
  做过反向验证：临时注入 `risk_level` → 检查器变红（防假绿）。

## 未发布 — M4 试验库（2026-10-25）

- 新增 `scripts/fetch-pbc-trials-2026.mjs`（MCP stdio，`unified-trial-mcp`）：8 条检索口径 × 6 个来源。
- 实测 **479 条**（chinadrugtrials 93 + ictrp 386）；**6 个来源里只有 2 个真的查过**，
  其余 4 个如实记 `unconfigured`；ictrp 命中被截断（`isLowerBound=true`）→ 落 `truncated` 而不是 `ready`。
- 硬断言 `manifest.recordCount === jsonl 行数 === sqlite 行数`。数据质量四段如实写进
  `research/pbc-cancer/README.md`（CDE 多为健康受试者生物等效性试验、ICTRP 有跨病种噪声不做自动过滤、
  `dates.registered` 全空、`recruitmentStatus` 过期一律标「登记状态，未核实」）。

## 未发布 — M5 开发版（2026-10-25）

- 七步移植完成：`dsh/` 13 文件（store / readmodels / demo / export / import / parse / mineru / settings /
  routes / server / workbench / index）、`lib/` 5 文件（layout / version / api-base / zip / screening-titles）、
  `src/client.js` + `scripts/build-client.mjs` → `lib/client.js`、`scripts/build-public.mjs` → `public/` 四件套。
- **customFrame 面板**：`businessSide:'left'`、`businessWidth:0.65`、`AGENT_PANE.default:0.35`（区间 25%–45%），
  拖动/键盘/窄容器抽屉四条都在；不自建聊天框，只把提示词与病情上下文交给宿主原生会话。
- **apiBase 定稿契约**：`lib/api-base.js` 只禁交界重复（`/(^|/)api$/`），不用 `includes('/api')` 一刀切；
  守卫不抛异常；双形态（独立 `''` / 宿主 `/w/abc`）回归在 `test/ui-base.test.mjs` 里逐条验。
- **MinerU 六部件**：`dsh/mineru.js`（四步协议 + 错误分类）、`dsh/settings.js`（Token 读写 + 三态）、
  `dsh/parse.js`（markdown → 候选，先按 `<td>` 边界取内容再剥标签）、`dsh/import.js`（编排 + 事务）、
  `settings/mineru` 接口、`parse_jobs` 台账。Token 来源优先级：显式 > 密钥文件 > env。
- **测试九套 67 个**（demo-parity 8 / store 8 / ui-base 7 / ui-parity 9 / server 10 / ctcae 8 / cadence 6 /
  symptom 7 / pack-contents 4）全绿。测试暴露并修掉三个真实产品 bug：
  ①`num()` 把 `'<5'` 变成 `NaN`（"低于检出下限"被显示成"正常"）；
  ②绝对阈值型缺下限时没真借到值（补 `GENERIC_LOW`，口径：下限可以借，上限不能借）；
  ③`migrate()` 在事务里跑 `PRAGMA journal_mode = WAL` 直接报错。
- **时区 bug**：`cadenceNodes()` 用 `toISOString()` 把本地日期转 `YYYY-MM-DD`，东八区本地零点退成前一天
  （2024-03-20 + 6 个月显示成 2024-09-19，按它约复查会早一天）→ 改为手拼本地日期。
- 新增 `scripts/probe-dev.py`（真起 dev-server + 真 Chrome，A1–A9）：实测 `ok:true`
  —— 接口态无横幅、30 个二级无空视图、折叠卡 3 张展开 15 块、草稿含上下文未发送、三档宽度溢出 0、非 200 响应 0。
- 全链绿：`npm run check`（含 67 test）退出 0；`npm run audit` **37/37 通过 · 0 失败**。

## 包版本 0.2.3 — M6 装机接线（2026-10-25）

版本轨迹 0.1.0 → 0.2.0 → 0.2.1 → 0.2.2 → **0.2.3**：每一轮改包都升版（同版号重打包 pnpm 不替换内容，
装进去的还是旧文件）。

- **装机目标已核实**：本机 Desktop app 实际加载 `~/.dsh/profiles/desktop`（进程行末即是该路径，
  Web GUI 端口 56166）；本机**不存在** `~/Library/Application Support/dsh-desktop/harness`，
  所以 06 号文档里那条 2026-10-18 的结论在本机不适用。装机方式照抄该 profile 既有约定：
  `devDependencies` 的 `file:` tgz + `dsh.profile.bundles` 双登记。
- **`scripts/check-install.mjs` 修**：原判据只看 `dependencies`，把装在 `devDependencies` 的工作台
  判成"没装" → 改为两个区块都认，并报出来源区块。
- **装机副本探针（假宿主）实测出三个只有宿主语境才暴露的真 bug**，全部已修：
  1. 宿主没给 `connection.requestRejection` 时**跳过鉴权继续放行** —— 宿主少给一个能力，本机资料就裸奔。
     改为 503 `AUTH_UNAVAILABLE` 明说不可用。
  2. 宿主"不拒绝"时返回 `null`，原实现用 `!== undefined` 判 → `writeHead(null)` 抛
     `ERR_HTTP_INVALID_STATUS_CODE: Invalid status code: null`，**整条服务链熄火**（不是 500）。
     判定改为真值判（`if (rejection)`）。
  3. `health.build` 从 `package.json` 取（该文件没有 build 字段）→ 永远 `null`、界面构建日期空白。
     改为从 `lib/version.js` 取。
- 鉴权逻辑抽到 **`dsh/auth.js`** 的 `createAuthorized({ api, connection })`：`dsh/index.js` 顶部
  import 了 Schemastery，单测环境没有那份 peer，逻辑留在里面就没法测。新增 `test/host-auth.test.mjs`
  7 条（无能力→503 且业务 handler 不被调用 / `null` 放行 / `undefined` 放行 / 401 透传且不带业务数据 /
  拒绝响应不含业务字段 / `api` 非函数立刻抛 / 接真路由 profiles 是数组且库真落盘）。
- **tgz 四要素在包内逐项核对**：`dsh.bundle.patch` + `dsh.client.inject` 齐；
  `cordis.patch.yml` 含 `config.root: !!js dshHomePath('pbc')` 且注释在条目之后；
  `lib/client.js` 540 行、`grep -c "接入骨架"` = 0、含 `__ModuleLoader__`；`lib/version.js` 与 tgz 名同版。
- 安装副本与 tgz `diff -rq` **逐文件一致**；装机副本探针 `health` 回
  `{"version":"0.2.3","build":"2026-10-25","demo":false,"dataDirConfigured":true}`，
  `<root>/` 下真的生成 `xyb-pbc.sqlite`（+`-shm`/`-wal`），证明不是内存库。
- 全链绿：`npm run check` **74 test 全绿**、`staticPass:true`；`npm run audit` **37/37 通过 · 0 失败**。
- **尚未完成（如实记）**：Harness 重启后的真机走查（ACC-04 以后）未做 —— 需要用户重启 Desktop，
  Agent 不自行重启宿主。重启前的状态是"包已安装、副本已核、探针已过"，不是"装机通过"。
