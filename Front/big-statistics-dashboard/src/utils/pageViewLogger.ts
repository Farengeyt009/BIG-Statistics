const inFlight = new Set<string>();
const recentlySent = new Map<string, number>();
const RECENT_TTL_MS = 5000;

const buildKey = (pageKey: string, token: string) => `${pageKey}::${token}`;

export const logPageViewDedup = (pageKey: string, token: string): void => {
  if (!pageKey || !token) return;

  const key = buildKey(pageKey, token);
  const now = Date.now();
  const lastSentAt = recentlySent.get(key);

  // Avoid immediate repeats from StrictMode/double mounts.
  if (lastSentAt && now - lastSentAt < RECENT_TTL_MS) return;
  if (inFlight.has(key)) return;

  inFlight.add(key);

  fetch('/api/auth/log-page-view', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ page_key: pageKey }),
  })
    .then(() => {
      recentlySent.set(key, Date.now());
    })
    .catch((err) => {
      // Logging failures must not affect app behavior.
      console.log('Page view logging failed:', err);
    })
    .finally(() => {
      inFlight.delete(key);
    });
};

