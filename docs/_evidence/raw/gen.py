#!/usr/bin/env python3
"""Generate pubmed-evidence.md from harvested esummary JSON (no invented data)."""
import json, os, re, subprocess

RAW = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(RAW), "pubmed-evidence.md")

def load(fn):
    with open(os.path.join(RAW, fn)) as f:
        return json.load(f)

def meta(fn, pmid):
    d = load(fn)
    r = d["result"][pmid]
    return r

def year(pubdate):
    m = re.match(r"(\d{4})", pubdate or "")
    return m.group(1) if m else pubdate

def types(r):
    ts = [t for t in r.get("pubtype", []) if t != "Journal Article"]
    return ", ".join(ts) if ts else "Journal Article"

def row(fn, pmid):
    r = meta(fn, pmid)
    title = r.get("title", "").rstrip(".")
    title = title.replace("|", "\\|")
    return f"| {pmid} | {year(r.get('pubdate',''))} | {r.get('source','')} | {title} | {types(r)} |"

SECTIONS = [
    ("T1", "诊断与 AMA / ALP 阈值",
     "primary biliary cholangitis diagnosis antimitochondrial antibody", 956, "T1h.esummary.json",
     ["29593060", "36270719", "33264835"], None),
    ("T2", "UDCA 剂量与生化应答判定（Paris II / Barcelona / GLOBE / UK-PBC）",
     "UK-PBC GLOBE score ursodeoxycholic acid response primary biliary cholangitis validation", 8, "T2c.esummary.json",
     ["31241547", "39124763", "36593158"], None),
    ("T3", "二线治疗：奥贝胆酸与贝特类",
     "obeticholic acid bezafibrate fibrates second-line primary biliary cholangitis", 19, "T3r.esummary.json",
     ["39707635", "39720853", "35961518"], None),
    ("T4", "肝硬化并发症筛查与 HCC 监测",
     "primary biliary cholangitis hepatocellular carcinoma incidence risk", 300, "T4d.esummary.json",
     ["32743773", "36270724", "25762349"],
     ("primary biliary cholangitis portal hypertension esophageal varices screening", 160,
      "T4v.esummary.json", ["39674236"])),
    ("T5", "骨质疏松与脂溶性维生素",
     "primary biliary cholangitis osteoporosis bone mineral density vitamin D", 38, "T5b.esummary.json",
     ["42221308", "27261902", "30259851"], None),
    ("T6", "瘙痒与乏力管理",
     "primary biliary cholangitis pruritus treatment", 766, "T6c.esummary.json",
     ["41173016", "38117036", "39216494"],
     ("primary biliary cholangitis fatigue", 533, "T6d.esummary.json", ["41082897", "30632051"])),
    ("T7", "合并自身免疫病（干燥综合征 / 甲状腺 / 系统性硬化）",
     "primary biliary cholangitis extrahepatic autoimmune disease Sjogren thyroid systemic sclerosis", 12, "T7r.esummary.json",
     ["38518985", "30343710", "42256626"], None),
    ("T8", "妊娠与生育",
     "primary biliary cholangitis pregnancy outcome ursodeoxycholic acid", 17, "T8b.esummary.json",
     ["31479696", "24879082", "24984967"], None),
    ("T9", "肝移植指征与时机",
     "primary biliary cholangitis liver transplantation graft survival recurrence indication", 65, "R9b.esummary.json",
     ["30259857", "30343704", "35098931"], None),
    ("T10", "流行病学与疾病负担（中国 / 亚洲）",
     "primary biliary cholangitis epidemiology prevalence incidence Asia China", 95, "R10.esummary.json",
     ["31552558", "33141955", "26885951"], None),
]

stamp = subprocess.run(["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"], capture_output=True, text=True).stdout.strip()

L = []
L.append("# PBC 工作台 · PubMed 文献取证（主题级命中清单）\n")
L.append(f"- **采集日期（UTC）**：`{stamp}`")
L.append("- **检索工具**：NCBI E-utilities — `esearch.fcgi`（取 ID 列表，`retmax=8`）+ `esummary.fcgi`（取元数据），`retmode=json`")
L.append("- **排序**：`esearch` 追加 `sort=relevance`。默认排序为“最新”，实测会把命中带偏到 HBV/MASLD 等相邻领域，故统一改为相关度排序；`count` 为不加 `retmax` 限制时的全库命中总数。")
L.append("")
L.append("> **证据等级声明**：本文件记录的是**检索命中（search hits）**，**不是指南原件**，也**未做全文核读**。")
L.append("> 每一条的 PMID / 年份 / 期刊 / 标题 / 类型均直接来自 NCBI `esummary` 返回字段（标题仅去掉句末句号，`pubtype` 中逐条重复的 `Journal Article` 已省略），未做任何人工改写或补充。")
L.append("> 筛选只发生在**标题 + 出版物类型**层面（优先 Practice Guideline / Consensus Statement / Review / Meta-Analysis / 大样本研究）。")
L.append("> **因此本文件不能用于任何页码级、条款级的临床断言引用。**")
L.append("")
L.append("## 命中汇总\n")
L.append("| 主题 | 检索命中总数 | 本文件摘录条数 |")
L.append("| --- | --- | --- |")
for tid, name, q, cnt, fn, pmids, supp in SECTIONS:
    n = len(pmids) + (len(supp[3]) if supp else 0)
    L.append(f"| {tid} | {cnt} | {n} |")
