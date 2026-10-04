/* Guided walkthrough.
 *
 * A prototype you can click is not the same as a prototype you can present.
 * This drives the demo through one narrated path — each step navigates to a
 * real screen and highlights the thing being talked about — so a walkthrough
 * is reproducible rather than remembered. Every step is a real URL, so a
 * viewer can stop the tour at any point and keep exploring from there.
 */
(function () {
  const STEPS = [
    {
      path: "now",
      title: "A row is a decision, not a status",
      body: "The console opens on what needs deciding, <strong>ranked by consequence rather than by age</strong>. Every row says where it lives and what to do next — do it here where a route exists, copy the exact command where one does not, or open the evidence where the next step is judgement. Nothing offers a button this console cannot honour.",
      focus: '[data-tour="queue"]',
    },
    {
      path: "now",
      title: "The queue is only useful if it is short",
      body: "This one had <strong>thirty rows</strong> on its first build, then nine. Judging each job against a global threshold flagged every weekly and monthly job as late; judging against each job’s <em>own</em> rhythm cut it to nine. Seven of those nine were renamed jobs whose successors ran fine every morning — ghosts the ledger cannot distinguish from stopped work. Two rows left.",
      focus: ".caveat",
    },
    {
      path: "changed",
      title: "The daily question a status board cannot answer",
      body: "What moved since the last completed session. The window is a <strong>market session, not your last visit</strong>, so the page is reproducible and two people see the same thing. Nearly every store here is already keyed by date, so this was a read — no new table, no backfill.",
      focus: ".insight",
    },
    {
      path: "changed",
      title: "No materiality threshold, ever",
      body: "No measured constant makes 5% of drift actionable and 4% not, so rows are ranked by size and each group states the population it came from. And a window nobody can answer is <strong>refused in words</strong> — an empty table reads as a quiet day, which is the opposite of the truth.",
      focus: null,
    },
    {
      path: "verified",
      title: "Grading the system's own published signals",
      body: "Every alert is a claim about what happens next. This grades each one at 5, 10 and 20 completed sessions. <strong>Correct means beat the benchmark</strong>, with the raw positive rate beside it and never merged — a beaten-down stock that rose 2% in a week the index rose 3% did not reverse anything.",
      focus: '[data-tour="claims"]',
    },
    {
      path: "verified",
      title: "The caveat that stops the good number being oversold",
      body: "The beaten-down cohort those warnings were drawn from was <em>already</em> underperforming. So part of the bearish hit rate is the population, not signal skill. It is published beside the result and deliberately not subtracted — no measured constant says what to deflate it by.",
      focus: ".cohort-panel",
    },
    {
      path: "verified",
      title: "One level down: every event type, sorted by verdict",
      body: "Most promising verdict first. Inside <em>too few to judge</em>, sample size leads rather than the unjudgeable rate — otherwise a 100% hit rate on two observations sits above a sixteen-observation row at 75%. Select any row.",
      focus: '[data-tour="events"]',
    },
    {
      path: "verified/NEW_52W_LOW",
      title: "Two levels down: which stocks produced the rate",
      body: "A hit rate is an average, and an average over fifty episodes can be one name carrying it or fifty behaving alike. <strong>Where it failed gets equal billing</strong>, because the worst miss is the strategy's real risk — here the shorts work on defensives and industrials and fail on high-beta technology.",
      focus: ".two-up",
    },
    {
      path: "books",
      title: "From a finding to a measurable book",
      body: "Each strategy gets its own $25,000 account on <strong>one execution model</strong>, so results are comparable. The framework's real contribution is that it forces the exit rule — it refuses to construct a book without one.",
      focus: '[data-tour="replayed"]',
    },
    {
      path: "books",
      title: "The leaderboard refuses to rank most of itself",
      body: "Two of fourteen books have cleared the 63-session floor. Sharpe once read <strong>7.11 on a thirteen-session book</strong> — annualising a fortnight's standard deviation returns a large, stable-looking number that measures the fortnight. Short books are shown and withheld, never quietly ranked.",
      focus: ".metric-grid",
    },
    {
      path: "books/new_52w_low_short/contract",
      title: "A short book must declare a stop",
      body: "Refused at construction otherwise. A long position cannot lose more than it cost; without a stop a short has no worst case, and its drawdown column would state what happened to be true rather than its risk. This is also where a dead config field was found: a book asking to sell short would silently have run long.",
      focus: ".two-up",
    },
    {
      path: "jobs",
      title: "Silence is not health",
      body: "A past success <strong>expires</strong>. The dominant failure mode is not a red row nobody fixed — it is a green one: a job that last recorded success ninety-six days ago. One square per job, grouped by owner, because the concentration is the finding.",
      focus: '[data-tour="heatmap"]',
    },
    {
      path: "strategies",
      title: "A strategy is a lifecycle, not a script",
      body: "Grouped by <strong>stage</strong> rather than family, because consequence is the axis that matters at this size — family files a paper bot that takes positions beside a study that renders a page. Promotion is an explicit decision with evidence attached.",
      focus: ".stage-block",
    },
    {
      path: "portfolio/risk",
      title: "Two numbers that look like one",
      body: "Effective positions <em>by weight</em> counts how evenly the money is spread and knows nothing about what moves together — twenty holdings in one industry score twenty. Effective positions <em>after correlation</em> is a different quantity. Both are published, labelled apart, never one as the other.",
      focus: ".metric-grid",
    },
    {
      path: "agent",
      title: "The agent can read the evidence and nothing else",
      body: "It cannot place an order, change a schedule or edit a strategy. A hosted web answer is accepted only when the provider returns a structured search call <em>and</em> result — model-written links cannot authorize their own claims.",
      focus: ".agent-side",
    },
    {
      path: "now",
      title: "⌘K is how you actually navigate",
      body: "The rail deliberately did not shrink — this console has been bitten before by burying a surface in a sub-tab. Instead the palette got good enough that the rail is not how you get around: every screen, sub-view, strategy, book, job, signal type, holding and industry, grouped by kind, with arrow keys. Press <strong>⌘K</strong> or <strong>/</strong>.",
      focus: "#search-trigger",
    },
    {
      path: "now",
      title: "That is the loop",
      body: "Idea → point-in-time backtest → evidence gate → a measurable forward book → a verdict that can overturn it. The through-line is that <strong>every screen states its conclusion above its evidence</strong>, and every refusal says why. Explore from here — each screen has at least one level beneath it.",
      focus: null,
    },
  ];

  let index = -1;
  let active = false;

  const el = {};

  function build() {
    const overlay = document.createElement("div");
    overlay.className = "tour";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="tour-spot" aria-hidden="true"></div>
      <div class="tour-card" role="dialog" aria-modal="false" aria-labelledby="tour-title">
        <div class="tour-head">
          <span class="tour-count"></span>
          <button class="tour-close" aria-label="End walkthrough">✕</button>
        </div>
        <h2 id="tour-title"></h2>
        <p class="tour-body"></p>
        <div class="tour-foot">
          <button class="ghost-button tour-prev">← Back</button>
          <div class="tour-dots" aria-hidden="true"></div>
          <button class="primary-button tour-next">Next →</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    el.overlay = overlay;
    el.spot = overlay.querySelector(".tour-spot");
    el.card = overlay.querySelector(".tour-card");
    el.title = overlay.querySelector("#tour-title");
    el.body = overlay.querySelector(".tour-body");
    el.count = overlay.querySelector(".tour-count");
    el.dots = overlay.querySelector(".tour-dots");
    overlay.querySelector(".tour-close").addEventListener("click", stop);
    overlay.querySelector(".tour-prev").addEventListener("click", () => step(index - 1));
    overlay.querySelector(".tour-next").addEventListener("click", () => step(index + 1));
    el.dots.addEventListener("click", (event) => {
      const dot = event.target.closest("[data-step]");
      if (dot) step(Number(dot.dataset.step));
    });
  }

  function step(i) {
    if (i < 0) return;
    if (i >= STEPS.length) return stop();
    index = i;
    active = true;
    const s = STEPS[i];
    el.overlay.hidden = false;
    document.body.classList.add("tour-on");
    el.title.innerHTML = s.title;
    el.body.innerHTML = s.body;
    el.count.textContent = `Step ${i + 1} of ${STEPS.length}`;
    el.dots.innerHTML = STEPS.map(
      (_, k) => `<button data-step="${k}" class="${k === index ? "on" : k < index ? "done" : ""}" tabindex="-1"></button>`
    ).join("");
    el.card.querySelector(".tour-prev").disabled = i === 0;
    el.card.querySelector(".tour-next").textContent = i === STEPS.length - 1 ? "Finish" : "Next →";
    /* Navigating re-renders the view, and onRender places the spotlight — so a
     * step that stays on the same screen still gets its highlight moved. */
    if (location.hash.slice(1) !== s.path) window.navigate(s.path);
    else place(s);
  }

  function place(s) {
    if (!active) return;
    if (!s.focus) {
      el.spot.style.opacity = "0";
      return;
    }
    const node = document.querySelector(s.focus);
    if (!node) {
      el.spot.style.opacity = "0";
      return;
    }
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    /* Measured after the scroll settles, or the ring lands where the element
     * used to be. */
    setTimeout(() => {
      if (!active) return;
      const r = node.getBoundingClientRect();
      el.spot.style.opacity = "1";
      el.spot.style.top = `${r.top - 8}px`;
      el.spot.style.left = `${r.left - 8}px`;
      el.spot.style.width = `${r.width + 16}px`;
      el.spot.style.height = `${r.height + 16}px`;
    }, 320);
  }

  function stop() {
    active = false;
    index = -1;
    el.overlay.hidden = true;
    document.body.classList.remove("tour-on");
  }

  window.TOUR = {
    start() {
      if (!el.overlay) build();
      step(0);
    },
    onRender() {
      if (active && STEPS[index]) place(STEPS[index]);
    },
    get active() {
      return active;
    },
  };

  document.addEventListener("keydown", (event) => {
    if (!active) return;
    if (event.key === "Escape") stop();
    if (event.key === "ArrowRight") step(index + 1);
    if (event.key === "ArrowLeft") step(index - 1);
  });
  window.addEventListener("resize", () => {
    if (active && STEPS[index]) place(STEPS[index]);
  });

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("tour-button")?.addEventListener("click", () => window.TOUR.start());
  });
  /* The script loads after the markup, so DOMContentLoaded may already have
   * fired — bind directly in that case rather than waiting for an event that
   * will never come again. */
  if (document.readyState !== "loading") {
    document.getElementById("tour-button")?.addEventListener("click", () => window.TOUR.start());
  }
})();
