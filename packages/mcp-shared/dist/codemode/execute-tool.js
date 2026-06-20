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
import { DynamicWorkerExecutor, } from "./dynamic-worker-executor";
import { buildCatalogSearchSource } from "./catalog-search";
import { buildOpenApiSearchSource } from "./openapi-search";
import { buildApiProxySource } from "./api-proxy";
import { buildFsProxySource } from "./fs-proxy";
import { createApiProxyTool, createQueryProxyTool, createStageProxyTool } from "../tools/api-proxy";
import { createPaginateProxyTool } from "../tools/paginate-proxy";
import { createFsProxyHandlers } from "../tools/fs-proxy";
import { getRequestScope } from "../registry/request-scope";
import { createCodeModeResponse, createCodeModeError, ErrorCodes } from "./response";
import { catalogToTypeScript, specToTypeScript } from "./catalog-to-typescript";
import { buildCitation } from "../provenance/provenance";
export { DynamicWorkerExecutor, ToolDispatcher } from "./dynamic-worker-executor";
/** Records returned, for the citation: staged total_rows, else array length. */
function countRecords(data, totalRows) {
    if (typeof totalRows === "number")
        return totalRows;
    if (Array.isArray(data))
        return data.length;
    return undefined;
}
/** Build the optional `citation` meta when the server declared a source. */
async function buildCitationMeta(prov, data, recordCount, dataAccessId, retrievedAt) {
    if (!prov?.source)
        return {};
    const citation = await buildCitation({
        source: prov.source, server: prov.server, tool: prov.tool, query: prov.query,
        result: data, retrievedAt, recordCount, dataAccessId,
    });
    return { citation };
}
/**
 * Turn a raw executor result into a Code Mode response: hoist staging metadata
 * and (when a `source` was declared) a verifiable `_meta.citation`.
 */
async function handleExecutorResult(result, prov) {
    const retrievedAt = new Date().toISOString();
    if (result.error) {
        // Recover staging metadata if the error came from accessing staged arrays.
        if (result.__stagedResults?.length) {
            const staged = result.__stagedResults[result.__stagedResults.length - 1];
            const logOutput = result.logs?.length ? result.logs.join("\n") : undefined;
            const { schema: _s, _staging: _st, ...slim } = staged;
            const completeness = _st?.completeness;
            const cite = await buildCitationMeta(prov, slim, staged.total_rows, staged.data_access_id, retrievedAt);
            return createCodeModeResponse(slim, {
                meta: {
                    staged: true, data_access_id: staged.data_access_id,
                    tables_created: staged.tables_created, total_rows: staged.total_rows,
                    ...(completeness ? { completeness } : {}), ...cite,
                    ...(logOutput ? { console_output: logOutput } : {}), executed_at: retrievedAt,
                },
            });
        }
        const logOutput = result.logs?.length ? `\n\nConsole output:\n${result.logs.join("\n")}` : "";
        return createCodeModeError(ErrorCodes.API_ERROR, `${result.error}${logOutput}`);
    }
    const logOutput = result.logs?.length ? result.logs.join("\n") : undefined;
    // Hoist staging metadata to _meta; strip large redundant fields (schema,
    // _staging) to stay under the 100KB structuredContent transport limit.
    const raw = result.result;
    const isStaged = raw !== null && typeof raw === "object" && !Array.isArray(raw)
        && "__staged" in raw && raw.__staged === true;
    let responseData = raw;
    const stagingMeta = {};
    if (isStaged) {
        const resultObj = { ...raw };
        stagingMeta.staged = true;
        stagingMeta.data_access_id = resultObj.data_access_id;
        stagingMeta.tables_created = resultObj.tables_created;
        stagingMeta.total_rows = resultObj.total_rows;
        const completeness = resultObj._staging?.completeness;
        if (completeness)
            stagingMeta.completeness = completeness;
        const { schema: _s, _staging: _st, ...slim } = resultObj;
        responseData = slim;
    }
    const cite = await buildCitationMeta(prov, responseData, countRecords(responseData, stagingMeta.total_rows), stagingMeta.data_access_id, retrievedAt);
    return createCodeModeResponse(responseData, {
        meta: { ...stagingMeta, ...cite, ...(logOutput ? { console_output: logOutput } : {}), executed_at: retrievedAt },
    });
}
/**
 * Build the user code wrapped with spec search + API proxy helpers.
 */
