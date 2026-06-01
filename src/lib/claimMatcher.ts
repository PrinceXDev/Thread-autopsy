import natural from 'natural';
import type {
  Claim,
  ClaimMatchResult,
  ClaimMatchAnalysis,
  MutationType,
  RiskLevel,
  ClaimCategory,
} from './types';
import { KNOWN_CLAIMS } from './knownClaims';

const tokenizer = new natural.WordTokenizer();

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'not', 'no', 'nor',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
  'we', 'they', 'what', 'which', 'who', 'all', 'any', 'each', 'just',
  'more', 'most', 'also', 'into', 'than', 'then', 'so', 'if', 'as',
  'get', 'got', 'let', 'make', 'made', 'take', 'put', 'set', 'use', 'used',
  'never', 'ever', 'still', 'even', 'same', 'every', 'always',
]);

function tokenize(text: string): string[] {
  return tokenizer
    .tokenize(text.toLowerCase())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && /^[a-z0-9]+$/.test(w));
}

// ─── CORPUS IDF ──────────────────────────────────────────────────────────────
// Built lazily from the known-claims database.
// Words that appear in many claims (e.g. "people", "success") get low weight.
// Claim-specific words (e.g. "testosterone", "autism", "21", "habit") get high weight.

let _idf: Map<string, number> | null = null;
let _corpusN = 0;

function getIdf(): Map<string, number> {
  if (_idf) return _idf;

  const allTexts = KNOWN_CLAIMS.flatMap((c) => [c.canonical, ...c.variants]);
  _corpusN = allTexts.length;

  const docFreq = new Map<string, number>();
  for (const text of allTexts) {
    const unique = new Set(tokenize(text));
    for (const token of unique) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }

  _idf = new Map<string, number>();
  for (const [term, df] of docFreq) {
    // Smoothed IDF so no term has zero weight
    _idf.set(term, Math.log((_corpusN + 1) / (df + 1)) + 1);
  }
  return _idf;
}

