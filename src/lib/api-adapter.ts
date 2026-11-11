import type { Completeness } from "@bio-mcp/shared";
import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import {codingFetch, fail, ORIGIN} from "./http";

const FIELDS = ["code", "short_desc", "long_desc", "display", "add_dt", "term_dt", "act_eff_dt", "obsolete", "is_noc"];
const CONTEXT_FIELDS = ["add_dt", "term_dt", "act_eff_dt", "obsolete", "is_noc", "long_desc"];
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function integer(value: unknown, fallback: number, min: number, max: number, name: string) {
  const v = value ?? fallback;
  if (!["number", "string"].includes(typeof v) || !/^\d+$/.test(String(v)) || Number(v) < min || Number(v) > max) fail(`Invalid ${name}`);
  return Number(v);
}
function validateFields(value: unknown, aliases = false) {
  if (typeof value !== "string" || value.length > 1000 || value.split(",").some(field => {
    const [name, alias, ...rest] = field.split(":");
    return !FIELDS.includes(name) || rest.length > 0 || (alias !== undefined && (!aliases || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(alias)));
  })) fail("Unsupported HCPCS field list");
}
export function searchParams(input: Record<string, unknown>) {
  const params = {...input};
  if (Object.keys(params).some(key => !["terms", "maxList", "count", "offset", "df", "sf", "ef", "cf", "q"].includes(key))) fail("Unsupported HCPCS search parameter");
  if (typeof params.terms !== "string" || !params.terms.trim() || params.terms.length > 2000) fail("terms is required");
  if (params.maxList !== undefined && (params.count !== undefined || params.offset !== undefined)) fail("Use count/offset for paging or maxList for autocomplete, not both");
  if (params.maxList !== undefined) params.maxList = params.maxList === "" ? 500 : integer(params.maxList, 7, 1, 500, "maxList");
  else { params.count = integer(params.count, 7, 1, 500, "count"); params.offset = integer(params.offset, 0, 0, 7499, "offset");
    if (Number(params.offset) + Number(params.count) > 7500) fail("NLM offset + count cannot exceed 7500");
  }
  for (const key of ["df", "sf", "ef"]) if (params[key] !== undefined) validateFields(params[key], key === "ef");
  if (params.cf !== undefined && (typeof params.cf !== "string" || !FIELDS.includes(params.cf))) fail("Unsupported cf field");
  if (params.q !== undefined && (typeof params.q !== "string" || params.q.length > 2000)) fail("Invalid q");
  return params;
}
export function compactResponse(value: unknown) {
  if (!Array.isArray(value) || value.length < 4 || !Number.isInteger(value[0]) || value[0] < 0 || !Array.isArray(value[1]) || !Array.isArray(value[3]) || value[1].length !== value[3].length || value[3].some(row => !Array.isArray(row))) fail("Invalid NLM compact-array response", 502);
  const extras = value[2];
  if (extras !== null && (!object(extras) || Object.values(extras).some(column => !Array.isArray(column) || column.length !== value[1].length))) fail("NLM extra-field arrays are misaligned", 502);
  if (value[4] !== undefined && (!Array.isArray(value[4]) || value[4].length !== value[1].length)) fail("NLM code-system array is misaligned", 502);
  return value as [number, unknown[], Record<string, unknown[]> | null, unknown[][], unknown[]?];
}
export function hcpcsCompleteness(returned: number): Completeness {
  return { complete: false, returned, truncation: { reason: "upstream_cap",
    detail: "One bounded NLM response; reported totals can undercount and do not prove exhaustive retrieval.",
    remedy: "For compact search, follow the bounded offset/count candidates. FHIR expansion has no pagination on this route." } };
}
function provenance(params: Record<string, unknown>, total: number, returned: number) {
  const count = Number(params.count ?? params.maxList ?? 7); const offset = Number(params.offset ?? 0);
  return {
    source: "CMS HCPCS Level II via NLM Clinical Tables", source_url: `${ORIGIN}/api/hcpcs/v3/search`,
    retrieved_at: new Date().toISOString(), api_version: "v3", dataset_version: null,
    dataset_version_status: "Not supplied by the compact search response; API v3 is not a code-set release.",
    documentation_observation: {data_version: "October 2026", observed_on: "2026-10-03", source_url: `${ORIGIN}/index.html`, response_release_verified: false},
    request: params, reported_total: total, reported_total_is_exact: false, returned, offset, count,
    provider_reported_total_cap: 10000, provider_retrieval_limit: 7500,
    retrieval_window_exhausted: offset + count >= 7500,
    next_offset_candidate: params.maxList === undefined && returned === count && offset + count < 7500 ? offset + count : null,
    next_count_candidate: params.maxList === undefined && returned === count && offset + count < 7500 ? Math.min(count, 7500 - offset - count) : null,
    complete: false,
    date_semantics: "add_dt, term_dt and act_eff_dt are preserved exactly as supplied. They are code-level fields, not dataset release dates. No historical validity, coverage or payment determination is inferred.",
  };
}
export function createMedicalCodingApiFetch(): ApiFetchFn {
  return async request => {
    if (request.method !== "GET" || request.body !== undefined) fail("HCPCS supports read-only GET requests");
    const input = {...request.params};
    if (request.path === "/fhir/R4/ValueSet/hcpcs/$expand") {
      return await expandHcpcsValueSet(input, request);
    }
    const exact = /^\/hcpcs\/code\/([A-Za-z]\d{4})$/.exec(request.path);
    const contextual = request.path === "/hcpcs/search" || !!exact;
    if (!contextual && request.path !== "/hcpcs/v3/search") fail("Unsupported HCPCS path");
    let params: Record<string, unknown>;
    if (exact) {
      if (Object.keys(input).length) fail("Exact-code lookup takes no query parameters");
      const code = exact[1].toUpperCase();
      params = {terms: code, sf: "code", q: `code:${code}`, count: 500, offset: 0};
    } else if (contextual) {
      if (Object.keys(input).some(key => !["terms", "count", "offset", "q"].includes(key))) fail("Contextual search accepts terms/count/offset/q");
      params = {...input, count: input.count ?? 25};
    } else params = input;
    if (contextual) { params.df = "code,display"; params.ef = CONTEXT_FIELDS.join(","); }
    params = searchParams(params);
    const native = compactResponse(await codingFetch("/api/hcpcs/v3/search", params));
    if (native[1].length > Number(params.count ?? params.maxList)) fail("NLM exceeded requested page size", 502);
    if (!contextual) return {status: 200, data: native, completeness: hcpcsCompleteness(native[1].length)};
    return buildHcpcsSearchResult(native, exact, params);
  };
}

