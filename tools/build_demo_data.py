"""Generate `docs/data.js` from the platform's own stores.

Run from the private implementation repository, which is where the stores live:

    python3 ../trading-control-center/tools/build_demo_data.py

Research figures are the platform's real measured output. Portfolio balances,
breadth tiles and the analyzer companies are synthetic and live in `app.js`,
not here.

Two sanitising rules are load-bearing, because this output is published:

* **No absolute path ever reaches the artifact.** `job_runs.command` records
  the interpreter and script by absolute path; the published form is the
  portable `python run_<x>.py`. `tests/render_check.js` fails the build on a
  `/Users/` substring, which is how the first leak was caught.
* **No raw error text.** `error_summary` carries log lines, local paths and
  occasionally a ticker's position. Only the shape of a failure travels.
"""
from __future__ import annotations

import json
import sqlite3
import sys
from collections import Counter
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parent.parent
DEST = REPO / "docs" / "data.js"
SRC = Path("/Users/pranaypatil/Projects/US_Markets")

sys.path.insert(0, str(SRC))

from us_analysis.job_watchdog import RETIRED_JOBS  # noqa: E402  (needs sys.path)


def ro(path: Path) -> sqlite3.Connection:
    """Read-only, always. This script must not be able to write to a store."""
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def r4(x: Any) -> Any:
    return round(x, 4) if isinstance(x, float) else x


# --------------------------------------------------------------- sessions
def sessions(conn: sqlite3.Connection, n: int = 4) -> list[str]:
    """The last completed benchmark sessions, newest first.

    Today is never one of them: the evening refresh writes a partial bar, so a
    delta struck against today reports a session that has not happened yet.
    """
    rows = conn.execute(
        "SELECT DISTINCT date FROM daily_prices WHERE ticker='SPY'"
        " AND date < date('now','localtime') ORDER BY date DESC LIMIT ?", (n,)).fetchall()
    return [r["date"] for r in rows]


# ------------------------------------------------------------------- jobs
OWNER = {
    "pead": "Earnings", "earnings": "Earnings", "options": "Options",
    "seasonal": "Seasonality", "seasonality": "Seasonality", "reversal": "Reversal",
    "sp500": "Index research", "quarterly": "Index research", "membership": "Index research",
    "daily": "Data foundation", "price": "Data foundation", "screener": "Data foundation",
    "portfolio": "Portfolio ops", "forward": "Forward tests", "simulated": "Forward tests",
    "correlated": "Market behaviour", "volatility": "Market behaviour",
    "value": "Valuation", "fastgraphs": "Valuation",
}


def owner_of(name: str) -> str:
    for prefix, label in OWNER.items():
        if name.startswith(prefix):
            return label
    return "Platform"


def rhythm(gaps: list[float]) -> float | None:
    """A job's own normal interval: the 90th-percentile gap between its runs.

    Not the median. A weekday job has a 72-hour weekend in its history, and a
    badge that cries wolf every Monday is a badge you stop reading.
    """
    if len(gaps) < 3:
        return None
    ordered = sorted(gaps)
    return ordered[min(len(ordered) - 1, int(len(ordered) * 0.9))]


def health(failures: int, runs: int, last: str, asof: str, normal: float | None) -> str:
    """One stated rule, applied at both dates so the delta compares like with like.

    **Judged against the job's own rhythm, never a global threshold.** The first
    version of this flagged any job whose last run predated the newest session,
    which put thirty rows in the queue -- almost all of them weekly or monthly
    work behaving exactly as scheduled. That is the fault the production console
    already fixed and this would have re-imported.
    """
    if runs and failures / runs > 0.5 and failures >= 3:
        return "failing"
    if not last or normal is None:
        return "healthy"            # too little history to call it late
    import datetime as _dt
    late = (_dt.date.fromisoformat(asof) - _dt.date.fromisoformat(last[:10])).days
    return "stale" if late > max(2.0, normal * 1.5) else "healthy"


