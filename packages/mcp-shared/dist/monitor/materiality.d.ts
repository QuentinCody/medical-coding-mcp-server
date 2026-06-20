/**
 * Monitoring primitive — materiality.
 *
 * Decides whether a detected change is worth surfacing. The default is
 * source-agnostic; source modules refine it (e.g. an Orange Book patent
 * delist-flip, or an expiry date crossing "now", is high-materiality).
 */
import type { Materiality, RowChange } from "./types";
/**
 * Source-agnostic default: a removed row is usually the material event (an
 * active/protected record went away), a changed row matters when any value
 * field moved, and a newly-added row is informational.
 */
export declare function defaultMateriality(change: RowChange): Materiality;
/** Apply a source classifier (or the default) to every change, in place. Returns the same array. */
export declare function classifyChanges(changes: RowChange[], classify?: (c: RowChange) => {
    materiality: Materiality;
    label: string;
}): RowChange[];
//# sourceMappingURL=materiality.d.ts.map