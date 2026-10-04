/* Drives every screen and every drill-down of the prototype under a DOM shim.
 *
 * The prototype has no build step and no test framework, so without this the
 * only check on it is opening a browser and clicking — which does not scale to
 * eleven screens with twenty-odd levels beneath them, and silently rots the
 * moment a renderer references a field the data export dropped.
 *
 *   node tests/render_check.js
 *
 * Prints FAIL lines and exits non-zero.
 */
const fs = require("fs");
const path = require("path");

const DOCS = path.join(__dirname, "..", "docs");
let failures = 0;
const fail = (msg) => {
  console.log(`FAIL  ${msg}`);
  failures++;
};

/* ----------------------------------------------------------- DOM shim */
const listeners = {};
function El(tag) {
  const self = {
    tagName: String(tag || "div").toUpperCase(),
    _html: "",
    dataset: {},
    hidden: false,
    disabled: false,
    style: {},
    attributes: {},
    children: [],
    value: "",
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, on) { if (on === undefined) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); } else if (on) { this._set.add(c); } else { this._set.delete(c); } },
      contains(c) { return this._set.has(c); },
    },
    set innerHTML(v) { self._html = String(v); },
    get innerHTML() { return self._html; },
    set textContent(v) { self._html = String(v); },
    get textContent() { return self._html; },
    setAttribute(k, v) { self.attributes[k] = String(v); },
    getAttribute(k) { return self.attributes[k]; },
    removeAttribute(k) { delete self.attributes[k]; },
    addEventListener() {},
    appendChild(c) { self.children.push(c); return c; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    focus() {},
    click() {},
    remove() {},
    scrollIntoView() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 800, height: 400 }; },
  };
  return self;
}

const ids = {};
["global-search", "search-results", "page-title", "page-eyebrow", "view-root", "toast",
 "mobile-nav", "tour-button", "job-search", "strategy-search", "agent-form", "agent-question",
 "job-rows", "palette", "search-trigger", "nav-now", "nav-changed"]
  .forEach((id) => (ids[id] = El("div")));

const navItems = [];
global.document = {
  readyState: "complete",
  body: El("body"),
  getElementById: (id) => ids[id] || null,
  querySelector: (sel) => {
    if (sel === ".sidebar") return El("aside");
    if (sel === ".tour-card") {
      const card = El("div");
      card.querySelector = () => El("button");
      return card;
    }
    return null;
  },
  querySelectorAll: (sel) => (sel === ".nav-item" ? navItems : []),
  addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  createElement: (tag) => {
    const node = El(tag);
    node.querySelector = () => {
      const b = El("button");
      b.querySelector = () => El("button");
      return b;
    };
    return node;
  },
};

global.location = { hash: "" };
global.window = {
  location: global.location,
  addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  scrollTo() {},
  navigate: null,
};
global.setTimeout = (fn) => { try { fn(); } catch (e) { /* spotlight timing only */ } return 0; };
global.clearTimeout = () => {};
global.requestAnimationFrame = (f) => f();

/* ------------------------------------------------------- load the app */
const load = (file) => {
  const code = fs.readFileSync(path.join(DOCS, file), "utf8");
  try {
    // eslint-disable-next-line no-new-func
    new Function("window", "document", "location", "setTimeout", "clearTimeout", code).call(
      global, global.window, global.document, global.location, global.setTimeout, global.clearTimeout
    );
  } catch (err) {
    fail(`${file} threw on load: ${err.message}`);
    process.exit(1);
  }
};

load("data.js");
if (!global.window.DEMO) {
  // data.js assigns to window.DEMO; mirror it for app.js, which reads window.DEMO.
  fail("data.js did not define window.DEMO");
  process.exit(1);
}
load("app.js");
load("tour.js");

const D = global.window.DEMO;
const CLASS_OK = ["positions", "integrity", "reporting"];
const render = () => {
  for (const fn of listeners.hashchange || []) fn();
};

/* ---------------------------------------------------- walk every path */
const paths = [];
const push = (p) => paths.push(p);

