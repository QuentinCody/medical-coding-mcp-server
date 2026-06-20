import type { InferredSchema } from "./schema-inference";
export interface ColumnProfile {
    /** Number of NULL values */
    null_count: number;
    /** Number of distinct non-null values (capped at 101 to detect high-cardinality) */
    distinct_count: number;
    /** true when actual distinct count exceeds the cap — real cardinality is higher */
    distinct_capped?: boolean;
    /** Minimum value (for INTEGER/REAL: number; for TEXT: shortest string; omitted for JSON) */
    min?: string | number | null;
    /** Maximum value (for INTEGER/REAL: number; for TEXT: longest string; omitted for JSON) */
    max?: string | number | null;
    /** 3-5 representative non-null sample values */
    sample_values?: (string | number | null)[];
    /** Top values by frequency for low-cardinality columns (distinct ≤ 20) */
    top_values?: Array<{
        value: string | number | null;
        count: number;
    }>;
}
export interface TableProfile {
    table: string;
    row_count: number;
    /** Column profiles keyed by column name */
    columns: Record<string, ColumnProfile>;
}
interface ProfileSql {
    exec(query: string, ...bindings: unknown[]): {
        toArray: () => Record<string, unknown>[];
        one: () => Record<string, unknown> | undefined;
    };
}
/**
 * Compute column profiles for all tables after materialization.
 *
 * Runs lightweight SQL queries against the just-populated SQLite tables.
 * Designed to be called inside the same transaction as materializeSchema()
 * so there's no extra I/O cost.
 */
export declare function computeColumnProfiles(schema: InferredSchema, sql: ProfileSql): TableProfile[];
export {};
//# sourceMappingURL=column-profiles.d.ts.map