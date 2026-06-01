"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  loadHistory,
  deleteHistoryEntry,
  clearHistory,
  relativeTime,
  type HistoryEntry,
} from "@/lib/history";

// ─── HELPERS ────────────────────────────────────────────────────────────────────

function getSlopColor(score: number): string {
  if (score <= 30) return "#22c55e";
  if (score <= 55) return "#f59e0b";
  if (score <= 75) return "#f97316";
  return "#ff4444";
}

const RISK_COLORS: Record<string, string> = {
  low:      "#22c55e",
  medium:   "#f59e0b",
  high:     "#f97316",
  critical: "#ff4444",
};

const RISK_ICONS: Record<string, string> = {
  low:      "✓",
  medium:   "⚠",
  high:     "🚨",
  critical: "🔴",
};

// ─── HISTORY CARD ────────────────────────────────────────────────────────────────

function HistoryCard({
  entry,
  index,
  onView,
  onDelete,
}: {
  entry: HistoryEntry;
  index: number;
  onView: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
}) {
  const slopColor = getSlopColor(entry.slopScore);
  const riskColor = RISK_COLORS[entry.claimMatchRisk] ?? "#94a3b8";
  const riskIcon = RISK_ICONS[entry.claimMatchRisk] ?? "?";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, scale: 0.97 }}
      transition={{ delay: index * 0.04 }}
      className="card hover:border-border/80 transition-colors group"
    >
      <div className="flex items-start gap-4">
        {/* Slop score mini circle */}
        <div
          className="relative shrink-0 w-14 h-14 rounded-full flex items-center justify-center mt-0.5"
          style={{
            background: `conic-gradient(${slopColor} ${entry.slopScore}%, #222 ${entry.slopScore}%)`,
          }}
        >
          <div className="absolute inset-1 rounded-full bg-bg-card flex flex-col items-center justify-center">
            <span className="text-sm font-black" style={{ color: slopColor }}>
              {entry.slopScore}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-primary line-clamp-2 leading-snug mb-0.5">
                {entry.threadTitle}
              </h3>
              <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                <span className="text-accent-red font-mono">{entry.threadAuthor}</span>
                <span>•</span>
                <span>{entry.tweetCount} tweets</span>
                <span>•</span>
                <span>{relativeTime(entry.savedAt)}</span>
              </div>
            </div>
            {/* Delete */}
            <button
              onClick={() => onDelete(entry.id)}
              className="shrink-0 text-text-muted hover:text-accent-red transition-colors opacity-0 group-hover:opacity-100 p-1 -mt-1 -mr-1"
              title="Remove from history"
            >
              ×
            </button>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ color: slopColor, backgroundColor: `${slopColor}15` }}
            >
              {entry.slopLabel}
            </span>
            <span className="text-xs text-text-secondary">
              {entry.compressionRatio}% noise
            </span>
            <span className="text-xs text-text-secondary">
              {Math.round(entry.tweetCount * (1 - entry.compressionRatio / 100))} real points
            </span>
            <span
              className="text-xs"
              style={{ color: riskColor }}
              title={`Claim match risk: ${entry.claimMatchRisk}`}
            >
              {riskIcon} {entry.claimMatchRisk} risk
            </span>
          </div>
        </div>
      </div>

      {/* View button */}
      <div className="mt-4 pt-3 border-t border-border/50">
        <button
          onClick={() => onView(entry)}
          className="btn-secondary text-xs w-full"
        >
          View Analysis →
        </button>
      </div>
    </motion.div>
  );
}

// ─── HISTORY PAGE ────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setEntries(loadHistory());
  }, []);

  const handleView = (entry: HistoryEntry) => {
    sessionStorage.setItem("analysisResults", JSON.stringify(entry.result));
    router.push("/results");
  };

  const handleDelete = (id: string) => {
    setEntries(deleteHistoryEntry(id));
  };

  const handleClearAll = () => {
    clearHistory();
    setEntries([]);
    setShowClearConfirm(false);
  };

  return (
    <main className="min-h-screen bg-bg-primary">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border sticky top-0 z-50 bg-bg-primary/80 backdrop-blur-xl"
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-text-secondary hover:text-white transition-colors text-sm flex items-center gap-2"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold">
            Analysis History <span className="text-sm">📚</span>
          </h1>
          {entries.length > 0 && !showClearConfirm && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="btn-secondary text-xs"
            >
              Clear All
            </button>
          )}
          {showClearConfirm && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">Sure?</span>
              <button
                onClick={handleClearAll}
                className="text-xs px-3 py-1 rounded bg-accent-red/20 text-accent-red border border-accent-red/30 hover:bg-accent-red/30 transition-colors"
              >
                Yes, clear
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="text-xs text-text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          {entries.length === 0 && <div className="w-16" />}
        </div>
      </motion.header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Page title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <h2 className="text-2xl font-bold mb-1">Past Analyses</h2>
          <p className="text-sm text-text-secondary">
            {entries.length === 0
              ? "No analyses saved yet."
              : `${entries.length} analysis${entries.length !== 1 ? "es" : ""} saved locally in your browser.`}
          </p>
        </motion.div>

        {/* Empty state */}
        {entries.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center py-24 text-text-muted"
          >
            <span className="text-5xl mb-4 block">📭</span>
            <p className="text-base mb-2">Nothing here yet.</p>
            <p className="text-sm mb-6">
              Analyses are saved automatically when you view results.
            </p>
            <button
              onClick={() => router.push("/")}
              className="btn-primary"
            >
              Analyse a Thread
            </button>
          </motion.div>
        )}

        {/* Entry list */}
        <AnimatePresence mode="popLayout">
          <div className="grid gap-4 md:grid-cols-2">
            {entries.map((entry, i) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                index={i}
                onView={handleView}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </AnimatePresence>

        {entries.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center text-xs text-text-muted mt-8"
          >
            History is stored in your browser&apos;s local storage and never sent anywhere.
            Up to 20 entries are kept.
          </motion.p>
        )}
      </div>
    </main>
  );
}
