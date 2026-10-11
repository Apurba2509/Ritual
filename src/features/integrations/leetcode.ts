import { Platform } from 'react-native';
import type { DayKey } from '@/domain/dates';

/**
 * LeetCode → "Solve a problem".
 * Uses LeetCode's public GraphQL submission calendar (UTC days → submission counts).
 * The endpoint isn't CORS-enabled, so this works in the mobile app only.
 */

export const leetcodeSupported = Platform.OS !== 'web';

export async function fetchLeetcodeDaily(username: string): Promise<Record<DayKey, number>> {
  if (!leetcodeSupported) throw new Error('LeetCode sync runs in the mobile app.');
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com' },
    body: JSON.stringify({
      query: 'query($u:String!){matchedUser(username:$u){username userCalendar{submissionCalendar}}}',
      variables: { u: username.trim() },
    }),
  });
  if (!res.ok) throw new Error(`LeetCode responded ${res.status}`);
  const json = await res.json();
  const user = json?.data?.matchedUser;
  if (!user) throw new Error(`LeetCode user "${username}" not found.`);
  const calendar: Record<string, number> = JSON.parse(user.userCalendar?.submissionCalendar ?? '{}');
  const out: Record<DayKey, number> = {};
  for (const [ts, count] of Object.entries(calendar)) {
    // Keys are UTC midnights.
    const day = new Date(Number(ts) * 1000).toISOString().slice(0, 10);
    out[day] = (out[day] ?? 0) + count;
  }
  return out;
}
