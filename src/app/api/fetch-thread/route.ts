import { NextResponse } from "next/server";
import { sampleThread } from "@/lib/sampleThread";
import type { Tweet } from "@/lib/types";
import type { CheerioAPI } from "cheerio";

type RapidTweetLike = Record<string, unknown>;

function parseTweetUrl(
  url: string,
): { username: string; tweetId: string } | null {
  const match = url.match(
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/,
  );
  if (match) return { username: match[1], tweetId: match[2] };
  return null;
}

async function fetchFromRapidAPI(tweetId: string): Promise<Tweet[] | null> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey || apiKey === "your_key_here") return null;

  try {
    const host = process.env.RAPIDAPI_HOST || "twitter-api45.p.rapidapi.com";
    // Default for twitter-api45. Override via env if your subscribed API differs.
    const pathTemplate =
      process.env.RAPIDAPI_REPLIES_PATH || "/replies.php?tweet_id={tweetId}";
    const url = `https://${host}${pathTemplate.replace("{tweetId}", encodeURIComponent(tweetId))}`;

    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": host,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();

    // Try common shapes across RapidAPI scrapers
    const candidates =
      (Array.isArray(data?.results) ? data.results : null) ||
      (Array.isArray(data?.replies) ? data.replies : null) ||
      (Array.isArray(data?.timeline) ? data.timeline : null) ||
      (Array.isArray(data?.data) ? data.data : null) ||
      (Array.isArray(data) ? data : null);

    if (!candidates) return null;

    const tweets = (candidates as RapidTweetLike[])
      .map((t: RapidTweetLike, idx: number) => {
        const id =
          (t.tweet_id as string | number | undefined) ||
          (t.id as string | number | undefined) ||
          (t.rest_id as string | number | undefined) ||
          (t.tweetId as string | number | undefined) ||
          `tweet-${idx}`;
        const text =
          (t.text as string | undefined) ||
          (t.full_text as string | undefined) ||
          (t.fullText as string | undefined) ||
          (t.content as string | undefined) ||
          "";
        return {
          id: String(id),
          text: String(text),
          position: idx + 1,
        } satisfies Tweet;
      })
      .filter((t: Tweet) => t.text.trim().length > 0)
      .slice(0, 30);

    return tweets.length > 0 ? tweets : null;
  } catch {
    return null;
  }
}

async function fetchFromNitter(
  username: string,
  tweetId: string,
): Promise<Tweet[] | null> {
  try {
    const response = await fetch(
      `https://nitter.net/${username}/status/${tweetId}`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      },
    );
    if (!response.ok) return null;

    const html = await response.text();
    const cheerio = await import("cheerio");
    const $: CheerioAPI = cheerio.load(html);

    const tweets: Tweet[] = [];
    $(".timeline-item .tweet-content").each((idx, el) => {
      const text = $(el).text().trim();
      if (text) {
        tweets.push({ id: `nitter-${idx}`, text, position: idx + 1 });
      }
    });

    return tweets.length > 0 ? tweets.slice(0, 30) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body: { url: string } = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (url === "sample" || url === "demo") {
      return NextResponse.json(sampleThread);
    }

    const parsed = parseTweetUrl(url);
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "Invalid Twitter/X URL. Please paste a valid tweet URL or switch to Paste Text mode.",
        },
        { status: 400 },
      );
    }

    const { username, tweetId } = parsed;

    // Strategy 1: RapidAPI (configurable host/path)
    let tweets = await fetchFromRapidAPI(tweetId);

    // Strategy 2: Nitter fallback (public threads only)
    if (!tweets) {
      tweets = await fetchFromNitter(username, tweetId);
    }

    if (tweets) {
      return NextResponse.json({
        tweets,
        author: `@${username}`,
        title: tweets[0]?.text?.substring(0, 80) + "..." || "Thread",
      });
    }

    // Strategy 3: Demo fallback (always works)
    return NextResponse.json({
      ...sampleThread,
      _fallback: true,
      _message:
        "Could not fetch this thread (private/protected account, rate limit, or provider issue). Showing sample thread instead. You can also use Paste Text mode for private threads.",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch thread. Try switching to Paste Text mode." },
      { status: 500 },
    );
  }
}
