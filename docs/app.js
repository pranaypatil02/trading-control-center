const views = {
  dashboard: { title: "What to look at today", eyebrow: "Operating view · synthetic snapshot", render: renderDashboard },
  seasonality: { title: "Seasonality board", eyebrow: "Candidate workflow · synthetic data", render: renderSeasonality },
  analyzer: { title: "Stock analyzer", eyebrow: "Cross-sectional research · public demo", render: renderAnalyzer },
  agent: { title: "Research agent", eyebrow: "Evidence-grounded · read only", render: renderAgent },
  strategies: { title: "Strategies", eyebrow: "Lifecycle registry · synthetic portfolio", render: renderStrategies },
  jobs: { title: "Bots & jobs", eyebrow: "Cadence-aware observability · synthetic runs", render: renderJobs },
  health: { title: "Alerts & health", eyebrow: "Exceptions first · synthetic incidents", render: renderJobs },
  performance: { title: "Book performance", eyebrow: "Execution and attribution · synthetic P&L", render: renderPerformance },
  reports: { title: "Reports & research", eyebrow: "Registered artifacts · public demo", render: renderReports },
  matrix: { title: "Market breadth", eyebrow: "Completed session · synthetic market data", render: renderMatrix },
};

const jobs = [
  { name: "Market data close", owner: "Data foundation", status: "healthy", cadence: "Weekdays · 16:20 ET", age: "18m ago", runs: "oooooooooooo" },
  { name: "Paper account reconcile", owner: "Portfolio operations", status: "healthy", cadence: "Every 15 minutes", age: "7m ago", runs: "oooooooooooo" },
  { name: "Earnings digest", owner: "Earnings research", status: "failing", cadence: "Daily · 07:00 ET", age: "1d ago", runs: "oooooxxxoxxx" },
  { name: "Breadth snapshot", owner: "Market research", status: "healthy", cadence: "Weekdays · 16:35 ET", age: "13m ago", runs: "oooooooooooo" },
  { name: "Seasonal board", owner: "Seasonality", status: "stale", cadence: "Monthly + daily check", age: "2d ago", runs: "oooooolooooo" },
  { name: "Signal evidence ledger", owner: "Platform", status: "healthy", cadence: "After every decision", age: "4m ago", runs: "oooooooooooo" },
  { name: "Research report index", owner: "Research platform", status: "healthy", cadence: "Every 6 hours", age: "2h ago", runs: "oooooooooooo" },
];

const matrixNames = [
  ["Cloud", "+2.8%", "up3", "xl"], ["Semis", "+1.9%", "up2", "lg"], ["Banks", "−0.8%", "down1", "md"],
  ["Retail", "+0.4%", "up1", "md"], ["Media", "−1.6%", "down2", "lg"], ["Energy", "+1.1%", "up2", "lg"],
  ["Health", "−0.2%", "flat", "md"], ["Software", "+2.2%", "up3", "xl"], ["Utilities", "−0.5%", "down1", "md"],
  ["Aerospace", "+0.7%", "up1", "md"], ["Insurance", "+0.2%", "flat", "md"], ["Autos", "−2.1%", "down3", "lg"],
  ["Payments", "+1.4%", "up2", "md"], ["Telecom", "−0.9%", "down1", "md"], ["Materials", "+0.1%", "flat", "md"],
  ["REITs", "−1.2%", "down2", "md"], ["Logistics", "+0.5%", "up1", "md"], ["Staples", "−0.1%", "flat", "md"],
];

const strategies = [
  ["Intraday index sleeve", "Paper", "Short-horizon research system with an explicit pre-trade decision gate.", "Healthy"],
  ["Post-event drift", "Paper", "Event-driven sleeve measured from executable prices, not announcement hindsight.", "Attention"],
  ["Persistent reversal", "Paper", "Forward monitor separating beaten-down severity from reversal confirmation.", "Healthy"],
  ["Seasonal strength", "Signals", "Monthly candidate board with benchmark-relative evidence and freshness gates.", "Healthy"],
  ["Fundamental inflection", "Research", "Point-in-time change detector over normalized filing and estimate history.", "Research"],
  ["Quality & value", "Research", "Cross-sectional scorecard with missingness disclosed rather than imputed.", "Research"],
];

function shell(title, description, body, meta = "Interactive public demo") {
  return `<div class="surface-head"><div><h2>${title}</h2><p>${description}</p></div><span class="meta-pill">${meta}</span></div>${body}`;
}

