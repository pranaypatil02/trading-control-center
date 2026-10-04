/* Trading Control Center — interactive prototype.
 *
 * Every screen is clickable and every screen has at least one level beneath it,
 * reachable by URL: #view, #view/entity, #view/entity/tab. Research figures come
 * from the platform's own measured output; portfolio balances, the breadth tiles
 * and the analyzer company are synthetic.
 */
const D = window.DEMO;

/* ------------------------------------------------------------------ format */
const pct = (x, dp = 1) => (x === null || x === undefined ? "—" : `${(x * 100).toFixed(dp)}%`);
const signed = (x, dp = 2) => (x === null || x === undefined ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(dp)}%`);
const money = (x) => (x === null || x === undefined ? "—" : `$${Math.round(x).toLocaleString()}`);
const money2 = (x) => (x === null || x === undefined ? "—" : `$${x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const tone = (x) => (x === null || x === undefined || x === 0 ? "" : x > 0 ? "positive" : "negative");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (x) => (x === null || x === undefined ? "—" : Number(x).toLocaleString());
const titled = (s) => String(s || "").replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

/* A link to another level. Everything navigable uses this, so every surface is
 * deep-linkable and the browser back button works without extra wiring. */
const go = (path) => `data-go="${esc(path)}"`;

const VERDICT_TONE = {
  "better than chance": "healthy",
  "worse than chance": "failing",
  "indistinguishable from chance": "stale",
  "no directional claim": "neutral",
};
const verdictClass = (v) => {
  if (!v) return "neutral";
  if (v.startsWith("too few")) return "neutral";
  return VERDICT_TONE[v] || "neutral";
};

/* ------------------------------------------------------------------ chrome */
function shell(title, description, body, meta) {
  return `<div class="surface-head"><div><h2>${title}</h2><p>${description}</p></div>${
    meta ? `<span class="meta-pill">${esc(meta)}</span>` : ""
  }</div>${body}`;
}

function crumbs(items) {
  const parts = items.map((it, i) =>
    i === items.length - 1
      ? `<span aria-current="page">${esc(it.label)}</span>`
      : `<button ${go(it.path)}>${esc(it.label)}</button><i aria-hidden="true">/</i>`
  );
  return `<nav class="crumbs" aria-label="Breadcrumb">${parts.join("")}</nav>`;
}

function insight(verdict, detail) {
  return `<div class="insight"><strong>${verdict}</strong><p>${detail}</p></div>`;
}

function caveat(text) {
  return `<p class="caveat"><span aria-hidden="true">△</span> ${text}</p>`;
}

function metricCards(cards) {
  return `<div class="metric-grid">${cards
    .map((c) => `<article class="metric-card"><span class="label">${esc(c[0])}</span><div class="value ${c[3] || ""}">${c[1]}</div><p>${c[2]}</p></article>`)
    .join("")}</div>`;
}

/* ------------------------------------------------------------------ charts */
/* One equity-curve renderer for every book, so two surfaces cannot draw the
 * same series differently. Nulls break the path rather than bridging a gap. */
function curveChart(curve, label = "Book versus benchmark") {
  if (!curve || curve.length < 2) return `<div class="empty">Not enough marked sessions to draw a curve.</div>`;
  const vals = curve.flatMap((p) => [p[1], p[2]]).filter((v) => v !== null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.12 || 1;
  const y0 = lo - pad, y1 = hi + pad;
  const X = (i) => 48 + (i / (curve.length - 1)) * 694;
  const Y = (v) => 186 - ((v - y0) / (y1 - y0)) * 160;
  const path = (idx) => curve.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p[idx]).toFixed(1)}`).join(" ");
  const last = curve[curve.length - 1];
  const ticks = [y0 + (y1 - y0) * 0.1, (y0 + y1) / 2, y1 - (y1 - y0) * 0.1];
  return `<svg class="chart-svg" viewBox="0 0 760 220" role="img" aria-label="${esc(label)}">
    <g class="chart-grid">${ticks.map((t) => `<line x1="48" x2="742" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/>`).join("")}</g>
    <g>${ticks.map((t) => `<text x="2" y="${(Y(t) + 3).toFixed(1)}">$${Math.round(t / 1000)}k</text>`).join("")}
       <text x="48" y="208">${esc(curve[0][0])}</text><text x="672" y="208">${esc(last[0])}</text></g>
    <path class="chart-benchmark" d="${path(2)}"/>
    <path class="chart-line" d="${path(1)}"/>
    <circle class="chart-point" cx="${X(curve.length - 1).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="4"/>
  </svg>`;
}

/* A hit rate is meaningless without its interval, so the interval is the chart
 * rather than a column: the coin-flip line is drawn and the bar either clears
 * it or straddles it. */
function ciBar(hit, lo, hi) {
  if (hit === null || hit === undefined) return `<span class="ci-na">no claim</span>`;
  const x = (v) => `${(v * 100).toFixed(1)}%`;
  if (lo === null || lo === undefined) {
    /* The label sits below the track rather than over it: at a high rate the
     * point marker lands on the right-hand edge, exactly where an overlaid
     * label is. */
    return `<span class="ci thin"><i class="ci-track"></i><i class="ci-mid" style="left:${x(hit)}"></i><em class="ci-thin">too few to judge</em></span>`;
  }
  return `<span class="ci" title="95% interval ${x(lo)} to ${x(hi)}">
    <i class="ci-track"></i><i class="ci-half"></i>
    <i class="ci-range" style="left:${x(lo)};width:${((hi - lo) * 100).toFixed(1)}%"></i>
    <i class="ci-mid" style="left:${x(hit)}"></i></span>`;
}

function sparkRow(values) {
  if (!values.length) return "";
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  return `<span class="spark" aria-hidden="true">${values
    .map((v) => `<i style="height:${(6 + ((v - lo) / span) * 18).toFixed(1)}px" class="${v < 0 ? "neg" : ""}"></i>`)
    .join("")}</span>`;
}

/* ------------------------------------------------------------- 1. dashboard */
function renderDashboard() {
  const v = D.verification;
  const bear10 = v.totals.find((t) => t.horizon === 10 && t.direction === "bearish");
  const bull10 = v.totals.find((t) => t.horizon === 10 && t.direction === "bullish");
  const failing = D.jobs.filter((j) => j.status === "failing");
  const stale = D.jobs.filter((j) => j.status === "stale");
  const ranked = D.books.filter((b) => b.rankable);
  const queue = [...failing, ...stale].slice(0, 5);

  return `
    <div class="verdict">
      <article class="verdict-card neutral">
        <span class="label">What the estate is</span>
        <div class="big-number">${D.scale.strategies}</div>
        <p class="metric-note">registered strategies and studies across ${D.scale.families} families<br>
        ${D.scale.books} forward books · ${D.scale.jobs} health-reporting jobs</p>
      </article>
      <article class="verdict-card verdict-copy">
        <span class="label">Operator summary</span>
        <h2>Two of ${D.scale.books} books have earned the right to be ranked. The rest are named and withheld.</h2>
        <p>A ranking needs 63 marked sessions, so twelve books carry results that are
        visible but not comparable. The signal feed's two halves point opposite ways:
        bearish warnings beat SPY ${pct(bear10.hit_rate)} of the time at ten sessions, bullish
        reversal calls ${pct(bull10.hit_rate)}. ${failing.length} job needs attention and ${stale.length} are past their own cadence.</p>
      </article>
    </div>

    ${metricCards([
      ["Signals graded", num(v.signals), `through ${esc(v.measured_through)}`, ""],
      ["Bearish warnings · 10d", pct(bear10.hit_rate), `${bear10.scored} episodes beat SPY`, "positive"],
      ["Bullish calls · 10d", pct(bull10.hit_rate), `${bull10.scored} episodes beat SPY`, "negative"],
      ["Rankable books", `${ranked.length} of ${D.scale.books}`, "63-session floor enforced", ""],
      ["Jobs on cadence", `${D.jobs.length - failing.length - stale.length} of ${D.jobs.length}`, "judged per job, not globally", ""],
      ["Automated agents", `${D.scale.loaded} of ${D.scale.agents}`, "scheduled agents loaded", ""],
      ["Tests as release gate", num(D.scale.tests), `${D.scale.test_files} files · ${num(D.scale.test_lines)} lines`, "positive"],
      ["Open incidents", String(failing.length), failing.length ? "exception opens first" : "queue empty", failing.length ? "negative" : "positive"],
    ])}

    <div class="dashboard-grid">
      <section class="panel" data-tour="queue">
        <div class="panel-head"><div><h2>Action queue — ${queue.length}</h2>
          <p>Jobs and schedules, not trade picks. An empty queue is the good state and says so.</p></div>
          <span class="status ${failing.length ? "failing" : "healthy"}">${failing.length ? "Action" : "Clear"}</span></div>
        <div class="panel-body">
          <div class="attention-list">${
            queue.length
              ? queue
                  .map(
                    (j) => `<button class="attention-row" ${go(`jobs/${j.name}`)}>
                <span class="status-icon ${j.status === "failing" ? "" : "warn"}">${j.status === "failing" ? "!" : "~"}</span>
                <span><strong>${esc(j.name)}</strong><p>${esc(j.owner)} · ${j.failures} failures in ${j.runs} recorded runs</p></span>
                <span class="age">open →</span></button>`
                  )
                  .join("")
              : `<div class="empty">Nothing is failing and nothing is past its cadence.</div>`
          }</div>
        </div>
      </section>
      <section class="panel" data-tour="verdicts">
        <div class="panel-head"><div><h2>Did the signals work?</h2><p>Opposite claims are never pooled into one accuracy number.</p></div></div>
        <div class="panel-body">
          <div class="mini-claims">${v.totals
            .filter((t) => t.horizon === 10)
            .map(
              (t) => `<button class="mini-claim" ${go("verified")}>
              <span class="label">${esc(t.label)}</span>
              <strong class="${t.hit_rate > 0.5 ? "positive" : "negative"}">${pct(t.hit_rate)}</strong>
              <small>${t.scored} graded · ${t.pending} pending</small>
              ${ciBar(t.hit_rate, t.ci_low, t.ci_high)}</button>`
            )
            .join("")}</div>
          ${caveat(`Pooled, these read ${pct(
            (v.totals.filter((t) => t.horizon === 10).reduce((a, t) => a + t.hit_rate * t.scored, 0)) /
              v.totals.filter((t) => t.horizon === 10).reduce((a, t) => a + t.scored, 0)
          )} — an average of opposite claims that improves as the bullish calls get worse.`)}
        </div>
      </section>
    </div>`;
}

/* --------------------------------------------- 2. signal verification (L0-L2) */
function renderVerified(state) {
  if (state.key) return renderVerifiedEvent(state);
  const v = D.verification;
  const byHorizon = (dir) => [5, 10, 20].map((h) => v.totals.find((t) => t.horizon === h && t.direction === dir));
  const claimRow = (dir) => {
    const rows = byHorizon(dir);
    const label = rows[0].label;
    return `<tr><td><strong>${esc(label)}</strong><small>${rows[0].episodes} episodes · ${rows[0].tickers} names</small></td>
      ${rows
        .map(
          (t) => `<td><div class="rate ${t.hit_rate > 0.5 ? "positive" : "negative"}">${pct(t.hit_rate)}</div>
          ${ciBar(t.hit_rate, t.ci_low, t.ci_high)}
          <small class="sub">abs ${pct(t.hit_rate_absolute)} · ${t.scored} graded · ${t.pending} pending</small></td>`
        )
        .join("")}
      <td><span class="status ${verdictClass(rows[1].verdict)}">${esc(rows[1].verdict)}</span></td></tr>`;
  };

  const events = v.rows.filter((r) => r.horizon === 10);
  const hist = (v.historical && v.historical.rows) || [];
  const histFor = (ev) => hist.find((h) => h.event_type === ev && h.horizon === 10);

  return `${shell(
    "Were the published signals right?",
    "Every signal this system published is a claim about what happens next. This grades each one at 5, 10 and 20 completed sessions against SPY — the benchmark you could have owned instead.",
    `
    ${insight(
      `Bearish warnings beat SPY ${pct(byHorizon("bearish")[1].hit_rate)} of the time at ten sessions. Bullish reversal calls managed ${pct(byHorizon("bullish")[1].hit_rate)}.`,
      `The two halves of one feed point opposite ways, so they are never pooled. Correct means <em>beat SPY</em>, with the raw positive rate beside it and never merged: a beaten-down name that rose 2% in a week the index rose 3% did not reverse anything.`
    )}

    <section class="panel" data-tour="claims">
      <div class="panel-head"><div><h2>By claim</h2><p>One row per direction. A warning is correct when the price falls.</p></div>
        <span class="meta-pill">${num(v.signals)} signals · through ${esc(v.measured_through)}</span></div>
      <table class="jobs-table wide">
        <thead><tr><th>Claim</th><th>5 sessions</th><th>10 sessions</th><th>20 sessions</th><th>Verdict at 10</th></tr></thead>
        <tbody>${claimRow("bullish")}${claimRow("bearish")}</tbody>
      </table>
    </section>

    <section class="panel cohort-panel">
      <div class="panel-head"><div><h2>What the cohort did anyway</h2>
        <p>Entering the watch list is a statement about the past, so it gets no verdict — but it <em>is</em> the population the warnings were drawn from.</p></div></div>
      <div class="panel-body">
        <div class="cohort-row">${v.cohort
          .map(
            (c) => `<div class="cohort-cell ${c.material ? "material" : ""}">
            <span class="label">${c.horizon} sessions</span>
            <strong class="${tone(c.mean_relative)}">${signed(c.mean_relative)}</strong>
            <small>vs SPY · t=${c.t_stat} · n=${c.n}${c.material ? " · material" : ""}</small></div>`
          )
          .join("")}</div>
        ${caveat(
          "The beaten-down cohort was already underperforming, so part of the bearish hit rate is the population rather than signal skill. Published, not subtracted — no measured constant says what to deflate it by."
        )}
      </div>
    </section>

    <section class="panel" data-tour="events">
      <div class="panel-head"><div><h2>By event type — select any row</h2>
        <p>Sorted most promising verdict first. Inside <em>too few to judge</em> sample size leads, not the unjudgeable rate.</p></div>
        <span class="meta-pill">10-session horizon · ${events.length} event types</span></div>
      <table class="jobs-table wide">
        <thead><tr><th>Event type</th><th>Direction</th><th>Episodes</th><th>Graded</th><th>Beat SPY</th><th>Interval</th><th>Reconstructed history</th><th>Verdict</th></tr></thead>
        <tbody>${events
          .map((r) => {
            const h = histFor(r.event_type);
            return `<tr class="clickable" ${go(`verified/${r.event_type}`)}>
            <td><strong>${esc(titled(r.event_type))}</strong><small>${r.signals} raw signals → ${r.episodes} episodes</small></td>
            <td><span class="dir ${r.direction}">${r.direction}</span></td>
            <td class="n">${r.episodes}</td>
            <td class="n">${r.scored}<small class="sub">${r.pending} pending</small></td>
            <td class="n ${r.hit_rate === null ? "" : r.hit_rate > 0.5 ? "positive" : "negative"}">${pct(r.hit_rate)}</td>
            <td>${ciBar(r.hit_rate, r.ci_low, r.ci_high)}</td>
            <td class="n">${h ? `${pct(h.hit_rate)}<small class="sub">${num(h.scored)} signals</small>` : "—"}</td>
            <td><span class="status ${verdictClass(r.verdict)}">${esc(r.verdict)}</span></td></tr>`;
          })
          .join("")}</tbody>
      </table>
    </section>

    ${caveat(
      `One qualification episode counts once even when it emits daily — the largest bucket collapses ${
        events.find((e) => e.event_type === "BREAKOUT_FAILED").signals
      } raw signals into ${
        events.find((e) => e.event_type === "BREAKOUT_FAILED").episodes
      } episodes. Counting them independently would shrink every interval by roughly the square root of the duplication. A window that has not elapsed is pending, never a miss.`
    )}`,
    "Measured outcomes · real figures"
  )}`;
}

function renderVerifiedEvent(state) {
  const v = D.verification;
  const ev = state.key;
  const rows = v.rows.filter((r) => r.event_type === ev).sort((a, b) => a.horizon - b.horizon);
  if (!rows.length) return `<div class="empty">No such event type in this prototype.</div>`;
  const names = v.names.filter((n) => n.event === ev);
  if (state.sub) return renderVerifiedEpisode(state, rows, names);

  const r10 = rows.find((r) => r.horizon === 10) || rows[0];
  const sorted = [...names].sort((a, b) => ((a.horizons["10"] || {}).rel ?? 0) - ((b.horizons["10"] || {}).rel ?? 0));
  const worked = r10.direction === "bearish" ? sorted.slice(0, 8) : [...sorted].reverse().slice(0, 8);
  const failed = r10.direction === "bearish" ? [...sorted].reverse().slice(0, 8) : sorted.slice(0, 8);

  const nameTable = (list, heading, note) => `
    <section class="panel">
      <div class="panel-head"><div><h3>${heading}</h3><p>${note}</p></div></div>
      <table class="jobs-table">
        <thead><tr><th>Stock</th><th>Signal date</th><th>5d vs SPY</th><th>10d vs SPY</th><th>20d vs SPY</th></tr></thead>
        <tbody>${list
          .map(
            (n) => `<tr class="clickable" ${go(`verified/${ev}/${n.ticker}~${n.date}`)}>
          <td><strong>${esc(n.ticker)}</strong></td><td>${esc(n.date)}</td>
          ${["5", "10", "20"]
            .map((h) => {
              const x = n.horizons[h];
              if (!x || x.state !== "resolved") return `<td class="n pending">pending</td>`;
              return `<td class="n ${tone(-x.rel)}">${signed(x.rel)}</td>`;
            })
            .join("")}</tr>`
          )
          .join("")}</tbody>
      </table>
    </section>`;

  return `${crumbs([
    { label: "Were they right?", path: "verified" },
    { label: titled(ev) },
  ])}
  ${shell(
    titled(ev),
    `A <strong>${r10.direction}</strong> claim. ${
      r10.direction === "bearish"
        ? "Correct when the stock falls relative to SPY."
        : r10.direction === "bullish"
        ? "Correct when the stock rises relative to SPY."
        : "Carries no directional claim, so it receives no verdict."
    }`,
    `
    ${insight(
      r10.verdict === "no directional claim"
        ? "No verdict, by design."
        : `${pct(r10.hit_rate)} beat SPY at ten sessions — ${r10.verdict}.`,
      r10.verdict === "no directional claim"
        ? "Qualification says the stock is severely beaten down, which is a statement about the past. Its returns are published as a distribution with the correctness column deliberately empty."
        : `Measured over ${r10.scored} graded episodes drawn from ${r10.tickers} names and ${r10.sessions} sessions, with ${r10.pending} windows still open.`
    )}

    ${metricCards([
      ["Raw signals", num(r10.signals), "before episode collapse", ""],
      ["Episodes", num(r10.episodes), "one qualification counts once", ""],
      ["Graded at 10d", num(r10.scored), `${r10.pending} pending`, ""],
      ["Absolute positive rate", pct(r10.hit_rate_absolute), "ignores the benchmark", ""],
    ])}

    <section class="panel">
      <div class="panel-head"><div><h2>Every horizon</h2><p>A name that worked at five sessions and gave it back by ten is visible as one line.</p></div></div>
      <table class="jobs-table">
        <thead><tr><th>Horizon</th><th>Graded</th><th>Pending</th><th>Beat SPY</th><th>Interval against a coin flip</th><th>Absolute</th><th>Verdict</th></tr></thead>
        <tbody>${rows
          .map(
            (r) => `<tr><td><strong>${r.horizon} sessions</strong></td><td class="n">${r.scored}</td><td class="n">${r.pending}</td>
          <td class="n ${r.hit_rate === null ? "" : r.hit_rate > 0.5 ? "positive" : "negative"}">${pct(r.hit_rate)}</td>
          <td>${ciBar(r.hit_rate, r.ci_low, r.ci_high)}</td><td class="n">${pct(r.hit_rate_absolute)}</td>
          <td><span class="status ${verdictClass(r.verdict)}">${esc(r.verdict)}</span></td></tr>`
          )
          .join("")}</tbody>
      </table>
    </section>

    <div class="two-up">
      ${nameTable(worked, "Where it worked", "The evidence under the rate — select a row for the episode.")}
      ${nameTable(failed, "Where it failed", "The worst miss is the strategy's real risk, so it is given equal billing.")}
    </div>

    ${caveat(
      "A hit rate is an average, and an average over these episodes can be one name carrying it or eighty behaving alike. These are the rows underneath it; two episodes on one ticker are two separate calls, not a duplicate."
    )}`,
    `${names.length} episode rows in this prototype`
  )}`;
}

function renderVerifiedEpisode(state, rows, names) {
  const [ticker, date] = state.sub.split("~");
  const n = names.find((x) => x.ticker === ticker && x.date === date);
  if (!n) return `<div class="empty">No such episode in this prototype.</div>`;
  const dir = n.direction;
  return `${crumbs([
    { label: "Were they right?", path: "verified" },
    { label: titled(state.key), path: `verified/${state.key}` },
    { label: `${ticker} · ${date}` },
  ])}
  ${shell(
    `${esc(ticker)} — ${esc(titled(state.key))}`,
    `Signalled ${esc(date)}. A <strong>${dir}</strong> claim, graded against SPY over the same completed sessions.`,
    `
    ${metricCards(
      ["5", "10", "20"].map((h) => {
        const x = n.horizons[h] || {};
        if (x.state !== "resolved") return [`${h} sessions`, "pending", "window has not elapsed", ""];
        const right = dir === "bearish" ? x.rel < 0 : x.rel > 0;
        return [`${h} sessions`, signed(x.rel), `${right ? "correct" : "wrong"} · stock ${signed(x.abs)}`, right ? "positive" : "negative"];
      }).concat([["Direction", titled(dir), dir === "bearish" ? "correct when price falls" : "correct when price rises", ""]])
    )}

    <section class="panel">
      <div class="panel-head"><div><h2>How this episode was graded</h2><p>The same five rules apply to every row on the page.</p></div></div>
      <div class="panel-body">
        <ol class="rules">
          <li><strong>Correct means beat SPY.</strong> This episode moved ${signed((n.horizons["10"] || {}).abs)} absolute at ten sessions and ${signed((n.horizons["10"] || {}).rel)} against the benchmark.</li>
          <li><strong>A warning is correct when the price falls.</strong> Direction is declared per event type, never inferred from its name — reading it backwards inverts a hit rate invisibly.</li>
          <li><strong>One episode counts once.</strong> Repeated daily alerts from this qualification collapse to this single row.</li>
          <li><strong>Pending is not a miss.</strong> Any horizon above that has not elapsed is counted apart and named.</li>
          <li><strong>Sessions stop strictly before today.</strong> The console rebuilds hourly, and a mid-morning rebuild would otherwise resolve a window against a partial bar.</li>
        </ol>
      </div>
    </section>

    ${caveat(
      "Stored outcomes are append-only and the first observation wins, but every run re-derives them and compares. Prices are served back-adjusted, so a split or vendor correction can rewrite history under a verdict already published — a disagreement is reported and repaired nowhere, because the cause is either a corporate action or a fault and both need a person."
    )}`,
    "One episode · real measured outcome"
  )}`;
}

/* ------------------------------------------------ 3. forward test books (L0-L2) */
function renderBooks(state) {
  if (state.key) return renderBookDetail(state);
  const tracks = [
    ["replayed", "Replayed", "History that existed before the book did. It has a window, not a clock."],
    ["live_forward", "Live forward", "Accrued with the book. Retirement and the two-year clock bind here only."],
  ];
  const ranked = D.books.filter((b) => b.rankable);

  const row = (b) => `<tr class="clickable" ${go(`books/${b.key}`)}>
    <td><strong>${esc(b.name || b.key)}</strong><small>${esc(b.universe || "")}</small></td>
    <td>${b.allow_short ? `<span class="tag short">Short</span>` : `<span class="tag">Long</span>`}${
      b.control ? ` <span class="tag ctl">Control</span>` : ""
    }</td>
    <td class="n">${b.sessions}</td>
    <td class="n">${money(b.equity)}</td>
    <td class="n ${tone(b.total_return)}">${signed(b.total_return)}</td>
    <td class="n">${signed(b.benchmark_return)}</td>
    <td class="n ${tone(b.excess_return)}"><strong>${signed(b.excess_return)}</strong></td>
    <td class="n negative">${signed(b.max_drawdown)}</td>
    <td>${
      b.rankable
        ? `<span class="status healthy">rankable</span>`
        : `<span class="status stale" title="${esc(b.too_early_reason || "")}">too early</span>`
    }</td></tr>`;

  return `${shell(
    "Forward tests — one execution model, one ranking contract",
    "Any strategy plugs in, gets its own $25,000 book on one execution model, and is ranked against its own benchmark. The framework's real contribution is that it forces the exit rule: it refuses to construct a book without one.",
    `
    ${insight(
      `${ranked.length} of ${D.books.length} books are rankable. The other ${D.books.length - ranked.length} are shown and withheld.`,
      `Sharpe once read 7.11 on a thirteen-session book. Annualising a fortnight's standard deviation returns a large, stable-looking number that measures the fortnight, so Sharpe, Sortino and CAGR are withheld below the 63-session floor — and so is a place in the ranking.`
    )}

    ${metricCards([
      ["Books running", String(D.books.length), "each a separate $25,000 account", ""],
      ["Rankable", `${ranked.length}`, "63 marked sessions required", ""],
      ["Short books", String(D.books.filter((b) => b.allow_short).length), "a short must declare a stop", ""],
      ["Broker path", "none", "no order, no credential, by instruction", ""],
    ])}

    ${tracks
      .map(([key, label, note]) => {
        const list = D.books.filter((b) => b.track === key).sort((a, b) => (b.excess_return ?? -9) - (a.excess_return ?? -9));
        return `<section class="panel" data-tour="${key}">
        <div class="panel-head"><div><h2>${label} — ${list.length}</h2><p>${note}</p></div>
          <span class="meta-pill">$25,000 each · select any book</span></div>
        <table class="jobs-table wide">
          <thead><tr><th>Book</th><th>Side</th><th>Sessions</th><th>Equity</th><th>Return</th><th>Benchmark</th><th>Excess</th><th>Max drawdown</th><th>Status</th></tr></thead>
          <tbody>${list.map(row).join("")}</tbody>
        </table></section>`;
      })
      .join("")}

    ${caveat(
      "Two tracks, never one ranking. Merging them ranks a multi-year replay against a four-session book, and the ordering becomes a fact about who got the longer window. These books are comparable with each other and <em>not</em> with any broker-connected sleeve."
    )}`,
    "Hypothetical books · no capital at risk"
  )}`;
}

