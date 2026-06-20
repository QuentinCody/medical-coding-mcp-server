/**
 * Monitoring primitive — one monitor tick.
 *
 * Glues the engine into the loop the MonitorDO alarm runs each cadence:
 * build query → re-run in-fabric → canonicalize → content-hash → diff vs prior
 * → classify materiality. The query runner is injected, so this is pure and
 * unit-testable with a fake (the DO supplies the real in-fabric caller).
 */
import { cleanResult, extractRowSets, snapshotHash } from "./canonicalize";
import { diffSnapshots } from "./diff";
import { classifyChanges } from "./materiality";
/** Run one monitor tick against the live source and diff it against the prior snapshot. */
export async function runOnce(args) {
    const query = args.source.buildQuery(args.input);
    const raw = await args.run(query);
    const cleaned = cleanResult(raw, args.source.profile);
    const rowSets = extractRowSets(raw, args.source.profile);
    const contentHash = await snapshotHash(rowSets, args.source.profile);
    const unchanged = args.priorContentHash != null && contentHash === args.priorContentHash;
    const diff = args.priorRowSets
        ? diffSnapshots(args.priorRowSets, rowSets, args.source.profile)
        : { changes: [], summary: [] };
    const changes = classifyChanges(diff.changes, args.source.classify);
    return { query, contentHash, cleaned, rowSets, diff, changes, unchanged };
}
//# sourceMappingURL=run-once.js.map