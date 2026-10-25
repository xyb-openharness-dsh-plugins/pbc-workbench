# 强约束文档（DEV-REQUIREMENTS）· PBC v0.1 · 2026-10-25

> 体例照 `gastric-workbench/docs/DEV-REQUIREMENTS-2026-10-21.md`；本文件是阶段 0 交付物：
> **每一条都要能被某条命令或某张截图验证**，写不出验证方式的约束删掉。
> 状态：草案，待 G1 签认；签认时建 `docs/SIGNOFF-G1.md` 记录原话与日期。

## 一、范围（交付物 × 落点 × 怎么验）

| # | 交付物 | 落点 | 怎么验 |
| --- | --- | --- | --- |
| R1 | HTML 原型（9 一级 / 30 二级） | `prototypes/v0.2/` 四件套 | `file://` 直接打开；`(view, sub)` 穷举无孤儿页 |
| R2 | 演示数据（2 档案 × 6 个月窗） | `demo/build-demo-data.mjs` 唯一源 | 重跑 diff 为空；同时产出 sqlite 与 `demo-data.js` |
| R3 | schema 0001 + 冻结合同 | `schema/0001_initial.sql` + `schema/freeze-contract.md` | sha256 一致；无判读列断言 |
| R4 | PBC 临床试验采集 | `research/pbc-cancer/` + `docs/CLINICAL-DATA-2026.md` | manifest 条数 = jsonl 行数 = sqlite 行数 |
| R5 | CTCAE 对照层 | `assets/reference/ctcae/` + `dsh/ctcae.js` | 缺上限 → `needsUln`；整除边界两点单测 |
| R6 | 独立评审 | `docs/DESIGN-REVIEW.md` | 13 项逐条 PASS/FAIL/WARN，P0 修复留痕 |
| R7 | 检查链 | `npm run check` | 退出码 0 + `npm run audit` 无 fail |

## 二、照抄样板的产品要求（不许按比例缩减）

- **顶栏三段式**：左=品牌+版本 chip，中=一句状态说明，右=主操作按钮组；AI 五态按钮
  （`AI 对话 / 正在连接… / 收起 AI 对话 / 打开 AI 对话 / AI 对话暂不可用`）+ 独立「×」；面板内不放第二组开合控件。
- **AI 面板默认在右**：`businessWidth 0.65` / `AGENT_PANE.default 0.35` 互补，`assertPanelConfig()` 钉住；
  可拖（容器 rect 夹取、`role=separator`、键盘同精度、localStorage 读回过 clamp）；<760px 覆盖式抽屉 ≤420px，splitter 不出现。
- **一图秀**：单调三次插值（Fritsch–Carlson）、末点 13px 避让、分类序列只画节点不连线、治疗/事件带与数据区分层。
- **3D 卡**：整卡 180°、背面迷你折线、分类记录不翻不连线、固定高度 `preserve-3d`。
- **字号三档**：12.5px 基线 / 大字 15px；`calc(NNpx * var(--tz))`；SVG 文字不随档位。
- **页脚贴底**：`min-height:calc(100vh - 32px)` + `flex:1`；`[hidden]{display:none!important}`。
- **根节点首个子元素是语义 `<header>`**，避让 `--dsh-frame-leading-clearance`。

## 三、硬约束（四组，每条带错误来源）

### 3.1 数据层

1. 复合主键表裸 `SELECT` 必须 `ORDER BY rowid`；其余多行表按 `ord` 且不叠 `DESC`。
   （来源：gastric/attr 两轮，metrics 是 `(profile_key, key)` 复合主键）
2. 可选字段显式写 `null`；**「没记」≠「阴性」**，三态必须可区分。（来源：26 号 §5 家属线三态）
3. `using` 是 SQLite 保留字 → 列名 `in_use`。（来源：ZERO-TO-DEV §0.2）
4. 每节 `{title, rows}` 必须有对应 `*_title` 列。（来源：gastric 发布前漏列）
5. 化验记录必须有 `ref_low` / `ref_high`（可空）；写入校验**先挡 `null/undefined/''` 再 `Number()`**。
   （来源：`Number(null)===0` 把"没填上限"变成"上限 0"，家族三处踩过）
