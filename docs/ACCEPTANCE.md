# 验收记录

代码版本/commit/dirty 状态：`0.2.3` / `1f64453` + 本轮未提交的文档改动（CHANGELOG、RELEASE、ACCEPTANCE）。
包名称/版本/tgz/SHA-256：`@ductpal-dsh/pbc-workbench` · `0.2.3` ·
`release/ductpal-dsh-pbc-workbench-0.2.3.tgz` · `1e8e6dbbbe4bd6dfbcabc64c7ff43ae7dd31a38a680889d6beb21ef1e0af7060`。
Desktop 版本/OS/架构/Node：DSH Desktop `0.2.1-rc.3` / macOS `26.0` / `arm64` / Node `v22.19.0`。
安装入口/实际 profile/执行位置：本地 tgz（`file:` 依赖）+ `dsh.profile.bundles` 双登记 /
`~/.dsh/profiles/desktop`（**实测进程行末即该路径，Web GUI 端口 56166**）/ 本机 `default-workspace` 会话内。
Agent 是否运行在目标 Desktop 内：**是** —— 本会话就跑在该 Desktop 的 `desktop` profile 上（端口 56166）。

**一句话状态**：静态层与包层已实测通过；**界面层（ACC-04 以后）未做**，因为需要重启 Harness 才能加载新包，
Agent 不自行重启宿主。按 06 号"三层验收"口径，现在只到"配置层 + 包层"，不能写"装机通过"。

| ID | 层级 | 操作和预期 | 真实结果 | 证据文件/命令 | 通过/失败/未验证/不适用 |
| --- | --- | --- | --- | --- | --- |
| ACC-00 | 静态 | `dsh-wb-cli audit` 无 fail；warn 逐条给结论 | **37/37 通过 · 0 失败 · 0 待人工** | `npm run audit` | 通过 |
| ACC-01 | 静态 | 语法/类型/包合同/清单 | 退出 0：版本 7 处一致、语法 50 文件、schema 24 表 0 判读列、医疗表述 29 文件 0 越界、演示库同构、74 test 全绿、宿主注册契约符合、`staticPass:true` | `npm run check` | 通过 |
| ACC-02 | 集成 | 代表业务链与迁移/主体隔离 | bootstrap 七键、两档案 21 键与 demo-data 逐字段 deepStrictEqual、迁移幂等、就诊准备导出十段、私密不进导出 | `npm run test`（demo-parity / store / server 26 条） | 通过 |
| ACC-03 | 包 | 从实际 tgz 安装，版本/hash 一致 | tgz 49 files；副本与 tgz `diff -rq` **逐文件一致**；`lib/version.js` = 0.2.3 | `npm pack` + `diff -rq` + `check-install.mjs --home ~/.dsh --profile desktop` | 通过 |
| ACC-04 | UI | 已安装列表→左侧入口→业务页 | **未做**：需重启 Harness 加载新包 | 重启后：市场切「已安装」核对条目 → 左侧固定入口打开 | 未验证 |
| ACC-05 | UI | 无会话可用，所选布局和原生会话 | **未做**：重启后第一动作是左侧新建会话，再回工作台看连接状态 | — | 未验证 |
| ACC-06 | UI | 一级/二级页与配置弹窗逐项对照 | 开发版已用真机 Chrome 验过 9 一级 / 30 二级无空视图（`probe-dev.py`）；宿主容器内未验 | `python3 scripts/probe-dev.py` | 部分（dev 容器通过，宿主容器未验证） |
| ACC-07 | UI | 窄容器/大字/翻面/趋势/键盘 | dev 三档宽度 1280/1024/760 溢出均为 0；折叠卡 3 张默认收起展开 15 块；趋势图 path 3 条；翻面卡可用；splitter 键位与拖动有单测与探针 | `probe-dev.py` + `probe-prototype.py` | 部分（同上） |
| ACC-08 | 跨页 | 单一事实新增后各页一致 | 读模型单一来源：`bootstrap` 与 `demo-data.js` 逐字段相等；`lab_items.lab_name` 逐条优先于面板级 | `test/demo-parity.test.mjs` | 通过 |
| ACC-09 | 文件 | 预览/解析/确认/导出真实格式/回顾 | 导入链路端到端实跑：落原件（sha256 命名、600）→ 解析 3 候选 → 接受 → `commitPanel` 落 13 项；失败路径 document 置 `failed` 且候选 0 条、`parse_jobs` 新增 failed 行、旧 success 行保留 | `.tmp/t-import.mjs` 实跑输出 | 通过（MinerU 真请求需 Token，未接网络实测） |
| ACC-10 | 外部 | API/MCP/cron 实际链路与失败恢复 | 试验库实跑：479 条 / 2 通道真查过 / 4 通道如实 `unconfigured` / ictrp 截断落 `truncated`；manifest=jsonl=sqlite 条数硬断言 | `node scripts/fetch-pbc-trials-2026.mjs` | 通过（MinerU 上传未接网络） |

附官方规范第 8 节每条适用项的责任、证据与结果，不适用写理由。只跑静态不能把 ACC-04 以后勾通过。
限制/失败/需要用户完成的重启步骤：...

## 设计与混合数据补充

