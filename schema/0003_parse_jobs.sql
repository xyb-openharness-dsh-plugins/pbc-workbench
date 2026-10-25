-- 0003：解析任务台账（六部件第 6 件，starter docs/18 §14）
--
-- 为什么必须有这张表：解析是**外部异步任务**（MinerU 排队 + 轮询），
-- 失败会失败在三种完全不同的地方——没 Token、上游拒绝、抽不到表格。
-- 只用 `documents.parse_state` 一个字段表达不了"重试了几次、上次为什么失败"，
-- 于是用户看到的是"又失败了"，而我们知道的信息全在日志里、转头就没了。
--
-- 三条规矩：
-- 1. **重试新增一行，旧行保留**：台账是历史，不是状态机。删旧行等于丢掉"上次怎么坏的"。
-- 2. **不把"解析中"写进 documents.parse_state**：那份文档可能只是排队，
--    进程重启后就永远停在 parsing。tasks 表记录运行态，documents 只记结果。
-- 3. `document_id` 可空：解析失败到连 document 都没建出来时（比如 Token 就错），
--    这次尝试仍然值得留一条。但这样就不能用外键 ON DELETE CASCADE 去清——
--    所以这里**不建外键约束**，由导入服务自己保证一致性（见 dsh/import.js 的 #startJob/#finishJob）。

CREATE TABLE parse_jobs (
  id           INTEGER PRIMARY KEY,
  document_id  INTEGER,
  profile_key  TEXT,
  kind         TEXT NOT NULL DEFAULT 'mineru' CHECK (kind IN ('mineru','manual')),
  state        TEXT NOT NULL DEFAULT 'running' CHECK (state IN ('running','success','partial','failed','abandoned')),
  source_name  TEXT,                    -- 原始文件名（不含路径）
  note         TEXT,                    -- 失败原因或结果摘要，**只写人话，不写堆栈**
  created_at   TEXT NOT NULL,
  finished_at  TEXT
);

CREATE INDEX idx_parse_jobs_document ON parse_jobs(document_id);
CREATE INDEX idx_parse_jobs_created ON parse_jobs(created_at);
