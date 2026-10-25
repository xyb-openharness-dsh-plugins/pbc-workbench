-- PBC 工作台 schema 0001（冻结版）
-- 纪律：迁移只增不改；本文件冻结后任何结构变化走 0002_*.sql。
-- 判读列禁止：本 schema 不出现 diagnosis / risk_level / response / stage / grade 一类判定列。
--           分级是**派生值**，读取时由 dsh/ctcae.js 现算，不落库（标准会升版，落库等于把旧标准写成历史事实）。
-- 可选字段一律显式 NULL；"没记" ≠ "阴性" ≠ "正常"。
-- 「using」是 SQLite 保留字，占用字段统一命名 in_use。
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============ 档案级 ============
CREATE TABLE profiles (
  profile_key   TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  age           INTEGER,
  sex           TEXT CHECK (sex IS NULL OR sex IN ('女','男','其他','未填')),
  diagnosed_on  TEXT NOT NULL,
  started_on    TEXT,
  weight_kg     REAL,
  antibody_ama     TEXT NOT NULL DEFAULT 'untested' CHECK (antibody_ama IN ('positive','negative','untested')),
  antibody_ama_m2  TEXT NOT NULL DEFAULT 'untested' CHECK (antibody_ama_m2 IN ('positive','negative','untested')),
  antibody_ana     TEXT NOT NULL DEFAULT 'untested' CHECK (antibody_ana IN ('positive','negative','untested')),
  antibody_note    TEXT,
  antibody_src_doc INTEGER REFERENCES documents(id),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- 纤维化：检查方式与原文分开存；不同方式不互算
CREATE TABLE fibrosis_records (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  method        TEXT NOT NULL CHECK (method IN ('elastography','imaging','biopsy','other','unknown')),
  result_text   TEXT NOT NULL,          -- 报告原文，不解析成分级
  measured_on   TEXT NOT NULL,
  note          TEXT,
  src_doc       INTEGER REFERENCES documents(id),
  ord           INTEGER NOT NULL
);

CREATE TABLE comorbidities (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  name          TEXT NOT NULL,
  since_text    TEXT,
  note          TEXT,
  dept          TEXT,                    -- 哪个科
  visibility    TEXT NOT NULL DEFAULT 'shared' CHECK (visibility IN ('shared','private')),
  ord           INTEGER NOT NULL
);

-- ============ 事实层：文档 / 候选 / 记录 / 指标 ============
CREATE TABLE documents (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  name          TEXT NOT NULL,
  rel_path      TEXT NOT NULL,
  mime          TEXT,
  sha256        TEXT,
  doc_date      TEXT,
  origin        TEXT NOT NULL DEFAULT 'upload' CHECK (origin IN ('upload','manual','demo')),
  parse_state   TEXT NOT NULL DEFAULT 'unparsed' CHECK (parse_state IN ('unparsed','parsing','parsed','failed','partial')),
  parse_note    TEXT,
  created_at    TEXT NOT NULL
);

-- 候选层：AI / MinerU 产出，未确认前不进入事实层
CREATE TABLE parse_candidates (
  id            INTEGER PRIMARY KEY,
  document_id   INTEGER NOT NULL REFERENCES documents(id),
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  code          TEXT NOT NULL,
  value_text    TEXT,                    -- 原样字符串（单位认不出就留空，不猜）
  unit_text     TEXT,
  ref_low_text  TEXT,
  ref_high_text TEXT,
  drawn_on      TEXT,
  state         TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','accepted','rejected','needs_review')),
  note          TEXT,
  created_at    TEXT NOT NULL,
  ord           INTEGER NOT NULL
);

-- 指标抽象：一次化验 = 一个 lab_panel + N 条 lab_item
CREATE TABLE lab_panels (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  drawn_on      TEXT NOT NULL,
  lab_name      TEXT,                    -- 这家实验室的名字（上限跟着它变）
  src_doc       INTEGER REFERENCES documents(id),
  source_kind   TEXT NOT NULL DEFAULT 'manual' CHECK (source_kind IN ('manual','parsed','demo')),
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_lab_panels_profile ON lab_panels(profile_key, drawn_on);

-- ref_low / ref_high 是「这张化验单自带的」，两列都可空；空 ≠ 0（写入前先挡 null/undefined/'' 再 Number）
CREATE TABLE lab_items (
  id            INTEGER PRIMARY KEY,
  panel_id      INTEGER NOT NULL REFERENCES lab_panels(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  value_num     REAL,
  value_text    TEXT,                    -- 非数值（如"阴性"）走这里，value_num 保持 NULL
  unit_text     TEXT,
  ref_low       REAL,
  ref_high      REAL,
  ord           INTEGER NOT NULL
);
CREATE INDEX idx_lab_items_panel ON lab_items(panel_id, ord);
CREATE INDEX idx_lab_items_code ON lab_items(code);

-- 症状（表达面）：患者自评，不套 CTCAE，不落任何 grade
CREATE TABLE symptom_logs (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  logged_on     TEXT NOT NULL,
  itch_0_10     INTEGER CHECK (itch_0_10 IS NULL OR (itch_0_10 >= 0 AND itch_0_10 <= 10)),
  fatigue_1_3   INTEGER CHECK (fatigue_1_3 IS NULL OR fatigue_1_3 BETWEEN 1 AND 3),
  night_worse   INTEGER,                 -- 0/1/NULL（NULL = 没记）
  scratch_skin  INTEGER,
  sleep_breaks  INTEGER,
  note          TEXT,
  visibility    TEXT NOT NULL DEFAULT 'shared' CHECK (visibility IN ('shared','private')),
  created_at    TEXT NOT NULL,
  ord           INTEGER NOT NULL
);
CREATE INDEX idx_symptom_profile ON symptom_logs(profile_key, logged_on);

-- 用药：剂量存"用户抄录的原文"，不换算、不推算
CREATE TABLE medications (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  name          TEXT NOT NULL,
  dose_text     TEXT,                    -- 原文：如"250 mg × 5 片/日"
  freq_text     TEXT,
  start_on      TEXT,
  stop_on       TEXT,
  prescriber_dept TEXT,
  approval_state TEXT NOT NULL DEFAULT 'unverified' CHECK (approval_state IN ('unverified','verified')),
  in_use        INTEGER NOT NULL DEFAULT 1,
  ord           INTEGER NOT NULL
);

CREATE TABLE adherence_events (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  month         TEXT NOT NULL,           -- YYYY-MM
  missed_count  INTEGER NOT NULL DEFAULT 0,
  note          TEXT,
  ord           INTEGER NOT NULL
);

-- 换线记录：只存医生原话与日期，不写应答判定
CREATE TABLE regimen_changes (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  changed_on    TEXT NOT NULL,
  doctor_text   TEXT NOT NULL,
  my_state      TEXT NOT NULL DEFAULT 'unclear' CHECK (my_state IN ('unclear','understood')),
  visibility    TEXT NOT NULL DEFAULT 'shared' CHECK (visibility IN ('shared','private')),
  ord           INTEGER NOT NULL
);

-- 并发症筛查：按系统分节，每节有 *_title 列（分节标题必须落库）
CREATE TABLE screening_sections (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL,
  section_key   TEXT NOT NULL,
  section_title TEXT NOT NULL,
  ord           INTEGER NOT NULL
);
CREATE TABLE screening_records (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  section_key   TEXT NOT NULL,
  done_on       TEXT NOT NULL,
  result_text   TEXT NOT NULL,          -- 报告原文
  detail_text   TEXT,
  dept          TEXT,
  src_doc       INTEGER REFERENCES documents(id),
  ord           INTEGER NOT NULL
);
CREATE INDEX idx_screening_profile ON screening_records(profile_key, section_key, done_on);

-- 分节标题列（读模型直接取，不靠前端硬编码）
CREATE TABLE section_titles (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL,
  scope         TEXT NOT NULL,          -- labs / symptoms / screening / treatment / trials
  section_key   TEXT NOT NULL,
  section_title TEXT NOT NULL,
  ord           INTEGER NOT NULL
);

-- 就诊问题与待办（改=新增版本，不物理删）
CREATE TABLE questions (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  text          TEXT NOT NULL,
  asked         INTEGER NOT NULL DEFAULT 0,
  superseded_by INTEGER REFERENCES questions(id),
  created_at    TEXT NOT NULL,
  ord           INTEGER NOT NULL
);
CREATE TABLE todos (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  text          TEXT NOT NULL,
  due           TEXT,                    -- 一律 NULL：本仓不发提醒
  done          INTEGER NOT NULL DEFAULT 0,
  ord           INTEGER NOT NULL
);

-- 治疗路径折叠卡（32 号模版）：五块 detail 存 JSON，但阶段顺序与日期是列
CREATE TABLE pathway_phases (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  phase_on      TEXT NOT NULL,
  phase_name    TEXT NOT NULL,
  summary_text  TEXT,
  detail_json   TEXT NOT NULL,          -- {regimen,metrics,imaging,ae,support} 各 {summary,items[]}
  ord           INTEGER NOT NULL
);

-- 临床试验（登记状态，未核实）
CREATE TABLE trial_records (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT,                    -- NULL = 全局结果池
  source        TEXT NOT NULL CHECK (source IN ('ictrp','ctv','chictr_online','chictr_offline','chinadrugtrials','xyb_archive')),
  record_id     TEXT NOT NULL,
  title         TEXT NOT NULL,
  phase_text    TEXT,
  area_text     TEXT,
  status_text   TEXT NOT NULL DEFAULT '登记状态，未核实',
  coverage_note TEXT,                    -- 该来源自己的覆盖声明
  fetched_on    TEXT NOT NULL,
  ord           INTEGER NOT NULL,
  UNIQUE (source, record_id)
);
CREATE TABLE trial_bookmarks (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  trial_id      INTEGER NOT NULL REFERENCES trial_records(id),
  note          TEXT,
  created_at    TEXT NOT NULL
);

-- 导出快照（产物）
CREATE TABLE export_snapshots (
  id            INTEGER PRIMARY KEY,
  profile_key   TEXT NOT NULL REFERENCES profiles(profile_key),
  made_at       TEXT NOT NULL,
  data_cutoff   TEXT NOT NULL,
  format        TEXT NOT NULL CHECK (format IN ('txt','md','pdf')),
  rel_path      TEXT,
  sha256        TEXT
);

-- 来源终态（覆盖与完整度一起存）
CREATE TABLE source_states (
  id            INTEGER PRIMARY KEY,
  scope         TEXT NOT NULL,           -- trials
  source        TEXT NOT NULL,
  state         TEXT NOT NULL CHECK (state IN ('ready','timeout','unconfigured','partial','truncated','failed')),
  coverage      TEXT,
  completeness  TEXT,
  checked_on    TEXT NOT NULL,
  note          TEXT,
  UNIQUE (scope, source)
);

CREATE TABLE migrations (
  id            INTEGER PRIMARY KEY,
  applied_at    TEXT NOT NULL,
  checksum      TEXT NOT NULL
);