function buildHcpcsSearchResult(native: [number, unknown[], Record<string, unknown[]> | null, unknown[][], (unknown[] | undefined)?], exact: RegExpExecArray | null, params: Record<string, unknown>) {
  const rows = native[1].map((code, index) => {
    if (typeof code !== "string") fail("NLM code column is not textual", 502);
    const row = {
      code, display_fields: native[3][index],
      ...Object.fromEntries(CONTEXT_FIELDS.map(field => [field, native[2]?.[field]?.[index] ?? null])),
      ...(native[4] ? { code_system: native[4][index] } : {}),
    };
    // An exact JSON row view complements SQLite scalar/array conventions.
    return { ...row, row_json: JSON.stringify(row) };
  });
  const matches = exact ? rows.filter(row => row.code.toUpperCase() === exact[1].toUpperCase()) : rows;
  return {
    status: 200, completeness: hcpcsCompleteness(matches.length), data: {
      rows: matches, native,
      ...(exact ? { requested_code: exact[1].toUpperCase(), exact_match_found: matches.length > 0, absence_established: false } : {}),
      _hcpcs: { ...provenance(params, native[0], native[1].length), missing_extra_fields: CONTEXT_FIELDS.filter(field => !native[2] || !(field in native[2])) }
    }
  };
}

async function expandHcpcsValueSet(input: { [x: string]: unknown; }, request: Parameters<ApiFetchFn>[0]) : Promise<Awaited<ReturnType<ApiFetchFn>>> {
  if (Object.keys(input).some(key => !["filter", "count", "property", "_format"].includes(key))) fail("Unsupported HCPCS FHIR expansion parameter");
  input.count = integer(input.count, 7, 1, 500, "count");
  if (input._format !== undefined && !["json", "application/json", "application/fhir+json"].includes(String(input._format))) fail("FHIR route supports JSON output");
  input._format = "json";
  if (input.filter !== undefined && (typeof input.filter !== "string" || input.filter.length > 2000)) fail("Invalid FHIR filter");
  if (input.property !== undefined) {
    const properties = Array.isArray(input.property) ? input.property : [input.property];
    if (properties.length > FIELDS.length || properties.some(p => typeof p !== "string" || !FIELDS.includes(p))) fail("Unsupported FHIR property");
  }
  const data = await codingFetch(request.path, input);
  if (!object(data) || data.resourceType !== "ValueSet" || !object(data.expansion)) fail("NLM returned an error or invalid ValueSet expansion", 502);
  const concepts = data.expansion.contains;
  if (concepts !== undefined && (!Array.isArray(concepts) || concepts.some(concept => !object(concept)))) fail("Invalid NLM expansion concepts", 502);
  const returned = Array.isArray(concepts) ? concepts.length : 0;
  if (returned > Number(input.count)) fail("NLM exceeded requested expansion size", 502);
  return { status: 200, data, completeness: hcpcsCompleteness(returned) };
}
