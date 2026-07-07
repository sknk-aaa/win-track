import type { CounterSummary, MatchResult, ResultNotation } from '../types';

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function formatWinRate(wins: number, losses: number) {
  const total = wins + losses;
  if (total === 0) {
    return '--%';
  }
  return `${((wins / total) * 100).toFixed(1)}%`;
}

export function formatShortDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function formatFullDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function resultLabel(result: MatchResult, notation: ResultNotation = 'jp') {
  if (notation === 'wl') {
    return result === 'win' ? 'W' : 'L';
  }
  return result === 'win' ? '勝' : '負';
}

export function resultLongLabel(result: MatchResult, notation: ResultNotation = 'jp') {
  if (notation === 'wl') {
    return result === 'win' ? 'W' : 'L';
  }
  return result === 'win' ? '勝ち' : '負け';
}

export function formatResultCounts(wins: number, losses: number, notation: ResultNotation = 'jp') {
  if (notation === 'wl') {
    return `${wins}W / ${losses}L`;
  }
  return `${wins}勝 / ${losses}負`;
}

export function summarizeTopLine(counters: CounterSummary[]) {
  const wins = counters.reduce((sum, counter) => sum + counter.wins, 0);
  const losses = counters.reduce((sum, counter) => sum + counter.losses, 0);
  return {
    wins,
    losses,
    total: wins + losses,
    winRateLabel: formatWinRate(wins, losses)
  };
}
