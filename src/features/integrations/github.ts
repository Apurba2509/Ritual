import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { addDays, DayKey, dayKeyFromTimestamp, todayKey } from '@/domain/dates';

/**
 * GitHub → "Code every day".
 *
 * Sources, most reliable first:
 *  1. GraphQL API with a personal access token (official, stable, can include private work).
 *  2. Native: the public contributions calendar page (a full year, no token needed). This parses
 *     HTML, so if GitHub changes its markup we fall back to (3) instead of failing.
 *  3. The public events API (last ~90 days of activity; also the web build's default, since the
 *     calendar page isn't CORS-enabled).
 */

const USER_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const TOKEN_KEY = 'ritual.github.token';
const canStoreToken = Platform.OS !== 'web';

export function isValidGithubUsername(u: string) {
  return USER_RE.test(u.trim());
}

// ─── Token (stored in the Android Keystore via SecureStore; never synced) ───

export const githubTokenSupported = canStoreToken;

export async function getGithubToken(): Promise<string | null> {
  if (!canStoreToken) return null;
  return SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
}

export async function setGithubToken(token: string | null): Promise<void> {
  if (!canStoreToken) return;
  if (token?.trim()) await SecureStore.setItemAsync(TOKEN_KEY, token.trim());
  else await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
}

// ─── Sources ────────────────────────────────────────────────────────────────

async function fromGraphQL(username: string, token: string): Promise<Record<DayKey, number>> {
  const to = new Date();
  const from = new Date(to.getTime() - 365 * 86_400_000);
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar { weeks { contributionDays { date contributionCount } } }
          }
        }
      }`,
      variables: { login: username, from: from.toISOString(), to: to.toISOString() },
    }),
  });
  if (res.status === 401) throw new GithubTokenError('Your GitHub token was rejected. Create a new one or remove it.');
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      user: {
        contributionsCollection: {
          contributionCalendar: { weeks: { contributionDays: { date: string; contributionCount: number }[] }[] };
        };
      } | null;
    };
    errors?: { message: string }[];
  };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data?.user) throw new Error(`GitHub user "${username}" not found.`);
  const out: Record<DayKey, number> = {};
  for (const w of json.data.user.contributionsCollection.contributionCalendar.weeks)
    for (const d of w.contributionDays) if (d.contributionCount > 0) out[d.date] = d.contributionCount;
  return out;
}

export class GithubTokenError extends Error {}

async function fromCalendar(username: string): Promise<Record<DayKey, number> | null> {
  const res = await fetch(`https://github.com/users/${encodeURIComponent(username)}/contributions`, {
    headers: { Accept: 'text/html' },
  });
  if (res.status === 404) throw new Error(`GitHub user "${username}" not found.`);
  if (!res.ok) return null;
  const html = await res.text();

  const dateById = new Map<string, string>();
  for (const m of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[^>]*?id="([^"]+)"/g)) dateById.set(m[2], m[1]);
  for (const m of html.matchAll(/id="([^"]+)"[^>]*?data-date="(\d{4}-\d{2}-\d{2})"/g)) dateById.set(m[1], m[2]);
  // Markup changed: let the caller fall back to the API instead of failing.
  if (dateById.size === 0) return null;

  const out: Record<DayKey, number> = {};
  for (const m of html.matchAll(/<tool-tip[^>]*?for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const date = dateById.get(m[1]);
    if (!date) continue;
    const n = m[2].match(/^(\d+) contributions? on/);
    if (n) out[date] = parseInt(n[1], 10);
  }
  // Older markup put the count on the cell itself.
  if (Object.keys(out).length === 0) {
    for (const m of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[^>]*?data-count="(\d+)"/g)) {
      if (+m[2] > 0) out[m[1]] = +m[2];
    }
  }
  return out;
}

async function fromEvents(username: string, token: string | null): Promise<Record<DayKey, number>> {
  const out: Record<DayKey, number> = {};
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100&page=${page}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    );
    if (res.status === 404) throw new Error(`GitHub user "${username}" not found.`);
    if (res.status === 403) throw new Error('GitHub rate limit reached. Add a token for reliable syncing.');
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
  const token = await getGithubToken();
  let data: Record<DayKey, number> | null = null;
  if (token) data = await fromGraphQL(u, token);
  if (!data && Platform.OS !== 'web')
    data = await fromCalendar(u).catch((e) => {
      if (e instanceof Error && /not found/.test(e.message)) throw e;
      return null;
    });
  if (!data) data = await fromEvents(u, token);
  // Ignore anything in the future (timezone skew) and keep a year.
  const today = todayKey();
  const floor = addDays(today, -366);
  return Object.fromEntries(Object.entries(data).filter(([d, n]) => n > 0 && d <= today && d >= floor));
}
