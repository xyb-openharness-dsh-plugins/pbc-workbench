/* 36 号 · 疾病概要数据（window.DISEASE_PRIMER）
 *
 * 内容口径（2026-10-27）：
 *   - 四段固定顺序 definition → evidence → landscape → trend，缺段不删；
 *   - 只取本仓 README 与 docs/ 里已经写明的说法，不写判定、不复制指南条文、不编 URL；
 *   - 每段必须有 sources；没有可验证链接的条目写 nolink:true + note，不拿栏目页冒充原件。
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
        '疾病定义的指南原文未取得（未核实），本段不引用指南条文。',
      ],
      sources: [
        { org: '本仓 README', doc: '疾病概要 · 定义', version: '0.2.7', nolink: true, note: '仓内文档，无公开 URL' },
        { org: '本仓 docs/SPEC.md', doc: '项目规格 §1 问题、用户与最小闭环', nolink: true, note: '仓内文档，无公开 URL' },
      ],
    },
    {
      id: 'evidence',
      title: '医学资料规范和指南情况',
      intro: '本台只把已经拿到的标准与指南列在下表；没有原件的行如实标「未取得原件」，不写页码、不引用条文。',
      table: {
        head: ['机构', '文件', '版本 / 年份', '原件', '本台用途'],
        rows: [
          [
            '美国国家癌症研究所（NCI）',
            'CTCAE v5.0 Quick Reference（5x7）',
            'v5.0（2017）',
            {
              text: '仓库内已存 PDF；官方直链未通过验活',
              nolink: true,
              note: 'assets/reference/ctcae/ 内有 PDF；官方 dctd.cancer.gov 直链实测为 application/pdf，但真浏览器验活判 THIN，按批次规则不计可达',
            },
            '化验分级对照（仅启用有绝对数值界限的项）',
          ],
          [
            '中华医学会肝病学分会',
            '原发性胆汁性胆管炎诊断和治疗指南',
            '2021',
            {
              text: '未取得原件',
              nolink: true,
              note: '本仓无原件；存在性未核实，四问筛不通过（docs/GUIDELINE-BRIDGE.md）',
            },
            '指南出处层未接入，界面不出现指南页码',
          ],
        ],
      },
      sources: [
        { org: '美国国家癌症研究所（NCI）', doc: 'CTCAE v5.0 Quick Reference（5x7）', version: '2017', nolink: true, note: '本仓 assets/reference/ctcae/ 内有 PDF；官方在线直链未通过批次验活' },
        { org: '中华医学会肝病学分会', doc: '原发性胆汁性胆管炎诊断和治疗指南', version: '2021', nolink: true, note: '本仓未取得原件（docs/GUIDELINE-BRIDGE.md）' },
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
            '本台尚未整理：中文指南原件未取得，未接入任何指南条文与页码。',
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
        '截至 2026-10-27，中文指南原件仍未取得（四问筛不通过），本仓未接入指南页码层。',
        '本仓当前分级只对照 CTCAE v5.0；GLOBE、UK-PBC、巴黎、巴塞罗那等应答评分不在本仓计算范围。',
      ],
      sources: [
        { org: '本仓 docs/CLINICAL-DATA-2026.md', doc: '临床数据（试验库）· PBC · 2026', version: '2026-10-25', nolink: true, note: '仓内文档，无公开 URL' },
        { org: '本仓 docs/GUIDELINE-BRIDGE.md', doc: '指南桥 · 四问筛结果', nolink: true, note: '仓内文档，无公开 URL' },
      ],
    },
  ],
}
