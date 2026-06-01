import type { AnalysisResult } from './types';

const HISTORY_KEY = 'threadAutopsyHistory';
const MAX_ENTRIES = 20;

export interface HistoryEntry {
  id: string;
  savedAt: string;
  threadTitle: string;
  threadAuthor: string;
  tweetCount: number;
  slopScore: number;
  slopLabel: string;
  compressionRatio: number;
  claimMatchRisk: string;
  result: AnalysisResult;
}

export function saveToHistory(result: AnalysisResult): void {
  if (typeof window === 'undefined') return;

  const existing = loadHistory();

  // Skip duplicate: same title + author saved within the last 60 seconds
  const isDuplicate = existing.some(
    (e) =>
      e.threadTitle === result.thread.title &&
      e.threadAuthor === result.thread.author &&
      Date.now() - new Date(e.savedAt).getTime() < 60_000,
  );
  if (isDuplicate) return;

  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
    threadTitle: result.thread.title,
    threadAuthor: result.thread.author,
    tweetCount: result.thread.tweets.length,
    slopScore: result.slopScore.score,
    slopLabel: result.slopScore.label,
    compressionRatio: result.compression.compressionRatio,
    claimMatchRisk: result.claimMatch?.overallRisk ?? 'low',
    result,
  };

  const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // localStorage quota exceeded — trim aggressively and retry
    const trimmed = [entry, ...existing].slice(0, 5);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch {
      // give up silently
    }
  }
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function deleteHistoryEntry(id: string): HistoryEntry[] {
  const updated = loadHistory().filter((e) => e.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