function toTfIdfVector(tokens: string[]): Map<string, number> {
  const idf = getIdf();
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  const len = tokens.length || 1;
  const vec = new Map<string, number>();
  for (const [term, count] of tf) {
    // Terms not in corpus get a high IDF (they are maximally distinctive)
    const w = idf.get(term) ?? (Math.log((_corpusN + 1) / 1) + 1);
    vec.set(term, (count / len) * w);
  }
  return vec;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, magA = 0, magB = 0;
  const allKeys = new Set([...Array.from(a.keys()), ...Array.from(b.keys())]);
  for (const key of allKeys) {
    const va = a.get(key) ?? 0;
    const vb = b.get(key) ?? 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── ANCHOR DETECTION ────────────────────────────────────────────────────────
// Numbers, percentages and time-units are the true fingerprints of a claim.
// "90% of day traders" or "21 days" survives rephrasing; vocabulary may not.
// Shared anchors boost the final similarity score.

function extractAnchors(text: string): Set<string> {
  const anchors = new Set<string>();
  for (const m of text.matchAll(/\d+(?:\.\d+)?%/g))
    anchors.add(m[0]);
  for (const m of text.matchAll(/\d+(?:,\d+)*(?:\.\d+)?\s*(?:days?|hours?|weeks?|months?|years?)/gi))
    anchors.add(m[0].toLowerCase().replace(/\s+/g, ' ').trim());
  for (const m of text.matchAll(/\d{1,3}(?:,\d{3})+/g))
    anchors.add(m[0]);
  return anchors;
}

function anchorBoost(claimText: string, knownTexts: string[]): number {
  const claimAnchors = extractAnchors(claimText);
  if (claimAnchors.size === 0) return 0;
  const knownAll = new Set(knownTexts.flatMap((t) => Array.from(extractAnchors(t))));
  let shared = 0;
  for (const a of claimAnchors) {
    if (knownAll.has(a)) shared++;
  }
  // Each shared anchor contributes up to +0.18; capped at +0.30
  return Math.min(shared * 0.18, 0.30);
}

// ─── MINIMUM OVERLAP GUARD ───────────────────────────────────────────────────
// Prevents a single shared word from triggering a match.
// At least 2 meaningful (non-stop) content tokens must overlap.

function contentOverlap(tokensA: string[], textB: string): number {
  const setB = new Set(tokenize(textB));
  return tokensA.filter((t) => setB.has(t)).length;
}

// ─── THRESHOLDS (calibrated for TF-IDF cosine similarity) ───────────────────
// With IDF weighting, genuine semantic matches score ~0.45–0.75.
// Unrelated-but-vocabulary-adjacent texts score ~0.10–0.30.

function getMutationType(sim: number): MutationType {
  if (sim >= 0.72) return 'copy';
  if (sim >= 0.48) return 'rephrase';
  if (sim >= 0.34) return 'mutation';
  return 'novel';
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export function matchClaims(claims: Claim[]): ClaimMatchAnalysis {
  const matches: ClaimMatchResult[] = [];

  for (const claim of claims) {
    const claimTokens = tokenize(claim.claim);

    // Need at least 3 meaningful content words to form a reliable vector
    if (claimTokens.length < 3) {
      matches.push({
        extractedClaim: claim,
        matchType: 'novel',
        confidence: 0,
        signals: { textSimilarity: 0, keyPhrasesPreserved: [], categoryMatch: false },
      });
      continue;
    }

    const claimVec = toTfIdfVector(claimTokens);
    let bestRawSim = 0;
    let bestAdjustedSim = 0;
    let bestKnown = KNOWN_CLAIMS[0];

    for (const known of KNOWN_CLAIMS) {
      const textsToCheck = [known.canonical, ...known.variants];

      for (const text of textsToCheck) {
        // Hard gate: skip if fewer than 2 content words overlap
        if (contentOverlap(claimTokens, text) < 2) continue;

        const rawSim = cosineSimilarity(claimVec, toTfIdfVector(tokenize(text)));
        const boost = anchorBoost(claim.claim, textsToCheck);
        const adjusted = Math.min(rawSim + boost, 1.0);

        if (adjusted > bestAdjustedSim) {
          bestAdjustedSim = adjusted;
          bestRawSim = rawSim;
          bestKnown = known;
        }
      }
    }

    const matchType = getMutationType(bestAdjustedSim);

    // Key phrases preserved: numeric anchors shared between the extracted claim
    // and the best-matching known claim
    const claimAnchors = extractAnchors(claim.claim);
    const knownAnchors = extractAnchors(
      [bestKnown.canonical, ...bestKnown.variants].join(' '),
    );
    const preserved = Array.from(claimAnchors).filter((a) => knownAnchors.has(a));

    matches.push({
      extractedClaim: claim,
      matchType,
      confidence: Math.round(bestAdjustedSim * 100) / 100,
      matchedClaim: matchType !== 'novel' ? bestKnown : undefined,
      signals: {
        textSimilarity: Math.round(bestRawSim * 100) / 100,
        keyPhrasesPreserved: preserved,
        categoryMatch: matchType !== 'novel',
      },
    });
  }

  // ─── Network signals ────────────────────────────────────────────────────────
  const flagged = matches.filter((m) => m.matchType !== 'novel');
  const highestSimilarity =
    flagged.length > 0 ? Math.max(...flagged.map((m) => m.confidence)) : 0;

  const campaignCounts = new Map<string, number>();
  for (const m of flagged) {
    const c = m.matchedClaim?.campaign;
    if (c) campaignCounts.set(c, (campaignCounts.get(c) ?? 0) + 1);
  }
  let campaignDetected: string | undefined;
  let maxCount = 0;
  for (const [campaign, count] of campaignCounts) {
    if (count > maxCount) {
      maxCount = count;
      campaignDetected = campaign;
    }
  }

  const categoriesMatched = [
    ...new Set(flagged.map((m) => m.matchedClaim?.category).filter(Boolean)),
  ] as ClaimCategory[];

  const hasCopyOrRephrase = flagged.some(
    (m) => m.matchType === 'copy' || m.matchType === 'rephrase',
  );
  const hasMutation = flagged.some((m) => m.matchType === 'mutation');
  const mutationChainDetected = hasCopyOrRephrase && hasMutation && !!campaignDetected;

  const copyCount = flagged.filter((m) => m.matchType === 'copy').length;
  const rephraseCount = flagged.filter((m) => m.matchType === 'rephrase').length;
  const mutationCount = flagged.filter((m) => m.matchType === 'mutation').length;
  let riskScore = copyCount * 40 + rephraseCount * 25 + mutationCount * 12;
  if (mutationChainDetected) riskScore += 15;
  riskScore = Math.min(100, riskScore);

  const overallRisk: RiskLevel =
    riskScore >= 70 ? 'critical' :
    riskScore >= 40 ? 'high' :
    riskScore >= 15 ? 'medium' : 'low';

  return {
    matches,
    overallRisk,
    riskScore,
    networkSignals: {
      matchedCount: flagged.length,
      highestSimilarity,
      campaignDetected,
      mutationChainDetected,
      categoriesMatched,
    },
  };
}
