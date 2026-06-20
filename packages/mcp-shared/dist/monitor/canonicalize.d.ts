/**
 * Monitoring primitive — canonicalization + row extraction.
 *
 * Turns a raw MCP tool result into stable, keyed row-sets a diff can compare.
 * The hard requirements (see docs/design/monitoring-primitive.md §2.2):
 *   - strip volatile envelope/meta keys so they never look like a change;
 *   - re-parse stringified-JSON and pipe-delimited columns so upstream key
 *     order / array serialization does not churn the hash;
 *   - hash a key→value-projection MAP (order-independent), not the row array,
 *     so a pure upstream reorder is correctly seen as "no change".
 */
import type { MonitorProfile, TableSpec } from "./types";
/** A logical table of rows extracted from a tool result. */
export interface RowSet {
    table: string;
    rows: Array<Record<string, unknown>>;
}
/** Resolve a dot-path (e.g. "a.b.c") within a value; returns undefined if absent. */
export declare function resolvePath(value: unknown, path: string): unknown;
/** Remove top-level envelope / meta keys that change without semantic meaning. */
export declare function cleanResult(result: unknown, profile: MonitorProfile): unknown;
/** Extract each declared table's rows from a cleaned result. */
export declare function extractRowSets(result: unknown, profile: MonitorProfile): RowSet[];
/** Separator joining composite-key parts. Business-key fields are identifiers, never pipe-bearing. */
export declare const KEY_SEP = "|";
/** Composite business key for one row, per the table spec. */
export declare function rowKey(row: Record<string, unknown>, spec: TableSpec): string;
/** The subset of fields used to decide whether a row "changed". */
export declare function selectValueFields(row: Record<string, unknown>, spec: TableSpec): string[];
/**
 * Re-parse stringified JSON / pipe-delimited columns so the canonical form is
 * stable regardless of upstream key order or array serialization. Staging
 * stores JSON columns as `JSON.stringify` output and scalar arrays as
 * "A | B | C"; hashing the raw TEXT would be order-sensitive.
 */
export declare function reparse(v: unknown): unknown;
/** Canonical string of a row's value-projection (order-independent, re-parsed). */
export declare function canonicalValue(row: Record<string, unknown>, spec: TableSpec): string;
/** A keyed value-projection map for one table: businessKey → canonical value string. */
export declare function keyedValueMap(rs: RowSet, spec: TableSpec): Record<string, string>;
/**
 * Content hash of a full snapshot: a key→value-projection map per table, hashed
 * order-independently. Identical data in any row order yields the same hash, so
 * it is a reliable "nothing changed" gate (unlike the staging synthetic PK).
 */
export declare function snapshotHash(rowSets: RowSet[], profile: MonitorProfile): Promise<string>;
//# sourceMappingURL=canonicalize.d.ts.map