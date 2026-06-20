/**
 * Canonical completeness signal — a machine-readable verdict on whether a
 * returned/staged result set is the COMPLETE answer to a query, or was cut
 * short (pagination not exhausted, a row/size cap applied, or rows dropped
 * during materialization).
 *
 * Motivation: scientific-data agents silently UNDER-COUNT records when
 * retrieval stops partway through pagination, and OVER-TRUST capped result
 * sets — both produce plausible-looking but wrong datasets (e.g. retrieving
 * 50 of 50,000 matching sequences and treating it as the whole). A single
 * explicit `complete: boolean` plus a machine-readable truncation reason lets
 * models (and humans) detect and recover from incompleteness instead of
 * treating a partial set as the full answer.
 *
 * Design bias: we err toward flagging POSSIBLE incompleteness. A false
 * "incomplete" is cheaply recoverable (the caller fetches more or re-checks);
 * a false "complete" is the dangerous, silent failure this module exists to
 * prevent. Cross-cutting primitive — imported by both staging/ and codemode/,
 * so it lives at the package root with no internal dependencies (no cycles).
 */
export type TruncationReason = 
/** Upstream is paginated and not all pages were fetched. */
"page_limit"
/** An explicit LIMIT / retmax / top-N was applied to the result set. */
 | "row_limit"
/** Response exceeded a byte cap. */
 | "size_limit"
/** Some rows failed to materialize into SQLite during staging. */
 | "insertion_failure"
/** The upstream API itself capped the result set. */
 | "upstream_cap"
/** Incompleteness detected but the cause could not be classified. */
 | "unknown";
export interface Truncation {
    reason: TruncationReason;
    /** Human- and machine-readable explanation of what was cut short. */
    detail?: string;
    /** Actionable next step to retrieve the rest (e.g. "use api.getAll(...)"). */
    remedy?: string;
}
export interface Completeness {
    /** True iff the returned/staged set is the COMPLETE result for the query. */
    complete: boolean;
    /** Total records matching the query upstream, when known. */
    total_available?: number;
    /** Records actually returned / staged. */
    returned?: number;
    /** Present only when `complete === false`. */
    truncation?: Truncation;
}
/**
 * Coerce an unknown envelope value into a non-negative integer count.
 *
 * Handles the shapes upstream APIs actually use:
 * - numbers (`50000`)
 * - numeric strings (`"266"`) — **NCBI E-utilities return counts as strings**
 * - Elasticsearch `{ value, relation }` total objects
 */
export declare function asCount(v: unknown): number | undefined;
/**
 * Best-effort extraction of the upstream "total matching records" count from a
 * response envelope. Returns `undefined` when no recognizable total is present.
 *
 * Scans key-major (highest-priority key across all containers first), so an
 * explicit `total_count` anywhere beats a bare `count`, and a root-level hit
 * beats a nested one for the same key.
 */
export declare function inferUpstreamTotal(envelope: unknown): number | undefined;
/**
 * Build a completeness verdict by comparing a known upstream total against the
 * number of records actually retrieved. Returns `undefined` when either input
 * is unknown (can't make a claim either way).
 */
export declare function paginationCompleteness(upstreamTotal: number | undefined, returned: number | undefined): Completeness | undefined;
/**
 * Build a completeness verdict for the staging materialization step from the
 * DO `/process` result. Incomplete iff rows were dropped during insertion.
 */
export declare function deriveMaterializationCompleteness(opts: {
    inputRows?: number;
    failedRows?: number;
    returned?: number;
    dataLossWarning?: string;
}): Completeness;
/**
 * Merge multiple completeness verdicts into one. Pass parts in priority order;
 * the result is `complete` only if every defined part is complete, and the
 * reported truncation is taken from the first incomplete part. Returns
 * `undefined` if no part is defined (no verdict to report).
 */
export declare function mergeCompleteness(...parts: (Completeness | undefined)[]): Completeness | undefined;
//# sourceMappingURL=completeness.d.ts.map