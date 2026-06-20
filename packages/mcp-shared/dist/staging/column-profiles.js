/** Max distinct values to count before capping */
const PROFILE_DISTINCT_CAP = 101;
/** Max distinct values to report top_values for */
const PROFILE_TOP_VALUES_THRESHOLD = 20;
/** Max sample values to include */
const PROFILE_SAMPLE_COUNT = 5;
/** Max top_values entries */
const PROFILE_TOP_VALUES_COUNT = 10;
/**
 * Compute column profiles for all tables after materialization.
 *
 * Runs lightweight SQL queries against the just-populated SQLite tables.
 * Designed to be called inside the same transaction as materializeSchema()
 * so there's no extra I/O cost.
 */
export function computeColumnProfiles(schema, sql) {
    const profiles = [];
    for (const table of schema.tables) {
        const rowCountResult = sql.exec(`SELECT COUNT(*) as c FROM "${table.name}"`).one();
        const rowCount = Number(rowCountResult?.c ?? 0);
        if (rowCount === 0) {
            profiles.push({ table: table.name, row_count: 0, columns: {} });
            continue;
        }
        const columnProfiles = {};
        for (const col of table.columns) {
            // Skip the synthetic parent_id FK — not useful to profile
            if (col.name === "parent_id")
                continue;
            const profile = profileColumn(table.name, col, rowCount, sql);
            columnProfiles[col.name] = profile;
        }
        profiles.push({ table: table.name, row_count: rowCount, columns: columnProfiles });
    }
    return profiles;
}
/** Detect if a string value looks like a URL */
function isUrlLike(v) {
    return typeof v === "string" && /^https?:\/\//.test(v);
}
/** Detect if a column is a high-cardinality identifier/URL column with no analytical value */
function isLowValueColumn(col, distinctCount, rowCount, sampleValue) {
    // URL columns: all unique, no one queries by URL
    if (distinctCount >= rowCount * 0.9 && isUrlLike(sampleValue))
        return true;
    // _links_* columns are always low-value
    if (col.name.startsWith("_links_"))
        return true;
    return false;
}
function profileColumn(tableName, col, rowCount, sql) {
    const colRef = `"${col.name}"`;
    // Null count
    const nullResult = sql.exec(`SELECT COUNT(*) as c FROM "${tableName}" WHERE ${colRef} IS NULL`).one();
    const nullCount = Number(nullResult?.c ?? 0);
    // Distinct count (capped at PROFILE_DISTINCT_CAP to avoid scanning huge cardinalities)
    const distinctResult = sql.exec(`SELECT COUNT(*) as c FROM (SELECT DISTINCT ${colRef} FROM "${tableName}" WHERE ${colRef} IS NOT NULL LIMIT ${PROFILE_DISTINCT_CAP})`).one();
    const rawDistinct = Number(distinctResult?.c ?? 0);
    const distinctCapped = rawDistinct >= PROFILE_DISTINCT_CAP;
    // Peek at one value to check for URL/low-value columns
    let peekValue = null;
    try {
        const peek = sql.exec(`SELECT ${colRef} as v FROM "${tableName}" WHERE ${colRef} IS NOT NULL LIMIT 1`).one();
        peekValue = peek?.v;
    }
    catch { /* non-critical */ }
    const lowValue = isLowValueColumn(col, rawDistinct, rowCount, peekValue);
    const profile = {
        null_count: nullCount,
        distinct_count: rawDistinct,
        ...(distinctCapped ? { distinct_capped: true } : {}),
    };
    // For low-value columns (URLs, _links_*), only report null_count and distinct_count
    if (lowValue) {
        return profile;
    }
    // Min/Max — skip for JSON columns (not meaningful)
    if (col.type !== "JSON") {
        try {
            const minMaxResult = sql.exec(`SELECT MIN(${colRef}) as min_val, MAX(${colRef}) as max_val FROM "${tableName}" WHERE ${colRef} IS NOT NULL`).one();
            if (minMaxResult) {
                profile.min = minMaxResult.min_val;
                profile.max = minMaxResult.max_val;
            }
        }
        catch {
            // Non-critical
        }
    }
    // Sample values — skip for JSON columns (already have json_shape metadata)
    if (col.type !== "JSON") {
        try {
            const sampleRows = sql.exec(`SELECT DISTINCT ${colRef} as v FROM "${tableName}" WHERE ${colRef} IS NOT NULL LIMIT ${PROFILE_SAMPLE_COUNT}`).toArray();
            if (sampleRows.length > 0) {
                profile.sample_values = sampleRows.map((r) => {
                    const v = r.v;
                    // Truncate long strings in samples to save context
                    if (typeof v === "string" && v.length > 120)
                        return `${v.slice(0, 117)}...`;
                    return v;
                });
            }
        }
        catch {
            // Non-critical
        }
    }
    // Top values — only for low-cardinality columns
    if (rawDistinct <= PROFILE_TOP_VALUES_THRESHOLD && rawDistinct > 0) {
        try {
            const topRows = sql.exec(`SELECT ${colRef} as v, COUNT(*) as c FROM "${tableName}" WHERE ${colRef} IS NOT NULL GROUP BY ${colRef} ORDER BY c DESC LIMIT ${PROFILE_TOP_VALUES_COUNT}`).toArray();
            if (topRows.length > 0) {
                profile.top_values = topRows.map((r) => ({
                    value: r.v,
                    count: Number(r.c),
                }));
            }
        }
        catch {
            // Non-critical
        }
    }
    return profile;
}
//# sourceMappingURL=column-profiles.js.map