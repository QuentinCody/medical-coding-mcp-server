import { RestStagingDO } from "../staging/rest-staging-do";
/**
 * Shared cross-server data plane (ADR-006 Phase 0). One instance per workspace
 * (`idFromName("ws:" + workspaceId)`) holds every dataset staged during a
 * workflow in ONE SQLite, so an agent can JOIN across servers in a single
 * SELECT. Inherits VirtualFS + per-dataset staging from RestStagingDO and adds
 * the `/ws/stage`, `/ws/query`, `/ws/schema`, `/ws/clear` routes.
 *
 * Hosted as a plain DO today (Phase 0); the same class drops in as a facet
 * under a per-tenant supervisor in Phase 1 — only routing changes, not this code.
 */
export declare class WorkspaceDO extends RestStagingDO {
    fetch(request: Request): Promise<Response>;
}
//# sourceMappingURL=workspace-do.d.ts.map