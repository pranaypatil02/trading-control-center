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
VIEWS = ["now", "changed", "dashboard", "verified", "books", "strategies", "jobs", "portfolio",
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
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
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
        # The hidden overlay must not swallow clicks on the page behind it —
        # `.palette-wrap{display:flex}` beat the UA's `[hidden]{display:none}`
        # and did exactly that.
        if not page.locator("#palette").is_hidden():
            fail("the palette is visible before anything opened it")
        if click(page, "#search-trigger", "palette trigger"):
            page.wait_for_timeout(250)
            page.fill("#global-search", "52w")
            page.wait_for_timeout(250)
            if page.locator(".search-result").count() == 0:
                fail("the palette returned nothing for a term known to be indexed")
            elif click(page, ".search-result >> nth=0", "search result"):
                page.wait_for_timeout(250)
                if page.url.endswith("index.html") or page.url.endswith("#now"):
                    fail("the search result did not navigate")
                if not page.locator("#palette").is_hidden():
                    fail("the palette stayed open after navigating")
        # A hash change the palette did not initiate — the back button, a
        # pasted URL — must close it too, or it sits over the new screen.
        if click(page, "#search-trigger", "palette trigger"):
            page.wait_for_timeout(200)
            page.evaluate("location.hash = '#jobs'")
            page.wait_for_timeout(350)
            if not page.locator("#palette").is_hidden():
                fail("the palette survived a navigation it did not initiate")

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

        # --- the queue routes you, rather than naming a problem and stopping -
        page.set_viewport_size({"width": 1440, "height": 900})
        page.goto(f"{BASE}#now")
        page.wait_for_timeout(300)
        rows = page.locator("table.queue tbody tr")
        if rows.count() == 0:
            if page.locator(".good-empty").count() == 0:
                fail("an empty queue renders no explicit good-empty state")
        else:
            if page.locator("table.queue .act-btn").count() < rows.count():
                fail("a queue row rendered without a next action")
            # Every row's link must land on the section that owns the number.
            page.locator("table.queue .q-what").first.click()
            page.wait_for_timeout(300)
            if page.url.endswith("#now"):
                fail("a queue row's link did not navigate")
            page.go_back()
            page.wait_for_timeout(250)

        # Copying is the honest alternative to a button this console cannot
        # honour, so it has to actually put the command on the clipboard.
        page.goto(f"{BASE}#now")
        page.wait_for_timeout(300)
        context.grant_permissions(["clipboard-read", "clipboard-write"])
        cmd = page.locator(".act-btn.cmd").first
        if cmd.count():
            expected = cmd.get_attribute("data-copy")
            cmd.click()
            page.wait_for_timeout(400)
            got = page.evaluate("navigator.clipboard.readText()")
            if got != expected:
                fail(f"copying the command put {got!r} on the clipboard, not the command")
            if "/Users/" in (expected or ""):
                fail("a published command carries an absolute local path")

        # --- a conclusion's emphasis must not break its own sentence --------
        # `.insight strong` as a bare descendant rule also caught every
        # <strong> inside the detail paragraph, rendering each as its own 14px
        # block: a sentence became five lines with its full stop stranded on
        # the last one. Invisible to any test that reads source.
        page.goto(f"{BASE}#changed")
        page.wait_for_timeout(300)
        inline = page.evaluate(
            "[...document.querySelectorAll('.insight p strong')]"
            ".every(el => getComputedStyle(el).display === 'inline')")
        if not inline:
            fail("a <strong> inside a conclusion's detail renders as a block, breaking the sentence")

        # --- the delta names its window ------------------------------------
        page.goto(f"{BASE}#changed")
        page.wait_for_timeout(300)
        changed_text = page.inner_text("#view-root")
        if "last completed session" not in changed_text:
            fail("the Changed view does not name its window in the browser")

        # --- the mode switch survives a reload ------------------------------
        page.goto(BASE)
        page.wait_for_timeout(300)
        page.click('[data-mode-btn="overview"]')
        page.wait_for_timeout(350)
        if page.locator(".purpose").count() == 0:
            fail("Overview mode shows no purpose line")
        page.reload()
        page.wait_for_timeout(500)
        if page.locator(".purpose").count() == 0:
            fail("the mode switch did not survive a reload")
        page.click('[data-mode-btn="operator"]')
        page.wait_for_timeout(350)
        if page.locator(".purpose").count() != 0:
            fail("Operator mode still shows the purpose line")

        # --- the palette opens on a key and moves on arrows -----------------
        page.goto(BASE)
        page.wait_for_timeout(300)
        page.keyboard.press("Control+k")
        page.wait_for_timeout(250)
        if page.locator("#palette").is_hidden():
            fail("Ctrl/Cmd-K did not open the palette")
        if page.evaluate("document.activeElement && document.activeElement.id") != "global-search":
            fail("Ctrl/Cmd-K did not focus the palette input")
        # A term that spans several groups, or the rendered order and the
        # relevance order coincide and the assertion below proves nothing.
        page.keyboard.type("valuation")
        page.wait_for_timeout(300)
        if page.locator('.search-result[aria-selected="true"]').count() != 1:
            fail("the palette has no selected option after typing")
        # The cursor indexes `hits`, but rows render grouped — sorted by
        # relevance alone, index 0 highlighted whichever row happened to sit
        # seventh on screen and the arrows walked an invisible order.
        groups = page.locator(".pal-group").count()
        if groups < 2:
            fail(f"the palette ordering check ran over {groups} group(s) — it proves nothing")
        if page.locator(".search-result").first.get_attribute("aria-selected") != "true":
            fail("the palette's selection is not on the first rendered row")
        first = page.locator(".search-result").first.inner_text()
        page.keyboard.press("ArrowDown")
        page.wait_for_timeout(150)
        if page.locator('.search-result[aria-selected="true"]').inner_text() == first:
            fail("ArrowDown did not move the palette selection")
        page.keyboard.press("Enter")
        page.wait_for_timeout(350)
        if page.url.rstrip("#").endswith("index.html"):
            fail("Enter on a palette result did not navigate")
        # `/` is the other way in, and must not fire while typing in a field.
        page.goto(BASE)
        page.wait_for_timeout(250)
        page.keyboard.press("/")
        page.wait_for_timeout(250)
        if page.locator("#palette").is_hidden():
            fail("`/` did not open the palette")
        # Escape must close it, or the overlay traps the reader.
        page.keyboard.press("Escape")
        page.wait_for_timeout(250)
        if not page.locator("#palette").is_hidden():
            fail("Escape did not close the palette")

        # --- raw rows sit behind a default-closed disclosure -----------------
        # The density complaint was never too much data — it was that the
        # finding and the evidence carried equal weight. These two screens are
        # the long ones, so they are where the rule has to hold.
        for view in (f"{BASE}#jobs", f"{BASE}#verified/NEW_52W_LOW"):
            page.goto(view)
            page.wait_for_timeout(300)
            apx = page.locator("details.apx").first
            if apx.count() == 0:
                fail(f"{view} has no disclosure — the long table is still beside the conclusion")
                continue
            if apx.evaluate("el => el.open"):
                fail(f"{view} opens its disclosure by default, so nothing is actually deferred")
            rows_hidden = apx.locator("tbody tr").count()
            apx.locator("summary").click()
            page.wait_for_timeout(250)
            if not apx.evaluate("el => el.open"):
                fail(f"{view} has a disclosure that does not open when clicked")
            if rows_hidden < 5:
                fail(f"{view} defers only {rows_hidden} rows — not worth a disclosure")

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
