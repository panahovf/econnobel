# EconNobel

A public poll: who will win the 2026 Nobel Prize in Economics?
Part of [Farhad Panahov's website](https://panahovf.github.io).

## What's here

- `site/` is the web page.
  - `index.html`: the page.
  - `candidates.js`: everyone you can find on the page. Made by the notebooks below; don't edit it by hand.
- `data/` has the notebooks that build that list. Run them in order:
  1. `01_repec_rankings.ipynb`: economists from RePEc's two top-economist rankings (all years and the last
     10 years).
  2. `02_repec_profiles.ipynb`: each economist's homepage and affiliation, from their RePEc profile.
  3. `03_kalshi.ipynb`: each name's chance of winning on Kalshi's prediction market.
  4. `04_nobel_laureates.ipynb`: past winners, from the Nobel Prize's official data.
  5. `05_combine.ipynb`: puts them together and writes `site/candidates.js`.

Votes on the page are placeholders until the vote counter is connected.

## Running the notebooks

You need Python 3 and a few packages:

    pip install pandas requests beautifulsoup4 jupyter

Then open the notebooks in Jupyter (or VS Code) and run them in order. Step 2 takes about 15 minutes, because it
opens about 5,600 RePEc profiles, one at a time. If it stops part-way, run it again: it carries on where it
stopped. The other steps take seconds.

## Sources

- [RePEc/IDEAS](https://ideas.repec.org/top/): rankings of economists and their profiles.
- [Kalshi](https://kalshi.com): prediction-market prices for the 2026 prize.
- [Nobel Prize](https://api.nobelprize.org): the list of past laureates.

EconNobel is an independent poll, not affiliated with the Nobel Foundation.