push("now");
push("changed");
push("dashboard");
push("verified");
D.verification.rows
  .filter((r) => r.horizon === 10)
  .forEach((r) => push(`verified/${r.event_type}`));
/* Two levels: one episode under every event type that has them. */
const seen = new Set();
D.verification.names.forEach((n) => {
  if (seen.has(n.event)) return;
  seen.add(n.event);
  push(`verified/${n.event}/${n.ticker}~${n.date}`);
});
push("books");
D.books.forEach((b) => {
  push(`books/${b.key}`);
  ["overview", "contract", "trades"].forEach((t) => push(`books/${b.key}/${t}`));
});
push("strategies");
["paper", "signal", "study", "system"].forEach((s) => push(`strategies?${s}`));
D.strategies.forEach((s) => push(`strategies/${s.key}`));
push("jobs");
["failing", "stale", "healthy", "retired"].forEach((s) => push(`jobs?${s}`));
D.jobs.forEach((j) => push(`jobs/${j.name}`));
["book", "changed", "risk", "outlook"].forEach((t) => push(`portfolio/${t}`));
["ALPH", "BRVO", "CDEL", "DRFT", "EVOK", "FLUX", "GRID", "HELM", "IRIS", "JOLT"].forEach((t) =>
  push(`portfolio/holding/${t}`)
);
push("analyzer");
["ALPH", "BRVO", "CDEL", "DRFT", "FLUX"].forEach((t) => {
  push(`analyzer/${t}`);
  ["valuation", "quality", "forecast", "thesis"].forEach((s) => push(`analyzer/${t}/${s}`));
});
push("matrix");
push("seasonality");
push("reports");
push("agent");

