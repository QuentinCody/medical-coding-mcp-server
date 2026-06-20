/** Index inferred-schema columns carrying json_shape / pipe-delimited hints, keyed `table.column`. */
export function buildColumnMeta(inferredSchema) {
    const columnMeta = new Map();
    if (!inferredSchema)
        return columnMeta;
    for (const table of inferredSchema.tables) {
        for (const col of table.columns) {
            if (col.jsonShape || col.pipeDelimited) {
                columnMeta.set(`${table.name}.${col.name}`, {
                    jsonShape: col.jsonShape,
                    pipeDelimited: col.pipeDelimited,
                });
            }
        }
    }
    return columnMeta;
}
/** Index persisted column profiles by table name. */
export function buildProfileByTable(columnProfiles) {
    const profileByTable = new Map();
    if (!columnProfiles)
        return profileByTable;
    for (const tp of columnProfiles) {
        profileByTable.set(tp.table, tp.columns);
    }
    return profileByTable;
}
/** Shape one get_schema column descriptor from a raw PRAGMA table_info row + hint/profile lookups. */
export function buildColumnDescriptor(rawCol, tableName, columnMeta, profileByTable) {
    const colName = rawCol.name;
    const meta = columnMeta.get(`${tableName}.${colName}`);
    const tableProfiles = profileByTable.get(tableName);
    const colProfile = tableProfiles?.[colName];
    return {
        name: colName,
        type: rawCol.type,
        not_null: rawCol.notnull === 1,
        primary_key: rawCol.pk === 1,
        ...(meta?.jsonShape ? { json_shape: meta.jsonShape } : {}),
        ...(meta?.pipeDelimited ? { searchable_array: true } : {}),
        ...(colProfile ? { profile: colProfile } : {}),
    };
}
/** Attach a sample JOIN SQL string to each relationship, resolving the parent key column. */
export function buildRelationshipJoins(relationships, inferredSchema) {
    return relationships.map((rel) => {
        // Parent PK is _rowid when the parent carries its own data "id" column, else "id".
        const parentTable = inferredSchema?.tables.find((t) => t.name === rel.parent_table);
        const parentHasDataId = parentTable?.columns.some((c) => c.name === "id") ?? false;
        const parentKeyCol = parentHasDataId ? "_rowid" : "id";
        return {
            ...rel,
            join_sql: `SELECT p.*, c.* FROM "${rel.parent_table}" p JOIN "${rel.child_table}" c ON c.parent_id = p.${parentKeyCol}`,
        };
    });
}
/** Normalize a raw _staging_metadata row into a typed ProvenanceRow (string/number fields only). */
export function normalizeProvenance(rawRow) {
    if (rawRow === undefined)
        return undefined;
    const str = (v) => (typeof v === "string" ? v : null);
    const num = (v) => (typeof v === "number" ? v : null);
    return {
        tool_name: str(rawRow.tool_name),
        server_name: str(rawRow.server_name),
        api_url: str(rawRow.api_url),
        staged_at: str(rawRow.staged_at),
        input_rows: num(rawRow.input_rows),
        stored_rows: num(rawRow.stored_rows),
        failed_rows: num(rawRow.failed_rows),
    };
}
//# sourceMappingURL=schema-response.js.map