type CacheEntry<T> = {
  data: T;
  ts: number;
};

const inFlight = new Map<string, Promise<any>>();
const resolvedCache = new Map<string, CacheEntry<any>>();

const buildKey = (url: string, token?: string | null) =>
  `GET:${url}:auth:${token || ''}`;

export async function fetchJsonGetDedup<T = any>(
  url: string,
  token?: string | null,
  ttlMs = 0
): Promise<T> {
  const key = buildKey(url, token);
  const now = Date.now();

  if (ttlMs > 0) {
    const cached = resolvedCache.get(key);
    if (cached && now - cached.ts < ttlMs) {
      return cached.data as T;
    }
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const requestPromise = fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
    .then(async (response) => {
      const data = await response.json();
      if (ttlMs > 0) {
        resolvedCache.set(key, { data, ts: Date.now() });
      }
      return data as T;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, requestPromise);
  return requestPromise;
}

export function invalidateGetDedup(url: string, token?: string | null): void {
  resolvedCache.delete(buildKey(url, token));
}
