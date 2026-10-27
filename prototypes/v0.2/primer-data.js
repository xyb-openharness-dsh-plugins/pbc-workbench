/* 36 号 · 疾病概要数据（window.DISEASE_PRIMER）
 *
 * 内容口径（2026-10-27 返工）：
 *   - 四段固定顺序 definition → evidence → landscape → trend，缺段不删；
 *   - 病种内容只写本仓 README 与 docs/ 已写明的说法，不写判定、不复制指南条文；
 *   - 指南链接按「官方指南页 / 期刊全文页 / 未取得原件」三态如实标注：
 *     官方页是 hub，不冒充原件；期刊全文页标 kind:'fulltext'；打不开的标 nolink + note；
 *   - 每条外链都跑过 primer-backfill-2026-10-27/verify-links.mjs，只收 OK。
 * 数据来源：README.md、docs/SPEC.md、docs/BRIEF.md、docs/CLINICAL-DATA-2026.md、
 *           docs/GUIDELINE-BRIDGE.md、assets/reference/ctcae/README.md。
 */
window.DISEASE_PRIMER = {
  brand: '小管宝 DuctPal',
  name: '原发性胆汁性胆管炎',
  en: 'Primary Biliary Cholangitis（PBC）',
  updated: '2026-10-27',
  sections: [
    {
      id: 'definition',
      title: '定义',
      intro: '原发性胆汁性胆管炎（PBC）是一种慢性肝胆疾病，病程长；本工作台围绕生化化验、用药与漏服、痒与累、并发症筛查整理病程记录。',
      points: [
        '本仓面向已确诊 PBC 的成人患者本人，照护者可选用同一套记录。',
        '生化线按每张化验单自带的参考上限对照（×ULN 口径），不借用通用上限。',
        '瘙痒与乏力在本仓作为独立功能线按天记录，与同日指标只并列、不推断。',
        '本段只写仓内已写明的疾病事实；不复制指南条文、不做定义或分期判定。',
      ],
      sources: [
        { org: '本仓 README', doc: '疾病概要 · 定义', version: '0.2.9', nolink: true, note: '仓内文档，无公开 URL' },
        { org: '本仓 docs/SPEC.md', doc: '项目规格 §1 问题、用户与最小闭环', nolink: true, note: '仓内文档，无公开 URL' },
      ],
    },
    {
      id: 'evidence',
      title: '医学资料规范和指南情况',
      intro: '本台把可公开点开的指南页 / 期刊全文页与「未取得原件」分开标注；不写页码、不复制条文，也不把栏目页冒充原件。',
      table: {
        head: ['机构', '文件', '版本 / 年份', '原件', '本台用途'],
        rows: [
          [
            'AASLD（美国肝病研究学会）',
            'Primary Biliary Cholangitis: 2018 Practice Guidance / 2021 Practice Guidance Update',
            '2018 版 / 2021 更新',
            {
              text: '官方指南页（含 2018 版与 2021 更新）',
              kind: 'hub',
              url: 'https://www.aasld.org/practice-guidelines/primary-biliary-cholangitis',
              note: 'AASLD 官方页；PDF 在页内下载，本仓未逐条引用条文',
            },
            '指南版本与治疗手段的并列引用（不引页码）',
          ],
          [
            'EASL（欧洲肝病学会）',
            'EASL Clinical Practice Guidelines: The diagnosis and management of patients with primary biliary cholangitis',
            '2017',
            {
              text: '官方指南页（需 MyEASL 账号）',
              kind: 'hub',
              url: 'https://easl.eu/publication/the-diagnosis-and-management-of-patients-with-primary-biliary-cholangitis/',
              note: '全文需 MyEASL 账号；本仓未取得原件',
            },
            '指南版本与治疗手段的并列引用（不引页码）',
          ],
          [
            '中华医学会肝病学分会',
            '原发性胆汁性胆管炎的诊断和治疗指南（2021）',
            '2021（发表于 2022）',
            {
              text: '期刊全文页（2021）',
              kind: 'fulltext',
              url: 'https://www.lcgdbzz.com/cn/article/doi/10.3760/cma.j.cn112138-20211112-00794',
              note: '临床肝胆病杂志 2022;38(1):35-41；公开全文页，本仓未存 PDF',
            },
            '中文指南版本事实与条目背景',
          ],
          [
            '国家卫生健康委员会',
            '原发性胆汁性胆管炎诊疗指南（2025年版）',
            '2025 年版',
            {
              text: '期刊全文页（2025）',
              kind: 'fulltext',
              url: 'https://cjournal.hep.com.cn/1001-5256/CN/10.12449/JCH250805',
              note: '临床肝胆病杂志 2025;41(8):1504-1506；公开全文页，本仓未存 PDF',
            },
            '最新版版本事实',
          ],
          [
            'NICE（英国国家卫生与临床优化研究所）',
            'PBC 专属指南（NG / CG）',
            '未检索到专属 NG/CG',
            {
              text: '未取得原件',
              nolink: true,
              note: 'NICE 官网 BNF / CKS / TA 页对本机 IP 返回 403 地区限制，AUTH 不算可达；本轮未取得可点原件',
            },
            '本版暂不引用',
          ],
          [
            '美国国家癌症研究所（NCI）',
            'CTCAE v5.0 Quick Reference（5x7）',
            'v5.0（2017）',
            {
              text: '官方 CTCAE 文档页（HTML）',
              kind: 'hub',
              url: 'https://ctep.cancer.gov/protocoldevelopment/electronic_applications/ctc.htm',
              note: 'NCI CTEP 官方页；Quick Reference PDF/XLSX 在页内下载，本仓另有仓库内 PDF',
            },
            '化验分级对照（仅启用有绝对数值界限的项）',
          ],
        ],
      },
      sources: [
        { org: 'AASLD', doc: 'PBC 2018 Practice Guidance / 2021 Update', original: false, secondaryUrl: 'https://www.aasld.org/practice-guidelines/primary-biliary-cholangitis', note: '官方指南页（hub），原件 PDF 未逐条引用' },
        { org: 'EASL', doc: 'PBC Clinical Practice Guidelines 2017', original: false, secondaryUrl: 'https://easl.eu/publication/the-diagnosis-and-management-of-patients-with-primary-biliary-cholangitis/', note: '官方指南页；全文需 MyEASL 账号' },
        { org: '中华医学会肝病学分会', doc: '原发性胆汁性胆管炎的诊断和治疗指南（2021）', original: true, kind: 'fulltext', url: 'https://www.lcgdbzz.com/cn/article/doi/10.3760/cma.j.cn112138-20211112-00794' },
        { org: '国家卫生健康委员会', doc: '原发性胆汁性胆管炎诊疗指南（2025年版）', original: true, kind: 'fulltext', url: 'https://cjournal.hep.com.cn/1001-5256/CN/10.12449/JCH250805' },
        { org: 'NICE', doc: 'PBC 专属指南（NG / CG）', nolink: true, note: 'NICE 官网对本机 IP 403（地区限制），无法验活' },
        { org: '美国国家癌症研究所（NCI）', doc: 'CTCAE v5.0 Quick Reference（5x7）', version: '2017', nolink: true, note: '仓库内已有 PDF；官方 HTML 文档页见本段表格' },
      ],
    },
    {
      id: 'landscape',
      title: '目前治疗全景概要',
      intro: '以下只写本仓文档里已经写明的手段与记录范围，按长期病程的环节分组；不排序、不比优劣。',
      groups: [
        {
          label: '治疗与随访（本仓文档已写明）',
          points: [
            '长期单一用药（UDCA）；具体药名、剂量与调整由主诊医生决定，本仓不载剂量、不做应答判定。',
            '3–6 个月一次生化复查；本仓只按起点与间隔显示参考节点，不排计划、不发提醒。',
          ],
        },
        {
          label: '症状与日常记录',
          points: [
            '瘙痒与乏力没有客观指标可替代，本仓按天记录强度与影响，不换算成评分结论。',
            '用药与漏服、副作用、换线记录由用户抄录医生原话与自己的记录，本仓不推断该不该换药。',
          ],
        },
        {
          label: '指南列举的其他治疗手段',
          points: [
            '本台尚未按指南原文整理；本轮只接入指南的可点入口（见上一段），不复制条文、不排序、不比优劣。',
          ],
        },
      ],
      points: [
        '以上是文献与指南里列出的手段，按病期与线序排列，不代表任何一项适合你。选哪一个，这一句需要问你的医生。',
      ],
      sources: [
        { org: '本仓 docs/SPEC.md', doc: '项目规格 §1–§2', nolink: true, note: '仓内文档，无公开 URL' },
        { org: '本仓 docs/BRIEF.md', doc: '需求起点 · 场景与核心流程', nolink: true, note: '仓内文档，无公开 URL' },
        { org: '本仓 docs/GUIDELINE-BRIDGE.md', doc: '指南桥 · 本轮诚实边界', nolink: true, note: '仓内文档，无公开 URL' },
      ],
    },
    {
      id: 'trend',
      title: '发展趋势',
      intro: '只记已发生的事实与日期，不预测、不评价。',
      points: [
        '截至 2026-10-25，临床试验库 6 个来源中查过 2 个：CDE 命中 41 条、WHO ICTRP 命中被单次上限截断（只取前 200 条）；落库 479 条（CDE 93 + ICTRP 386）。',
        '2026-10-25 采集的数据截止日为 2026-10-25；ChiCTR 在线、ChiCTR 离线语料、XYB 归档、ClinicalTrials.gov 深度通道均未查过。',
        '截至 2026-10-27，已接入 AASLD 2018/2021、EASL 2017、中华医学会 2021、国家卫健委 2025 指南的可点入口；指南条文与页码层仍未接入。',
        '本仓当前分级只对照 CTCAE v5.0；GLOBE、UK-PBC、巴黎、巴塞罗那等应答评分不在本仓计算范围。',
        '公开二次核验入口：ClinicalTrials.gov 的 PBC 检索页（检索于 2026-10-27）；本仓本轮 ctv 通道未查，检索页结果不计入上述 479 条。',
      ],
      sources: [
        { org: '本仓 docs/CLINICAL-DATA-2026.md', doc: '临床数据（试验库）· PBC · 2026', version: '2026-10-25', nolink: true, note: '仓内文档，无公开 URL' },
        { org: '本仓 docs/GUIDELINE-BRIDGE.md', doc: '指南桥 · 四问筛结果', nolink: true, note: '仓内文档，无公开 URL' },
        { org: 'ClinicalTrials.gov', doc: 'Primary Biliary Cholangitis 检索页', original: false, secondaryUrl: 'https://clinicaltrials.gov/search?cond=Primary%20Biliary%20Cholangitis', note: '公开检索入口；本轮 ctv 通道未查，结果不计入 479 条' },
      ],
    },
  ],
}
