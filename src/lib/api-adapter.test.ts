import {afterEach, expect, it, vi} from "vitest";
import {createMedicalCodingApiFetch, compactResponse} from "./api-adapter";
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {"content-type": "application/json"}});
const native = [10000, ["J0135", "J01350"], {add_dt: ["20030101", null], term_dt: [null, "20251231"], act_eff_dt: ["20260101", "20250101"], obsolete: [false, true], is_noc: [false, false], long_desc: ["Synthetic one", "Synthetic prefix"]}, [["J0135", "One"], ["J01350", "Prefix"]], ["HCPCS", "HCPCS"]];
afterEach(() => vi.unstubAllGlobals());
it("retains native compact arrays, aliases and optional code systems", async () => {
  const response = [2, [false, true], {alias: [{nested: true}, null]}, [["one"], ["two"]], ["HCPCS", "HCPCS"]];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(response)));
  expect(await createMedicalCodingApiFetch()({method: "GET", path: "/hcpcs/v3/search", params: {terms: "air", cf: "obsolete", ef: "long_desc:alias"}})).toMatchObject({status: 200, data: response, completeness: {complete: false, returned: 2}});
});
it("preserves dates/flags without converting them into historical validity or a source release", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(native)));
  const result = await createMedicalCodingApiFetch()({method: "GET", path: "/hcpcs/search", params: {terms: "test", count: 2}});
  expect(result.data).toMatchObject({native, rows: [{code: "J0135", add_dt: "20030101", term_dt: null, act_eff_dt: "20260101", obsolete: false, is_noc: false, code_system: "HCPCS"}, {code: "J01350", obsolete: true}], _hcpcs: {dataset_version: null, reported_total: 10000, reported_total_is_exact: false, complete: false, next_offset_candidate: 2}});
});
it("post-filters exact identity and preserves candidates excluded by the filter", async () => {
  const fetcher = vi.fn().mockResolvedValue(json(native)); vi.stubGlobal("fetch", fetcher);
  const result = await createMedicalCodingApiFetch()({method: "GET", path: "/hcpcs/code/j0135"});
  expect(result.data).toMatchObject({requested_code: "J0135", exact_match_found: true, absence_established: false, rows: [{code: "J0135"}], native});
  expect((result.data as {rows: unknown[]}).rows).toHaveLength(1);
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.searchParams.get("q")).toBe("code:J0135"); expect(url.searchParams.get("ef")).toContain("act_eff_dt");
});
it("does not establish absence for zero exact matches", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json([0, [], null, []])));
  expect((await createMedicalCodingApiFetch()({method: "GET", path: "/hcpcs/code/J0135"})).data).toMatchObject({exact_match_found: false, absence_established: false, _hcpcs: {complete: false}});
});
it("marks the retrieval window separately from count completeness", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(native)));
  expect((await createMedicalCodingApiFetch()({method: "GET", path: "/hcpcs/search", params: {terms: "x", count: 2, offset: 7498}})).data).toMatchObject({_hcpcs: {retrieval_window_exhausted: true, next_offset_candidate: null, complete: false}});
});
it("does not turn a short page into a complete dataset claim", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(native)));
  expect((await createMedicalCodingApiFetch()({method: "GET", path: "/hcpcs/search", params: {terms: "x"}})).data).toMatchObject({_hcpcs: {next_offset_candidate: null, complete: false}});
});
it("encodes repeated FHIR properties and retains native version/expansion context", async () => {
  const resource = {resourceType: "ValueSet", version: "fixture-version", expansion: {identifier: "fixture", timestamp: "2026-09-28", total: 10000, contains: [{code: "E0001", property: [{code: "add_dt", valueString: "20260101"}]}]}};
  const fetcher = vi.fn().mockResolvedValue(json(resource)); vi.stubGlobal("fetch", fetcher);
  expect((await createMedicalCodingApiFetch()({method: "GET", path: "/fhir/R4/ValueSet/hcpcs/$expand", params: {filter: "A&B", count: 25, property: ["add_dt", "term_dt"]}})).data).toEqual(resource);
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.pathname).toBe("/fhir/R4/ValueSet/hcpcs/$expand"); expect(url.searchParams.getAll("property")).toEqual(["add_dt", "term_dt"]); expect(url.searchParams.get("filter")).toBe("A&B");
  expect(fetcher.mock.calls[0][1]).toMatchObject({redirect: "manual"});
});
it.each([
  {method: "POST", path: "/hcpcs/search"}, {method: "GET", path: "https://evil.example"},
  {method: "GET", path: "/hcpcs/code/99213"}, {method: "GET", path: "/hcpcs/code/J0135", params: {q: "x"}},
  {method: "GET", path: "/hcpcs/search", params: {terms: "x", count: 501}},
  {method: "GET", path: "/hcpcs/search", params: {terms: "x", offset: 7499, count: 2}},
  {method: "GET", path: "/hcpcs/search", params: {terms: "x", df: "display"}},
  {method: "GET", path: "/hcpcs/v3/search", params: {terms: "x", maxList: 5, count: 5}},
  {method: "GET", path: "/hcpcs/v3/search", params: {terms: "x", ef: "made_up"}},
  {method: "GET", path: "/hcpcs/v3/search", params: {terms: "x", q: {unsafe: true}}},
  {method: "GET", path: "/hcpcs/v3/search", params: {terms: ""}},
  {method: "GET", path: "/fhir/R4/ValueSet/hcpcs/$expand", params: {offset: 500}},
  {method: "GET", path: "/fhir/R4/ValueSet/hcpcs/$expand", params: {_format: "xml"}},
  {method: "GET", path: "/fhir/R4/ValueSet/hcpcs/$expand", params: {property: "unknown"}},
])("rejects unsupported requests before network %#", async request => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(createMedicalCodingApiFetch()(request)).rejects.toMatchObject({status: 400}); expect(fetcher).not.toHaveBeenCalled();
});
it.each([[1, ["A0001"], null, []], [1, ["A0001"], {add_dt: []}, [["A"]]], [1, ["A0001"], null, [["A"]], []], {error: "not found"}])("rejects malformed/misaligned compact responses %#", data => expect(() => compactResponse(data)).toThrow());
it("supports the documented empty maxList meaning 500", async () => {
  const fetcher = vi.fn().mockResolvedValue(json([0, [], null, []])); vi.stubGlobal("fetch", fetcher);
  await createMedicalCodingApiFetch()({method: "GET", path: "/hcpcs/v3/search", params: {terms: "x", maxList: ""}});
  expect(fetcher.mock.calls[0][0].searchParams.get("maxList")).toBe("500");
});
it("treats OperationOutcome as an error, not an empty expansion", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({resourceType: "OperationOutcome", issue: [{severity: "error"}]})));
  await expect(createMedicalCodingApiFetch()({method: "GET", path: "/fhir/R4/ValueSet/hcpcs/$expand"})).rejects.toMatchObject({status: 502});
});
it.each([404, 429, 500])("does not mask HTTP %s", async status => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({error: "error"}, status)));
  await expect(createMedicalCodingApiFetch()({method: "GET", path: "/hcpcs/search", params: {terms: "x"}})).rejects.toMatchObject({status});
});
it("bounds response bytes and rejects invalid JSON", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("x".repeat(4 * 1024 * 1024 + 1))).mockResolvedValueOnce(new Response("<html>error</html>")));
  const api = createMedicalCodingApiFetch(); const request = {method: "GET", path: "/hcpcs/search", params: {terms: "x"}};
  await expect(api(request)).rejects.toThrow("4 MiB"); await expect(api(request)).rejects.toThrow("invalid JSON");
});
it.each(["/hcpcs/search", "/hcpcs/v3/search", "/hcpcs/code/J0135"])("keeps canonical completeness conservative for %s", async path => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(native)));
  const result = await createMedicalCodingApiFetch()({method: "GET", path, ...(path.includes('/code/') ? {} : {params: {terms: "x"}})});
  expect(result.completeness).toMatchObject({complete: false, truncation: {reason: "upstream_cap"}});
  expect(result.completeness).not.toHaveProperty("total_available");
});
it("retains the mixed source scalar types and row JSON without manufacturing a response release", async () => {
  const source = [2, ["A0001", "A0002"], {add_dt: ["20050101", 20050101], term_dt: [null, "20241231"], obsolete: ["false", "true"], is_noc: [false, true]}, [["A0001", "a | b"], ["A0002", " padded "]]];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(source)));
  const result = await createMedicalCodingApiFetch()({method: "GET", path: "/hcpcs/search", params: {terms: "x"}});
  const data = result.data as {rows: Array<{row_json: string; [key: string]: unknown}>};
  for (const row of data.rows) { const {row_json, ...fields} = row; expect(JSON.parse(row_json)).toEqual(fields); }
  expect(data.rows.map(row => row.add_dt)).toEqual(["20050101", 20050101]);
  expect(result.data).toMatchObject({_hcpcs: {dataset_version: null, documentation_observation: {data_version: "October 2026", response_release_verified: false}}});
});
it("keeps an unversioned native FHIR response unversioned and incomplete", async () => {
  const resource = {resourceType: "ValueSet", expansion: {timestamp: "2026-10-03", total: 0}};
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(resource)));
  const result = await createMedicalCodingApiFetch()({method: "GET", path: "/fhir/R4/ValueSet/hcpcs/$expand"});
  expect(result.data).toEqual(resource);
  expect(result.completeness).toMatchObject({complete: false, returned: 0});
});
it.each(["/hcpcs/v3/search", "/fhir/R4/ValueSet/hcpcs/$expand"])("rejects an overfull upstream page for %s", async path => {
  const resource = path.startsWith('/fhir') ? {resourceType: "ValueSet", expansion: {contains: [{code: "A0001"}, {code: "A0002"}]}} : native;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(resource)));
  await expect(createMedicalCodingApiFetch()({method: "GET", path, params: path.startsWith('/fhir') ? {count: 1} : {terms: "x", count: 1}})).rejects.toMatchObject({status: 502});
});
