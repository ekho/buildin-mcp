import { AsyncLocalStorage } from "node:async_hooks";

const tokenStorage = new AsyncLocalStorage<string>();

export function runWithToken<T>(token: string, fn: () => T): T {
  return tokenStorage.run(token, fn);
}

export function getContextToken(): string | undefined {
  return tokenStorage.getStore();
}
