# From screen inventory to an executable trade slate

## Problem

The research platform could surface dozens of technically or fundamentally
interesting stocks, but it left the operator to reconcile contradictory
signals, earnings timing, liquidity, execution assumptions, and strategy track
records. A ranked screen is not a trade and a historical hit rate is not an
execution edge.

## Product decision

The Trade Slate publishes at most five short-to-medium-term paper trades. It
starts from signal types whose benchmark-relative intervals still clear chance,
then applies the operating constraints that a screen omits:

- only the first emission of a signal episode can open a trade;
- an active signal in the opposite direction vetoes the candidate;
- earnings inside the holding window and stale earnings data veto it;
- $5 price and $25 million average-dollar-volume floors remove thin names;
- value, fundamentals, momentum, reversal, seasonality, and earnings evidence
  corroborate the setup without being collapsed into a fake probability;
- market news is a portfolio gate because ticker-level news tagging is not yet
  trustworthy.

Every recommendation declares its next-open entry, 5% paper allocation,
protective stop, time exit, modeled slippage, and SPY comparison. Empty slots
stay cash rather than being filled with lower-quality ideas.

## Guardrails

Live brokerage execution is absent. The paper ledger is immutable and requires
63 decision sessions, 100 closed trades, positive mean net return and excess,
and profit factor of at least 1.2 before it can become *review eligible*. That
state permits a design review; it cannot enable orders. A future Tradier path
also requires borrow checks for shorts, account-level exposure limits,
idempotent reconciliation, and a separate production switch.

## Outcome

The operator now gets a decision-ready list plus explicit refusals. The first
run demonstrated why that matters: three otherwise eligible technical setups
were withheld because earnings fell inside their intended holding windows, and
one was withheld because active long and short evidence conflicted. The page
makes those cash decisions as visible as the trades.

All names and values in the public prototype are synthetic or rounded. No live
position, account value, current recommendation, credential, or order control
is published.
