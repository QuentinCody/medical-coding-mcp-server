import { type WorkspaceSql } from "./workspace-ops";
/** A synchronous transaction runner (DO `ctx.storage.transactionSync`).
 * Defaults to a pass-through so the router stays unit-testable without a DO. */
export type TxnRunner = <T>(fn: () => T) => T;
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
export declare function handleWorkspaceFetch(sql: WorkspaceSql, request: Request, runInTransaction?: TxnRunner): Promise<Response | null>;
//# sourceMappingURL=workspace-router.d.ts.map