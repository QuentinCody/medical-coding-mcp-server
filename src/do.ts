/**
 * MedicalCodingDataDO — staging DO for NLM Clinical Tables HCPCS responses.
 *
 * NLM's raw date fields mix JSON strings, numbers and nulls. SQLite BLOB
 * affinity keeps those scalar storage types instead of converting date strings
 * to integers. row_json preserves full JSON types, arrays and booleans.
 */

import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

export class MedicalCodingDataDO extends RestStagingDO {
	protected getSchemaHints(data: unknown): SchemaHints | undefined {
    if (!data || typeof data !== "object" || Array.isArray(data) ||
      !("rows" in data) || !Array.isArray(data.rows) ||
      !("_hcpcs" in data)) return undefined;
    return { columnTypes: { code: "TEXT", add_dt: "BLOB", term_dt: "BLOB",
      act_eff_dt: "BLOB", obsolete: "BLOB", is_noc: "BLOB", row_json: "TEXT" } };
	}
}
