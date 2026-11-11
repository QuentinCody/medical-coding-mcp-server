/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { expect, it, vi } from "vitest";
vi.mock("cloudflare:workers", () => ({ RpcTarget: class {}, DurableObject: class { constructor(public ctx: unknown, public env: unknown) {} } }));
import { MedicalCodingDataDO } from "../do";
import { createApiProxyTool } from "@bio-mcp/shared/tools/api-proxy";
import { medicalCodingCatalog } from "../spec/catalog";
import { McpServer } from "@bio-mcp/shared/mcp";
import { verifyCitationEnvelope } from "@bio-mcp/shared";
import {createMedicalCodingApiFetch} from "../lib/api-adapter";
import { afterEach } from "vitest";
afterEach(() => vi.unstubAllGlobals());
import { registerQueryData } from "./query-data";

it("preserves mixed native date types and exact JSON rows through real SQLite and both query aliases", async () => {
  const db = new DatabaseSync(":memory:");
  let ready = Promise.resolve();
  const sql = { exec: (query: string, ...values: SQLInputValue[]) => {
    const rows = db.prepare(query).all(...values); const iterator = rows[Symbol.iterator]();
    return { toArray: () => rows, one: () => rows[0], next: () => iterator.next(), [Symbol.iterator]: () => iterator };
  } };
  const transactionSync = <T>(run: () => T): T => {
    db.exec("BEGIN");
    try { const value = run(); db.exec("COMMIT"); return value; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  };
  const ctx = { storage: { sql, transactionSync }, blockConcurrencyWhile: (run: () => Promise<void>) => { ready = run(); return ready; } };
  const instance = new MedicalCodingDataDO(ctx as unknown as DurableObjectState, {} as Cloudflare.Env);
  const namespace = { idFromName: (name: string) => name, get: () => ({ fetch: async (request: Request) => { await ready; return instance.fetch(request); } }) } as unknown as Env["MEDICAL_CODING_DATA_DO"];
  const codes = Array.from({length: 130}, (_, i) => `A${String(i).padStart(4, "0")}`);
  const native = [10000, codes, {
    add_dt: codes.map((_, i) => i < 100 ? "20050101" : 20050101),
    term_dt: codes.map((_, i) => i % 3 ? null : "20241231"),
    act_eff_dt: codes.map((_, i) => i < 100 ? null : 20250101),
    obsolete: codes.map((_, i) => i % 2 ? "false" : "true"),
    is_noc: codes.map(() => "false"), long_desc: codes.map(() => " α🧬| native text ".repeat(200)),
  }, codes.map(code => [code, " Description | with delimiter "])];
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(native)));
  const api = createMedicalCodingApiFetch();
  const expected = await api({method: "GET", path: "/hcpcs/search", params: {terms: "fixture", count: 130}});
  const proxy = createApiProxyTool({ apiFetch: api, catalog: medicalCodingCatalog, doNamespace: namespace, stagingPrefix: "coding", maxInlineBytes: 30720 });
  const server = new McpServer({ name: "fixture", version: "1" }); registerQueryData(server, { MEDICAL_CODING_DATA_DO: namespace });
  const tools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => Promise<any> }> })._registeredTools;
  try {
    const staged = await proxy.handler({ method: "GET", path: "/hcpcs/search", params: {terms: "fixture", count: 130} }, { sql: () => [] }) as { data_access_id: string };
    for (const prefix of ["", "mcp_"]) {
      const rows = async (query: string) => {
        const args = { data_access_id: staged.data_access_id, sql: query, limit: 100 };
        const result = await tools[`${prefix}coding_query_data`].handler(args, {});
        expect(result.isError, JSON.stringify(result)).not.toBe(true);
        const proof = await verifyCitationEnvelope({ citation: result.structuredContent._meta.citation, structuredContent: result.structuredContent, toolArguments: args });
        expect(proof.verification).toMatchObject({ query: "verified", result: "verified" });
        return result.structuredContent.data.rows;
      };
      const restored = await rows('SELECT code, add_dt, typeof(add_dt) AS date_type, obsolete FROM rows ORDER BY _rowid LIMIT 130');
      // The query tool defaults to 100 rows; inspect the late type transition separately.
      expect(restored[0]).toEqual({code: "A0000", add_dt: "20050101", date_type: "text", obsolete: "true"});
      expect((await rows("SELECT add_dt, typeof(add_dt) AS date_type FROM rows WHERE code = 'A0129'"))[0]).toEqual({add_dt: 20050101, date_type: "real"});
      const completeRows = (expected.data as {rows: Array<{row_json: string}>}).rows;
      for (const i of [0, 99, 129]) {
        let rowText = "";
        for (let start = 1; ; start += 2000) {
          const part = (await rows(`SELECT substr(row_json, ${start}, 2000) AS part FROM rows WHERE _rowid = ${i+1}`))[0].part;
          rowText += part; if ([...part].length < 2000) break;
        }
        expect(JSON.parse(rowText)).toEqual(JSON.parse(completeRows[i].row_json));
      }
      const root = (await rows("SELECT root_json FROM payloads ORDER BY id LIMIT 1"))[0].root_json;
      expect(root).toMatch(/^__CHUNKED__:/);
      const id = root.slice(12); expect(id).toMatch(/^chunk_[a-f0-9]+$/);
      let raw = "";
      const chunks = await rows(`SELECT chunk_index, length(chunk_data) AS n FROM content_chunks WHERE content_id = '${id}' ORDER BY chunk_index`);
      for (const chunk of chunks) {
        for (let start = 1; start <= chunk.n; start += 2000) raw += (await rows(`SELECT substr(chunk_data, ${start}, 2000) AS part FROM content_chunks WHERE content_id = '${id}' AND chunk_index = ${chunk.chunk_index}`))[0].part;
      }
      const decoded = JSON.parse(raw);
      const recovered = typeof decoded === "string" ? JSON.parse(decoded) : decoded;
      expect(recovered.native).toEqual(native);
      expect(recovered.rows).toEqual((expected.data as {rows: unknown[]}).rows);
      expect(recovered._hcpcs).toMatchObject({complete: false, dataset_version: null});
    }
  } finally { db.close(); }
});