function renderDashboard() {
  const metrics = [
    ["Today", "+$184", "3 settled decisions", "positive"],
    ["Month to date", "+$1,240", "net across paper sleeves", "positive"],
    ["Year to date", "+$4,820", "126 synthetic trades", "positive"],
    ["Per trade", "+$38.25", "settled synthetic sample", "positive"],
    ["Exposure", "7", "$8,400 simulated at risk", ""],
    ["Jobs on schedule", "68 of 72", "judged against each cadence", ""],
    ["Data coverage", "98.7%", "required inputs present", "positive"],
    ["Open incidents", "3", "two retrying · one triaged", "negative"],
  ];
  return `
    <div class="verdict">
      <article class="verdict-card"><span class="label">Portfolio verdict</span><div class="big-number">+$4,820</div><p class="metric-note">Synthetic year-to-date realized result<br>126 trades · 58% hit rate</p></article>
      <article class="verdict-card verdict-copy"><span class="label">Operator summary</span><h2>Profitable, data complete, three workflows need attention.</h2><p>The paper book is ahead of its benchmark in this synthetic snapshot. Most automation is on cadence; exceptions are named below so the operator can move from verdict to cause without opening every bot.</p></article>
    </div>
    <div class="metric-grid">${metrics.map(m => `<article class="metric-card"><span class="label">${m[0]}</span><div class="value ${m[3]}">${m[1]}</div><p>${m[2]}</p></article>`).join("")}</div>
    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-head"><div><h2>Cumulative realized P&amp;L</h2><p>Paper execution compared with the same decisions at benchmark fills.</p></div><div class="segmented chart-range"><button data-range="30">30d</button><button data-range="90" class="active">90d</button><button data-range="all">All</button></div></div>
        <div class="panel-body"><div class="chart-wrap">${chartSvg()}</div><div class="chart-footer"><div class="legend"><span><i></i>Realized</span><span><i class="benchmark"></i>Benchmark fills</span></div><strong>Demo series · values are synthetic</strong></div></div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>Needs attention — 3</h2><p>Jobs and schedules, not trade picks.</p></div><span class="status failing">Action</span></div>
        <div class="panel-body">
          <div class="attention-list">
            <button class="attention-row" data-open-jobs><span class="status-icon">!</span><span><strong>Earnings digest</strong><p>Failed after source schema changed · retry stopped safely</p></span><span class="age">1d</span></button>
            <button class="attention-row" data-open-jobs><span class="status-icon">!</span><span><strong>Seasonal board</strong><p>Past its own observed monthly cadence</p></span><span class="age">2d</span></button>
            <button class="attention-row" data-open-jobs><span class="status-icon">!</span><span><strong>Coverage verifier</strong><p>One vendor partition below the release threshold</p></span><span class="age">41m</span></button>
          </div>
          <div class="coverage"><div class="coverage-top"><span>Automation coverage</span><strong>68 / 72 on schedule</strong></div><div class="coverage-bar"><i></i><i></i><i></i></div></div>
        </div>
      </section>
    </div>`;
}

function chartSvg() {
  return `<svg class="chart-svg" viewBox="0 0 760 220" role="img" aria-label="Synthetic cumulative profit and loss line chart">
    <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3478d4" stop-opacity=".18"/><stop offset="1" stop-color="#3478d4" stop-opacity="0"/></linearGradient></defs>
    <g class="chart-grid"><line x1="46" x2="742" y1="30" y2="30"/><line x1="46" x2="742" y1="78" y2="78"/><line x1="46" x2="742" y1="126" y2="126"/><line x1="46" x2="742" y1="174" y2="174"/></g>
    <g><text x="4" y="33">$6k</text><text x="4" y="81">$4k</text><text x="4" y="129">$2k</text><text x="14" y="177">$0</text><text x="47" y="207">Jun</text><text x="375" y="207">Jul</text><text x="718" y="207">Sep</text></g>
    <path class="chart-area" d="M48 174 L93 151 L137 157 L181 122 L226 131 L270 91 L314 106 L358 83 L403 94 L447 62 L491 72 L535 50 L580 67 L624 43 L668 51 L718 36 L742 39 L742 178 L48 178 Z"/>
    <path class="chart-benchmark" d="M48 174 L93 160 L137 144 L181 139 L226 119 L270 113 L314 101 L358 97 L403 83 L447 80 L491 68 L535 66 L580 57 L624 55 L668 47 L718 42 L742 41"/>
    <path class="chart-line" d="M48 174 L93 151 L137 157 L181 122 L226 131 L270 91 L314 106 L358 83 L403 94 L447 62 L491 72 L535 50 L580 67 L624 43 L668 51 L718 36 L742 39"/>
    <circle class="chart-point" cx="742" cy="39" r="4"/><text x="669" y="23" style="fill:#2368cf;font-weight:800">+$4,820</text>
  </svg>`;
}