6. 影像/内镜按真实频率**不加密**；生化 3–6 个月一点延续到今天。
7. `events` 无 `ord`，按 `rowid` 升序。

### 3.2 前端

8. 图标 key 走别名兜底；内联 svg 必须给宽高。
9. 二级页签按 `state.sub` 分流且**穷举测试**（`(view, sub)` 全组合）。
10. 字号基线 12.5px、大字 15px；`[hidden]` 必须 `display:none!important`。
11. 分类序列不进数值趋势（`dec IS NULL` 且 `kind ∈ {grade,qual}`）。
12. `data-dev-only` / `<!--dev-only-->` 只用于"原型冻结、开发版先行"，WHITELIST 逐条写理由。

### 3.3 工程

13. 面板参数唯一来源 `lib/layout.js`，客户端不许出现第二个 `0.65` / `0.35`。
14. **apiBase 定稿契约（原文抄录，GBM 踩 4）**：`API_BASE = 挂载前缀（独立启动空串，宿主 /api/<slug>）`，
    页面统一拼 `${API_BASE}/api/xxx`；守卫**只禁交界重复**（`/(^|/)api$/`），
    **不许 `includes('/api')` 一刀切**——宿主前缀含 `/api` 是正常的；必须有**双形态回归测试**；
    启动期校验失败**渲染错误横幅，禁止裸 throw 白屏**。
15. 演示数据只有一个来源；`lib/version.js` 是生成物不手改；**改包必升版**（VERSION → package.json → public 字面量 → lib/version.js 同源）。
16. 迁移只增不改；所有 INSERT 写显式列名 + 显式问号数。
17. `public/` 与原型逐字符对齐，差异只允许 WHITELIST 内三类（字号三处 / `[hidden]` / dev-only）。

### 3.4 医学口径

18. **分级只用「对照」**：徽章写「对照 CTCAE v5.0 · N 级」，不写"偏高/偏低/严重"，不推断因果、不给处置。
19. **×ULN 型必须用这张化验单自带的 `ref_high`**，缺了返回 `needsUln`；**下限可以借，上限不能借**
    （ALT 各实验室 40–55 U/L，差 1.4 倍，一除就能把 2 级说成 1 级）。
20. **不接指南页码层**：中文指南原件未取得，界面不得出现任何指南页码/条款号；
    只有 CTCAE 阈值可引用，且带版本与来源 PDF。
21. **PBC 专属四条**：① 不计算 GLOBE / UK-PBC / 巴黎 / 巴塞罗那等应答评分，只在说明里写"由医生使用"；
    ② 不判断"应答/未应答"；③ 不解释瘙痒乏力的病因；④ 药名一律标「获批状态未核实」。
22. **提醒只来自用户自己的记录或日期**，不来自医学阈值。

## 四、本轮明确未做（不许在验收里算通过）

- 装机 V2/V3 真机走查（M6 才做）、市场投稿、`gh release`（M7）。
- **患者/家属访谈：0 位**；H1–H8 假设全部未验证，场景不得当已确认需求。
- **中文指南原件未取得** → G1/G2/G3 指南层**未做**（如实写，不用二手摘编凑页码）。
- **NMPA 批件核验未做**（站点 412 反爬）；所有药名标「获批状态未核实」。
- ChiCTR 离线语料（仅胰腺癌）→ PBC 只能走在线通道，离线写"未配置"。
- 照护者独立身份/权限、多账号、云同步。
- AI 自动写入事实层（AI 只产候选）。

## 五、我替你定的默认值（默认执行、可回退）

> 开工前一轮提问（服务主体 / 病程覆盖 / MinerU / 品牌占位名）**用户未作答**，按推荐项执行，逐条可回退。

