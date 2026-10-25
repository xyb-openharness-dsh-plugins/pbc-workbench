-- 0002：演示元数据 + 纤维化检查方式的原文列
--
-- 两条都由"读模型要和 demo-data 逐字段一致"这个契约逼出来的，不是设计时想到的：
--
-- 1. `demo_meta`：`/api/bootstrap` 要回 `demo_meta`（原型里是 `generatedAt` 等），
--    但没有一张表放得下这种"演示批次级别的键值"。不建表就只能硬编码在 JS 里，
--    那等于第二数据源。**只存演示批次信息，不存任何患者事实。**
--
-- 2. `fibrosis_records.method_text`：`method` 是 CHECK 枚举（elastography/imaging/...），
--    但报告上的原文是"瞬时弹性成像""影像 + 临床"。枚举用于筛选与统计，
--    原文用于显示——**不能把原文塞进枚举，也不能只留枚举让界面显示英文代码**。
--    两列并存：`method` 是分类，`method_text` 是原文。

CREATE TABLE demo_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL
);

ALTER TABLE fibrosis_records ADD COLUMN method_text TEXT;
