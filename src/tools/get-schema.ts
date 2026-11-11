import type { McpServer } from "@bio-mcp/shared/mcp";
import { z } from "zod";
import { createGetSchemaHandler } from "@bio-mcp/shared/staging/utils";
import { codingResponse } from "../lib/tool-result";

interface GetSchemaArgs {
    data_access_id?: string;
}

interface ExtraWithEnvAndSession {
    env?: Partial<Env>;
    sessionId?: string;
}

export function registerGetSchema(server: McpServer, env?: Partial<Env>): void {
    const handler = createGetSchemaHandler("MEDICAL_CODING_DATA_DO", "coding");

    for (const name of ["coding_get_schema", "mcp_coding_get_schema"]) server.registerTool(
        name,
        {
            title: "Get Staged Data Schema",
            description:
                "Get schema information for staged NLM Clinical Tables HCPCS Level II data. Shows table structures and row counts. " +
                "If called without a data_access_id, lists all staged datasets available in this session.",
            inputSchema: {
                data_access_id: z.string().min(1).optional().describe(
                    "Data access ID for the staged dataset. If omitted, lists all staged datasets in this session.",
                ),
            },
        },
        async (args: GetSchemaArgs, extra) => {
            const typedExtra = extra as ExtraWithEnvAndSession;
            const runtimeEnv = env ?? typedExtra.env ?? {};
            const handlerArgs: Record<string, unknown> = {
                data_access_id: args.data_access_id,
            };
            return codingResponse(() => handler(handlerArgs, runtimeEnv, extra as Record<string, unknown>), runtimeEnv, name, extra, args);
        },
    );
}
