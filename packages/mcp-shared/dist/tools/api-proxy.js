/**
 * Hidden __api_proxy tool — routes V8 isolate api.get/api.post calls
 * through the server's HTTP fetch function.
 *
 * This tool is only callable from V8 isolates (hidden=true).
 * It validates paths, delegates to the server's ApiFetchFn, and
 * auto-stages large responses via stageToDoAndRespond().
 */
import { z } from "zod";
import { shouldStage, stageToDoAndRespond, queryDataFromDo } from "../staging/utils";
import { inferUpstreamTotal } from "../completeness";
import { buildDriftHint, buildKnownEndpointIndex } from "./api-proxy-drift";
// ---------------------------------------------------------------------------
/** Path traversal patterns to reject */
const DANGEROUS_PATTERNS = [
    /\.\.\//, // Directory traversal
    /\/\.\./, // Reverse traversal
    /%2e%2e/i, // URL-encoded traversal
    /\/\//, // Double slash
];
export function validatePath(path) {
    if (!path.startsWith("/")) {
        throw new Error(`Path must start with /: ${path}`);
    }
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(path)) {
            throw new Error(`Dangerous path pattern detected: ${path}`);
        }
    }
}
/**
 * Interpolate path parameters: /lookup/id/{id} with {id: "ENSG..."} => /lookup/id/ENSG...
 * Returns the interpolated path and remaining (non-path) params.
 */
export function interpolatePath(path, params) {
    const queryParams = { ...params };
    const interpolated = path.replace(/\{(\w+)\}/g, (_match, key) => {
        const value = queryParams[key];
        if (value === undefined || value === null) {
            throw new Error(`Missing required path parameter: ${key}`);
        }
        delete queryParams[key];
        return encodeURIComponent(String(value));
    });
    return { path: interpolated, queryParams };
}
/** Type guard: checks that a value is an object with string keys (not null, not array). */
export function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
/**
 * Build the {@link StageOptions} for a proxy staging call. When the request is
 * workspace-scoped (`ctx.workspace` set AND the server wired a
 * `workspaceNamespace`), route staging into the shared WorkspaceDO under the
 * server's `stagingPrefix` as the dataset name (ADR-006 Phase 0). Otherwise
 * return the plain per-server options — byte-for-byte unchanged.
 */
export function buildStageOptions(ctx, workspaceNamespace, stagingPrefix, upstreamTotal) {
    const workspace = ctx?.workspace;
    if (workspace && workspaceNamespace) {
        return { upstreamTotal, workspace: { namespace: workspaceNamespace, id: workspace, dataset: stagingPrefix } };
    }
    return { upstreamTotal };
}
/** Max size (bytes) for a single property to be preserved in the staging envelope. */
const ENVELOPE_SCALAR_LIMIT = 1024;
/**
 * Copy small scalar properties from the original API response onto the
 * staging metadata object. This preserves values like `.count`, `.total`,
 * `.schema`, `.paging_info` so LLM code can read them without an extra
 * round-trip (ADR-004 Option C).
 */
function preserveEnvelopeScalars(original, staging) {
    if (!original || typeof original !== "object" || Array.isArray(original)) {
        return;
    }
    // After the typeof guard, Object.entries is safe on the narrowed `object` type
    for (const [key, value] of Object.entries(original)) {
        if (key in staging)
            continue; // don't clobber staging metadata fields
        try {
            const serialized = JSON.stringify(value);
            if (serialized !== undefined && serialized.length <= ENVELOPE_SCALAR_LIMIT) {
                staging[key] = value;
            }
        }
        catch { /* best-effort: Skip non-serializable values */ }
    }
}
/**
 * Build a human-readable summary of staged tables for the message field.
 * Example: "2 tables: transcript [10 rows], transcript_Exon [271 rows]"
 */
function buildStagedTableSummary(staged) {
    const tables = staged.tablesCreated;
    const rowCounts = staged._staging?.table_row_counts;
    if (!tables || tables.length === 0) {
        return `${staged.totalRows ?? 0} rows`;
    }
    if (tables.length === 1) {
        const rows = rowCounts?.[tables[0]] ?? staged.totalRows ?? 0;
        return `table "${tables[0]}" [${rows} rows]`;
    }
    const details = tables
        .map((t) => {
        const rows = rowCounts?.[t];
        return rows !== undefined ? `${t} [${rows}]` : t;
    })
        .join(", ");
    return `${tables.length} tables: ${details}`;
}
/**
 * Create the hidden __api_proxy tool entry.
 */
