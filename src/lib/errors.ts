/** Turns Firebase/network errors into something a person can act on. */
export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const code = (err as { code?: string })?.code ?? '';
  const message = err instanceof Error ? err.message : String(err ?? '');
  if (code === 'permission-denied' || /permission|insufficient/i.test(message)) {
    return "That action isn't allowed. If this keeps happening, update the app.";
  }
  if (code === 'unavailable' || /offline|network|failed to fetch/i.test(message)) {
    return "You're offline. We'll retry when you're back online.";
  }
  if (code === 'not-found') return 'That no longer exists.';
  if (code === 'resource-exhausted') return 'Too many requests — try again in a minute.';
  // Our own thrown errors are already human-readable.
  if (!code && message && message.length < 120 && !/evaluation error|firestore/i.test(message)) return message;
  if (__DEV__) console.warn('[error]', err);
  return fallback;
}
