/**
 * LOINC vital-signs and common-anthropometrics subset.
 *
 * Includes only the LOINC codes referenced by the US Core Vital Signs profile
 * (https://hl7.org/fhir/us/core/StructureDefinition-us-core-vital-signs.html),
 * plus a handful of widely-used anthropometric codes. This is a tiny curated
 * subset — for a full LOINC dictionary, callers should register their own
 * dict via `registerCodingDict()`.
 *
 * Display strings are abbreviated common forms, not the LOINC LONG_COMMON_NAME
 * (which often includes redundant "in <body site>" modifiers). They are
 * suitable for SQL `*_display` columns and human-readable rendering.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LOINC ATTRIBUTION
 *
 * This file includes content from LOINC® which is copyright © 1995-present
 * Regenstrief Institute, Inc. and the LOINC Committee. Content used under the
 * LOINC license at no cost. See: https://loinc.org/terms-of-use/
 *
 * The codes themselves are widely cited in public US health regulations
 * (ONC Cures Act, US Core IG) and are reproduced here in a curated subset
 * solely for the purpose of producing human-readable display strings when an
 * upstream payer/EHR omits `coding.display`. No part of this file constitutes
 * the full LOINC distribution.
 * ────────────────────────────────────────────────────────────────────────
 */
/** LOINC vital-signs subset (US Core Vital Signs). */
export declare const LOINC_VITALS_DICT: Readonly<Record<string, string>>;
/** Convenience export keyed by canonical LOINC URI. */
export declare const LOINC_VITALS_REGISTRATION: {
    readonly systemUri: "http://loinc.org";
    readonly dict: Readonly<Record<string, string>>;
};
//# sourceMappingURL=loinc-vitals.d.ts.map