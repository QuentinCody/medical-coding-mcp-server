import { clearWorkspace, queryWorkspace, stageDataset, workspaceSchema, } from "./workspace-ops";
function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}
const PASSTHROUGH_TXN = (fn) => fn();
/**
 * Route a `/ws/*` request to the workspace ops. Returns `null` for any other
 * path so the caller (`WorkspaceDO.fetch`) can defer to `super.fetch` (the
 * inherited `/process`, `/query`, `/schema`, `/fs/*` routes).
 *
 * `runInTransaction` wraps the mutating ops so staging (many DDL + INSERT)
 * commits atomically — a mid-materialization failure rolls back, leaving no
 * orphan tables without a manifest row — and ~10-50x faster than per-statement
 * autocommit. Defaults to a pass-through for unit tests.
 */
export async function handleWorkspaceFetch(sql, request, runInTransaction = PASSTHROUGH_TXN) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (!pathname.startsWith("/ws/"))
        return null;
    try {
        if (pathname === "/ws/stage" && request.method === "POST") {
            const body = (await request.json());
            const handle = runInTransaction(() => stageDataset(sql, {
                dataset: body.dataset,
                data: body.data,
                schemaHints: body.schema_hints,
                sourceTool: body.source_tool,
            }));
            return json({ success: true, ...handle });
        }
        if (pathname === "/ws/query" && request.method === "POST") {
            const body = (await request.json());
            const result = queryWorkspace(sql, { sql: body.sql, limit: body.limit });
            return json({ success: true, ...result });
        }
        if (pathname === "/ws/schema" && request.method === "GET") {
            const ds = url.searchParams.get("dataset") ?? undefined;
            return json({ success: true, ...workspaceSchema(sql, ds) });
        }
        if (pathname === "/ws/clear" && request.method === "POST") {
            runInTransaction(() => clearWorkspace(sql));
            return json({ success: true });
        }
        return json({ success: false, error: `Unknown workspace route: ${request.method} ${pathname}` }, 404);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ success: false, error: message }, 400);
    }
}
//# sourceMappingURL=workspace-router.js.map