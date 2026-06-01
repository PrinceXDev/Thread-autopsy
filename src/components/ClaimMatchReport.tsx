"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ClaimMatchAnalysis, MutationType, RiskLevel } from "@/lib/types";

// ─── HELPERS ────────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; label: string; icon: string }> = {
  low:      { color: "#22c55e", bg: "#22c55e15", label: "Low Risk",      icon: "✓"  },
  medium:   { color: "#f59e0b", bg: "#f59e0b15", label: "Medium Risk",   icon: "⚠"  },
  high:     { color: "#f97316", bg: "#f9731615", label: "High Risk",     icon: "🚨" },
  critical: { color: "#ff4444", bg: "#ff444415", label: "Critical Risk", icon: "🔴" },
};

const MUTATION_CONFIG: Record<MutationType, { label: string; color: string; bg: string; desc: string }> = {
  copy:     { label: "Copy",     color: "#ff4444", bg: "#ff444420", desc: ">85% identical — same text, minor edits"     },
  rephrase: { label: "Rephrase", color: "#f97316", bg: "#f9731620", desc: "60–85% — same claim, different wording"      },
  mutation: { label: "Mutation", color: "#f59e0b", bg: "#f59e0b20", desc: "30–60% — core claim preserved, context changed" },
  novel:    { label: "Novel",    color: "#22c55e", bg: "#22c55e20", desc: "No known misinformation match"               },
};

const VERDICT_COLORS: Record<string, string> = {
  false:            "#ff4444",
  misleading:       "#f97316",
  "partially-false": "#f59e0b",
  unverified:       "#94a3b8",
};

function SimilarityBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 85 ? "#ff4444" :
    pct >= 60 ? "#f97316" :
    pct >= 30 ? "#f59e0b" : "#22c55e";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono min-w-[32px] text-right" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────────

