import natural from "natural";
import nlp from "compromise";
import {
  Tweet,
  DensityResult,
  RepetitionResult,
  SimilarityPair,
  Claim,
  ClaimResult,
  PatternType,
  PatternResult,
  StructuralResult,
  CompressionResult,
  SlopScore,
  TimeMetrics,
  AnalysisResult,
  ThreadData,
} from "./types";
import { matchClaims } from "./claimMatcher";

let tokenizer: natural.WordTokenizer;
try {
  tokenizer = new natural.WordTokenizer();
} catch {
  tokenizer = { tokenize: (text: string) => text.toLowerCase().split(/\s+/) } as unknown as natural.WordTokenizer;
}

// ─── FILLER / WEASEL WORD LISTS ────────────────────────────────────────────────

const FILLER_WORDS = [
  "success",
  "journey",
  "mindset",
  "hustle",
  "consistency",
  "passion",
  "grind",
  "growth",
  "motivation",
  "discipline",
  "inspire",
  "inspiring",
  "transform",
  "transformation",
  "lifestyle",
  "abundance",
  "manifest",
  "winners",
  "losers",
  "unstoppable",
  "relentless",
  "game-changer",
  "level up",
  "unlock",
  "unleash",
  "powerful",
  "incredible",
  "amazing",
  "literally",
  "absolutely",
  "completely",
];

const WEASEL_PATTERNS = [
  /studies show/i,
  /research (says|shows|finds|found)/i,
  /they say/i,
  /most people/i,
  /according to/i,
  /scientists (say|found|discovered)/i,
  /experts say/i,
  /experts found/i,
  /many people/i,
  /all people/i,
  /everyone knows/i,
  /it['']s (been )?(proven|shown)/i,
];

// ─── 1. INFORMATION DENSITY SCORER ─────────────────────────────────────────────

function countConcreteTokens(text: string): number {
  let count = 0;
  // Numbers and percentages
  const numbers = text.match(/\b\d[\d,.]*%?\b/g);
  count += (numbers?.length ?? 0) * 1;
  // Dates
  const dates = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|20\d{2}|19\d{2})\b/gi,
  );
  count += (dates?.length ?? 0) * 1;
  // Tool/product names (capitalized words that aren't sentence starters)
  const tools = text.match(
    /\b(Notion|Zapier|Toggl|Buffer|Slack|Trello|Asana|Gmail|Python|JavaScript|TypeScript|React|Excel|Sheets|Make\.com|Cal Newport|James Clear|Warren Buffett|Pomodoro)\b/g,
  );
  count += (tools?.length ?? 0) * 1;
  // URLs
  const urls = text.match(/https?:\/\/\S+/g);
  count += (urls?.length ?? 0) * 2;
  // Specific instructions (arrows, bullet points with content)
  const bullets = text.match(/^[\s]*[-→•►]\s+\S+/gm);
  count += (bullets?.length ?? 0) * 1;
  return count;
}

function countFillerWords(text: string): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const word of FILLER_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    const matches = lower.match(regex);
    count += matches?.length ?? 0;
  }
  return count;
}

function countWeaselPhrases(text: string): number {
  let count = 0;
  for (const pattern of WEASEL_PATTERNS) {
    if (pattern.test(text)) count++;
  }
  return count;
}

function getLabelForDensity(score: number): DensityResult["label"] {
  if (score <= 30) return "Filler";
  if (score <= 60) return "Weak";
  if (score <= 80) return "Decent";
  return "Solid";
}

export function analyzeDensity(tweets: Tweet[]): DensityResult[] {
  return tweets.map((tweet) => {
    const concreteCount = countConcreteTokens(tweet.text);
    const fillerCount = countFillerWords(tweet.text);
    const weaselCount = countWeaselPhrases(tweet.text);
    const raw = concreteCount * 15 - fillerCount * 10 - weaselCount * 5;
    const score = Math.max(0, Math.min(100, raw));
    return {
      tweetId: tweet.id,
      score,
      label: getLabelForDensity(score),
      concreteCount,
      fillerCount,
      weaselCount,
    };
  });
}

// ─── 2. REPETITION DETECTOR (TF-IDF + Cosine Similarity) ───────────────────────

function tokenize(text: string): string[] {
  return tokenizer
    .tokenize(text.toLowerCase())
    .filter((w) => w.length > 2 && /^[a-z0-9]+$/.test(w));
}

