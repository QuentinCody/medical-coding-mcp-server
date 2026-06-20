/**
 * Workspace routing for staging (ADR-006 Phase 0).
 *
 * Cohesive helpers that route a Code Mode server's auto-staging + querying to a
 * shared WorkspaceDO so datasets from different servers land in ONE SQLite and
 * can be JOINed. This is OPT-IN — these helpers only run when a caller threads a
 * `workspace` through `StageOptions` / the `*_query_data` / `*_get_schema`
 * inputs. Absent a workspace, the per-server staging path in `utils.ts` runs
 * unchanged.
 *
 * WorkspaceDO contract (`idFromName("ws:" + workspaceId)`):
 *   POST /ws/stage  {dataset, data, schema_hints?, source_tool?}
 *     → {success, dataset, data_access_id, tables:string[], schema, row_count}
 *   POST /ws/query  {sql, limit?}
 *     → {success, rows, row_count, sql, truncated}
 *   GET  /ws/schema[?dataset=]
 *     → {success, dataset_count, datasets}
 */
import type { SchemaHints } from "./schema-inference";
import type { StageResult } from "./utils";
export declare const DO_FETCH_ORIGIN = "http://do.internal";
interface DurableObjectStub {
    fetch(req: Request): Promise<Response>;
}
export interface DurableObjectNamespace {
    idFromName(name: string): unknown;
    get(id: unknown): DurableObjectStub;
}
export interface WorkspaceTarget {
    /** The WorkspaceDO DurableObjectNamespace binding. */
    namespace: unknown;
    /** The workspace id — instance is `idFromName("ws:" + id)`. */
    id: string;
    /** Dataset name to namespace this server's tables under. */
    dataset: string;
}
/**
 * Stage `data` into the shared WorkspaceDO and return a {@link StageResult}
 * mirroring the per-server stage shape (so callers are agnostic to the route).
 * Throws if the workspace reports failure — staging must never silently drop.
 */
export declare function stageIntoWorkspace(data: unknown, workspace: WorkspaceTarget, payloadBytes: number, toolPrefix: string, fallbackDataAccessId: string, schemaHints?: SchemaHints, sourceTool?: string, upstreamTotal?: number): Promise<StageResult>;
/**
 * Query the shared WorkspaceDO (`/ws/query`). The WorkspaceDO applies its own
 * read-only SQL guard, so this is a thin pass-through mirroring the
 * `queryDataFromDo` return shape.
 */
export declare function queryWorkspaceFromDo(workspaceNamespace: DurableObjectNamespace, workspaceId: string, sql: string, limit?: number): Promise<{
    rows: unknown[];
    row_count: number;
    truncated?: boolean;
    sql: string;
    data_access_id: string;
    executed_at: string;
}>;
/**
 * Read the cross-dataset catalog from the shared WorkspaceDO (`/ws/schema`,
 * optionally scoped to a single `dataset`).
 */
export declare function getWorkspaceSchemaFromDo(workspaceNamespace: DurableObjectNamespace, workspaceId: string, dataset?: string): Promise<{
    workspace_id: string;
    schema: {
        dataset_count?: number;
        datasets?: unknown[];
    };
    retrieved_at: string;
}>;
export {};
//# sourceMappingURL=workspace-staging.d.ts.map