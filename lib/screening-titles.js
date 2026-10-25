/* 并发症筛查的分节定义 —— **唯一来源**。
 *
 * 三处要用它，且必须完全一致：
 *   1. `dsh/demo.js` 播种时写 `screening_sections` 表
 *   2. `dsh/readmodels.js` 读 `sectionTitle`
 *   3. `demo/build-demo-data.mjs` 生成原型数据时给每条记录带上 `sectionTitle`
 *
 * 三处各写一份中文标题的话，改一处漏两处，界面上就会一节叫"骨骼"、另一节叫"骨密度"——
 * 而且不会报错，只会看起来像两份不同的资料。所以收在这里一份。
 *
 * 顺序即 26 号要求的「按系统分节」顺序，也是库里 `ord` 的顺序。
 */

export const SCREENING_KEYS = Object.freeze(['bone', 'thyroid', 'endoscopy', 'vitamin', 'liver'])

export const SCREENING_TITLES = Object.freeze({
  bone: '骨密度',
  thyroid: '甲状腺功能',
  endoscopy: '胃镜（静脉曲张）',
  vitamin: '脂溶性维生素',
  liver: '肝脏影像',
})

/** 未知 key 原样返回，不编一个"其他"出来：编出来的标题会让人以为那是标准分节。 */
export function screeningTitle(key) {
  return SCREENING_TITLES[key] ?? key
}
