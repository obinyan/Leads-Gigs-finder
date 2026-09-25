# Gig Finder — lead ledger

A small dashboard that finds freelance gig leads, scores them against your
profile with Gemini, and drafts a tailored proposal for the good ones — so
applying is a 2-minute review-and-copy instead of an hour of searching.

**It does not auto-submit anything.** You review every draft and click submit
yourself, on the platform itself. Most gig platforms' terms explicitly ban
bots that submit on your behalf and actively detect them — see "Why not fully
automatic" below.

## Two ways to run it

- **Locally** (`npm start`) — good for testing, or for keeping it running on
  your own always-on machine with `pm2`.
- **Deployed on Vercel** — the version this README focuses on, since it runs
  independently of your laptop.

The same code runs both ways: `app.js` holds the actual Express app and
routes; `local-server.js` is a thin wrapper that adds `.listen()` and a local
cron for running it yourself; `api/index.js` is a thin wrapper for Vercel's
serverless runtime. You never have two versions of the logic to maintain.

## Deploying to Vercel (with GitHub)

### 1. Push this project to a GitHub repo

```bash
cd gig-finder
git init
git add .
git commit -m "Initial commit"
# create a repo on GitHub, then:
git remote add origin <your-repo-url>
git push -u origin main
```

`.gitignore` already excludes `node_modules`, `.env`, and your local
`data/leads.json` — your API keys never get committed.

### 2. Import the repo on Vercel

Go to [vercel.com/new](https://vercel.com/new), import the repo, and use the
"Other" framework preset (no build step needed — it's plain Node functions
plus static files).

### 3. Add a Redis database (required — see "Storage" below)

Vercel's own KV product was discontinued; the current path is the Marketplace
instead. In your new Vercel project: **Storage tab → Marketplace Database
Providers → Upstash → Redis** (free tier is enough for this), then connect it
to the project. Vercel then automatically injects `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` into your deployment — you don't set these by hand.

### 4. Add your other environment variables

In **Project Settings → Environment Variables**, add:

- `GEMINI_API_KEY`
- `GEMINI_SCORE_MODEL` (optional)
- `GEMINI_DRAFT_MODEL` (optional)
- `FREELANCER_OAUTH_TOKEN`
- `GOOGLE_API_KEY`
- `GOOGLE_CSE_ID`

Then deploy (Vercel does this automatically on push, or click **Deploy**).

### 5. Set up frequent polling via GitHub Actions

Vercel's own free-tier cron only fires once a day, which isn't enough for
real volume. `.github/workflows/poll.yml` is already in this repo — it runs
on GitHub's own scheduler instead and just calls your deployed `/api/poll`.

One-time setup: in your GitHub repo, go to **Settings → Secrets and
variables → Actions → New repository secret**, name it `GIG_FINDER_URL`, and
set it to your deployed URL (e.g. `https://gig-finder-yourname.vercel.app`,
no trailing slash). That's it — it'll poll every 30 minutes on its own. Adjust
the cron expression in the workflow file if you want a different cadence
(GitHub won't accept anything more frequent than every 5 minutes).

Vercel's own daily cron (in `vercel.json`) stays as a harmless backup in case
the GitHub Actions workflow ever gets disabled (see the note in that workflow
file about GitHub's 60-day inactivity auto-disable).

### 6. Edit your profile

Edit `config.js` with your real bio, skills, minimum rate, dealbreakers, and
a couple of real portfolio snippets before your first deploy — the more
specific these are, the less generic your drafted proposals read. Commit and
push to update the live deployment.

## Hitting real volume (~100 leads/day)

Two honest limits to know about before assuming the number is a config
setting:

- **Google Custom Search's free tier is 100 *queries*/day, not 100 results.**
  Each query returns up to 10 results, and `config.js` currently sends 3
  queries per poll. Add more query variations to `searchConfig.googleQueries`
  to use more of that quota, or enable billing on the Custom Search API
  ($5/1,000 queries beyond the free 100/day) if you want to poll harder.
- **Freelancer.com's volume is capped by how many real listings exist** for
  your keywords — no setting fixes that; widen `searchConfig.freelancerQuery`
  if you want a broader net.

Run it for a few days first and look at actual counts before assuming you
need to raise any limits.

## Storage

Leads are stored in Upstash Redis (via the Vercel Marketplace) in production
— a deployed function's own filesystem is read-only and doesn't persist
between calls, so a JSON file won't work there. Locally, with no Redis
configured, `lib/store.js` automatically falls back to the `data/leads.json`
file — no setup needed for local testing.

## Why not fully automatic

| Platform | What this tool does |
|---|---|
| **Freelancer.com** | Polls the official API for leads. You still submit the bid yourself. Access tokens are refreshed automatically once you've done the one-time OAuth login (see below) — the app persists the refreshed token to storage so it survives across requests. |
| **Google Search** | Polls the official Custom Search API to catch gig posts on forums/blogs/boards. |
| **Facebook, Threads** | No public API for searching posts by keyword, and their terms ban automated scraping or bot logins — accounts that try get banned. Not polled. Use **+ Add a lead** in the dashboard to forward anything you spot yourself; it still gets scored and drafted. |
| **X / Twitter** | Has an official API, but the tier with meaningful search access is a paid plan. Not included by default — copy the pattern in `lib/googleSearch.js` if you're on a paid API tier. |

Even where auto-*finding* is fine, auto-*submitting* proposals tends to
backfire: platforms filter out generic bot-submitted proposals, and a flagged
account costs you more than the time you saved. Keep a human in the loop at
the submit step.

## A note on the URL being public

A Vercel deployment gets a real, reachable URL with no login screen by
default. It's obscure but not private. For a personal tool this is usually
fine, but if you want a basic lock on it, Vercel's Pro plan includes a
built-in password-protection toggle for deployments — or add simple HTTP
basic-auth middleware to `app.js` yourself.

## Extending it

- **More sources**: copy the shape of `lib/freelancer.js` or
  `lib/googleSearch.js` for any other job board with an API (e.g. RemoteOK,
  WeWorkRemotely both have simple public feeds). Add the new fetch function
  to `pollAllSources()` in `lib/pipeline.js`.
- **Different scoring bar**: adjust `AUTO_DRAFT_THRESHOLD` in
  `lib/pipeline.js`.

## Running it locally instead

```bash
npm install
cp .env.example .env   # fill in your keys; leave KV_ vars blank
# edit config.js with your profile
npm start
```

Open http://localhost:3000. For keeping this running 24/7 on your own machine
instead of deploying, use `pm2`:

```bash
npm install -g pm2
pm2 start local-server.js --name gig-finder
pm2 startup   # follow its printed instructions
pm2 save
```
