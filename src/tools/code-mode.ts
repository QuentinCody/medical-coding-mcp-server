/**
 * Medical-coding Code Mode — registers coding_search + coding_execute over NLM HCPCS.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { medicalCodingCatalog } from "../spec/catalog";
import { createMedicalCodingApiFetch } from "../lib/api-adapter";

interface CodeModeEnv {
	MEDICAL_CODING_DATA_DO: DurableObjectNamespace;
	CODE_MODE_LOADER: WorkerLoader;
}

/**
 * Register coding_search and coding_execute tools (NLM Clinical Tables HCPCS).
 */
export function registerCodeMode(server: McpServer, env: CodeModeEnv): void {
	const apiFetch = createMedicalCodingApiFetch();

	const searchTool = createSearchTool({
		prefix: "coding",
		catalog: medicalCodingCatalog,
	});
	searchTool.register(server as unknown as { tool: (...args: unknown[]) => void });

	const executeTool = createExecuteTool({
		prefix: "coding",
		// Verifiable provenance: coding_execute results carry a _meta.citation.
		source: { id: "coding", name: "Medical Coding (ICD/CPT/HCPCS)", url: "https://www.cms.gov/medicare/coding-billing" },
		catalog: medicalCodingCatalog,
		apiFetch,
		doNamespace: env.MEDICAL_CODING_DATA_DO,
		loader: env.CODE_MODE_LOADER,
	});
	executeTool.register(server as unknown as { tool: (...args: unknown[]) => void });
}