| # | 默认值 | 理由 | 回退方式 |
| --- | --- | --- | --- |
| D1 | **服务主体=患者本人**；照护者可选但不设独立身份 | 本品核心是长期自我管理；双主体会把权限模型提前拉进 G1 范围 | 加 `caregiver` 角色表 + 代记徽章（M6 后） |
| D2 | **病程覆盖=全病程**（确诊→UDCA→应答观察→二线→肝硬化并发症→移植评估档案），只并列事实 | R2 形态本身要求"终身随访"；只做 5 年段会切断换线后场景 | 收敛为随访段，去掉 `treatment/换线记录` |
| D3 | **接入 MinerU**（六部件：设置页 Token / 本地密钥文件 / 显式同意 / 候选核对 / 表格竖线对齐 / 只抄写不判断） | 化验单照片是本品的核心入口（S12） | 只留手工补录，导入按钮禁用并说明 |
| D4 | **品牌占位=小管宝 DuctPal**；主色苔绿 `#5C6B3C` / 深墨 `#2B3320` / 纸色 `#F7F6EF` | 家族已用色避开（粉/绛莓红/青绿/紫等）；胆汁-苔绿语义相容 | 换三个品牌变量即可 |
| D5 | **设置走顶栏**，不占一级导航 | 基准 `UI-DESIGN.md:134` 明确"配置不该占用一级注意力" | 提升为一级（会变 10 一级） |
| D6 | **一图秀降为二级**（`labs/一图秀`） | PBC 指标同源，不值得占一级 | 提为一级（DIFF-MATRIX D1 需同步改） |
| D7 | **不接指南页码层**，只做 CTCAE 对照 | 原件未取得，虚构页码比不做更糟 | 取得原件后按 25 号补 G1–G3 |
| D8 | **9 一级 / 30 二级** | 家族区间 8–10 / 24–30；二级无 0 的线 | 见 DIFF-MATRIX §3 |

## 六、M6 追补（2026-10-25，装机轮实测，每条带错误来源）

> 这一节是 M9 回流的一部分：M6 装机时踩到的东西，凡是"下一个病种装机会再踩"的，都补进本文件，
> 不是只补进 LESSONS 让人靠记忆。

### 6.1 宿主接线面（dev 语境一条都罩不住）

23. **宿主"不拒绝"可能返回 `null`，鉴权判定必须用真值判。**
    来源：本仓 0.2.2 装机副本探针实测 —— 原实现 `if (rejection !== undefined) res.writeHead(rejection)`
    在宿主返回 `null` 时把 `null` 当状态码，进程抛
    `RangeError [ERR_HTTP_INVALID_STATUS_CODE]: Invalid status code: null`（`node:_http_server:358:11`），
    **整条服务链熄火而不是 500**。正确写法 `if (rejection)`。
    验收：`test/host-auth.test.mjs` ②③（`null` 与 `undefined` 都必须放行）。
24. **宿主没给 `connection.requestRejection` 时必须 503，不许"跳过鉴权继续放行"。**
    来源：同上探针 ① —— 宿主少给一个能力，本机资料就裸奔出去。原实现把这个分支写成"没有就跳过"，
    本地与 dev 都看不出问题（dev-server 根本不经过这段）。
    正确写法：503 + `{error:'AUTH_UNAVAILABLE', message:'宿主未提供鉴权能力…'}`。
    验收：`test/host-auth.test.mjs` ①（断言 503 且**业务 handler 一次都没被调用**）。
25. **鉴权逻辑要能单测，就得从插件入口拆出来。**
    来源：`dsh/index.js` 顶部 `import Schema from '@deepseek-ai/schemastery'`，单测环境没有那份 peer
    （`ERR_MODULE_NOT_FOUND: Cannot find package '@deepseek-ai/schemastery'`），逻辑留在里面就一条都测不了。
    落地：`dsh/auth.js` 导出 `createAuthorized({api, connection})`。
26. **`health.build` 必须从 `lib/version.js` 取，不能从 `package.json` 取。**
    来源：装机副本探针 ③ —— `package.json` 没有 build 字段，`health.build` 永远是 `null`，
    界面上构建日期空白，用户看不出装的是哪天的。