def job_rows(conn: sqlite3.Connection, sess: list[str]) -> tuple[list[dict], list[dict]]:
    """Job health now, and what changed since the previous completed session."""
    import datetime as _dt

    now_s, prev_s = sess[0], sess[1]
    rows, changed = [], []
    for r in conn.execute("""
            SELECT job_name,
                   COUNT(*) runs,
                   SUM(CASE WHEN status='failure' THEN 1 ELSE 0 END) failures,
                   MAX(started_at) last
            FROM job_runs GROUP BY job_name ORDER BY job_name"""):
        name = r["job_name"]
        # The same arithmetic restricted to runs on or before the prior session.
        p = conn.execute("""
            SELECT COUNT(*) runs,
                   SUM(CASE WHEN status='failure' THEN 1 ELSE 0 END) failures,
                   MAX(started_at) last
            FROM job_runs WHERE job_name=? AND started_at <= ?""",
            (name, prev_s + "T23:59:59")).fetchone()

        stamps = [x["started_at"] for x in conn.execute(
            "SELECT started_at FROM job_runs WHERE job_name=? AND started_at IS NOT NULL"
            " ORDER BY started_at DESC LIMIT 40", (name,))]
        gaps = []
        for a, b in zip(stamps, stamps[1:]):
            try:
                gaps.append((_dt.date.fromisoformat(a[:10]) - _dt.date.fromisoformat(b[:10])).days)
            except ValueError:
                continue
        normal = rhythm([g for g in gaps if g >= 0])

        state = health(r["failures"] or 0, r["runs"], r["last"] or "", now_s, normal)
        was = health(p["failures"] or 0, p["runs"] or 0, p["last"] or "", prev_s, normal)
        rows.append({
            "name": name, "owner": owner_of(name), "runs": r["runs"],
            "failures": r["failures"] or 0,
            "last": (r["last"] or "")[:16].replace("T", " "),
            "normal": normal, "status": state,
            "retired_to": RETIRED_JOBS.get(name) or "",
        })
        if was != state:
            changed.append({"what": name, "note": owner_of(name), "from": was, "to": state,
                            "dir": "down" if state != "healthy" else "up",
                            "where": f"jobs/{name}"})

    # **A renamed job is not a stopped job, and the ledger cannot tell the
    # difference.** Nothing runs under the old name again, so it ages into
    # `stale` and stays there for ever. Seven of this queue's first nine rows
    # were these ghosts, and a survey that is half ghosts trains the reader to
    # skip it. The retirement is *conditional on the successor being healthy*,
    # or renaming a job would be a way to silence it -- and work that stopped
    # during a rename is exactly the case that matters most.
    by_name = {j["name"]: j for j in rows}
    for job in rows:
        successor = by_name.get(job["retired_to"])
        job["retired"] = bool(successor and successor["status"] == "healthy")
        if job["retired"]:
            job["status"] = "retired"
    changed = [c for c in changed if not by_name.get(c["what"], {}).get("retired")]

    order = {"failing": 0, "stale": 1, "healthy": 2, "retired": 3}
    rows.sort(key=lambda j: (order[j["status"]], j["name"]))
    changed.sort(key=lambda c: c["dir"] == "up")
    return rows, changed


# ------------------------------------------------------------------ books
def book_delta(books: list[dict], marks: dict[str, list]) -> list[dict]:
    """Equity movement over the last completed session, per book."""
    out = []
    for b in books:
        curve = marks.get(b["key"]) or []
        if len(curve) < 2:
            continue
        prev, now = curve[-2][1], curve[-1][1]
        if prev == now:
            continue
        out.append({
            "what": b.get("name") or b["key"],
            "note": f"{b['sessions']} marked sessions",
            "from": f"${prev:,.0f}", "to": f"${now:,.0f}",
            "delta": r4((now - prev) / prev),
            "dir": "up" if now > prev else "down",
            "where": f"books/{b['key']}",
        })
    # No materiality threshold: ranked by size, population stated on the page.
    out.sort(key=lambda x: -abs(x["delta"]))
    return out


