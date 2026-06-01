export interface Tweet {
  id: string;
  text: string;
  position: number;
}

export interface ThreadData {
  tweets: Tweet[];
  author: string;
  title: string;
}

export interface DensityResult {
  tweetId: string;
  score: number;
  label: 'Filler' | 'Weak' | 'Decent' | 'Solid';
  concreteCount: number;
  fillerCount: number;
  weaselCount: number;
}

export interface SimilarityPair {
  tweetA: number;
  tweetB: number;
  similarity: number;
}

export interface RepetitionResult {
  similarityMatrix: number[][];
  duplicatePairs: SimilarityPair[];
  clusters: number[][];
}

export interface Claim {
  tweetId: string;
  tweetPosition: number;
  claim: string;
  type: 'Statistic' | 'Expert claim' | 'Generalisation';
  hasSource: boolean;
}

export interface ClaimResult {
  claims: Claim[];
}

export type PatternType =
  | 'HYPE_OPENER'
  | 'ENGAGEMENT_BAIT'
  | 'EMPTY_CLOSER'
  | 'NUMBERED_PADDING'
  | 'FAKE_EXCLUSIVITY';

export interface PatternResult {
  tweetId: string;
  tweetPosition: number;
  patterns: PatternType[];
}

export interface StructuralResult {
  patterns: PatternResult[];
}

export interface CompressionResult {
  summary: string[];
  originalTweetCount: number;
  keptTweetCount: number;
  compressionRatio: number;
}

export interface SlopScore {
  score: number;
  label: 'Mostly Legit' | 'Somewhat Sloppy' | 'Heavy Slop' | 'Pure Slop';
  breakdown: {
    lowDensityPenalty: number;
    repetitionPenalty: number;
    claimsPenalty: number;
    structuralPenalty: number;
    paddingPenalty: number;
  };
}

export interface TimeMetrics {
  readingTimeSec: number;
  actualInfoTimeSec: number;
  timeWastedSec: number;
}

export interface AnalysisResult {
  density: DensityResult[];
  repetition: RepetitionResult;
  claims: ClaimResult;
  structural: StructuralResult;
  compression: CompressionResult;
  slopScore: SlopScore;
  timeMetrics: TimeMetrics;
  thread: ThreadData;
  claimMatch: ClaimMatchAnalysis;
}

// ─── CLAIM MATCHING TYPES ───────────────────────────────────────────────────────

export type MutationType = 'copy' | 'rephrase' | 'mutation' | 'novel';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ClaimCategory = 'productivity' | 'health' | 'finance' | 'science' | 'technology' | 'social';

export interface KnownClaim {
  id: string;
  canonical: string;
  variants: string[];
  category: ClaimCategory;
  verdict: 'false' | 'misleading' | 'partially-false' | 'unverified';
  source: string;
  campaign?: string;
}

export interface ClaimMatchSignals {
  textSimilarity: number;
  keyPhrasesPreserved: string[];
  categoryMatch: boolean;
}

export interface ClaimMatchResult {
  extractedClaim: Claim;
  matchType: MutationType;
  confidence: number;
  matchedClaim?: KnownClaim;
  signals: ClaimMatchSignals;
}

export interface NetworkSignals {
  matchedCount: number;
  highestSimilarity: number;
  campaignDetected?: string;
  mutationChainDetected: boolean;
  categoriesMatched: ClaimCategory[];
}

export interface ClaimMatchAnalysis {
  matches: ClaimMatchResult[];
  overallRisk: RiskLevel;
  riskScore: number;
  networkSignals: NetworkSignals;
}
