#!/usr/bin/env python3
"""开发版无头探针：真起 dev-server，浏览器里逐页走一遍。

与 probe-prototype.py 的分工：
  - probe-prototype.py 打的是 `file://` 打开的原型，验的是"视觉基准本身对不对"；
  - 本脚本打的是 `http://127.0.0.1:<port>` 上的**开发版**（public/ + 同一份 API），
    验的是"接上真实接口之后，页面还对不对"。

这两个必须分开跑。原型能过不代表开发版能过 —— 开发版多了三条新链路：
  ① 数据从接口来（`DATA_SOURCE='api'`），不是 `window.DEMO`；
  ② 静态资源挂在 `/api/<slug>/ui/` 子路径下，前缀剥错会"页面能开、脚本全 404"；
  ③ 页面里的按钮改为派发 `pbc:agent-draft` 事件，不再本地造回复。

判据（每条都要能 FAIL）：
  A1 页面标题与版本号可见，且渠道词是「开发版」不是「原型」
  A2 数据来源横幅显示「已连上本机资料库」（api 态），不是演示态
  A3 9 个一级 × 30 个二级全部可达，无空视图
  A4 至少一处趋势图 path≥3（说明真数据画出来了，不是占位）
  A5 折叠卡 3 张、默认全收起、展开后 5 块
  A6 AI 一键把提示词+病情上下文放进 `#agent-text`，且**不自动发送**
  A7 三档宽度无横向溢出（1280/1024/760）
  A8 页面报错 / console error / 失败请求均为 0
  A9 静态资源全部 200（漏剥前缀的头号症状就是这里 404）
  A10 **记一次痒真的写进库**（点保存 → 再吞一次 bootstrap → 症状条数 +1）。
      这是闭环的"记录"半环：独立评审实测出前端只写内存、刷新即丢。
"""
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def wait_health(base: str, timeout=25.0) -> dict:
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{base}/api/pbc-workbench/health", timeout=2) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa: BLE001 - 启动期一律重试，最终报最后一次原因
            last = e
            time.sleep(0.25)
    raise SystemExit(f"dev-server 没起来：{last}")


