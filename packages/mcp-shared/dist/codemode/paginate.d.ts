/**
 * Deterministic exhaustive pagination for Code Mode.
 *
 * Agents silently UNDER-COUNT when they fetch only the first page of a paged
 * API and treat it as the whole result. `paginateAll` walks every page to
 * completion (or an explicit, *reported* cap) using one of three predictable
 * strategies — no fragile auto-magic — and returns a {@link Completeness}
 * verdict so the caller always knows whether the set is whole or truncated.
 *
 * This is a PURE host-side helper (no isolate, no network of its own): it takes
 * an injected `fetchPage` so it is fully unit-testable. The isolate-facing
 * `api.getAll(...)` and the `__paginate_proxy` host tool are thin wrappers.
 */
import { type Completeness } from "../completeness";
export interface PaginateOptions {
    /**
     * How to advance through pages. Explicit, never inferred:
     * - `offset` (default): bump `offsetParam` by `pageSize` each request
     *   (e.g. NCBI `retstart`/`retmax`, REST `offset`/`limit`).
     * - `page`: increment `pageParam` (e.g. `page`/`per_page`).
     * - `cursor`: send the previous response's next-cursor as `cursorParam`.
     */
    strategy?: "offset" | "page" | "cursor";
    /** Offset strategy: query param carrying the start index (default "offset"). */
    offsetParam?: string;
    /** Offset/cursor strategy: query param carrying the page size (default "limit"). */
    limitParam?: string;
    /** Page strategy: query param carrying the page number (default "page"). */
    pageParam?: string;
    /** Page strategy: query param carrying the page size (default "per_page"). */
    pageSizeParam?: string;
    /** Page strategy: first page number (default 1). */
    startPage?: number;
    /** Records requested per page (default 100). */
    pageSize?: number;
    /** Cursor strategy: query param to send the cursor as (default "cursor"). */
    cursorParam?: string;
    /** Cursor strategy: response field holding the next cursor (default: auto-detect). */
    nextField?: string;
    /** Dot-path to the items array in each response (default: auto-detect). */
    itemsField?: string;
    /** Hard cap on total items accumulated (default 10000). Reported if hit. */
    max?: number;
    /** Hard cap on page requests (default 50). Reported if hit. */
    maxPages?: number;
}
export type PageFetcher = (params: Record<string, unknown>) => Promise<unknown>;
export interface PaginateResult {
    items: unknown[];
    /** Number of page requests actually made. */
    pages: number;
    /** Upstream-reported total matching records, when any response exposed one. */
    total_available?: number;
    /** Whether every matching record was retrieved, or where it was cut short. */
    completeness: Completeness;
}
/**
 * Find the primary array of records in a response. Honors an explicit
 * `itemsField` dot-path; otherwise probes common envelope keys plus NCBI's
 * nested `esearchresult.idlist`. Returns the array and the field it came from
 * (so later pages can re-extract from the same place).
 */
export declare function extractItems(resp: unknown, itemsField?: string): {
    items: unknown[];
    field?: string;
};
/** Extract a next-page cursor/token from a response, if present. */
export declare function extractNextCursor(resp: unknown, nextField?: string, cursorParam?: string): string | undefined;
/**
 * Walk every page of a paged endpoint and return the combined records plus a
 * completeness verdict. `fetchPage(params)` performs one request and returns
 * the parsed response body.
 */
export declare function paginateAll(fetchPage: PageFetcher, baseParams?: Record<string, unknown>, opts?: PaginateOptions): Promise<PaginateResult>;
//# sourceMappingURL=paginate.d.ts.map