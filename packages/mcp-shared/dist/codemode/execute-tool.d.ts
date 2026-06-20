/**
 * Execute tool factory — creates a `<prefix>_execute` tool for Code Mode.
 *
 * Uses DynamicWorkerExecutor (inlined from @cloudflare/codemode) to run user
 * code in a sandboxed V8 isolate via the Worker Loader binding.
 *
 * The isolate gets:
 * - codemode.__api_proxy() — routes API calls through server HTTP layer
 * - Pre-injected catalog search helpers (searchSpec, listCategories, etc.)
 * - Pre-injected api.get/api.post wrappers
 * - console.log() capture
 *
 * API keys never enter the isolate — all HTTP goes through the host's apiFetch.
 */
import { z } from "zod";
import type { ApiCatalog, ApiFetchFn } from "./catalog";
import type { ResolvedSpec } from "./openapi-resolver";
import type { ToolEntry } from "../registry/types";
import { type SourceDescriptor } from "../provenance/provenance";
export { DynamicWorkerExecutor, ToolDispatcher } from "./dynamic-worker-executor";
export type { ExecutorFns, ExecutorResult, WorkerLoaderBinding } from "./dynamic-worker-executor";
export interface ExecuteToolOptions {
    /** Tool name prefix (e.g., "gtex" → "gtex_execute") */
    prefix: string;
    /** The legacy API catalog (optional when using OpenAPI mode) */
    catalog?: ApiCatalog;
    /** Resolved OpenAPI spec injected into the isolate in place of the catalog */
    openApiSpec?: ResolvedSpec;
    /** Server's HTTP fetch adapter */
    apiFetch: ApiFetchFn;
    /** DO namespace for auto-staging large responses */
    doNamespace?: unknown;
    /** Worker Loader binding for V8 isolate creation (WorkerLoaderBinding) */
    loader: unknown;
    /** Byte threshold for auto-staging (default 100KB) */
    stagingThreshold?: number;
    /** Execution timeout in ms (default 30000) */
    timeout?: number;
    /** Optional JavaScript source injected into the isolate before user code.
     *  Use to provide domain-specific helper functions (e.g. stats.computePRR). */
    preamble?: string;
    /** DO namespace for virtual filesystem. When provided, fs.* is available in isolates.
     *  Uses idFromName("__fs__") for a shared filesystem DO instance. */
    fsDoNamespace?: unknown;
    /** WorkspaceDO namespace (ADR-006 Phase 0). When provided AND the `_execute`
     *  call passes a `workspace` id, auto-staging routes into the shared
     *  WorkspaceDO (`idFromName("ws:" + workspace)`) so datasets from different
     *  servers land in one SQLite and can be JOINed. Omit for per-server staging. */
    workspaceNamespace?: unknown;
    /** Canonical upstream source identity. When declared, every result carries a
     *  verifiable `_meta.citation` (source + query/result hashes + timestamp) so a
     *  connected agent can attribute and re-verify each claim. Opt-in per server. */
    source?: SourceDescriptor;
}
export interface ExecuteToolResult {
    name: string;
    apiProxyTool: ToolEntry;
    description: string;
    schema: {
        code: z.ZodString;
        workspace: z.ZodOptional<z.ZodString>;
    };
    register: (server: {
        tool: (...args: unknown[]) => void;
    }) => void;
}
/**
 * Create an execute tool registration object.
 */
export declare function createExecuteTool(options: ExecuteToolOptions): ExecuteToolResult;
//# sourceMappingURL=execute-tool.d.ts.map