# PBC 工作台 · PubMed 文献取证（主题级命中清单）

- **采集日期（UTC）**：`2026-10-25T03:16:07Z`
- **检索工具**：NCBI E-utilities — `esearch.fcgi`（取 ID 列表，`retmax=8`）+ `esummary.fcgi`（取元数据），`retmode=json`
- **排序**：`esearch` 追加 `sort=relevance`。默认排序为“最新”，实测会把命中带偏到 HBV/MASLD 等相邻领域，故统一改为相关度排序；`count` 为不加 `retmax` 限制时的全库命中总数。

> **证据等级声明**：本文件记录的是**检索命中（search hits）**，**不是指南原件**，也**未做全文核读**。
> 每一条的 PMID / 年份 / 期刊 / 标题 / 类型均直接来自 NCBI `esummary` 返回字段（标题仅去掉句末句号，`pubtype` 中逐条重复的 `Journal Article` 已省略），未做任何人工改写或补充。
> 筛选只发生在**标题 + 出版物类型**层面（优先 Practice Guideline / Consensus Statement / Review / Meta-Analysis / 大样本研究）。
> **因此本文件不能用于任何页码级、条款级的临床断言引用。**

## 命中汇总

| 主题 | 检索命中总数 | 本文件摘录条数 |
| --- | --- | --- |
| T1 | 956 | 3 |
| T2 | 8 | 3 |
| T3 | 19 | 3 |
| T4 | 300 | 4 |
| T5 | 38 | 3 |
| T6 | 766 | 5 |
| T7 | 12 | 3 |
| T8 | 17 | 3 |
| T9 | 65 | 3 |
| T10 | 95 | 3 |

## T1 诊断与 AMA / ALP 阈值

检索式：`primary biliary cholangitis diagnosis antimitochondrial antibody`　（命中 956 条，相关度排序，自前 8 条命中中取 3 条）

| PMID | 年份 | 期刊 | 标题 | 类型 |
| --- | --- | --- | --- | --- |
| 29593060 | 2018 | Gut | The British Society of Gastroenterology/UK-PBC primary biliary cholangitis treatment and management guidelines | Practice Guideline, Research Support, Non-U.S. Gov't |
| 36270719 | 2022 | Clin Liver Dis | Autoantibodies in Primary Biliary Cholangitis | Review |
| 33264835 | 2021 | Clin Mol Hepatol | Current understanding of primary biliary cholangitis | Review |

## T2 UDCA 剂量与生化应答判定（Paris II / Barcelona / GLOBE / UK-PBC）

检索式：`UK-PBC GLOBE score ursodeoxycholic acid response primary biliary cholangitis validation`　（命中 8 条，相关度排序，自前 8 条命中中取 3 条）

| PMID | 年份 | 期刊 | 标题 | 类型 |
| --- | --- | --- | --- | --- |
| 31241547 | 2019 | Am J Gastroenterol | Validation of Risk Scoring Systems in Ursodeoxycholic Acid-Treated Patients With Primary Biliary Cholangitis | Multicenter Study, Validation Study |
| 39124763 | 2024 | J Clin Med | The External Validation of GLOBE and UK-PBC Risk Scores for Predicting Ursodeoxycholic Acid Treatment Response in a Large U.S. Cohort of Primary Biliary Cholangitis Patients | Journal Article |
| 36593158 | 2023 | Dig Liver Dis | Treatment response to ursodeoxycholic acid in primary biliary cholangitis: A systematic review and meta-analysis | Meta-Analysis, Systematic Review |

## T3 二线治疗：奥贝胆酸与贝特类

检索式：`obeticholic acid bezafibrate fibrates second-line primary biliary cholangitis`　（命中 19 条，相关度排序，自前 8 条命中中取 3 条）

| PMID | 年份 | 期刊 | 标题 | 类型 |
| --- | --- | --- | --- | --- |
| 39707635 | 2025 | Hepatology | Primary biliary cholangitis: Personalizing second-line therapies | Review |
| 39720853 | 2025 | Liver Int | Second-Line Treatment for Patients With Primary Biliary Cholangitis: A Systematic Review With Network Meta-Analysis | Systematic Review, Network Meta-Analysis |
| 35961518 | 2023 | Clin Gastroenterol Hepatol | UK-Wide Multicenter Evaluation of Second-line Therapies in Primary Biliary Cholangitis | Observational Study, Multicenter Study, Research Support, Non-U.S. Gov't |

## T4 肝硬化并发症筛查与 HCC 监测

检索式：`primary biliary cholangitis hepatocellular carcinoma incidence risk`　（命中 300 条，相关度排序，自前 8 条命中中取 3 条）

