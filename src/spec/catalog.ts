import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

/**
 * NLM Clinical Tables — HCPCS Level II medical coding (public domain).
 *
 * Covers the FREE, public-domain slice of a medical-coding/billing reference (Find-A-Code /
 * AAPC Codify class): HCPCS Level II procedure & supply codes. ICD-10-CM diagnosis codes are
 * served by the sibling `icd10-codes` fleet server (same NLM source). NOT covered: CPT
 * Category I codes (AMA copyright — the one slice that requires a paid AMA license), and
 * NCCI edits / PFS RVUs / payment data (CMS quarterly files — a future sync component).
 */
export const medicalCodingCatalog: ApiCatalog = {
	name: "NLM Clinical Tables — HCPCS Level II",
	baseUrl: "https://clinicaltables.nlm.nih.gov/api",
	version: "3.0",
	auth: "none",
	endpointCount: 1,
	notes:
		"PUBLIC, no auth. Source: NLM Clinical Tables (clinicaltables.nlm.nih.gov).\n" +
		"RESPONSE FORMAT (compact array, NOT objects): [ total, [codes...], hash|null, [ [displayFields...], ... ] ]. Element 0 = total matches; element 1 = array of codes; element 3 = array of per-row display-field arrays (order = the `df` you requested).\n" +
		"KEY PARAMS: terms (the search string — code or text), maxList (max results, default 7, max 500), df (comma-separated display fields to return per row, e.g. `code,display`), sf (search fields), ef (extra fields returned in a parallel object), q (additional Lucene query), count/offset (pagination).\n" +
		"LOOKUP BY CODE: pass the code as `terms` (e.g. terms=J0135) — returns that code + description.\n" +
		"TEXT SEARCH: terms=adalimumab → matching HCPCS codes (J0135 'Adalimumab injection', J0139, Q5140 biosimilar).\n" +
		"SCOPE — HCPCS Level II only (public domain): J-codes (drugs/biologicals), A/B/E (supplies/DME), G (CMS procedures), Q (temporary), etc. These are the codes Medicare uses for drugs & supplies.\n" +
		"NOT HERE: CPT Category I (99xxx office visits, surgical codes) is AMA copyright — requires an AMA CPT Distribution License (~$18.50/user/yr); it cannot be served from a public source. ICD-10-CM diagnosis codes → use the `icd10-codes` fleet server. NCCI procedure-pair edits, Medicare PFS RVUs and payment amounts → CMS quarterly ZIP files (future sync component, not in NLM Clinical Tables).\n" +
		"OTHER NLM CODE SYSTEMS at sibling paths (not registered here): /icd10cm, /rxterms, /npi_idv, /npi_org, /loinc_items, /conditions, /disease_names.",
	endpoints: [
		{
			method: "GET",
			path: "/hcpcs/v3/search",
			summary:
				"Search/lookup HCPCS Level II codes by code or descriptive text. Returns NLM compact-array format. Use terms=<code> for an exact lookup or terms=<text> for a text search; control returned columns with df (e.g. df=code,display).",
			category: "hcpcs",
			queryParams: [
				{ name: "terms", type: "string", required: true, description: "Search string: a HCPCS code (e.g. `J0135`) or descriptive text (e.g. `adalimumab`, `wheelchair`)" },
				{ name: "maxList", type: "number", required: false, description: "Max results (default 7, max 500)" },
				{ name: "df", type: "string", required: false, description: "Comma-separated display fields per row, e.g. `code,display` (default returns code + display)" },
				{ name: "sf", type: "string", required: false, description: "Comma-separated fields to search (default code + display)" },
				{ name: "ef", type: "string", required: false, description: "Extra fields to return in a parallel object keyed by field name" },
				{ name: "q", type: "string", required: false, description: "Additional Lucene-style query to AND with `terms`" },
				{ name: "count", type: "number", required: false, description: "Page size for pagination" },
				{ name: "offset", type: "number", required: false, description: "Result offset for pagination" },
			],
		},
	],
};