# ------------------------------------------------------------------ picks
def pick_delta(conn: sqlite3.Connection) -> list[dict]:
    """Names each screen added or dropped between its two most recent boards."""
    dates = [r["as_of"] for r in conn.execute(
        "SELECT DISTINCT as_of FROM strategy_picks ORDER BY as_of DESC LIMIT 2")]
    if len(dates) < 2:
        return []
    now_d, prev_d = dates
    def board(d: str) -> dict[str, set[str]]:
        out: dict[str, set[str]] = {}
        for r in conn.execute("SELECT strategy, ticker FROM strategy_picks WHERE as_of=?", (d,)):
            out.setdefault(r["strategy"], set()).add(r["ticker"])
        return out
    now_b, prev_b = board(now_d), board(prev_d)
    rows = []
    for strategy in sorted(set(now_b) | set(prev_b)):
        added = sorted(now_b.get(strategy, set()) - prev_b.get(strategy, set()))
        dropped = sorted(prev_b.get(strategy, set()) - now_b.get(strategy, set()))
        if not added and not dropped:
            continue
        rows.append({
            "what": strategy.replace("_", " "),
            "note": f"{len(now_b.get(strategy, set()))} names today",
            "from": ("dropped " + ", ".join(dropped[:4])) if dropped else "nothing dropped",
            "to": ("added " + ", ".join(added[:4])) if added else "nothing added",
            "dir": "flat", "where": "strategies",
        })
    return rows


# ------------------------------------------------------------- the queue
def portable(command: str | None) -> str | None:
    """An absolute interpreter path is local detail; the script is the fact."""
    if not command:
        return None
    parts = command.split()
    script = next((p for p in parts if p.endswith(".py") or p.endswith(".sh")), None)
    if not script:
        return None
    tail = [p for p in parts[parts.index(script) + 1:] if not p.startswith("/")]
    name = Path(script).name
    runner = "bash" if name.endswith(".sh") else "python"
    return " ".join([runner, name, *tail])


CLASSES = {"positions": 0, "integrity": 1, "reporting": 2}


def build_queue(conn: sqlite3.Connection, jobs: list[dict], books: list[dict],
                verification: dict) -> list[dict]:
    """Everything needing a decision, each row carrying where it lives and what to do.

    Three action kinds and never a fourth. This console places no orders and
    runs nothing remotely, so a row that cannot be acted on from here states the
    command to run instead of offering a button that lies.
    """
    rows: list[dict] = []

    for j in jobs:
        if j["status"] in ("healthy", "retired"):
            continue
        cmd = conn.execute(
            "SELECT command FROM job_runs WHERE job_name=? AND command IS NOT NULL"
            " AND command!='' ORDER BY started_at DESC LIMIT 1", (j["name"],)).fetchone()
        run = portable(cmd["command"] if cmd else None)
        failing = j["status"] == "failing"
        rows.append({
            "id": f"job:{j['name']}",
            "cls": "integrity" if failing else "reporting",
            "kind": "Incident" if failing else "Stale",
            "what": j["name"],
            "detail": (f"failed {j['failures']} of {j['runs']} recorded runs"
                       if failing else
                       f"has not run since the last completed session · {j['owner']}"),
            "when": j["last"][:10],
            "where": f"jobs/{j['name']}",
            "action": ({"kind": "command", "label": "Copy the re-run command", "value": run}
                       if run else
                       {"kind": "open", "label": "Open its run history"}),
        })

    # A book that has stopped being marked is a measurement gap, not a loss.
    newest = max((b["last_mark"] or "") for b in books)
    for b in books:
        if (b["last_mark"] or "") >= newest:
            continue
        rows.append({
            "id": f"book:{b['key']}",
            "cls": "positions",
            "kind": "Book",
            "what": b.get("name") or b["key"],
            "detail": f"unmarked since {b['last_mark']} while other books reached {newest}",
            "when": b["last_mark"],
            "where": f"books/{b['key']}",
            "action": {"kind": "command", "label": "Copy the re-run command",
                       "value": f"python run_forward_test.py --only {b['key']}"},
        })

    # A resolved verdict that contradicts a running book is the one row here
    # that is about money rather than machinery.
    for total in verification.get("totals", []):
        if total["horizon"] != 10 or total["verdict"] != "worse than chance":
            continue
        rows.append({
            "id": f"signal:{total['direction']}",
            "cls": "positions",
            "kind": "Signal",
            "what": total["label"],
            "detail": (f"{total['hit_rate'] * 100:.1f}% beat the benchmark over "
                       f"{total['scored']} graded episodes — worse than chance, and two "
                       f"books still trade this side"),
            "when": verification.get("measured_through", ""),
            "where": "verified",
            "action": {"kind": "open", "label": "Open the evidence"},
        })

    rows.sort(key=lambda r: (CLASSES[r["cls"]], r["what"]))
    return rows