| PMID | 年份 | 期刊 | 标题 | 类型 |
| --- | --- | --- | --- | --- |
| 32743773 | 2021 | Dig Dis Sci | Incidence of Hepatocellular Carcinoma in Primary Biliary Cholangitis: A Systematic Review and Meta-Analysis | Meta-Analysis, Research Support, U.S. Gov't, Non-P.H.S., Systematic Review |
| 36270724 | 2022 | Clin Liver Dis | Hepatocellular Carcinoma in Primary Biliary Cholangitis | Review |
| 25762349 | 2015 | Clin Rev Allergy Immunol | Incidence and risk factors for hepatocellular carcinoma in primary biliary cirrhosis | Research Support, Non-U.S. Gov't, Review |

补充检索式（该主题文献分成两个不重叠的簇，单条检索式无法同时覆盖）：`primary biliary cholangitis portal hypertension esophageal varices screening`　（命中 160 条）

| PMID | 年份 | 期刊 | 标题 | 类型 |
| --- | --- | --- | --- | --- |
| 39674236 | 2025 | Clin Gastroenterol Hepatol | Noninvasive Assessment of Portal Hypertension in Patients With Primary Biliary Cholangitis Is Affected by Severity of Cholestasis | Journal Article |

## T5 骨质疏松与脂溶性维生素

检索式：`primary biliary cholangitis osteoporosis bone mineral density vitamin D`　（命中 38 条，相关度排序，自前 8 条命中中取 3 条）

| PMID | 年份 | 期刊 | 标题 | 类型 |
| --- | --- | --- | --- | --- |
| 42221308 | 2026 | Clin Exp Hepatol | Osteoporosis in primary biliary cholangitis: from cholestasis to fracture prevention | Review |
| 27261902 | 2016 | Gastroenterol Clin North Am | Metabolic Bone Disease in Primary Biliary Cirrhosis | Review |
| 30259851 | 2018 | Clin Liver Dis | Chronic Complications of Cholestasis: Evaluation and Management | Review |

## T6 瘙痒与乏力管理

检索式：`primary biliary cholangitis pruritus treatment`　（命中 766 条，相关度排序，自前 8 条命中中取 3 条）

| PMID | 年份 | 期刊 | 标题 | 类型 |
| --- | --- | --- | --- | --- |
| 41173016 | 2026 | Lancet Gastroenterol Hepatol | Linerixibat in patients with primary biliary cholangitis and cholestatic pruritus (GLISTEN): a randomised, multicentre, double-blind, placebo-controlled, phase 3 trial | Randomized Controlled Trial, Multicenter Study, Clinical Trial, Phase III, Research Support, Non-U.S. Gov't |
| 38117036 | 2024 | Hepatology | Seladelpar treatment reduces IL-31 and pruritus in patients with primary biliary cholangitis | Randomized Controlled Trial, Research Support, Non-U.S. Gov't |
| 39216494 | 2024 | Lancet | Primary biliary cholangitis | Review, Research Support, Non-U.S. Gov't |

补充检索式（该主题文献分成两个不重叠的簇，单条检索式无法同时覆盖）：`primary biliary cholangitis fatigue`　（命中 533 条）

| PMID | 年份 | 期刊 | 标题 | 类型 |
| --- | --- | --- | --- | --- |
| 41082897 | 2026 | Lancet Gastroenterol Hepatol | Fatigue in people with primary biliary cholangitis: a position paper from the European Reference Network for Rare Liver Diseases | Consensus Statement, Meta-Analysis, Systematic Review, Research Support, Non-U.S. Gov't |
| 30632051 | 2019 | Dig Dis Sci | Treatment of Fatigue in Primary Biliary Cholangitis: A Systematic Review and Meta-Analysis | Meta-Analysis, Systematic Review |

## T7 合并自身免疫病（干燥综合征 / 甲状腺 / 系统性硬化）

检索式：`primary biliary cholangitis extrahepatic autoimmune disease Sjogren thyroid systemic sclerosis`　（命中 12 条，相关度排序，自前 8 条命中中取 3 条）

| PMID | 年份 | 期刊 | 标题 | 类型 |
| --- | --- | --- | --- | --- |
| 38518985 | 2024 | Clin Res Hepatol Gastroenterol | Extrahepatic conditions of primary biliary cholangitis: A systematic review and meta-analysis of prevalence and risk | Systematic Review, Meta-Analysis |
| 30343710 | 2018 | Best Pract Res Clin Gastroenterol | PBC and related extrahepatic diseases | Review |
| 42256626 | 2026 | J Scleroderma Relat Disord | Systemic sclerosis and primary biliary cholangitis: a systematic review of case-control studies comparing isolated and overlapping disease phenotypes | Journal Article |

## T8 妊娠与生育

检索式：`primary biliary cholangitis pregnancy outcome ursodeoxycholic acid`　（命中 17 条，相关度排序，自前 8 条命中中取 3 条）

