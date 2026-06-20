/**
 * Staging utilities — decision logic, DO interaction, data access ID generation.
 */
import { getRequestScope } from "../registry/request-scope";
import { deriveMaterializationCompleteness, mergeCompleteness, paginationCompleteness, } from "../completeness";
import { buildStagingMetadata } from "./staging-metadata";
import { DO_FETCH_ORIGIN, stageIntoWorkspace } from "./workspace-staging";
// The standard query_data / get_schema tool handlers were extracted to keep this
// file under the line cap. Re-exported here so the long-standing
// `@bio-mcp/shared/staging/utils` import path (used across all servers) is stable.
export { createQueryDataHandler, createGetSchemaHandler, } from "./query-handlers";
const DEFAULT_STAGING_THRESHOLD = 30 * 1024; // 30KB — stage larger responses into SQLite for compact schema summaries
// ---------------------------------------------------------------------------
/** Safely parse a Response body as JSON with a fallback. */
async function parseJsonResponse(resp, fallback) {
    const raw = await resp.json();
    if (raw === null || typeof raw !== "object")
        return fallback;
    return raw;
}
/** Decide whether a response should be staged based on byte size. */
export function shouldStage(responseBytes, threshold) {
    return responseBytes > (threshold ?? DEFAULT_STAGING_THRESHOLD);
}
/** Generate a unique data access ID. */
export function generateDataAccessId(prefix) {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 15);
    return `${prefix}_${ts}_${rand}`;
}
/**
 * Register a freshly-staged dataset in the per-server `__registry__` DO so
 * `<prefix>_get_schema` (without a data_access_id) can enumerate it later.
 * Best-effort: a registry write failure must NOT fail staging.
 */
async function registerStagedDataset(doNamespace, scope, dataAccessId, tables, totalRows, toolPrefix, toolName) {
    try {
        // Scope the registry DO to the request (defense-in-depth alongside the
        // row-level session_id filter) so one session cannot enumerate another's
        // staged datasets. `scope` is the resolved scope (caller guards on it).
        const registryDo = doNamespace.get(doNamespace.idFromName(scope ? `${scope}:__registry__` : "__registry__"));
        await registryDo.fetch(new Request(`${DO_FETCH_ORIGIN}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                session_id: scope,
                data_access_id: dataAccessId,
                tool_name: toolName,
                tables,
                total_rows: totalRows,
                tool_prefix: toolPrefix,
            }),
        }));
    }
    catch (err) {
        // Non-critical — don't fail staging if the registry write fails.
        void err;
    }
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
export async function stageToDoAndRespond(data, doNamespace, prefix, schemaHints, provenance, toolPrefix, scope, options) {
    const dataAccessId = generateDataAccessId(prefix);
    const payloadBytes = JSON.stringify(data).length;
    const resolvedToolPrefix = toolPrefix ?? prefix;
    // ADR-006 Phase 0 — workspace routing. Stage into the shared WorkspaceDO and
    // return early; the per-server `/process` + `/register` path below is skipped
    // so default-off behavior stays byte-for-byte unchanged.
    const ws = options?.workspace;
    if (ws) {
        return stageIntoWorkspace(data, ws, payloadBytes, resolvedToolPrefix, dataAccessId, schemaHints, provenance?.toolName, options?.upstreamTotal);
    }
    const doId = doNamespace.idFromName(dataAccessId);
    const doInstance = doNamespace.get(doId);
    const processReq = new Request(`${DO_FETCH_ORIGIN}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            data,
            ...(provenance ? { context: provenance } : {}),
            ...(schemaHints ? { schema_hints: schemaHints } : {}),
        }),
    });
    const processResp = await doInstance.fetch(processReq);
    const processResult = await parseJsonResponse(processResp, { success: false, error: "Empty response from DO" });
    if (!processResult.success) {
        throw new Error(`Failed to stage data in Durable Object: ${processResult.error || "unknown error"}`);
    }
    // Fetch schema
    const schemaResp = await doInstance.fetch(new Request(`${DO_FETCH_ORIGIN}/schema`));
    const schemaResult = await parseJsonResponse(schemaResp, { success: false });
    const tables = processResult.tables_created ?? [];
    const primaryTable = tables[0];
    const primaryTableRows = processResult.table_row_counts
        ? (primaryTable ? (processResult.table_row_counts[primaryTable] ?? 0) : undefined)
        : undefined;
    // Compute a canonical completeness verdict for the staged set. Two signals,
    // merged with pagination taking priority (it's usually the larger loss):
    //   1. pagination — upstream reported more records than we staged
    //   2. materialization — rows dropped while writing into SQLite
    const warnings = processResult.staging_warnings ?? {};
    const failedRows = typeof warnings.rows_skipped === "number" ? warnings.rows_skipped : undefined;
    const dataLossWarning = typeof warnings.data_loss_warning === "string" ? warnings.data_loss_warning : undefined;
    const completeness = mergeCompleteness(paginationCompleteness(options?.upstreamTotal, primaryTableRows), deriveMaterializationCompleteness({
        inputRows: processResult.input_rows,
        failedRows,
        returned: primaryTableRows,
        dataLossWarning,
    }));
    // Register in the per-server `__registry__` DO so get_schema can list it later.
    // `scope` may arrive as a string (legacy callers) or as the full `extra` object
    // (preferred). The DO column is still called `session_id` for back-compat; only
    // the *value's meaning* has shifted from MCP transport session to app scope.
    const resolvedScope = getRequestScope(scope);
    if (resolvedScope) {
        await registerStagedDataset(doNamespace, resolvedScope, dataAccessId, tables, processResult.total_rows, resolvedToolPrefix, provenance?.toolName);
    }
    return {
        dataAccessId,
        schema: schemaResult.success ? schemaResult.schema : null,
        tablesCreated: processResult.tables_created,
        totalRows: processResult.total_rows,
        inputRows: processResult.input_rows,
        stagingWarnings: processResult.staging_warnings,
        _staging: buildStagingMetadata({
            dataAccessId,
            tables,
            primaryTable,
            totalRows: processResult.total_rows,
            primaryTableRows,
            tableRowCounts: processResult.table_row_counts,
            payloadSizeBytes: payloadBytes,
            toolPrefix: resolvedToolPrefix,
            relationships: processResult.relationships,
            completeness,
        }),
    };
}
/**
 * Query staged data from a Durable Object with SQL safety checks.
 */
