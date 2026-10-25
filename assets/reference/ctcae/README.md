# CTCAE v5.0 参考件（本仓唯一分级依据）

- 文件：`CTCAE_v5.0_Quick_Reference_5x7.pdf`
- 来源：美国国家癌症研究所（NCI）公开发布的 CTCAE v5.0 Quick Reference（5x7 版）
- 用途：**只做"对照"**，不做诊断、不做处置。界面徽章固定写「对照 CTCAE v5.0 · N 级」。
- 本仓只启用**有绝对数值界限**的项（见 `docs/METRIC-GRADING.md` §2）；"×ULN"型必须用这次化验单自带的参考上限。
- 原件与代码冲突时：**以本 PDF 为准，改代码**（阈值表在 `dsh/ctcae.js` 只留一份，注释指向本文件）。
- 说明：该 PDF 为家族内共用标准件（与 breast-cancer-workbench 同一份公开文件），非病种内容，不构成跨仓内容复制。