let rendered = 0;
for (const p of paths) {
  global.location.hash = `#${p}`;
  ids["view-root"]._html = "";
  try {
    render();
  } catch (err) {
    fail(`#${p} threw: ${err.message}`);
    continue;
  }
  const html = ids["view-root"].innerHTML;
  if (html.length < 200) fail(`#${p} rendered ${html.length} chars — effectively empty`);
  if (/undefined|\[object Object\]|NaN%|\$NaN/.test(html)) {
    const hit = html.match(/.{0,60}(undefined|\[object Object\]|NaN%|\$NaN).{0,40}/)[0];
    fail(`#${p} leaked a placeholder: …${hit.replace(/\s+/g, " ")}…`);
  }
  if (/\$\{/.test(html)) fail(`#${p} emitted an uninterpolated template literal`);
  rendered++;
}

/* --------------------------------------------------------- invariants */
/* Every analytical surface must state its conclusion above its evidence —
 * the same rule the production console is pinned to. */
const CONCLUDES = ["now", "changed", "verified", "books", "strategies", "jobs", "matrix", "seasonality", "reports"];
for (const p of CONCLUDES) {
  global.location.hash = `#${p}`;
  render();
  const html = ids["view-root"].innerHTML;
  const insight = html.indexOf('class="insight"');
  const table = html.indexOf("<table");
  if (insight === -1) fail(`#${p} has no conclusion line`);
  else if (table !== -1 && insight > table) fail(`#${p} puts its first table above its conclusion`);
}

/* Opposite claims must never be pooled into one headline. */
global.location.hash = "#verified";
render();
const vhtml = ids["view-root"].innerHTML;
["Reversal evidence strengthened", "Reversal evidence broke down"].forEach((label) => {
  if (!vhtml.includes(label)) fail(`#verified lost the "${label}" claim row`);
});
if (!vhtml.includes("cohort") && !vhtml.includes("Cohort")) fail("#verified dropped the cohort baseline caveat");

/* A book below the session floor must be named as withheld, not ranked. */
global.location.hash = "#books";
render();
const bhtml = ids["view-root"].innerHTML;
const early = D.books.filter((b) => !b.rankable).length;
if (early && !bhtml.includes("too early")) fail("#books does not mark any book as withheld from the ranking");
if (!bhtml.includes("Short")) fail("#books does not label its short books");

/* Every short book must declare a stop — the framework refuses otherwise, so
 * a short book in the data without one is a data or contract regression. */
D.books.filter((b) => b.allow_short).forEach((b) => {
  if (!b.stop_loss_pct) fail(`${b.key} is a short book with no declared stop`);
});

/* ---- the walk must not be able to shrink to nothing --------------------- */
/* The episode paths below are built *from the data*, so an export that drops
 * every episode simply tests fewer paths and still passes. That happened: one
 * mis-named key emptied the set and this file reported all clear. A harness
 * whose coverage is data-driven has to assert its own denominator. */
if (D.verification.names.length < 50)
  fail(`only ${D.verification.names.length} episodes exported — the drill-down is effectively untested`);
const eventsWithEpisodes = new Set(D.verification.names.map((n) => n.event));
["NEW_52W_LOW", "BREAKOUT_FAILED", "SMA20_RECLAIM", "REVERSAL_50"].forEach((ev) => {
  if (!eventsWithEpisodes.has(ev)) fail(`event type ${ev} exported no episodes to drill into`);
});
if (D.books.length < 10) fail(`only ${D.books.length} books exported`);
if (D.jobs.length < 50) fail(`only ${D.jobs.length} jobs exported`);
if (D.strategies.length < 50) fail(`only ${D.strategies.length} strategies exported`);

/* ---- the queue is a decision list, not a status list -------------------- */
/* A row that names a problem and offers nothing to do about it is the fault
 * this whole refinement exists to fix, so it is an invariant rather than a
 * convention. */
global.location.hash = "#now";
render();
const nowHtml = ids["view-root"].innerHTML;
const queue = D.queue || [];
if (queue.length) {
  queue.forEach((r) => {
    if (!r.action) fail(`queue row "${r.what}" carries no next action`);
    if (!r.where) fail(`queue row "${r.what}" says nothing about where it lives`);
    if (r.action && !["command", "route", "open"].includes(r.action.kind))
      fail(`queue row "${r.what}" invents a fourth action kind: ${r.action.kind}`);
    if (r.action && r.action.kind === "command" && !r.action.value)
      fail(`queue row "${r.what}" offers to copy a command it does not carry`);
    if (!CLASS_OK.includes(r.cls)) fail(`queue row "${r.what}" has no consequence class`);
  });
  const buttons = (nowHtml.match(/class="act-btn/g) || []).length;
  if (buttons < queue.length) fail(`${queue.length} queue rows rendered only ${buttons} actions`);
  /* Ranked by consequence, not by age. */
  const order = queue.map((r) => CLASS_OK.indexOf(r.cls));
  if (order.some((v, i) => i && v < order[i - 1])) fail("the queue is not ordered by consequence");
} else if (!/good-empty/.test(nowHtml)) {
  fail("an empty queue must say so explicitly, not render nothing");
}
/* A command that reaches the published page must be runnable by someone who is
 * not on this machine. */
queue.forEach((r) => {
  if (r.action && r.action.kind === "command" && /^\//.test(r.action.value))
    fail(`queue row "${r.what}" publishes an absolute path as its command`);
});

/* ---- the delta names its window and refuses the ones it cannot answer --- */
global.location.hash = "#changed";
render();
const chHtml = ids["view-root"].innerHTML;
const win = (D.changed || {}).window || {};
if (!win.from || !win.to) fail("the Changed view has no window to compare");
if (!chHtml.includes(win.from) || !chHtml.includes(win.to))
  fail("the Changed view does not name the window it is showing");
if (!((D.changed || {}).refused || []).length)
  fail("the Changed view refuses no window — at least the unanswerable one must be named");
((D.changed || {}).groups || []).forEach((g) => {
  if (!g.population) fail(`Changed group "${g.key}" states no population`);
  if (!g.rows.length && !chHtml.includes("good-empty"))
    fail(`Changed group "${g.key}" is empty and renders no explicit empty state`);
});

/* Exactly one screen builds the queue. The dashboard used to build its own from
 * a different rule, which is how one estate came to report 558 things needing
 * attention when three were incidents. */
const builders = [];
for (const p of ["now", "changed", "dashboard", "jobs", "books", "strategies"]) {
  global.location.hash = `#${p}`;
  render();
  if (ids["view-root"].innerHTML.includes('class="jobs-table queue"')) builders.push(p);
}
if (builders.length !== 1 || builders[0] !== "now")
  fail(`the queue is built on ${builders.length} screens (${builders.join(", ")}) — it must be exactly one`);

/* A job retired into a healthy successor must never be queued — seven ghosts
 * once filled this queue while their replacements ran fine every morning. */
const retiredNames = new Set(D.jobs.filter((j) => j.status === "retired").map((j) => j.name));
queue.forEach((r) => {
  const name = r.id && r.id.startsWith("job:") ? r.id.slice(4) : null;
  if (name && retiredNames.has(name)) fail(`retired job "${name}" is in the queue`);
});

/* Every tour step must land on a path this prototype can render. */
const tourSteps = fs.readFileSync(path.join(DOCS, "tour.js"), "utf8");
const stepPaths = [...tourSteps.matchAll(/path:\s*"([^"]+)"/g)].map((m) => m[1]);
if (stepPaths.length < 8) fail(`the walkthrough has only ${stepPaths.length} steps`);
for (const p of stepPaths) {
  global.location.hash = `#${p}`;
  ids["view-root"]._html = "";
  try {
    render();
  } catch (err) {
    fail(`walkthrough step #${p} threw: ${err.message}`);
    continue;
  }
  if (ids["view-root"].innerHTML.length < 200) fail(`walkthrough step #${p} renders empty`);
}
/* A step that highlights a selector the screen does not emit shows an empty
 * ring and reads as a broken tour. */
/* A step may legitimately spotlight page chrome (the palette trigger, the mode
 * switch) rather than something the view rendered, so the shell counts too. */
const shellHtml = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
/* `(?!path:)` keeps the match inside one step. Without it a step whose focus is
 * null ran on to the *next* step's selector and checked it against the wrong
 * screen — a false failure that looks exactly like a real one. */
const focusSel = [...tourSteps.matchAll(/path:\s*"([^"]+)",(?:(?!path:)[\s\S])*?focus:\s*["']([^"']+)["']/g)];
for (const [, p, sel] of focusSel) {
  global.location.hash = `#${p}`;
  render();
  const html = ids["view-root"].innerHTML + shellHtml;
  /* Checked exactly, per selector kind. An earlier version reduced every
   * selector to the text before its first "=", which turned `#anything` into
   * the string "id" — present in any HTML, so the check passed for a selector
   * nothing emitted. */
  let present;
  if (sel.startsWith("[")) present = html.includes(sel.slice(1, -1));
  else if (sel.startsWith("#")) present = html.includes(`id="${sel.slice(1)}"`);
  else if (sel.startsWith(".")) present = new RegExp(`class="[^"]*\\b${sel.slice(1)}\\b`).test(html);
  else present = html.includes(sel);
  if (!present)
    fail(`walkthrough step #${p} highlights "${sel}", which neither that screen nor the shell emits`);
}

/* Nothing private may reach a public artifact. */
const all = ["data.js", "app.js", "tour.js", "index.html"]
  .map((f) => fs.readFileSync(path.join(DOCS, f), "utf8"))
  .join("\n");
[
  [/\/Users\//, "an absolute local path"],
  [/sk-[A-Za-z0-9]{12,}/, "an API-key-shaped string"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, "an email address"],
  [/\bpassword\s*[:=]\s*["'][^"']+/i, "a password literal"],
  [/\b(?:alpaca|polygon|deepseek|tradier)[-_]?(?:key|token|secret)/i, "a vendor credential name"],
].forEach(([re, what]) => {
  if (re.test(all)) fail(`the published prototype contains ${what}`);
});

console.log(`\n${rendered} of ${paths.length} paths rendered · ${stepPaths.length} walkthrough steps`);
console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
