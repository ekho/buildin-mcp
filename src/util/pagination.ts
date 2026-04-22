import { buildinFetch } from "../http/client.js";

export interface ListResponse<T> {
  object: "list";
  results: T[];
  next_cursor: string | null;
  has_more: boolean;
  type?: string;
}

export async function fetchAllPaginated<T>(
  path: string,
  baseQuery: Record<string, string | number | boolean | undefined> = {},
  method: "GET" | "POST" = "GET",
  postBody?: Record<string, unknown>,
  maxPages = 50,
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const query = { ...baseQuery, ...(cursor ? { start_cursor: cursor } : {}) };
    const body = method === "POST" ? { ...(postBody ?? {}), ...(cursor ? { start_cursor: cursor } : {}) } : undefined;
    const res = method === "GET"
      ? await buildinFetch<ListResponse<T>>("GET", path, undefined, { query })
      : await buildinFetch<ListResponse<T>>("POST", path, body);
    all.push(...res.results);
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return all;
}