function renderBookDetail(state) {
  const b = D.books.find((x) => x.key === state.key);
  if (!b) return `<div class="empty">No such book in this prototype.</div>`;
  const tab = state.sub || "overview";
  const tabs = [
    ["overview", "Performance"],
    ["contract", "Strategy contract"],
    ["trades", "Trades & costs"],
  ];
  const t = b.trades || {};

  const body = {
    overview: () => `
      ${metricCards([
        ["Equity", money(b.equity), `from ${money(b.capital)} at activation`, ""],
        ["Return", signed(b.total_return), `${b.sessions} marked sessions`, tone(b.total_return)],
        [`Excess vs ${esc(b.benchmark_ticker || "benchmark")}`, signed(b.excess_return), `benchmark ${signed(b.benchmark_return)}`, tone(b.excess_return)],
        ["Max drawdown", signed(b.max_drawdown), `${b.max_drawdown_sessions ?? "—"} sessions · now ${signed(b.current_drawdown)}`, "negative"],
      ])}
      <section class="panel">
        <div class="panel-head"><div><h2>Equity against ${esc(b.benchmark_ticker || "benchmark")}</h2>
          <p>Solid: the book. Dashed: the same window, benchmark only.</p></div>
          <span class="meta-pill">${esc(b.first_mark)} → ${esc(b.last_mark)}</span></div>
        <div class="panel-body"><div class="chart-wrap">${curveChart(b.curve)}</div>
          <div class="chart-footer"><div class="legend"><span><i></i>${esc(b.name || b.key)}</span><span><i class="benchmark"></i>${esc(b.benchmark_ticker || "benchmark")}</span></div>
          <strong>Price return on both sides</strong></div></div>
      </section>
      <div class="two-up">
        <section class="panel"><div class="panel-head"><div><h3>Period returns</h3><p>A window the history cannot support is refused in words.</p></div></div>
          <table class="jobs-table"><thead><tr><th>Window</th><th>Book</th><th>Benchmark</th><th>Excess</th></tr></thead><tbody>
          ${Object.entries(b.windows || {})
            .map(([k, w]) =>
              w && w.sessions
                ? `<tr><td><strong>${esc(k)}</strong><small>${w.sessions} sessions</small></td><td class="n ${tone(w.book)}">${signed(w.book)}</td><td class="n">${signed(w.benchmark)}</td><td class="n ${tone(w.excess)}">${signed(w.excess)}</td></tr>`
                : `<tr class="muted-row"><td><strong>${esc(k)}</strong></td><td colspan="3" class="refused">not enough history — refused rather than shown short</td></tr>`
            )
            .join("")}</tbody></table></section>
        <section class="panel"><div class="panel-head"><div><h3>Risk statistics</h3><p>Withheld figures say why.</p></div></div>
          <div class="panel-body"><dl class="kv-list">
            <dt>Volatility (annualised)</dt><dd>${pct(b.volatility)}</dd>
            <dt>Sharpe</dt><dd>${b.sharpe === null ? `<span class="refused">withheld</span>` : b.sharpe.toFixed(2)}</dd>
            <dt>Invested share</dt><dd>${pct(b.invested_share)}</dd>
            <dt>Turnover</dt><dd>${(b.turnover ?? 0).toFixed(2)}×</dd>
            <dt>Risk-free rate used</dt><dd>${pct(b.risk_free ?? 0.0524)}</dd>
          </dl>${b.ratios_withheld ? caveat(esc(b.ratios_withheld)) : ""}</div></section>
      </div>`,

    contract: () => `
      <div class="account-callout ${b.exit_rule ? "ready" : ""}">
        <strong>${b.exit_rule ? "Rule complete" : "Missing exit"}</strong>
        <span>${
          b.exit_rule
            ? "Entry and exit are both declared, which is what the framework requires before it will construct a book at all."
            : "A book with no exit rule does not start. The framework refuses to construct one."
        }</span></div>
      <section class="panel"><div class="panel-head"><div><h2>Declared rules</h2><p>Missing rules are shown, never inferred.</p></div></div>
        <div class="panel-body account-rules">
          <span class="label">Objective</span><p>${esc(b.description || "—")}</p>
          <span class="label">Universe</span><p>${esc(b.universe || "—")}</p>
          <span class="label">Entry</span><p>${esc(b.entry_rule || "Not defined")}</p>
          <span class="label">Exit</span><p class="${b.exit_rule ? "" : "missing-copy"}">${esc(b.exit_rule || "Not defined")}</p>
          <span class="label">Schedule</span><p>${esc(b.schedule || "—")}</p>
        </div></section>
      <div class="two-up">
        <section class="panel"><div class="panel-head"><div><h3>Sizing and risk limits</h3></div></div>
          <div class="panel-body"><dl class="kv-list">
            <dt>Slots</dt><dd>${b.slots ?? "—"}</dd>
            <dt>Max position</dt><dd>${pct(b.max_position_pct, 0)}</dd>
            <dt>Side</dt><dd>${b.allow_short ? "Short — negative lots" : "Long only"}</dd>
            <dt>Stop loss</dt><dd>${b.stop_loss_pct ? pct(b.stop_loss_pct, 0) : `<span class="refused">none declared</span>`}</dd>
            <dt>Max holding</dt><dd>${b.max_holding_days ? `${b.max_holding_days} sessions` : "—"}</dd>
            <dt>Track</dt><dd>${esc(b.track)}</dd>
          </dl></div></section>
        <section class="panel"><div class="panel-head"><div><h3>Why this book can or cannot be ranked</h3></div></div>
          <div class="panel-body">
            ${
              b.rankable
                ? insight("Rankable.", "It has cleared the 63-session floor, so its ratios are published and it takes a place in the ordering.")
                : insight("Withheld from the ranking.", esc(b.too_early_reason || "Below the session floor."))
            }
            ${
              b.allow_short
                ? caveat(
                    "A short book <em>must</em> declare a stop, refused at construction otherwise. A long position cannot lose more than it cost; without a stop a short has no worst case and its drawdown column would state what happened to be true rather than its risk."
                  )
                : ""
            }
          </div></section>
      </div>`,

    trades: () => `
      ${metricCards([
        ["Closed trades", num(t.trades), `${t.wins ?? 0} wins · ${t.losses ?? 0} losses`, ""],
        ["Win rate", pct(t.win_rate), "closed positions only", tone((t.win_rate ?? 0) - 0.5)],
        ["Average hold", t.avg_holding_days ? `${t.avg_holding_days.toFixed(1)}d` : "—", "calendar days", ""],
        ["Slippage paid", money2(b.slippage_paid), `${pct(b.cost_share_of_capital ?? 0, 2)} of capital`, "negative"],
      ])}
      <div class="two-up">
        <section class="panel"><div class="panel-head"><div><h3>Trade quality</h3><p>Realized profit is never presented as total account return.</p></div></div>
          <div class="panel-body"><dl class="kv-list">
            <dt>Average win</dt><dd class="positive">${money2(t.avg_win)}</dd>
            <dt>Average loss</dt><dd class="negative">${money2(t.avg_loss)}</dd>
            <dt>Profit factor</dt><dd>${t.profit_factor ? t.profit_factor.toFixed(2) : "—"}</dd>
            <dt>Realized to date</dt><dd class="${tone(b.realized)}">${money2(b.realized)}</dd>
            <dt>Open positions</dt><dd>${b.open_positions}</dd>
            <dt>Cash</dt><dd>${money(b.cash)}${b.allow_short ? ` <small>(short proceeds are not buying power)</small>` : ""}</dd>
          </dl></div></section>
        <section class="panel"><div class="panel-head"><div><h3>How positions closed</h3><p>An exit kind is read from the rulebook, not inferred.</p></div></div>
          <div class="panel-body">${
            t.exit_kinds && Object.keys(t.exit_kinds).length
              ? `<div class="exit-kinds">${Object.entries(t.exit_kinds)
                  .map(([k, n]) => `<div class="exit-kind"><strong>${n}</strong><span>${esc(titled(k))}</span></div>`)
                  .join("")}</div>`
              : `<div class="empty">No closed trades yet.</div>`
          }
          ${caveat(
            `Refusals are counted, not hidden: this book declined ${b.refusals ?? 0} candidate actions over its window — a slot already full of that name, a price above the slot, or a missing bar.`
          )}</div></section>
      </div>`,
  }[tab]();

  return `${crumbs([{ label: "Forward tests", path: "books" }, { label: b.name || b.key }])}
  ${shell(
    esc(b.name || b.key),
    esc(b.description || ""),
    `<div class="tabs">${tabs
      .map((x) => `<button class="tab ${x[0] === tab ? "active" : ""}" ${go(`books/${b.key}/${x[0]}`)}>${x[1]}</button>`)
      .join("")}</div>${body}`,
    `${b.sessions} sessions · ${esc(b.track)}`
  )}`;
}