| ID | 操作与预期 | 结果/证据 | 状态 |
| --- | --- | --- | --- |
| ACC-11 | UI 确认版本与实际实现对应；关键流程、容器尺寸、异常状态有预览 | | 未验证 |
| ACC-12 | 重启恢复记录；首页/详情/导出/Agent 快照一致 | | 未验证 |
| ACC-13 | 纠正/删除后旧摘要和缓存失效，主体与工作区隔离 | | 未验证 |
| ACC-14 | 可选记忆服务离线/同步失败仍能操作业务；恢复后幂等追平 | | 未验证 |
| ACC-15 | 资料目录/会话双状态独立；无会话、目录故障、owner异常、映射未保存均不显示假绿灯 | | 未验证 |
| ACC-16 | 快速切换丢弃旧状态，重启重新核验；窄面板/大字下状态可读且不遮公共入口 | | 未验证 |
| ACC-17 | 主任务常显、辅助配置可展开、💡教学可发现；错误不隐藏，关闭/展开不丢输入 | | 未验证 |
| ACC-18 | 外部字段来源/时效/适用性可追溯；获取失败、过期、冲突不被展示或导出为确定事实 | | 未验证 |

| ACC-19 | 长列表滚到中段/底部后标题与关闭仍可见，工具/提交按需固定；窄窗/大字可操作、选择保留、可从底部关闭并恢复焦点 | | 未验证 |

## 限制/失败/需要用户完成的重启步骤

1. **需要用户做的事**：完全退出 DSH Desktop 再重开（菜单 **Harness → 重启 Harness** 亦可），
   否则加载的仍是旧包。重启后**先在左侧新建一个会话**，再打开工作台 —— 新装工作台未建会话时，
   宿主 connection 鉴权闸会拒页面请求（表现为"离线演示数据"），这是宿主状态不是缺陷（06 号文档"第 6 类"）。
2. **本次未验的**：ACC-04 以后的界面层全部未验；MinerU 真实上传未接网络跑（无 Token）；
   Windows / Linux 未验（只在本机 macOS arm64 验过）。
3. **已知会看到的现象**：`check-install.mjs` 报"无市场安装记录，属手工/native 安装" —— 本包走 `file:` 依赖
   手工装，市场里不会显示「已安装」，也不支持 app 内卸载。这是如实状态，不是错误。
4. **`ACC-06/07` 标"部分"的理由**：`probe-dev.py` 打的是 dev-server（页面挂根），宿主里页面挂在
   `/api/pbc-workbench/ui/`，静态前缀剥错会"页面能开、脚本全 404"。这一点已在装机副本上用
   `/tmp/mount-probe.mjs`（`MOUNT='/w/abc'` 剥前缀转交同一份 handler）验过四个静态资源全 200，
   但仍不等于宿主真实容器内验过。

未启用可选记忆时相关项标不适用并说明。UI 确认属于设计验收，不替代实际 Desktop 加载与业务验收。

| ACC-20 | 设置入口可达、目录状态真实、取消无副作用、换目录保护旧资料 | | 未验证 |
| ACC-21 | 凭据无明文回显；云端按文件授权；本地降级和错误恢复 | | 未验证 |
| ACC-22 | 临床数据包与患者目录区分，地区/版本/核验状态可见 | | 未验证 |
| ACC-23 | 设置草稿保存/取消/失败保持正确，窄窗/键盘可达 | | 未验证 |

## 发布范围（仅执行用户明确授权的动作）

| ID | 操作与预期 | 结果/证据 | 状态 |
| --- | --- | --- | --- |
| ACC-24 | 记录本机安装 / Git 推送 / GitHub Release / 市场PR分别完成到哪一步；未授权项为不适用 | | 未验证 |
| ACC-25 | 市场安装来源与条目一致；Release只有在YAML显式tarball时才是所选来源，否则按目录协议使用源码或npm | | 未验证 |
| ACC-26 | 包版本、客户端版本、实际安装副本、tar hash一致；Desktop运行界面加载单独确认 | 包 0.2.3 = 客户端常量 0.2.3 = 安装副本 0.2.3 = `lib/version.js` 0.2.3，tgz sha256 `1e8e6dbb…`，副本与 tgz 逐文件一致；**界面加载未确认** | 部分（界面层未验） |
| ACC-27 | 真实市场PR URL、最新检查、合并状态、目录可见和市场可安装分别记录；不得把PR提交称为已上架 | | 未验证 |

## DSH 原生 Agent 对话

| ID | 操作与预期 | 结果/证据 | 状态 |
| --- | --- | --- | --- |
| ACC-28 | 全局顶栏 AI 对话入口可发现；状态文案与宿主真实连接状态一致；首次显式点击只创建/复用一个归属正确的原生会话 | | 未验证 |
| ACC-29 | 隐藏原生面板后可从顶栏重新打开同一会话；页面筛选、表单、滚动位置和原生草稿保留；隐藏不等于结束会话 | | 未验证 |
| ACC-30 | 面板宽度按当前宿主形态调整；CustomFrame 鼠标/触控/键盘均可调且受边界约束，split 只使用宿主布局合同；未支持时明确记录限制，不显示假控制 | `lib/layout.js` 单一来源（`businessSide:'left'`/`businessWidth:0.65`/`AGENT_PANE 0.35，25%–45%`）；`src/client.js` 有 splitter 拖动 + ←/→/Home/End + `role=separator`；`check-host-contract.mjs` 报 `customFrame=true`。**宿主容器内未验** | 部分（静态+源码通过，宿主未验） |
| ACC-31 | 面板开合、调宽、窄窗及重启恢复偏好符合 SPEC；焦点、键盘可达性与主业务区可操作性通过实际验收 | 宽度偏好存 localStorage（`ductpal.pbc.agent-pane.v1`）；窄容器由 `ResizeObserver` 观测容器宽度切抽屉（≤760px，抽屉 ≤420px）；dev 探针三档溢出 0。**重启恢复与宿主焦点未验** | 部分 |
