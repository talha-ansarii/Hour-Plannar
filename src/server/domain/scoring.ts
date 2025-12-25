export function computeDailyScore(input: {
  totalEstimatedMinutes: number;
  completedEstimatedMinutes: number;
  completedCount: number;
}) {
  const total = Math.max(0, Math.floor(input.totalEstimatedMinutes));
  const done = Math.max(0, Math.floor(input.completedEstimatedMinutes));

  if (total === 0) {
    return input.completedCount > 0 ? 80 : 0;
  }

  const pct = Math.round((done / total) * 100);
  return Math.max(0, Math.min(100, pct));
}


