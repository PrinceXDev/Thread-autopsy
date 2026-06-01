"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { loadHistory } from "@/lib/history";
import type { AnalysisResult, ThreadData } from "@/lib/types";
import { parseThreadText } from "@/lib/threadParser";

type Mode = "url" | "paste";

const URL_STEPS = [
  { emoji: "🔬", text: "Fetching tweets..." },
  { emoji: "🧬", text: "Measuring information density..." },
  { emoji: "🔁", text: "Detecting repetitions..." },
  { emoji: "❓", text: "Extracting unverified claims..." },
  { emoji: "💊", text: "Calculating slop score..." },
];

const PASTE_STEPS = [
  { emoji: "📋", text: "Parsing thread text..." },
  { emoji: "🧬", text: "Measuring information density..." },
  { emoji: "🔁", text: "Detecting repetitions..." },
  { emoji: "❓", text: "Extracting unverified claims..." },
  { emoji: "💊", text: "Calculating slop score..." },
];

const STATS = [
  { value: "78%", label: "Avg thread is filler" },
  { value: "2", label: "Real ideas in most viral threads" },
  { value: "6 min", label: "Wasted reading 18 sec of content" },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteAuthor, setPasteAuthor] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeSteps, setActiveSteps] = useState(URL_STEPS);
  const [currentStep, setCurrentStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [historyCount, setHistoryCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (mode === "url") inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    setHistoryCount(loadHistory().length);
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
  };

  // Called after step 0 is done — animates steps 1-4 while running analyze
  const analyzeAndNavigate = async (
    threadData: ThreadData,
    steps: typeof URL_STEPS,
  ) => {
    const analyzePromise = fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(threadData),
    });

    for (let i = 1; i < steps.length; i++) {
      setCurrentStep(i);
      await new Promise((r) => setTimeout(r, 800));
      setCompletedSteps((prev) => [...prev, i]);
    }

    const analyzeRes = await analyzePromise;
    if (!analyzeRes.ok) {
      const body = await analyzeRes.json().catch(() => ({})) as { _debug?: string };
      throw new Error(body._debug ? `Analysis failed: ${body._debug}` : "Analysis failed. Please try again.");
    }

    const results: AnalysisResult = await analyzeRes.json();
    sessionStorage.setItem("analysisResults", JSON.stringify(results));
    await new Promise((r) => setTimeout(r, 300));
    router.push("/results");
  };

  const startLoading = (steps: typeof URL_STEPS) => {
    setActiveSteps(steps);
    setIsLoading(true);
    setCurrentStep(0);
    setCompletedSteps([]);
    setError("");
  };

  const handleError = (err: unknown) => {
    const message = err instanceof Error ? err.message : "Something went wrong";
    setError(message);
    setIsLoading(false);
    setCurrentStep(-1);
    setCompletedSteps([]);
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const threadUrl = url.trim();
    if (!threadUrl) return;

    startLoading(URL_STEPS);
    try {
      const fetchRes = await fetch("/api/fetch-thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: threadUrl }),
      });

      if (!fetchRes.ok) {
        const errData = await fetchRes.json();
        throw new Error(errData.error || "Failed to fetch thread");
      }

      const threadData: ThreadData = await fetchRes.json();
      setCompletedSteps([0]);
      await analyzeAndNavigate(threadData, URL_STEPS);
    } catch (err) {
      handleError(err);
    }
  };

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteText.trim()) return;

    const threadData = parseThreadText(pasteText, pasteAuthor || undefined);
    if (threadData.tweets.length < 2) {
      setError(
        "Could not detect individual tweets. Separate each tweet with a blank line, or use numbered format (1/ 2/ 3/).",
      );
      return;
    }

    startLoading(PASTE_STEPS);
    try {
      await new Promise((r) => setTimeout(r, 600));
      setCompletedSteps([0]);
      await analyzeAndNavigate(threadData, PASTE_STEPS);
    } catch (err) {
      handleError(err);
    }
  };

  const handleSampleThread = async () => {
    startLoading(URL_STEPS);
    try {
      const fetchRes = await fetch("/api/fetch-thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "sample" }),
      });
      const threadData: ThreadData = await fetchRes.json();
      setCompletedSteps([0]);
      await analyzeAndNavigate(threadData, URL_STEPS);
    } catch (err) {
      handleError(err);
    }
  };

  const handlePasteUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* History button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={() => router.push("/history")}
        className="absolute top-4 right-4 btn-secondary text-xs z-10 flex items-center gap-1.5"
      >
        📚 History
        {historyCount > 0 && (
          <span className="bg-accent-red/20 text-accent-red text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {historyCount}
          </span>
        )}
      </motion.button>

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent-red/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-red-900/5 rounded-full blur-[100px]" />
      </div>

      <AnimatePresence mode="wait">
        {!isLoading ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl w-full text-center relative z-10"
          >
            {/* Live badge */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-2 mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-accent-red pulse-dot" />
              <span className="text-xs font-mono text-accent-red tracking-widest uppercase">
                Live
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-7xl font-black mb-4 tracking-tight"
            >
              Thread Autopsy{" "}
              <span className="inline-block animate-pulse">🔬</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-lg md:text-xl text-text-secondary mb-10"
            >
              Find out what a thread{" "}
              <span className="gradient-text font-semibold">actually</span> says
            </motion.p>

            {/* Mode tabs */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex justify-center mb-6"
            >
              <div className="flex bg-bg-card border border-border rounded-lg p-1 gap-1">
                <button
                  type="button"
                  onClick={() => switchMode("url")}
                  className={`px-5 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    mode === "url"
                      ? "bg-accent-red text-white shadow-sm"
                      : "text-text-secondary hover:text-white"
                  }`}
                >
                  🔗 URL
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("paste")}
                  className={`px-5 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    mode === "paste"
                      ? "bg-accent-red text-white shadow-sm"
                      : "text-text-secondary hover:text-white"
                  }`}
                >
                  📋 Paste Text
                </button>
              </div>
            </motion.div>

            {/* Forms */}
            <AnimatePresence mode="wait">
              {mode === "url" ? (
                <motion.form
                  key="url-form"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  onSubmit={handleUrlSubmit}
                  className="mb-6"
                >
                  <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                      <input
                        ref={inputRef}
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Paste a Twitter/X thread URL..."
                        className="input-field pr-16"
                      />
                      <button
                        type="button"
                        onClick={handlePasteUrl}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5
                                   text-xs text-text-secondary bg-bg-elevated rounded-md
                                   hover:text-white transition-colors"
                      >
                        Paste
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={!url.trim()}
                      className="btn-primary whitespace-nowrap"
                    >
                      Perform Autopsy
                    </button>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-sm p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-left"
                    >
                      {error}
                      <button
                        type="button"
                        onClick={() => switchMode("paste")}
                        className="ml-2 underline hover:text-red-300 transition-colors"
                      >
                        Switch to Paste Text mode
                      </button>
                    </motion.div>
                  )}
                </motion.form>
              ) : (
                <motion.form
                  key="paste-form"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  onSubmit={handlePasteSubmit}
                  className="mb-6 text-left"
                >
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={`Paste the full thread text here...\n\nWorks with:\n• Numbered: 1/ First tweet  2/ Second tweet...\n• Paragraphs: each tweet separated by a blank line`}
                    className="input-field resize-none h-44 font-mono text-sm leading-relaxed mb-3"
                    autoFocus
                  />
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={pasteAuthor}
                      onChange={(e) => setPasteAuthor(e.target.value)}
                      placeholder="@author (optional)"
                      className="input-field text-sm"
                      style={{ maxWidth: "180px" }}
                    />
                    <button
                      type="submit"
                      disabled={!pasteText.trim()}
                      className="btn-primary whitespace-nowrap ml-auto"
                    >
                      Perform Autopsy
                    </button>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-sm mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                    >
                      {error}
                    </motion.div>
                  )}

                  <p className="text-xs text-text-muted mt-3 leading-relaxed">
                    Tip: Open the thread on Twitter/X, select all text, and
                    paste here. No API key needed.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Sample thread */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <button
                onClick={handleSampleThread}
                className="btn-secondary text-sm"
              >
                ⚡ Try with sample thread
              </button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="grid grid-cols-3 gap-4 mt-16"
            >
              {STATS.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + i * 0.1 }}
                  className="card-glow text-center"
                >
                  <div className="text-2xl md:text-3xl font-bold gradient-text mb-1">
                    {stat.value}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-md w-full relative z-10"
          >
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-2xl font-bold text-center mb-8"
            >
              Performing Autopsy...
            </motion.h2>

            <div className="space-y-4">
              {activeSteps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: i <= currentStep ? 1 : 0.3, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.3 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-bg-card border border-border"
                >
                  <span className="text-xl">{step.emoji}</span>
                  <span
                    className={`flex-1 text-sm ${
                      i <= currentStep ? "text-white" : "text-text-muted"
                    }`}
                  >
                    {step.text}
                  </span>
                  <AnimatePresence>
                    {completedSteps.includes(i) ? (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-accent-green text-lg"
                      >
                        ✓
                      </motion.span>
                    ) : i === currentStep ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          repeat: Infinity,
                          duration: 1,
                          ease: "linear",
                        }}
                        className="w-4 h-4 border-2 border-accent-red border-t-transparent rounded-full"
                      />
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-6 text-center text-xs text-text-muted"
      >
        Pure algorithmic analysis — works offline, no API key required
      </motion.div>
    </main>
  );
}
