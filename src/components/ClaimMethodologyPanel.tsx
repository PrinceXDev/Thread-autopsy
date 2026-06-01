"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── STATIC DATA ─────────────────────────────────────────────────────────────

const DETECTION_STEPS = [
  {
    icon: "📊",
    title: "Statistics detection",
    color: "#ff4444",
    how: "We scan every sentence for numeric patterns: percentages (e.g. 90%), suspiciously round numbers paired with groups (\"X% of CEOs / entrepreneurs / people\"), and any figure presented as a fact.",
    example: '"Studies show 73% of successful people wake up before 6am."',
    whySuspect:
      "Round statistics about broad groups almost never have a traceable source. The number is the bait; the missing citation is the tell.",
  },
  {
    icon: "🔬",
    title: "Expert-claim detection",
    color: "#f97316",
    how: 'We look for attribution phrases: "studies show", "research finds / found", "scientists say / discovered", "experts say / found", "according to", "it\'s been proven". These phrases frame a claim as backed by authority.',
    example: '"Experts say multitasking increases productivity."',
    whySuspect:
      "These phrases are often used without naming the study, journal, or expert. Vague attribution is a classic credibility-laundering tactic.",
  },
  {
    icon: "🌐",
    title: "Generalisation detection",
    color: "#f59e0b",
    how: 'We flag sentences using sweeping universal language: "most people", "everyone knows", "the average person", "nobody", "all people". These turn an opinion into an implied fact about all of humanity.',
    example: '"Nobody talks about how discipline beats motivation every time."',
    whySuspect:
      "Universal claims are unfalsifiable by design. They trade on the reader's instinct to agree without requiring any evidence.",
  },
];

const VERIFICATION_LOGIC = [
  {
    icon: "✓",
    color: "#22c55e",
    label: "Source referenced",
    desc: 'The tweet contains a URL, names a specific researcher or study ("according to Dr. Jane Smith, Nature 2021"), or provides direct attribution with enough detail to trace the claim.',
  },
  {
    icon: "✗",
    color: "#ff4444",
    label: "No source found",
    desc: "The claim makes a factual assertion — a number, an expert statement, or a universal generalisation — but no verifiable reference appears anywhere in the tweet text.",
  },
];

const VERIFY_RESOURCES = [
  { name: "Snopes", url: "snopes.com", desc: "Fact-checks viral claims, rumors, and myths" },
  { name: "FactCheck.org", url: "factcheck.org", desc: "U.S. political and science fact-checking" },
  { name: "PolitiFact", url: "politifact.com", desc: "Rates statements on a Truth-O-Meter scale" },
  { name: "Reuters Fact Check", url: "reuters.com/fact-check", desc: "Global news and social media fact-checking" },
  { name: "Google Scholar", url: "scholar.google.com", desc: "Find the original paper behind any claim" },
  { name: "Consensus", url: "consensus.app", desc: "AI search engine that queries scientific papers" },
];

