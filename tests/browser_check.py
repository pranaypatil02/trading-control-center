"""Drives the prototype in a real browser.

`tests/render_check.js` proves every route *renders*; it cannot see layout,
real event wiring, the walkthrough spotlight, or a table clipped by its own
panel. This drives Chromium over the built artifact and asserts the things only
a browser can answer.

    pip install playwright && playwright install chromium
    python3 tests/browser_check.py

Prints CONSOLE and FAIL lines; exits non-zero.
"""
from __future__ import annotations

import pathlib
import sys

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

DOCS = pathlib.Path(__file__).resolve().parent.parent / "docs"
BASE = (DOCS / "index.html").as_uri()
VIEWS = ["dashboard", "verified", "books", "strategies", "jobs", "portfolio",
         "analyzer", "matrix", "seasonality", "reports", "agent"]

errors: list[str] = []
failures: list[str] = []


def fail(message: str) -> None:
    failures.append(message)


def click(page, selector: str, what: str) -> bool:
    """A missing click target is a finding, not a crash.

    The first version let Playwright's timeout propagate, so removing a
    drill-down link produced a stack trace and no FAIL line -- which reads as
    the harness being broken rather than the prototype.
    """
    try:
        page.click(selector, timeout=3000)
        return True
    except PlaywrightError:
        fail(f"{what}: nothing matched {selector!r}")
        return False


def main() -> int:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        page.goto(BASE)
        page.wait_for_timeout(400)
        if len(page.inner_text("#view-root")) < 500:
            fail("the dashboard rendered almost no text")

        # --- the rail navigates and names where it went -------------------
        if click(page, '[data-view="verified"]', "rail navigation"):
            page.wait_for_timeout(250)
            if "verified" not in page.url:
                fail(f"rail navigation did not set the hash ({page.url})")
            if "Reversal evidence broke down" not in page.inner_text("#view-root"):
                fail("the verification claim rows are missing in the browser")

        # --- two levels down, by clicking rather than by URL --------------
        level0 = page.url
        if click(page, "table.wide tbody tr.clickable >> nth=0", "level 1 drill-down"):
            page.wait_for_timeout(250)
            if page.url == level0:
                fail("the level 1 click did not navigate")
            level1 = page.url
            if page.locator("nav.crumbs").count() == 0:
                fail("level 1 has no breadcrumb")
            if click(page, ".two-up table tbody tr.clickable >> nth=0", "level 2 drill-down"):
                page.wait_for_timeout(250)
                if page.url == level1:
                    fail("the level 2 click did not navigate")
                links = page.locator("nav.crumbs button").count()
                if links < 2:
                    fail(f"the level 2 breadcrumb has {links} links back, expected 2")
                # Every level is a URL, so the browser's own back button is the
                # back button -- no bespoke history stack to disagree with it.
                page.go_back()
                page.wait_for_timeout(300)
                if page.url != level1:
                    fail(f"the back button did not return to level 1 ({page.url})")

        # --- the guided walkthrough advances, navigates and highlights ----
        page.goto(BASE)
        page.wait_for_timeout(300)
        if click(page, "#tour-button", "walkthrough"):
            page.wait_for_timeout(700)
            if page.locator(".tour-card").count() == 0:
                fail("the walkthrough did not open")
            first = page.inner_text("#tour-title")
            opacity = float(page.evaluate("getComputedStyle(document.querySelector('.tour-spot')).opacity"))
            if opacity < 0.5:
                fail(f"walkthrough step 1 drew no spotlight (opacity {opacity})")
            for _ in range(5):
                page.click(".tour-next")
                page.wait_for_timeout(600)
            if page.inner_text("#tour-title") == first:
                fail("the walkthrough did not advance")
            if "verified" not in page.url and "books" not in page.url:
                fail(f"the walkthrough did not navigate ({page.url})")
            page.click(".tour-close")
            page.wait_for_timeout(200)
            if not page.locator(".tour").is_hidden():
                fail("the walkthrough did not close")

        # --- search is a palette: it navigates, never injects --------------
        page.goto(BASE)
        page.wait_for_timeout(250)
        page.fill("#global-search", "52w")
        page.wait_for_timeout(250)
        if page.locator(".search-result").count() == 0:
            fail("global search returned nothing for a term known to be indexed")
        elif click(page, ".search-result >> nth=0", "search result"):
            page.wait_for_timeout(250)
            if page.url.endswith("index.html") or page.url.endswith("#dashboard"):
                fail("the search result did not navigate")

        # --- every screen holds up at desktop and phone width -------------
        for width in (1440, 390):
            page.set_viewport_size({"width": width, "height": 900})
            for view in VIEWS:
                page.goto(f"{BASE}#{view}")
                page.wait_for_timeout(180)
                if len(page.inner_text("#view-root")) < 300:
                    fail(f"#{view} at {width}px rendered almost no text")
                overflow = page.evaluate(
                    "document.documentElement.scrollWidth - document.documentElement.clientWidth")
                if overflow > 4:
                    fail(f"#{view} overflows {overflow}px horizontally at {width}px")
                # A wide table inside a panel was *clipped* rather than
                # scrollable, because the panel sets overflow:hidden -- so the
                # right-hand columns were unreachable at phone width with
                # nothing on the page indicating they existed.
                panel = page.locator("section.panel:has(> table.wide)").first
                if panel.count():
                    hidden = panel.evaluate("el => el.scrollWidth - el.clientWidth")
                    if hidden > 0:
                        panel.evaluate("el => el.scrollLeft = el.scrollWidth")
                        if panel.evaluate("el => el.scrollLeft") <= 0:
                            fail(f"#{view} at {width}px hides {hidden}px of a table that cannot be scrolled")

        # --- charts actually draw ----------------------------------------
        page.set_viewport_size({"width": 1440, "height": 900})
        page.goto(f"{BASE}#books/new_52w_low_short/overview")
        page.wait_for_timeout(300)
        if page.locator("svg.chart-svg path.chart-line").count() == 0:
            fail("the book equity curve drew no line")
        if page.locator("svg.chart-svg path.chart-benchmark").count() == 0:
            fail("the book equity curve drew no benchmark")

        browser.close()

    for err in errors[:10]:
        print(f"CONSOLE {err}")
    for item in failures:
        print(f"FAIL   {item}")
    print(f"\n{len(errors)} console errors · {len(failures)} failures")
    return 1 if (errors or failures) else 0


if __name__ == "__main__":
    sys.exit(main())
