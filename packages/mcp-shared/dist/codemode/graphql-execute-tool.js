/**
 * GraphQL execute tool factory — creates a `<prefix>_execute` tool for
 * GraphQL Code Mode.
 *
 * Uses DynamicWorkerExecutor to run user code in a sandboxed V8 isolate.
 * The isolate gets:
 * - gql.query(queryString, variables?) — GraphQL execution through host
 * - schema.types(), schema.type(), schema.search() etc. — introspection helpers
 * - db.stage(), db.queryStaged(), api.query() — staging helpers
 * - console.log() capture
 *
 * API keys never enter the isolate — all HTTP goes through the host's gqlFetch.
 */
import { z } from "zod";
import { DynamicWorkerExecutor, } from "./execute-tool";
import { fetchIntrospection, } from "./graphql-introspection";
import { buildGraphqlSchemaSource } from "./graphql-schema-source";
import { buildGraphqlProxySource } from "./graphql-proxy";
import { introspectionToSummary } from "./graphql-to-typescript";
import { createGraphqlProxyTool } from "../tools/graphql-proxy";
import { createQueryProxyTool, createStageProxyTool } from "../tools/api-proxy";
import { createFsProxyHandlers } from "../tools/fs-proxy";
import { buildFsProxySource } from "./fs-proxy";
import { getRequestScope } from "../registry/request-scope";
import { createCodeModeResponse, createCodeModeError, ErrorCodes } from "./response";
import { buildCitation } from "../provenance/provenance";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function validateLoader(rawLoader) {
    if (!rawLoader ||
        typeof rawLoader !== "object" ||
        !("get" in rawLoader) ||
        typeof rawLoader.get !== "function") {
        throw new Error("createGraphqlExecuteTool requires a valid Worker Loader binding");
    }
    return rawLoader;
}
/** Coerce executor args to Record<string, unknown>. */
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
function buildDescription(options, apiSummary) {
    const { prefix, preamble, fsDoNamespace } = options;
    const name = options.apiName ?? prefix;
    return (`Execute JavaScript code against the ${name} GraphQL API. ` +
        `Code runs in a sandboxed V8 isolate with:\n` +
        `- gql.query(queryString, variables?) — execute GraphQL queries (returns data directly, e.g. result.gene not result.data.gene)\n` +
        `- schema.types(), schema.type(name), schema.search(query) — explore the schema\n` +
        `- schema.queryRoot() — list available query entry points with args\n` +
        `- schema.enumValues(name), schema.inputType(name) — inspect enums and input types\n` +
        `- console logging (log, warn, error, info) — captured output\n` +
        (fsDoNamespace
            ? `- fs.readFile(path), fs.writeFile(path, content), fs.readJSON(path), fs.writeJSON(path, data) — persistent virtual filesystem\n` +
                `- fs.readdir(path), fs.mkdir(path), fs.stat(path), fs.exists(path), fs.rm(path), fs.glob(pattern) — directory operations\n`
            : "") +
        (preamble ? `\nDomain-specific helper functions and quirks are documented below.\n` : "") +
        `\nThe last expression or return value is the result.\n` +
        (apiSummary ? `\n${apiSummary}\n\n` : "\n") +
        `STAGING: Large responses (>30KB) are auto-staged into SQLite. When this happens, ` +
        `gql.query returns {__staged: true, data_access_id, schema, tables_created, total_rows, message}. ` +
        `Scalar properties from the original response are preserved on the staged object.\n\n` +
        `When staging occurs:\n` +
        `1. Check result.__staged === true\n` +
        `2. Read any preserved scalars (result.count, result.total, etc.)\n` +
        `3. Return the staging metadata — the caller will use ${prefix}_query_data with the data_access_id to explore the data with SQL\n\n` +
        `DO NOT try to access .results, .data, .entries, .items on a staged response — those arrays were replaced by SQLite tables.\n\n` +
        `For advanced use: api.query(data_access_id, sql) and db.queryStaged(data_access_id, sql) are available to query staged data ` +
        `within the same execution (returns {results, row_count}, max 1000 rows, SELECT only).\n\n` +
        `SCRATCHPAD: db.stage(data, tableName?) stages any array/object into SQLite and returns {data_access_id, tables_created, total_rows}. ` +
        `Use this to persist computed or filtered results for SQL queries.\n\n` +
        `IMPORTANT: Use pagination params (first/after, limit/offset) to keep responses small. If you need large datasets, let them auto-stage and return the staging info.` +
        (preamble ? `\n\nSERVER NOTES:\n${extractPreambleNotes(preamble)}` : ""));
}
/** Extract comment lines from a preamble to include in tool description. */
function extractPreambleNotes(preamble) {
    return preamble
        .split("\n")
        .filter((line) => line.trim().startsWith("//"))
        .map((line) => line.trim().replace(/^\/\/\s?/, ""))
        .join("\n");
}
function wrapUserCode(opts) {
    const fsProxy = opts.includeFsProxy ? buildFsProxySource() : "";
    return `async () => {
${opts.schemaSource}
${opts.gqlProxySource}
${fsProxy}
${opts.preamble ? `\n// --- Preamble (domain helpers) ---\n${opts.preamble}\n// --- End preamble ---\n` : ""}
// --- User code ---
${opts.userCode}
// --- End user code ---
}`;
}
/** Ensure introspection is fetched and schema source is built. */
async function ensureIntrospection(ctx) {
    if (!ctx.cache.introspection) {
        ctx.cache.introspection = await fetchIntrospection(ctx.gqlFetch);
    }
    if (!ctx.cache.schemaSource) {
        ctx.cache.schemaSource = buildGraphqlSchemaSource(JSON.stringify(ctx.cache.introspection));
    }
    if (!ctx.cache.description) {
        const summary = introspectionToSummary(ctx.cache.introspection);
        ctx.cache.description = buildDescription(ctx.options, summary);
    }
}
/** Execute user code in a V8 isolate with GraphQL + schema helpers. */
async function executeCode(ctx, code, sessionId, workspace) {
    await ensureIntrospection(ctx);
    const wrappedCode = wrapUserCode({
        schemaSource: ctx.cache.schemaSource,
        gqlProxySource: ctx.gqlProxySource,
        userCode: code,
        preamble: ctx.preamble,
        includeFsProxy: ctx.includeFsProxy,
    });
    const executor = new DynamicWorkerExecutor({ loader: ctx.loader, timeout: ctx.timeout });
    const result = await executor.execute(wrappedCode, ctx.buildExecutorFns(sessionId, workspace));
    return await handleExecutorResult(result, {
        source: ctx.options.source,
        server: ctx.options.prefix,
        tool: `${ctx.options.prefix}_execute`,
        query: code,
    });
}
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
function createExecutorFnsBuilder(graphqlProxyTool, doNamespace, prefix, fsDoNamespace, workspaceNamespace) {
    const queryProxyTool = doNamespace ? createQueryProxyTool({ doNamespace, workspaceNamespace }) : undefined;
    const stageProxyTool = doNamespace ? createStageProxyTool({ doNamespace, stagingPrefix: prefix, workspaceNamespace }) : undefined;
    const fsHandlers = fsDoNamespace
        ? createFsProxyHandlers({ doNamespace: fsDoNamespace })
        : {};
    return (sessionId, workspace) => {
        const ctx = { sql: () => [], sessionId, workspace };
        return {
            __graphql_proxy: async (args) => graphqlProxyTool.handler(toInput(args), ctx),
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
    };
}
/**
 * Create a GraphQL execute tool registration object.
 */
export function createGraphqlExecuteTool(options) {
    const { prefix, gqlFetch, doNamespace, loader: rawLoader, stagingThreshold, timeout = 30_000, preamble, fsDoNamespace, workspaceNamespace } = options;
    const loader = validateLoader(rawLoader);
    const toolName = `${prefix}_execute`;
    const graphqlProxyTool = createGraphqlProxyTool({ gqlFetch, doNamespace, stagingPrefix: prefix, stagingThreshold, workspaceNamespace });
    const buildExecutorFns = createExecutorFnsBuilder(graphqlProxyTool, doNamespace, prefix, fsDoNamespace, workspaceNamespace);
    const ctx = {
        gqlFetch,
        options,
        loader,
        timeout,
        preamble,
        includeFsProxy: !!fsDoNamespace,
        gqlProxySource: buildGraphqlProxySource(),
        buildExecutorFns,
        cache: { introspection: options.introspection, schemaSource: undefined, description: undefined },
    };
    const initialDescription = buildDescription(options, "Use schema.queryRoot() to discover available query fields.");
    return {
        name: toolName,
        description: initialDescription,
        schema: {
            code: z.string().describe("JavaScript code to execute. Use gql.query() for GraphQL queries and schema.* for discovery. " +
                "The last expression or explicit return value becomes the result. " +
                'Example: const r = await gql.query(\'{ target(q: { sym: "EGFR" }) { name tdl } }\'); return r;'),
            workspace: z.string().optional().describe("Shared workspace id — stage into a cross-server workspace DO so other servers' datasets can be JOINed in one query. Omit for per-server staging."),
        },
        register(server) {
            server.tool(toolName, this.description, this.schema, async (input, extra) => {
                const code = input.code?.trim();
                if (!code) {
                    return createCodeModeError(ErrorCodes.INVALID_ARGUMENTS, "code is required");
                }
                try {
                    const scope = getRequestScope(extra);
                    return await executeCode(ctx, code, scope, input.workspace);
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    return createCodeModeError(ErrorCodes.UNKNOWN_ERROR, `${prefix}_execute failed: ${message}`);
                }
            });
        },
    };
}
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
        source: prov.source,
        server: prov.server,
        tool: prov.tool,
        query: prov.query,
        result: data,
        retrievedAt,
        recordCount,
        dataAccessId,
    });
    return { citation };
}
async function handleExecutorResult(result, prov) {
    const retrievedAt = new Date().toISOString();
    if (result.error) {
        // Recover staging metadata if the error was from accessing staged arrays
        if (result.__stagedResults?.length) {
            const staged = result.__stagedResults[result.__stagedResults.length - 1];
            const logOutput = result.logs?.length ? result.logs.join("\n") : undefined;
            const { schema: _s, _staging: _st, ...slim } = staged;
            const cite = await buildCitationMeta(prov, slim, staged.total_rows, staged.data_access_id, retrievedAt);
            return createCodeModeResponse(slim, {
                meta: {
                    staged: true,
                    data_access_id: staged.data_access_id,
                    tables_created: staged.tables_created,
                    total_rows: staged.total_rows,
                    ...cite,
                    ...(logOutput ? { console_output: logOutput } : {}),
                    executed_at: retrievedAt,
                },
            });
        }
        const logOutput = result.logs?.length
            ? `\n\nConsole output:\n${result.logs.join("\n")}`
            : "";
        return createCodeModeError(ErrorCodes.API_ERROR, `${result.error}${logOutput}`);
    }
    const logOutput = result.logs?.length ? result.logs.join("\n") : undefined;
    const raw = result.result;
    // Detect staging metadata in the result
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
        // Strip large fields available via get_schema tool
        const { schema: _s, _staging: _st, ...slim } = resultObj;
        responseData = slim;
    }
    const cite = await buildCitationMeta(prov, responseData, countRecords(responseData, stagingMeta.total_rows), stagingMeta.data_access_id, retrievedAt);
    return createCodeModeResponse(responseData, {
        meta: {
            ...stagingMeta,
            ...cite,
            ...(logOutput ? { console_output: logOutput } : {}),
            executed_at: retrievedAt,
        },
    });
}
//# sourceMappingURL=graphql-execute-tool.js.map