/**
 * Monitoring primitive — row-set diff.
 *
 * A full-outer-join of prior vs next snapshot keyed on each table's BUSINESS
 * key (never the staging synthetic PK): keys present only in next = added, only
 * in prior = removed, in both with a differing value-projection = changed (with
 * per-field deltas). A pure upstream row reorder produces zero changes because
 * comparison is keyed, not array-positional.
 */
import { canonicalJson } from "../provenance/provenance";
import { canonicalValue, rowKey, selectValueFields } from "./canonicalize";
function indexRows(rs, spec) {
    const m = new Map();
    for (const row of rs.rows)
        m.set(rowKey(row, spec), { row, value: canonicalValue(row, spec) });
    return m;
}
function keyValues(row, spec) {
    const kv = {};
    for (const f of spec.keyFields)
        kv[f] = row[f];
    return kv;
}
function fieldDeltas(before, after, spec) {
    const fields = new Set([...selectValueFields(before, spec), ...selectValueFields(after, spec)]);
    const deltas = [];
    for (const f of fields) {
        if (canonicalJson(before[f]) !== canonicalJson(after[f])) {
            deltas.push({ field: f, before: before[f], after: after[f] });
        }
    }
    return deltas;
}
/** Diff one table's rows. Returns the changes plus a count of unchanged rows. */
export function diffTable(prior, next, spec) {
    const before = indexRows(prior, spec);
    const after = indexRows(next, spec);
    const changes = [];
    let unchanged = 0;
    for (const [key, cur] of after) {
        const prev = before.get(key);
        if (!prev) {
            changes.push({ table: spec.table, kind: "added", key, keyValues: keyValues(cur.row, spec), after: cur.row });
        }
        else if (prev.value !== cur.value) {
            changes.push({
                table: spec.table,
                kind: "changed",
                key,
                keyValues: keyValues(cur.row, spec),
                before: prev.row,
                after: cur.row,
                fields: fieldDeltas(prev.row, cur.row, spec),
            });
        }
        else {
            unchanged++;
        }
    }
    for (const [key, prev] of before) {
        if (!after.has(key)) {
            changes.push({ table: spec.table, kind: "removed", key, keyValues: keyValues(prev.row, spec), before: prev.row });
        }
    }
    return { changes, unchanged };
}
const EMPTY = (table) => ({ table, rows: [] });
/** Diff two full snapshots (sets of named row-sets) per the profile's tables. */
export function diffSnapshots(prior, next, profile) {
    const priorByTable = new Map(prior.map((r) => [r.table, r]));
    const nextByTable = new Map(next.map((r) => [r.table, r]));
    const changes = [];
    const summary = [];
    for (const spec of profile.tables) {
        const p = priorByTable.get(spec.table) ?? EMPTY(spec.table);
        const n = nextByTable.get(spec.table) ?? EMPTY(spec.table);
        const { changes: tc, unchanged } = diffTable(p, n, spec);
        changes.push(...tc);
        summary.push({
            table: spec.table,
            added: tc.filter((c) => c.kind === "added").length,
            removed: tc.filter((c) => c.kind === "removed").length,
            changed: tc.filter((c) => c.kind === "changed").length,
            unchanged,
        });
    }
    return { changes, summary };
}
//# sourceMappingURL=diff.js.map