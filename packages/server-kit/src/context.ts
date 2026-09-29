import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  /** Request ID from the gateway, or the originating event's trace ID inside a consumer. */
  requestId: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
  setUser(userId: string): void {
    const ctx = storage.getStore();
    if (ctx) ctx.userId = userId;
  },
};
