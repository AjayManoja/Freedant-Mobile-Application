import type { AuthTokens, ErrorBody, ErrorCode } from '@feedants/shared';
import { type StoredSession, tokenStore } from '@/auth/token-store';
import { API_URL } from './config';
import { markOnline } from './network';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK',
    message: string,
    readonly requestId?: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

let session: StoredSession | null = null;
let refreshing: Promise<boolean> | null = null;
let onSignedOut: () => void = () => {};

export const auth = {
  async load() {
    session = await tokenStore.load();
    return session;
  },
  async set(tokens: Pick<AuthTokens, 'accessToken' | 'refreshToken'>) {
    session = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    await tokenStore.save(session);
  },
  async clear() {
    session = null;
    await tokenStore.clear();
  },
  get signedIn() {
    return session !== null;
  },
  /** Called when the session can no longer be refreshed (e.g. token reuse detected). */
  onSignedOut(fn: () => void) {
    onSignedOut = fn;
  },
};

/**
 * US-03: refresh once, shared by every request that hit 401 at the same moment. The server
 * treats a second use of a rotated token as theft, so parallel refreshes must never happen.
 */
async function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    const current = session;
    if (!current) return false;
    try {
      const res = await fetch(`${API_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!res.ok) {
        await auth.clear();
        onSignedOut();
        return false;
      }
      await auth.set((await res.json()) as AuthTokens);
      return true;
    } catch {
      return false; // offline: keep the session, the caller surfaces a network error
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  idempotencyKey?: string;
  /** Sends the token when present but never requires it (guest browsing, FR-ID-08). */
  auth?: 'required' | 'optional' | 'none';
}

export async function api<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const url = new URL(path, API_URL);
  for (const [k, v] of Object.entries(opts.query ?? {}))
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));

  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;
  if (opts.auth !== 'none' && session) headers.authorization = `Bearer ${session.accessToken}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    markOnline(false);
    throw new ApiError(0, 'NETWORK', 'network');
  }
  markOnline(true);

  if (res.status === 401 && !retried && session && opts.auth !== 'none') {
    if (await refresh()) return api<T>(path, opts, true);
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const e = (body as ErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      e?.code ?? 'INTERNAL',
      e?.message ?? res.statusText,
      e?.requestId,
      e?.details,
    );
  }
  return body as T;
}

/** A fresh key per user action; reused for retries of that same action (HLD §5.3). */
export const newIdempotencyKey = (): string =>
  `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
