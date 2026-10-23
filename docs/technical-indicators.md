# Optional technical studies on every company page

## Problem

The company page already explained valuation, quality, forecasts and options
volatility, but inspecting trend or entry risk required leaving the workflow.
Adding every indicator in a catalog would create a second problem: dozens of
correlated oscillators can make the same price move look like independent
evidence.

## Product decision

Each company now has a separate **Technicals** tab built from locally stored,
daily OHLCV. The default view stays deliberately small:

- 50-day and 200-day moving averages for intermediate and long-term regime.
- Daily volume with its 20-day average for participation.
- Current readings for RSI, MACD histogram, ATR%, ADX and relative volume.

The user can add SMA 20, EMA 8/21 or Bollinger Bands to price, and can choose
one lower study at a time: Volume, RSI, MACD, ATR%, ADX/DMI or comparative
relative strength against SPY. The selected studies change the chart only;
they do not change valuation, quality scores or recommendations.

This is a curated subset of the
[Barchart technical-indicator catalog](https://www.barchart.com/education/technical-indicators).
The selection covers five distinct questions: trend, momentum, volatility,
participation and market leadership.

## Guardrails

- Raw OHLC is placed on the adjusted-close basis before ATR or ADX is
  calculated, so a stock split cannot appear as a volatility event. Volume
  stays on the provider's stored share basis; a dividend adjustment is not
  allowed to rescale traded shares.
- RSI, ATR and ADX use Wilder smoothing. MACD uses the standard exponential
  12/26/9 convention; Bollinger Bands use a 20-session average and two standard
  deviations.
- Relative strength aligns each stock session to the same SPY session and
  rebases the visible window to 100.
- Missing or thin daily history produces an explicit unavailable state while
  the independent earnings-and-price chart remains usable.
- The source and last stored session appear on the chart. A ticker that is more
  than seven calendar days behind SPY is marked stale.
- Only one lower pane is visible at a time. This reduces chart clutter and
  discourages treating several transforms of the same price series as separate
  confirmation.

## Outcome

Trend, entry context and risk now sit beside the company's fundamental record
without being blended into it. The default answers the two most useful first
questions — *what is the regime?* and *does the move have participation?* —
while the optional studies support deeper inspection without turning the page
into an indicator dashboard.
