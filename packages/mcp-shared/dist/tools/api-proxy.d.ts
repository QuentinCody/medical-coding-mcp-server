/**
 * Hidden __api_proxy tool — routes V8 isolate api.get/api.post calls
 * through the server's HTTP fetch function.
 *
 * This tool is only callable from V8 isolates (hidden=true).
 * It validates paths, delegates to the server's ApiFetchFn, and
 * auto-stages large responses via stageToDoAndRespond().
 */
import type { ToolContext, ToolEntry } from "../registry/types";
import type { ApiCatalog, ApiFetchFn } from "../codemode/catalog";
import type { ResolvedSpec } from "../codemode/openapi-resolver";
import { type StageOptions } from "../staging/utils";
export declare function validatePath(path: string): void;
/**
 * Interpolate path parameters: /lookup/id/{id} with {id: "ENSG..."} => /lookup/id/ENSG...
 * Returns the interpolated path and remaining (non-path) params.
 */
export declare function interpolatePath(path: string, params: Record<string, unknown>): {
    path: string;
    queryParams: Record<string, unknown>;
};
/** Type guard: checks that a value is an object with string keys (not null, not array). */
export declare function isRecord(value: unknown): value is Record<string, unknown>;
/**
 * Build the {@link StageOptions} for a proxy staging call. When the request is
 * workspace-scoped (`ctx.workspace` set AND the server wired a
 * `workspaceNamespace`), route staging into the shared WorkspaceDO under the
 * server's `stagingPrefix` as the dataset name (ADR-006 Phase 0). Otherwise
 * return the plain per-server options — byte-for-byte unchanged.
 */
export declare function buildStageOptions(ctx: ToolContext | undefined, workspaceNamespace: unknown, stagingPrefix: string, upstreamTotal?: number): StageOptions;
export interface ApiProxyToolOptions {
    apiFetch: ApiFetchFn;
    /** Optional legacy catalog metadata for drift hints */
    catalog?: ApiCatalog;
    /** Optional resolved OpenAPI metadata for drift hints */
    openApiSpec?: ResolvedSpec;
    /** DO namespace for auto-staging large responses */
    doNamespace?: unknown;
    /** Prefix for data access IDs (e.g., "gtex") */
    stagingPrefix?: string;
    /** Byte threshold for auto-staging (default 100KB) */
    stagingThreshold?: number;
    /** WorkspaceDO namespace — when set and `ctx.workspace` is present, auto-staging routes there (ADR-006 Phase 0). */
    workspaceNamespace?: unknown;
}
/**
 * Create the hidden __api_proxy tool entry.
 */
export declare function createApiProxyTool(options: ApiProxyToolOptions): ToolEntry;
export interface StageProxyToolOptions {
    /** DO namespace for staging data */
    doNamespace: unknown;
    /** Prefix for data access IDs (e.g., "gtex") */
    stagingPrefix: string;
    /** WorkspaceDO namespace — when set and `ctx.workspace` is present, staging routes there (ADR-006 Phase 0). */
    workspaceNamespace?: unknown;
}
/**
 * Create the hidden __stage_proxy tool entry.
 * Stages arbitrary data from isolate db.stage() into the server's Durable Object.
 *
 * Accepts optional schema_hints from isolate code to control column types,
 * indexes, and other schema inference parameters. These are forwarded to the
 * DO's /process handler and merged with any server-side hints.
 */
export declare function createStageProxyTool(options: StageProxyToolOptions): ToolEntry;
export interface QueryProxyToolOptions {
    /** DO namespace for querying staged data */
    doNamespace: unknown;
    /** Workspace DO namespace — when ctx.workspace is set, api.query routes here
     * (the staged data lives in the shared per-workspace SQLite, ADR-006). */
    workspaceNamespace?: unknown;
}
/**
 * Create the hidden __query_proxy tool entry.
 * Routes SQL queries from isolate api.query()/db.queryStaged() to the staged-data
 * DO — per-server via queryDataFromDo, or the shared WorkspaceDO when the call's
 * ToolContext carries an active `workspace` (see runProxyQuery).
 */
export declare function createQueryProxyTool(options: QueryProxyToolOptions): ToolEntry;
//# sourceMappingURL=api-proxy.d.ts.map