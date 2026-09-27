# EconNobel

A public poll: who will win the 2026 Nobel Prize in Economics?
Part of [Farhad Panahov's website](https://panahovf.github.io).

## What's here

- `site/` is the web page, published at [panahovf.github.io/econnobel](https://panahovf.github.io/econnobel/).
  - `index.html`: the page.
  - `candidates.js`: everyone you can find on the page. Made by the notebooks below; don't edit it by hand.
  - `og.png`: the preview picture shown when the link is shared.
- `worker/` is the vote counter: a small Cloudflare Worker with a D1 database (see "Votes" below).
- `.github/workflows/publish.yml` publishes the page every 4 hours with fresh Kalshi odds, and on every push.
- `data/` has the notebooks that build that list. Run them in order:
  1. `01_repec_rankings.ipynb`: economists from RePEc's two top-economist rankings (all years and the last
     10 years).
  2. `02_repec_profiles.ipynb`: each economist's homepage and affiliation, from their RePEc profile.
  3. `03_kalshi.ipynb`: each name's chance of winning on Kalshi's prediction market.
  4. `04_nobel_laureates.ipynb`: past winners, from the Nobel Prize's official data.
  5. `05_combine.ipynb`: puts them together and writes `site/candidates.js`.

## Publishing

GitHub publishes the page (Settings → Pages → Source: GitHub Actions) with the workflow in
`.github/workflows/publish.yml`. It runs at midnight, 4 am, 8 am, noon, 4 pm and 8 pm Toronto time, on every push to
`main`, and by hand from the Actions tab. Each run downloads fresh Kalshi odds (step 3), rebuilds the list (step 5)
and publishes `site/`. It commits nothing: the fresh list goes straight to the live page. Steps 1, 2 and 4 are run
by hand when needed.

## Votes

The page sends votes to a Cloudflare Worker (`worker/src/index.js`), which keeps them in a D1 database
(`worker/schema.sql`):

- For each browser that votes it stores a random ID the page made (kept on that device, not linked to a person),
  the pick, the name given (or "Anonymous") and the time. Changing your vote replaces it. No IP addresses, emails
  or cookies.
- Every vote passes Cloudflare Turnstile, an invisible check that a person, not a script, is voting. A network can
  send at most 20 votes a minute.
- Only people on the published list who can still win can be picked. Names are cut to 40 characters; links and a
  few offensive words turn a name into "Anonymous".
- Voting closes by itself on Monday 12 October 2026 at 5:45 a.m. ET.

To change the Worker: edit it, then `cd worker && npm install && npx wrangler deploy`. To try it on your own
computer: `npx wrangler dev`, with Turnstile's test secret in `worker/.dev.vars`
(`TURNSTILE_SECRET=1x0000000000000000000000000000000AA`).

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
