## 0.2.12 — 2026-10-28（装机空白修复：apply 读了 ctx.config）

- **根因**：`dsh/index.js` 用 `ctx.config?.root` 取资料目录。Cordis 的服务访问守卫把 `ctx.config` 当成
  未声明 inject 的服务访问，直接抛 `cannot get property "config" without inject`；
  `apply()` 阶段就失败 → 服务端插件从未激活 → `/api/pbc-workbench/ui/` 与 `/health` 都不存在 →
  **装机后工作台业务区空白**。宿主每次启动都会记一行
  `pbc-workbench-main (@ductpal-dsh/pbc-workbench): Error: cannot get property "config" without inject`。
  本地桩件把 `ctx.config` 补齐了，所以 check 全绿、装进 Desktop 才炸（同族先例：pf-ild 2026-10-25）。
- **修法**：`apply(ctx, config = {})`，开库与 `dataDirConfigured` 都改读 `config?.root`。
  `cordis.patch.yml` 的 `config.root` 注入与 `Config.root` 声明保持不变（两处仍同源）。
- **回归**：新增 `test/host-config.test.mjs`（3 条：apply 签名、执行代码里不再出现 `ctx.config`、patch/Config 同源）。
- 实测（带 cordis 守卫的宿主桩件）：修前 `APPLY THREW: cannot get property "config" without inject`
  （栈指向 `dsh/index.js:45:36`，与 harness.log 一致）；修后 `apply OK`，
  `/api/pbc-workbench/ui/` 200、`app.js` 200、`style.css` 200、`health` 200。
- `npm run check` 退出 0，`npm test` 118/118 通过。

## 0.2.10 — 2026-10-27

- 分隔线交互统一：AI 面板分隔线加宽抓取区，悬停显示本工作台同色系增亮色与拖动把手（⠿）；拖动改用指针捕获，越过业务 iframe 不再丢事件。

# 变更记录

只增不删；每条写清"改了什么 + 为什么 + 用户可见结果"。版本号与 VERSION、package.json 三处必须一致。

## 0.2.9 — 2026-10-27（0.2.8 链接返工：指南改为可点）

- AI 对话集成（评审反馈）：删掉页面自建的 AI 面板（默认展开的假对话 + 输入框 + 发送 + 拖动分栏 + 「×」收起），顶栏只留一颗「对话」按钮请宿主打开原生会话；补 `public/bridge.js`（此前 `pbc:agent-draft` 只是 document 事件，从来没 postMessage 给外壳，装机版「AI 帮我填」送不到会话）。原型 `prototypes/v0.2` 同步；114 条测试通过。

用户指出 0.2.8「0 条外链、11 处全 nolink」不满足「指南可点」，不能直接装机。本轮按机构重新检索并逐条用
`verify-links.mjs` 真浏览器验活，**只收 OK**：

- **6 个唯一可点链接**（evidence 表 5 个 + trend 二次来源 1 个）：
  - AASLD 官方指南页（2018 版 + 2021 更新，hub，PDF 在页内下载）
  - EASL 官方指南页（2017，hub；全文需 MyEASL 账号，note 写清）
  - 中华医学会肝病学分会《原发性胆汁性胆管炎的诊断和治疗指南（2021）》期刊全文页（kind: fulltext）
  - 国家卫生健康委员会《原发性胆汁性胆管炎诊疗指南（2025年版）》期刊全文页（kind: fulltext）
  - NCI CTEP 的 CTCAE 文档页（HTML，hub；PDF/XLSX 页内下载）
  - ClinicalTrials.gov 的 PBC 检索页（trend 段二次核验入口，明确「本轮 ctv 未查、不计入 479 条」）
- **NICE 仍 nolink + note**：NICE 官网 BNF / CKS / TA 对本机 IP 返回 403（地区限制），`verify-links` 判 AUTH，
  按规则不计可达；也未检索到 PBC 专属 NG/CG。没有编 URL，也没有拿栏目首页冒充原件。
- 口径修正：`definition` 不再写「指南原文未取得」；`landscape` 明确「本轮只接入指南可点入口，未按原文整理」；
  `trend` 增加 2026-10-27 的接入事实与 ClinicalTrials.gov 二次核验入口。
- 闸门：`check-primer-links` 静态 24/24、`--http --timeout 60000` 30/30、`--self-test` 10/10；
  probe 原型 10/10、`public/` 10/10；`npm run check` 退出 0。

## 0.2.8 — 2026-10-27（36 号 v2 引入：疾病概要 + 状态卡）