function buildTfIdf(docs: string[][]): Map<string, number>[] {
  let tfidf: natural.TfIdf;
  try {
    tfidf = new natural.TfIdf();
  } catch {
    return docs.map(() => new Map());
  }
  docs.forEach((doc) => tfidf.addDocument(doc.join(" ")));

  const vocab = new Set<string>();
  docs.forEach((_, i) => {
    tfidf.listTerms(i).forEach((item) => vocab.add(item.term));
  });

  return docs.map((_, docIndex) => {
    const vector = new Map<string, number>();
    vocab.forEach((term) => {
      const weight = tfidf.tfidf(term, docIndex);
      if (weight > 0) vector.set(term, weight);
    });
    return vector;
  });
}

function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  const allKeys = new Set([...Array.from(a.keys()), ...Array.from(b.keys())]);
  Array.from(allKeys).forEach((key) => {
    const va = a.get(key) ?? 0;
    const vb = b.get(key) ?? 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  });
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function analyzeRepetition(tweets: Tweet[]): RepetitionResult {
  const tokenized = tweets.map((t) => tokenize(t.text));
  const vectors = buildTfIdf(tokenized);
  const n = tweets.length;
  const similarityMatrix: number[][] = Array.from({ length: n }, () =>
    Array(n).fill(0),
  );
  const duplicatePairs: SimilarityPair[] = [];

  for (let i = 0; i < n; i++) {
    similarityMatrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      similarityMatrix[i][j] = Math.round(sim * 100) / 100;
      similarityMatrix[j][i] = Math.round(sim * 100) / 100;
      if (sim > 0.65) {
        duplicatePairs.push({ tweetA: i, tweetB: j, similarity: sim });
      }
    }
  }

  // Build clusters from duplicate pairs using union-find
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a: number, b: number) {
    parent[find(a)] = find(b);
  }

  for (const pair of duplicatePairs) {
    union(pair.tweetA, pair.tweetB);
  }

  const clusterMap = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (duplicatePairs.some((p) => p.tweetA === i || p.tweetB === i)) {
      if (!clusterMap.has(root)) clusterMap.set(root, []);
      clusterMap.get(root)!.push(i);
    }
  }

  const clusters = Array.from(clusterMap.values()).filter((c) => c.length > 1);

  return { similarityMatrix, duplicatePairs, clusters };
}

// ─── 3. CLAIM EXTRACTOR ────────────────────────────────────────────────────────

const STAT_PATTERN = /\b\d+(\.\d+)?%/;
const EXPERT_PATTERNS = [
  /studies show/i,
  /research (says|shows|finds|found)/i,
  /according to/i,
  /scientists (say|found|discovered)/i,
  /experts say/i,
  /experts found/i,
];
const GENERALIZATION_PATTERNS = [
  /(most|many|all) people/i,
  /everyone knows/i,
  /the average person/i,
  /nobody/i,
];

// Suspiciously specific stats: number + proper noun or vague subject
const SUSPICIOUS_STAT =
  /\b\d{1,3}%\s+of\s+(CEO|entrepreneur|people|adult|worker|student|American|millionaire)/i;

export function extractClaims(tweets: Tweet[]): ClaimResult {
  const claims: Claim[] = [];

  for (const tweet of tweets) {
    const sentences = tweet.text.split(/[.!?\n]+/).filter((s) => s.trim());

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      const doc = nlp(trimmed);
      const hasProperNoun =
        doc.people().length > 0 || doc.organizations().length > 0;

      // Check for statistics
      if (STAT_PATTERN.test(trimmed) || SUSPICIOUS_STAT.test(trimmed)) {
        // Check if source is provided
        const hasSource =
          /\(.*source.*\)/i.test(trimmed) ||
          /https?:\/\//.test(trimmed) ||
          /according to [A-Z][a-z]+ [A-Z]/i.test(trimmed) ||
          hasProperNoun;
        claims.push({
          tweetId: tweet.id,
          tweetPosition: tweet.position,
          claim: trimmed,
          type: "Statistic",
          hasSource,
        });
        continue;
      }

      // Check for expert claims
      for (const pattern of EXPERT_PATTERNS) {
        if (pattern.test(trimmed)) {
          const hasSource =
            /https?:\/\//.test(trimmed) ||
            /according to [A-Z][a-z]+ [A-Z]/i.test(trimmed);
          claims.push({
            tweetId: tweet.id,
            tweetPosition: tweet.position,
            claim: trimmed,
            type: "Expert claim",
            hasSource,
          });
          break;
        }
      }

      // Check for generalizations
      for (const pattern of GENERALIZATION_PATTERNS) {
        if (pattern.test(trimmed)) {
          claims.push({
            tweetId: tweet.id,
            tweetPosition: tweet.position,
            claim: trimmed,
            type: "Generalisation",
            hasSource: false,
          });
          break;
        }
      }
    }
  }

  return { claims };
}

// ─── 4. STRUCTURAL PATTERN DETECTOR ────────────────────────────────────────────

