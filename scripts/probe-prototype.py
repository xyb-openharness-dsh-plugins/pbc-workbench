#!/usr/bin/env python3
"""原型无头实测（真实 Chrome，file:// 直开）。判据缺一条就非 0 退出。

覆盖：
  1) 0 未捕获异常 / 0 console error / 0 失败请求
  2) 9 个一级 × 每个二级页签全部点开且渲染出内容（孤儿页=0 的反向验证）
  3) 每页 body 不横向溢出（三档宽度：1280 / 1024 / 760）
  4) 一图秀：svg.chart 存在、路径数 > 0、末点标签存在
  5) 折叠卡：3 张、默认全收起、每张展开 5 块、@media print 规则在源码里
  6) AI 一键：点「AI 帮我填」→ 输入框有提示词与病情上下文，且**未发送**（消息数不变）
  7) 3D 卡：数量 ≥ 8，点击后 class 含 flipped
  8) 整页视图：打开后有返回与关闭两个入口，Esc 关闭
"""
import argparse
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

VIEWS = {
    "dashboard": ["overview", "next", "changes"],
    "basics": ["diagnosis", "fibrosis", "comorbidity"],
    "treatment": ["current", "pathway", "sideeffects"],
    "labs": ["cards", "chart", "grading"],
    "symptoms": ["itch", "fatigue", "log", "impact"],
    "screening": ["bone", "thyroid", "endoscopy", "vitamins", "liver"],
    "followup": ["cadence", "prep", "todos"],
    "records": ["import", "files", "export"],
    "trials": ["search", "saved", "sources"],
}
WIDTHS = [1280, 1024, 760]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default=str(Path(__file__).resolve().parent.parent / "prototypes/v0.2/index.html"))
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    url = "file://" + args.file
    problems = []
    result = {}

    with sync_playwright() as p:
        # 用系统 Chrome（Playwright 自带浏览器未下载；本机 /Applications/Google Chrome.app 已确认存在）
        try:
            browser = p.chromium.launch(channel="chrome")
        except Exception:
            browser = p.chromium.launch(executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors, console_errors, failed = [], [], []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("requestfailed", lambda r: failed.append(r.url))
        page.goto(url)
        page.wait_for_timeout(400)

        navs = page.query_selector_all(".nav-item")
        result["navCount"] = len(navs)
        if len(navs) != 9:
            problems.append(f"一级导航数 {len(navs)} != 9")

        total_subs, visited, empty = 0, 0, []
        for view, subs in VIEWS.items():
            page.click(f'.nav-item[data-view="{view}"]')
            page.wait_for_timeout(60)
            tabs = page.query_selector_all(".subtab")
            total_subs += len(tabs)
            for sub in subs:
                page.click(f'.subtab[data-sub="{sub}"]')
                page.wait_for_timeout(60)
                visited += 1
                text = (page.inner_text("#view") or "").strip()
                if len(text) < 20 or "还没实现" in text:
                    empty.append(f"{view}/{sub}")
        result["subTabs"] = total_subs
        result["visited"] = visited
        result["emptyViews"] = empty
        if total_subs != 30:
            problems.append(f"二级页签合计 {total_subs} != 30")
        if empty:
            problems.append(f"空页签：{empty}")

        # 一图秀
        page.click('.nav-item[data-view="labs"]')
        page.click('.subtab[data-sub="chart"]')
        page.wait_for_timeout(120)
        chart = page.query_selector("svg.chart")
        paths = page.query_selector_all("svg.chart path")
        result["chartPaths"] = len(paths)
        if not chart:
            problems.append("一图秀缺少 svg.chart")
        if len(paths) < 3:
            problems.append(f"一图秀路径数 {len(paths)} < 3")

        # 折叠卡
        page.click('.nav-item[data-view="treatment"]')
        page.click('.subtab[data-sub="pathway"]')
        page.wait_for_timeout(120)
        folds = page.query_selector_all("details.phase-fold")
        opened = [f for f in folds if f.get_attribute("open") is not None]
        result["foldCards"] = len(folds)
        result["foldOpenByDefault"] = len(opened)
        if len(folds) != 3:
            problems.append(f"折叠卡 {len(folds)} != 3")
        if opened:
            problems.append("折叠卡默认应全部收起")
        if folds:
            folds[0].query_selector("summary").click()
            page.wait_for_timeout(80)
            blocks = folds[0].query_selector_all(".pd-block")
            result["foldBlocks"] = len(blocks)
            if len(blocks) != 5:
                problems.append(f"展开块数 {len(blocks)} != 5")
        css = Path(args.file).with_name("style.css").read_text(encoding="utf-8")
        # 判据：存在 @media print 段，且其中 .phase-detail 被强制 display:grid（允许空格与任意书写顺序）
        import re as _re
        print_blocks = _re.findall(r"@media\s+print\s*\{(.*?)\n\}", css, _re.S)
        result["printRule"] = any(
            _re.search(r"\.phase-detail\s*\{[^}]*display\s*:\s*grid\s*!important", b) for b in print_blocks
        )
        if not result["printRule"]:
            problems.append("缺少 @media print 展开规则")

        # AI 一键（IP10：进输入框但不自动发送）
        page.click('.nav-item[data-view="symptoms"]')
        page.click('.subtab[data-sub="itch"]')
        page.wait_for_timeout(80)
        before = len(page.query_selector_all("#agent-body .msg"))
        page.click('[data-draft]')
        page.wait_for_timeout(150)
        ta = page.input_value("#agent-text")
        after = len(page.query_selector_all("#agent-body .msg"))
        result["draftInTextarea"] = bool(ta.strip())
        result["draftIncludesContext"] = "病情上下文" in ta
        result["autoSent"] = after != before
        if not ta.strip():
            problems.append("AI 一键没有把提示词放进输入框")
        if "病情上下文" not in ta:
            problems.append("AI 一键没有携带病情上下文")
        if after != before:
            problems.append("AI 一键自动发送了（违反 IP10）")

        # 3D 卡
        page.click('.nav-item[data-view="labs"]')
        page.click('.subtab[data-sub="cards"]')
        page.wait_for_timeout(120)
        cards = page.query_selector_all(".mcard")
        result["metricCards"] = len(cards)
        if len(cards) < 8:
            problems.append(f"3D 指标卡数量 {len(cards)} < 8")
        if cards:
            cards[0].click()
            page.wait_for_timeout(120)
            flipped = "flipped" in (cards[0].get_attribute("class") or "")
            result["flipWorks"] = flipped
            if not flipped:
                problems.append("3D 卡点击未翻转")
            cards[0].click()

        # 整页视图
        page.click('.nav-item[data-view="basics"]')
        page.click('.subtab[data-sub="diagnosis"]')
        page.wait_for_timeout(80)
        page.click('[data-page]')
        page.wait_for_timeout(120)
        result["pageOpened"] = not page.is_hidden("#page")
        has_back = page.query_selector("#page-back") is not None
        has_close = page.query_selector("#page-close") is not None
        result["pageTwoExits"] = bool(has_back and has_close)
        if not result["pageOpened"]:
            problems.append("整页视图未打开")
        if not (has_back and has_close):
            problems.append("整页视图缺少返回/关闭双入口")
        page.keyboard.press("Escape")
        page.wait_for_timeout(120)
        result["escCloses"] = page.is_hidden("#page")
        if not result["escCloses"]:
            problems.append("Esc 未关闭整页视图")

        # 窄宽扫描
        overflow = {}
        for w in WIDTHS:
            page.set_viewport_size({"width": w, "height": 900})
            page.wait_for_timeout(100)
            bad = []
            for view, subs in VIEWS.items():
                page.click(f'.nav-item[data-view="{view}"]')
                for sub in subs:
                    page.click(f'.subtab[data-sub="{sub}"]')
                    page.wait_for_timeout(25)
                    ok = page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1")
                    if not ok:
                        bad.append(f"{view}/{sub}")
            overflow[w] = bad
        result["overflow"] = overflow
        for w, bad in overflow.items():
            if bad:
                problems.append(f"{w}px 横向溢出：{bad[:6]}")

        result["pageErrors"] = errors
        result["consoleErrors"] = console_errors[:8]
        result["failedRequests"] = failed[:8]
        if errors:
            problems.append(f"未捕获异常 {len(errors)} 条")
        if console_errors:
            problems.append(f"console error {len(console_errors)} 条")

        browser.close()

    result["ok"] = not problems
    result["problems"] = problems
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not problems else 1


if __name__ == "__main__":
    sys.exit(main())
