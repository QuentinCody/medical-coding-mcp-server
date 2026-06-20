/**
 * Monitoring primitive — row-set diff.
 *
 * A full-outer-join of prior vs next snapshot keyed on each table's BUSINESS
 * key (never the staging synthetic PK): keys present only in next = added, only
 * in prior = removed, in both with a differing value-projection = changed (with
 * per-field deltas). A pure upstream row reorder produces zero changes because
 * comparison is keyed, not array-positional.
 */
import { type RowSet } from "./canonicalize";
import type { MonitorProfile, RowChange, SnapshotDiff, TableSpec } from "./types";
/** Diff one table's rows. Returns the changes plus a count of unchanged rows. */
export declare function diffTable(prior: RowSet, next: RowSet, spec: TableSpec): {
    changes: RowChange[];
    unchanged: number;
};
/** Diff two full snapshots (sets of named row-sets) per the profile's tables. */
export declare function diffSnapshots(prior: RowSet[], next: RowSet[], profile: MonitorProfile): SnapshotDiff;
//# sourceMappingURL=diff.d.ts.map