按批次 2「从零引入」把 36 号疾病概要接到本仓：原型 `prototypes/v0.2/` 新增 `primer.js` / `primer.css` /
`primer-data.js` 三件套，顶栏加「?」入口，看板首卡补状态卡四件；`public/` 由 `build-public.mjs`
逐字节复制 primer 三件套，装机 iframe 层与原型同源。

- 浮窗四段固定 `definition → evidence → landscape → trend`；内容只取 README、`docs/SPEC.md`、
  `docs/BRIEF.md`、`docs/CLINICAL-DATA-2026.md`、`docs/GUIDELINE-BRIDGE.md`、`assets/reference/ctcae/README.md`，
  不写判定、不复制指南条文。
- 链接：**0 条外链**，11 项来源/原件全部 `nolink:true` + note。原因如实写进数据：
  - CTCAE v5.0 Quick Reference：仓库内已有 PDF；官方 `dctd.cancer.gov/.../ctcae-v5-5x7.pdf`
    实测 `application/pdf`，但批次 `verify-links.mjs` 对 PDF 判 `THIN`，按规则不计可达；
  - 中华医学会肝病学分会 PBC 指南（2021）：本仓无原件，存在性未核实（GUIDELINE-BRIDGE 四问筛不通过）。
- 状态卡：eyebrow `D+N 状态卡 · 距参考复查节点`、大字天数由 `startedAt` 派生（无锚点显示「待初始化」+
  三步引导）、现状行、出口按钮排（主按钮进复查节奏，副按钮打开疾病概要）。
- 闸门：新增 `scripts/check-primer-links.mjs`（含 `--self-test` 10/10）并接入 `npm run check`；
  新增 `scripts/probe-disease-primer.mjs`（P1–P9 + E0，只放行静态服务下 `/api/.../bootstrap` 404）。
- 实测：原型 probe **10/10**、`public/` 静态页 probe **10/10**、`npm run check` 退出 0（114 test 全绿）。

## 0.1.0 — 2026-10-25

- 由社区脚手架 dsh-wb-cli@1.5.4 初始化，仅有注册骨架与健康接口，无业务功能。
- **接线前置修复**：`cordis.patch.yml` 补 `config.root: !!js dshHomePath('pbc')`；`dsh/index.js` 声明 `Config.root`
  （只补一边会被 `check-workbench-package` ⑤ 判为"注入但未声明"，装机后重启回内存库）。

## 0.2.7 — 2026-10-25（临床试验屏按 biliary-tract-workbench 的 demo 效果重做）

用户指定的参考件：`biliary-tract-workbench/prototypes/v0.2/index.html`。照它的**结构**改，
但把它自己写的两句保证原样搬过来（未知项按 0 计、硬性不满足单列）。

- **新增「用来对照的病理特点」卡**：抗体 / 纤维化原文 / 最近 ALP / 总胆红素 / 血小板 / 年龄性别，
  每项带**来源与日期**；缺的写「未记录」，并明说「缺的项不是不符合，只会让条目落进待确认」。
- **试验卡改成 biliary 的形态**：右上「粗筛符合度 N%」大字 + 四档
  `高度符合 / 部分符合 / 需补充信息 / 硬性条件不满足`；下方三档 pill；
  ✓ / ✕ / ? 逐条条件（前 4 条展开，其余折叠），每条带「记录里是…… · 来源……」。
- **硬性条件不满足单列**：折叠在「硬性条件不满足的 N 条」里，不混进可对照列表。
- 引擎：`matchTrial` 增 `pct / band / bandLabel / hardUnmet / hardUnmetRules`；
  `pct = 符合 ÷ 全部条件`（未知项按 0 计，故只会偏低）；`criteriaOf` 给「排除已确诊患者」
  与「病种一致」标 `hard: 1`。
- **口径变更（重要）**：0.2.6 及以前本仓与 PF-ILD 一样"不给百分比"。本轮按用户指定参考件改为
  「粗筛符合度」，**同时改了测试**：`test/trial-tier.test.mjs` ⑫ 不再断言"没有数字"，
  改断言「未知项按 0 计 → 1 符合/2 总数 = 50%」；仍然禁止 `suitability`/`eligible` 一类
  会被读成资格判定的字段名。新增 ⑫b 硬性单列但三档计数不变的用例。
- 校验：`npm run check` **114 test 全绿**、`audit` 37/37、`probe-prototype.py` 与 `probe-dev.py` 双绿。

## 0.2.6 — 2026-10-25（用户真机反馈三条：指标卡分组/翻面、一图秀选指标、试验匹配）

### ① 指标卡：按系列分组 + 有序 + 3D 翻面

