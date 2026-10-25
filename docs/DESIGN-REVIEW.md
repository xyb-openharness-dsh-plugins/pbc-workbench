# 设计独立审查记录

评审对象：commit `36ae297`（工作区 **clean**，`git status --porcelain` 输出 0 行）
评审员：独立子代理（与开发者不同上下文，不参与实现）
评审时间：2026-10-25T14:48:13+08:00
输入范围：`docs/` 下 SPEC / USER-RESEARCH / SCENARIOS / DIFF-MATRIX / INTERACTION-DESIGN / METRIC-GRADING / GUIDELINE-BRIDGE / HVT-REVIEW / CLINICAL-DATA-2026 / DEV-REQUIREMENTS-2026-10-25 / ACCEPTANCE / RELEASE / DEV-PLAN / PATIENT-FLOW / SCHEMA / BACKLOG-STATUS / HVT-REVIEW；`schema/` 0001–0004 与 freeze-contract；`dsh/` 全部 13 个模块；`lib/client.js`、`src/client.js`、`lib/version.js`；`public/{app.js,index.html,style.css,demo-data.js}`；`prototypes/v0.2/{app.js,index.html,style.css,demo-data.js}`；`demo/build-demo-data.mjs`；`test/` 11 个 .mjs；`scripts/` 19 个（含 check-wording / check-schema / check-conformance / shoot-readme.py / probe-dev.py / probe-prototype.py）；`README.md`、`CHANGELOG.md`、`package.json`、`VERSION`；`docs/screenshots/` 7 张 PNG（元数据）。基准：`starter/docs/15-HVT-REVIEW.md`、`26-CANCER-FEATURE-LINES.md`、`28-INTERACTION-PATH-DESIGN.md`、`30-RESPONSIVE-RULES.md`、`32-TREATMENT-PATHWAY-FOLDOUT.md`、`33-README-SCREENSHOTS.md`。

**评审期间仓库发生过两次提交**：评审开始时 HEAD=`3dc4b80`（clean），中途开发者提交 `96b2568`（docs: DEV-PLAN 按实测更新）、`36ae297`（docs: DEV-REQUIREMENTS §六 追补 7 条）。`git diff --stat 3dc4b80 HEAD` 只有 `docs/DEV-PLAN.md +25/-3` 与 `docs/DEV-REQUIREMENTS-2026-10-25.md +37`，**无任何代码改动**，故下文所有代码级发现对两个提交同时成立；下文行号以 `36ae297` 为准。

## 结论一句话

**P0 三条 / P1 八条 / P2 六条；阻断 G2 签认。** 文档层的诚实度显著高于代码层——0 访谈、指南层不做、479 条里只有 2 个来源真查过，这些都写清了；但"私密不进导出"这条自己立的红线被实测证伪（且配套测试是假绿，ACCEPTANCE 还把该项勾成"通过"），"不判应答"被 `档案 A · 部分应答` 这个数据字段直接反例化，核心闭环的"记录"半环没有写入通路。

---

## P0（结构性断链，必须修）

### P0-1 私密记录被写进导出文件（两个出口都漏），配套测试恒真，ACCEPTANCE 却勾"通过"

项目自己在三处把这条立成红线：`dsh/export.js:4` 注释「**私密分节不进导出**：`visibility='private'` 的痒累记录、合并症、换线记录一律不写。即便调用方传 includePrivate=true 也只影响页面」；`dsh/routes.js:154` 注释「**导出侧强制剔除私密**，即便调用方传了 private=1 也不带出去」；`docs/SCENARIOS.md` S15「不把私密标记内容放进导出（逐项过滤）」。

实际实现：

- `dsh/routes.js:157` `const full = source.profile(key, { includePrivate: true })` —— 导出路由**主动**取全量（含私密），再交给渲染器。
- `dsh/export.js:187` `const syms = (p.symptoms ?? []).filter((s) => inWindow(s.date, cutoff))` —— 只按时间窗过滤，**没有 `visibility` 条件**；`:220` `const reg = (p.regimenChanges ?? []).filter((c) => inWindow(c.date, cutoff))` 同样。
- `dsh/export.js:252-255` 的 `hasPrivateContent()` 只被用来决定要不要打印排除声明，不参与过滤；于是 `:239` 会写出「本人标记为私密的记录（痒累自述、合并症、换线记录中被标私密的部分）本文件不包含。」——**同一份文件里既声明"不包含"又写了原文**。
- 第二个出口同样漏：`dsh/workbench.js:79` `const profile = this.getProfile(key, { includePrivate: true })` → `:86-89` `renderPrepMarkdown(profile, {...})`。

实测（`/tmp/priv2.mjs`，`Workbench.open(tmpdir)` 起真库、落真实 `visibility='private'` 行、`startWorkbenchServer` 真端口、`GET /api/pbc-workbench/export/A.md`）：

