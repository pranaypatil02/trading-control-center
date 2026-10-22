# Options volatility on every company page

## Problem

The platform stored an options-volatility history for earnings research, but
the company page did not expose it. Worse, the field called “IV Rank” was
calculated as the percentage of prior observations below today — the definition
of IV Percentile. The current observation also came from the nearest expiry,
which changes maturity from one day to the next and is not comparable with the
constant-30-day indicator the product intended to provide.

## Product decision

Each company page now shows one constant-maturity reading and keeps its two
historical comparisons separate:

- **30-day ATM IV:** the average ATM call/put IV for the monthly expiries around
  30 calendar days, linearly weighted to 30 days.
- **IV Rank:** `(current − one-year low) / (one-year high − one-year low)`.
- **IV Percentile:** the share of prior sessions whose IV was below today’s.

Analyze refreshes the metric for whichever stock is open and stores one daily
observation. This gives every tracked company the same surface without running
thousands of fragile option-chain requests each night.

## Guardrails

- A new source version starts a new history series; nearest-expiry observations
  are not mixed with the 30-day method.
- Rank and percentile remain visibly provisional and cannot influence an
  options ticket until roughly one market year has accrued.
- Weekend and exchange-holiday runs map to the last completed market session.
- Both the ATM call and put must be usable at every expiry in the bracket.
- The page names the expiries and data-source limitation. The maturity method
  follows Barchart’s published definition, while contract IV comes from another
  source and may differ from Barchart’s binomial calculation.
- IV is presented as expected move magnitude and premium context, never as a
  directional forecast or standalone buy/sell signal.

## Outcome

The user can now compare option-premium regimes on the same page as valuation,
quality, earnings, and technical evidence. Missing history produces a specific
coverage state instead of a confident but invalid one-year statistic.
