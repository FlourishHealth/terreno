export const summarizeSkippedReasons = (skipped: Array<{id: string; reason: string}>): string => {
  if (skipped.length === 0) {
    return "none skipped";
  }
  const counts = new Map<string, number>();
  for (const row of skipped) {
    counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1);
  }
  return [...counts.entries()].map(([reason, count]) => `${count}× ${reason}`).join("; ");
};
