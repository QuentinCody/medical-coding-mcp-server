/**
 * Workspace completeness signal (ADR-006 Phase 0).
 *
 * Pure helper so the workspace staging path reports the same `complete: false`
 * warning the per-server path does (see `paginationCompleteness` /
 * `deriveMaterializationCompleteness` in `../completeness`). Standalone so it is
 * unit-tested in isolation and threaded into `stageIntoWorkspace` without
 * inflating that function's branch count.
 */
/** Minimal shape this helper reads from a WorkspaceDO `/ws/stage` response. */
export interface WorkspaceMaterialization {
    /** Total rows materialized into the workspace SQLite (parent + child + grandchild). */
    row_count?: number;
    /** Top-level upstream records staged (parent/primary-table input length, EXCLUDING
     * child rows). The upstream-pagination denominator. Falls back to `row_count` when
     * absent (older DO responses / payloads with no child tables, where the two are equal). */
    primary_row_count?: number;
    /** The DO's materialization verdict (`complete:false` ⇒ some rows failed to insert). */
    completeness?: {
        complete: boolean;
        failed_rows?: number;
    };
}
/**
 * Merge upstream pagination (did we fetch every upstream row?) with the
 * WorkspaceDO's materialization result (did every fetched row insert?) into one
 * {@link import("./completeness").Completeness}-shaped value. Returns `undefined`
 * only when nothing is known, so a confirmed-complete dataset still reports
 * `{ complete: true }` and incomplete warnings are never silently dropped.
 */
export declare function workspaceCompleteness(upstreamTotal: number | undefined, wsResult: WorkspaceMaterialization): {
    complete: boolean;
    total_available?: number;
    returned?: number;
} | undefined;
//# sourceMappingURL=workspace-completeness.d.ts.map