def main() -> int:
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    env = dict(os.environ, PORT=str(port))
    proc = subprocess.Popen(
        ["node", "--disable-warning=ExperimentalWarning", "scripts/dev-server.mjs"],
        cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    problems: list[str] = []
    try:
        health = wait_health(base)
        if not health.get("ok"):
            problems.append(f"health.ok 不是 true：{health}")
        ui_base = base + health["ui"]

        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            try:
                browser = p.chromium.launch(channel="chrome")
            except Exception:
                browser = p.chromium.launch(
                    executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
                )
            page = browser.new_page(viewport={"width": 1440, "height": 940})
            page_errors, console_errors, failed = [], [], []
            page.on("pageerror", lambda e: page_errors.append(str(e)))
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            page.on("requestfailed", lambda r: failed.append(f"{r.url} :: {r.failure}"))

            non200 = []

            def on_response(resp):
                if resp.status >= 400:
                    non200.append(f"{resp.status} {resp.url}")

            page.on("response", on_response)
            page.goto(f"{ui_base}/index.html", wait_until="networkidle")
            page.wait_for_timeout(600)

            # A1 渠道词与版本号
            title = page.title()
            chip = page.inner_text("#version-chip").strip()
            if "开发版" not in title:
                problems.append(f"A1 title 不是开发版：{title}")
            if "原型" in chip or "开发版" not in chip:
                problems.append(f"A1 版本徽标渠道词不对：{chip}")
            if not re.search(r"v\d+\.\d+\.\d+", chip):
                problems.append(f"A1 版本徽标里没有版本号：{chip}")

            # A2 数据来源：接口态的正确表现是**没有横幅**（横幅只在没连上/库空时出现），
            #     外加会话区那条"AI 对话在右侧原生面板"的说明——它只在 DATA_SOURCE==='api' 时渲染。
            banner_el = page.query_selector("#source-banner")
            if banner_el is not None:
                problems.append(f"A2 出现了数据来源横幅，说明没连上接口：{banner_el.inner_text()[:80]}")
            agent_text = page.inner_text("#agent-body")
            if "在右侧原生面板" not in agent_text:
                problems.append(f"A2 会话区没走接口态（应显示原生面板说明，见到的前 80 字：{agent_text[:80]}）")
            banner = page.evaluate("() => document.body.innerText.slice(0, 400)")

            # A3 9 一级 × 30 二级
            nav_count = page.eval_on_selector_all("#sidenav [data-view]", "els => els.length")
            if nav_count != 9:
                problems.append(f"A3 一级数量 {nav_count} != 9")

            views = page.evaluate("() => JSON.parse(JSON.stringify(window.__NAV_KEYS__ || []))")
            if not views:
                # 页面没暴露 NAV 时退化为逐项点击（仍要覆盖 30 个二级）
                views = []
            visited, empty = 0, []
            nav_items = page.eval_on_selector_all("#sidenav [data-view]", "els => els.map(e => e.dataset.view)")
            for view in nav_items:
                page.click(f'#sidenav [data-view="{view}"]')
                page.wait_for_timeout(30)
                subs = page.eval_on_selector_all("#subtabs [data-sub]", "els => els.map(e => e.dataset.sub)")
                for sub in subs:
                    sel = f'#subtabs [data-sub="{sub}"]'
                    if page.query_selector(sel):
                        page.click(sel)
                    page.wait_for_timeout(25)
                    text = page.inner_text("#view").strip()
                    visited += 1
                    if len(text) < 20:
                        empty.append(f"{view}/{sub}")
            if visited != 30:
                problems.append(f"A3 走了 {visited} 个二级视图（应为 30）")
            if empty:
                problems.append(f"A3 这些二级视图是空的：{empty}")

            # A4 趋势图（回到生化线视图）
            page.click('#sidenav [data-view="labs"]')
            page.wait_for_timeout(60)
            if page.query_selector('#subtabs [data-sub="chart"]'):
                page.click('#subtabs [data-sub="chart"]')
            page.wait_for_timeout(200)
            chart_state = page.evaluate(
                """() => {
                  const svg = document.querySelector('svg.chart');
                  if (!svg) return { found: false, paths: 0 };
                  return { found: true, paths: svg.querySelectorAll('path').length };
                }"""
            )
            if not chart_state["found"]:
                problems.append("A4 没找到 svg.chart")
            elif chart_state["paths"] < 3:
                problems.append(f"A4 趋势图 path 只有 {chart_state['paths']} 条（应≥3）")

            # A5 折叠卡
            page.click('#sidenav [data-view="treatment"]')
            page.wait_for_timeout(60)
            if page.query_selector('#subtabs [data-sub="pathway"]'):
                page.click('#subtabs [data-sub="pathway"]')
            page.wait_for_timeout(150)
            folds = page.query_selector_all("details.phase-fold")
            opened = page.eval_on_selector_all("details.phase-fold", "els => els.filter(e => e.open).length")
            if len(folds) != 3:
                problems.append(f"A5 折叠卡 {len(folds)} 张（应为 3）")
            if opened != 0:
                problems.append(f"A5 默认展开了 {opened} 张（应全收起）")
            blocks = 0
            if folds:
                page.eval_on_selector_all("details.phase-fold", "els => els.forEach(e => { e.open = true })")
                page.wait_for_timeout(80)
                blocks = page.eval_on_selector_all("details.phase-fold .pd-block", "els => els.length")
                if blocks != 15:
                    problems.append(f"A5 三张展开后共 {blocks} 块（应为 15 = 3×5）")

            # A6 AI 一键：进输入框、带病情上下文、不自动发送
            #     先切到有「AI 帮我填」按钮的视图（痒与累·今天的痒），不能随手停在某一页上找。
            page.click('#sidenav [data-view="symptoms"]')
            page.wait_for_timeout(60)
            if page.query_selector('#subtabs [data-sub="itch"]'):
                page.click('#subtabs [data-sub="itch"]')
            page.wait_for_timeout(150)
            page.evaluate(
                """() => {
                  window.__autoSent = false;
                  const btn = document.querySelector('#agent-send');
                  if (btn) btn.addEventListener('click', () => { window.__autoSent = true }, true);
                }"""
            )
            draft_btn = page.query_selector("[data-draft]")
            if not draft_btn:
                problems.append("A6 没找到任何 AI 一键按钮")
            else:
                draft_btn.click()
                page.wait_for_timeout(250)
                text = page.input_value("#agent-text")
                if "病情上下文" not in text:
                    problems.append("A6 一键生成的草稿里没有【病情上下文】")
                if page.evaluate("() => window.__autoSent") is True:
                    problems.append("A6 草稿被自动发送了（必须等用户按回车）")

            # A10 记一次痒：真的落库（不是 toast 说"仅本页内存"）
            symptom_write = None
            #     判据取 bootstrap 里的症状条数：点之前吞一次、点之后再吞一次，必须 +1。
            page.click('#sidenav [data-view="symptoms"]')
            page.wait_for_timeout(60)
            if page.query_selector('#subtabs [data-sub="itch"]'):
                page.click('#subtabs [data-sub="itch"]')
            page.wait_for_timeout(150)
            # 页面的 apiUrl/state 都在 IIFE 里，探针拿不到；直接按 URL 自己拼接口地址。
            fetch_bootstrap = """async () => {
                  const base = location.pathname.replace(/\\/ui\\/.*$/, '');
                  const r = await fetch(base + '/bootstrap');
                  const d = await r.json();
                  const key = window.__probeKey;
                  return d.profiles.find((p) => p.key === key).symptoms.length;
                }"""
            page.evaluate("() => { window.__probeKey = document.querySelector('.profile-btn') ? null : null }")
            # 档案 key 从 bootstrap 里第一条取（页面默认选第一条）
            page.evaluate("""async () => {
                  const base = location.pathname.replace(/\\/ui\\/.*$/, '');
                  const d = await (await fetch(base + '/bootstrap')).json();
                  window.__probeKey = d.profiles[0].key;
                }""")
            before_sym = page.evaluate(fetch_bootstrap)
            if not page.query_selector('#save-itch'):
                problems.append("A10 找不到「保存这一次」按钮")
            else:
                page.fill('#itch', '8')
                page.fill('#note', '探针记的一条-不要留下来')
                page.click('#save-itch')
                page.wait_for_timeout(600)
                after_sym = page.evaluate(fetch_bootstrap)
                symptom_write = {"before": before_sym, "after": after_sym}
                if after_sym != before_sym + 1:
                    problems.append(
                        f"A10 记一次痒后症状条数没变（{before_sym} → {after_sym}）：保存还是只写内存"
                    )

            # A7 三档宽度无横向溢出
            overflow = {}
            for w in (1280, 1024, 760):
                page.set_viewport_size({"width": w, "height": 900})
                page.wait_for_timeout(180)
                over = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
                overflow[str(w)] = over
                if over > 1:
                    problems.append(f"A7 {w}px 下横向溢出 {over}px")
            page.set_viewport_size({"width": 1440, "height": 940})

            # A8 报错
            if page_errors:
                problems.append(f"A8 页面报错：{page_errors}")
            if console_errors:
                problems.append(f"A8 console error：{console_errors[:3]}")
            if failed:
                problems.append(f"A8 失败请求：{failed[:3]}")

            # A9 静态资源全部 200
            if non200:
                problems.append(f"A9 有非 200 响应：{non200[:5]}")

            result = {
                "uiBase": ui_base,
                "title": title,
                "versionChip": chip,
                "dataSourceBanner": banner.split("\n")[0][:80],
                "navCount": nav_count,
                "visited": visited,
                "emptyViews": empty,
                "chartPaths": chart_state["paths"],
                "foldCards": len(folds),
                "foldOpenByDefault": opened,
                "foldBlocks": blocks,
                "draftHasContext": bool(draft_btn) and "病情上下文" in page.input_value("#agent-text"),
                "overflow": overflow,
                "pageErrors": page_errors,
                "consoleErrors": console_errors,
                "failedRequests": failed,
                "non200": non200,
                "symptomWrite": symptom_write,
                "health": health,
                "ok": not problems,
                "problems": problems,
            }
            browser.close()
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if not problems else 1
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=8)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    sys.exit(main())