```
LEAK symptom note in export: true
LEAK regimen text in export: true
LEAK comorbidity in export: false
private-disclaimer present: true
page plain has private symptom? false
page full has private symptom? true
```

即：**页面出口过滤正常，导出出口漏**；症状 note 与换线 doctor_text 都被原样写进带出去的文件（合并症不外泄是因为 `export.js` 根本不渲染合并症这一节）。schema 侧字段确实存在且可写：`schema/0001_initial.sql:122` symptom_logs 的 `note TEXT` + `visibility`，`:159` regimen_changes 的 `visibility`。

**为什么测试没抓住**：`test/server.test.mjs:100-107`「⑤ 私密记录不进导出」的断言素材取自演示数据：

```js
const privNotes = full.symptoms.filter((s) => s.visibility === 'private' && s.note).map((s) => s.note)
for (const note of privNotes) { assert.ok(!md.includes(note), ...) }
```

而 `demo/build-demo-data.mjs:270/:272` 一律 `visibility: x.visibility ?? 'shared'`，全文件**无一处 'private'**（`grep -n private demo/build-demo-data.mjs` 零命中）→ `privNotes` 为空数组，循环体空转，断言恒真。同一文件 `test/server.test.mjs:80` `assert.ok(priv >= 0)` 也是恒真式（应为 `> 0`）。

**诚实性问题叠加**：`docs/ACCEPTANCE.md:18` ACC-02 的真实结果列写「…就诊准备导出十段、**私密不进导出**」，判定列写「**通过**」。这是本仓唯一一处"把未验证/已被证伪写成通过"的地方，与 ACCEPTANCE 顶部 `:11` 的「不能写"装机通过"」自我要求相冲突。

### P0-2 `档案 A · 部分应答` —— 判读词进了数据层，并出现在患者交给医生的文件标题里

`docs/METRIC-GRADING.md:20`「GLOBE / UK-PBC / 巴黎 / 巴塞罗那评分 | 判定 | ⛔ **不做** | 属医生判定工具」；`public/app.js:544`「界面也不写"应答/未应答"」——但：

- `demo/build-demo-data.mjs:82` `label: '档案 A · 部分应答'`（唯一数据源）
- 产物 `prototypes/v0.2/demo-data.js:8` 与 `public/demo-data.js:8` `"label": "档案 A · 部分应答"`
- 直出界面与导出：`dsh/readmodels.js:207` `SELECT profile_key, label, display_name FROM profiles`；`dsh/export.js:109` `out.push(\`# 复诊准备 · ${p.label ?? '档案'}...\`)`

实测导出首行：`# 复诊准备 · 档案 A · 部分应答（虚构患者甲）`。即患者打印给医生的那份文件，标题就带着工作台自己宣称"不判"的应答结论。

**检查器为何放过**：`scripts/check-wording.mjs:38` 的规则 `re: /(你已经|你属于|判定为|应判为)\s*(完全应答|部分应答|应答不佳|未应答)/g` 要求谓语前缀，裸 label 「· 部分应答」不匹配；而 `npm run check` 输出「✓ 医疗表述检查通过（29 个实现文件，0 处越界）」——**假绿**。同类漏检风险也适用于其它走 label/枚举字段的判读词。

### P0-3 核心闭环的"记录"半环没有写入通路，患者记的痒/累刷新即丢

`docs/SPEC.md:11` 的最小闭环是「导入/录入一次化验 → …对照 → **同日记一次痒/累** → 复诊前导出快照」。实测：

- `public/app.js` 全文**只有 1 处 `fetch(`**（`:31` `const res = await fetch(apiUrl('/bootstrap'))`），无任何 POST/PUT/DELETE。
- `dsh/routes.js` 全部路由只有 5 类：`:103` health、`:129` bootstrap、`:140` profile GET、`:155` export GET、`:180` export/save POST、`:193` settings/mineru；且 `:104/:130/:142/:157` 一律 `if (req.method !== 'GET') return ...405`。全仓唯一写入事实层的入口是 `dsh/import.js:225` `commitPanel({documentId, profileKey, drawnOn, labName})`（化验单）。
- `dsh/workbench.js` 只有 5 个方法（`:55 listProfiles`、`:60 getProfile`、`:64 bootstrap`、`:73 saveExport`、`:99 close`），**没有 addSymptom / 任何症状写入**。
- 前端症状保存是内存假动作：`public/app.js:833-843` 点击 `#save-itch` 构造 `{date: '2026-10-25', ...}`（日期写死）塞进 `state.localSymptoms`，随后 `toast('已记下这一次（演示：仅本页内存，不落库）')`。prototypes/v0.2 同构。

