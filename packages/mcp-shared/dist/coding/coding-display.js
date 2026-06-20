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
/** Per-server registry. Pass an instance into the resolver for richer lookups. */
export class CodingDictRegistry {
    dicts = new Map();
    register(systemUri, dict) {
        this.dicts.set(systemUri, dict);
    }
    registerMany(entries) {
        for (const { systemUri, dict } of entries) {
            this.register(systemUri, dict);
        }
    }
    lookup(systemUri, code) {
        if (!systemUri || !code)
            return undefined;
        return this.dicts.get(systemUri)?.[code];
    }
    knownSystems() {
        return [...this.dicts.keys()];
    }
}
/**
 * Resolve a single Coding to its best human-readable display.
 *
 * Returns `undefined` only when both `coding.display` is missing and `code` is
 * missing. Otherwise produces some non-empty string.
 */
export function safeCodingDisplay(coding, registry) {
    if (!coding)
        return undefined;
    if (coding.display && coding.display.length > 0)
        return coding.display;
    const fromDict = registry?.lookup(coding.system, coding.code);
    if (fromDict)
        return fromDict;
    if (coding.code) {
        return coding.system ? `${coding.system}|${coding.code}` : coding.code;
    }
    return undefined;
}
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
export function safeConceptDisplay(concept, registry) {
    if (!concept)
        return undefined;
    if (concept.text && concept.text.length > 0)
        return concept.text;
    const codings = concept.coding;
    if (!Array.isArray(codings) || codings.length === 0)
        return undefined;
    // Pass 1: prefer codings with explicit displays
    for (const c of codings) {
        if (c?.display && c.display.length > 0)
            return c.display;
    }
    // Pass 2: prefer codings whose (system, code) resolves via the registry
    if (registry) {
        for (const c of codings) {
            const fromDict = registry.lookup(c?.system, c?.code);
            if (fromDict)
                return fromDict;
        }
    }
    // Pass 3: fall back to system|code or bare code on the first coding with a code
    for (const c of codings) {
        if (c?.code) {
            return c.system ? `${c.system}|${c.code}` : c.code;
        }
    }
    return undefined;
}
/**
 * Pull the first code from a CodeableConcept regardless of system. Useful for
 * status-style fields where downstream code wants the bare token (e.g., `"active"`).
 */
export function firstCode(concept) {
    if (!concept)
        return undefined;
    const c = concept.coding?.[0];
    return c?.code;
}
/**
 * Convenience: build a registry pre-loaded with dict modules. Each entry must
 * contain `systemUri` and `dict`. See `dicts/loinc-vitals.ts` for the shape.
 */
export function buildRegistry(entries) {
    const r = new CodingDictRegistry();
    r.registerMany(entries);
    return r;
}
//# sourceMappingURL=coding-display.js.map