/* ----------------------------------------------- 4. strategy registry (L0-L1) */
const STAGE_COPY = {
  paper: "Takes positions in a paper or simulated account.",
  signal: "Publishes picks or alerts; no capital attached here.",
  study: "A research question with a verdict, not a running system.",
  system: "Platform machinery — data, reporting, operations.",
};

function renderStrategies(state) {
  if (state.key) return renderStrategyDetail(state);
  const stages = ["paper", "signal", "study", "system"];
  const counts = Object.fromEntries(stages.map((s) => [s, D.strategies.filter((x) => x.stage === s).length]));
  const filter = state.q || "all";
  const list = D.strategies.filter((s) => filter === "all" || s.stage === filter);

  return `${shell(
    "Strategy registry",
    "Research, signals, paper trading and platform systems are explicit lifecycle states. Promotion requires an evidence decision; a strong backtest never quietly acquires execution authority.",
    `
    ${insight(
      `${D.scale.strategies} registered strategies and studies across ${D.scale.families} families.`,
      "Grouped by <em>stage</em> rather than family, because consequence is the axis that matters at this size: family files a paper bot that takes positions beside an ad-hoc study that renders a page."
    )}
    <div class="toolbar">
      <div class="chips">
        <button class="chip ${filter === "all" ? "active" : ""}" ${go("strategies")}>All ${D.strategies.length}</button>
        ${stages
          .map(
            (s) => `<button class="chip ${filter === s ? "active" : ""}" ${go(`strategies?${s}`)}>${titled(s)} ${counts[s]}</button>`
          )
          .join("")}
      </div>
      <input class="inline-search" id="strategy-search" placeholder="Filter ${list.length} strategies" aria-label="Filter strategies">
    </div>
    ${stages
      .filter((s) => filter === "all" || s === filter)
      .map((s) => {
        const items = list.filter((x) => x.stage === s);
        if (!items.length) return "";
        return `<section class="stage-block"><header><h3>${titled(s)} <b>${items.length}</b></h3><p>${STAGE_COPY[s]}</p></header>
        <div class="strategy-grid">${items
          .map(
            (x) => `<article class="strategy-card clickable" data-strategy="${esc((x.name + " " + x.summary + " " + x.family).toLowerCase())}" ${go(`strategies/${x.key}`)}>
          <div class="card-top"><h3>${esc(x.name)}</h3><span class="tag">${esc(x.family)}</span></div>
          <p class="card-copy">${esc(x.summary)}</p>
          <div class="card-meta"><span>${esc(x.cadence || "on demand")}</span>
            <strong>${x.jobs.length ? `${x.jobs.length} job${x.jobs.length > 1 ? "s" : ""}` : `<span class="unmonitored">unmonitored</span>`}</strong></div>
          </article>`
          )
          .join("")}</div></section>`;
      })
      .join("")}
    ${caveat(
      "A strategy with no health-reporting job renders as <em>unmonitored</em> — never green. The most dangerous state in an automated system is a bot that stopped months ago and looks fine because nothing said otherwise."
    )}`,
    `${list.length} shown`
  )}`;
}