L.append("")

for tid, name, q, cnt, fn, pmids, supp in SECTIONS:
    L.append(f"## {tid} {name}\n")
    L.append(f"检索式：`{q}`　（命中 {cnt} 条，相关度排序，自前 8 条命中中取 {len(pmids)} 条）\n")
    L.append("| PMID | 年份 | 期刊 | 标题 | 类型 |")
    L.append("| --- | --- | --- | --- | --- |")
    for p in pmids:
        L.append(row(fn, p))
    L.append("")
    if supp:
        sq, scnt, sfn, spmids = supp
        L.append(f"补充检索式（该主题文献分成两个不重叠的簇，单条检索式无法同时覆盖）：`{sq}`　（命中 {scnt} 条）\n")
        L.append("| PMID | 年份 | 期刊 | 标题 | 类型 |")
        L.append("| --- | --- | --- | --- | --- |")
        for p in spmids:
            L.append(row(sfn, p))
        L.append("")

L.append("## 覆盖缺口\n")
L.append("1. **中文指南原件未获取。** 中华医学会肝病学分会《原发性胆汁性胆管炎诊断和治疗指南（2021）》原件不可得（环境限制，未尝试绕过），因此**页码级引用不可用**，本文件不含该指南的任何条目、推荐等级或页码。")
L.append("2. **NMPA 药品批件页未取得。** NMPA 药品批件查询站点返回 HTTP 412（反爬），未取得奥贝胆酸、贝特类等药物的官方批件页，故本文件**不含任何中国境内适应证/批准状态的一手依据**；T3 中的药物证据全部为 PubMed 文献层，不能替代监管批件。")
L.append("3. **未做全文阅读。** 仅基于标题与 `pubtype` 做相关性筛选，未核对正文、样本量、终点定义与统计方法；摘要层结论亦未逐条核读。")
L.append("4. **T2 的判定阈值本身未被取证。** Paris II / Barcelona / GLOBE / UK-PBC 的**具体界值（cut-off）**写在指南与原始方法学论文中，本文件只命中“验证/比较这些评分”的研究，**界值数值不可从本文件推得**，需回原始文献或指南正文核对。")
L.append("5. **T9 的“时机”阈值缺口。** 命中集中在移植结局与复发，**MELD 例外/优先分配的具体数值门槛**未在本轮命中中出现，需另检器官分配政策文件。")
L.append("6. **T4 的并发症筛查证据薄弱。** HCC 簇证据充分（含 meta 分析），但“肝硬化并发症（静脉曲张/门脉高压）筛查”在 PBC 专病文献中几乎无独立研究，仅以补充检索式取到 1 条门脉高压无创评估研究，**不能据此形成筛查间隔建议**。")
L.append("7. **无灰色文献/注册库/指南网站核查。** 未检索 ClinicalTrials.gov、EASL/AASLD 官网、Cochrane Library 全文库；因此本清单可能遗漏未被 PubMed 收录的指南与共识。")
L.append("8. **检索时点偏置。** `sort=relevance` 下仍以近 5 年文献为主，经典旧文献（如 2000 年代 UDCA 剂量试验）可能未进入前 8 条，**本清单不是该主题的系统性全量证据**。")
L.append("9. **相关度排序不是逐位稳定的。** 复核时发现：同一检索式两次调用，`count` 完全一致，但 `idlist` 的排序/边界会小幅漂移（T8 首轮第 8 位与复核不一致，故该行已替换为复核 `idlist` 内可复现的 PMID）。**复现时若个别 PMID 不在你的前 8 条里，属于排序漂移，不是数据错误**；PMID 本身均可独立检索到。")
L.append("")

with open(OUT, "w") as f:
    f.write("\n".join(L) + "\n")
print("WROTE", OUT, len(L), "lines")
