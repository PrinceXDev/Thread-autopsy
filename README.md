# Thread Autopsy 🔬

Analyze Twitter/X threads to measure real information density vs filler, repetition, unverified claims, and structural slop patterns — **no external AI APIs**, pure algorithmic analysis.

## What it does

Paste a thread URL or raw text and get a full breakdown:

- **Information Density** — ratio of concrete tokens vs filler/buzzwords
- **Repetition Detection** — TF-IDF cosine similarity across all tweet pairs with a heatmap
- **Claim Extraction** — flags unverified claims ("studies show", "most people", etc.)
- **Slop Score** — composite score combining density, repetition, and pattern abuse
- **Compression** — strips filler and shows you what the thread actually says
- **History** — past analyses saved to `localStorage`, accessible from any session

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Try with sample thread** to demo without an API key.

## Environment variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `RAPIDAPI_KEY` | Optional | Enables live thread fetching via RapidAPI |
| `RAPIDAPI_HOST` | Optional | Override scraper host (default: `twitter-api45.p.rapidapi.com`) |
| `RAPIDAPI_REPLIES_PATH` | Optional | Override replies path (default: `/replies.php?tweet_id={tweetId}`) |

If no API key is set, the app falls back to: **RapidAPI → Nitter (cheerio scrape) → built-in sample thread**.

Paste Text mode never needs an API key.

## Input modes

| Mode | How it works |
|---|---|
| **URL** | Paste a `https://x.com/...` or `https://twitter.com/...` thread URL |
| **Paste Text** | Copy the thread text directly — supports numbered format (`1/ 2/ 3/`) or blank-line-separated paragraphs |

## Project structure

```
src/
├── app/
│   ├── page.tsx                  # Home — URL / paste input
│   ├── results/page.tsx          # Analysis results (5 tabs)
│   ├── history/page.tsx          # Past analyses
│   ├── layout.tsx
│   └── api/
│       ├── analyze/route.ts      # POST /api/analyze
│       └── fetch-thread/route.ts # POST /api/fetch-thread
├── components/
│   ├── SimilarityHeatmap.tsx     # Recharts heatmap of tweet similarity
│   ├── TweetSidebar.tsx          # Per-tweet breakdown panel
│   ├── ClaimMatchReport.tsx      # Matched claims with confidence scores
│   └── ClaimMethodologyPanel.tsx # How claim detection works
└── lib/
    ├── analyzers.ts              # Core analysis engine
    ├── claimMatcher.ts           # TF-IDF claim matching against known claims
    ├── threadParser.ts           # Parses raw thread text into tweets
    ├── history.ts                # localStorage read/write helpers
    ├── types.ts                  # Shared TypeScript types
    ├── knownClaims.ts            # Reference claim database
    └── sampleThread.ts           # Built-in demo thread
```

## API routes

| Route | Method | Body | Description |
|---|---|---|---|
| `/api/fetch-thread` | POST | `{ "url": "https://x.com/..." }` or `"sample"` | Fetches thread tweets |
| `/api/analyze` | POST | `{ tweets, author, title }` | Runs full analysis pipeline |

## Stack

| Layer | Library |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS |
| NLP | `natural` (TF-IDF, tokenization), `compromise` (claim extraction) |
| Scraping | `cheerio` (Nitter fallback) |
| Charts | Recharts (similarity heatmap) |
| Animation | Framer Motion |
| Export | html2canvas (share as image) |

## Deploy to Vercel

1. Push to GitHub
2. Import the repo at [vercel.com](https://vercel.com)
3. Add environment variables in **Project → Settings → Environment Variables**:
   - `RAPIDAPI_KEY` — your RapidAPI key
4. Deploy

> **Note:** Make sure your `.npmrc` in the project root contains `registry=https://registry.npmjs.org/` so Vercel installs from the public npm registry.

## Local notes

- Analysis results are passed between pages via `sessionStorage` — refreshing the results page will lose the data, navigate back to re-analyze.
- History is stored in `localStorage` — it's browser-local and not synced across devices.
- All analysis runs server-side in the `/api/analyze` route; no data is sent to third-party AI services.