const QUICK_CHECKS = [
  "Is the statistic suspiciously round? (90%, 80%, 3×) Real research rarely produces round numbers.",
  'Does the thread link to the actual study, or just say "studies show"?',
  "Who funded the research? (Check for conflict-of-interest disclosures.)",
  "Can you find the same claim on three independent, reputable news sources?",
  'Try: Google the exact claim + "myth" or + "debunked" and see what comes up.',
  "Look for the original quote — misattributed quotes are extremely common on social media.",
];

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function ClaimMethodologyPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="card mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-sm font-medium text-text-primary hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">🔍</span>
          How we detect &amp; verify claims
        </span>
        <span className="text-text-muted text-xs">{open ? "▲ hide" : "▼ show"}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mt-5 space-y-6">

              {/* ── Step 1–3: Detection methods ── */}
              <section>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Step 1 — Claim detection (3 types)
                </h4>
                <div className="space-y-4">
                  {DETECTION_STEPS.map((step) => (
                    <div key={step.title} className="bg-bg-elevated rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{step.icon}</span>
                        <span
                          className="text-xs font-bold uppercase tracking-wide"
                          style={{ color: step.color }}
                        >
                          {step.title}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed mb-2">
                        {step.how}
                      </p>
                      <div className="border-l-2 pl-3 mb-2" style={{ borderColor: step.color }}>
                        <p className="text-xs text-text-muted italic">{step.example}</p>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">
                        <span className="text-text-secondary font-medium">Why suspicious: </span>
                        {step.whySuspect}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Step 2: Source verification ── */}
              <section>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Step 2 — Source verification
                </h4>
                <p className="text-xs text-text-secondary leading-relaxed mb-3">
                  Once a claim is detected, we check whether the tweet itself provides
                  enough information for a reader to verify it. We look for:
                </p>
                <ul className="text-xs text-text-secondary space-y-1.5 mb-3 ml-3">
                  <li className="flex items-start gap-2">
                    <span className="text-accent-green mt-0.5">→</span>
                    A URL pointing to the source
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent-green mt-0.5">→</span>
                    A named researcher or publication with enough detail to find the original (e.g. &quot;Smith et al., 2020&quot;)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent-green mt-0.5">→</span>
                    Direct attribution to a named expert or institution
                  </li>
                </ul>
                <div className="grid sm:grid-cols-2 gap-2">
                  {VERIFICATION_LOGIC.map((v) => (
                    <div
                      key={v.label}
                      className="rounded-lg p-3 border"
                      style={{
                        borderColor: `${v.color}30`,
                        backgroundColor: `${v.color}08`,
                      }}
                    >
                      <div
                        className="text-xs font-bold mb-1"
                        style={{ color: v.color }}
                      >
                        {v.icon} {v.label}
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">{v.desc}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-3 leading-relaxed">
                  <strong className="text-text-secondary">Important:</strong> A &ldquo;source referenced&rdquo;
                  verdict only means the thread author pointed somewhere — it does{" "}
                  <em>not</em> mean the source actually supports the claim. Always follow
                  the link and read it yourself.
                </p>
              </section>

              {/* ── Step 3: Verify it yourself ── */}
              <section>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Step 3 — Verify it yourself
                </h4>
                <p className="text-xs text-text-secondary leading-relaxed mb-3">
                  This tool flags claims automatically, but the final judgment is yours.
                  Here are the resources we recommend:
                </p>
                <div className="grid sm:grid-cols-2 gap-2 mb-4">
                  {VERIFY_RESOURCES.map((r) => (
                    <div
                      key={r.name}
                      className="bg-bg-elevated rounded-lg px-3 py-2.5 border border-border/50"
                    >
                      <div className="text-xs font-semibold text-text-primary mb-0.5">
                        {r.name}
                      </div>
                      <div className="text-[11px] text-text-muted">{r.desc}</div>
                      <div className="text-[11px] text-accent-red/70 font-mono mt-0.5">
                        {r.url}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-bg-elevated rounded-lg p-3 border border-border/50">
                  <div className="text-xs font-semibold text-text-secondary mb-2">
                    Quick sanity checks
                  </div>
                  <ul className="space-y-1.5">
                    {QUICK_CHECKS.map((check, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-text-muted">
                        <span className="text-accent-yellow mt-0.5 shrink-0">•</span>
                        {check}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* ── Limitations ── */}
              <section className="border-t border-border pt-4">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Limitations of automated detection
                </h4>
                <p className="text-xs text-text-muted leading-relaxed">
                  This tool uses pattern matching and NLP heuristics — it is{" "}
                  <strong className="text-text-secondary">not</strong> a fact-checker.
                  It will produce false positives (flagging valid sourced claims) and
                  false negatives (missing well-disguised misinformation). Use it as a
                  first-pass filter to identify claims worth investigating, not as a
                  final verdict.
                </p>
              </section>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