之前 11 张卡平铺一排，顺序是化验单的印刷顺序，没有分组，翻面也没有任何提示（用户看不到"能翻"）。

- 新增 `METRIC_SERIES` 五组：胆汁淤积（ALP/GGT/TBil）· 肝细胞损伤（ALT/AST）·
  合成与储备（ALB/PLT）· 血象（Hb/WBC/ANC）· 肾功能（Cr）。**组内顺序按临床关注度，
  不按化验单印刷顺序**；单子上没有的指标不出空卡（缺值不伪造）。
- 每组有标题 + 一句"这一组在回答什么" + 项数；未归入任何系列的指标进「其他项」，
  不猜它属于哪条线。
- 卡片正面右下角加「翻面看全期 ▸」提示；`role="button"` + `tabindex="0"` + `:focus-visible`，
  键盘可达。背面走 `preserve-3d` + `rotateY(180deg)`，`transition .48s` 实测非零。
- 三条不变量写进代码注释：系列间**不加总、不换算**（27 号 §1）；组内顺序来自常量；
  缺值不出空卡。

### ② 一图秀：指标选择窗口

- 新增 `CHART_COLORS`（11 个指标各自固定一色）+ chip 选择器：**换个勾选不会让 ALP 变颜色**
  （否则用户会以为看的是另一条线）。
- 可选指标 = 这份档案里真的出现过的（不列空指标）；默认 ALP/GGT/TBil；最多同时 5 条，
  chip 上有色点、`aria-pressed`、`role="group"`；有「回到默认三条」。
- 选择存在 `state.chartCodes`，切页签再回来不丢。

### ③ 临床试验：建档 → 检索 → 分层线索（starter 35 号契约）

之前试验页只是个"关键词 + 演示 2 条"的静态列表，没有建档、没有匹配。

**先纠正一处：脚手架 35 号明确禁止数值化匹配指数**（"匹配度 87%"这类），理由是
"数值化会把『沾到几个词』伪装成『你符合条件』"。所以这里做的是**透明分层 + 证据链**：

- 新增 `dsh/match.js`：`buildDossier(profile)` + `matchTrials(profile)` + `readSnapshot()`。
  三层规则：**结构化命中**（建档实体出现在登记标题）→ **文本命中**（题材词重合，逐词给位置）
  → **宽口径命中**（只沾"肝病/罕见病"这类大词，显式标注并排最后）。
  层内按证据条数排，层间顺序固定；**同一条不跨层重复**。
- 建档只列 PBC 真有的三样：抗体谱（AMA/AMA-M2/ANA）、肝活检病理原文、生化（ALP×ULN、TBil）
  + 年龄，每个字段带**来源**（哪份报告）。**PBC 没有常规基因检测、也没有 IHC**，
  界面上明写这一句，不假装有分子分型。
- 「本地没建档的」逐条列出（入排条件原文 / ECOG / 既往 UDCA 疗程 / 合并用药），
  缺字段一律判**无法自动匹配**，绝不判"不适用"、绝不写"建议参加 / 适合你"。
- 健康受试者/生物等效性登记按标题原文标出来（"这条登记的对象不是你这类人"）——这是**原文证据**，
  不是替患者下结论。
- 数据源：本地快照 `research/pbc-cancer/pbc_cancer_trials_2026.sqlite`（479 条，随包发出），
  只读打开；快照缺失时如实说"未配置"，**不当成 0 条结果**。
- 路由 `GET /api/pbc-workbench/trials/match/:key`；`health.capabilities` 加 `trials`。
- 新增 `test/trial-match.test.mjs` 9 条：无数值化分数 / 层间顺序固定且不跨层 / 缺字段判
  "无法自动匹配"且结果行不出现"不适用" / 每条带来源+快照日期+"登记状态，未核实" /
  证据齐全 / **抗体全阴档案无结构化命中**（反向对照，自造档案）/ 建档不出现 PBC 没有的
  分子分型字段 / 快照缺失语义 / 健康受试者标注。
- `probe-dev.py` 新增 **A12**（系列头 ≥3、卡片 ≥5、翻面真的加上 `flipped` 且过渡非零、
  chips ≥4、勾选后线条数增加）与 **A13**（跑匹配后出现分层与三态声明，且结果行无数值化匹配度）。

### 校验

`npm run check` **96 test 全绿**、`probe-prototype.py` 与 `probe-dev.py` 双绿、`npm run audit` 0 fail。

## 0.2.6 — 2026-10-25（指标卡有序/分系列/翻面、一图秀选择窗口、临床试验入排三档）

用户真机看过后提的三条，逐条落成可复跑的判据。