function renderJobs() {
  return shell("Cadence-aware job health", "Every workflow is evaluated against its own expected rhythm. A past success expires; silence is never green.", `
    <div class="toolbar"><div class="chips" id="job-filters"><button class="chip active" data-filter="all">All 72</button><button class="chip" data-filter="failing">Needs attention 3</button><button class="chip" data-filter="healthy">Healthy 68</button><button class="chip" data-filter="stale">Stale 1</button></div><input class="inline-search" id="job-search" placeholder="Filter jobs" aria-label="Filter jobs"></div>
    <section class="panel"><table class="jobs-table"><thead><tr><th>Workflow</th><th>Status</th><th>Cadence</th><th>Recent reliability</th><th>Last evidence</th></tr></thead><tbody id="job-rows">${jobRows(jobs)}</tbody></table></section>
  `, "72 registered workflows · representative rows");
}

function jobRows(list) {
  if (!list.length) return `<tr><td colspan="5" class="empty">No jobs match this filter.</td></tr>`;
  return list.map(j => `<tr data-status="${j.status}"><td><strong>${j.name}</strong><small>${j.owner}</small></td><td><span class="status ${j.status}">${j.status}</span></td><td>${j.cadence}</td><td><span class="reliability" aria-label="Recent runs">${[...j.runs].map(x => `<i class="${x === "o" ? "ok" : x === "x" ? "fail" : "late"}"></i>`).join("")}</span></td><td>${j.age}</td></tr>`).join("");
}

function renderMatrix() {
  return shell("Market breadth matrix", "A treemap-inspired operating view of a completed market session. Tile area suggests relative market weight; colour encodes session return. Select any tile for detail.", `
    <div class="toolbar"><div class="chips" id="matrix-group"><button class="chip active">Industry</button><button class="chip">Sector</button><button class="chip">Market-cap tier</button></div><div class="segmented" id="matrix-period"><button class="active">1D</button><button>5D</button><button>1M</button></div></div>
    <div class="matrix-layout">
      <section class="panel"><div class="matrix" id="matrix-grid">${matrixNames.map((m, i) => `<button class="matrix-cell ${m[2]} ${m[3]}" data-name="${m[0]}" data-move="${m[1]}" data-index="${i}"><strong>${m[0]}</strong><small>${m[1]}</small></button>`).join("")}</div><div class="panel-body"><div class="scale"><span>−3%</span><div class="scale-bar"></div><span>+3%</span></div></div></section>
      <aside class="panel matrix-detail" id="matrix-detail"><span class="label">Selected industry</span><div class="move positive">+2.8%</div><h2>Cloud</h2><p class="metric-note">Synthetic completed-session breadth. No delayed or live quotes are shown in this public demo.</p><dl><dt>Advancers</dt><dd>17 / 21</dd><dt>Above 20-day average</dt><dd>71%</dd><dt>Relative volume</dt><dd>1.24×</dd><dt>Coverage</dt><dd>100%</dd></dl></aside>
    </div>
  `, "Synthetic session · 98.7% price coverage");
}

function renderStrategies() {
  return shell("Strategy registry", "Research, signals, paper trading, and production are explicit lifecycle states. Promotion requires evidence; it is never inferred from a strong chart.", `
    <div class="toolbar"><div class="chips"><button class="chip active">All 40</button><button class="chip">Paper 10</button><button class="chip">Signals 11</button><button class="chip">Research 12</button></div><input class="inline-search" id="strategy-search" placeholder="Filter strategies" aria-label="Filter strategies"></div>
    <div class="strategy-grid" id="strategy-grid">${strategyCards(strategies)}</div>
  `);
}

function strategyCards(items) {
  return items.map(s => `<article class="strategy-card" data-strategy="${s[0].toLowerCase()}"><div class="card-top"><h3>${s[0]}</h3><span class="tag">${s[1]}</span></div><p class="card-copy">${s[2]}</p><div class="card-meta"><span class="status ${s[3] === "Attention" ? "failing" : "healthy"}">${s[3]}</span><span>Open workspace →</span></div></article>`).join("");
}

