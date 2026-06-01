import { NextResponse } from "next/server";
import { sampleThread } from "@/lib/sampleThread";
import type { Tweet } from "@/lib/types";

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

async function fetchFromFxTwitter(
  username: string,
  tweetId: string,
): Promise<Tweet[] | null> {
  try {
    const response = await fetch(
      `https://api.fxtwitter.com/${username}/status/${tweetId}`,
      {
        headers: { "User-Agent": "ThreadAutopsy/1.0" },
        cache: "no-store",
      },
    );
    if (!response.ok) return null;

    const data = await response.json();
    const tweet = data?.tweet;
    if (!tweet?.text) return null;

    const tweets: Tweet[] = [];

    // Add the main tweet
    tweets.push({ id: String(tweet.id || tweetId), text: tweet.text, position: 1 });

    // FxTwitter provides thread continuation via tweet.thread
    const thread = tweet.thread;
    if (Array.isArray(thread)) {
      for (const t of thread) {
        const text = t?.text;
        if (text) {
          tweets.push({
            id: String(t.id || `fx-${tweets.length}`),
            text,
            position: tweets.length + 1,
          });
        }
      }
    }

    return tweets.length > 0 ? tweets.slice(0, 30) : null;
  } catch {
    return null;
  }
}

// Fallback: fetch single tweet via Twitter oEmbed (no auth required)
async function fetchFromOEmbed(
  username: string,
  tweetId: string,
): Promise<Tweet[] | null> {
  try {
    const oembed = `https://publish.twitter.com/oembed?url=https://twitter.com/${username}/status/${tweetId}&omit_script=true`;
    const response = await fetch(oembed, {
      headers: { "User-Agent": "ThreadAutopsy/1.0" },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const data = await response.json();
    // oEmbed returns HTML — extract plain text from it
    const html: string = data?.html || "";
    // Strip HTML tags to get plain text
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return null;

    return [{ id: tweetId, text, position: 1 }];
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

    // Strategy 2: FxTwitter (free, no auth)
    if (!tweets) {
      tweets = await fetchFromFxTwitter(username, tweetId);
    }

    // Strategy 3: Twitter oEmbed (single tweet fallback, no auth)
    if (!tweets) {
      tweets = await fetchFromOEmbed(username, tweetId);
    }

    if (tweets) {
      return NextResponse.json({
        tweets,
        author: `@${username}`,
        title: tweets[0]?.text?.substring(0, 80) + "..." || "Thread",
      });
    }

    // Strategy 4: Demo fallback (always works)
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
