type ApiPerfStat = {
  count: number;
  totalMs: number;
  maxMs: number;
  slowCount: number;
  errorCount: number;
  lastStatus: number | null;
  lastMs: number;
};

type ApiPerfSnapshot = Record<string, ApiPerfStat>;

type ApiPerfGlobal = {
  enabled: boolean;
  slowThresholdMs: number;
  reset: () => void;
  snapshot: () => ApiPerfSnapshot;
};

declare global {
  interface Window {
    __apiPerf?: ApiPerfGlobal;
    __apiFetchMonitorInstalled?: boolean;
  }
}

const DEFAULT_SLOW_THRESHOLD_MS = 600;

const normalizeUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const getMethod = (input: RequestInfo | URL, init?: RequestInit): string => {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== 'string' && !(input instanceof URL) && input.method) {
    return input.method.toUpperCase();
  }
  return 'GET';
};

const getSlowThreshold = (): number => {
  const raw = localStorage.getItem('apiPerfSlowMs');
  if (!raw) return DEFAULT_SLOW_THRESHOLD_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SLOW_THRESHOLD_MS;
};

export const installFetchMonitor = () => {
  if (!import.meta.env.DEV) return;
  if (typeof window === 'undefined') return;
  if (window.__apiFetchMonitorInstalled) return;

  window.__apiFetchMonitorInstalled = true;

  const originalFetch = window.fetch.bind(window);
  const stats = new Map<string, ApiPerfStat>();
  const inFlight = new Map<string, number>();
  const slowThresholdMs = getSlowThreshold();

  const snapshot = (): ApiPerfSnapshot =>
    Array.from(stats.entries()).reduce<ApiPerfSnapshot>((acc, [key, value]) => {
      acc[key] = { ...value };
      return acc;
    }, {});

  window.__apiPerf = {
    enabled: true,
    slowThresholdMs,
    reset: () => {
      stats.clear();
      inFlight.clear();
    },
    snapshot,
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = getMethod(input, init);
    const url = normalizeUrl(input);
    const key = `${method} ${url}`;

    const alreadyInFlight = inFlight.get(key) || 0;
    inFlight.set(key, alreadyInFlight + 1);

    if (alreadyInFlight > 0) {
      console.warn(`[API DUPLICATE] ${key} already in-flight x${alreadyInFlight + 1}`);
    }

    const started = performance.now();
    let status: number | null = null;
    let hadError = false;

    try {
      const response = await originalFetch(input, init);
      status = response.status;
      if (!response.ok) {
        console.warn(`[API ERROR] ${key} status=${response.status}`);
      }
      return response;
    } catch (error) {
      hadError = true;
      console.warn(`[API ERROR] ${key}`, error);
      throw error;
    } finally {
      const ms = performance.now() - started;

      const prev = stats.get(key) || {
        count: 0,
        totalMs: 0,
        maxMs: 0,
        slowCount: 0,
        errorCount: 0,
        lastStatus: null,
        lastMs: 0,
      };

      const next: ApiPerfStat = {
        count: prev.count + 1,
        totalMs: prev.totalMs + ms,
        maxMs: Math.max(prev.maxMs, ms),
        slowCount: prev.slowCount + (ms >= slowThresholdMs ? 1 : 0),
        errorCount: prev.errorCount + ((hadError || (status !== null && status >= 400)) ? 1 : 0),
        lastStatus: status,
        lastMs: ms,
      };
      stats.set(key, next);

      if (ms >= slowThresholdMs) {
        const avgMs = next.totalMs / next.count;
        console.warn(
          `[API SLOW] ${key} ${ms.toFixed(1)}ms` +
            ` | avg=${avgMs.toFixed(1)}ms` +
            ` | max=${next.maxMs.toFixed(1)}ms` +
            ` | n=${next.count}`
        );
      }

      const current = inFlight.get(key) || 1;
      if (current <= 1) {
        inFlight.delete(key);
      } else {
        inFlight.set(key, current - 1);
      }
    }
  };

  console.info(`[API MONITOR] enabled (slow>${slowThresholdMs}ms). Use window.__apiPerf.snapshot()`);
};