function renderStrategyDetail(state) {
  const s = D.strategies.find((x) => x.key === state.key);
  if (!s) return `<div class="empty">No such strategy in this prototype.</div>`;
  const myJobs = D.jobs.filter((j) => s.jobs.includes(j.name));
  /* A book belongs to this strategy only on an exact or prefix match. A looser
   * `includes` both ways married strategies to other strategies' books. */
  const book = D.books.find((b) => b.key === state.key || b.key.startsWith(`${state.key}_`));
  const bad = myJobs.filter((j) => j.status !== "healthy");

  return `${crumbs([{ label: "Strategies", path: "strategies" }, { label: s.name }])}
  ${shell(
    esc(s.name),
    esc(s.summary),
    `
    ${
      s.jobs.length
        ? bad.length
          ? insight(`${bad.length} of its ${myJobs.length} jobs need attention.`, "Operational health is read from each job's own cadence, so this verdict and the rail badge cannot disagree.")
          : insight("Monitored and on cadence.", `All ${myJobs.length} health-reporting jobs are running within their own observed rhythm.`)
        : insight("Unmonitored.", "No health-reporting job is attached, so this strategy can never render green — silence is not health.")
    }

    ${metricCards([
      ["Lifecycle stage", titled(s.stage), STAGE_COPY[s.stage], ""],
      ["Family", titled(s.family), "a filter, not the grouping", ""],
      ["Cadence", esc(s.cadence || "on demand"), "staleness judged against this", ""],
      ["Registered", esc(s.added || "—"), `${s.nreports} report pattern${s.nreports === 1 ? "" : "s"}`, ""],
    ])}

    <div class="two-up">
      <section class="panel"><div class="panel-head"><div><h2>Jobs behind it — ${myJobs.length}</h2>
        <p>Select a job for its run history.</p></div></div>
        ${
          myJobs.length
            ? `<table class="jobs-table"><thead><tr><th>Job</th><th>Status</th><th>Failures</th><th>Last run</th></tr></thead><tbody>
          ${myJobs
            .map(
              (j) => `<tr class="clickable" ${go(`jobs/${j.name}`)}><td><strong>${esc(j.name)}</strong><small>${esc(j.owner)}</small></td>
            <td><span class="status ${j.status}">${j.status}</span></td><td class="n">${j.failures} / ${j.runs}</td><td>${esc(j.last)}</td></tr>`
            )
            .join("")}</tbody></table>`
            : `<div class="empty">No health-reporting job is registered for this strategy.</div>`
        }
      </section>
      <section class="panel"><div class="panel-head"><div><h2>Evidence and capital</h2><p>What this strategy has earned the right to claim.</p></div></div>
        <div class="panel-body">
          ${
            book
              ? `<div class="linked-book"><span class="label">Forward book</span>
            <button class="account-link" ${go(`books/${book.key}`)}>${esc(book.name || book.key)}<span>Open the book →</span></button>
            <dl class="kv-list"><dt>Excess vs benchmark</dt><dd class="${tone(book.excess_return)}">${signed(book.excess_return)}</dd>
            <dt>Marked sessions</dt><dd>${book.sessions}</dd>
            <dt>Rankable</dt><dd>${book.rankable ? "yes" : `no — ${esc(book.too_early_reason || "")}`}</dd></dl></div>`
              : `<p class="metric-note">No forward book is attached. Either the strategy runs its own ledger, or it publishes no stored per-session ranking to buy from — which is named as the blocker rather than filled with invented capital.</p>`
          }
          ${s.dormant ? caveat(`Dormant: ${esc(s.dormant)}`) : ""}
        </div></section>
    </div>`,
    `${esc(s.stage)} · ${esc(s.family)}`
  )}`;
}

/* --------------------------------------------------- 5. jobs & health (L0-L1) */
function renderJobs(state) {
  if (state.key) return renderJobDetail(state);
  const owners = [...new Set(D.jobs.map((j) => j.owner))].sort();
  const counts = { failing: 0, stale: 0, healthy: 0 };
  D.jobs.forEach((j) => counts[j.status]++);
  const filter = state.q || "all";
  const list = D.jobs.filter((j) => filter === "all" || j.status === filter);

  return `${shell(
    "Cadence-aware job health",
    "Every workflow is judged against its own observed rhythm. A past success expires, lateness is counted in trading sessions rather than hours, and silence is never green.",
    `
    ${insight(
      `${counts.failing} failing and ${counts.stale} past cadence, out of ${D.jobs.length}.`,
      "The dominant failure mode is not a red row nobody fixed — it is a green one. A watcher keyed on <em>status == failure</em> would say nothing about a job that last recorded success ninety-six days ago."
    )}
    <div class="toolbar">
      <div class="chips">
        <button class="chip ${filter === "all" ? "active" : ""}" ${go("jobs")}>All ${D.jobs.length}</button>
        <button class="chip ${filter === "failing" ? "active" : ""}" ${go("jobs?failing")}>Failing ${counts.failing}</button>
        <button class="chip ${filter === "stale" ? "active" : ""}" ${go("jobs?stale")}>Past cadence ${counts.stale}</button>
        <button class="chip ${filter === "healthy" ? "active" : ""}" ${go("jobs?healthy")}>Healthy ${counts.healthy}</button>
      </div>
      <input class="inline-search" id="job-search" placeholder="Filter ${list.length} jobs" aria-label="Filter jobs">
    </div>

    <section class="panel" data-tour="heatmap">
      <div class="panel-head"><div><h2>One square per job, grouped by owner</h2>
        <p>Thirty-eight collapsible tables meant holding the answer in your head. The concentration is the finding.</p></div>
        <div class="legend-dots"><span><i class="ok"></i>healthy</span><span><i class="late"></i>past cadence</span><span><i class="fail"></i>failing</span></div></div>
      <div class="panel-body"><div class="heatmap">${owners
        .map((o) => {
          const items = D.jobs.filter((j) => j.owner === o);
          const issues = items.filter((j) => j.status !== "healthy").length;
          return `<div class="heat-group"><span class="heat-label">${esc(o)}<b class="${issues ? "warn" : ""}">${issues ? `${issues} of ${items.length}` : items.length}</b></span>
          <div class="heat-cells">${items
            .map(
              (j) => `<button class="heat-cell ${j.status}" ${go(`jobs/${j.name}`)} title="${esc(j.name)} — ${j.status}" aria-label="${esc(j.name)}, ${j.status}"></button>`
            )
            .join("")}</div></div>`;
        })
        .join("")}</div></div>
    </section>

    <section class="panel">
      <div class="panel-head"><div><h2>Exceptions first</h2><p>Groups with nothing wrong sort last, so the page is as long as the number of problems.</p></div></div>
      <table class="jobs-table"><thead><tr><th>Workflow</th><th>Status</th><th>Reliability</th><th>Failures</th><th>Last run</th></tr></thead>
      <tbody id="job-rows">${jobRows(list)}</tbody></table>
    </section>`,
    `${D.jobs.length} health-reporting jobs · ${D.scale.loaded} of ${D.scale.agents} agents loaded`
  )}`;
}

function reliability(j) {
  /* Deterministic from the job's own failure share, so the strip and the count
   * cannot disagree. One cell per recent run, oldest left. */
  const n = 14;
  const fails = Math.min(n, Math.round((j.failures / Math.max(1, j.runs)) * n));
  const cells = [];
  for (let i = 0; i < n; i++) cells.push(i >= n - fails ? "fail" : "ok");
  if (j.status === "stale") cells[n - 1] = "late";
  return `<span class="reliability" aria-label="${fails} of the last ${n} runs failed">${cells.map((c) => `<i class="${c}"></i>`).join("")}</span>`;
}

function jobRows(list) {
  if (!list.length) return `<tr><td colspan="5" class="empty">No jobs match this filter.</td></tr>`;
  return list
    .map(
      (j) => `<tr class="clickable" data-status="${j.status}" ${go(`jobs/${j.name}`)}>
    <td><strong>${esc(j.name)}</strong><small>${esc(j.owner)}</small></td>
    <td><span class="status ${j.status}">${j.status}</span></td>
    <td>${reliability(j)}</td>
    <td class="n">${j.failures} / ${j.runs}</td>
    <td>${esc(j.last) || "—"}</td></tr>`
    )
    .join("");
}

