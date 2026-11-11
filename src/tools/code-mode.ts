import type { McpServer } from "@bio-mcp/shared/mcp";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { medicalCodingCatalog } from "../spec/catalog";
import { createMedicalCodingApiFetch } from "../lib/api-adapter";
import { codingResponse } from "../lib/tool-result";

/**
 * Interface matching what createSearchTool/createExecuteTool .register() expects.
 * The shared lib calls server.tool(name, description, schema, handler).
 */
interface ToolRegisterable {
    tool: (...args: unknown[]) => void;
}

function toRegisterable(server: McpServer, env: CodeModeEnv): ToolRegisterable {
    return {
        tool(...args: unknown[]) {
            const [base, ...rest] = args;
            const handler = rest.pop() as (input: unknown, extra: unknown) => ReturnType<typeof codingResponse>;
            for (const name of [String(base), `mcp_${String(base)}`]) {
                const respond = (input: unknown, extra: unknown) => codingResponse(() => handler(input, extra), env, name, extra, input);
                Function.prototype.apply.call(server.tool, server, [name, ...rest, respond]);
            }
        },
    };
}

/** Minimal shape required from the worker Env for Code Mode registration. */
interface CodeModeEnv {
    MEDICAL_CODING_DATA_DO: Pick<Env["MEDICAL_CODING_DATA_DO"], "get" | "idFromName">;
    CODE_MODE_LOADER: Env["CODE_MODE_LOADER"];
}

export function registerCodeMode(server: McpServer, env: CodeModeEnv): void {
    const doNamespace = env.MEDICAL_CODING_DATA_DO;
    const loader = env.CODE_MODE_LOADER;


    const apiFetch = createMedicalCodingApiFetch();
    const registerable = toRegisterable(server, env);

    const searchTool = createSearchTool({
        prefix: "coding",
        catalog: medicalCodingCatalog,
    });
    searchTool.register(registerable);

    const executeTool = createExecuteTool({
        prefix: "coding",
        // Verifiable provenance: coding_execute results carry a _meta.citation.
        source: { id: "coding", name: "NLM Clinical Tables HCPCS Level II", url: "https://clinicaltables.nlm.nih.gov/apidoc/hcpcs/v3/doc.html", license: "CMS HCPCS Level II public data" },
        catalog: medicalCodingCatalog,
        apiFetch,
        preserveApiErrors: true,
        maxInlineBytes: 30 * 1024,
        stagingThreshold: 30 * 1024,
        timeout: 60000,
        doNamespace,
        loader,
    });
    executeTool.register(registerable);
}