- **指标卡**：组内加序号（①②③…，让"有序"是看得见的）；背面从"一条迷你折线 + 一句话"
  改成**逐点明细**（日期 / 值 / 该点的 ×ULN 或「无上限」），最多列最近 4 点。
  系列分组与组内顺序本来就有（`METRIC_SERIES`），这次把它显式化到卡面上。
- **一图秀**：指标选择从"卡片里一排 chip"改成**弹窗**（`[data-modal="chart"]` 打开，
  Esc / × 关闭，选完自动重绘）。探针 A12 相应改为"先开窗再勾、Esc 关闭且真的关掉"。
- **临床试验 · 入排三档**（新增 `lib/trial-match.js` + `test/trial-tier.test.mjs` 17 条）：
  - **建档（可判定的事实）**：抗体三态（含「未检测」）、纤维化报告原文、最近一次 ALP/TBil/PLT/ALB、
    用药（含「未在用」）、年龄/性别、诊断与"本工作台只服务 PBC 患者"这一适用范围。
    **不设基因/IHC 面板**——PBC 不做靶点检测，硬加一张空表等于假装有这项能力。
  - **三档计数**：符合 / 冲突 / 待确认 + 每条规则的原文、本机记录、来源、`why`。
  - **没有百分比、不按档位排序**：排序即推荐；百分比会把"沾到几条"伪装成"你被录取的概率"。
  - **两条真实误判已修并写进测试**：①弹性成像「8.4 kPa」曾被当成「肝硬化」判"符合入选"
    （现在只有报告原文写了「肝硬化」才派生 `cirrhosis` 事实，否则落"待确认"）；
    ②「AMA 未检测」曾被当成"阴性"从而判"冲突"（现在落"待确认"——那是替患者下它没做过的结论）。
  - 入排条件原文本项目**未采集**（只抓到标题/登记号/状态），所以每条试验固定多一条"待确认"，
    页面逐条说明原因，避免把"三条待确认"读成"三条不符合"。
- 校验：`npm run check` **113 test 全绿**、`probe-prototype.py` 与 `probe-dev.py` 双绿。

## 0.2.5 — 2026-10-25（把"承诺了却没通路"的三处补成真功能）

同为评审 P1 的收尾。共同点是：**界面上有按钮、点了有反馈，但反馈是假的，或者点了只是换个页签**。

- **P1-3 筛查结果写入**（用户可见：骨密度/甲状腺/胃镜/维生素/肝影像都能自己记了）。
  原型里每张筛查卡底部有个「⋯ 更多」按钮，点击只弹 `toast('⋯ 更多：手工补一条 / 改这一条 / 看原文')`——
  CRUD 双通道矩阵承诺了 10 个实体的手工通道，实现只有这一个 toast。改为卡内真表单
  （`<details class="add-form">` 默认收起，不占视线）+ `POST /screening`：
  `dsh/writes.js` 加 `addScreeningRecord()`（`result_text` 存报告原文，不解析；
  `section_key` 只认五个已知值；分节行缺了就按 `lib/screening-titles.js` 补一行，标题只一个来源）、
  `Workbench.addScreening()`、路由、`health.capabilities` 加 `screening`。
  新增 `test/symptom-write.test.mjs` ⑧⑨ 两条（原文逐字保留 / 分节标题落库 / 坏输入 400 不落地），
  `probe-dev.py` 新增 **A11**（展开表单 → 填 → 保存 → 筛查条数必须 +1，实测 5→6）。
- **P1-2 看板两张卡没有可点的东西**（用户可见：看板上每个数字都能点进去看来源）。
  「接下来」卡只有一行静态文字，「最近变化」卡只有两个数字，患者看完不知道该去哪。
  加 `data-goto`：`followup/cadence`（复查节奏怎么算的）、`labs/chart`（看上次化验的趋势）、
  `symptoms/log`（看全部感受记录）。
- 顺带：「最近变化」卡里的感受也改掉了裸插值，`null` 显示成「痒 未记 / 累 未记」（与记录页同口径）。
- 校验：`npm run check` **87 test 全绿**、`probe-prototype.py` 与 `probe-dev.py` 双绿、`audit` 0 fail。

## 0.2.4 — 2026-10-25（M2 独立评审翻案：修 3 条 P0）

这一版**没有新功能**，全部是被独立评审推翻后补的。三条 P0 的共同点是"文档立了红线、代码没做到、
测试还给了绿灯"，所以每条都同时修了代码与测试。

