#!/usr/bin/env python3
"""README 截图（33 号规则）：1440 宽、浅色、真实渲染、版本号可见。

产出 docs/screenshots/readme-<功能>-<版本>.png，并打印每张的说明句。

**截的是开发版，不是原型**（2026-10-25 改）：早先直接截 `file://prototypes/v0.2/index.html`，
图里版本 chip 是「v0.1.0 · 原型」，而 README 宣传的是当前包版本 —— 图与货对不上就是虚报。
现在起一个真 dev-server，从 `/api/pbc-workbench/ui/` 加载开发版：
数据来自真接口（`DATA_SOURCE='api'`），没有"演示数据"横幅，版本 chip 显示当前包版本。
"""
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/screenshots"

# 版本从 lib/version.js 取，不写死：写死就会出现"图是 0.1.0、包是 0.2.4"
_ver = (ROOT / "lib/version.js").read_text(encoding="utf-8")
VERSION = _ver.split("export const version = '")[1].split("'")[0]

SHOTS = [
    ("dashboard", "overview", "dashboard", "看板：今天该做什么、接下来、最近变化，三块并置（不生成结论）"),
    ("symptoms", "itch", "symptom-itch", "痒与累·今天的痒：患者自己打分，AI 不代填；夜间加重与抓痕可勾"),
    ("labs", "cards", "labs-cards", "生化线·指标卡：每张卡带「这张单子的参考上限」，缺上限的显示「需参考上限」"),
    ("labs", "chart", "labs-chart", "一图秀：ALP/GGT/TBil 各自归一化（不可直接比较），治疗节点竖虚线"),
    ("treatment", "pathway", "pathway-closed", "治疗路径折叠卡·收起态：只显示阶段名+日期+一句话"),
    ("screening", "endoscopy", "screening", "并发症筛查：食管胃镜单独成节，显示距上次月数，不替你排检查"),
]

OPEN_SHOT = ("treatment", "pathway", "pathway-open", "治疗路径折叠卡·展开态：固定五块（方案/指标/影像/副作用/心理营养）")


def free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    port = free_port()
    env = dict(os.environ, PORT=str(port))
    proc = subprocess.Popen(
        ["node", "--disable-warning=ExperimentalWarning", "scripts/dev-server.mjs"],
        cwd=str(ROOT), env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    base = f"http://127.0.0.1:{port}"
    health = None
    for _ in range(120):
        try:
            health = json.load(urllib.request.urlopen(base + "/api/pbc-workbench/health", timeout=1))
            break
        except Exception:
            time.sleep(0.2)
    if not health:
        proc.kill()
        print("dev-server 没起来，截图取消（不能拿原型图冒充开发版）", file=sys.stderr)
        return 1
    ui_url = base + health["ui"] + "/index.html"

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome")
        except Exception:
            browser = p.chromium.launch(executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        page = browser.new_page(viewport={"width": 1440, "height": 940}, device_scale_factor=2)
        page.goto(ui_url, wait_until="networkidle")
        page.wait_for_timeout(600)
        # 截图前先确认：真的连上接口了（没连上会有一条"演示数据"横幅，那图不能进 README）
        if page.query_selector("#source-banner"):
            browser.close()
            proc.kill()
            print("页面显示的是演示数据（有来源横幅），截图取消", file=sys.stderr)
            return 1
        chip = page.inner_text("#version-chip")
        if VERSION not in chip:
            browser.close()
            proc.kill()
            print(f"版本 chip 是「{chip}」，与包版本 {VERSION} 不符，截图取消", file=sys.stderr)
            return 1

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
    proc.kill()
    files = sorted(OUT.glob("*.png"))
    print(f"\ntotal {len(files)} screenshots")
    return 0 if len(files) >= 6 else 1


if __name__ == "__main__":
    sys.exit(main())
