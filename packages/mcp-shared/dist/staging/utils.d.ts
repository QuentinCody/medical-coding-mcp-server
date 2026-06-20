/**
 * Staging utilities — decision logic, DO interaction, data access ID generation.
 */
import { type MaybeExtra } from "../registry/request-scope";
import type { SchemaHints } from "./schema-inference";
import { type StagingMetadata } from "./staging-metadata";
import { type WorkspaceTarget } from "./workspace-staging";
export { createQueryDataHandler, createGetSchemaHandler, type DataHandlerOptions, } from "./query-handlers";
/** Decide whether a response should be staged based on byte size. */
export declare function shouldStage(responseBytes: number, threshold?: number): boolean;
/** Generate a unique data access ID. */
export declare function generateDataAccessId(prefix: string): string;
interface DurableObjectStub {
    fetch(req: Request): Promise<Response>;
}
interface DurableObjectNamespace {
    idFromName(name: string): unknown;
    get(id: unknown): DurableObjectStub;
}
export interface StagingProvenance {
    toolName?: string;
    serverName?: string;
    args?: Record<string, unknown>;
    apiUrl?: string;
}
export interface StageOptions {
    /**
     * Total records the upstream API reports as matching the query (e.g. from
     * `count` / `total_count` / `numFound`). When provided and it exceeds the
     * number of records actually staged, the resulting `_staging.completeness`
     * is flagged incomplete (pagination not exhausted). See {@link Completeness}.
     */
    upstreamTotal?: number;
    /**
     * ADR-006 Phase 0 — when present, route staging into a shared WorkspaceDO so
     * datasets from different servers land in ONE SQLite and can be JOINed. The
     * per-server `/process` + `/register` path is skipped entirely. Absent =
     * today's per-server staging, byte-for-byte unchanged. See {@link WorkspaceTarget}.
     */
    workspace?: WorkspaceTarget;
}
export interface StageResult {
    dataAccessId: string;
    schema: unknown;
    tablesCreated: string[] | undefined;
    totalRows: number | undefined;
    inputRows: number | undefined;
    stagingWarnings: Record<string, unknown> | undefined;
    /** Universal staging metadata — include as `_staging` in structuredContent */
    _staging: StagingMetadata;
}
/**
 * Stage data to a Durable Object and return a structuredContent response
 * with the data_access_id for subsequent SQL queries.
 *
 * @param schemaHints - Optional schema hints forwarded to the DO's /process handler.
 *   These are merged with server-side hints (client hints take precedence).
 * @param toolPrefix - Tool name prefix for query_data/get_schema tool names (e.g. "ctgov", "faers").
 *   If not provided, falls back to `prefix` (the data access ID prefix).
 * @param scope - Application-scope identifier. When provided, registers the staged dataset
 *   in the `__registry__` DO so `<prefix>_get_schema` can enumerate it after context compaction.
 *   Pass the tool handler's `extra` directly (preferred — picks up `_meta.app.chatId` or the
 *   `mcp-chat-id` header bridge), or a plain string for the legacy MCP transport session form.
 *   Resolved through {@link getRequestScope}.
 * @param options - Optional staging hints. `upstreamTotal` enables pagination
 *   completeness detection; `workspace` routes staging into a shared WorkspaceDO
 *   (see {@link StageOptions}).
 */
export declare function stageToDoAndRespond(data: unknown, doNamespace: DurableObjectNamespace, prefix: string, schemaHints?: SchemaHints, provenance?: StagingProvenance, toolPrefix?: string, scope?: string | MaybeExtra, options?: StageOptions): Promise<StageResult>;
/**
 * Query staged data from a Durable Object with SQL safety checks.
 */
export declare function queryDataFromDo(doNamespace: DurableObjectNamespace, dataAccessId: string, sql: string, limit?: number): Promise<{
    rows: unknown[];
    row_count: number;
    truncated?: boolean;
    total_matching?: number;
    sql: string;
    data_access_id: string;
    executed_at: string;
}>;
/**
 * Get schema metadata from a Durable Object.
 */
export declare function getSchemaFromDo(doNamespace: DurableObjectNamespace, dataAccessId: string): Promise<{
    data_access_id: string;
    schema: unknown;
    retrieved_at: string;
}>;
//# sourceMappingURL=utils.d.ts.map