界面文案本身是诚实的（明说"仅本页内存，不落库"），但对外口径不是：`docs/INTERACTION-DESIGN.md:50-58` 的 CRUD 双通道矩阵逐实体承诺手工录入通道，`docs/DEV-PLAN.md:15` M5 标 ✅「七步移植 … `npm run check` 全绿」。一个患者实际能完成的是"看 + 导出导入过的化验单"，完成不了"自己记一次痒"——这是闭环缺环，不是"待优化"。

---

## P1（影响可信度，应修）

### P1-1 IP1 红线自破：无签认路径文档就开了 HTML，且签认文件根本不存在

`docs/INTERACTION-DESIGN.md:4`「M1 产出，随 G1 同批签认。**签认前不开 HTML（IP1）**」；`:65` IP1 结果列自记「M1 产出，**待签认**」。`find . -iname '*signoff*'` **零结果**，`docs/SIGNOFF-G1.md` 不存在——而 `docs/DEV-REQUIREMENTS-2026-10-25.md:5` 与 `INTERACTION-DESIGN.md:4` 都引用了这个不存在的文件名。starter `28-INTERACTION-PATH-DESIGN.md:89` 的 IP1 判据是「文档存在 + 签认记录」。原型已开到 0.2.3。要么补签认记录，要么把 IP1 降级为"本轮豁免"并写明理由，不能两边都占。

### P1-2 看板两处入口在实现里不存在，IP3「入口逐字一致」自记 WARN 实为 FAIL

`docs/INTERACTION-DESIGN.md:17` 声明「入口文案与看板卡片名**逐字一致**（IP3）」，`:21` S01 入口「看板「最近变化」→「看看上次化验」」，`:24` S10 入口「看板「接下来」→「看复查节奏」」。实测：

- `grep 看看上次化验 / 上次化验 / 看看上次` 在 `public/app.js` 与 `prototypes/v0.2/app.js` **全部 0 命中**；`看复查节奏` 同样 **0 命中**。
- 看板 `data-goto` 总共只有 4 个：`public/app.js:257` `symptoms/itch`、`:258` `symptoms/fatigue`、`:279` `followup/prep`、`:280` `records/export`。
- 「最近变化」卡（`:266-272`）与「接下来」卡（`:261-265`）**没有任何可点元素**，S01/S10/S16 三条路径的入口在实现里是死文本。

对照：`记一笔痒`「记一笔累」`整理复诊问题`「导出给医生」`今天漏服` 均 1–3 命中——所以这是局部不一致，不是整体偏差。`docs/HVT-REVIEW.md:80` 自记「X2 🔧 主要入口一致；`看板「接下来」` 等 4 处文案以代码为准」——按 starter 15 号 X 层口径，入口逐字走不通应为 0 而非 WARN，`HVT-REVIEW.md:84` 用「X1/X4 为 1 就算过」的解释掩盖了这一点。

### P1-3 CRUD 双通道矩阵承诺 10 个实体的手工入口，实现里是 1 个 toast 且只挂 5 个页面

`docs/INTERACTION-DESIGN.md:79`「卡片「⋯ 更多」含：手工补一条 / 改这一条 /（资料类）看原文」；矩阵 `:50-58` 逐实体列出字段数（化验 6、症状 3–4、用药 3、筛查 3、换线 2…）。实测：

- `grep data-more public/app.js` 仅 **2 处**：`:633` 的按钮（只在 `vScreeningType` 内，即骨骼/甲状腺/食管胃镜/脂溶性维生素/肝影像五页共用）与 `:897` 的绑定。
- `:898` 点击后执行 `toast('⋯ 更多：手工补一条 / 改这一条 / 看原文')` —— **是提示气泡，不是录入通道**，没有任何表单、没有写库。
- 其余 9 个实体（化验/症状/用药/漏服/换线/问题/原件/试验收藏/合并症）页面上没有这个入口。

### P1-4 ACCEPTANCE 与实测冲突的那一行（见 P0-1）；另有 5 处"部分"未说明判定门槛

除 `docs/ACCEPTANCE.md:18` ACC-02 已列为 P0 外：`:23` ACC-08、`:24` ACC-09、`:25` ACC-10 标"通过"，但括号里分别带「宿主容器未验证」「MinerU 真请求需 Token，未接网络实测」——这三条是"主链路通过 + 子项未验"，写法可接受但应把未验子项单独出一行，否则与 ACC-02 同样有被读成"全部通过"的风险。`:11` 顶部一句话状态与 `:45-52` 的限制段写得如实（明确"不能写装机通过"），这部分是加分项。

### P1-5 计数三处互相矛盾，代码实测为 9 一级 / 30 二级