const HYPE_OPENER_PATTERNS = [
  /nobody talks about/i,
  /thread 🧵/i,
  /changed my life/i,
  /you need to know/i,
  /here['']?s what/i,
  /read this before/i,
  /a thread/i,
];

const ENGAGEMENT_BAIT_PATTERNS = [
  /follow (me )?for more/i,
  /RT if/i,
  /like if you/i,
  /retweet (this|the)/i,
  /share (this|with)/i,
];

const EMPTY_CLOSER_PATTERNS = [
  /hope this helped/i,
  /found this useful/i,
  /share this/i,
  /that['']?s a wrap/i,
  /future self will thank/i,
  /follow me/i,
];

const NUMBERED_PADDING = /^(\d{1,2}[\.\):]|\bpoint \d)/i;

const FAKE_EXCLUSIVITY_PATTERNS = [
  /I learned this the hard way/i,
  /nobody told me/i,
  /they don['']?t want you to know/i,
  /nobody talks about/i,
  /secret/i,
];

export function detectPatterns(tweets: Tweet[]): StructuralResult {
  const patterns: PatternResult[] = [];

  for (const tweet of tweets) {
    const found: PatternType[] = [];
    const text = tweet.text;
    const wordCount = text.split(/\s+/).length;

    // HYPE_OPENER: only check first tweet
    if (tweet.position === 1) {
      for (const pat of HYPE_OPENER_PATTERNS) {
        if (pat.test(text)) {
          found.push("HYPE_OPENER");
          break;
        }
      }
    }

    // ENGAGEMENT_BAIT
    for (const pat of ENGAGEMENT_BAIT_PATTERNS) {
      if (pat.test(text)) {
        found.push("ENGAGEMENT_BAIT");
        break;
      }
    }

    // EMPTY_CLOSER: only check last 2 tweets
    const maxPos = Math.max(...tweets.map((t) => t.position));
    if (tweet.position >= maxPos - 1) {
      for (const pat of EMPTY_CLOSER_PATTERNS) {
        if (pat.test(text)) {
          found.push("EMPTY_CLOSER");
          break;
        }
      }
    }

    // NUMBERED_PADDING
    if (NUMBERED_PADDING.test(text) && wordCount < 8) {
      found.push("NUMBERED_PADDING");
    }

    // FAKE_EXCLUSIVITY
    for (const pat of FAKE_EXCLUSIVITY_PATTERNS) {
      if (pat.test(text)) {
        found.push("FAKE_EXCLUSIVITY");
        break;
      }
    }

    if (found.length > 0) {
      patterns.push({
        tweetId: tweet.id,
        tweetPosition: tweet.position,
        patterns: found,
      });
    }
  }

  return { patterns };
}

// ─── 5. COMPRESSION ENGINE ─────────────────────────────────────────────────────

function sentenceDensity(sentence: string): number {
  const concrete = countConcreteTokens(sentence);
  const filler = countFillerWords(sentence);
  return concrete * 15 - filler * 10;
}

export function compress(
  tweets: Tweet[],
  density: DensityResult[],
  repetition: RepetitionResult,
  structural: StructuralResult,
): CompressionResult {
  const densityMap = new Map(density.map((d) => [d.tweetId, d]));
  const duplicateIndices = new Set<number>();
  for (const cluster of repetition.clusters) {
    // Keep first, mark rest as duplicate
    for (let i = 1; i < cluster.length; i++) {
      duplicateIndices.add(cluster[i]);
    }
  }

  const slopPatternTweets = new Set(
    structural.patterns
      .filter((p) =>
        p.patterns.some(
          (pat) =>
            pat === "HYPE_OPENER" ||
            pat === "EMPTY_CLOSER" ||
            pat === "ENGAGEMENT_BAIT" ||
            pat === "NUMBERED_PADDING",
        ),
      )
      .map((p) => p.tweetId),
  );

  const keptTweets: Tweet[] = [];

  for (let i = 0; i < tweets.length; i++) {
    const tweet = tweets[i];
    const d = densityMap.get(tweet.id);
    // Filter out low density
    if (d && d.score < 40) continue;
    // Filter out duplicates (keep first)
    if (duplicateIndices.has(i)) continue;
    // Filter out structural slop
    if (slopPatternTweets.has(tweet.id)) continue;

    keptTweets.push(tweet);
  }

  // Extract the most informative sentence from each kept tweet
  const summary: string[] = [];
  const seenSentences = new Set<string>();

  for (const tweet of keptTweets) {
    const sentences = tweet.text
      .split(/[.!?\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);

    if (sentences.length === 0) continue;

    // Pick the sentence with highest density
    let bestSentence = sentences[0];
    let bestScore = sentenceDensity(sentences[0]);

    for (let i = 1; i < sentences.length; i++) {
      const score = sentenceDensity(sentences[i]);
      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentences[i];
      }
    }

    const normalized = bestSentence.toLowerCase().trim();
    if (!seenSentences.has(normalized)) {
      seenSentences.add(normalized);
      summary.push(bestSentence);
    }
  }

  const compressionRatio =
    tweets.length > 0
      ? Math.round(((tweets.length - summary.length) / tweets.length) * 100)
      : 0;

  return {
    summary,
    originalTweetCount: tweets.length,
    keptTweetCount: summary.length,
    compressionRatio,
  };
}

