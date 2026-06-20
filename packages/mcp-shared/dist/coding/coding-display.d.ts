/**
 * Two-tier resolver for FHIR `Coding` and `CodeableConcept` displays.
 *
 * Resolution order:
 *   1. `coding.display` if non-empty
 *   2. Registered dictionary lookup by `(system, code)` if a dict is registered
 *   3. Fallback to `"system|code"` or bare code
 *
 * Pattern derived from shc-web-reader/src/lib/codes.js:118-148/161-170 (MIT
 * © 2023 The Commons Project). The core insight — that payers and EHRs
 * frequently strip `coding.display` and downstream consumers store
 * unrenderable bare codes — applies anywhere our staging engine touches
 * controlled vocabularies, not just FHIR.
 *
 * This module is stateless and bundle-friendly: no third-party dictionaries
 * are loaded eagerly. Servers register their own curated dicts at construction
 * time. See `dicts/loinc-vitals.ts` for an example.
 */
/** A FHIR-shaped Coding. We intentionally accept additional fields as `unknown`. */
export interface Coding {
    system?: string;
    code?: string;
    display?: string;
    version?: string;
    userSelected?: boolean;
}
/** A FHIR-shaped CodeableConcept. */
export interface CodeableConcept {
    text?: string;
    coding?: Coding[];
}
/** A registered code-system dictionary, keyed by canonical system URI. */
export type CodingDict = Readonly<Record<string, string>>;
/** Per-server registry. Pass an instance into the resolver for richer lookups. */
export declare class CodingDictRegistry {
    private readonly dicts;
    register(systemUri: string, dict: CodingDict): void;
    registerMany(entries: Array<{
        systemUri: string;
        dict: CodingDict;
    }>): void;
    lookup(systemUri: string | undefined, code: string | undefined): string | undefined;
    knownSystems(): string[];
}
/**
 * Resolve a single Coding to its best human-readable display.
 *
 * Returns `undefined` only when both `coding.display` is missing and `code` is
 * missing. Otherwise produces some non-empty string.
 */
export declare function safeCodingDisplay(coding: Coding | undefined, registry?: CodingDictRegistry): string | undefined;
/**
 * Resolve a CodeableConcept to its best human-readable display.
 *
 * Resolution is two-pass to prefer real displays over bare `system|code` fallbacks:
 *   1. `concept.text` if non-empty
 *   2. First coding whose `.display` is non-empty
 *   3. First coding whose `(system, code)` resolves via the registered dict
 *   4. First coding's `system|code` or bare code
 *   5. `undefined` if no codings have any code at all
 */
export declare function safeConceptDisplay(concept: CodeableConcept | undefined, registry?: CodingDictRegistry): string | undefined;
/**
 * Pull the first code from a CodeableConcept regardless of system. Useful for
 * status-style fields where downstream code wants the bare token (e.g., `"active"`).
 */
export declare function firstCode(concept: CodeableConcept | undefined): string | undefined;
/**
 * Convenience: build a registry pre-loaded with dict modules. Each entry must
 * contain `systemUri` and `dict`. See `dicts/loinc-vitals.ts` for the shape.
 */
export declare function buildRegistry(entries: Array<{
    systemUri: string;
    dict: CodingDict;
}>): CodingDictRegistry;
//# sourceMappingURL=coding-display.d.ts.map