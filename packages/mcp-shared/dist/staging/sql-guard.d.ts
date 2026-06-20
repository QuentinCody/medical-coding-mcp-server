/**
 * Read-only SQL guard, shared by the per-dataset staging query path
 * (`queryDataFromDo`) and the workspace cross-dataset query surface
 * (`WorkspaceDO` `/ws/query`). One definition so the two cannot drift.
 *
 * This is defense-in-depth on top of read-only DO SQLite: a single statement,
 * no comments, no DDL/DML keywords, must start with SELECT or WITH.
 */
/**
 * Validate that `sql` is a single read-only SELECT/WITH statement.
 * Returns the sanitized SQL (line comments stripped, trimmed) or throws with a
 * descriptive message. Does NOT append a LIMIT — see {@link applyDefaultLimit}.
 */
export declare function assertReadOnlySql(sql: string): string;
/** Append a default `LIMIT` if the (already-sanitized) query has none. */
export declare function applyDefaultLimit(sql: string, limit: number): string;
/** Strip a trailing `LIMIT n` so a query can be wrapped in `COUNT(*)`. */
export declare function stripTrailingLimit(sql: string): string;
//# sourceMappingURL=sql-guard.d.ts.map