// ─── SCORING ────────────────────────────────────────────────────────────────────

function getSlopLabel(score: number): SlopScore["label"] {
  if (score <= 30) return "Mostly Legit";
  if (score <= 55) return "Somewhat Sloppy";
  if (score <= 75) return "Heavy Slop";
  return "Pure Slop";
}

export function calculateSlopScore(
  tweets: Tweet[],
  density: DensityResult[],
  repetition: RepetitionResult,
  claims: ClaimResult,
  structural: StructuralResult,
): SlopScore {
  let score = 0;
  const breakdown = {
    lowDensityPenalty: 0,
    repetitionPenalty: 0,
    claimsPenalty: 0,
    structuralPenalty: 0,
    paddingPenalty: 0,
  };

  // +30 if more than 40% tweets are low density
  const lowDensityCount = density.filter((d) => d.score < 40).length;
  if (lowDensityCount / tweets.length > 0.4) {
    breakdown.lowDensityPenalty = 30;
    score += 30;
  }

  // +20 if repetition clusters cover more than 30% of tweets
  const repeatedTweetCount = new Set(repetition.clusters.flat()).size;
  if (repeatedTweetCount / tweets.length > 0.3) {
    breakdown.repetitionPenalty = 20;
    score += 20;
  }

  // +15 if more than 2 unverified claims
  const unverifiedClaims = claims.claims.filter((c) => !c.hasSource);
  if (unverifiedClaims.length > 2) {
    breakdown.claimsPenalty = 15;
    score += 15;
  }

  // +20 if hype opener + empty closer both detected
  const hasHypeOpener = structural.patterns.some((p) =>
    p.patterns.includes("HYPE_OPENER"),
  );
  const hasEmptyCloser = structural.patterns.some((p) =>
    p.patterns.includes("EMPTY_CLOSER"),
  );
  if (hasHypeOpener && hasEmptyCloser) {
    breakdown.structuralPenalty = 20;
    score += 20;
  }

  // +15 if more than 3 numbered padding tweets
  const paddingCount = structural.patterns.filter((p) =>
    p.patterns.includes("NUMBERED_PADDING"),
  ).length;
  if (paddingCount > 3) {
    breakdown.paddingPenalty = 15;
    score += 15;
  }

  score = Math.min(100, score);

  return {
    score,
    label: getSlopLabel(score),
    breakdown,
  };
}

export function calculateTimeMetrics(
  tweets: Tweet[],
  density: DensityResult[],
): TimeMetrics {
  const totalWords = tweets.reduce(
    (sum, t) => sum + t.text.split(/\s+/).length,
    0,
  );
  const readingTimeSec = Math.round((totalWords / 238) * 60);

  const densityMap = new Map(density.map((d) => [d.tweetId, d]));
  const infoWords = tweets
    .filter((t) => (densityMap.get(t.id)?.score ?? 0) > 60)
    .reduce((sum, t) => sum + t.text.split(/\s+/).length, 0);
  const actualInfoTimeSec = Math.round((infoWords / 238) * 60);

  return {
    readingTimeSec,
    actualInfoTimeSec,
    timeWastedSec: readingTimeSec - actualInfoTimeSec,
  };
}

// ─── FULL ANALYSIS ──────────────────────────────────────────────────────────────

export function runFullAnalysis(thread: ThreadData): AnalysisResult {
  const { tweets } = thread;
  const density = analyzeDensity(tweets);
  const repetition = analyzeRepetition(tweets);
  const claims = extractClaims(tweets);
  const structural = detectPatterns(tweets);
  const compression = compress(tweets, density, repetition, structural);
  const slopScore = calculateSlopScore(
    tweets,
    density,
    repetition,
    claims,
    structural,
  );
  const timeMetrics = calculateTimeMetrics(tweets, density);
  const claimMatch = matchClaims(claims.claims);

  return {
    density,
    repetition,
    claims,
    structural,
    compression,
    slopScore,
    timeMetrics,
    thread,
    claimMatch,
  };
}