export function createApiProxyTool(options) {
    const { apiFetch, catalog, openApiSpec, doNamespace, stagingPrefix, stagingThreshold, workspaceNamespace, } = options;
    const knownEndpoints = buildKnownEndpointIndex(catalog, openApiSpec);
    return {
        name: "__api_proxy",
        description: "Route API calls from V8 isolate through server HTTP layer. Internal only.",
        hidden: true,
        schema: {
            method: z.enum(["GET", "POST", "PUT", "DELETE"]),
            path: z.string(),
            params: z.record(z.string(), z.unknown()).optional(),
            body: z.unknown().optional(),
        },
        handler: async (input, ctx) => {
            const method = String(input.method || "GET");
            const rawPath = String(input.path || "/");
            const rawParams = isRecord(input.params) ? input.params : {};
            const body = input.body;
            let interpolatedPath = rawPath;
            try {
                validatePath(rawPath);
                // Interpolate path params and extract remaining as query params
                const { path, queryParams } = interpolatePath(rawPath, rawParams);
                interpolatedPath = path;
                const result = await apiFetch({
                    method,
                    path,
                    params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
                    body,
                });
                // Check if response should be auto-staged
                const responseBytes = JSON.stringify(result.data).length;
                if (doNamespace &&
                    stagingPrefix &&
                    shouldStage(responseBytes, stagingThreshold)) {
                    // The proxy is the only layer that sees the raw upstream envelope,
                    // so it's where we detect "upstream reports N matching, but this
                    // page only carried M" — the silent under-count failure mode.
                    const upstreamTotal = inferUpstreamTotal(result.data);
                    const staged = await stageToDoAndRespond(result.data, doNamespace, stagingPrefix, undefined, undefined, stagingPrefix, ctx?.sessionId, buildStageOptions(ctx, workspaceNamespace, stagingPrefix, upstreamTotal));
                    const tableDetail = buildStagedTableSummary(staged);
                    const completeness = staged._staging?.completeness;
                    const incompleteNote = completeness && completeness.complete === false
                        ? ` INCOMPLETE: ${completeness.truncation?.detail ?? ""} ${completeness.truncation?.remedy ?? ""}`.trimEnd()
                        : "";
                    const response = {
                        __staged: true,
                        data_access_id: staged.dataAccessId,
                        schema: staged.schema,
                        tables_created: staged.tablesCreated,
                        total_rows: staged.totalRows,
                        _staging: staged._staging,
                        ...(staged.stagingWarnings ? { staging_warnings: staged.stagingWarnings } : {}),
                        message: `Response auto-staged (${(responseBytes / 1024).toFixed(1)}KB → ${tableDetail}). Use api.query("${staged.dataAccessId}", sql) in-band, or return this object for the caller to use the query_data tool.${incompleteNote}`,
                    };
                    preserveEnvelopeScalars(result.data, response);
                    return response;
                }
                return result.data;
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                const status = err.status || 500;
                const driftHint = buildDriftHint(method, interpolatedPath, status, knownEndpoints);
                return {
                    __api_error: true,
                    status,
                    message,
                    data: err.data,
                    ...(driftHint ? { drift_hint: driftHint } : {}),
                };
            }
        },
    };
}
/**
 * Create the hidden __stage_proxy tool entry.
 * Stages arbitrary data from isolate db.stage() into the server's Durable Object.
 *
 * Accepts optional schema_hints from isolate code to control column types,
 * indexes, and other schema inference parameters. These are forwarded to the
 * DO's /process handler and merged with any server-side hints.
 */