export default function ClaimMatchReport({ data }: { data: ClaimMatchAnalysis }) {
  const [showNovel, setShowNovel] = useState(false);
  const { matches, overallRisk, riskScore, networkSignals } = data;

  const risk = RISK_CONFIG[overallRisk];
  const flagged = matches.filter((m) => m.matchType !== "novel");
  const novel = matches.filter((m) => m.matchType === "novel");
  const totalClaims = matches.length;

  return (
    <div className="space-y-6">
      {/* Risk Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ borderColor: `${risk.color}30`, backgroundColor: risk.bg }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{risk.icon}</span>
              <span className="text-xl font-bold" style={{ color: risk.color }}>
                {risk.label}
              </span>
            </div>
            <p className="text-sm text-text-secondary">
              {totalClaims === 0
                ? "No claims were extracted from this thread to match."
                : flagged.length === 0
                ? `${totalClaims} claim${totalClaims !== 1 ? "s" : ""} analyzed — no matches against known misinformation patterns.`
                : `${flagged.length} of ${totalClaims} extracted claim${totalClaims !== 1 ? "s" : ""} match known misinformation patterns.`}
            </p>
          </div>
          <div
            className="text-3xl font-black min-w-[56px] text-right"
            style={{ color: risk.color }}
          >
            {riskScore}
          </div>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {[
          {
            icon: "🎯",
            label: "Flagged",
            value: `${networkSignals.matchedCount} / ${totalClaims}`,
            color: networkSignals.matchedCount > 0 ? "#f97316" : "#22c55e",
          },
          {
            icon: "📊",
            label: "Max similarity",
            value: `${Math.round(networkSignals.highestSimilarity * 100)}%`,
            color:
              networkSignals.highestSimilarity >= 0.85 ? "#ff4444" :
              networkSignals.highestSimilarity >= 0.60 ? "#f97316" :
              networkSignals.highestSimilarity >= 0.30 ? "#f59e0b" : "#22c55e",
          },
          {
            icon: "🌐",
            label: "Campaign",
            value: networkSignals.campaignDetected
              ? networkSignals.campaignDetected.replace(/-/g, " ")
              : "None",
            color: networkSignals.campaignDetected ? "#f59e0b" : "#22c55e",
          },
          {
            icon: "🔗",
            label: "Mutation chain",
            value: networkSignals.mutationChainDetected ? "Detected" : "None",
            color: networkSignals.mutationChainDetected ? "#ff4444" : "#22c55e",
          },
        ].map((stat, i) => (
          <div key={i} className="card text-center">
            <span className="text-lg">{stat.icon}</span>
            <div className="text-sm font-bold mt-1 truncate" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="text-xs text-text-muted mt-0.5">{stat.label}</div>
          </div>
        ))}
      </motion.div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="card"
      >
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          How to interpret match types
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(["copy", "rephrase", "mutation", "novel"] as MutationType[]).map((type) => {
            const cfg = MUTATION_CONFIG[type];
            return (
              <div key={type} className="flex items-start gap-2">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded shrink-0 mt-0.5"
                  style={{ color: cfg.color, backgroundColor: cfg.bg }}
                >
                  {cfg.label.toUpperCase()}
                </span>
                <span className="text-xs text-text-secondary">{cfg.desc}</span>
              </div>
            );
          })}
        </div>
        {networkSignals.mutationChainDetected && (
          <div className="mt-3 pt-3 border-t border-border text-xs text-accent-red">
            ⚡ Mutation chain detected: this thread contains a mix of direct copies and mutated variants
            from the same known campaign — a strong indicator of coordinated misinformation spreading.
          </div>
        )}
      </motion.div>

      {/* Flagged Claims */}
      {flagged.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-accent-red uppercase tracking-wider">
            🚩 Flagged Claims ({flagged.length})
          </h3>
          {flagged.map((match, i) => {
            const cfg = MUTATION_CONFIG[match.matchType];
            const known = match.matchedClaim!;
            const verdictColor = VERDICT_COLORS[known.verdict] ?? "#94a3b8";

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="card border-l-4"
                style={{ borderLeftColor: cfg.color }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded"
                    style={{ color: cfg.color, backgroundColor: cfg.bg }}
                  >
                    {cfg.label.toUpperCase()}
                  </span>
                  <span className="text-xs text-text-muted font-mono">
                    Tweet #{match.extractedClaim.tweetPosition}
                  </span>
                </div>

                {/* Extracted claim text */}
                <p className="text-sm text-text-primary mb-3 leading-relaxed">
                  &ldquo;{match.extractedClaim.claim}&rdquo;
                </p>

                {/* Similarity bar */}
                <div className="mb-3">
                  <div className="text-xs text-text-muted mb-1">Text similarity</div>
                  <SimilarityBar value={match.confidence} />
                </div>

                {/* Key phrases preserved */}
                {match.signals.keyPhrasesPreserved.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-text-muted mb-1">Key phrases preserved</div>
                    <div className="flex flex-wrap gap-1">
                      {match.signals.keyPhrasesPreserved.map((p, pi) => (
                        <span key={pi} className="badge-yellow text-xs">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matched known claim */}
                <div className="bg-bg-elevated rounded-lg p-3 space-y-2">
                  <div className="text-xs text-text-muted uppercase tracking-wider">
                    Matches known pattern
                  </div>
                  <p className="text-xs text-text-secondary italic leading-relaxed">
                    &ldquo;{known.canonical}&rdquo;
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded border font-medium"
                      style={{ color: verdictColor, borderColor: `${verdictColor}40` }}
                    >
                      {known.verdict.replace("-", " ").toUpperCase()}
                    </span>
                    <span className="badge text-xs capitalize">{known.category}</span>
                    {known.campaign && (
                      <span className="badge-yellow text-xs">
                        Campaign: {known.campaign.replace(/-/g, " ")}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed border-t border-border/50 pt-2 mt-1">
                    {known.source}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Novel Claims (collapsed) */}
      {novel.length > 0 && (
        <div>
          <button
            onClick={() => setShowNovel((v) => !v)}
            className="text-sm text-text-secondary hover:text-white transition-colors flex items-center gap-2"
          >
            <span className="text-accent-green">✓</span>
            {novel.length} novel claim{novel.length !== 1 ? "s" : ""} — no database match
            <span className="text-xs opacity-60">{showNovel ? "▲ hide" : "▼ show"}</span>
          </button>

          <AnimatePresence>
            {showNovel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-2 overflow-hidden"
              >
                {novel.map((match, i) => (
                  <div
                    key={i}
                    className="card border-l-4 border-l-green-500 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-text-secondary leading-relaxed flex-1">
                        &ldquo;{match.extractedClaim.claim}&rdquo;
                      </p>
                      <span className="text-xs text-accent-green shrink-0">✓ Novel</span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Empty state */}
      {totalClaims === 0 && (
        <div className="text-center py-12 text-text-muted">
          <span className="text-4xl mb-4 block">🔍</span>
          <p className="text-sm">No claims were extracted from this thread.</p>
          <p className="text-xs mt-2 text-text-muted">
            Claim matching requires the thread to contain statistics, expert claims, or generalisations.
          </p>
        </div>
      )}
    </div>
  );
}
