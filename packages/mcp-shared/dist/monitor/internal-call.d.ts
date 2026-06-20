/**
 * Monitoring primitive — in-fabric tool call.
 *
 * Re-runs a monitored {server, tool, params} query by calling the target
 * server's MyMCP Durable Object directly over the agents-SDK RPC method
 * (`handleMcpMessage`), NOT over its public /mcp endpoint. A cross-script DO
 * stub bypasses the Worker's public route entirely, so the unauthenticated
 * public surface is never touched and no MCP handshake is needed.
 *
 * Returns the tool's raw `structuredContent` (or parsed text content); each
 * source module's profile handles its own response envelope (e.g. Code Mode
 * execute wraps the payload under `data` with volatile `_meta`).
 */
/** Minimal shape of a target server's MyMCP DO stub (agents SDK RPC). */
export interface McpRpcStub {
    handleMcpMessage(message: unknown): Promise<McpRpcResponse | undefined>;
}
/** The JSON-RPC response shape we read from a tools/call. */
export interface McpRpcResponse {
    result?: {
        structuredContent?: unknown;
        content?: Array<{
            type: string;
            text?: string;
        }>;
        isError?: boolean;
    };
    error?: {
        code: number;
        message: string;
    };
}
/** Build a JSON-RPC `tools/call` message for one tool invocation. */
export declare function buildToolCall(tool: string, params: Record<string, unknown>, id: number): {
    jsonrpc: string;
    id: number;
    method: string;
    params: {
        name: string;
        arguments: Record<string, unknown>;
    };
};
/**
 * Extract the structuredContent (or parsed text content) from a tools/call
 * response. Throws on a transport error, a missing result, or a tool-level
 * error, so the caller never hashes an error envelope as if it were data.
 */
export declare function parseToolResult(resp: McpRpcResponse | undefined): unknown;
/** Call a tool on a target server's MyMCP DO stub and return its structuredContent. */
export declare function callTool(stub: McpRpcStub, tool: string, params: Record<string, unknown>, id: number): Promise<unknown>;
//# sourceMappingURL=internal-call.d.ts.map