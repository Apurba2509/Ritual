import { Platform } from 'react-native';
import { addDays, DayKey, dayKeyFromTimestamp, todayKey } from '@/domain/dates';

/**
 * GitHub → "Code every day".
 * Native: parses the public contributions calendar (a full year of commits, PRs, issues
 * and reviews). Web: the calendar page isn't CORS-enabled, so we fall back to the public
 * events API (last ~90 days of pushes).
 */

const USER_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isValidGithubUsername(u: string) {
  return USER_RE.test(u.trim());
}

async function fromCalendar(username: string): Promise<Record<DayKey, number>> {
  const res = await fetch(`https://github.com/users/${encodeURIComponent(username)}/contributions`, {
    headers: { Accept: 'text/html' },
  });
  if (res.status === 404) throw new Error(`GitHub user "${username}" not found.`);
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  const html = await res.text();

  const dateById = new Map<string, string>();
  for (const m of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[^>]*?id="([^"]+)"/g)) dateById.set(m[2], m[1]);
  for (const m of html.matchAll(/id="([^"]+)"[^>]*?data-date="(\d{4}-\d{2}-\d{2})"/g)) dateById.set(m[1], m[2]);

  const out: Record<DayKey, number> = {};
  for (const m of html.matchAll(/<tool-tip[^>]*?for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const date = dateById.get(m[1]);
    if (!date) continue;
    const n = m[2].match(/^(\d+) contributions? on/);
    if (n) out[date] = parseInt(n[1], 10);
  }
  if (dateById.size === 0) throw new Error('Could not read the GitHub contribution calendar.');
  return out;
}

async function fromEvents(username: string): Promise<Record<DayKey, number>> {
  const out: Record<DayKey, number> = {};
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100&page=${page}`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );
    if (res.status === 404) throw new Error(`GitHub user "${username}" not found.`);
    if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
    const events: { type: string; created_at: string; payload?: { size?: number } }[] = await res.json();
    for (const e of events) {
      if (!['PushEvent', 'PullRequestEvent', 'CreateEvent', 'PullRequestReviewEvent', 'IssuesEvent'].includes(e.type))
        continue;
      const day = dayKeyFromTimestamp(Date.parse(e.created_at));
      out[day] = (out[day] ?? 0) + (e.type === 'PushEvent' ? Math.max(1, e.payload?.size ?? 1) : 1);
    }
    if (events.length < 100) break;
  }
  return out;
}

export async function fetchGithubDaily(username: string): Promise<Record<DayKey, number>> {
  const u = username.trim();
  const data = Platform.OS === 'web' ? await fromEvents(u) : await fromCalendar(u);
  // Ignore anything in the future (timezone skew) and keep a year.
  const today = todayKey();
  const floor = addDays(today, -366);
  return Object.fromEntries(Object.entries(data).filter(([d, n]) => n > 0 && d <= today && d >= floor));
}