27. **装机目标 profile 是实测出来的，不是照着文档猜的。**
    来源：starter 06 号那条 2026-10-18 的结论（`~/Library/Application Support/dsh-desktop/harness/profiles/web`）
    在本机**不存在**；本机 Desktop app 进程行末是 `~/.dsh/profiles/desktop`。
    判定法：`ps aux | grep "DeepSeek Harness"` 看进程参数里那个路径；再 `lsof -nP -iTCP:<GUI 端口>` 交叉印证。
28. **联网 `pnpm install` 可能被无关的 git 依赖卡死，用 `--offline` 装本地 tgz。**
    来源：本机 `corepack pnpm install` 去 `git ls-remote https://github.com/molly-ovo/dsh-workbuddy-oauth.git`
    超时 75s（该依赖的 tarball 已在 lockfile 里钉住、`node_modules` 里也已存在）。
    落地：`NODE_OPTIONS= corepack pnpm install --offline --no-frozen-lockfile`。
29. **`install` 之后必须逐文件比 tgz 与安装副本。**
    来源：06 号第 7 类（同版号重打包 pnpm 不重链）。落地：`tar -xzf tgz -C /tmp/x && diff -rq /tmp/x/package <副本>`，
    输出必须为空；不为空就当失败，不往下跑探针。

## 七、M2 独立评审翻案追补（2026-10-25，每条带评审原话与验收）

> 独立评审（与开发不同上下文）推翻 3 条 P0。**这一节的价值在于：这三条都不是"没写文档"，
> 而是"文档立了红线、代码没做到、测试还给了绿灯"。** 所以每条都同时补了"代码"和"能红的测试"。

30. **"红线写在注释里"不等于"红线被执行"——过滤必须在渲染器内部，不能靠调用方传参。**
    来源：`dsh/export.js:4` 注释立了"私密分节不进导出"，但 `:187/:220` 只按时间窗过滤，
    没有任何 `visibility` 条件；`routes.js:157` 与 `workbench.js:79` 还都传了 `includePrivate: true`。
    实测（真库 + 真端口 + `GET /export/A.md`）：`LEAK symptom note in export: true`、
    `LEAK regimen text in export: true`，而同一份文件里印着"本人标记为私密的记录…本文件不包含"。
    落地：`renderPrepMarkdown` 内部 `const shared = (list) => list.filter((r) => r.visibility !== 'private')`，
    **删掉 `excludedPrivate` 选项**（是否写排除声明也由渲染器自己算）——调用方传什么都不影响。
    验收：`test/export-private.test.mjs` ①②③④（渲染器层 + HTTP 出口 + 落盘出口，正向反向双断言）。
31. **断言素材必须来自测试自己造的数据，不能取自演示数据——否则循环空转、断言恒真。**
    来源：`test/server.test.mjs:100-107` 的"私密不进导出"用 `full.symptoms.filter(s => s.visibility === 'private')`
    取素材，而 `demo/build-demo-data.mjs` 全文件没有一处 `'private'`（`grep -n private` 零命中）→
    `privNotes` 是空数组，循环体一次都没跑。同文件 `:80` `assert.ok(priv >= 0)` 也是恒真式。
    落地：新测试直接 `INSERT ... visibility='private'` 造数据，并在断言前先验"库层真的读到了私密行"
    （前提断言），再验"导出里没有它"；同时验"共享内容必须在"，防"全过滤"式假绿。
    验收：反向对照实跑过 —— 把 `shared()` 改成不过滤，四条红三条；恢复后全绿。
