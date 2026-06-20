/**
 * Schema-hint merging — pure logic extracted from `rest-staging-do.ts` so it is
 * unit-testable in Node (the DO module imports `cloudflare:workers`, which a
 * Node/Vitest test cannot load). Client-provided hints override server defaults.
 */
import type { SchemaHints } from "./schema-inference";
/** Deduplicate composite indexes by their serialized column list. */
export declare function deduplicateCompositeIndexes(indexes: string[][]): string[][];
/**
 * Merge server-side schema hints with client-provided hints. Client hints take
 * precedence for overlapping keys (tableName, columnTypes, maxRecursionDepth);
 * list-valued hints (indexes, exclude, …) are merged as deduplicated unions.
 * Returns undefined if both inputs are undefined.
 */
export declare function mergeSchemaHints(serverHints: SchemaHints | undefined, clientHints: SchemaHints | undefined): SchemaHints | undefined;
//# sourceMappingURL=schema-hints.d.ts.map