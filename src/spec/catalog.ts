import type { ApiCatalog, ParamDef } from "@bio-mcp/shared/codemode/catalog";
const p = (name: string, description: string, type: ParamDef["type"] = "string", required = false): ParamDef => ({name, description, type, required});
export const medicalCodingCatalog: ApiCatalog = {
  name: "NLM Clinical Tables — HCPCS Level II",
  baseUrl: "https://clinicaltables.nlm.nih.gov/api", version: "v3", auth: "none", endpointCount: 4,
  notes: "HCPCS Level II only. CPT Category I, ICD-10-CM, coverage and payment determinations are outside this server. " +
    "Native search returns [reportedTotal, codes, extraFields|null, displayRows, optionalCodeSystems]. Parallel arrays share row positions. " +
    "reportedTotal may undercount and is capped at 10000; offset+count cannot exceed 7500. maxList does not paginate. Never infer a complete dataset from these totals. " +
    "terms matches word prefixes; it is not an exact code lookup. Use the local /hcpcs/code/{code} helper to post-filter exact identifiers. " +
    "Use local /hcpcs/search for raw addition/termination/action-effective dates, obsolete/NOC flags and provenance. Native dates can be strings, numbers or null; flags can be strings. Preserve their source types. These dates do not identify the source release or establish coverage. " +
    "NLM's index documented October 2026 on 2026-10-03, but each compact response has no verified dataset version. API v3 is a schema version. " +
    "Staged contextual rows include row_json for exact JSON types and display arrays; scalar date columns preserve numeric versus text values. Recover full native arrays/FHIR resources from payloads.root_json (content_chunks when chunked). " +
    "FHIR R4 expansion is an existing alternate representation; native version/identifier/timestamp/properties are preserved if supplied. It is not a full terminology server, and no version pin or exhaustive pagination is promised.",
  endpoints: [
    {method: "GET", path: "/hcpcs/v3/search", category: "hcpcs", summary: "Native compact-array HCPCS prefix/text search with caller-selected columns.", queryParams: [
      p("terms", "Required partial-word/code search; multiple words are ANDed.", "string", true),
      p("count", "Page size 1–500, default 7.", "number"), p("offset", "Zero-based offset; offset+count <=7500.", "number"),
      p("maxList", "Autocomplete count 1–500; empty means 500. Cannot combine with count/offset locally.", "number"),
      p("df", "Display fields, default code,display."), p("sf", "Search fields; provider default code,short_desc,long_desc."),
      p("cf", "Returned code field; provider default code."), p("ef", "Parallel extra fields, optionally field:alias. Fields: code,short_desc,long_desc,display,add_dt,term_dt,act_eff_dt,obsolete,is_noc."),
      p("q", "Additional Elasticsearch query-string filter; not automatically wildcarded. Example is_noc:false."),
    ]},
    {method: "GET", path: "/hcpcs/search", category: "hcpcs", featured: true, summary: "Local single-page search retaining dates/flags, native arrays and explicit source/result limits.", queryParams: [
      p("terms", "Search text or code prefix.", "string", true), p("count", "1–500; default 25.", "number"),
      p("offset", "Zero-based offset; offset+count <=7500.", "number"), p("q", "Additional provider filter; supplied unchanged."),
    ]},
    {method: "GET", path: "/hcpcs/code/{code}", category: "hcpcs", featured: true,
      summary: "Local exact HCPCS Level II code match with source dates/flags and full native candidate response. A missing match does not establish global absence or historical invalidity.",
      pathParams: [p("code", "One letter and four digits, e.g. J0135; normalized to uppercase.", "string", true)]},
    {method: "GET", path: "/fhir/R4/ValueSet/hcpcs/$expand", category: "fhir",
      summary: "NLM's documented alternate HCPCS FHIR ValueSet expansion. Routed to the site's /fhir prefix, not /api. Preserves the native resource.", queryParams: [
        p("filter", "Optional text/word-prefix filter."), p("count", "1–500; default 7.", "number"),
        p("property", "HCPCS field or array of fields; encoded as repeated property parameters.", "array"),
        p("_format", "JSON only in this adapter; json, application/json or application/fhir+json."),
      ]},
  ],
  workflows: [
    {title: "HCPCS code dates and exact identity", description: "Retrieve one exact identifier with raw source dates and flags; make no coverage or historical billing-validity inference.", keywords: ["exact", "dates", "effective", "HCPCS"], code: "return await api.get('/hcpcs/code/J0135');"},
    {title: "Bounded HCPCS search with source context", description: "One page with original date fields and limits. Retain native arrays and next-offset candidate; reported totals do not establish completeness.", keywords: ["paging", "source", "HCPCS", "search"], code: "return await api.get('/hcpcs/search', {terms: 'wheelchair', count: 25, offset: 0});"},
    {title: "HCPCS FHIR expansion properties", description: "Obtain a native ValueSet expansion with source dates, retaining any supplied version and expansion timestamp. No archived release is implied.", keywords: ["FHIR", "ValueSet", "effective", "version"], code: "return await api.get('/fhir/R4/ValueSet/hcpcs/$expand', {filter: 'wheelchair', count: 25, property: ['add_dt', 'term_dt', 'act_eff_dt', 'obsolete', 'is_noc']});"},
  ],
};
