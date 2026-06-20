/**
 * Verify-citation tool factory — a shared MCP tool that re-checks the integrity
 * anchor of a previously-issued citation.
 *
 * A {@link Citation} (see `../provenance/provenance`) carries
 * `result_hash = sha256(canonicalJson(result))`. This tool recomputes that hash
 * from data the caller (re-)supplies and reports whether it matches — letting an
 * agent prove that cited bytes were not altered, using the SAME canonicalization
 * + sha256 that produced the citation.
 *
 * Registered under two names (`verify_citation` + `mcp_verify_citation`) to match
 * the repo's dual-registration convention for discoverability across clients.
 */
import { z } from "zod";
/** The Zod input schema for the verify-citation tool. */
export interface VerifyCitationSchema {
    expected_hash: z.ZodString;
    data: z.ZodUnknown;
}
export interface VerifyCitationToolResult {
    /** Primary registered tool name. */
    name: string;
    /** Human/agent-readable description. */
    description: string;
    /** Zod input schema (raw shape passed to `server.tool`). */
    schema: VerifyCitationSchema;
    /** Register the tool (and its `mcp_` alias) on an MCP server. */
    register: (server: {
        tool: (...args: unknown[]) => void;
    }) => void;
}
/**
 * Create a registerable `verify_citation` tool.
 *
 * Input: `{ expected_hash: string, data: <arbitrary JSON> }`.
 * Output (structuredContent.data): `{ verified, expected_hash, actual_hash }`.
 */
export declare function createVerifyCitationTool(): VerifyCitationToolResult;
//# sourceMappingURL=verify-citation-tool.d.ts.map