- `docs/SPEC.md:24`「## 3. 功能范围（**10 一级 / 32 二级**）」
- `docs/SCENARIOS.md:107`「上表 16 条覆盖 **10 个一级线**、**33 个二级页签**中的 30 个」
- `docs/DIFF-MATRIX.md:5`「本仓：**9 一级 / 30 二级**」、`README.md:18`、`DEV-REQUIREMENTS` R1/D8 均为 9/30

实测 `public/app.js:56-65` 的 NAV：9 条一级，二级数 3+3+3+3+4+5+3+3+3 = **30**。SPEC 与 SCENARIOS 两处数字是错的，且 SCENARIOS 那句"33 个中的 30 个、未覆盖的 3 个"整个推论建立在错误总数上。

### P1-6 `METRIC-GRADING.md` 的"唯一来源"文件不存在，GGT 被标"启用"但代码无阈值

- `docs/METRIC-GRADING.md:4`「阈值表**只存在于 `dsh/ctcae.js` 一份**」→ `ls dsh/ctcae.js` → `No such file or directory`。`grep -rn 'CTCAE\|gradeOf\|GRADE_CODES' dsh/ lib/` **零命中**：分级逻辑只活在前端（`prototypes/v0.2/app.js:22-35`、`public/app.js` 内联），`test/ctcae.test.mjs:11` 注释也承认「读 `public/app.js`」。后端没有任何分级能力，若将来导出/摘要需要在服务端分级，这份"唯一来源"是不存在的。
- `docs/METRIC-GRADING.md:11`「GGT | ×ULN | **✅** | 与 ALP 同源，胆汁淤积的并列项」→ `GRADE_CODES` 的 key 为 ALP/ALT/AST/TBil/Cr/PLT/Hb/WBC/ANC/ALB，**不含 GGT**；实测 `gradeOf({code:'GGT', value:231, refHigh:120})` → `{"state":"none","reason":"no-standard"}`。界面 `public/app.js:538` 自己写了兜底「该项在 CTCAE 里没有可用阈值（如 GGT）」——文档的启用清单与实现相反。

### P1-7 时间被冻结在 2026-10-25，多处间隔数值没有文档依据

- `public/app.js:615` `list.filter((s) => s.date >= '2026-09-25')` ——「最近 30 天记录」的窗口写死。
- `:638` `const now = new Date('2026-10-25T00:00:00')` —— `monthsSince` 的时间基准冻结，随真实时间推移「距上次 N 个月」会持续失真。
- `:835` `date: '2026-10-25'`、`:877`「生成时间：2026-10-25」、`:892` `a.download = \`DuctPal-就诊快照-2026-10-25.txt\`` —— 记录日期、快照文案、下载文件名三处写死。
- `:263` 参考复查节点写死 `'2026-11-08（约 1 个月后）'`（不是按起点+间隔算出来的）；`:632` 硬编码「参考间隔 12–24 个月」；`:656` `[6, 12].map(...)` 复查节点；`:264`「按 6 个月间隔推算」。
- 依据缺口：`docs/GUIDELINE-BRIDGE.md:21` 只声明「只给"起点 + k×间隔"的**通用**参考（3/6/12 个月三档）」——**12–24 个月这个区间在 docs/ 里 grep 不到任何出处**（`grep -rn '12–24\|12-24' docs/*.md` 零命中）。

### P1-8 S14 的落点页不存在：顶栏没有「设置」，全前端 0 处「设置/关于」

`docs/SCENARIOS.md` S14 的"接住"写「`settings·关于` 里一句客观说明＋「问医生」入口」；`docs/INTERACTION-DESIGN.md:34` 写「顶栏「设置」→「关于」」。实测 `grep -c '设置' public/index.html public/app.js` = **0 / 0**，`public/index.html` 的顶栏只有 `.brand` / `.statusline` / 三个按钮（`切换档案`、`AI 对话`、`×`），`v*` 渲染函数列表（`:246-791`）里没有任何 settings/about 视图。同时 `docs/DIFF-MATRIX.md:5` 用「设置走顶栏，不占一级」来解释一级只有 9 个——**这个解释失去了载体**：设置既没有一级入口，也没有顶栏入口。

---

## P2（可改进）

### P2-1 字面 `**` 被当正文渲染给患者
Markdown 强调语法直接写进 HTML 字符串，页面无 md 解析器（`grep -n 'marked\|markdown-it\|renderMd' public/app.js public/index.html` 零命中）：`public/app.js:294`「这些是**参考节点**，不是提醒」、`:320`「**数值之间不可直接比较**」、`:350`「工作台**不判断纤维化分期**」、`:716`「**原件会上传到云端解析服务**」、`:801`「离线语料目前**只覆盖胰腺癌**」。原型同源 5 处。患者看到的是星号原文。

