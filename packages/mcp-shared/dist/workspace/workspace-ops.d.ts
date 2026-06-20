import { type InferredSchema, type SchemaHints } from "../staging/schema-inference";
/** The subset of Cloudflare's `SqlStorage` these ops use. */
export interface WorkspaceSql {
    exec(query: string, ...bindings: unknown[]): {
        toArray(): Record<string, unknown>[];
        one(): Record<string, unknown> | undefined;
    };
}
/** Lazily create the per-workspace dataset manifest. Idempotent. */
export declare function ensureWorkspaceTables(sql: WorkspaceSql): void;
/**
 * Prefix every table name (and child-table FK parent ref) with `dataset__`, so
 * two datasets' tables coexist in one SQLite without collision and JOIN cleanly.
 */
export declare function prefixSchema(schema: InferredSchema, dataset: string): InferredSchema;
export interface StageDatasetParams {
    dataset: string;
    data: unknown;
    schemaHints?: SchemaHints;
    sourceTool?: string;
}
export interface DatasetHandle {
    dataset: string;
    data_access_id: string;
    tables: string[];
    schema: InferredSchema | null;
    row_count: number;
    /** Top-level upstream records staged (parent-table input length), EXCLUDING
     * child/grandchild rows. The denominator for the upstream-pagination check
     * (row_count would over-count for nested payloads and mask a partial page). */
    primary_row_count: number;
    completeness: {
        complete: boolean;
        failed_rows?: number;
    };
}
/**
 * Materialize `data` into `dataset__*` tables and record it in the manifest.
 * Re-staging the same dataset replaces its prior tables.
 */
export declare function stageDataset(sql: WorkspaceSql, params: StageDatasetParams): DatasetHandle;
export interface QueryWorkspaceResult {
    rows: Record<string, unknown>[];
    row_count: number;
    sql: string;
    /** A full page came back and the caller set no LIMIT → there may be more rows. */
    truncated: boolean;
}
/** The cross-dataset JOIN surface: read-only SQL across every staged table. */
export declare function queryWorkspace(sql: WorkspaceSql, params: {
    sql: string;
    limit?: number;
}): QueryWorkspaceResult;
export interface WorkspaceDatasetInfo {
    dataset: string;
    data_access_id: string;
    source_tool: string | null;
    row_count: number;
    completeness: unknown;
    tables: Array<{
        name: string;
        row_count: number;
        columns: Array<{
            name: string;
            type: string;
        }>;
    }>;
}
export interface WorkspaceSchemaResult {
    dataset_count: number;
    datasets: WorkspaceDatasetInfo[];
}
/** The cross-server catalog: every dataset, its tables, columns and row counts. */
export declare function workspaceSchema(sql: WorkspaceSql, dataset?: string): WorkspaceSchemaResult;
/** GC: drop every dataset's tables and empty the manifest. */
export declare function clearWorkspace(sql: WorkspaceSql): void;
//# sourceMappingURL=workspace-ops.d.ts.map