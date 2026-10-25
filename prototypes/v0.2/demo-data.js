/* 由 demo/build-demo-data.mjs 生成，勿手改。重跑：npm run demo:data */
(function (root) {
  const DEMO = {
  "generatedAt": "fixed-for-reproducibility",
  "profiles": [
    {
      "key": "A",
      "label": "档案 A · 部分应答",
      "name": "虚构患者甲",
      "age": 52,
      "sex": "女",
      "diagnosedAt": "2024-03-12",
      "startedAt": "2024-03-20",
      "weightKg": 58,
      "antibodies": {
        "ama": "positive",
        "amaM2": "positive",
        "ana": "negative",
        "note": "2024-03 首诊报告抄录"
      },
      "fibrosis": {
        "method": "瞬时弹性成像",
        "value": "8.4 kPa",
        "date": "2026-04-18",
        "note": "报告原文抄录，未判读"
      },
      "comorbidity": [
        {
          "name": "干燥症状",
          "since": "2024",
          "note": "未做唇腺活检",
          "dept": null,
          "visibility": "shared"
        }
      ],
      "meds": [
        {
          "name": "熊去氧胆酸片",
          "doseText": "250 mg × 5 片/日（按 13–15 mg/kg 由医生确定）",
          "freq": "每日 2–3 次",
          "startDate": "2024-03-20",
          "approval": "unverified",
          "inUse": true
        }
      ],
      "adherence": [
        {
          "month": "2026-05",
          "missed": 1
        },
        {
          "month": "2026-06",
          "missed": 0
        },
        {
          "month": "2026-07",
          "missed": 2
        },
        {
          "month": "2026-08",
          "missed": 0
        },
        {
          "month": "2026-09",
          "missed": 1
        },
        {
          "month": "2026-10",
          "missed": 0
        }
      ],
      "regimenChanges": [
        {
          "date": "2025-11-06",
          "text": "医生提到\"如果 ALP 还降不下来，可以考虑加一种药\"，药名当时没记住",
          "status": "待我确认理解"
        }
      ],
      "symptoms": [
        {
          "date": "2026-10-03",
          "itch": 7,
          "nightWorse": true,
          "scratch": true,
          "sleepBreaks": 3,
          "fatigue": 2,
          "note": "夜里最痒，小腿外侧",
          "visibility": "shared"
        },
        {
          "date": "2026-09-21",
          "itch": 5,
          "nightWorse": true,
          "scratch": false,
          "sleepBreaks": 1,
          "fatigue": 2,
          "note": "",
          "visibility": "shared"
        },
        {
          "date": "2026-09-02",
          "itch": 3,
          "nightWorse": false,
          "scratch": false,
          "sleepBreaks": 0,
          "fatigue": 3,
          "note": "这周加班，走两层楼要歇",
          "visibility": "shared"
        },
        {
          "date": "2026-08-14",
          "itch": 6,
          "nightWorse": true,
          "scratch": true,
          "sleepBreaks": 2,
          "fatigue": 2,
          "note": "",
          "visibility": "shared"
        },
        {
          "date": "2026-07-19",
          "itch": 4,
          "nightWorse": false,
          "scratch": false,
          "sleepBreaks": 0,
          "fatigue": 1,
          "note": "",
          "visibility": "shared"
        },
        {
          "date": "2026-06-27",
          "itch": 2,
          "nightWorse": false,
          "scratch": false,
          "sleepBreaks": 0,
          "fatigue": 2,
          "note": "",
          "visibility": "shared"
        },
        {
          "date": "2026-05-30",
          "itch": 5,
          "nightWorse": true,
          "scratch": false,
          "sleepBreaks": 1,
          "fatigue": 2,
          "note": "",
          "visibility": "shared"
        }
      ],
      "screening": [
        {
          "type": "bone",
          "date": "2026-04-18",
          "result": "腰椎 T 值 -1.8（报告原文）",
          "detail": "医生说\"有点低\"，未给用药方案",
          "sectionTitle": "骨密度"
        },
        {
          "type": "thyroid",
          "date": "2026-03-02",
          "result": "TSH 4.9 mIU/L（参考 0.35–4.94）",
          "detail": "内分泌科随访，未用药",
          "sectionTitle": "甲状腺功能"
        },
        {
          "type": "endoscopy",
          "date": "2025-04-10",
          "result": "未见静脉曲张（报告原文）",
          "detail": "",
          "sectionTitle": "胃镜（静脉曲张）"
        },
        {
          "type": "vitamin",
          "date": "2026-04-18",
          "result": "25-OH 维生素 D 22 ng/mL",
          "detail": "医生建议补充，剂量未记",
          "sectionTitle": "脂溶性维生素"
        },
        {
          "type": "liver",
          "date": "2026-04-18",
          "result": "超声：肝表面尚光滑，未见明确占位",
          "detail": "",
          "sectionTitle": "肝脏影像"
        }
      ],
      "questions": [
        {
          "id": "q1",
          "text": "这次的 ALP 比上次降了多少？离\"控制住\"还差多少？",
          "done": false
        },
        {
          "id": "q2",
          "text": "夜里痒得厉害，和这个病有关系吗？要不要处理？",
          "done": false
        },
        {
          "id": "q3",
          "text": "上次说可能加药，现在需要加吗？",
          "done": false
        },
        {
          "id": "q4",
          "text": "胃镜多久复查一次？",
          "done": true
        },
        {
          "id": "q5",
          "text": "骨密度这个数值需要处理吗？",
          "done": false
        }
      ],
      "documents": [
        {
          "id": "d1",
          "name": "2026-10 肝功能.pdf",
          "date": "2026-10-08",
          "parsed": true,
          "parseState": "parsed"
        },
        {
          "id": "d2",
          "name": "骨密度报告.jpg",
          "date": "2026-04-18",
          "parsed": true,
          "parseState": "parsed"
        },
        {
          "id": "d3",
          "name": "2025-04 胃镜.pdf",
          "date": "2025-04-10",
          "parsed": false,
          "parseState": "unparsed"
        }
      ],
      "trials": [
        {
          "id": "t1",
          "title": "【虚构示例】某二线药物在 PBC 中的随机对照研究",
          "source": "ctv",
          "phase": "3 期",
          "status": "登记状态，未核实",
          "area": "上海"
        },
        {
          "id": "t2",
          "title": "【虚构示例】PBC 瘙痒症状管理研究",
          "source": "chictr_online",
          "phase": "不适用",
          "status": "登记状态，未核实",
          "area": "北京"
        }
      ],
      "pathway": [
        {
          "d": "2024-03-12",
          "phase": "确诊",
          "text": "体检发现 ALP 升高，抗体阳性后确诊",
          "detail": {
            "regimen": {
              "summary": "尚未开始用药",
              "items": [
                [
                  "方案",
                  "无"
                ],
                [
                  "说明",
                  "确诊当次未开药"
                ]
              ]
            },
            "metrics": {
              "summary": "ALP 286 U/L（参考上限 120）",
              "items": [
                [
                  "ALP",
                  "286 U/L，约 2.4×ULN"
                ],
                [
                  "GGT",
                  "198 U/L"
                ]
              ]
            },
            "imaging": {
              "summary": "超声：肝实质回声稍增粗",
              "items": [
                [
                  "报告原文",
                  "肝实质回声稍增粗，未见占位"
                ]
              ]
            },
            "ae": {
              "summary": "无记录",
              "items": [
                [
                  "说明",
                  "此阶段未开始用药，未记副作用"
                ]
              ]
            },
            "support": {
              "summary": "无记录",
              "items": [
                [
                  "说明",
                  "未记录支持措施"
                ]
              ]
            }
          }
        },
        {
          "d": "2024-03-20",
          "phase": "开始 UDCA",
          "text": "医生按体重定的剂量，每日分次口服",
          "detail": {
            "regimen": {
              "summary": "熊去氧胆酸 250 mg × 5 片/日",
              "items": [
                [
                  "药名",
                  "熊去氧胆酸片"
                ],
                [
                  "剂量原文",
                  "250 mg × 5 片/日"
                ],
                [
                  "频次",
                  "每日 2–3 次"
                ],
                [
                  "获批状态",
                  "未核实"
                ]
              ]
            },
            "metrics": {
              "summary": "ALP 从 286 降到 210（3 个月）",
              "items": [
                [
                  "2024-06 ALP",
                  "210 U/L，约 1.75×ULN"
                ],
                [
                  "2024-06 GGT",
                  "142 U/L"
                ]
              ]
            },
            "imaging": {
              "summary": "本阶段未复查影像",
              "items": [
                [
                  "说明",
                  "无记录，不等于没做"
                ]
              ]
            },
            "ae": {
              "summary": "偶有腹胀，未处理",
              "items": [
                [
                  "记录",
                  "服药后腹胀，程度自评轻"
                ],
                [
                  "处理原文",
                  "未处理"
                ]
              ]
            },
            "support": {
              "summary": "\"先把药吃顺了再说\"",
              "items": [
                [
                  "患者原话",
                  "先把药吃顺了再说"
                ]
              ]
            }
          }
        },
        {
          "d": "2025-11-06",
          "phase": "讨论加药",
          "text": "医生提到\"还可以加一种药\"，当时没记住名字",
          "detail": {
            "regimen": {
              "summary": "仍在 UDCA 单药",
              "items": [
                [
                  "方案",
                  "未变更"
                ],
                [
                  "医生原话",
                  "如果 ALP 还降不下来，可以考虑加一种药"
                ]
              ]
            },
            "metrics": {
              "summary": "ALP 在 1.8–2.2×ULN 波动",
              "items": [
                [
                  "近三次 ALP",
                  "214 / 246 / 231 U/L"
                ]
              ]
            },
            "imaging": {
              "summary": "无新增影像",
              "items": [
                [
                  "说明",
                  "无记录"
                ]
              ]
            },
            "ae": {
              "summary": "无新增",
              "items": [
                [
                  "说明",
                  "无记录"
                ]
              ]
            },
            "support": {
              "summary": "\"不知道该问什么\"",
              "items": [
                [
                  "患者原话",
                  "不知道该问什么，就点头了"
                ]
              ]
            }
          }
        }
      ],
      "labs": [
        {
          "date": "2026-05-08",
          "items": [
            {
              "code": "ALP",
              "value": 286,
              "unit": "U/L",
              "refLow": 35,
              "refHigh": 120,
              "lab": "市一院检验科"
            },
            {
              "code": "GGT",
              "value": 205,
              "unit": "U/L",
              "refLow": 7,
              "refHigh": 45,
              "lab": "市一院检验科"
            },
            {
              "code": "ALT",
              "value": 57,
              "unit": "U/L",
              "refLow": 7,
              "refHigh": 40,
              "lab": "市一院检验科"
            },
            {
              "code": "AST",
              "value": 42,
              "unit": "U/L",
              "refLow": 13,
              "refHigh": 35,
              "lab": "市一院检验科"
            },
            {
              "code": "TBil",
              "value": 14,
              "unit": "µmol/L",
              "refLow": 0,
              "refHigh": 21,
              "lab": "市一院检验科"
            },
            {
              "code": "ALB",
              "value": 41.9,
              "unit": "g/L",
              "refLow": 40,
              "refHigh": 55,
              "lab": "市一院检验科"
            },
            {
              "code": "PLT",
              "value": 203,
              "unit": "10⁹/L",
              "refLow": 125,
              "refHigh": 350,
              "lab": "市一院检验科"
            },
            {
              "code": "Hb",
              "value": 129,
              "unit": "g/L",
              "refLow": 115,
              "refHigh": 150,
              "lab": "市一院检验科"
            },
            {
              "code": "WBC",
              "value": 5,
              "unit": "10⁹/L",
              "refLow": 3.5,
              "refHigh": 9.5,
              "lab": "市一院检验科"
            },
            {
              "code": "ANC",
              "value": 3,
              "unit": "10⁹/L",
              "refLow": 1.8,
              "refHigh": 6.3,
              "lab": "市一院检验科"
            },
            {
              "code": "Cr",
              "value": 61,
              "unit": "µmol/L",
              "refLow": 41,
              "refHigh": 81,
              "lab": "市一院检验科"
            }
          ]
        },
        {
          "date": "2026-06-08",
          "items": [
            {
              "code": "ALP",
              "value": 255,
              "unit": "U/L",
              "refLow": 35,
              "refHigh": 120,
              "lab": "市一院检验科"
            },
            {
              "code": "GGT",
              "value": 186,
              "unit": "U/L",
              "refLow": 7,
              "refHigh": 45,
              "lab": "市一院检验科"
            },
            {
              "code": "ALT",
              "value": 54,
              "unit": "U/L",
              "refLow": 7,
              "refHigh": 40,
              "lab": "市一院检验科"
            },
            {
              "code": "AST",
              "value": 40,
              "unit": "U/L",
              "refLow": 13,
              "refHigh": 35,
              "lab": "市一院检验科"
            },
            {
              "code": "TBil",
              "value": 13,
              "unit": "µmol/L",
              "refLow": 0,
              "refHigh": 21,
              "lab": "市一院检验科"
            },
            {
              "code": "ALB",
              "value": 43.7,
              "unit": "g/L",
              "refLow": 40,
              "refHigh": 55,
              "lab": "市一院检验科"
            },
            {
              "code": "PLT",
              "value": 197,
              "unit": "10⁹/L",
              "refLow": 125,
              "refHigh": 350,
              "lab": "市一院检验科"
            },
            {
              "code": "Hb",
              "value": 128,
              "unit": "g/L",
              "refLow": 115,
              "refHigh": 150,
              "lab": "市一院检验科"
            },
            {
              "code": "WBC",
              "value": 5,
              "unit": "10⁹/L",
              "refLow": 3.5,
              "refHigh": 9.5,
              "lab": "市一院检验科"
            },
            {
              "code": "ANC",
              "value": 3,
              "unit": "10⁹/L",
              "refLow": 1.8,
              "refHigh": 6.3,
              "lab": "市一院检验科"
            },
            {
              "code": "Cr",
              "value": 61,
              "unit": "µmol/L",
              "refLow": 41,
              "refHigh": 81,
              "lab": "市一院检验科"
            }
          ]
        },
        {
          "date": "2026-07-08",
          "items": [
            {
              "code": "ALP",
              "value": 253,
              "unit": "U/L",
              "refLow": 35,
              "refHigh": 120,
              "lab": "市一院检验科"
            },
            {
              "code": "GGT",
              "value": 179,
              "unit": "U/L",
              "refLow": 7,
              "refHigh": 45,
              "lab": "市一院检验科"
            },
            {
              "code": "ALT",
              "value": 50,
              "unit": "U/L",
              "refLow": 7,
              "refHigh": 40,
              "lab": "市一院检验科"
            },
            {
              "code": "AST",
              "value": 36,
              "unit": "U/L",
              "refLow": 13,
              "refHigh": 35,
              "lab": "市一院检验科"
            },
            {
              "code": "TBil",
              "value": 13,
              "unit": "µmol/L",
              "refLow": 0,
              "refHigh": 21,
              "lab": "市一院检验科"
            },
            {
              "code": "ALB",
              "value": 44,
              "unit": "g/L",
              "refLow": 40,
              "refHigh": 55,
              "lab": "市一院检验科"
            },
            {
              "code": "PLT",
              "value": 197,
              "unit": "10⁹/L",
              "refLow": 125,
              "refHigh": 350,
              "lab": "市一院检验科"
            },
            {
              "code": "Hb",
              "value": 125,
              "unit": "g/L",
              "refLow": 115,
              "refHigh": 150,
              "lab": "市一院检验科"
            },
            {
              "code": "WBC",
              "value": 6,
              "unit": "10⁹/L",
              "refLow": 3.5,
              "refHigh": 9.5,
              "lab": "市一院检验科"
            },
            {
              "code": "ANC",
              "value": 3,
              "unit": "10⁹/L",
              "refLow": 1.8,
              "refHigh": 6.3,
              "lab": "市一院检验科"
            },
            {
              "code": "Cr",
              "value": 60,
              "unit": "µmol/L",
              "refLow": 41,
              "refHigh": 81,
              "lab": "市一院检验科"
            }
          ]
        },
        {
          "date": "2026-08-08",
          "items": [
            {
              "code": "ALP",
              "value": 230,
              "unit": "U/L",
              "refLow": 35,
              "refHigh": 120,
              "lab": "市一院检验科"
            },
            {
              "code": "GGT",
              "value": 167,
              "unit": "U/L",
              "refLow": 7,
              "refHigh": 45,
              "lab": "市一院检验科"
            },
            {
              "code": "ALT",
              "value": 46,
              "unit": "U/L",
              "refLow": 7,
              "refHigh": 40,
              "lab": "市一院检验科"
            },
            {
              "code": "AST",
              "value": 35,
              "unit": "U/L",
              "refLow": 13,
              "refHigh": 35,
              "lab": "市一院检验科"
            },
            {
              "code": "TBil",
              "value": 12,
              "unit": "µmol/L",
              "refLow": 0,
              "refHigh": 21,
              "lab": "市一院检验科"
            },
            {
              "code": "ALB",
              "value": 42.8,
              "unit": "g/L",
              "refLow": 40,
              "refHigh": 55,
              "lab": "市一院检验科"
            },
            {
              "code": "PLT",
              "value": 204,
              "unit": "10⁹/L",
              "refLow": 125,
              "refHigh": 350,
              "lab": "市一院检验科"
            },
            {
              "code": "Hb",
              "value": 130,
              "unit": "g/L",
              "refLow": 115,
              "refHigh": 150,
              "lab": "市一院检验科"
            },
            {
              "code": "WBC",
              "value": 5,
              "unit": "10⁹/L",
              "refLow": 3.5,
              "refHigh": 9.5,
              "lab": "市一院检验科"
            },
            {
              "code": "ANC",
              "value": 3,
              "unit": "10⁹/L",
              "refLow": 1.8,
              "refHigh": 6.3,
              "lab": "市一院检验科"
            },
            {
              "code": "Cr",
              "value": 61,
              "unit": "µmol/L",
              "refLow": 41,
              "refHigh": 81,
              "lab": "市一院检验科"
            }
          ]
        },
        {
          "date": "2026-09-08",
          "items": [
            {
              "code": "ALP",
              "value": 212,
              "unit": "U/L",
              "refLow": 35,
              "refHigh": null,
              "lab": "外院报告（未印上限）"
            },
            {
              "code": "GGT",
              "value": 160,
              "unit": "U/L",
              "refLow": 7,
              "refHigh": 45,
              "lab": "市一院检验科"
            },
            {
              "code": "ALT",
              "value": 46,
              "unit": "U/L",
              "refLow": 7,
              "refHigh": 40,
              "lab": "市一院检验科"
            },
            {
              "code": "AST",
              "value": 32,
              "unit": "U/L",
              "refLow": 13,
              "refHigh": 35,
              "lab": "市一院检验科"
            },
            {
              "code": "TBil",
              "value": 12,
              "unit": "µmol/L",
              "refLow": 0,
              "refHigh": 21,
              "lab": "市一院检验科"
            },
            {
              "code": "ALB",
              "value": 43,
              "unit": "g/L",
              "refLow": 40,
              "refHigh": 55,
              "lab": "市一院检验科"
            },
            {
              "code": "PLT",
              "value": 196,
              "unit": "10⁹/L",
              "refLow": 125,
              "refHigh": 350,
              "lab": "市一院检验科"
            },
            {
              "code": "Hb",
              "value": 127,
              "unit": "g/L",
              "refLow": 115,
              "refHigh": 150,
              "lab": "市一院检验科"
            },
            {
              "code": "WBC",
              "value": 5,
              "unit": "10⁹/L",
              "refLow": 3.5,
              "refHigh": 9.5,
              "lab": "市一院检验科"
            },
            {
              "code": "ANC",
              "value": 3,
              "unit": "10⁹/L",
              "refLow": 1.8,
              "refHigh": 6.3,
              "lab": "市一院检验科"
            },
            {
              "code": "Cr",
              "value": 65,
              "unit": "µmol/L",
              "refLow": 41,
              "refHigh": 81,
              "lab": "市一院检验科"
            }
          ]
        },
        {
          "date": "2026-10-08",
          "items": [
            {
              "code": "ALP",
              "value": 247,
              "unit": "U/L",
              "refLow": 35,
              "refHigh": 120,
              "lab": "市一院检验科"
            },
            {
              "code": "GGT",
              "value": 174,
              "unit": "U/L",
              "refLow": 7,
              "refHigh": 45,
              "lab": "市一院检验科"
            },
            {
              "code": "ALT",
              "value": 49,
              "unit": "U/L",
              "refLow": 7,
              "refHigh": 40,
              "lab": "市一院检验科"
            },
            {
              "code": "AST",
              "value": 39,
              "unit": "U/L",
              "refLow": 13,
              "refHigh": 35,
              "lab": "市一院检验科"
            },
            {
              "code": "TBil",
              "value": 13,
              "unit": "µmol/L",
              "refLow": 0,
              "refHigh": 21,
              "lab": "市一院检验科"
            },
            {
              "code": "ALB",
              "value": 42,
              "unit": "g/L",
              "refLow": 40,
              "refHigh": 55,
              "lab": "市一院检验科"
            },
            {
              "code": "PLT",
              "value": 207,
              "unit": "10⁹/L",
              "refLow": 125,
              "refHigh": 350,
              "lab": "市一院检验科"
            },
            {
              "code": "Hb",
              "value": 127,
              "unit": "g/L",
              "refLow": 115,
              "refHigh": 150,
              "lab": "市一院检验科"
            },
            {
              "code": "WBC",
              "value": 5,
              "unit": "10⁹/L",
              "refLow": 3.5,
              "refHigh": 9.5,
              "lab": "市一院检验科"
            },
            {
              "code": "ANC",
              "value": 3,
              "unit": "10⁹/L",
              "refLow": 1.8,
              "refHigh": 6.3,
              "lab": "市一院检验科"
            },
            {
              "code": "Cr",
              "value": 62,
              "unit": "µmol/L",
              "refLow": 41,
              "refHigh": 81,
              "lab": "市一院检验科"
            }
          ]
        }
      ]
    },
    {
      "key": "B",
      "label": "档案 B · 肝硬化随访",
      "name": "虚构患者乙",
      "age": 61,
      "sex": "女",
      "diagnosedAt": "2018-09-05",
      "startedAt": "2018-09-18",
      "weightKg": 64,
      "antibodies": {
        "ama": "positive",
        "amaM2": "untested",
        "ana": "positive",
        "note": "2018 年报告，AMA-M2 未做"
      },
      "fibrosis": {
        "method": "影像 + 临床",
        "value": "肝硬化（报告原文）",
        "date": "2026-02-11",
        "note": "由报告原文抄录"
      },
      "comorbidity": [
        {
          "name": "甲状腺功能减退",
          "since": "2021",
          "note": "内分泌科，左甲状腺素 50 µg",
          "dept": null,
          "visibility": "shared"
        },
        {
          "name": "骨质疏松",
          "since": "2023",
          "note": "未规律治疗",
          "dept": null,
          "visibility": "shared"
        }
      ],
      "meds": [
        {
          "name": "熊去氧胆酸胶囊",
          "doseText": "250 mg × 6 粒/日",
          "freq": "每日 3 次",
          "startDate": "2018-09-18",
          "approval": "unverified",
          "inUse": true
        },
        {
          "name": "左甲状腺素钠片",
          "doseText": "50 µg 每日 1 次",
          "freq": "每日 1 次（另一科开）",
          "startDate": "2021-05-01",
          "approval": "unverified",
          "inUse": true
        }
      ],
      "adherence": [
        {
          "month": "2026-05",
          "missed": 0
        },
        {
          "month": "2026-06",
          "missed": 1
        },
        {
          "month": "2026-07",
          "missed": 0
        },
        {
          "month": "2026-08",
          "missed": 3
        },
        {
          "month": "2026-09",
          "missed": 0
        },
        {
          "month": "2026-10",
          "missed": 1
        }
      ],
      "regimenChanges": [],
      "symptoms": [
        {
          "date": "2026-10-05",
          "itch": 3,
          "nightWorse": false,
          "scratch": false,
          "sleepBreaks": 0,
          "fatigue": 3,
          "note": "下午就没劲了",
          "visibility": "shared"
        },
        {
          "date": "2026-09-18",
          "itch": 2,
          "nightWorse": false,
          "scratch": false,
          "sleepBreaks": 0,
          "fatigue": 3,
          "note": "",
          "visibility": "shared"
        },
        {
          "date": "2026-08-22",
          "itch": 4,
          "nightWorse": true,
          "scratch": false,
          "sleepBreaks": 1,
          "fatigue": 2,
          "note": "",
          "visibility": "shared"
        },
        {
          "date": "2026-07-11",
          "itch": 2,
          "nightWorse": false,
          "scratch": false,
          "sleepBreaks": 0,
          "fatigue": 2,
          "note": "",
          "visibility": "shared"
        },
        {
          "date": "2026-06-09",
          "itch": 5,
          "nightWorse": true,
          "scratch": true,
          "sleepBreaks": 2,
          "fatigue": 3,
          "note": "天热更痒",
          "visibility": "shared"
        },
        {
          "date": "2026-05-16",
          "itch": 3,
          "nightWorse": false,
          "scratch": false,
          "sleepBreaks": 0,
          "fatigue": 2,
          "note": "",
          "visibility": "shared"
        }
      ],
      "screening": [
        {
          "type": "bone",
          "date": "2026-02-11",
          "result": "股骨颈 T 值 -2.6（报告原文）",
          "detail": "骨科医生说要用骨松的药，尚未开始",
          "sectionTitle": "骨密度"
        },
        {
          "type": "thyroid",
          "date": "2026-09-02",
          "result": "TSH 2.1 mIU/L（参考 0.35–4.94）",
          "detail": "维持原剂量",
          "sectionTitle": "甲状腺功能"
        },
        {
          "type": "endoscopy",
          "date": "2024-11-20",
          "result": "食管下段轻度静脉曲张（报告原文）",
          "detail": "医生建议定期复查",
          "sectionTitle": "胃镜（静脉曲张）"
        },
        {
          "type": "vitamin",
          "date": "2026-02-11",
          "result": "25-OH 维生素 D 14 ng/mL",
          "detail": "",
          "sectionTitle": "脂溶性维生素"
        },
        {
          "type": "liver",
          "date": "2026-09-02",
          "result": "超声：肝表面不平，脾大；未见明确占位",
          "detail": "医生提到半年复查",
          "sectionTitle": "肝脏影像"
        }
      ],
      "questions": [
        {
          "id": "q1",
          "text": "静脉曲张这次要不要再查胃镜？",
          "done": false
        },
        {
          "id": "q2",
          "text": "骨密度 -2.6，需要开始用药吗？",
          "done": false
        },
        {
          "id": "q3",
          "text": "甲状腺的药和肝的药一起吃要注意什么？",
          "done": false
        },
        {
          "id": "q4",
          "text": "肝脏超声多久做一次？",
          "done": true
        }
      ],
      "documents": [
        {
          "id": "d1",
          "name": "2026-09 超声.pdf",
          "date": "2026-09-02",
          "parsed": true,
          "parseState": "parsed"
        },
        {
          "id": "d2",
          "name": "2026-02 骨密度.pdf",
          "date": "2026-02-11",
          "parsed": true,
          "parseState": "parsed"
        }
      ],
      "trials": [
        {
          "id": "t1",
          "title": "【虚构示例】PBC 肝硬化患者长期随访观察研究",
          "source": "ictrp",
          "phase": "观察性",
          "status": "登记状态，未核实",
          "area": "广州"
        }
      ],
      "pathway": [
        {
          "d": "2018-09-18",
          "phase": "开始 UDCA",
          "text": "确诊后即开始单药治疗",
          "detail": {
            "regimen": {
              "summary": "熊去氧胆酸 250 mg × 6 粒/日",
              "items": [
                [
                  "药名",
                  "熊去氧胆酸胶囊"
                ],
                [
                  "剂量原文",
                  "250 mg × 6 粒/日"
                ],
                [
                  "获批状态",
                  "未核实"
                ]
              ]
            },
            "metrics": {
              "summary": "ALP 从 310 降到 168（6 个月）",
              "items": [
                [
                  "2019-03 ALP",
                  "168 U/L"
                ],
                [
                  "2019-03 TBil",
                  "18 µmol/L"
                ]
              ]
            },
            "imaging": {
              "summary": "超声：肝回声增粗",
              "items": [
                [
                  "报告原文",
                  "肝实质回声增粗，脾不大"
                ]
              ]
            },
            "ae": {
              "summary": "无记录",
              "items": [
                [
                  "说明",
                  "无记录"
                ]
              ]
            },
            "support": {
              "summary": "无记录",
              "items": [
                [
                  "说明",
                  "无记录"
                ]
              ]
            }
          }
        },
        {
          "d": "2024-11-20",
          "phase": "发现静脉曲张",
          "text": "胃镜提示轻度静脉曲张，进入并发症随访",
          "detail": {
            "regimen": {
              "summary": "维持 UDCA，未加药",
              "items": [
                [
                  "方案",
                  "未变更"
                ]
              ]
            },
            "metrics": {
              "summary": "血小板 96–118，白蛋白 38–41",
              "items": [
                [
                  "PLT",
                  "96 10⁹/L"
                ],
                [
                  "ALB",
                  "39 g/L"
                ]
              ]
            },
            "imaging": {
              "summary": "胃镜：食管下段轻度静脉曲张",
              "items": [
                [
                  "报告原文",
                  "食管下段可见轻度静脉曲张，红色征阴性"
                ]
              ]
            },
            "ae": {
              "summary": "无记录",
              "items": [
                [
                  "说明",
                  "无记录"
                ]
              ]
            },
            "support": {
              "summary": "\"医生让少吃硬的东西\"",
              "items": [
                [
                  "患者原话",
                  "医生让少吃硬的东西"
                ]
              ]
            }
          }
        },
        {
          "d": "2026-02-11",
          "phase": "骨质疏松评估",
          "text": "骨密度提示骨质疏松，骨科医生说要用骨松的药",
          "detail": {
            "regimen": {
              "summary": "加左甲状腺素（另一科）",
              "items": [
                [
                  "方案变更",
                  "内分泌科加左甲状腺素 50 µg"
                ],
                [
                  "说明",
                  "与肝病科分开开药"
                ]
              ]
            },
            "metrics": {
              "summary": "ALP 1.3–1.5×ULN，PLT 92",
              "items": [
                [
                  "ALP",
                  "178 U/L"
                ],
                [
                  "PLT",
                  "92 10⁹/L"
                ]
              ]
            },
            "imaging": {
              "summary": "骨密度：股骨颈 T -2.6",
              "items": [
                [
                  "报告原文",
                  "股骨颈 T 值 -2.6"
                ]
              ]
            },
            "ae": {
              "summary": "乏力加重",
              "items": [
                [
                  "记录",
                  "自评乏力 3 档（做不了日常）"
                ]
              ]
            },
            "support": {
              "summary": "\"两个科各说各的\"",
              "items": [
                [
                  "患者原话",
                  "两个科各说各的，我自己记"
                ]
              ]
            }
          }
        }
      ],
      "labs": [
        {
          "date": "2026-05-08",
          "items": [
            {
              "code": "ALP",
              "value": 310,
              "unit": "U/L",
              "refLow": 40,
              "refHigh": 135,
              "lab": "区中心医院"
            },
            {
              "code": "GGT",
              "value": 212,
              "unit": "U/L",
              "refLow": 8,
              "refHigh": 50,
              "lab": "区中心医院"
            },
            {
              "code": "ALT",
              "value": 54,
              "unit": "U/L",
              "refLow": 8,
              "refHigh": 45,
              "lab": "区中心医院"
            },
            {
              "code": "AST",
              "value": 48,
              "unit": "U/L",
              "refLow": 14,
              "refHigh": 40,
              "lab": "区中心医院"
            },
            {
              "code": "TBil",
              "value": 20,
              "unit": "µmol/L",
              "refLow": 0,
              "refHigh": 23,
              "lab": "区中心医院"
            },
            {
              "code": "ALB",
              "value": 41.4,
              "unit": "g/L",
              "refLow": 39,
              "refHigh": 54,
              "lab": "区中心医院"
            },
            {
              "code": "PLT",
              "value": 116,
              "unit": "10⁹/L",
              "refLow": 120,
              "refHigh": 340,
              "lab": "区中心医院"
            },
            {
              "code": "Hb",
              "value": 119,
              "unit": "g/L",
              "refLow": 112,
              "refHigh": 148,
              "lab": "区中心医院"
            },
            {
              "code": "WBC",
              "value": 4,
              "unit": "10⁹/L",
              "refLow": 3.4,
              "refHigh": 9.2,
              "lab": "区中心医院"
            },
            {
              "code": "ANC",
              "value": 2,
              "unit": "10⁹/L",
              "refLow": 1.7,
              "refHigh": 6,
              "lab": "区中心医院"
            },
            {
              "code": "Cr",
              "value": 71,
              "unit": "µmol/L",
              "refLow": 40,
              "refHigh": 84,
              "lab": "区中心医院"
            }
          ]
        },
        {
          "date": "2026-06-08",
          "items": [
            {
              "code": "ALP",
              "value": 251,
              "unit": "U/L",
              "refLow": 40,
              "refHigh": 135,
              "lab": "区中心医院"
            },
            {
              "code": "GGT",
              "value": 185,
              "unit": "U/L",
              "refLow": 8,
              "refHigh": 50,
              "lab": "区中心医院"
            },
            {
              "code": "ALT",
              "value": 46,
              "unit": "U/L",
              "refLow": 8,
              "refHigh": 45,
              "lab": "区中心医院"
            },
            {
              "code": "AST",
              "value": 43,
              "unit": "U/L",
              "refLow": 14,
              "refHigh": 40,
              "lab": "区中心医院"
            },
            {
              "code": "TBil",
              "value": 20,
              "unit": "µmol/L",
              "refLow": 0,
              "refHigh": 23,
              "lab": "区中心医院"
            },
            {
              "code": "ALB",
              "value": 41.1,
              "unit": "g/L",
              "refLow": 39,
              "refHigh": 54,
              "lab": "区中心医院"
            },
            {
              "code": "PLT",
              "value": 108,
              "unit": "10⁹/L",
              "refLow": 120,
              "refHigh": 340,
              "lab": "区中心医院"
            },
            {
              "code": "Hb",
              "value": 119,
              "unit": "g/L",
              "refLow": 112,
              "refHigh": 148,
              "lab": "区中心医院"
            },
            {
              "code": "WBC",
              "value": 4,
              "unit": "10⁹/L",
              "refLow": 3.4,
              "refHigh": 9.2,
              "lab": "区中心医院"
            },
            {
              "code": "ANC",
              "value": 2,
              "unit": "10⁹/L",
              "refLow": 1.7,
              "refHigh": 6,
              "lab": "区中心医院"
            },
            {
              "code": "Cr",
              "value": 72,
              "unit": "µmol/L",
              "refLow": 40,
              "refHigh": 84,
              "lab": "区中心医院"
            }
          ]
        },
        {
          "date": "2026-07-08",
          "items": [
            {
              "code": "ALP",
              "value": 199,
              "unit": "U/L",
              "refLow": 40,
              "refHigh": 135,
              "lab": "区中心医院"
            },
            {
              "code": "GGT",
              "value": 164,
              "unit": "U/L",
              "refLow": 8,
              "refHigh": 50,
              "lab": "区中心医院"
            },
            {
              "code": "ALT",
              "value": 42,
              "unit": "U/L",
              "refLow": 8,
              "refHigh": 45,
              "lab": "区中心医院"
            },
            {
              "code": "AST",
              "value": 39,
              "unit": "U/L",
              "refLow": 14,
              "refHigh": 40,
              "lab": "区中心医院"
            },
            {
              "code": "TBil",
              "value": 18,
              "unit": "µmol/L",
              "refLow": 0,
              "refHigh": 23,
              "lab": "区中心医院"
            },
            {
              "code": "ALB",
              "value": 38.3,
              "unit": "g/L",
              "refLow": 39,
              "refHigh": 54,
              "lab": "区中心医院"
            },
            {
              "code": "PLT",
              "value": 100,
              "unit": "10⁹/L",
              "refLow": 120,
              "refHigh": 340,
              "lab": "区中心医院"
            },
            {
              "code": "Hb",
              "value": 119,
              "unit": "g/L",
              "refLow": 112,
              "refHigh": 148,
              "lab": "区中心医院"
            },
            {
              "code": "WBC",
              "value": 4,
              "unit": "10⁹/L",
              "refLow": 3.4,
              "refHigh": 9.2,
              "lab": "区中心医院"
            },
            {
              "code": "ANC",
              "value": 2,
              "unit": "10⁹/L",
              "refLow": 1.7,
              "refHigh": 6,
              "lab": "区中心医院"
            },
            {
              "code": "Cr",
              "value": 68,
              "unit": "µmol/L",
              "refLow": 40,
              "refHigh": 84,
              "lab": "区中心医院"
            }
          ]
        },
        {
          "date": "2026-08-08",
          "items": [
            {
              "code": "ALP",
              "value": 181,
              "unit": "U/L",
              "refLow": 40,
              "refHigh": 135,
              "lab": "区中心医院"
            },
            {
              "code": "GGT",
              "value": 155,
              "unit": "U/L",
              "refLow": 8,
              "refHigh": 50,
              "lab": "区中心医院"
            },
            {
              "code": "ALT",
              "value": 38,
              "unit": "U/L",
              "refLow": 8,
              "refHigh": 45,
              "lab": "区中心医院"
            },
            {
              "code": "AST",
              "value": 35,
              "unit": "U/L",
              "refLow": 14,
              "refHigh": 40,
              "lab": "区中心医院"
            },
            {
              "code": "TBil",
              "value": 17,
              "unit": "µmol/L",
              "refLow": 0,
              "refHigh": 23,
              "lab": "区中心医院"
            },
            {
              "code": "ALB",
              "value": 38.6,
              "unit": "g/L",
              "refLow": 39,
              "refHigh": 54,
              "lab": "区中心医院"
            },
            {
              "code": "PLT",
              "value": 96,
              "unit": "10⁹/L",
              "refLow": 120,
              "refHigh": 340,
              "lab": "区中心医院"
            },
            {
              "code": "Hb",
              "value": 114,
              "unit": "g/L",
              "refLow": 112,
              "refHigh": 148,
              "lab": "区中心医院"
            },
            {
              "code": "WBC",
              "value": 4,
              "unit": "10⁹/L",
              "refLow": 3.4,
              "refHigh": 9.2,
              "lab": "区中心医院"
            },
            {
              "code": "ANC",
              "value": 2,
              "unit": "10⁹/L",
              "refLow": 1.7,
              "refHigh": 6,
              "lab": "区中心医院"
            },
            {
              "code": "Cr",
              "value": 74,
              "unit": "µmol/L",
              "refLow": 40,
              "refHigh": 84,
              "lab": "区中心医院"
            }
          ]
        },
        {
          "date": "2026-09-08",
          "items": [
            {
              "code": "ALP",
              "value": 186,
              "unit": "U/L",
              "refLow": 40,
              "refHigh": null,
              "lab": "外院报告（未印上限）"
            },
            {
              "code": "GGT",
              "value": 145,
              "unit": "U/L",
              "refLow": 8,
              "refHigh": 50,
              "lab": "区中心医院"
            },
            {
              "code": "ALT",
              "value": 36,
              "unit": "U/L",
              "refLow": 8,
              "refHigh": 45,
              "lab": "区中心医院"
            },
            {
              "code": "AST",
              "value": 35,
              "unit": "U/L",
              "refLow": 14,
              "refHigh": 40,
              "lab": "区中心医院"
            },
            {
              "code": "TBil",
              "value": 17,
              "unit": "µmol/L",
              "refLow": 0,
              "refHigh": 23,
              "lab": "区中心医院"
            },
            {
              "code": "ALB",
              "value": 39.2,
              "unit": "g/L",
              "refLow": 39,
              "refHigh": 54,
              "lab": "区中心医院"
            },
            {
              "code": "PLT",
              "value": 94,
              "unit": "10⁹/L",
              "refLow": 120,
              "refHigh": 340,
              "lab": "区中心医院"
            },
            {
              "code": "Hb",
              "value": 111,
              "unit": "g/L",
              "refLow": 112,
              "refHigh": 148,
              "lab": "区中心医院"
            },
            {
              "code": "WBC",
              "value": 4,
              "unit": "10⁹/L",
              "refLow": 3.4,
              "refHigh": 9.2,
              "lab": "区中心医院"
            },
            {
              "code": "ANC",
              "value": 2,
              "unit": "10⁹/L",
              "refLow": 1.7,
              "refHigh": 6,
              "lab": "区中心医院"
            },
            {
              "code": "Cr",
              "value": 70,
              "unit": "µmol/L",
              "refLow": 40,
              "refHigh": 84,
              "lab": "区中心医院"
            }
          ]
        },
        {
          "date": "2026-10-08",
          "items": [
            {
              "code": "ALP",
              "value": 184,
              "unit": "U/L",
              "refLow": 40,
              "refHigh": 135,
              "lab": "区中心医院"
            },
            {
              "code": "GGT",
              "value": 148,
              "unit": "U/L",
              "refLow": 8,
              "refHigh": 50,
              "lab": "区中心医院"
            },
            {
              "code": "ALT",
              "value": 40,
              "unit": "U/L",
              "refLow": 8,
              "refHigh": 45,
              "lab": "区中心医院"
            },
            {
              "code": "AST",
              "value": 36,
              "unit": "U/L",
              "refLow": 14,
              "refHigh": 40,
              "lab": "区中心医院"
            },
            {
              "code": "TBil",
              "value": 18,
              "unit": "µmol/L",
              "refLow": 0,
              "refHigh": 23,
              "lab": "区中心医院"
            },
            {
              "code": "ALB",
              "value": 40.1,
              "unit": "g/L",
              "refLow": 39,
              "refHigh": 54,
              "lab": "区中心医院"
            },
            {
              "code": "PLT",
              "value": 90,
              "unit": "10⁹/L",
              "refLow": 120,
              "refHigh": 340,
              "lab": "区中心医院"
            },
            {
              "code": "Hb",
              "value": 115,
              "unit": "g/L",
              "refLow": 112,
              "refHigh": 148,
              "lab": "区中心医院"
            },
            {
              "code": "WBC",
              "value": 4,
              "unit": "10⁹/L",
              "refLow": 3.4,
              "refHigh": 9.2,
              "lab": "区中心医院"
            },
            {
              "code": "ANC",
              "value": 2,
              "unit": "10⁹/L",
              "refLow": 1.7,
              "refHigh": 6,
              "lab": "区中心医院"
            },
            {
              "code": "Cr",
              "value": 68,
              "unit": "µmol/L",
              "refLow": 40,
              "refHigh": 84,
              "lab": "区中心医院"
            }
          ]
        }
      ]
    }
  ]
}
  root.DEMO = DEMO
})(typeof window !== 'undefined' ? window : globalThis)
