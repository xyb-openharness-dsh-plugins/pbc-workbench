#!/usr/bin/env python3
"""README 截图（33 号规则）：1440 宽、浅色、真实渲染、版本号可见。

产出 docs/screenshots/readme-<功能>-<版本>.png，并打印每张的说明句。
截图前先把界面切到目标页签，再整页截取（含顶栏版本 chip）。
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

VERSION = "0.1.0"
ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "prototypes/v0.2/index.html"
OUT = ROOT / "docs/screenshots"

SHOTS = [
    ("dashboard", "overview", "dashboard", "看板：今天该做什么、接下来、最近变化，三块并置（不生成结论）"),
    ("symptoms", "itch", "symptom-itch", "痒与累·今天的痒：患者自己打分，AI 不代填；夜间加重与抓痕可勾"),
    ("labs", "cards", "labs-cards", "生化线·指标卡：每张卡带「这张单子的参考上限」，缺上限的显示「需参考上限」"),
    ("labs", "chart", "labs-chart", "一图秀：ALP/GGT/TBil 各自归一化（不可直接比较），治疗节点竖虚线"),
    ("treatment", "pathway", "pathway-closed", "治疗路径折叠卡·收起态：只显示阶段名+日期+一句话"),
    ("screening", "endoscopy", "screening", "并发症筛查：食管胃镜单独成节，显示距上次月数，不替你排检查"),
]

OPEN_SHOT = ("treatment", "pathway", "pathway-open", "治疗路径折叠卡·展开态：固定五块（方案/指标/影像/副作用/心理营养）")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome")
        except Exception:
            browser = p.chromium.launch(executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        page = browser.new_page(viewport={"width": 1440, "height": 940}, device_scale_factor=2)
        page.goto("file://" + str(INDEX))
        page.wait_for_timeout(500)

        def shoot(view, sub, name, caption):
            page.click(f'.nav-item[data-view="{view}"]')
            page.wait_for_timeout(80)
            page.click(f'.subtab[data-sub="{sub}"]')
            page.wait_for_timeout(200)
            f = OUT / f"readme-{name}-{VERSION}.png"
            page.screenshot(path=str(f))
            print(f"{f.relative_to(ROOT)}\t{caption}")

        for view, sub, name, caption in SHOTS:
            shoot(view, sub, name, caption)

        # 展开态
        page.click('.nav-item[data-view="treatment"]')
        page.click('.subtab[data-sub="pathway"]')
        page.wait_for_timeout(150)
        page.query_selector("details.phase-fold summary").click()
        page.wait_for_timeout(300)
        f = OUT / f"readme-{OPEN_SHOT[2]}-{VERSION}.png"
        page.screenshot(path=str(f))
        print(f"{f.relative_to(ROOT)}\t{OPEN_SHOT[3]}")

        browser.close()
    files = sorted(OUT.glob("*.png"))
    print(f"\ntotal {len(files)} screenshots")
    return 0 if len(files) >= 6 else 1


if __name__ == "__main__":
    sys.exit(main())
