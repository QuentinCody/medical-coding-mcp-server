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
/**
 * Coerce an unknown envelope value into a non-negative integer count.
 *
 * Handles the shapes upstream APIs actually use:
 * - numbers (`50000`)
 * - numeric strings (`"266"`) — **NCBI E-utilities return counts as strings**
 * - Elasticsearch `{ value, relation }` total objects
 */
export function asCount(v) {
    if (typeof v === "number") {
        return Number.isFinite(v) && v >= 0 ? Math.trunc(v) : undefined;
    }
    if (typeof v === "string") {
        const trimmed = v.trim();
        if (/^\d+$/.test(trimmed)) {
            const n = Number(trimmed);
            return Number.isFinite(n) ? n : undefined;
        }
        return undefined;
    }
    // Elasticsearch-style `hits.total: { value: N, relation: "eq" | "gte" }`
    if (v && typeof v === "object" && !Array.isArray(v) && "value" in v) {
        return asCount(v.value);
    }
    return undefined;
}
/**
 * Total-count field names in rough priority order. Explicit "total*" names win
 * over the ambiguous bare `count` (which some APIs use for page size). NCBI's
 * `esearchresult.count` is reached via the `count` key + nested containers.
 */
const TOTAL_KEYS = [
    "total_count",
    "totalCount",
    "total_results",
    "totalResults",
    "total_records",
    "totalRecords",
    "record_count",
    "recordCount",
    "total_hits",
    "totalHits",
    "resultcount",
    "resultCount",
    "total",
    "numFound", // Solr
    "hitCount",
    "count", // lowest priority — ambiguous, may mean "this page"
];
/**
 * Containers to probe for a total-count field. `null` = the envelope root.
 * Covers the common nesting used by NCBI (`esearchresult`), Elasticsearch
 * (`hits`), and generic REST metadata blocks.
 */
const TOTAL_CONTAINERS = [
    null,
    "meta",
    "metadata",
    "page_info",
    "pageInfo",
    "pagination",
    "paging",
    "page",
    "esearchresult",
    "hits",
    "header",
    "response", // Solr `{ response: { numFound } }`
];
/**
 * Best-effort extraction of the upstream "total matching records" count from a
 * response envelope. Returns `undefined` when no recognizable total is present.
 *
 * Scans key-major (highest-priority key across all containers first), so an
 * explicit `total_count` anywhere beats a bare `count`, and a root-level hit
 * beats a nested one for the same key.
 */
export function inferUpstreamTotal(envelope) {
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
        return undefined;
    }
    const root = envelope;
    for (const key of TOTAL_KEYS) {
        for (const container of TOTAL_CONTAINERS) {
            const scope = container == null ? root : root[container];
            if (scope && typeof scope === "object" && !Array.isArray(scope)) {
                const n = asCount(scope[key]);
                if (n != null)
                    return n;
            }
        }
    }
    return undefined;
}
/**
 * Build a completeness verdict by comparing a known upstream total against the
 * number of records actually retrieved. Returns `undefined` when either input
 * is unknown (can't make a claim either way).
 */
export function paginationCompleteness(upstreamTotal, returned) {
    if (upstreamTotal == null || returned == null)
        return undefined;
    if (upstreamTotal > returned) {
        return {
            complete: false,
            total_available: upstreamTotal,
            returned,
            truncation: {
                reason: "page_limit",
                detail: `Upstream reports ${upstreamTotal} matching record(s) but only ${returned} were retrieved.`,
                remedy: "Fetch the remaining records (use api.getAll(...) or paginate explicitly) before counting or downstream analysis — the current set is a partial sample.",
            },
        };
    }
    return { complete: true, total_available: upstreamTotal, returned };
}
/**
 * Build a completeness verdict for the staging materialization step from the
 * DO `/process` result. Incomplete iff rows were dropped during insertion.
 */
export function deriveMaterializationCompleteness(opts) {
    const { inputRows, failedRows, returned, dataLossWarning } = opts;
    if (failedRows != null && failedRows > 0) {
        const detail = dataLossWarning ??
            `${failedRows}${inputRows != null ? ` of ${inputRows}` : ""} row(s) failed to materialize into SQLite.`;
        return {
            complete: false,
            ...(returned != null ? { returned } : {}),
            truncation: {
                reason: "insertion_failure",
                detail,
                remedy: "Inspect staging_warnings.sample_errors (and the get_schema tool) — some records were dropped and are absent from query results.",
            },
        };
    }
    return { complete: true, ...(returned != null ? { returned } : {}) };
}
/**
 * Merge multiple completeness verdicts into one. Pass parts in priority order;
 * the result is `complete` only if every defined part is complete, and the
 * reported truncation is taken from the first incomplete part. Returns
 * `undefined` if no part is defined (no verdict to report).
 */
export function mergeCompleteness(...parts) {
    const defined = parts.filter((p) => p != null);
    if (defined.length === 0)
        return undefined;
    const complete = defined.every((p) => p.complete);
    const firstIncomplete = defined.find((p) => !p.complete);
    const total_available = defined.find((p) => p.total_available != null)?.total_available;
    const returned = defined.find((p) => p.returned != null)?.returned;
    return {
        complete,
        ...(total_available != null ? { total_available } : {}),
        ...(returned != null ? { returned } : {}),
        ...(firstIncomplete?.truncation ? { truncation: firstIncomplete.truncation } : {}),
    };
}
//# sourceMappingURL=completeness.js.map