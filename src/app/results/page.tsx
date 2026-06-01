"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import SimilarityHeatmap from "@/components/SimilarityHeatmap";
import TweetSidebar from "@/components/TweetSidebar";
import ClaimMatchReport from "@/components/ClaimMatchReport";
import ClaimMethodologyPanel from "@/components/ClaimMethodologyPanel";
import type { AnalysisResult, PatternType } from "@/lib/types";
import { saveToHistory } from "@/lib/history";

// ─── HELPERS ────────────────────────────────────────────────────────────────────

function getSlopColor(score: number): string {
  if (score <= 30) return "#22c55e";
  if (score <= 55) return "#f59e0b";
  if (score <= 75) return "#f97316";
  return "#ff4444";
}

function getDensityColor(score: number): string {
  if (score > 70) return "#22c55e";
  if (score >= 40) return "#f59e0b";
  return "#ff4444";
}

function getTweetBorder(
  score: number,
  hasClaim: boolean,
  hasSlopPattern: boolean,
): string {
  if (score < 40 || hasSlopPattern) return "border-l-red-500";
  if (score <= 70 || hasClaim) return "border-l-yellow-500";
  return "border-l-green-500";
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const PATTERN_LABELS: Record<PatternType, { label: string; color: string }> = {
  HYPE_OPENER: { label: "🎯 Hype Opener", color: "badge-red" },
  ENGAGEMENT_BAIT: { label: "🎣 Engagement Bait", color: "badge-red" },
  EMPTY_CLOSER: { label: "👋 Empty Closer", color: "badge-orange" },
  NUMBERED_PADDING: { label: "📝 Numbered Padding", color: "badge-yellow" },
  FAKE_EXCLUSIVITY: { label: "🤫 Fake Exclusivity", color: "badge-orange" },
};

// ─── RESULTS PAGE ───────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [activeTweetPosition, setActiveTweetPosition] = useState<
    number | undefined
  >();
  const router = useRouter();
  const shareRef = useRef<HTMLDivElement>(null);
  const tweetRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    const stored = sessionStorage.getItem("analysisResults");
    if (stored) {
      const parsed: AnalysisResult = JSON.parse(stored);
      setResults(parsed);
      saveToHistory(parsed);
    } else {
      router.push("/");
    }
  }, [router]);

  const handleShare = useCallback(async () => {
    if (shareRef.current) {
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(shareRef.current, {
          backgroundColor: "#0a0a0a",
          scale: 2,
        });
        const link = document.createElement("a");
        link.download = "thread-autopsy.png";
        link.href = canvas.toDataURL();
        link.click();
        return;
      } catch {
        // fall through to text copy
      }
    }
    if (results) {
      const text = `Thread Autopsy 🔬\nSlop Score: ${results.slopScore.score}/100 (${results.slopScore.label})\n${results.compression.originalTweetCount} tweets compressed to ${results.compression.keptTweetCount} real points\nTime wasted: ${formatTime(results.timeMetrics.timeWastedSec)}`;
      navigator.clipboard.writeText(text);
    }
  }, [results]);

  if (!results) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const {
    density,
    repetition,
    claims,
    structural,
    compression,
    slopScore,
    timeMetrics,
    thread,
    claimMatch,
  } = results;

  const tabs = [
    { label: "Tweet-by-Tweet", icon: "📋" },
    { label: "Similarity Heatmap", icon: "🔥" },
    { label: "Autopsy Report", icon: "🔬" },
    { label: "Claim Report", icon: "⚠️" },
    { label: "Claim Match", icon: "🎯" },
  ];

  // Build lookup maps
  const densityMap = new Map(density.map((d) => [d.tweetId, d]));
  const patternMap = new Map(
    structural.patterns.map((p) => [p.tweetId, p.patterns]),
  );
  const claimMap = new Map<string, typeof claims.claims>();
  for (const c of claims.claims) {
    if (!claimMap.has(c.tweetId)) claimMap.set(c.tweetId, []);
    claimMap.get(c.tweetId)!.push(c);
  }

  // Find duplicate mapping
  const duplicateOf = new Map<number, number>();
  for (const pair of repetition.duplicatePairs) {
    if (!duplicateOf.has(pair.tweetB)) {
      duplicateOf.set(pair.tweetB, pair.tweetA);
    }
  }

  const uniqueIdeas = compression.keptTweetCount;
  const repeatedPoints = repetition.clusters.reduce(
    (sum, c) => sum + c.length - 1,
    0,
  );

  const densityScoreMap = new Map(density.map((d) => [d.tweetId, d.score]));

  const patternCounts: Record<string, number> = {};
  for (const p of structural.patterns) {
    for (const pat of p.patterns) {
      patternCounts[pat] = (patternCounts[pat] ?? 0) + 1;
    }
  }
  if (repeatedPoints > 0) patternCounts["DUPLICATE"] = repeatedPoints;

  const scrollToTweet = (position: number) => {
    setActiveTweetPosition(position);
    setActiveTab(0);
    requestAnimationFrame(() => {
      tweetRefs.current[position]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  return (
    <main className="min-h-screen bg-bg-primary">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border sticky top-0 z-50 bg-bg-primary/80 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-text-secondary hover:text-white transition-colors text-sm flex items-center gap-2"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold">
            Thread Autopsy <span className="text-sm">🔬</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/history")}
              className="btn-secondary text-xs"
            >
              📚 History
            </button>
            <button onClick={handleShare} className="btn-secondary text-xs">
              Share
            </button>
          </div>
        </div>
      </motion.header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Thread info + Slop Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-6">
            <div className="flex-1">
              <p className="text-accent-red font-mono text-sm mb-1">
                {thread.author}
              </p>
              <h2 className="text-xl md:text-2xl font-bold leading-tight">
                {thread.title}
              </h2>
            </div>

            {/* Slop Score Circle */}
            <div className="flex flex-col items-center">
              <div
                className="relative w-28 h-28 rounded-full flex items-center justify-center"
                style={{
                  background: `conic-gradient(${getSlopColor(slopScore.score)} ${slopScore.score}%, #222 ${slopScore.score}%)`,
                }}
              >
                <div className="absolute inset-1.5 rounded-full bg-bg-primary flex flex-col items-center justify-center">
                  <span
                    className="text-3xl font-black"
                    style={{ color: getSlopColor(slopScore.score) }}
                  >
                    {slopScore.score}
                  </span>
                  <span className="text-[10px] text-text-secondary uppercase tracking-wider">
                    slop
                  </span>
                </div>
              </div>
              <span
                className="mt-2 text-xs font-semibold px-3 py-1 rounded-full"
                style={{
                  color: getSlopColor(slopScore.score),
                  backgroundColor: `${getSlopColor(slopScore.score)}15`,
                }}
              >
                {slopScore.label}
              </span>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                icon: "⏱",
                label: "Time to read",
                value: formatTime(timeMetrics.readingTimeSec),
              },
              {
                icon: "⚡",
                label: "Real content",
                value: formatTime(timeMetrics.actualInfoTimeSec),
              },
              {
                icon: "🔁",
                label: "Repeated points",
                value: repeatedPoints.toString(),
              },
              {
                icon: "💡",
                label: "Unique ideas",
                value: uniqueIdeas.toString(),
              },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className="card text-center"
              >
                <span className="text-lg">{stat.icon}</span>
                <div className="text-2xl font-bold mt-1">{stat.value}</div>
                <div className="text-xs text-text-secondary mt-1">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="border-b border-border mb-6 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map((tab, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`tab-button ${activeTab === i ? "active" : ""}`}
                id={`tab-${i}`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content + Sidebar */}
        <div className="flex gap-6">
          <TweetSidebar
            tweets={thread.tweets}
            densityScores={densityScoreMap}
            activePosition={activeTweetPosition}
            onSelect={scrollToTweet}
          />

          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {/* TAB 0: Tweet-by-Tweet */}
              {activeTab === 0 && (
                <motion.div
                  key="tweets"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {thread.tweets.map((tweet, idx) => {
                    const d = densityMap.get(tweet.id);
                    const patterns = patternMap.get(tweet.id) || [];
                    const tweetClaims = claimMap.get(tweet.id) || [];
                    const dupOf = duplicateOf.get(idx);
                    const score = d?.score ?? 50;
                    const hasUnverifiedClaim = tweetClaims.some(
                      (c) => !c.hasSource,
                    );
                    const slopPatterns = patterns.filter(
                      (p) =>
                        p === "HYPE_OPENER" ||
                        p === "EMPTY_CLOSER" ||
                        p === "NUMBERED_PADDING" ||
                        p === "ENGAGEMENT_BAIT",
                    );

                    return (
                      <motion.div
                        key={tweet.id}
                        ref={(el) => {
                          tweetRefs.current[tweet.position] = el;
                        }}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`card border-l-4 ${getTweetBorder(
                          score,
                          hasUnverifiedClaim,
                          slopPatterns.length > 0,
                        )}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="text-xs text-text-muted font-mono mt-0.5 min-w-[24px]">
                            #{tweet.position}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed mb-3">
                              {tweet.text}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {/* Density badge */}
                              {d && (
                                <span
                                  className="badge text-xs"
                                  style={{
                                    color: getDensityColor(d.score),
                                    backgroundColor: `${getDensityColor(d.score)}15`,
                                    borderColor: `${getDensityColor(d.score)}30`,
                                  }}
                                >
                                  Density: {d.score} — {d.label}
                                </span>
                              )}

                              {/* Pattern tags */}
                              {patterns.map((pat) => (
                                <span
                                  key={pat}
                                  className={PATTERN_LABELS[pat].color}
                                >
                                  {PATTERN_LABELS[pat].label}
                                </span>
                              ))}

                              {/* Duplicate marker */}
                              {dupOf !== undefined && (
                                <>
                                  <span className="badge-yellow">
                                    DUPLICATE
                                  </span>
                                  <span className="badge-yellow">
                                    🔁 Similar to tweet #
                                    {thread.tweets[dupOf]?.position}
                                  </span>
                                </>
                              )}

                              {/* Claim badges */}
                              {tweetClaims.map((claim, ci) => (
                                <span key={ci} className="badge-orange">
                                  ⚠️ Unverified {claim.type.toLowerCase()}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}

              {/* TAB 1: Similarity Heatmap */}
              {activeTab === 1 && (
                <motion.div
                  key="heatmap"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="card overflow-x-auto">
                    <h3 className="text-lg font-semibold mb-4">
                      Tweet Similarity Matrix
                    </h3>
                    <p className="text-sm text-text-secondary mb-6">
                      Darker red = higher similarity. Hover over cells to see
                      exact percentages.
                    </p>

                    <SimilarityHeatmap matrix={repetition.similarityMatrix} />

                    {/* Duplicate clusters */}
                    {repetition.clusters.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-border">
                        <h4 className="text-sm font-semibold mb-3 text-accent-red">
                          🔁 Duplicate Clusters Detected
                        </h4>
                        <div className="space-y-2">
                          {repetition.clusters.map((cluster, ci) => (
                            <div
                              key={ci}
                              className="text-sm text-text-secondary bg-bg-elevated rounded-lg p-3"
                            >
                              <span className="text-accent-yellow font-mono">
                                Cluster {ci + 1}:
                              </span>{" "}
                              Tweets{" "}
                              {cluster
                                .map(
                                  (idx) => `#${thread.tweets[idx]?.position}`,
                                )
                                .join(", ")}{" "}
                              say essentially the same thing
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* TAB 2: Autopsy Report (Hero Feature) */}
              {activeTab === 2 && (
                <motion.div
                  key="autopsy"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div ref={shareRef} className="max-w-3xl mx-auto">
                    {/* Hero compression stat */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 }}
                      className="card-glow text-center py-12 mb-8 relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-accent-red/5 to-transparent" />
                      <div className="relative z-10">
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.3, type: "spring" }}
                          className="text-7xl md:text-8xl font-black gradient-text mb-2"
                        >
                          {compression.compressionRatio}%
                        </motion.div>
                        <p className="text-lg text-text-secondary mb-1">
                          of this thread was{" "}
                          <span className="text-accent-red font-semibold">
                            noise
                          </span>
                        </p>
                        <p className="text-sm text-text-muted">
                          {compression.originalTweetCount} tweets →{" "}
                          {compression.keptTweetCount} actual points
                        </p>
                      </div>
                    </motion.div>

                    {/* Time wasted */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="grid grid-cols-3 gap-3 mb-8"
                    >
                      <div className="card text-center">
                        <div className="text-xs text-text-muted uppercase tracking-wider mb-2">
                          Reading time
                        </div>
                        <div className="text-2xl font-bold">
                          {formatTime(timeMetrics.readingTimeSec)}
                        </div>
                      </div>
                      <div className="card text-center border-accent-red/30">
                        <div className="text-xs text-text-muted uppercase tracking-wider mb-2">
                          Time wasted
                        </div>
                        <div className="text-2xl font-bold text-accent-red">
                          {formatTime(timeMetrics.timeWastedSec)}
                        </div>
                      </div>
                      <div className="card text-center border-accent-green/30">
                        <div className="text-xs text-text-muted uppercase tracking-wider mb-2">
                          Real content
                        </div>
                        <div className="text-2xl font-bold text-accent-green">
                          {formatTime(timeMetrics.actualInfoTimeSec)}
                        </div>
                      </div>
                    </motion.div>

                    {/* The actual summary */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="card mb-8"
                    >
                      <h3 className="text-sm font-semibold text-accent-green uppercase tracking-wider mb-4">
                        💎 What the thread actually says
                      </h3>
                      <div className="space-y-3">
                        {compression.summary.map((sentence, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                            className="flex items-start gap-3 p-3 bg-bg-elevated rounded-lg border border-green-500/10"
                          >
                            <span className="text-accent-green font-mono text-sm mt-0.5">
                              {i + 1}.
                            </span>
                            <p className="text-sm leading-relaxed">
                              {sentence}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                    {/* What was cut */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="card mb-8"
                    >
                      <h3 className="text-sm font-semibold text-accent-red uppercase tracking-wider mb-4">
                        🗑️ What was cut
                      </h3>
                      <ul className="space-y-2 mb-4">
                        {Object.entries(patternCounts).map(([label, count]) => (
                          <li
                            key={label}
                            className="flex items-center justify-between text-sm py-2 px-3 bg-bg-elevated rounded-lg border border-border/50"
                          >
                            <span className="font-mono text-text-secondary">
                              {label}
                            </span>
                            <span className="text-accent-red font-semibold">
                              ×{count}
                            </span>
                          </li>
                        ))}
                        {density.filter((d) => d.score < 40).length > 0 && (
                          <li className="flex items-center justify-between text-sm py-2 px-3 bg-bg-elevated rounded-lg border border-border/50">
                            <span className="font-mono text-text-secondary">
                              LOW_DENSITY
                            </span>
                            <span className="text-accent-red font-semibold">
                              ×{density.filter((d) => d.score < 40).length}
                            </span>
                          </li>
                        )}
                      </ul>
                      <div className="grid grid-cols-2 gap-3">
                        {density.filter((d) => d.score < 40).length > 0 && (
                          <div className="flex items-center gap-2 p-3 bg-bg-elevated rounded-lg">
                            <span className="text-accent-red text-lg">📉</span>
                            <div>
                              <div className="text-sm font-medium">
                                Low density tweets
                              </div>
                              <div className="text-xs text-text-secondary">
                                {density.filter((d) => d.score < 40).length}{" "}
                                tweets
                              </div>
                            </div>
                          </div>
                        )}
                        {repetition.clusters.length > 0 && (
                          <div className="flex items-center gap-2 p-3 bg-bg-elevated rounded-lg">
                            <span className="text-accent-yellow text-lg">
                              🔁
                            </span>
                            <div>
                              <div className="text-sm font-medium">
                                Repeated points
                              </div>
                              <div className="text-xs text-text-secondary">
                                {repeatedPoints} duplicates across{" "}
                                {repetition.clusters.length} clusters
                              </div>
                            </div>
                          </div>
                        )}
                        {claims.claims.filter((c) => !c.hasSource).length >
                          0 && (
                          <div className="flex items-center gap-2 p-3 bg-bg-elevated rounded-lg">
                            <span className="text-accent-yellow text-lg">
                              ❓
                            </span>
                            <div>
                              <div className="text-sm font-medium">
                                Unverified claims
                              </div>
                              <div className="text-xs text-text-secondary">
                                {
                                  claims.claims.filter((c) => !c.hasSource)
                                    .length
                                }{" "}
                                claims without sources
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {/* Share button */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 }}
                      className="text-center"
                    >
                      <button
                        onClick={handleShare}
                        className="btn-primary text-lg px-10 py-4"
                        id="share-autopsy-btn"
                      >
                        📸 Share this Autopsy
                      </button>
                      <p className="text-xs text-text-muted mt-3">
                        Downloads as an image you can share anywhere
                      </p>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: Claim Report */}
              {activeTab === 3 && (
                <motion.div
                  key="claims"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <ClaimMethodologyPanel />

                  <div className="card overflow-x-auto">
                    <h3 className="text-lg font-semibold mb-2">
                      ⚠️ Unverified Claims Report
                    </h3>
                    <p className="text-sm text-text-secondary mb-6">
                      Claims found in the thread that lack proper sourcing
                    </p>

                    {claims.claims.length === 0 ? (
                      <div className="text-center py-12 text-text-muted">
                        <span className="text-4xl mb-4 block">✅</span>
                        <p>No suspicious claims detected in this thread.</p>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="pb-3 pr-4 text-text-secondary font-medium">
                              Tweet #
                            </th>
                            <th className="pb-3 pr-4 text-text-secondary font-medium">
                              Claim
                            </th>
                            <th className="pb-3 pr-4 text-text-secondary font-medium">
                              Type
                            </th>
                            <th className="pb-3 text-text-secondary font-medium">
                              Verdict
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {claims.claims.map((claim, i) => (
                            <motion.tr
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="border-b border-border/50"
                            >
                              <td className="py-3 pr-4 font-mono text-text-muted">
                                #{claim.tweetPosition}
                              </td>
                              <td className="py-3 pr-4 max-w-md">
                                <p className="text-text-primary line-clamp-2">
                                  {claim.claim}
                                </p>
                              </td>
                              <td className="py-3 pr-4">
                                <span
                                  className={
                                    claim.type === "Statistic"
                                      ? "badge-red"
                                      : claim.type === "Expert claim"
                                        ? "badge-orange"
                                        : "badge-yellow"
                                  }
                                >
                                  {claim.type}
                                </span>
                              </td>
                              <td className="py-3">
                                {claim.hasSource ? (
                                  <span className="text-accent-green text-xs">
                                    ✓ Source referenced
                                  </span>
                                ) : (
                                  <span className="text-accent-red text-xs">
                                    ✗ No source found in thread
                                  </span>
                                )}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </motion.div>
              )}
              {/* TAB 4: Claim Match */}
              {activeTab === 4 && (
                <motion.div
                  key="claimmatch"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <ClaimMatchReport data={claimMatch} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}