32. **判读词出现在**任何字段值**里都算越界，检查器不能要求谓语前缀。**
    来源：`demo/build-demo-data.mjs:82` `label: '档案 A · 部分应答'` 经 `readmodels:207` 直出界面、
    经 `export.js:109` 成为患者交给医生的文件首行（实测 `# 复诊准备 · 档案 A · 部分应答（虚构患者甲）`）；
    而 `check-wording.mjs:38` 的正则是 `/(你已经|你属于|判定为|应判为)\s*(完全应答|…)/`，
    裸 label 永远不匹配 → `npm run check` 报"0 处越界"是假绿。
    落地：规则改为 `/（完全应答|部分应答|应答不佳|未应答|…)/` + 句内否定放行
    （`NEGATION_WIDE`：整行前半段出现"不判/不写/不构成/不要"等才放行，防误伤免责句）。
    验收：反向对照 —— 把 label 改回「部分应答」，检查器立刻报 `demo/build-demo-data.mjs:85 [response-verdict]`。
33. **"能读"不等于"能记"——闭环的写入半环必须有真路由、真落盘、真测试。**
    来源：评审实测 `public/app.js` 全文只有 1 个 `fetch(`（`:31` `/bootstrap`），无任何 POST/PUT/DELETE；
    `dsh/routes.js` 五个路由一律 `if (req.method !== 'GET') …405`；`dsh/workbench.js` 只有 5 个方法、
    没有症状写入；前端保存把日期写死 `'2026-10-25'` 塞进 `state.localSymptoms`，
    然后 `toast('已记下这一次（演示：仅本页内存，不落库）')`。患者记一次痒刷新即丢。
    落地：`dsh/writes.js`（`ValidationError` + `addSymptomLog` + `removeSymptomLog` + `assertIsoDate`）
    → `Workbench.addSymptom/removeSymptom` → `POST /api/pbc-workbench/symptoms`（201）
    / `DELETE /symptoms/:id`（200/404）→ `createHandler` 与 `dsh/index.js` 的 source 代理都接上
    → 前端改 `await fetch(apiUrl('/symptoms'))` 并 `reloadProfile()` 重取。
    验收：`test/symptom-write.test.mjs` 7 条 + `probe-dev.py` A10（点保存后 bootstrap 症状条数必须 +1，
    实测 `{"before": 7, "after": 8}`）。
34. **"没记"必须显示成"未记"，不能直接插值 `null`。**
    来源：补了写入通路之后，探针发现记录页出现「痒 null/10 · 累 null/3 · 睡被打断 null 次」——
    原型 `app.js:548` 直接 `${s.itch}` 插值。`0 分` 与 `没记` 在复诊回顾里是两件事。
    落地：原型改为 `s.itch == null ? '痒 未记' : …`（原型是视觉基准，改原型后开发版自动同步）。
35. **定点替换不命中是静默空转——必须在产物层验指纹，不能只验"产物≠原文"。**
    来源：`scripts/build-public.mjs` 把 `todayIso` 插到 `const esc = …` 处，锚点写成 `function esc(s) {`
    （实际是 `const esc = (s) =>`）→ 替换静默不生效，`public/app.js` 里 `todayIso is not defined`，
    整页白屏；而"产物≠原文"那条断言照样通过（因为别的替换命中了）。
    第二次修的时候又把 `esc` 的定义整段吃掉，运行时 `esc is not defined`。
    落地：`FINGERPRINTS` 11 条（每处替换必须在产物里留下可 grep 的痕迹）+ `FORBIDDEN` 3 条
    （自建聊天框模拟回复 / 内存假保存 / 写死的今天，出现即构建失败）。
    验收：反向对照 —— 故意把锚点改回错的，构建立刻报
    `public/app.js 缺少这些替换痕迹：本机今天、保存后重取档案——原型锚点变了`。
36. **往 `public/app.js` 插函数要挑位置：常量块边界是"到下一个 `\n  }`"，插一个带 `}` 的函数会推后边界。**
    来源：把 `todayIso/reloadProfile` 插在 `const esc` 之前，`test/ui-parity.test.mjs` 的 `block()` 取
    `LABELS` 常量块时把新函数也圈进去 → "常量块 LABELS 与原型不一致"。
    落地：改插在 `/* ------ 启动 ------ */` 标记之前（函数声明会提升，位置不影响语义）。
    验收：`test/ui-parity.test.mjs` ③ 恢复绿；新增函数必须在 `EXTRA_ALLOWED` 里登记并写清属于哪一类。