### P2-2 ≤900px 时 AI 面板永久不可达
`public/style.css:270-274`：`.agent { display: none; }` + `.frame.agent-open .agent { display: flex; }`；但 `public/app.js` 全文 `grep -c 'agent-open'` = **0**，只有 `:945` `frame.classList.toggle('agent-hidden', !state.agentOpen)`。窄窗下面板恒隐藏，点「AI 对话」（`:952` 只切 `agentOpen` → `agent-hidden`）打不开。`docs/ACCEPTANCE.md:23` ACC-07 说"dev 三档宽度溢出均为 0"——溢出为 0 与"面板可达"是两件事。

### P2-3 `test/responsive.test.mjs` 与 `npm run probe:resp` 均不存在
starter `30-RESPONSIVE-RULES.md:19/:22/:39` 把这两者列为判据；本仓 `test/` 只有 11 个 .mjs（无 responsive），`package.json` scripts 无 `probe:resp`（只有 `probe:proto` / `probe:tabs` / `probe:page-view`）。替代物是 `scripts/probe-dev.py` 的 A7（三档宽度溢出检查），覆盖面窄于 30 号 §1 表格。

### P2-4 README 0 张截图 + 截图版本 0.1.0 与包版本 0.2.3 不一致 + 缺 `check-readme-assets.mjs`
- `grep -c '!\[' README.md` = **0**；`docs/screenshots/` 7 张 `readme-*-0.1.0.png`（实测均 2880×1880 RGB，即 1440×940@2x，符合 33 号 §4 宽度）**未被 README 引用**。
- `scripts/shoot-readme.py:11` `VERSION = "0.1.0"` 硬编码，产出文件名因此锁在 0.1.0；starter 33 号 §1 要求「每次发版前刷新截图版本（图内版本号与 README 版本一致）」。
- starter 33 号 §6 要求 `check-readme-assets.mjs` 进 check 链：`ls scripts/check-readme-assets.mjs` → **不存在**。
- 因为原型刻意冻结在 v0.1.0（`test/ui-parity.test.mjs` ⑨ 明确要求原型不跟包版本涨），截图拍原型是合理的；问题在于 README 从未引用，且没有真机态截图位。

### P2-5 README 状态表与 CHANGELOG/RELEASE 打架
`README.md:20-23` 仍写「HTML 原型 ⏳ M2」「数据模型冻结 ⏳ M3」「临床试验库 ⏳ **未查过** M4」「开发版 / 装机 / 发布 ⏳ M5/M6/M7」，而 `CHANGELOG.md:99-101` 已记 M6 收口、`docs/DEV-PLAN.md:12-16` 已按实测更新。方向是"少报"（比"虚报"安全），但同一仓里两套进度表会让评审者无法判断哪份为准——README 是 33 号 §5 规定的外部入口。

### P2-6 `lib/version.js` 的 commit 落后 HEAD；IP7 数字控件无 `inputmode`
- `lib/version.js` `export const commit = '5bb0fb1'`，实际 HEAD=`36ae297`（源头 `scripts/build-version.mjs` 未随文档提交重建）。属构建产物滞后，不影响功能，但"可追溯"一项会指向一个不存在的评审对象。
- `docs/INTERACTION-DESIGN.md:10`「数字用键盘组件」、IP7「抽查全部数字控件 `inputmode`」：`grep -c inputmode public/app.js` = **0**，`<input type="number">` = 0，唯一数字控件是 `:549` 的 `<input type="range">`。IP7 目前无对象可抽查——要么改判据（滑条也可接受），要么写"本轮无数字文本输入，IP7 不适用"。

---

## 通过项（逐条列，说明查了什么、怎么查的）