function renderJobDetail(state) {
  const j = D.jobs.find((x) => x.name === state.key);
  if (!j) return `<div class="empty">No such job in this prototype.</div>`;
  const owners = D.strategies.filter((s) => s.jobs.includes(j.name));
  const rate = j.failures / Math.max(1, j.runs);

  return `${crumbs([{ label: "Bots & jobs", path: "jobs" }, { label: j.name }])}
  ${shell(
    esc(j.name),
    `Owned by ${esc(j.owner)}. ${
      owners.length ? `Reports health for ${owners.map((o) => esc(o.name)).join(", ")}.` : "No registered strategy claims this job."
    }`,
    `
    ${
      j.status === "failing"
        ? insight("Failing, and the failure is explicit.", "An explicit failure is a fact about a run that happened, so it is exempt from the session-lateness rule and from the repeat cooldown's silence.")
        : j.status === "stale"
        ? insight("Past its own observed cadence.", "Lateness is counted in completed trading sessions, not hours — an hourly job has a 72-hour weekend in its history and a badge that cries wolf every Monday is a badge you stop reading.")
        : insight("Healthy against its own rhythm.", "Judged on the 90th-percentile gap between its own runs rather than a global threshold.")
    }

    ${metricCards([
      ["Status", titled(j.status), "cadence-aware verdict", j.status === "healthy" ? "positive" : "negative"],
      ["Recorded runs", num(j.runs), "all time in the ledger", ""],
      ["Failures", num(j.failures), `${pct(rate)} of runs`, j.failures ? "negative" : "positive"],
      ["Last run", esc(j.last) || "never", "from the job ledger", ""],
    ])}

    <div class="two-up">
      <section class="panel"><div class="panel-head"><div><h2>Run-by-run reliability</h2>
        <p>One cell per run, oldest left. This is what separates one transient failure from a job that has failed most of its recent runs.</p></div></div>
        <div class="panel-body"><div class="strip-big">${reliability(j)}</div>
        ${caveat(
          "A renamed job is not a stopped job, and the ledger cannot tell the difference — nothing runs under the old name again, so it ages into <em>dead</em> and stays there. Retirement is recorded and is conditional on the successor being healthy, or renaming would be a way to silence work that had actually stopped."
        )}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>What happens on failure</h2><p>Alerting rules, stated rather than implied.</p></div></div>
        <div class="panel-body"><ol class="rules">
          <li><strong>Repeat faults widen.</strong> 1, 3, 7 then 14 days, so a job dead for months is restated at lengthening intervals rather than alerted on every run.</li>
          <li><strong>Escalation bypasses the cooldown.</strong> Late becoming dead, or a second failed run, alerts immediately — otherwise the cooldown would silence the moment the news changed.</li>
          <li><strong>A quiet run sends nothing.</strong> An all-clear twice a day is how a channel gets muted, and a muted channel looks like coverage.</li>
          <li><strong>A survey that ran is not a failed survey.</strong> No delivery channel configured records <em>skipped</em> with the reason, never failure.</li>
        </ol></div></section>
    </div>`,
    `${esc(j.owner)} · ${j.runs} runs recorded`
  )}`;
}

/* ------------------------------------------------- 6. portfolio (synthetic) */
const HOLDINGS = [
  ["ALPH", "Software", 8.4, 2.1, 72, 61, "above", -0.12, "Expensive, high quality, momentum intact"],
  ["BRVO", "Semiconductors", 7.1, -1.4, 81, 38, "above", 0.04, "Quality strong, valuation stretched"],
  ["CDEL", "Payments", 6.2, 0.8, 64, 55, "above", -0.03, "Evidence agrees — no contradiction"],
  ["DRFT", "Health care", 5.8, -3.2, 49, 74, "below", -0.21, "Cheap and deteriorating"],
  ["EVOK", "Industrials", 5.1, 1.6, 58, 62, "above", 0.02, "Evidence agrees — no contradiction"],
  ["FLUX", "Energy", 4.6, 4.2, 41, 81, "above", 0.11, "Cheap, low quality, momentum new"],
  ["GRID", "Utilities", 4.2, -0.4, 55, 69, "below", -0.08, "Defensive, no thesis recorded"],
  ["HELM", "Insurance", 3.9, 0.3, 67, 52, "above", 0.01, "Evidence agrees — no contradiction"],
  ["IRIS", "Media", 3.4, -5.1, 38, 88, "below", -0.34, "Cheap, weak, falling — three ways"],
  ["JOLT", "Retail", 3.1, 2.4, 61, 44, "above", 0.06, "Quality fair, expensive"],
];

function renderPortfolio(state) {
  if (state.key === "holding") return renderHoldingDetail(state);
  const tab = state.key || "book";
  const tabs = [
    ["book", "Holdings"],
    ["changed", "What changed"],
    ["risk", "Risk & concentration"],
    ["outlook", "Forward evidence"],
  ];
  const noThesis = HOLDINGS.filter((h) => h[8].includes("no thesis"));
  const contradictory = HOLDINGS.filter((h) => h[8].includes(",") && !h[8].includes("agrees"));

  const body = {
    book: () => `
      ${metricCards([
        ["Holdings", String(HOLDINGS.length), "synthetic book in this prototype", ""],
        ["Research coverage", "87%", "by market value, stated per layer", "positive"],
        ["Priced this session", `${HOLDINGS.length} of ${HOLDINGS.length}`, "today is never marked", "positive"],
        ["No thesis recorded", String(noThesis.length), "the finding the view leads on", "negative"],
      ])}
      <section class="panel"><div class="panel-head"><div><h2>Holdings — select any row</h2>
        <p>A missing value is an empty cell, never a zero and never a 50.</p></div>
        <span class="meta-pill">Synthetic positions · no account values</span></div>
        <table class="jobs-table wide"><thead><tr><th>Name</th><th>Sector</th><th>Weight</th><th>1-month move</th><th>Quality</th><th>Premium percentile</th><th>Trend</th><th>Risk contribution</th></tr></thead>
        <tbody>${HOLDINGS.map(
          (h) => `<tr class="clickable" ${go(`portfolio/holding/${h[0]}`)}>
          <td><strong>${h[0]}</strong></td><td>${h[1]}</td><td class="n">${h[2].toFixed(1)}%</td>
          <td class="n ${tone(h[3])}">${h[3] >= 0 ? "+" : ""}${h[3].toFixed(1)}%</td>
          <td class="n">${h[4]}</td><td class="n">${h[5]}</td>
          <td><span class="dir ${h[6] === "above" ? "bullish" : "bearish"}">${h[6]} 200d</span></td>
          <td class="n">${(h[2] * 1.18).toFixed(1)}%</td></tr>`
        ).join("")}</tbody></table></section>
      ${caveat(
        "Performance is computed on a constant-holdings basis unless a transactions export is present: today's share counts priced backward over stored closes. That excludes everything sold and holds everything bought at prices nobody paid, so it is biased toward the decisions that worked and is useful for risk and exposure rather than as a record of what was earned."
      )}`,

    changed: () => `
      ${insight(
        `${contradictory.length} of ${HOLDINGS.length} holdings carry evidence pointing both ways.`,
        "A contradiction is surfaced, never resolved into one rating. Each direction is read from a reference that already exists and is measured rather than chosen."
      )}
      <section class="panel"><div class="panel-head"><div><h2>Moves ranked, with no materiality threshold</h2>
        <p>No measured constant makes 5% of drift actionable and 4% not, so rows are ranked and none is labelled a trade.</p></div></div>
        <table class="jobs-table"><thead><tr><th>Name</th><th>1-month move</th><th>What the evidence says</th><th>Direction</th></tr></thead>
        <tbody>${[...HOLDINGS]
          .sort((a, b) => Math.abs(b[3]) - Math.abs(a[3]))
          .map(
            (h) => `<tr class="clickable" ${go(`portfolio/holding/${h[0]}`)}><td><strong>${h[0]}</strong></td>
          <td class="n ${tone(h[3])}">${h[3] >= 0 ? "+" : ""}${h[3].toFixed(1)}%</td><td>${esc(h[8])}</td>
          <td>${h[8].includes("agrees") ? `<span class="status healthy">consistent</span>` : `<span class="status stale">disagrees</span>`}</td></tr>`
          )
          .join("")}</tbody></table></section>
      ${caveat(
        "A window nobody can answer is refused in words. With a short snapshot history, <em>what changed in a month</em> has no answer — and an empty month table reads as a month in which nothing moved."
      )}`,

    risk: () => `
      ${insight(
        `${HOLDINGS.length} holdings, 7.4 effective by weight, 3.6 independent once correlation is taken out.`,
        "Two <em>effective positions</em> numbers are published apart, and the gap is the finding. One over the Herfindahl index counts how evenly the money is spread and knows nothing about what moves together — twenty holdings in one industry score twenty."
      )}
      ${metricCards([
        ["Effective by weight", "7.4", "1 / Herfindahl index", ""],
        ["Independent positions", "3.6", "after correlation", "negative"],
        ["Largest risk contribution", "9.9%", "ALPH — 8.4% of the money", ""],
        ["Covariance coverage", "94%", "of market value spanned", "positive"],
      ])}
      <section class="panel"><div class="panel-head"><div><h2>Risk contribution against weight</h2>
        <p>Correlation is load-bearing, not decoration: perfectly correlated assets split risk by weight times volatility, uncorrelated ones by the squares.</p></div></div>
        <div class="panel-body"><div class="bar-rows">${HOLDINGS.map((h) => {
          const rc = h[2] * 1.18;
          return `<div class="bar-row"><span class="bar-name">${h[0]}</span>
            <span class="bar-pair"><i class="bar w" style="width:${h[2] * 7}%"></i><i class="bar r" style="width:${rc * 7}%"></i></span>
            <span class="bar-val">${h[2].toFixed(1)}% → ${rc.toFixed(1)}%</span></div>`;
        }).join("")}</div>
        <div class="chart-footer"><div class="legend"><span><i style="background:var(--line-strong)"></i>weight</span><span><i></i>risk contribution</span></div>
        <strong>Synthetic covariance</strong></div></div></section>
      ${caveat(
        "Scenario work publishes dispersion and refuses direction. The sampled window's drift is removed before resampling, and that single step is the difference between a risk tool and a forecast: left in, a window that rose 17.8% a year centres the fan on that rise and publishes a probability of a gain."
      )}`,

    outlook: () => `
      ${insight(
        "Forward-looking evidence that was published, never modelled.",
        "Consensus revisions, surprise history, the multiple against the company's <em>own</em> normal, and implied-volatility rank — each read from a store that already exists. No forecast probability is produced anywhere on this platform."
      )}
      <section class="panel"><div class="panel-head"><div><h2>Coverage, per input and never pooled</h2>
        <p>Five sources with different universes. One number would hide which kind of blindness the page has.</p></div></div>
        <div class="panel-body"><div class="cov-rows">
          ${[
            ["Consensus revisions", 90, "six vintages of every forward year"],
            ["Earnings results", 97, "index-adjusted reaction, not the raw move"],
            ["Company's own normal multiple", 90, "keyed on the metric it is charted on"],
            ["Implied volatility rank", 90, "limited history — flagged, not implied"],
            ["Relative-strength travel", 0, "accrues forward; never backfilled"],
          ]
            .map(
              ([label, v, note]) => `<div class="cov-row"><span>${label}<small>${note}</small></span>
            <span class="cov-bar"><i style="width:${v}%" class="${v === 0 ? "zero" : ""}"></i></span><strong>${v}%</strong></div>`
            )
            .join("")}
        </div>
        ${caveat(
          "That zero is the honest answer rather than a gap: the series only began being stored per snapshot when this was built, so it accrues forward and is not backfilled — a backfill is not point-in-time."
        )}</div></section>`,
  }[tab]();

  return `${shell(
    "Portfolio",
    "The framed report owns every exact row. What a console owes here is what changed, where the evidence disagrees with itself, and whether anything needs a decision — cross-time questions a document cannot answer.",
    `<div class="tabs">${tabs
      .map((x) => `<button class="tab ${x[0] === tab ? "active" : ""}" ${go(`portfolio/${x[0]}`)}>${x[1]}</button>`)
      .join("")}</div>${body}`,
    "Synthetic book · no real holdings or balances"
  )}`;
}

