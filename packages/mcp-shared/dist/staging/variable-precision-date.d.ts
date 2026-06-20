/**
 * Variable-precision date parser.
 *
 * Many biomedical APIs emit dates with varying precision:
 *   - FHIR: "2024", "2024-03", "2024-03-15", "2024-03-15T12:34:56Z"
 *   - PubMed: "2024", "2024 May", "2024 May 15"
 *   - ChEMBL: just year_of_publication
 *   - ClinicalTrials.gov: start_date with date_struct{year,month,day} all optional
 *   - NIH RePORTER: fiscal years
 *
 * Storing these as raw strings loses SQL `ORDER BY` correctness because lexical
 * sort drifts (`"2024-3-1"` < `"2024-03"` lexically). This module produces
 * two paired values:
 *   - `iso`: a normalized ISO-8601 prefix (truncated at the precision boundary)
 *   - `precision`: integer 0-4 (NONE/YEAR/MONTH/DAY/TIME)
 *
 * Callers can store both and `ORDER BY iso ASC` correctly across mixed-precision
 * rows. The original string is returned in `raw` for round-trip preservation.
 *
 * Pattern derived from shc-web-reader/src/lib/fhirUtil.js:189-230 (MIT © 2023
 * The Commons Project) with extensions for non-FHIR date conventions.
 *
 * IMPORTANT: This is a stateless utility. The shared schema-inference engine
 * does NOT auto-apply it. Servers opt in by calling `parseVariablePrecisionDate`
 * in their resource enrichment step.
 */
export declare const PRECISION_NONE = 0;
export declare const PRECISION_YEAR = 1;
export declare const PRECISION_MONTH = 2;
export declare const PRECISION_DAY = 3;
export declare const PRECISION_TIME = 4;
export type DatePrecision = typeof PRECISION_NONE | typeof PRECISION_YEAR | typeof PRECISION_MONTH | typeof PRECISION_DAY | typeof PRECISION_TIME;
export interface ParsedVariablePrecisionDate {
    /** Normalized ISO-8601 prefix, truncated at the precision boundary. Empty when invalid. */
    iso: string;
    /** Precision granularity of the source. */
    precision: DatePrecision;
    /** Original input, unmodified. */
    raw: string;
    /** True when the input was recognizable. */
    valid: boolean;
}
/**
 * Parse a date string of variable precision into a normalized ISO prefix and
 * precision indicator.
 *
 * Returns `{iso: "", precision: PRECISION_NONE, valid: false}` on unrecognized input.
 */
export declare function parseVariablePrecisionDate(input: unknown): ParsedVariablePrecisionDate;
/**
 * Derive the column-pair name convention for a given source field.
 *
 * Servers opting in produce two SQL columns:
 *   - `<field>_iso`      TEXT  — sortable normalized ISO prefix
 *   - `<field>_precision` INTEGER — see PRECISION_* constants
 *
 * The original field stays as a TEXT column with the raw input for round-tripping.
 */
export declare function variablePrecisionColumnNames(field: string): {
    iso: string;
    precision: string;
};
/**
 * Convenience: enrich an object by adding `<field>_iso` and `<field>_precision`
 * paired columns alongside an existing date field. Returns the enriched object
 * (does not mutate). Skips fields with unparseable values.
 *
 * @example
 *   enrichWithVariablePrecisionDate(observation, "effectiveDateTime")
 *   //   { effectiveDateTime: "2024-03", effectiveDateTime_iso: "2024-03",
 *   //     effectiveDateTime_precision: 2, ... }
 */
export declare function enrichWithVariablePrecisionDate<T extends Record<string, unknown>>(obj: T, field: string): T;
//# sourceMappingURL=variable-precision-date.d.ts.map