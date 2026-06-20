/**
 * Hidden __sparql_proxy tool — routes V8 isolate sparql.query() calls
 * through the server's SPARQL fetch function.
 *
 * Only callable from V8 isolates (hidden=true). Auto-stages large responses.
 */
import type { ToolEntry } from "../registry/types";
import type { SparqlFetchFn } from "../codemode/sparql-introspection";
import { type StageResult } from "../staging/utils";
export declare function preserveEnvelopeScalars(original: unknown, staging: Record<string, unknown>): void;
export declare function buildStagedTableSummary(staged: StageResult): string;
export interface SparqlProxyToolOptions {
    sparqlFetch: SparqlFetchFn;
    doNamespace?: unknown;
    stagingPrefix: string;
    stagingThreshold?: number;
}
type SparqlBinding = Record<string, {
    value: string;
    type?: string;
    datatype?: string;
    "xml:lang"?: string;
}>;
interface ParsedSparqlEnvelope {
    /** Virtuoso / SPARQL 1.1 JSON results shape */
    head?: {
        vars?: string[];
        link?: string[];
    };
    results?: {
        bindings?: SparqlBinding[];
    };
    /** ASK queries return { head: {}, boolean: true|false } */
    boolean?: boolean;
    [k: string]: unknown;
}
/**
 * Flatten a SPARQL 1.1 JSON results envelope into row-shaped data for the
 * staging engine. Bindings live at `results.bindings[]` (NOT top-level
 * `bindings`); the staging engine's schema-inference v2 then produces one
 * table with one column per SELECT variable.
 *
 * ASK queries (boolean) and CONSTRUCT/DESCRIBE (non-bindings) fall through
 * unchanged — the staging engine handles them as-is.
 */
export declare function shapeForStaging(parsed: ParsedSparqlEnvelope): unknown;
export declare function createSparqlProxyTool(options: SparqlProxyToolOptions): ToolEntry;
export {};
//# sourceMappingURL=sparql-proxy.d.ts.map