| PMID | 年份 | 期刊 | 标题 | 类型 |
| --- | --- | --- | --- | --- |
| 31479696 | 2019 | J Hepatol | Ursodeoxycholic acid in pregnancy? | Case Reports, Review |
| 24879082 | 2014 | Autoimmun Rev | Pregnancy in women with primary biliary cirrhosis | Review |
| 24984967 | 2015 | Clin Rev Allergy Immunol | Pregnancy and primary biliary cirrhosis: a case-control study | Research Support, Non-U.S. Gov't |

## T9 肝移植指征与时机

检索式：`primary biliary cholangitis liver transplantation graft survival recurrence indication`　（命中 65 条，相关度排序，自前 8 条命中中取 3 条）

| PMID | 年份 | 期刊 | 标题 | 类型 |
| --- | --- | --- | --- | --- |
| 30259857 | 2018 | Clin Liver Dis | Current Status of Liver Transplantation for Primary Biliary Cholangitis | Review |
| 30343704 | 2018 | Best Pract Res Clin Gastroenterol | PBC-transplantation and disease recurrence | Review |
| 35098931 | 2022 | Curr Opin Gastroenterol | Posttransplant immune-mediated cholangiopathies | Review |

## T10 流行病学与疾病负担（中国 / 亚洲）

检索式：`primary biliary cholangitis epidemiology prevalence incidence Asia China`　（命中 95 条，相关度排序，自前 8 条命中中取 3 条）

| PMID | 年份 | 期刊 | 标题 | 类型 |
| --- | --- | --- | --- | --- |
| 31552558 | 2019 | Hepatol Int | Epidemiology and clinical course of primary biliary cholangitis in the Asia-Pacific region: a systematic review and meta-analysis | Meta-Analysis, Systematic Review |
| 33141955 | 2021 | J Gastroenterol Hepatol | Regional variation and temporal trend of primary biliary cholangitis epidemiology: A systematic review and meta-analysis | Meta-Analysis, Systematic Review |
| 26885951 | 2016 | Curr Opin Gastroenterol | Primary biliary cholangitis in China | Research Support, N.I.H., Extramural, Research Support, Non-U.S. Gov't, Review |

## 覆盖缺口

1. **中文指南原件未获取。** 中华医学会肝病学分会《原发性胆汁性胆管炎诊断和治疗指南（2021）》原件不可得（环境限制，未尝试绕过），因此**页码级引用不可用**，本文件不含该指南的任何条目、推荐等级或页码。
2. **NMPA 药品批件页未取得。** NMPA 药品批件查询站点返回 HTTP 412（反爬），未取得奥贝胆酸、贝特类等药物的官方批件页，故本文件**不含任何中国境内适应证/批准状态的一手依据**；T3 中的药物证据全部为 PubMed 文献层，不能替代监管批件。
3. **未做全文阅读。** 仅基于标题与 `pubtype` 做相关性筛选，未核对正文、样本量、终点定义与统计方法；摘要层结论亦未逐条核读。
4. **T2 的判定阈值本身未被取证。** Paris II / Barcelona / GLOBE / UK-PBC 的**具体界值（cut-off）**写在指南与原始方法学论文中，本文件只命中“验证/比较这些评分”的研究，**界值数值不可从本文件推得**，需回原始文献或指南正文核对。
5. **T9 的“时机”阈值缺口。** 命中集中在移植结局与复发，**MELD 例外/优先分配的具体数值门槛**未在本轮命中中出现，需另检器官分配政策文件。
6. **T4 的并发症筛查证据薄弱。** HCC 簇证据充分（含 meta 分析），但“肝硬化并发症（静脉曲张/门脉高压）筛查”在 PBC 专病文献中几乎无独立研究，仅以补充检索式取到 1 条门脉高压无创评估研究，**不能据此形成筛查间隔建议**。
7. **无灰色文献/注册库/指南网站核查。** 未检索 ClinicalTrials.gov、EASL/AASLD 官网、Cochrane Library 全文库；因此本清单可能遗漏未被 PubMed 收录的指南与共识。
8. **检索时点偏置。** `sort=relevance` 下仍以近 5 年文献为主，经典旧文献（如 2000 年代 UDCA 剂量试验）可能未进入前 8 条，**本清单不是该主题的系统性全量证据**。
9. **相关度排序不是逐位稳定的。** 复核时发现：同一检索式两次调用，`count` 完全一致，但 `idlist` 的排序/边界会小幅漂移（T8 首轮第 8 位与复核不一致，故该行已替换为复核 `idlist` 内可复现的 PMID）。**复现时若个别 PMID 不在你的前 8 条里，属于排序漂移，不是数据错误**；PMID 本身均可独立检索到。

