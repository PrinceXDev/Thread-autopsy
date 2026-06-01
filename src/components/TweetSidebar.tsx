"use client";

import type { Tweet } from "@/lib/types";

interface TweetSidebarProps {
  tweets: Tweet[];
  densityScores: Map<string, number>;
  activePosition?: number;
  onSelect: (position: number) => void;
}

function scoreColor(score: number): string {
  if (score > 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

export default function TweetSidebar({
  tweets,
  densityScores,
  activePosition,
  onSelect,
}: TweetSidebarProps) {
  return (
    <aside className="hidden lg:block w-64 shrink-0">
      <div className="sticky top-24 card p-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Thread ({tweets.length} tweets)
        </h3>
        <ul className="space-y-1">
          {tweets.map((tweet) => {
            const score = densityScores.get(tweet.id) ?? 50;
            const isActive = activePosition === tweet.position;
            const preview =
              tweet.text.length > 60
                ? tweet.text.slice(0, 60).replace(/\n/g, " ") + "…"
                : tweet.text.replace(/\n/g, " ");

            return (
              <li key={tweet.id}>
                <button
                  type="button"
                  onClick={() => onSelect(tweet.position)}
                  className={`w-full text-left px-2 py-2 rounded-lg transition-all duration-200 flex gap-2 items-start ${
                    isActive
                      ? "bg-accent-red/10 border border-accent-red/30"
                      : "hover:bg-bg-elevated border border-transparent"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${scoreColor(score)}`}
                  />
                  <span className="min-w-0">
                    <span className="text-[10px] font-mono text-text-muted">
                      #{tweet.position}
                    </span>
                    <p className="text-xs text-text-secondary line-clamp-2 leading-snug">
                      {preview}
                    </p>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
