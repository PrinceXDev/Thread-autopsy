# Thread Autopsy 🔬

Analyze Twitter/X threads to measure real information density vs filler, repetition, unverified claims, and structural slop patterns — **no external AI APIs**, pure algorithmic analysis.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Try with sample thread** to demo without an API key.

## Environment

Copy `.env.local.example` to `.env.local` and add your RapidAPI key for live thread fetching:

```
RAPIDAPI_KEY=your_key_here
```

Fetch priority: RapidAPI → Nitter (cheerio) → built-in sample thread.

If your RapidAPI scraper host isn’t `twitter-api45`, you can override:

```
RAPIDAPI_HOST=your-host.p.rapidapi.com
RAPIDAPI_REPLIES_PATH=/path?tweet_id={tweetId}&count=30
```

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- `natural` (TF-IDF), `compromise` (NLP), `cheerio` (scrape fallback)
- Recharts (similarity heatmap), Framer Motion, html2canvas (share image)

## API

| Route               | Method | Body                                           |
| ------------------- | ------ | ---------------------------------------------- |
| `/api/fetch-thread` | POST   | `{ "url": "https://x.com/..." }` or `"sample"` |
| `/api/analyze`      | POST   | `{ tweets, author, title }`                    |

## Deploy

Ready for [Vercel](https://vercel.com). Set `RAPIDAPI_KEY` in project environment variables.