export function createStageProxyTool(options) {
    const { doNamespace, stagingPrefix, workspaceNamespace } = options;
    return {
        name: "__stage_proxy",
        description: "Stage arbitrary data from V8 isolate into DO SQLite. Internal only.",
        hidden: true,
        schema: {
            data: z.unknown(),
            table_name: z.string().optional(),
            schema_hints: z.object({
                tableName: z.string().optional(),
                columnTypes: z.record(z.string(), z.string()).optional(),
                indexes: z.array(z.string()).optional(),
                exclude: z.array(z.string()).optional(),
                skipChildTables: z.array(z.string()).optional(),
                maxRecursionDepth: z.number().optional(),
                compositeIndexes: z.array(z.array(z.string())).optional(),
            }).optional(),
        },
        handler: async (input, ctx) => {
            const data = input.data;
            const tableName = input.table_name ? String(input.table_name) : undefined;
            const clientHints = input.schema_hints;
            if (data === undefined || data === null) {
                return { __stage_error: true, message: "data is required" };
            }
            // Build merged schema hints: table_name is a shorthand for tableName
            const mergedHints = tableName || clientHints
                ? { ...clientHints, ...(tableName ? { tableName } : {}) }
                : undefined;
            try {
                const staged = await stageToDoAndRespond(data, doNamespace, stagingPrefix, mergedHints, undefined, stagingPrefix, ctx?.sessionId, buildStageOptions(ctx, workspaceNamespace, stagingPrefix));
                return {
                    data_access_id: staged.dataAccessId,
                    tables_created: staged.tablesCreated,
                    total_rows: staged.totalRows,
                    schema: staged.schema,
                    _staging: staged._staging,
                    ...(staged.stagingWarnings ? { staging_warnings: staged.stagingWarnings } : {}),
                };
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { __stage_error: true, message };
            }
        },
    };
}
/**
 * Route an in-isolate query to the WorkspaceDO (`/ws/query`) when a workspace is
 * active — the staged data lives in the shared per-workspace SQLite, addressed by
 * the prefixed table names in the SQL, not a per-server data_access_id — else to
 * the per-server DO via queryDataFromDo. (Inlines the /ws/query POST rather than
 * importing queryWorkspaceFromDo to keep this module's import graph flat.)
 */
async function runProxyQuery(doNamespace, workspaceNamespace, ctx, dataAccessId, sql) {
    const workspace = ctx?.workspace;
    if (!workspace || !workspaceNamespace) {
        return queryDataFromDo(doNamespace, dataAccessId, sql, 1000);
    }
    const ns = workspaceNamespace;
    const stub = ns.get(ns.idFromName(`ws:${workspace}`));
    const resp = await stub.fetch(new Request("http://do.internal/ws/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, limit: 1000 }),
    }));
    const r = (await resp.json());
    if (!r.success) {
        throw new Error(`Workspace query failed: ${r.error || "Unknown error"}`);
    }
    return {
        rows: r.rows ?? [],
        row_count: r.row_count ?? 0,
        truncated: r.truncated,
        sql: r.sql ?? sql,
        data_access_id: `ws:${workspace}`,
    };
}
/**
 * Create the hidden __query_proxy tool entry.
 * Routes SQL queries from isolate api.query()/db.queryStaged() to the staged-data
 * DO — per-server via queryDataFromDo, or the shared WorkspaceDO when the call's
 * ToolContext carries an active `workspace` (see runProxyQuery).
 */
export function createQueryProxyTool(options) {
    const { doNamespace, workspaceNamespace } = options;
    return {
        name: "__query_proxy",
        description: "Route SQL queries from V8 isolate to staged data DO. Internal only.",
        hidden: true,
        schema: {
            data_access_id: z.string(),
            sql: z.string(),
        },
        handler: async (input, ctx) => {
            const dataAccessId = String(input.data_access_id || "");
            const sql = String(input.sql || "");
            if (!dataAccessId) {
                return { __query_error: true, message: "data_access_id is required" };
            }
            if (!sql) {
                return { __query_error: true, message: "sql is required" };
            }
            try {
                const result = await runProxyQuery(doNamespace, workspaceNamespace, ctx, dataAccessId, sql);
                const queryResult = result;
                return {
                    rows: result.rows,
                    row_count: result.row_count,
                    ...(queryResult.truncated !== undefined ? { truncated: queryResult.truncated } : {}),
                    ...(queryResult.total_matching !== undefined ? { total_matching: queryResult.total_matching } : {}),
                    sql: result.sql,
                    data_access_id: result.data_access_id,
                };
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { __query_error: true, message };
            }
        },
    };
}
//# sourceMappingURL=api-proxy.js.map