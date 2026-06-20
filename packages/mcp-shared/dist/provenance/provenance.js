/**
 * Provenance / citation primitives — shared across all MCP servers.
 *
 * Lets every tool result carry a verifiable citation: which upstream SOURCE it
 * came from, WHAT was asked (query hash), and a content hash of the result that
 * any consumer can recompute to confirm the cited bytes were not altered. A
 * connected agent can then attribute every claim to a re-verifiable source.
 *
 * This is the canonical home for canonicalJson/sha256Hex in `@bio-mcp/shared`
 * (the clinical-orchestrator's private copy in src/lib/audit-chain.ts should be
 * migrated onto these).
 */
/**
 * Canonicalize a JSON value so structurally-equivalent inputs produce an
 * identical string (and therefore an identical sha256): object keys sorted,
 * `undefined` dropped, array order preserved.
 */
export function canonicalJson(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value) ?? "null";
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
    }
    const entries = Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}
const HEX = "0123456789abcdef";
function bytesToHex(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        out += HEX[(b >> 4) & 0xf] + HEX[b & 0xf];
    }
    return out;
}
/** SHA-256 of a UTF-8 string, hex-encoded. */
export async function sha256Hex(input) {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return bytesToHex(new Uint8Array(digest));
}
function formatCitation(source, tool, retrievedAt, resultHash, recordCount) {
    const name = source.version ? `${source.name} ${source.version}` : source.name;
    let line = `${name} — ${tool}, retrieved ${retrievedAt}`;
    if (typeof recordCount === "number") {
        line += `, ${recordCount} record${recordCount === 1 ? "" : "s"}`;
    }
    line += `, sha256:${resultHash.slice(0, 12)}`;
    if (source.url)
        line += ` (${source.url})`;
    return line;
}
/** Build a verifiable citation for a tool result. */
export async function buildCitation(input) {
    const query_hash = await sha256Hex(canonicalJson(input.query));
    const result_hash = await sha256Hex(canonicalJson(input.result));
    return {
        source: input.source,
        server: input.server,
        tool: input.tool,
        retrieved_at: input.retrievedAt,
        query_hash,
        result_hash,
        ...(input.recordCount !== undefined ? { record_count: input.recordCount } : {}),
        ...(input.dataAccessId !== undefined ? { data_access_id: input.dataAccessId } : {}),
        text: formatCitation(input.source, input.tool, input.retrievedAt, result_hash, input.recordCount),
    };
}
/**
 * Recompute the content hash of `freshResult` and confirm it matches a
 * previously-issued `result_hash`. Uses the SAME canonicalization + sha256 as
 * {@link buildCitation}, so a citation's `result_hash` can be re-verified by any
 * consumer holding the (claimed) underlying data.
 */
export async function verifyResultHash(expectedHash, freshResult) {
    const actual_hash = await sha256Hex(canonicalJson(freshResult));
    return {
        verified: actual_hash === expectedHash,
        expected_hash: expectedHash,
        actual_hash,
    };
}
/**
 * Verify that `freshResult` reproduces the integrity anchor of a previously
 * issued {@link Citation}. Returns the same shape as {@link verifyResultHash}.
 */
export async function verifyCitation(citation, freshResult) {
    return verifyResultHash(citation.result_hash, freshResult);
}
//# sourceMappingURL=provenance.js.map