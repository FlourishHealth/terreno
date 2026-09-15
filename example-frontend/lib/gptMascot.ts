export const GPT_MASCOT_COUNT = 4;

export const selectGptMascotIndex = (randomValue: number): number => {
  if (randomValue < 0 || randomValue >= 1) {
    return 0;
  }
  return Math.floor(randomValue * GPT_MASCOT_COUNT);
};
