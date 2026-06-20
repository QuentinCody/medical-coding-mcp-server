/**
 * Monitoring source module — FDA Orange Book exclusivity & patents.
 *
 * The flagship "exclusivity cliff" monitor: re-runs an exact-match
 * orange_book_execute query for one NDA and diffs the exclusivity + patent
 * row-sets. Field shapes were captured live (NDA 202155) — see
 * docs/design/monitoring-primitive.md §5. catalog.ts param names drift from the
 * real JSON keys, so the keys/PKs below come from the live response, not catalog.
 */
import type { SourceModule } from "../types";
/** The FDA Orange Book exclusivity + patent monitor source. */
export declare const fdaOrangeBook: SourceModule;
//# sourceMappingURL=fda-orange-book.d.ts.map