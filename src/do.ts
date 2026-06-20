/**
 * MedicalCodingDataDO — staging DO for NLM Clinical Tables HCPCS responses.
 *
 * NLM returns a compact array shape ([total, [codes], hash, [[fields],...]]) and result
 * sets are small, so staging rarely triggers; no special schema hints are needed and the
 * base RestStagingDO inference handles any large staged payload generically.
 */

import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

export class MedicalCodingDataDO extends RestStagingDO {
	protected getSchemaHints(_data: unknown): SchemaHints | undefined {
		return undefined;
	}
}
