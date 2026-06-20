/**
 * Monitoring primitive — business-key auto-detection.
 *
 * When a subscription does not declare an explicit key, infer a single-column
 * business key from per-column statistics: a column unique across all rows
 * (distinctCount === rowCount) and never null. Prefers a known bio-id column
 * name. Returns null when no column is a clean unique key — the caller then
 * falls back to hashing the whole canonicalized row.
 *
 * This deliberately excludes the staging synthetic PK (`_rowid`): it is unique
 * but insertion-order, so keying on it would report churn on every reorder.
 */
/** Per-column cardinality stats (mapped from staging get_schema column profiles). */
export interface KeyColumnStat {
    column: string;
    distinctCount: number;
    nullCount: number;
    rowCount: number;
}
/** Infer a single-column business key, or null if none is a clean unique key. */
export declare function autoDetectKey(stats: KeyColumnStat[]): string[] | null;
//# sourceMappingURL=key-detect.d.ts.map