function wrapUserCode(searchSource, userCode, preamble, includeFsProxy) {
    const apiProxy = buildApiProxySource();
    const fsProxy = includeFsProxy ? buildFsProxySource() : "";
    return `async () => {
${searchSource}
${apiProxy}
${fsProxy}
${preamble ? `\n// --- Preamble (domain helpers) ---\n${preamble}\n// --- End preamble ---\n` : ""}
// --- User code ---
${userCode}
// --- End user code ---
}`;
}
/**
 * Create an execute tool registration object.
 */
export function createExecuteTool(options) {
    const { prefix, catalog, openApiSpec, apiFetch, doNamespace, loader: rawLoader, stagingThreshold, timeout = 30_000, preamble, fsDoNamespace, workspaceNamespace, } = options;
    if (!catalog && !openApiSpec) {
        throw new Error("createExecuteTool requires either 'catalog' or 'openApiSpec'");
    }
    // Validate loader implements WorkerLoaderBinding
    if (!rawLoader || typeof rawLoader !== "object" || !("get" in rawLoader) || typeof rawLoader.get !== "function") {
        throw new Error("createExecuteTool requires a valid Worker Loader binding");
    }
    const loader = rawLoader;
    const toolName = `${prefix}_execute`;
    const apiName = catalog?.name || openApiSpec?.info.title || prefix;
    const totalOperations = openApiSpec
        ? Object.values(openApiSpec.paths).reduce((count, pathItem) => {
            if (!pathItem || typeof pathItem !== "object")
                return count;
            return count + Object.keys(pathItem).filter((method) => ["get", "post", "put", "delete", "patch", "options", "head", "trace"].includes(method)).length;
        }, 0)
        : catalog?.endpointCount ?? 0;
    const searchSource = openApiSpec
        ? buildOpenApiSearchSource(JSON.stringify(openApiSpec))
        : buildCatalogSearchSource(JSON.stringify(catalog));
    const notesSection = catalog?.notes ? `\n\nNOTES:\n${catalog.notes}` : "";
    const searchDescription = openApiSpec
        ? `- searchSpec(query) / searchPaths(query) — search the OpenAPI spec\n` +
            `- listCategories() / listTags() — inspect tags/categories\n` +
            `- getEndpoint(path, method?) / getOperation(idOrPath) — get endpoint docs\n` +
            `- describeEndpoint(path, method?) / describeOperation(idOrPath) — format endpoint docs\n` +
            `- spec — full frozen OpenAPI spec object\n`
        : `- searchSpec(query) — search the API catalog\n` +
            `- listCategories() — list endpoint categories\n` +
            `- getEndpoint(path) — get full endpoint docs\n`;
    // Generate compact API reference for the tool description
    const apiSummary = openApiSpec
        ? specToTypeScript(openApiSpec)
        : catalog
            ? catalogToTypeScript(catalog)
            : "";
    // Create the __api_proxy handler
    const apiProxyToolOpts = {
        apiFetch,
        catalog,
        openApiSpec,
        doNamespace,
        stagingPrefix: prefix,
        stagingThreshold,
        workspaceNamespace,
    };
    const apiProxyTool = createApiProxyTool(apiProxyToolOpts);
    // Build the __paginate_proxy handler — backs api.getAll() (exhaustive fetch)
    const paginateProxyTool = createPaginateProxyTool({
        apiFetch,
        doNamespace,
        stagingPrefix: prefix,
        stagingThreshold,
        workspaceNamespace,
    });
    // Build the __query_proxy handler (only available if DO namespace exists)
    const queryProxyTool = doNamespace
        ? createQueryProxyTool({ doNamespace, workspaceNamespace })
        : undefined;
    // Build the __stage_proxy handler (only available if DO namespace exists)
    const stageProxyTool = doNamespace
        ? createStageProxyTool({ doNamespace, stagingPrefix: prefix, workspaceNamespace })
        : undefined;
    /** Coerce executor args to the Record<string, unknown> that handlers expect. */
    function toInput(args) {
        if (args !== null && typeof args === "object" && !Array.isArray(args)) {
            const result = {};
            for (const [k, v] of Object.entries(args)) {
                result[k] = v;
            }
            return result;
        }
        return {};
    }
    // Filesystem proxy handlers (only when fsDoNamespace is provided) — built once.
    const fsHandlers = fsDoNamespace
        ? createFsProxyHandlers({ doNamespace: fsDoNamespace })
        : {};
    /**
     * Build the function map for the executor with a per-request ToolContext.
     * sessionId flows in from the MCP `extra` argument so auto-staging can
     * register datasets with the session-scoped __registry__ DO. `workspace`
     * flows in from the `_execute` `workspace` arg so auto-staging can route into
     * the shared WorkspaceDO (ADR-006 Phase 0) instead of the per-server DO.
     */
    function buildExecutorFns(sessionId, workspace) {
        const ctx = { sql: () => [], sessionId, workspace };
        return {
            __api_proxy: async (args) => apiProxyTool.handler(toInput(args), ctx),
            __paginate_proxy: async (args) => paginateProxyTool.handler(toInput(args), ctx),
            __query_proxy: async (args) => {
                if (!queryProxyTool) {
                    return { __query_error: true, message: "Staged data querying is not available (no DO namespace configured)" };
                }
                return queryProxyTool.handler(toInput(args), ctx);
            },
            __stage_proxy: async (args) => {
                if (!stageProxyTool) {
                    return { __stage_error: true, message: "Data staging is not available (no DO namespace configured)" };
                }
                return stageProxyTool.handler(toInput(args), ctx);
            },
            ...fsHandlers,
        };
    }
    return {
        name: toolName,
        apiProxyTool,
        description: `Execute JavaScript code against the ${apiName} API (${totalOperations} ${openApiSpec ? "operations" : "endpoints"}). ` +
            `Code runs in a sandboxed V8 isolate with:\n` +
            `- api.get(path, params) — make GET requests (path params auto-interpolated from params object)\n` +
            `- api.post(path, body, params) — make POST requests\n` +
            `- api.getAll(path, params, opts) — fetch EVERY page of a paged endpoint (avoids silent under-counting). ` +
            `opts: {strategy:'offset'|'page'|'cursor', pageSize, offsetParam, limitParam, max, maxPages, itemsField}. ` +
            `Returns {items, count, pages, total_available, completeness} (or auto-stages if large).\n` +
            searchDescription +
            `- console logging (log, warn, error, info) — captured output\n` +
            (fsDoNamespace
                ? `- fs.readFile(path), fs.writeFile(path, content), fs.readJSON(path), fs.writeJSON(path, data) — persistent virtual filesystem\n` +
                    `- fs.readdir(path), fs.mkdir(path), fs.stat(path), fs.exists(path), fs.rm(path), fs.glob(pattern) — directory operations\n` +
                    `- fs.appendFile(path, content) — append to file\n`
                : "") +
            (preamble ? `\nDomain-specific helper functions are also available — see the catalog notes for details.\n` : "") +
            `\nThe last expression or return value is the result.\n` +
            (apiSummary ? `\n${apiSummary}\n\n` : `\nUse ${prefix}_search to discover endpoints, then write code here to call them.\n\n`) +
            `STAGING: Large responses (>30KB) are auto-staged into SQLite. When this happens, ` +
            `api.get/api.post returns {__staged: true, data_access_id, schema, tables_created, total_rows, message}. ` +
            `Scalar properties from the original response (.count, .total, .meta) are preserved on the staged object.\n\n` +
            `When staging occurs:\n` +
            `1. Check result.__staged === true\n` +
            `2. Read any preserved scalars (result.count, result.total, etc.)\n` +
            `3. Return the staging metadata — the caller will use ${prefix}_query_data with the data_access_id to explore the data with SQL\n\n` +
            `DO NOT try to access .results, .data, .entries, .items on a staged response — those arrays were replaced by SQLite tables.\n\n` +
            `For advanced use: api.query(data_access_id, sql) and db.queryStaged(data_access_id, sql) are available to query staged data ` +
            `within the same execution (returns {results, row_count}, max 1000 rows, SELECT only). ` +
            `This is useful when you need to aggregate or filter staged data before returning.\n\n` +
            `SCRATCHPAD: db.stage(data, tableName?) stages any array/object into SQLite and returns {data_access_id, tables_created, total_rows}. ` +
            `Use this to persist computed or filtered results for SQL queries without re-entering the context window. ` +
            `Example: const filtered = await api.query(id, "SELECT * WHERE score > 0.8"); const saved = await db.stage(filtered.results, "top_hits");\n\n` +
            `TYPED STAGING: db.stage(data, { tableName, schema }) accepts schema hints to control SQL types and indexing:\n` +
            `  const staged = await db.stage(myData, {\n` +
            `    tableName: 'gene_scores',\n` +
            `    schema: {\n` +
            `      columnTypes: { score: 'REAL', chromosome: 'TEXT', is_significant: 'INTEGER' },\n` +
            `      indexes: ['gene_symbol', 'score'],\n` +
            `      compositeIndexes: [['gene_symbol', 'chromosome']],\n` +
            `      exclude: ['internal_debug_field'],\n` +
            `      skipChildTables: ['raw_annotations'],\n` +
            `    }\n` +
            `  });\n` +
            `Schema hints override auto-inference. Available options: columnTypes (TEXT|INTEGER|REAL|JSON), indexes, compositeIndexes, exclude, skipChildTables, maxRecursionDepth.\n\n` +
            `IMPORTANT: Use limit/pagination params to keep responses small. If you need large datasets, let them auto-stage and return the staging info.` +
            notesSection,
        schema: {
            code: z.string().describe("JavaScript code to execute. Use api.get/api.post for API calls. " +
                "The last expression or explicit return value becomes the result. " +
                "Example: return await api.get('/dataset/tissueSiteDetail')"),
            workspace: z.string().optional().describe("Shared workspace id — stage into a cross-server workspace DO so other servers' datasets can be JOINed in one query. Omit for per-server staging."),
        },
        register(server) {
            const description = this.description;
            const schema = this.schema;
            server.tool(toolName, description, schema, async (input, extra) => {
                const code = input.code?.trim();
                if (!code) {
                    return createCodeModeError(ErrorCodes.INVALID_ARGUMENTS, "code is required");
                }
                try {
                    const wrappedCode = wrapUserCode(searchSource, code, preamble, !!fsDoNamespace);
                    const scope = getRequestScope(extra);
                    const executorFns = buildExecutorFns(scope, input.workspace);
                    const executor = new DynamicWorkerExecutor({ loader, timeout });
                    const result = await executor.execute(wrappedCode, executorFns);
                    return await handleExecutorResult(result, {
                        source: options.source,
                        server: prefix,
                        tool: toolName,
                        query: code,
                    });
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    return createCodeModeError(ErrorCodes.UNKNOWN_ERROR, `${prefix}_execute failed: ${message}`);
                }
            });
        },
    };
}
//# sourceMappingURL=execute-tool.js.map