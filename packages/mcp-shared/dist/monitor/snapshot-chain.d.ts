/**
 * Monitoring primitive — snapshot hash-chain (provenance ledger).
 *
 * Generalizes the clinical-orchestrator tamper-evident audit chain (Tier A)
 * onto the shared provenance primitives. Each snapshot row commits to:
 *   (a) `payload_hash` = sha256 of the stored snapshot bytes, and
 *   (b) `prev_hash`    = the previous row's entry hash (a classic hash chain),
 * with `content_hash` (the order-independent semantic hash) also covered by the
 * entry hash. Any post-hoc edit, deletion, or reorder breaks the chain and is
 * pinpointed by {@link verifyChainRows}.
 *
 * Scope (Tier A) — tamper-EVIDENCE, not tamper-PROOFING: no signing, no external
 * anchoring (an actor who can rewrite the whole table can recompute a consistent
 * chain). Signing + anchoring are deliberate Tier B/C follow-ups.
 *
 * The chain is single-homed in one MonitorDO, so the module-level append lock +
 * the (subscription_id, seq) PK give fork-free appends. Reuses canonicalJson /
 * sha256Hex from @bio-mcp/shared/provenance — do NOT make a third copy.
 */
/** Genesis link for the first row in a chain (no predecessor). */
export declare const GENESIS_HASH: string;
/** A `ctx.storage.sql` tagged-template runner (rows returned as objects). */
export type SqlRunner = <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]) => T[];
export interface SnapshotInput {
    subscriptionId: string;
    /** sha256(canonicalJson({server,tool,params})) — attests WHAT was monitored. */
    queryDescriptorHash: string;
    /** Order-independent semantic hash of the keyed result (the no-change gate). */
    contentHash: string;
    /** canonicalJson(cleaned result) — the snapshot bytes. */
    payloadJson: string;
    /** The diff vs the prior snapshot, serialized (null for the baseline snapshot). */
    diffJson?: string | null;
}
export interface SnapshotRow {
    seq: number;
    subscription_id: string;
    query_descriptor_hash: string;
    content_hash: string;
    payload_json: string;
    payload_hash: string;
    diff_json: string | null;
    prev_hash: string;
    entry_hash: string;
    created_at: string;
}
/** Compute the chained entry hash for a fully-populated row. */
export declare function computeEntryHash(row: SnapshotRow): Promise<string>;
/**
 * Build (but do not persist) the next chain row given the current tail. Pure
 * and deterministic except for created_at, which can be pinned via `opts` for
 * testing. Exposed so tests exercise the real hashing path without a SQL layer.
 */
export declare function buildSnapshotRow(prevSeq: number, prevHash: string, input: SnapshotInput, opts?: {
    createdAt?: string;
}): Promise<SnapshotRow>;
export interface ChainVerifyResult {
    valid: boolean;
    count: number;
    /** entry_hash of the last verified row (or GENESIS_HASH for an empty chain). */
    head: string;
    /** seq of the first row that failed verification, if any. */
    brokenSeq?: number;
    reason?: string;
}
/**
 * Verify a chain given its rows in seq-ascending order. Recomputes every
 * payload + entry hash, asserts gapless monotonic seq, and asserts each row
 * links to its predecessor. Returns the first failure with its seq.
 */
export declare function verifyChainRows(rows: SnapshotRow[]): Promise<ChainVerifyResult>;
/**
 * Append one snapshot to `monitor_snapshot` and return its seq + head hash.
 * Caller must `await` (the hashing is async). Safe under concurrency.
 */
export declare function appendSnapshot(sql: SqlRunner, input: SnapshotInput): Promise<{
    seq: number;
    entry_hash: string;
    content_hash: string;
}>;
/** Read a subscription's full chain from SQLite and verify it end to end. */
export declare function verifySnapshotChain(sql: SqlRunner, subscriptionId: string): Promise<ChainVerifyResult>;
//# sourceMappingURL=snapshot-chain.d.ts.map