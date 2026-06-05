import { differenceInDays, parseISO, isToday, isYesterday, startOfDay } from 'date-fns';

export function calculateStreak(
  completionsDates: string[],
  gracePeriod: number = 0
): { current: number; longest: number } {
  if (!completionsDates || completionsDates.length === 0) {
    return { current: 0, longest: 0 };
  }

  // Sort descending
  const sorted = [...completionsDates]
    .map(d => startOfDay(parseISO(d)).getTime())
    .sort((a, b) => b - a);
    
  // Deduplicate
  const uniqueDates = Array.from(new Set(sorted));

  let current = 0;
  let longest = 0;
  let currentRun = 0;
  let skipsUsed = 0;

  const today = startOfDay(new Date()).getTime();

  // Initialize
  let previousDate = today;
  let isCurrentRun = true;

  // Check if today or yesterday has a completion to even start a current streak
  if (uniqueDates.length > 0) {
    const mostRecent = uniqueDates[0];
    if (mostRecent !== today && mostRecent !== today - 86400000) {
      // The most recent completion was before yesterday, so current streak is 0
      isCurrentRun = false;
    }
  }

  for (let i = 0; i < uniqueDates.length; i++) {
    const date = uniqueDates[i];
    
    if (i === 0) {
      currentRun = 1;
      if (isCurrentRun) current = 1;
      longest = 1;
      previousDate = date;
      continue;
    }

    const diffDays = Math.round((previousDate - date) / 86400000);

    if (diffDays === 1) {
      currentRun++;
      if (isCurrentRun) current = currentRun;
    } else if (diffDays > 1 && skipsUsed + (diffDays - 1) <= gracePeriod) {
      // Used grace skips
      skipsUsed += (diffDays - 1);
      currentRun += 1; // don't count skipped days as completed, just continue the run
      if (isCurrentRun) current = currentRun;
    } else {
      // Streak broken
      currentRun = 1; // reset for finding longest
      skipsUsed = 0;
      if (isCurrentRun) {
        isCurrentRun = false; // We broke the current streak
      }
    }

    if (currentRun > longest) {
      longest = currentRun;
    }

    previousDate = date;
  }

  return { current, longest };
}