- **P0-1 私密记录漏进导出**（用户可见：导出文件里不再出现标了私密的内容）。
  `dsh/export.js` 的 `renderPrepMarkdown` 之前只按时间窗过滤，没有 `visibility` 条件；
  `routes.js` 与 `workbench.js` 还都传 `includePrivate:true`。于是症状备注与换线医生原话被原样写进
  带出去的文件，而文件末尾印着"本文件不包含"。修法：过滤移进渲染器内部（`shared()`），
  **删掉 `excludedPrivate` 选项**——调用方传什么都不影响；同时补 `dsh/readmodels.js` 的
  `regimenChanges.visibility` 透传（之前两个出口各以为自己过滤过）。
  新增 `test/export-private.test.mjs` 4 条（真库真端口，正向反向双断言），反向对照验证过"去掉过滤就红"。
- **P0-2 判读词进了唯一数据源**（用户可见：导出文件标题不再带"部分应答"）。
  演示档案名 `档案 A · 部分应答` 经读模型直出界面、并成为患者交给医生的文件首行；
  改为 `档案 A · 随访中`。`check-wording.mjs` 的 `response-verdict` 规则去掉谓语前缀要求
  （裸 label 之前永远逃检），新增句内否定放行以免误伤免责句。
- **P0-3 闭环缺"记录"半环**（用户可见：记一次痒真的存下来了，刷新不丢）。
  之前前端只有 1 个 `fetch(/bootstrap)`、后端 5 个路由全 GET、`workbench` 没有写入方法，
  "保存"只写内存 + toast 自承"不落库"。新增 `dsh/writes.js` → `Workbench.addSymptom/removeSymptom`
  → `POST /symptoms`（201）/ `DELETE /symptoms/:id` → 前端真写库并 `reloadProfile()` 重取。
  日期用 `todayIso()` 取本机今天（不用 `toISOString()`，UTC 在东八区会退一天）。
  health `capabilities` 加 `symptoms`。新增 `test/symptom-write.test.mjs` 7 条，
  `probe-dev.py` 新增 A10（点保存后 bootstrap 症状条数必须 +1，实测 7→8）。
- **顺带修掉的两个显示层 bug**：①记录页 `痒 null/10 · 睡被打断 null 次` → 改为「痒 未记 / 累 未记」
  （0 分与没记在复诊回顾里是两件事）；②`build-public.mjs` 的定点替换静默空转导致
  `todayIso is not defined` 整页白屏 → 加 11 条产物指纹断言 + 3 条"不许带进开发版"的反向断言。
- 文档：`ACCEPTANCE.md` 把 ACC-02 的"私密不进导出"从"通过"改成如实记录（这是全仓唯一一处
  把被证伪项写成通过），并新增限制段第 5、6 条写明三处翻案；`METRIC-GRADING.md` 纠正
  `dsh/ctcae.js` 不存在、GGT 并未启用；`SPEC.md`/`SCENARIOS.md` 的一级/二级数量笔误（10/32、33 → 9/30）；
  `DEV-REQUIREMENTS` 新增 §七 追补 7 条（30–36），每条带评审原话与验收命令；
- **装机与截图（同版）**：`release/ductpal-dsh-pbc-workbench-0.2.4.tgz`（50 files，
  sha256 `7c5d18da8fb727087a95d3ea2a45873ab9ba74612a89eee3db3c7933ba53e241`）已装进
  `~/.dsh/profiles/desktop`（`devDependencies` + `dsh.profile.bundles` 双登记，`--offline` 安装），
  副本与 tgz `diff -rq` 逐文件一致。装机副本探针全绿：`health.version=0.2.4`、`POST /symptoms` 201、
  症状条数 7→8、`itch=99` 回 400 带 `field`、导出 200。
  README 的 7 张截图改为截**跑起来的开发版**（之前截的是 `file://` 原型，图里版本 chip 是
  「v0.1.0 · 原型」与包版本不符＝虚报）；`shoot-readme.py` 加两道守卫：出现 `#source-banner`
  （＝演示数据）或版本 chip 不含包版本，直接退出 1，不出图。
  `DESIGN-REVIEW.md` 追加开发者逐条处理记录（未修的 P1 如实留待）。
- 校验：`npm run check` **85 test 全绿**、`node scripts/check-wording.mjs` 0 处越界、
  `probe-prototype.py` 与 `probe-dev.py` 双绿、`npm run audit` 无 fail。
- **仍未做（不许在验收里算通过）**：重启 Harness 后的真机走查（ACC-04 以后全部界面层）；
  MinerU 真实上传（无 Token）；P1-1/P1-2/P1-3/P1-8 四条真实缺口（G2 前需决定补实现还是降级文档）。

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
