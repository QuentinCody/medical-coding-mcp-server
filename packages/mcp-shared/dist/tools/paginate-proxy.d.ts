/**
 * Hidden __paginate_proxy tool — backs the isolate's `api.getAll(...)`.
 *
 * Walks every page of an endpoint on the host side via {@link paginateAll},
 * returns the combined records plus a {@link Completeness} verdict, and
 * auto-stages the set into SQLite when it's large. This is the deterministic
 * answer to silent under-counting: agents call one helper and get the WHOLE
 * result (or an explicit truncation reason), not just page one.
 */
import type { ToolEntry } from "../registry/types";
import type { ApiFetchFn } from "../codemode/catalog";
export interface PaginateProxyToolOptions {
    /** Server's HTTP fetch adapter (the same one api.get uses). */
    apiFetch: ApiFetchFn;
    /** DO namespace for auto-staging large combined result sets. */
    doNamespace?: unknown;
    /** Prefix for data access IDs (e.g., "entrez"). */
    stagingPrefix?: string;
    /** Byte threshold for auto-staging the combined items array. */
    stagingThreshold?: number;
    /** WorkspaceDO namespace — when set and `ctx.workspace` is present, staging routes there (ADR-006 Phase 0). */
    workspaceNamespace?: unknown;
}
/** Create the hidden __paginate_proxy tool entry. */
export declare function createPaginateProxyTool(options: PaginateProxyToolOptions): ToolEntry;
//# sourceMappingURL=paginate-proxy.d.ts.map