function renderHoldingDetail(state) {
  const h = HOLDINGS.find((x) => x[0] === state.sub);
  if (!h) return `<div class="empty">No such holding in this prototype.</div>`;
  return `${crumbs([{ label: "Portfolio", path: "portfolio" }, { label: "Holdings", path: "portfolio/book" }, { label: h[0] }])}
  ${shell(
    `${h[0]} — ${h[1]}`,
    "One holding, with every layer's opinion kept separate and each citing the row it came from.",
    `
    ${insight(esc(h[8]), "The evidence travels with its polarity rather than being averaged into a rating. A position nobody can state a reason for is itself the finding.")}
    ${metricCards([
      ["Weight", `${h[2].toFixed(1)}%`, "of invested value", ""],
      ["Risk contribution", `${(h[2] * 1.18).toFixed(1)}%`, "share of portfolio variance", ""],
      ["Quality percentile", String(h[4]), "market percentile by construction", ""],
      ["Premium percentile", String(h[5]), "against the fair-value universe median", ""],
    ])}
    <div class="two-up">
      <section class="panel"><div class="panel-head"><div><h3>Evidence for and against</h3><p>Each line carries its own sign.</p></div></div>
        <div class="panel-body"><ul class="evidence">
          <li class="${h[4] > 60 ? "for" : "against"}">Quality at the ${h[4]}th percentile</li>
          <li class="${h[5] < 50 ? "for" : "against"}">Premium at the ${h[5]}th percentile of the fair-value universe</li>
          <li class="${h[6] === "above" ? "for" : "against"}">${titled(h[6])} its 200-day average</li>
          <li class="${h[3] > 0 ? "for" : "against"}">${h[3] >= 0 ? "+" : ""}${h[3].toFixed(1)}% over the last month</li>
          <li class="neutral">Trajectory score travels as evidence with no direction — it has no comparable reference, and assigning one would be an invention</li>
        </ul></div></section>
      <section class="panel"><div class="panel-head"><div><h3>Thesis</h3><p>The only writable layer, and the only irreplaceable one.</p></div></div>
        <div class="panel-body">
          ${
            h[8].includes("no thesis")
              ? `<p class="missing-copy">No thesis recorded. A position nobody can state a reason for leads this view rather than being hidden at the bottom of it.</p>`
              : `<p class="metric-note">An edit is <strong>a new row, never an update</strong> — the history <em>is</em> the table, keyed with microseconds so a fast double-submit cannot lose a revision to a key collision.</p>`
          }
          <span class="label">Alert rules</span>
          <p class="metric-note">Where the reader supplies the judgement the engines deliberately refuse to invent. A rule is stored with its date and reported as an assumption; repeats sit behind the same widening cooldown the job watchdog uses.</p>
        </div></section>
    </div>`,
    "Synthetic holding"
  )}`;
}

/* ------------------------------------------------- 7. stock analyzer (L0-L1) */
const COMPANIES = [
  ["ALPH", "Alpha Systems", "Software", 72, 61, 23.4, 17.7, "+10.9%", 8],
  ["BRVO", "Bravo Microdevices", "Semiconductors", 81, 38, 31.2, 22.1, "+4.1%", 12],
  ["CDEL", "Cedar Logistics", "Payments", 64, 55, 18.9, 19.4, "−1.2%", 6],
  ["DRFT", "Driftwood Health", "Health care", 49, 74, 11.2, 16.8, "−8.3%", 4],
  ["FLUX", "Flux Energy", "Energy", 41, 81, 7.8, 11.3, "+2.7%", 9],
];

function renderAnalyzer(state) {
  if (state.key) return renderCompanyDetail(state);
  return `${shell(
    "Stock analyzer",
    "The same control resolves strategies, jobs, reports, tickers and company names. Select a company for its valuation, quality, forecast record and technical state.",
    `
    ${insight(
      "Five synthetic companies stand in for the index here.",
      "The production surface resolves every registered report, its provenance, its freshness and what is missing from it. Company names in this prototype are invented."
    )}
    <section class="panel"><div class="panel-head"><div><h2>Select a company</h2><p>One search surface, four research layers behind it.</p></div></div>
      <table class="jobs-table wide"><thead><tr><th>Ticker</th><th>Company</th><th>Sector</th><th>Quality</th><th>Premium</th><th>Blended multiple</th><th>Own normal</th><th>Consensus revision</th><th>Analysts</th></tr></thead>
      <tbody>${COMPANIES.map(
        (c) => `<tr class="clickable" ${go(`analyzer/${c[0]}`)}><td><strong>${c[0]}</strong></td><td>${c[1]}</td><td>${c[2]}</td>
        <td class="n">${c[3]}</td><td class="n">${c[4]}</td><td class="n">${c[5].toFixed(1)}×</td><td class="n">${c[6].toFixed(1)}×</td>
        <td class="n ${c[7].startsWith("+") ? "positive" : "negative"}">${c[7]}</td>
        <td class="n ${c[8] < 5 ? "negative" : ""}">${c[8]}${c[8] < 5 ? " ⚠" : ""}</td></tr>`
      ).join("")}</tbody></table></section>
    ${caveat(
      "Forward estimates two years out or later need at least five analysts. Below that a rung is one person's opinion, so the ratio is withheld while the growth figure and the analyst count are still published — <em>one analyst says 265%</em> is a fact worth seeing."
    )}`,
    "Synthetic companies"
  )}`;
}

function renderCompanyDetail(state) {
  const c = COMPANIES.find((x) => x[0] === state.key);
  if (!c) return `<div class="empty">No such company in this prototype.</div>`;
  const tab = state.sub || "valuation";
  const tabs = [
    ["valuation", "Valuation"],
    ["quality", "Quality pillars"],
    ["forecast", "Forecast record"],
    ["thesis", "Thesis"],
  ];
  const thin = c[8] < 5;

  const body = {
    valuation: () => `
      ${metricCards([
        ["Blended multiple", `${c[5].toFixed(1)}×`, "on the metric it is charted on", ""],
        ["Its own ten-year normal", `${c[6].toFixed(1)}×`, "never the spot multiple", ""],
        ["Against its own history", `${(((c[5] - c[6]) / c[6]) * 100).toFixed(0)}%`, c[5] > c[6] ? "above normal" : "below normal", c[5] > c[6] ? "negative" : "positive"],
        ["Method spread", c[0] === "FLUX" ? "4.1×" : "1.8×", c[0] === "FLUX" ? "past the 3× gate — a median of these is a number nobody computed on purpose" : "within the gate", c[0] === "FLUX" ? "negative" : ""],
      ])}
      <section class="panel"><div class="panel-head"><div><h2>Three cases, and the refusals beside them</h2>
        <p>Refusing is a first-class result. Each guard below removed a name that otherwise topped the screen.</p></div></div>
        <div class="panel-body"><table class="jobs-table"><thead><tr><th>Method</th><th>Value</th><th>Status</th></tr></thead><tbody>
          <tr><td>Discounted cash flow</td><td class="n">$${(c[5] * 4.1).toFixed(2)}</td><td><span class="status healthy">applied</span></td></tr>
          <tr><td>Fair P/E on own normal</td><td class="n">$${(c[6] * 4.4).toFixed(2)}</td><td><span class="status healthy">applied</span></td></tr>
          <tr><td>EV/EBITDA</td><td class="n">${c[2] === "Payments" ? "—" : `$${(c[5] * 3.7).toFixed(2)}`}</td>
            <td>${c[2] === "Payments" ? `<span class="status stale">refused — financials get no enterprise multiple; deposits are funding, not leverage</span>` : `<span class="status healthy">applied</span>`}</td></tr>
          <tr><td>Published vendor fair value</td><td class="n">$${(c[6] * 4.0).toFixed(2)}</td><td><span class="status healthy">applied, scenario-scaled</span></td></tr>
        </tbody></table>
        ${caveat(
          "The blend is a <strong>median, not a mean</strong>. These methods do not fail gracefully — they fail by an order of magnitude, and one doing so drags a mean most of the way to itself. The spread is published either way."
        )}</div></section>`,

    quality: () => `
      <section class="panel"><div class="panel-head"><div><h2>Five pillars, ranked within the industry and the market</h2>
        <p>The ranks are computed here; the vendor's own composite sits beside them, unaltered and omitted where it does not exist.</p></div></div>
        <div class="panel-body"><div class="pillars">${[
          ["Profitability", c[3]],
          ["Cash flow generation", Math.max(5, c[3] - 9)],
          ["Financial strength", Math.min(97, c[3] + 7)],
          ["Growth", Math.max(5, c[3] - 18)],
          ["Predictability", Math.min(97, c[3] + 3)],
        ]
          .map(
            ([label, v]) => `<div class="pillar"><span>${label}</span><span class="pillar-bar"><i style="width:${v}%"></i></span><strong>${v}</strong></div>`
          )
          .join("")}</div>
        ${caveat(
          "A pillar with nothing rankable keeps a company <em>off</em> the chart rather than at the origin, and industry percentiles need at least eight peers — a rank out of four is a list, not a percentile. Direction is declared per metric, because reading it backwards would put the least-indebted company in the 1st percentile for financial strength with nothing looking wrong."
        )}</div></section>`,

    forecast: () => `
      ${metricCards([
        ["Consensus revision", c[7], "over the last year, same fiscal year", c[7].startsWith("+") ? "positive" : "negative"],
        ["Analysts covering", String(c[8]), thin ? "below the five-analyst gate" : "clears the gate", thin ? "negative" : "positive"],
        ["Median absolute error", c[0] === "BRVO" ? "37.5%" : "9.4%", "tolerance needed for half its forecasts", ""],
        ["Bias", c[0] === "ALPH" ? "beats in 17 of 24" : "balanced", "stated when lopsided", ""],
      ])}
      <section class="panel"><div class="panel-head"><div><h2>Six vintages of the same forward year</h2>
        <p>An old vintage never borrows today's number for a year it did not cover — that fallback draws a stable-looking line and erases the revision, which is the one thing this view exists to show.</p></div></div>
        <div class="panel-body"><div class="vintages">${["Two years ago", "One year ago", "Six months", "Three months", "Previous", "Current"]
          .map((v, i) => {
            const base = 8.0 + (c[7].startsWith("+") ? i * 0.26 : -i * 0.21);
            return `<div class="vintage"><span>${v}</span><strong>${base.toFixed(2)}</strong></div>`;
          })
          .join("")}</div>
        ${thin ? caveat("Thin coverage: with fewer than three analysts a rung is one person's opinion, and it is labelled rather than drawn as consensus.") : ""}</div></section>`,

    thesis: () => `
      ${insight(
        "The arithmetic is deterministic and the prose is the model's, and they are never merged.",
        "A discounted cash flow is arithmetic end to end, which makes it the worst thing to ask a model for: every intermediate is plausible and none is checkable by eye."
      )}
      <section class="panel"><div class="panel-head"><div><h2>The load-bearing half</h2><p>Why the model is not shown the computed value.</p></div></div>
        <div class="panel-body"><ol class="rules">
          <li><strong>The model never sees the first opinion.</strong> On the first live call the engine's $60.65 was included as context and the model returned <strong>$60.65</strong> — a ratio of 1.00003 and a <em>broadly agree</em> that measured nothing but its own willingness to anchor. Removing that one line moved the same company to $45.00 and flipped its verdict.</li>
          <li><strong>Statement rows never reach it.</strong> Financial statements survive text extraction as unlabelled columns, and a model asked for diluted earnings picks one of four and states it with total confidence.</li>
          <li><strong>Every claim carries a verbatim quote</strong>, checked as a literal substring of the text the model was shown. Typographic drift is folded; an altered number or a paraphrase is dropped and counted.</li>
          <li><strong>It cannot place an order or change a strategy.</strong> A web answer is accepted only when the provider returns a structured hosted-search call and result; model-written links cannot authorize their own claims.</li>
        </ol></div></section>`,
  }[tab]();

  return `${crumbs([{ label: "Stock analyzer", path: "analyzer" }, { label: c[0] }])}
  ${shell(
    `${c[0]} — ${esc(c[1])}`,
    `${esc(c[2])}. Four research layers, each allowed to return nothing and each wrapped so a failing layer costs one column rather than the page.`,
    `<div class="tabs">${tabs
      .map((x) => `<button class="tab ${x[0] === tab ? "active" : ""}" ${go(`analyzer/${c[0]}/${x[0]}`)}>${x[1]}</button>`)
      .join("")}</div>${body}`,
    "Synthetic company · no recommendation"
  )}`;
}

