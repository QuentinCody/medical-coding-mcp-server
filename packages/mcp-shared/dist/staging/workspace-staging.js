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
import { buildStagingMetadata } from "./staging-metadata";
import { workspaceCompleteness } from "./workspace-completeness";
// DO `fetch()` ignores the request URL host — it routes to the addressed
// instance regardless. We use a synthetic internal origin so the path/query is
// well-formed without hardcoding `http://localhost` (which the lint gate blocks).
export const DO_FETCH_ORIGIN = "http://do.internal";
/** Safely parse a Response body as JSON with a fallback. */
async function parseJsonResponse(resp, fallback) {
    const raw = await resp.json();
    if (raw === null || typeof raw !== "object")
        return fallback;
    return raw;
}
/**
 * Stage `data` into the shared WorkspaceDO and return a {@link StageResult}
 * mirroring the per-server stage shape (so callers are agnostic to the route).
 * Throws if the workspace reports failure — staging must never silently drop.
 */
export async function stageIntoWorkspace(data, workspace, payloadBytes, toolPrefix, fallbackDataAccessId, schemaHints, sourceTool, upstreamTotal) {
    const wsNs = workspace.namespace;
    const wsInstance = wsNs.get(wsNs.idFromName(`ws:${workspace.id}`));
    const wsResp = await wsInstance.fetch(new Request(`${DO_FETCH_ORIGIN}/ws/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            dataset: workspace.dataset,
            data,
            ...(schemaHints ? { schema_hints: schemaHints } : {}),
            source_tool: sourceTool,
        }),
    }));
    const wsResult = await parseJsonResponse(wsResp, {
        success: false,
        error: "Empty workspace response",
    });
    if (!wsResult.success) {
        throw new Error(`Failed to stage into workspace: ${wsResult.error || "unknown error"}`);
    }
    const wsTables = wsResult.tables ?? [];
    const wsDataAccessId = wsResult.data_access_id ?? fallbackDataAccessId;
    return {
        dataAccessId: wsDataAccessId,
        schema: null,
        tablesCreated: wsTables,
        totalRows: wsResult.row_count,
        inputRows: wsResult.primary_row_count,
        stagingWarnings: undefined,
        _staging: buildStagingMetadata({
            dataAccessId: wsDataAccessId,
            tables: wsTables,
            primaryTable: wsTables[0],
            totalRows: wsResult.row_count,
            primaryTableRows: wsResult.primary_row_count ?? wsResult.row_count,
            tableRowCounts: undefined,
            payloadSizeBytes: payloadBytes,
            toolPrefix,
            relationships: undefined,
            completeness: workspaceCompleteness(upstreamTotal, wsResult),
        }),
    };
}
/**
 * Query the shared WorkspaceDO (`/ws/query`). The WorkspaceDO applies its own
 * read-only SQL guard, so this is a thin pass-through mirroring the
 * `queryDataFromDo` return shape.
 */
export async function queryWorkspaceFromDo(workspaceNamespace, workspaceId, sql, limit = 100) {
    const wsInstance = workspaceNamespace.get(workspaceNamespace.idFromName(`ws:${workspaceId}`));
    const response = await wsInstance.fetch(new Request(`${DO_FETCH_ORIGIN}/ws/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, limit }),
    }));
    const result = await parseJsonResponse(response, {
        success: false,
        error: "Empty response from workspace DO",
    });
    if (!result.success) {
        throw new Error(`Workspace query failed: ${result.error || "Unknown error"}`);
    }
    return {
        rows: result.rows ?? [],
        row_count: result.row_count ?? (result.rows?.length ?? 0),
        ...(result.truncated !== undefined ? { truncated: result.truncated } : {}),
        sql: result.sql ?? sql,
        data_access_id: `ws:${workspaceId}`,
        executed_at: new Date().toISOString(),
    };
}
/**
 * Read the cross-dataset catalog from the shared WorkspaceDO (`/ws/schema`,
 * optionally scoped to a single `dataset`).
 */
export async function getWorkspaceSchemaFromDo(workspaceNamespace, workspaceId, dataset) {
    const wsInstance = workspaceNamespace.get(workspaceNamespace.idFromName(`ws:${workspaceId}`));
    const query = dataset ? `?dataset=${encodeURIComponent(dataset)}` : "";
    const response = await wsInstance.fetch(new Request(`${DO_FETCH_ORIGIN}/ws/schema${query}`));
    const result = await parseJsonResponse(response, {
        success: false,
        error: "Empty response from workspace DO",
    });
    if (result.success === false) {
        throw new Error(`Workspace schema retrieval failed: ${result.error || "Unknown error"}`);
    }
    return {
        workspace_id: workspaceId,
        schema: { dataset_count: result.dataset_count, datasets: result.datasets },
        retrieved_at: new Date().toISOString(),
    };
}
//# sourceMappingURL=workspace-staging.js.map