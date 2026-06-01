import type { ThreadData, Tweet } from './types';

export function parseThreadText(rawText: string, author?: string): ThreadData {
  const text = rawText.trim();

  const detectedAuthor = resolveAuthor(author, text);
  const tweets = splitIntoTweets(text);

  return {
    tweets,
    author: detectedAuthor,
    title: tweets[0]?.text?.slice(0, 80) + (tweets[0]?.text?.length > 80 ? '...' : '') || 'Pasted Thread',
  };
}

function resolveAuthor(provided: string | undefined, text: string): string {
  if (provided?.trim()) {
    const a = provided.trim();
    return a.startsWith('@') ? a : `@${a}`;
  }
  const firstLine = text.split('\n')[0].trim();
  const m = firstLine.match(/^@(\w+)/);
  return m ? `@${m[1]}` : '@unknown';
}

function splitIntoTweets(text: string): Tweet[] {
  let segments: string[];

  // Strategy 1: numbered "1/ 2/ 3/" or "1. 2. 3." at line boundaries
  const byNumbered = text.split(/(?:^|\n)\s*\d{1,2}[\/\.]\s+/);
  if (byNumbered.length >= 3) {
    segments = byNumbered.map((s) => s.trim()).filter((s) => s.length > 10);
  } else {
    // Strategy 2: double newline paragraph breaks
    const byParagraph = text.split(/\n\s*\n/).map((s) => s.trim()).filter((s) => s.length > 10);
    if (byParagraph.length >= 2) {
      segments = byParagraph;
    } else {
      // Strategy 3: single newlines as last resort
      segments = text.split('\n').map((s) => s.trim()).filter((s) => s.length > 20);
    }
  }

  return segments.map((seg, idx) => ({
    id: `paste-${idx}`,
    text: seg,
    position: idx + 1,
  }));
}