export async function queryDataFromDo(doNamespace, dataAccessId, sql, limit = 100) {
    // SQL safety validation
    const sanitizedSql = sql.replace(/--.*$/gm, "").trim();
    if (/\/\*/.test(sanitizedSql)) {
        throw new Error("C-style /* */ comments are not allowed");
    }
    if (sanitizedSql.split(";").filter(Boolean).length > 1) {
        throw new Error("Only single SQL statements are allowed");
    }
    const dangerousKeywords = [
        "DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE",
        "TRUNCATE", "REPLACE", "EXEC", "EXECUTE", "PRAGMA",
        "ATTACH", "DETACH", "REINDEX", "VACUUM", "ANALYZE",
    ];
    const upperSql = sanitizedSql.toUpperCase();
    for (const keyword of dangerousKeywords) {
        // Use word-boundary regex to avoid false positives on column names
        // like "created_at" matching CREATE, "updated_at" matching UPDATE, etc.
        const regex = new RegExp(`\\b${keyword}\\b`);
        if (regex.test(upperSql)) {
            throw new Error(`SQL command '${keyword}' is not allowed. Only SELECT queries are permitted.`);
        }
    }
    if (!/^\s*(SELECT|WITH)\b/i.test(sanitizedSql)) {
        throw new Error("Only SELECT/WITH queries are allowed");
    }
    let finalSql = sanitizedSql;
    if (!sanitizedSql.toLowerCase().includes("limit")) {
        finalSql += ` LIMIT ${limit}`;
    }
    const doId = doNamespace.idFromName(dataAccessId);
    const doInstance = doNamespace.get(doId);
    // Validate the DAI actually resolves to a populated DO. `idFromName` always
    // succeeds and `get()` creates a new empty DO on first access, so unknown
    // IDs would silently return no-rows (or `SELECT 1` answers). Reject up front.
    //
    // The /schema response shape is:
    //   { success: true, schema: { table_count: N, tables: { "tbl1": {...}, ... } } }
    // NOT an array. Check tables map keys (ignoring internal names).
    try {
        const probe = await doInstance.fetch(new Request(`${DO_FETCH_ORIGIN}/schema`));
        if (probe.ok) {
            const probeJson = (await probe.json());
            const tables = probeJson.schema?.tables ?? {};
            const userTableNames = Object.keys(tables).filter((name) => typeof name === "string" &&
                !name.startsWith("_") &&
                !name.startsWith("sqlite_") &&
                !name.startsWith("_staging_"));
            if (userTableNames.length === 0) {
                const err = new Error(`Unknown or empty data_access_id: ${dataAccessId}. No staged data found. Re-stage with <prefix>_search/execute or fan-out tools first.`);
                err.status = 404;
                throw err;
            }
        }
    }
    catch (err) {
        // Only rethrow our deliberate 404; swallow probe-level errors so a
        // transient schema-probe failure doesn't block a legitimate query.
        if (err?.status === 404)
            throw err;
    }
    const response = await doInstance.fetch(new Request(`${DO_FETCH_ORIGIN}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: finalSql, count_total: true }),
    }));
    const result = await parseJsonResponse(response, { success: false, error: "Empty response from DO" });
    if (!result.success) {
        const err = new Error(`Query failed: ${result.error || "Unknown error"}`);
        if (result.diagnostics) {
            err.diagnostics = result.diagnostics;
        }
        if (result.validated) {
            err.validated = true;
        }
        throw err;
    }
    return {
        rows: result.results ?? [],
        row_count: result.row_count ?? (result.results?.length ?? 0),
        ...(result.truncated !== undefined ? { truncated: result.truncated } : {}),
        ...(result.total_matching !== undefined ? { total_matching: result.total_matching } : {}),
        sql: finalSql,
        data_access_id: dataAccessId,
        executed_at: new Date().toISOString(),
    };
}
/**
 * Get schema metadata from a Durable Object.
 */
export async function getSchemaFromDo(doNamespace, dataAccessId) {
    const doId = doNamespace.idFromName(dataAccessId);
    const doInstance = doNamespace.get(doId);
    const response = await doInstance.fetch(new Request(`${DO_FETCH_ORIGIN}/schema`));
    const result = await parseJsonResponse(response, { success: false, error: "Empty response from DO" });
    if (!result.success) {
        throw new Error(`Schema retrieval failed: ${result.error}`);
    }
    const schema = result.schema;
    if (!schema ||
        typeof schema !== "object" ||
        !("tables" in schema) ||
        Object.keys(schema.tables).length === 0) {
        throw new Error(`Data access ID "${dataAccessId}" not found or contains no data.`);
    }
    return {
        data_access_id: dataAccessId,
        schema,
        retrieved_at: new Date().toISOString(),
    };
}
//# sourceMappingURL=utils.js.map