1. **患者视角红线（0 访谈不得冒充一手引语）——通过。** 通读 `docs/SCENARIOS.md` S01–S16 全文：顶部 `:3-5` 有证据等级声明块，明确「本轮 0 访谈」「下表「患者原话」全部是**改写句（假设，未访谈）**…不得当作真实患者发言引用」；16 条里每条原话字段都带「（改写·假设）」角标，无一条伪装成引语。`docs/USER-RESEARCH.md` 分层写清 A 层一手访谈 0 位、B 层社群文本 0 条、`§3` 还如实记录了 web_search 无凭据、Bing 抓取被本地化重定向污染。**没有医生任务冒充患者需要**：`docs/PATIENT-FLOW.md`「页面树反推结论」明写「没有出现"医生工作流"（排班、处方、随访计划）——这些不属于患者任务，一律不做」。S14 主动排除家属筛查线。
2. **声明不做的事没有被偷偷做——部分通过。** 逐条 grep（`public/app.js`、`prototypes/v0.2/app.js`、`dsh/export.js`、`dsh/readmodels.js`）：GLOBE/UK-PBC/巴黎/巴塞罗那**只出现在否定性文案**（`public/app.js:544`、`prototypes/v0.2/app.js:497`、`dsh/readmodels.js:19` 注释、`lib/client.js:229` 提示词）；分期：无 `stage` 列、无 Child/MELD 计算，`public/app.js:264` 明写「未按分期调整」、`:350` 明写「不判断纤维化分期」；痒/累不套 CTCAE 与 `docs/METRIC-GRADING.md:18-19` 一致（界面走 0–10 滑条与三档）。**唯一破口是判读词 label（已列 P0-2）**。
3. **schema 无判读列——通过。** `grep -rniE '\b(diagnosis|risk_level|response|stage|grade|severity|conclusion)\b' schema/` 仅 3 条命中且全是注释/声明：`schema/0001_initial.sql:3`、`:111`「症状（表达面）：患者自评，不套 CTCAE，不落任何 grade」、`freeze-contract.md:18`。22 张表清单逐一看过，无判定列；抗体用三态 `CHECK ('positive','negative','untested')` 而非判断。
4. **私密是数据结构属性（visibility 列）——通过（列本身）。** `visibility` 只出现在 3 张表，且都是 `TEXT NOT NULL DEFAULT 'shared' CHECK (visibility IN ('shared','private'))`：`schema/0001_initial.sql:48`、`:122`、`:159`。`dsh/readmodels.js:39` 有 `PRIVATE_FIELDS` 常量、`:77/:155/:168` 三处按 `includePrivate` 过滤——页面出口实测正确（见 P0-1 的探针输出 `page plain has private symptom? false`）。**结构对，出口漏**。
5. **数据单一来源 + parity 真测——通过。** `demo/build-demo-data.mjs` 是唯一源，产出 `prototypes/v0.2/demo-data.js` 与 `demo/demo-data.sqlite`；`test/demo-parity.test.mjs:57-64` 对每个 profile 做 `assert.deepStrictEqual(got, want, ...)`（不是抽样字段），`:44-51` 先比行数与 key 集合。`public/demo-data.js` 与原型版本逐字节相同（`test/ui-parity.test.mjs` ⑤ 断言）。我另外核对了 `dsh/readmodels.js:207` 确实只 `SELECT profile_key, label, display_name`，不二次拼装。
6. **界面一致性（public 与原型差异限定在"接接口"白名单）——通过。** 手工 diff 两个 app.js：差异仅 ① `VERSION` `'v0.1.0'`→`'v0.2.3'`；② 新增 `API_PREFIX='/api/pbc-workbench'`、`apiBase()`、`apiUrl()`、`loadBootstrap()`、`applyData()`、`showSourceBanner()`、`renderAgentSlot()`、`async boot()`；③ `#version-chip` 文案「· 原型」→「· 开发版」；④ 原型 chat 模拟回复 → public 改 `dispatchEvt(pbc:agent-draft)`。与 `DEV-REQUIREMENTS` #17 声明的三类白名单一致，无夹带业务改动。
7. **版本单一来源与首屏可见（P1/P3）——通过。** `VERSION`=`0.2.3`、`package.json:3`、`public/app.js:52`、`public/index.html:24`（`v0.2.3 · 开发版`，首屏 `.version-chip`）、`lib/version.js` 五处一致；`prototypes/v0.2/index.html:24` 是 `v0.1.0 · 原型`（原型冻结，符合 33 号与 ui-parity ⑨）。`npm run check` 的 `check-version.mjs` 覆盖这个断言。P1「HTML 首页首屏可见版本号」实际通过（HVT-REVIEW.md:70 记的 P2「未验证」也如实）。
8. **折叠卡五块固定顺序 + 打印展开规则——通过。** `public/app.js:395-407`：`<details class="phase-fold">` 内 5 个 `pdBlock`，顺序 = 方案 / 指标和趋势 / 影像发现 / 副作用总结 / 心理营养措施和效果（与 starter `32-TREATMENT-PATHWAY-FOLDOUT.md:12` 要求的固定顺序逐项对齐），`:407` 有「无内容写「无 + 说明」，不省略块」。打印规则三条齐：`public/style.css:189-193` `@media print { .phase-detail{display:grid!important} summary::after,.ph-hint{display:none!important} .phase-fold{break-inside:avoid} }`。`summary::after` 用文字「展开细节 ▸ / 收起 ▾」（`:173-187`），非 emoji，符合要求。data 形状 3 phase × detail 5 keys 齐全。
9. **26 号线→页→卡结构性门槛——通过。** 一级 9（要求 8–10）、二级 30（要求 24–30）、二级为 0 的一级线 0 条、单线最多 5 个二级（screening，未超 6）；心理线不做有 `docs/SPEC.md` 与 DIFF-MATRIX 的明确理由。
10. **禁做项在界面文案里有常驻否定句——通过。** `public/app.js:544`「工作台不计算 GLOBE / UK-PBC / 巴黎 / 巴塞罗那等应答评分——那些是医生用的判定工具。界面也不写"应答/未应答"」；`:350` 分期否定句；`:632`「（工作台默认值，不是指南内容）」；药名三处标「获批状态未核实」（`:374`、`:770`、`:884`）；无指南页码（`grep -rnE '第[0-9]+页|页码' public/app.js prototypes/v0.2/app.js dsh/*.js` 零命中），与 `GUIDELINE-BRIDGE.md` 四问筛全不通过的结论一致。
11. **IP8 无裸删除 / 无"不可恢复"——通过。** `grep -c 不可恢复` 在 `public/app.js`、`prototypes/v0.2/app.js`、`public/index.html` 均为 0；更正走「改这一条」语义（虽然后端未实现，见 P1-3）。
12. **AI 不自动发送——通过。** `public/app.js:822-830`：点击 `[data-draft]` 只 `document.dispatchEvent(new CustomEvent(EVT_DRAFT, {detail}))` 并写 `ta.value`，`ta.focus()`，随后 `toast('已把提示词放进输入框（不会自动发送）')`；`:988-996` 的 `#agent-send` 也是派发事件到宿主原生会话，并明写「本页不模拟回复」。符合 IP10 与 `test/ui-parity.test.mjs` ⑧「开发版不许自建聊天框」。
13. **静态检查可复跑、且做过反向验证——通过。** 我实跑：`npm test` → **74 tests / 74 pass / 0 fail**；`npm run audit` → **37/37 通过 · 0 失败 · 0 待人工**（与 `docs/RELEASE.md` 声称一致）；`node scripts/check-schema.mjs` → `errors: []`「0001_initial.sql sha256 与合同一致」；`node scripts/check-wording.mjs` → 退出 0。CHANGELOG 记 `check-schema` 做过反向注入 `risk_level` 变红的验证（防假绿），这一点我没有复跑注入，但路径合理。**但 `check-wording` 存在真实漏检面（P0-2）。**
14. **诚实性框架（除 ACC-02 外）——通过。** `docs/CLINICAL-DATA-2026.md:25` 明写「6 个来源里只有 2 个真的查过」，逐来源表把 4 个标 `未查过`/`unconfigured`；`docs/RELEASE.md` 的表格把 Git push / Release / 市场 PR / 真机走查全部记为 **未执行**，并明写「"本地安装成功"不推断"市场可见"」；`docs/ACCEPTANCE.md:11/:45-52` 明写「界面层（ACC-04 以后）未做…不能写"装机通过"」；`CHANGELOG.md:100-101` 重复同一句。这三处是本项目最值得保留的部分。