function renderSeasonality() {
  const names = ["Candidate 01", "Candidate 02", "Candidate 03", "Candidate 04", "Candidate 05", "Candidate 06"];
  return shell("This month's board", "A decision board, not a pick list. Each candidate carries coverage, benchmark-relative evidence, and an explicit next action.", `
    <div class="tabs" id="season-tabs"><button class="tab active" data-season="current">Current board</button><button class="tab" data-season="edge">Seasonal edge only</button><button class="tab" data-season="next">Next month preview</button><button class="tab" data-season="sleeve">Sleeve &amp; performance</button></div>
    <div class="season-grid" id="season-grid">${names.map((n,i) => `<article class="season-card"><div class="card-top"><h3>${n}</h3><span class="tag">${i < 2 ? "Review" : "Watch"}</span></div><p class="card-copy">${62 + i * 4}% historical win rate · ${(3.1 + i * .4).toFixed(1)}% median month · ${i % 2 ? "ahead" : "in line"} versus benchmark.</p><div class="card-meta"><span>10-year sample</span><strong>${i < 2 ? "Evidence ready" : "Monitor"}</strong></div></article>`).join("")}</div>
  `, "29 candidates · synthetic evidence");
}

function renderAnalyzer() {
  return shell("Cross-sectional stock analyzer", "Search is deliberately constrained in the public demo. The production surface resolves registered reports, provenance, freshness, and missingness.", `
    <section class="panel"><div class="panel-body"><div class="toolbar"><input class="inline-search" id="ticker-search" value="DEMO" aria-label="Synthetic ticker"><button class="primary-button" id="analyze-button">Analyze</button></div>
    <div class="metric-grid"><article class="metric-card"><span class="label">Quality percentile</span><div class="value positive">82</div><p>Profitability and cash-flow composite</p></article><article class="metric-card"><span class="label">Valuation percentile</span><div class="value">61</div><p>Relative to sector and own history</p></article><article class="metric-card"><span class="label">Momentum</span><div class="value positive">+8.4%</div><p>Six-month benchmark-relative return</p></article><article class="metric-card"><span class="label">Input coverage</span><div class="value positive">96%</div><p>One optional estimate field missing</p></article></div></div></section>
  `, "Synthetic company · no recommendation");
}

function renderAgent() {
  return shell("Evidence-grounded research agent", "The agent can inspect and explain registered evidence. It cannot place orders, alter schedules, or change a strategy.", `
    <section class="panel agent-shell"><div class="conversation"><div class="message user">Which platform workflows need attention today?</div><div class="message"><strong>Three workflows need attention.</strong><br><br>The earnings digest stopped after an upstream schema change; its retry budget was exhausted safely. The seasonal board is stale against its observed cadence. One coverage verifier is below its publication gate, so downstream rankings were not released.<br><br><small>Answer derived from the synthetic job ledger shown in this demo.</small></div><form class="agent-input" id="agent-form"><input id="agent-question" placeholder="Ask about this demo's evidence" aria-label="Question for demo agent"><button class="primary-button">Ask</button></form></div><aside class="agent-side"><h3>Evidence inspected</h3><div class="source"><strong>Job health ledger</strong><br>72 registered · 3 exceptions</div><div class="source"><strong>Report freshness index</strong><br>39 artifacts · cadence aware</div><div class="source"><strong>Data coverage gate</strong><br>98.7% required inputs</div></aside></section>
  `, "Read-only boundary enforced");
}

function renderPerformance() {
  return shell("Paper-book performance", "Synthetic execution outcomes are separated from idealized fills so strategy selection and execution quality cannot be confused.", `<section class="panel"><div class="panel-head"><div><h2>Realized versus benchmark fills</h2><p>Same synthetic decisions, different execution assumptions.</p></div><span class="status healthy">Ahead</span></div><div class="panel-body"><div class="chart-wrap">${chartSvg()}</div></div></section>`, "Synthetic values · paper only");
}

function renderReports() {
  const reports = [["Decision evidence summary","Operations","Refreshed today"],["Market breadth matrix","Market research","Refreshed today"],["Strategy scorecard","Platform","Refreshed 2h ago"],["Execution attribution","Portfolio","Refreshed today"],["Data freshness audit","Data foundation","Refreshed 18m ago"],["Seasonal evidence board","Seasonality","Past cadence"]];
  return shell("Registered research artifacts", "One discovery layer over immutable reports. Freshness and ownership travel with every artifact.", `<div class="report-grid">${reports.map(r => `<article class="report-card"><div class="card-top"><h3>${r[0]}</h3><span class="tag">HTML</span></div><p class="card-copy">${r[1]} · registered read-only artifact with an explicit refresh cadence.</p><div class="card-meta"><span>${r[2]}</span><strong>Open →</strong></div></article>`).join("")}</div>`);
}

