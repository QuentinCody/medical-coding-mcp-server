import {afterEach, expect, it, vi} from "vitest";
import {McpServer} from "@bio-mcp/shared/mcp";
import {createApiProxyTool} from "@bio-mcp/shared/tools/api-proxy";
import {registerCodeMode} from "./code-mode";
import {registerGetSchema} from "./get-schema";
import {registerQueryData} from "./query-data";
import {medicalCodingCatalog} from "../spec/catalog";
import {createMedicalCodingApiFetch} from "../lib/api-adapter";
const json = (data: unknown) => new Response(JSON.stringify(data), {headers: {"Content-Type": "application/json"}});
afterEach(() => vi.unstubAllGlobals());
it("registers all four tools under both aliases with both fields on success/error", async () => {
  const server = new McpServer({name: "fixture", version: "1"});
  registerCodeMode(server, {CODE_MODE_LOADER: {get: () => ({})}} as unknown as Parameters<typeof registerCodeMode>[1]);
  registerGetSchema(server, {}); registerQueryData(server, {});
  const tools = (server as unknown as {_registeredTools: Record<string, {handler: (args: unknown, extra: unknown) => Promise<unknown>}>})._registeredTools;
  for (const suffix of ["search", "execute", "query_data", "get_schema"]) {
    expect(tools[`coding_${suffix}`]).toBeDefined(); expect(tools[`mcp_coding_${suffix}`]).toBeDefined();
  }
  expect(await tools.coding_search.handler({query: "HCPCS", max_results: 5}, {})).toMatchObject({content: expect.any(Array), structuredContent: {success: true}});
  expect(await tools.mcp_coding_query_data.handler({data_access_id: "fixture", sql: "SELECT 1"}, {})).toMatchObject({isError: true, content: expect.any(Array), structuredContent: expect.any(Object)});
});
it("stages source/date context with complete native compact arrays", async () => {
  const codes = Array.from({length: 100}, (_, i) => "A" + String(i).padStart(4, "0"));
  const native = [10000, codes, {long_desc: codes.map(() => "α".repeat(500)), add_dt: codes.map(() => "20260101"), obsolete: codes.map(() => false)}, codes.map(code => [code, "Synthetic"]), codes.map(() => "HCPCS")];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(native)));
  const stored: unknown[] = [];
  const namespace = {idFromName: (name: string) => name, get: () => ({fetch: async (request: Request) => {
    if (new URL(request.url).pathname === "/process") { stored.push((await request.json() as {data: unknown}).data); return json({success: true, tables_created: ["payloads"], total_rows: 1}); }
    return json({success: true, schema: {tables: {payloads: {columns: [{name: "root_json"}]}}}});
  }})} as unknown as DurableObjectNamespace;
  const proxy = createApiProxyTool({apiFetch: createMedicalCodingApiFetch(), catalog: medicalCodingCatalog, doNamespace: namespace, stagingPrefix: "coding", maxInlineBytes: 30 * 1024});
  const result = await proxy.handler({method: "GET", path: "/hcpcs/search", params: {terms: "x", count: 100}}, {sql: () => []});
  expect(result).toMatchObject({__staged: true, data_access_id: expect.any(String)});
  expect(JSON.parse(stored[0] as string)).toMatchObject({native, _hcpcs: {complete: false, dataset_version: null, missing_extra_fields: ["term_dt", "act_eff_dt", "is_noc"]}});
  expect(new TextEncoder().encode(JSON.stringify(result)).length).toBeLessThan(100000);
});
it("propagates invalid pagination as an incomplete API error", async () => {
  const proxy = createApiProxyTool({apiFetch: createMedicalCodingApiFetch(), catalog: medicalCodingCatalog, stagingPrefix: "coding"});
  expect(await proxy.handler({method: "GET", path: "/hcpcs/search", params: {terms: "x", count: 500, offset: 7400}}, {sql: () => []})).toMatchObject({__api_error: true, incomplete: true, status: 400});
});