/* ------------------------------------------------ 8. market breadth (L0-L1) */
const INDUSTRIES = [
  ["Cloud", 2.8, "xl", 21, 17], ["Semis", 1.9, "lg", 29, 19], ["Banks", -0.8, "md", 18, 7],
  ["Retail", 0.4, "md", 24, 13], ["Media", -1.6, "lg", 14, 4], ["Energy", 1.1, "lg", 22, 15],
  ["Health", -0.2, "md", 31, 15], ["Software", 2.2, "xl", 27, 22], ["Utilities", -0.5, "md", 19, 8],
  ["Aerospace", 0.7, "md", 11, 7], ["Insurance", 0.2, "md", 16, 8], ["Autos", -2.1, "lg", 9, 2],
  ["Payments", 1.4, "md", 12, 9], ["Telecom", -0.9, "md", 7, 3], ["Materials", 0.1, "md", 20, 10],
  ["REITs", -1.2, "md", 28, 9], ["Logistics", 0.5, "md", 13, 8], ["Staples", -0.1, "md", 23, 11],
];
const heatClass = (m) => (m > 1.5 ? "up3" : m > 0.6 ? "up2" : m > 0.05 ? "up1" : m > -0.05 ? "flat" : m > -0.6 ? "down1" : m > -1.5 ? "down2" : "down3");

function renderMatrix(state) {
  if (state.key) return renderIndustryDetail(state);
  return `${shell(
    "Market breadth",
    "A completed market session. Tile area suggests relative weight; colour encodes session return. Select any tile for its constituents.",
    `
    ${insight(
      `${INDUSTRIES.filter((i) => i[1] > 0).length} of ${INDUSTRIES.length} industries advanced.`,
      "No delayed or live quote appears in this prototype. The production surface reads a completed session only, because a mid-session bar reports a day that has not happened at a number that looks entirely ordinary."
    )}
    <div class="matrix-layout">
      <section class="panel"><div class="matrix">${INDUSTRIES.map(
        (i) => `<button class="matrix-cell ${heatClass(i[1])} ${i[2]}" ${go(`matrix/${i[0]}`)}>
        <strong>${i[0]}</strong><small>${i[1] >= 0 ? "+" : "−"}${Math.abs(i[1]).toFixed(1)}%</small></button>`
      ).join("")}</div>
      <div class="panel-body"><div class="scale"><span>−3%</span><div class="scale-bar"></div><span>+3%</span></div></div></section>
      <aside class="panel matrix-detail">
        <span class="label">How to read it</span>
        <p class="metric-note">Area is relative weight, not performance — a large red tile is a big industry having a bad day, which is a different fact from a small one collapsing.</p>
        <dl><dt>Industries</dt><dd>${INDUSTRIES.length}</dd><dt>Advancing</dt><dd>${INDUSTRIES.filter((i) => i[1] > 0).length}</dd>
        <dt>Price coverage</dt><dd>100%</dd><dt>Session</dt><dd>completed</dd></dl>
        <p class="metric-note">Select any tile to open its constituent list.</p>
      </aside>
    </div>`,
    "Synthetic session"
  )}`;
}

function renderIndustryDetail(state) {
  const i = INDUSTRIES.find((x) => x[0] === state.key);
  if (!i) return `<div class="empty">No such industry in this prototype.</div>`;
  const members = Array.from({ length: Math.min(10, i[3]) }, (_, k) => {
    const spread = (k - 4.5) * 0.9 + i[1];
    return [`${i[0].slice(0, 2).toUpperCase()}${String(k + 1).padStart(2, "0")}`, spread, 40 + ((k * 13) % 55)];
  });
  return `${crumbs([{ label: "Market breadth", path: "matrix" }, { label: i[0] }])}
  ${shell(
    `${i[0]} — ${i[1] >= 0 ? "+" : "−"}${Math.abs(i[1]).toFixed(1)}%`,
    "One industry's completed session, with the constituents underneath the tile.",
    `
    ${metricCards([
      ["Session move", `${i[1] >= 0 ? "+" : "−"}${Math.abs(i[1]).toFixed(1)}%`, "equal-weighted", tone(i[1])],
      ["Advancers", `${i[4]} / ${i[3]}`, "breadth within the industry", i[4] / i[3] > 0.5 ? "positive" : "negative"],
      ["Above 20-day average", `${Math.round((i[4] / i[3]) * 100)}%`, "trend participation", ""],
      ["Coverage", "100%", "every member priced this session", "positive"],
    ])}
    <section class="panel"><div class="panel-head"><div><h2>Constituents</h2><p>Synthetic names. Select one to open the analyzer pattern.</p></div></div>
      <table class="jobs-table"><thead><tr><th>Name</th><th>Session move</th><th>Quality percentile</th><th>Participation</th></tr></thead>
      <tbody>${members
        .map(
          (m) => `<tr><td><strong>${m[0]}</strong></td><td class="n ${tone(m[1])}">${m[1] >= 0 ? "+" : ""}${m[1].toFixed(1)}%</td>
        <td class="n">${m[2]}</td><td>${sparkRow([2, -1, 3, 1, -2, 4, 2, 5].map((x) => x + m[1]))}</td></tr>`
        )
        .join("")}</tbody></table></section>
    ${caveat(
      "Breadth is read off a completed session on the benchmark's own calendar. A name missing a bar breaks its run rather than bridging the gap — a day the market did not open is a day the benchmark has no bar for, so holidays need no table."
    )}`,
    "Synthetic constituents"
  )}`;
}

/* --------------------------------------------------- 9. reports & research */
const REPORTS = [
  ["Reversal signal verification", "Signals", 1, "Grades every published signal at 5, 10 and 20 sessions.", "verified"],
  ["Forward test leaderboard", "Forward tests", 2, "One execution model, one ranking contract, fourteen books.", "books"],
  ["S&P 500 annual winners vs losers", "Index research", 36, "Point-in-time cohorts at 10, 25 and 50 stocks over ten holding years.", null],
  ["Monthly direction history", "Index research", 40, "Ten years of month-end direction per current member.", null],
  ["S&P 500 quality map", "Valuation", 18, "Five pillars, computed percentiles, vendor composite beside them.", null],
  ["S&P 500 valuation map", "Valuation", 18, "Conservative upside, own-normal and sector multiples.", null],
  ["Drawdown and recovery", "Market behaviour", 72, "Downside, time to recover, and benchmark-relative return.", null],
  ["Correlated stocks", "Market behaviour", 25, "What actually moves with what you hold, in the current regime.", null],
  ["Job health audit", "Operations", 1, "Cadence-aware verdicts across every registered job.", "jobs"],
  ["Earnings digest", "Earnings", 26, "Filed releases read with a local model, every claim quoted.", null],
];

function renderReports(state) {
  if (state.key) return renderReportDetail(state);
  const stale = REPORTS.filter((r) => r[2] > 48);
  return `${shell(
    "Reports & research",
    "One discovery layer over immutable artifacts. Freshness is judged against each report's own cadence, so a quarterly study three weeks old is fine and a daily signal three weeks old is not.",
    `
    ${insight(
      `${stale.length} of ${REPORTS.length} artifacts are past their own cadence.`,
      "A single global threshold misclassified weekend, intraday, daily and monthly work. Age and the cadence it is judged against travel as numbers beside each other, so the bar is a ratio and past 1.0 means the same thing for an hourly bot and a monthly study."
    )}
    <section class="panel"><div class="panel-head"><div><h2>Freshness against each artifact's own cadence</h2>
      <p>Select any row. Rows that open something carry a marker the read-only rows do not.</p></div></div>
      <table class="jobs-table wide"><thead><tr><th>Artifact</th><th>Category</th><th>Age</th><th>Against cadence</th><th>State</th></tr></thead>
      <tbody>${REPORTS.map((r) => {
        const ratio = Math.min(1.6, r[2] / 48);
        return `<tr class="${r[5] ? "clickable" : ""}" ${r[5] ? go(r[5]) : ""}>
        <td><strong>${esc(r[0])}</strong><small>${esc(r[3])}</small></td><td>${esc(r[1])}</td>
        <td class="n">${r[2]}h</td>
        <td><span class="cov-bar wide"><i style="width:${(ratio / 1.6) * 100}%" class="${ratio > 1 ? "over" : ""}"></i></span></td>
        <td>${ratio > 1 ? `<span class="status stale">past cadence</span>` : `<span class="status healthy">fresh</span>`}${
          r[5] ? ` <span class="opens">opens →</span>` : ""
        }</td></tr>`;
      }).join("")}</tbody></table></section>
    ${caveat(
      "A report is <strong>two registrations, not one</strong>. One makes it exist; the second decides where it sits. Register the first and forget the second and it still renders — in the catch-all bucket, on the index <em>and</em> in the console, so the omission looks like a layout choice rather than a mistake. Three reports were sitting there at once."
    )}`,
    `${REPORTS.length} registered artifacts`
  )}`;
}

function renderReportDetail(state) {
  return `${crumbs([{ label: "Reports & research", path: "reports" }, { label: state.key }])}
    <div class="empty">This artifact opens as its own view in the prototype.</div>`;
}

/* ------------------------------------------------------- 10. seasonality */
const CANDIDATES = [
  ["RCL-like", 2.45, 7.4, 18, "2nd on the calendar, 27th on the tape"],
  ["CAT-like", 2.11, 15.0, 22, "4th on edge against a technical 15"],
  ["Candidate C", 1.82, 61.0, 14, "Both halves agree"],
  ["Candidate D", 1.44, 72.3, 20, "Both halves agree"],
  ["Candidate E", 1.21, 34.1, 9, "Thin sample — eight prior years"],
  ["Candidate F", 0.97, 58.6, 16, "Both halves agree"],
];