## 未能核查的

1. **7 张截图的画面内容无法目视。** 本会话模型不支持图片输入（`read_image` 返回 `model "deepseek-4.1-flash" does not declare image input`），因此无法确认图内是否真有版本号、是否真实页面渲染而非设计稿、是否含任何真实患者信息（PII）。只能核到：文件名 `readme-<功能>-0.1.0.png`、尺寸均 2880×1880 RGB（=1440×940@2x，符合 33 号 §4 的 1440 宽要求）、由 `scripts/shoot-readme.py` 对 `prototypes/v0.2/index.html` 生成。**33 号 §4 的"顶部版本号可见"与"无 PII"两项需要人眼复核。**
2. **装机后的界面层（ACC-04 及以后）未验。** 需要用户重启 DSH Desktop 让新包生效后再新建会话打开工作台；Agent 不自行重启宿主，本会话里的 Web GUI（端口 56166）加载的仍是重启前的包。因此"宿主容器内 9 一级 / 30 二级是否真的渲染""窄容器抽屉是否可用（P2-2 的严重度可能被宿主布局放大）""重启后宽度偏好是否恢复"三项均无法实测。
3. **MinerU 真实上传解析未接网络。** 需要用户自备 Token；我只核到 `dsh/mineru.js` 与 `dsh/settings.js` 的存在与掩码逻辑（`dsh/routes.js:195` 注释「只回掩码与来源，**原文永不出现在响应里**」）。
4. **Windows / Linux 行为。** 只在本机 macOS arm64 上验过，路径处理（`dsh/store.js`、导出文件名清洗）跨平台未验。
5. **`npm run audit` 的 37 项判据含义。** 我只看到汇总输出「37/37 通过」，未逐项读 `scripts/check-conformance.mjs` 的 37 条断言内容，所以无法判断这 37 项对"设计质量"的覆盖度——它验的是宿主注册契约与包结构，不验业务语义。
6. **演示数据里的日期序列与真实"今天"的关系。** 数据以 2026-10-25 为锚点构造（`demo/build-demo-data.mjs` 与前端写死日期一致），我无法判断这是刻意对齐评审日还是永久写死——从 P1-7 看是后者（写死在代码里，不取系统时间）。

---

