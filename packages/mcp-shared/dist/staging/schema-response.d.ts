import type { InferredSchema, TableProfile } from "./schema-inference";
import type { TableRelationship } from "./staging-metadata";
/** Provenance metadata surfaced in get_schema output, normalized from a raw _staging_metadata row. */
export interface ProvenanceRow {
    tool_name: string | null;
    server_name: string | null;
    api_url: string | null;
    staged_at: string | null;
    input_rows: number | null;
    stored_rows: number | null;
    failed_rows: number | null;
}
export interface ColumnMetaEntry {
    jsonShape?: string;
    pipeDelimited?: boolean;
}
/** Index inferred-schema columns carrying json_shape / pipe-delimited hints, keyed `table.column`. */
export declare function buildColumnMeta(inferredSchema: InferredSchema | undefined): Map<string, ColumnMetaEntry>;
/** Index persisted column profiles by table name. */
export declare function buildProfileByTable(columnProfiles: TableProfile[] | undefined): Map<string, Record<string, unknown>>;
export interface ColumnDescriptor {
    name: string;
    type: string;
    not_null: boolean;
    primary_key: boolean;
    json_shape?: string;
    searchable_array?: boolean;
    profile?: unknown;
}
/** Shape one get_schema column descriptor from a raw PRAGMA table_info row + hint/profile lookups. */
export declare function buildColumnDescriptor(rawCol: Record<string, unknown>, tableName: string, columnMeta: Map<string, ColumnMetaEntry>, profileByTable: Map<string, Record<string, unknown>>): ColumnDescriptor;
export interface RelationshipWithJoin extends TableRelationship {
    join_sql: string;
}
/** Attach a sample JOIN SQL string to each relationship, resolving the parent key column. */
export declare function buildRelationshipJoins(relationships: TableRelationship[], inferredSchema: InferredSchema | undefined): RelationshipWithJoin[];
/** Normalize a raw _staging_metadata row into a typed ProvenanceRow (string/number fields only). */
export declare function normalizeProvenance(rawRow: Record<string, unknown> | undefined): ProvenanceRow | undefined;
//# sourceMappingURL=schema-response.d.ts.map