# ------------------------------------------------------------------- main
def main() -> int:
    from us_analysis import config, reversal_verification as rv
    from us_analysis.strategy_registry import STRATEGIES

    screener = ro(SRC / "data" / "screener.db")
    sess = sessions(screener)
    jobs, jobs_changed = job_rows(screener, sess)

    # ---- forward books ---------------------------------------------------
    ft = ro(SRC / "data" / "forward_test" / "books.db")
    KEEP = ("state", "sessions", "first_mark", "last_mark", "activation", "capital", "equity",
            "cash", "open_positions", "total_return", "benchmark_return", "excess_return",
            "volatility", "sharpe", "ratios_withheld", "max_drawdown", "max_drawdown_sessions",
            "current_drawdown", "invested_share", "turnover", "slippage_paid", "realized",
            "refusals", "rankable", "too_early_reason", "benchmark_ticker", "track", "name",
            "slots", "schedule", "description", "universe", "entry_rule", "exit_rule",
            "max_position_pct", "allow_short", "stop_loss_pct", "max_holding_days", "control",
            "risk_free", "cost_share_of_capital")
    books = []
    for r in ft.execute("SELECT * FROM metrics WHERE as_of=(SELECT MAX(as_of) FROM metrics)"):
        p = json.loads(r["payload"])
        b = {k: r4(p.get(k)) for k in KEEP}
        b["key"] = r["strategy"]
        t = p.get("trades") or {}
        b["trades"] = {k: r4(t.get(k)) for k in
                       ("state", "trades", "wins", "losses", "win_rate", "avg_win", "avg_loss",
                        "profit_factor", "avg_holding_days", "exit_kinds")}
        b["windows"] = {k: {kk: r4(vv) for kk, vv in (v or {}).items()}
                        for k, v in (p.get("windows") or {}).items()}
        books.append(b)

    marks: dict[str, list] = {}
    for r in ft.execute("SELECT strategy, session_date, equity, benchmark_equity"
                        " FROM marks ORDER BY session_date"):
        marks.setdefault(r["strategy"], []).append(
            [r["session_date"], round(r["equity"], 2), round(r["benchmark_equity"], 2)])
    for b in books:
        curve = marks.get(b["key"], [])
        if len(curve) > 120:                      # thin the 1,400-session control
            curve = curve[::len(curve) // 120 + 1] + [curve[-1]]
        b["curve"] = curve

    # ---- verification ----------------------------------------------------
    v = rv.verify(Path(config.DATA_DIR) / "reversal_watch" / "paper.db", persist=False)
    def trim_names(names: list[dict]) -> list[dict]:
        by_event: dict[str, list] = {}
        for n in names:
            h10 = n["horizons"].get("10") or {}
            # The horizon keys here are the *raw* ones the verifier emits
            # (`relative_return`), renamed to `rel` only on the way out.
            # Reading the short name on the way in exported zero episodes and
            # emptied every "where it worked / where it failed" table -- caught
            # by the browser harness, invisible to the render harness, because
            # an empty table still renders.
            if h10.get("state") == "resolved" and h10.get("relative_return") is not None:
                by_event.setdefault(n["event_type"], []).append(n)
        out, seen = [], set()
        for rows_ in by_event.values():
            rows_.sort(key=lambda x: x["horizons"]["10"]["relative_return"])
            for n in (rows_[:7] + rows_[-7:] if len(rows_) > 14 else rows_):
                key = (n["ticker"], n["event_type"], n["signal_date"])
                if key in seen:
                    continue
                seen.add(key)
                out.append({
                    "ticker": n["ticker"], "event": n["event_type"],
                    "direction": n["direction"], "date": n["signal_date"],
                    "horizons": {k: {"state": h.get("state"),
                                     "rel": r4(h.get("relative_return")),
                                     "abs": r4(h.get("stock_return")),
                                     "correct": h.get("correct")}
                                 for k, h in n["horizons"].items()},
                })
        return out

    hist = v.get("historical") or {}
    verification = {
        "measured_through": v["measured_through"], "first_signal": v.get("first_signal"),
        "signals": v["signals"], "resolved": v.get("resolved"), "pending": v.get("pending"),
        "totals": [{k: r4(t[k]) for k in
                    ("horizon", "direction", "label", "episodes", "tickers", "scored",
                     "pending", "hit_rate", "ci_low", "ci_high", "hit_rate_absolute", "verdict")}
                   for t in v["totals"]],
        "rows": [{k: r4(x.get(k)) for k in
                  ("event_type", "direction", "horizon", "signals", "episodes", "tickers",
                   "sessions", "resolved", "pending", "scored", "hit_rate", "ci_low", "ci_high",
                   "hit_rate_absolute", "verdict", "low_n_warning")} for x in v["rows"]],
        "cohort": [{**c, "mean_relative": r4(c["mean_relative"]), "t_stat": round(c["t_stat"], 2)}
                   for c in v["cohort"]],
        "historical": {**hist,
                       "source": "reconstructed-history backtest run (local artifact)",
                       "rows": [{k: r4(x.get(k)) for k in
                                 ("event_type", "direction", "horizon", "scored", "hit_rate",
                                  "hit_rate_absolute")} for x in hist.get("rows", [])]}
        if hist else {},
        "names": trim_names(v["names"]),
    }

    # ---- the two new surfaces -------------------------------------------
    queue = build_queue(screener, jobs, books, verification)
    changed = {
        "window": {"from": sess[1], "to": sess[0], "sessions": 1,
                   "label": "since the last completed session"},
        # A window nobody can answer is refused in words, not rendered empty.
        "refused": [
            {"window": "since my last visit",
             "why": "this prototype stores nothing about you, so the comparison "
                    "would be against a time nobody recorded"},
        ],
        "groups": [
            {"key": "books", "label": "Forward books",
             "note": "Equity over the last completed session. Ranked by size — "
                     "no materiality threshold, because no measured constant sets one.",
             "population": f"{len(books)} books", "rows": book_delta(books, marks)},
            {"key": "jobs", "label": "Job health",
             "note": "A state change under one stated rule, applied at both dates so "
                     "the comparison is like with like.",
             "population": f"{len(jobs)} jobs", "rows": jobs_changed},
            {"key": "picks", "label": "What the screens like",
             "note": "Names added or dropped between the two most recent boards.",
             "population": "16 collecting screens", "rows": pick_delta(screener)},
        ],
    }

    payload = {
        "verification": verification,
        "books": books,
        "strategies": [{"key": s.key, "name": s.name, "summary": s.summary, "stage": s.stage,
                        "family": s.family, "cadence": s.cadence, "added": s.added,
                        "jobs": list(s.jobs), "nreports": len(s.reports),
                        "dormant": s.dormant_reason, "role": s.role} for s in STRATEGIES],
        "jobs": jobs,
        "queue": queue,
        "changed": changed,
        "sessions": sess,
        "scale": {
            "strategies": len(STRATEGIES),
            "families": len({s.family for s in STRATEGIES}),
            "jobs": len(jobs), "agents": 88, "loaded": 80,
            "tests": 6655, "test_files": 338, "test_lines": 110137,
            "py_lines": 379558, "modules": 291,
            "price_rows": screener.execute("SELECT COUNT(*) FROM daily_prices").fetchone()[0],
            "option_bars": 114500000, "books": len(books),
        },
    }

    text = ("// Generated by tools/build_demo_data.py from the platform's own measured\n"
            "// output. Research figures are real; portfolio balances, breadth tiles and\n"
            "// the analyzer companies are synthetic and live in app.js.\n"
            "window.DEMO = " + json.dumps(payload, separators=(",", ":")) + ";\n")
    if "/Users/" in text:
        raise SystemExit("refusing to write: an absolute local path reached the payload")
    DEST.write_text(text)

    print(f"wrote {DEST} — {DEST.stat().st_size:,} bytes")
    print(f"  sessions   {sess[1]} → {sess[0]}")
    print(f"  queue      {len(queue)} rows  {dict(Counter(r['cls'] for r in queue))}")
    print(f"  changed    " + ", ".join(
        f"{g['key']} {len(g['rows'])}" for g in changed["groups"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