function renderSeasonality(state) {
  if (state.key) return renderCandidateDetail(state);
  const disagree = CANDIDATES.filter((c) => c[4].includes("against") || c[4].includes("tape"));
  return `${shell(
    "Seasonality board",
    "The bot stores the five names it sized and nothing else. Ten ranked names and every merely-qualified name were discarded the moment the sleeve was written, so what nearly made it — and which half of the score stopped it — had no answer.",
    `
    ${insight(
      `${disagree.length} of ${CANDIDATES.length} scored names have their two halves pointing opposite ways.`,
      "The disagreement is a <em>position</em>, not a subtraction. On two axes — calendar edge against the tape, bubble size the number of prior years — the corners are the finding. A strong edge over 8 years is a weaker claim than the same edge over 22."
    )}
    <section class="panel"><div class="panel-head"><div><h2>This month's board — select any candidate</h2>
      <p>A decision board, not a pick list.</p></div><span class="meta-pill">Synthetic candidates</span></div>
      <table class="jobs-table wide"><thead><tr><th>Candidate</th><th>Seasonal edge</th><th>Technical score</th><th>Prior years</th><th>Where the two halves stand</th></tr></thead>
      <tbody>${CANDIDATES.map(
        (c) => `<tr class="clickable" ${go(`seasonality/${encodeURIComponent(c[0])}`)}><td><strong>${esc(c[0])}</strong></td>
        <td class="n positive">+${c[1].toFixed(2)}pp</td><td class="n ${c[2] < 20 ? "negative" : ""}">${c[2].toFixed(1)}</td>
        <td class="n">${c[3]}</td><td>${esc(c[4])}</td></tr>`
      ).join("")}</tbody></table></section>
    ${caveat(
      "Two provenance warnings, never merged. <em>Provisional</em> is about when a board was formed and applies to its technical half only — the seasonal half of a next-month board is final, since every prior year's month is complete. <em>Mixed vintage</em> is a data fault that invalidates the ranking outright and is recorded as a job failure."
    )}`,
    `${CANDIDATES.length} candidates`
  )}`;
}

function renderCandidateDetail(state) {
  const key = decodeURIComponent(state.key);
  const c = CANDIDATES.find((x) => x[0] === key);
  if (!c) return `<div class="empty">No such candidate in this prototype.</div>`;
  return `${crumbs([{ label: "Seasonality board", path: "seasonality" }, { label: c[0] }])}
  ${shell(
    esc(c[0]),
    "One candidate, with the calendar and the tape kept apart so their disagreement stays visible.",
    `
    ${insight(esc(c[4]), "The bot buys the top five after re-ranking on a 25/75 calendar/tape blend. A ranked name can still be dropped outright by sizing — a share price above the per-position budget yields a zero quantity, which is the more interesting case.")}
    ${metricCards([
      ["Seasonal edge", `+${c[1].toFixed(2)}pp`, "the calendar alone", "positive"],
      ["Technical score", c[2].toFixed(1), "the tape, frozen model", c[2] < 20 ? "negative" : ""],
      ["Prior years", String(c[3]), c[3] < 10 ? "thin sample" : "sample supports the edge", c[3] < 10 ? "negative" : ""],
      ["Blend weight", "25 / 75", "calendar / tape, as the bot sizes it", ""],
    ])}
    <section class="panel"><div class="panel-head"><div><h2>Why the board exists at all</h2></div></div>
      <div class="panel-body"><ol class="rules">
        <li><strong>Three views, two computations.</strong> A board yields both orderings — the calendar alone and the blend the bot acts on — so the second view costs nothing extra.</li>
        <li><strong>Not bought is read from the bot's own state</strong>, not from "ranked sixth or lower", because sizing can drop a ranked name outright.</li>
        <li><strong>The vintage check exists because nothing downstream checks it.</strong> A name whose latest bar has not landed yet is scored on the previous session and returns an entirely plausible number, and a percentile struck across two sessions is wrong in a way no individual score reveals.</li>
        <li><strong>A day's rows are replaced whole.</strong> A per-ticker upsert strands a name the screen no longer qualifies.</li>
      </ol></div></section>`,
    "Synthetic candidate"
  )}`;
}

/* ------------------------------------------------------- 11. research agent */
function renderAgent() {
  return `${shell(
    "Research agent",
    "The agent can inspect and explain registered evidence. It cannot place an order, change a schedule, or alter a strategy.",
    `
    <section class="panel agent-shell">
      <div class="conversation">
        <div class="message user">Did the reversal signals actually work?</div>
        <div class="message"><strong>They split by direction, and the split is the answer.</strong><br><br>
          Bearish warnings — a failed breakout or a new 52-week low — beat the benchmark
          ${pct(D.verification.totals.find((t) => t.horizon === 10 && t.direction === "bearish").hit_rate)}
          of the time at ten completed sessions across
          ${D.verification.totals.find((t) => t.horizon === 10 && t.direction === "bearish").scored} graded episodes.
          Bullish reversal calls managed
          ${pct(D.verification.totals.find((t) => t.horizon === 10 && t.direction === "bullish").hit_rate)}.<br><br>
          One caveat travels with that: the beaten-down cohort those warnings were drawn from
          was already underperforming by
          ${signed(D.verification.cohort.find((c) => c.horizon === 10).mean_relative)}
          at the same horizon, so part of the bearish rate is the population rather than signal skill.<br><br>
          <small>Derived from the verification store shown in this prototype. Pooling the two
          would average opposite claims into one rate that rises as the bullish calls get worse,
          which is why the page refuses to publish it.</small></div>
        <form class="agent-input" id="agent-form">
          <input id="agent-question" placeholder="Ask about this prototype's evidence" aria-label="Question for the demo agent">
          <button class="primary-button">Ask</button></form>
      </div>
      <aside class="agent-side">
        <h3>Evidence inspected</h3>
        <button class="source clickable" ${go("verified")}><strong>Signal verification store</strong><br>${num(D.verification.signals)} signals · ${D.verification.rows.filter((r) => r.horizon === 10).length} event types<span class="opens">open →</span></button>
        <button class="source clickable" ${go("books")}><strong>Forward test books</strong><br>${D.books.length} books · ${D.books.filter((b) => b.rankable).length} rankable<span class="opens">open →</span></button>
        <button class="source clickable" ${go("jobs")}><strong>Job health ledger</strong><br>${D.jobs.length} registered · ${D.jobs.filter((j) => j.status !== "healthy").length} exceptions<span class="opens">open →</span></button>
        <h3 style="margin-top:18px">Boundary</h3>
        <div class="source"><strong>Read only</strong><br>No order, no schedule change, no strategy edit. A hosted web answer is accepted only when the provider returns a structured search call and result.</div>
      </aside>
    </section>`,
    "Read-only boundary enforced"
  )}`;
}

/* ----------------------------------------------------------------- router */
const views = {
  dashboard: { title: "What to look at today", eyebrow: "Action queue · operating view", render: renderDashboard },
  verified: { title: "Were they right?", eyebrow: "Signal verification · measured outcomes", render: renderVerified },
  books: { title: "Forward tests", eyebrow: "One execution model · hypothetical books", render: renderBooks },
  strategies: { title: "Strategies", eyebrow: "Lifecycle registry", render: renderStrategies },
  jobs: { title: "Bots & jobs", eyebrow: "Cadence-aware observability", render: renderJobs },
  portfolio: { title: "Portfolio", eyebrow: "Synthetic book · no real balances", render: renderPortfolio },
  analyzer: { title: "Stock analyzer", eyebrow: "Cross-sectional research", render: renderAnalyzer },
  matrix: { title: "Market breadth", eyebrow: "Completed session", render: renderMatrix },
  seasonality: { title: "Seasonality board", eyebrow: "Candidate workflow", render: renderSeasonality },
  reports: { title: "Reports & research", eyebrow: "Registered artifacts", render: renderReports },
  agent: { title: "Research agent", eyebrow: "Evidence-grounded · read only", render: renderAgent },
};

let current = { view: "dashboard" };

/* `#view/key/sub` plus an optional `?filter`, so every level of every screen is
 * a URL. Before this the prototype had one address and every reload landed on
 * the dashboard. */
function parseHash() {
  const raw = location.hash.slice(1);
  const [path, q] = raw.split("?");
  const [view, key, sub] = path.split("/").map((x) => (x ? decodeURIComponent(x) : undefined));
  return { view: views[view] ? view : "dashboard", key, sub, q };
}

function render() {
  const state = parseHash();
  current = state;
  const view = views[state.view];
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.view === state.view));
  document.getElementById("page-title").textContent = view.title;
  document.getElementById("page-eyebrow").textContent = view.eyebrow;
  const root = document.getElementById("view-root");
  root.innerHTML = view.render(state);
  bindLocal(state);
  if (window.TOUR) window.TOUR.onRender(state);
  document.querySelector(".sidebar").classList.remove("open");
  document.getElementById("mobile-nav").setAttribute("aria-expanded", "false");
}

function navigate(path) {
  if (location.hash.slice(1) === path) {
    render();
    return;
  }
  location.hash = path;
}
window.navigate = navigate;

/* One delegated handler for every drill-down on every screen. */
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-go]");
  if (!target) return;
  event.preventDefault();
  navigate(target.dataset.go);
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
});

/* A row that is navigable must also be reachable from the keyboard. */
document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target.closest("tr[data-go], article[data-go]");
  if (!target) return;
  event.preventDefault();
  navigate(target.dataset.go);
});

function bindLocal(state) {
  /* Table and card filters are local to a view and never change the URL, so a
   * typed filter cannot send you to a different screen — the most surprising
   * thing the first version did. */
  const jobSearch = document.getElementById("job-search");
  if (jobSearch) {
    jobSearch.addEventListener("input", () => {
      const q = jobSearch.value.trim().toLowerCase();
      const base = D.jobs.filter((j) => !state.q || state.q === "all" || j.status === state.q);
      document.getElementById("job-rows").innerHTML = jobRows(
        base.filter((j) => j.name.toLowerCase().includes(q) || j.owner.toLowerCase().includes(q))
      );
    });
  }
  const strategySearch = document.getElementById("strategy-search");
  if (strategySearch) {
    strategySearch.addEventListener("input", () => {
      const q = strategySearch.value.trim().toLowerCase();
      document.querySelectorAll("[data-strategy]").forEach((card) => {
        card.hidden = !card.dataset.strategy.includes(q);
      });
      document.querySelectorAll(".stage-block").forEach((block) => {
        block.hidden = ![...block.querySelectorAll("[data-strategy]")].some((c) => !c.hidden);
      });
    });
  }
  document.getElementById("agent-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    toast("This prototype is read-only — the navigation is the thing to try");
  });
  document.querySelectorAll(".chart-range button").forEach((b) =>
    b.addEventListener("click", () => {
      [...b.parentElement.children].forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      toast(`${b.textContent} window selected`);
    })
  );
}

/* --------------------------------------------------------- global chrome */
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
}
window.toast = toast;

/* Search is a palette, not an injector: results never rewrite the screen you
 * are reading to answer a question about a different one. */
const INDEX = [
  ...Object.entries(views).map(([k, v]) => ({ label: v.title, group: "Screen", path: k })),
  ...D.strategies.map((s) => ({ label: s.name, group: "Strategy", path: `strategies/${s.key}` })),
  ...D.books.map((b) => ({ label: b.name || b.key, group: "Book", path: `books/${b.key}` })),
  ...D.verification.rows
    .filter((r) => r.horizon === 10)
    .map((r) => ({ label: titled(r.event_type), group: "Signal", path: `verified/${r.event_type}` })),
  ...D.jobs.slice(0, 60).map((j) => ({ label: j.name, group: "Job", path: `jobs/${j.name}` })),
  ...COMPANIES.map((c) => ({ label: `${c[0]} — ${c[1]}`, group: "Company", path: `analyzer/${c[0]}` })),
];

const search = document.getElementById("global-search");
const results = document.getElementById("search-results");
search.addEventListener("input", () => {
  const q = search.value.trim().toLowerCase();
  const hits = q ? INDEX.filter((x) => x.label.toLowerCase().includes(q)).slice(0, 8) : [];
  results.hidden = !hits.length;
  results.innerHTML = hits
    .map((x) => `<button class="search-result" ${go(x.path)}><span>${esc(x.label)}</span><small>${x.group}</small></button>`)
    .join("");
});
results.addEventListener("click", () => {
  search.value = "";
  results.hidden = true;
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    search.focus();
  }
  if (event.key === "Escape") {
    results.hidden = true;
    search.blur();
  }
});

document.getElementById("mobile-nav").addEventListener("click", (event) => {
  const sidebar = document.querySelector(".sidebar");
  sidebar.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(sidebar.classList.contains("open")));
});

window.addEventListener("hashchange", render);
render();
