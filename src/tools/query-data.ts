import type { McpServer } from "@bio-mcp/shared/mcp";
import { z } from "zod";
import { createQueryDataHandler } from "@bio-mcp/shared/staging/utils";
import { codingResponse } from "../lib/tool-result";

interface QueryDataArgs {
    data_access_id: string;
    sql: string;
    limit?: number;
}

interface ExtraWithEnv {
    env?: Partial<Env>;
}

export function registerQueryData(server: McpServer, env?: Partial<Env>): void {
    const handler = createQueryDataHandler("MEDICAL_CODING_DATA_DO", "coding");

    for (const name of ["coding_query_data", "mcp_coding_query_data"]) server.registerTool(
        name,
        {
            title: "Query Staged HCPCS Data",
            description:
                "Query staged NLM Clinical Tables HCPCS Level II data using SQL. Use this when responses are too large and have been staged with a data_access_id; row_json retains exact source field types and display arrays.",
            inputSchema: {
                data_access_id: z.string().min(1).describe("Data access ID for the staged dataset"),
                sql: z.string().min(1).describe("SQL query to execute against the staged data"),
                limit: z.number().int().positive().max(10000).default(100).optional().describe("Maximum number of rows to return (default: 100)"),
            },
        },
        async (args: QueryDataArgs, extra) => {
            const runtimeEnv = env ?? (extra as ExtraWithEnv).env ?? {};
            const handlerArgs: Record<string, unknown> = {
                data_access_id: args.data_access_id,
                sql: args.sql,
                limit: args.limit,
            };
            return codingResponse(() => handler(handlerArgs, runtimeEnv), runtimeEnv, name, extra, args);
        },
    );
}
