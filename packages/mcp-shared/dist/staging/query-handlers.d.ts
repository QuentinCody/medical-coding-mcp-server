/**
 * Standard `<prefix>_query_data` / `<prefix>_get_schema` tool handlers.
 *
 * Extracted from `staging/utils.ts` (re-exported there for back-compat with the
 * `@bio-mcp/shared/staging/utils` import path used across servers). Each handler
 * has two routes:
 *   1. per-server DO (default, unchanged) — query/list against the server's own
 *      data DO + `__registry__`.
 *   2. shared WorkspaceDO (ADR-006 Phase 0, opt-in) — when a `workspace`
 *      binding is wired AND the tool input carries a `workspace` id, query/schema
 *      route to `/ws/query` / `/ws/schema` so cross-server datasets JOIN in one
 *      SQLite. Absent either, the per-server path runs byte-for-byte unchanged.
 */
import { type CodeModeResponse, type SuccessResponse, type ErrorResponse } from "../codemode/response";
import { type MaybeExtra } from "../registry/request-scope";
type HandlerResponse = CodeModeResponse<SuccessResponse<unknown>> | CodeModeResponse<ErrorResponse>;
/** Optional handler wiring shared by query_data / get_schema tool handlers. */
export interface DataHandlerOptions {
    /** WorkspaceDO namespace — enables `workspace`-routed query/schema (ADR-006 Phase 0). */
    workspaceNamespace?: unknown;
}
/**
 * Standard query_data tool handler. Use in registerTool callback.
 *
 * When a `workspaceNamespace` binding is supplied AND the tool input carries a
 * `workspace` id, the query is routed to the shared WorkspaceDO (`/ws/query`)
 * instead of the per-server DO. Otherwise behavior is unchanged.
 */
export declare function createQueryDataHandler(doBindingName: string, toolPrefix: string, handlerOptions?: DataHandlerOptions): (args: Record<string, unknown>, env: Record<string, unknown>) => Promise<HandlerResponse>;
/**
 * Standard get_schema tool handler. Use in registerTool callback.
 *
 * When `data_access_id` is provided, returns the schema for that specific dataset.
 * When omitted, lists all staged datasets registered against the caller's scope.
 * When a `workspaceNamespace` binding is supplied AND the tool input carries a
 * `workspace` id, the schema is read from the shared WorkspaceDO (`/ws/schema`).
 * Otherwise behavior is unchanged. The 3rd argument accepts the tool handler's
 * `extra` object (preferred) or a plain string (legacy MCP transport sessionId).
 */
export declare function createGetSchemaHandler(doBindingName: string, toolPrefix: string, handlerOptions?: DataHandlerOptions): (args: Record<string, unknown>, env: Record<string, unknown>, scope?: string | MaybeExtra) => Promise<HandlerResponse>;
export {};
//# sourceMappingURL=query-handlers.d.ts.map