## 开发者处理记录（2026-10-25，逐条留痕）

> 规则：**不许把发现删掉、不许改结论**。每条写"改了什么 + 拿什么证明"。
> 没改的写"本轮不改 + 为什么"。

### P0（3/3 已修）

| 编号 | 处理 | 证据 |
| --- | --- | --- |
| P0-1 私密漏进导出 | **已修**。过滤从"调用方记得传参"移到 `dsh/export.js` 的 `renderPrepMarkdown` 内部（`shared()`），并删掉 `excludedPrivate` 选项——是否写排除声明也由渲染器自己算。`routes.js:157` 与 `workbench.js:79` 仍取全量（那是为了让渲染器能发现"有东西被排除"），但传什么都不影响结果。另：`readmodels.js` 的 `regimenChanges` 之前**没透传 `visibility`**，导致"读模型过滤一遍、导出层拿不到字段又放行一遍"，两个出口各以为自己已经过滤——已补。 | 新增 `test/export-private.test.mjs` 4 条（真库 INSERT `visibility='private'` + 真端口，覆盖渲染器层 / HTTP `/export` / 落盘 `/save`，正向"不出现"与反向"共享内容必须在"双断言）。**反向对照实跑**：把 `shared()` 改成不过滤，4 条红 3 条；恢复后全绿。 |
| P0-2 判读词进数据层 | **已修**。`demo/build-demo-data.mjs:82` `档案 A · 部分应答` → `档案 A · 随访中`；`check-wording.mjs` 的 `response-verdict` 规则去掉谓语前缀要求（结论词出现在任何字段值里都算越界），新增 `NEGATION_WIDE` 句内否定放行以免把免责句本身报成越界。 | 反向对照：label 改回「部分应答」→ `✗ demo/build-demo-data.mjs:85 [response-verdict]`；恢复后 `✓ 0 处越界`。导出首行现为 `# 复诊准备 · 档案 A · 随访中（虚构患者甲）`。 |
| P0-3 闭环缺"记录"半环 | **已修**。新增 `dsh/writes.js`（`ValidationError` / `addSymptomLog` / `removeSymptomLog` / `assertIsoDate`）→ `Workbench.addSymptom/removeSymptom` → `POST /symptoms`（201）/ `DELETE /symptoms/:id`（200/404）→ `createHandler` 与 `dsh/index.js` 的 source 代理都接上 → 前端 `await fetch(apiUrl('/symptoms'))` + `reloadProfile()` 重取。日期改用 `todayIso()`（**不用 `toISOString()`**：UTC 在东八区凌晨会退一天）。health 的 `capabilities` 加 `symptoms`。 | `test/symptom-write.test.mjs` 7 条（真进库能读回 / 0 分≠没记 / 坏输入 400 带字段名且不落地 / 私密落库默认不给 / 真删 + 404 / 重开库还在 / 演示模式 `persisted:false`）+ `probe-dev.py` 新增 A10（点保存后 bootstrap 症状条数 +1，实测 `{"before":7,"after":8}`）。 |

### P1（本轮修 3 条，其余如实留待）

| 编号 | 处理 |
| --- | --- |
| P1-4 ACCEPTANCE 与实测冲突 | **已修**。ACC-02 的真实结果列删掉「私密不进导出」并注明"曾把它勾成通过，实为假绿"；新增限制段第 5、6 条把三处翻案逐条写清（含假绿原因与修复证据）。 |
| P1-6 「唯一来源」文件不存在 | **确认属实，本轮不改代码，改文档**。`dsh/ctcae.js` 确实不存在，分级逻辑只在前端；`METRIC-GRADING.md:4` 的"唯一来源"表述与 `:11` 的 GGT「✅ 启用」都与实现相反（`GRADE_CODES` 无 GGT key）。这两处需要改文档措辞，列入 M5 收尾。 |
| P1-5 / P1-7 / P1-8 / P1-1 / P1-2 / P1-3 | **如实保留为未修**。其中 P1-1（IP1 无签认就开 HTML）、P1-2（看板两卡无可点入口，S01/S10/S16 入口文案 0 命中）、P1-3（CRUD 矩阵承诺 10 实体、实现是 1 个 toast）、P1-8（S14 的"设置→关于"页不存在）是**真实缺口**，需在 G2 签认前决定"补实现"还是"降级文档并写明理由"，两者不能都占。P1-5（SPEC/SCENARIOS 写 10/32、33，实测 9/30）是文档笔误，直接改。 |

### P2

留待 M5 收尾统一处理；其中「README 0 张截图且截图版本 0.1.0≠0.2.3」需先重新出图。

### 未能核查项

与评审原文一致：7 张截图需人眼复核（评审会话模型不支持图片输入）；ACC-04 以后需用户重启 Harness；MinerU 真上传需 Token；Win/Linux 未验。