function setView(name, push = true) {
  const view = views[name] || views.dashboard;
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === name));
  document.getElementById("page-title").textContent = view.title;
  document.getElementById("page-eyebrow").textContent = view.eyebrow;
  document.getElementById("view-root").innerHTML = view.render();
  bindViewEvents(name);
  if (push) history.replaceState(null, "", `#${name}`);
  document.querySelector(".sidebar").classList.remove("open");
  document.getElementById("mobile-nav").setAttribute("aria-expanded", "false");
}

function bindViewEvents(name) {
  document.querySelectorAll(".segmented button, .chips .chip, .tabs .tab").forEach(button => button.addEventListener("click", () => {
    [...button.parentElement.children].forEach(el => el.classList.remove("active"));
    button.classList.add("active");
  }));
  document.querySelectorAll("[data-open-jobs]").forEach(button => button.addEventListener("click", () => setView("jobs")));
  document.querySelectorAll(".chart-range button").forEach(button => button.addEventListener("click", () => showToast(`${button.textContent} synthetic window selected`)));

  if (name === "jobs" || name === "health") {
    let filter = "all";
    const search = document.getElementById("job-search");
    const update = () => {
      const query = search.value.trim().toLowerCase();
      const subset = jobs.filter(j => (filter === "all" || j.status === filter) && j.name.toLowerCase().includes(query));
      document.getElementById("job-rows").innerHTML = jobRows(subset);
    };
    document.querySelectorAll("#job-filters .chip").forEach(button => button.addEventListener("click", () => { filter = button.dataset.filter; update(); }));
    search.addEventListener("input", update);
  }
  if (name === "matrix") {
    document.querySelectorAll(".matrix-cell").forEach(cell => cell.addEventListener("click", () => {
      const value = cell.dataset.move;
      const positive = value.startsWith("+");
      document.getElementById("matrix-detail").innerHTML = `<span class="label">Selected industry</span><div class="move ${positive ? "positive" : "negative"}">${value}</div><h2>${cell.dataset.name}</h2><p class="metric-note">Synthetic completed-session breadth. No delayed or live quotes are shown in this public demo.</p><dl><dt>Advancers</dt><dd>${8 + Number(cell.dataset.index)} / ${13 + Number(cell.dataset.index)}</dd><dt>Above 20-day average</dt><dd>${48 + Number(cell.dataset.index) * 2}%</dd><dt>Relative volume</dt><dd>${(0.91 + Number(cell.dataset.index) * .03).toFixed(2)}×</dd><dt>Coverage</dt><dd>100%</dd></dl>`;
    }));
  }
  if (name === "strategies") {
    const search = document.getElementById("strategy-search");
    search.addEventListener("input", () => document.querySelectorAll("[data-strategy]").forEach(card => card.hidden = !card.dataset.strategy.includes(search.value.trim().toLowerCase())));
  }
  document.getElementById("analyze-button")?.addEventListener("click", () => showToast("Synthetic analysis refreshed"));
  document.getElementById("agent-form")?.addEventListener("submit", event => { event.preventDefault(); showToast("Public demo is read-only; try the navigation instead"); });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

document.getElementById("primary-nav").addEventListener("click", event => {
  const item = event.target.closest("[data-view]");
  if (item) setView(item.dataset.view);
});

const searchIndex = [...document.querySelectorAll(".nav-item")].map(el => ({ label: el.querySelector("span:nth-of-type(2)").textContent, view: el.dataset.view }));
const globalSearch = document.getElementById("global-search");
const searchResults = document.getElementById("search-results");
globalSearch.addEventListener("input", () => {
  const query = globalSearch.value.trim().toLowerCase();
  const matches = query ? searchIndex.filter(x => x.label.toLowerCase().includes(query)).slice(0, 5) : [];
  searchResults.hidden = !matches.length;
  searchResults.innerHTML = matches.map(x => `<button class="search-result" data-view="${x.view}"><span>${x.label}</span><small>Open →</small></button>`).join("");
});
searchResults.addEventListener("click", event => { const result = event.target.closest("[data-view]"); if (result) { setView(result.dataset.view); globalSearch.value = ""; searchResults.hidden = true; } });
document.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); globalSearch.focus(); } if (event.key === "Escape") { searchResults.hidden = true; globalSearch.blur(); } });
document.getElementById("refresh-button").addEventListener("click", () => showToast("Demo snapshot refreshed · synthetic data unchanged"));
document.getElementById("mobile-nav").addEventListener("click", event => { const sidebar = document.querySelector(".sidebar"); sidebar.classList.toggle("open"); event.currentTarget.setAttribute("aria-expanded", String(sidebar.classList.contains("open"))); });

setView(location.hash.slice(1) || "dashboard", false);
