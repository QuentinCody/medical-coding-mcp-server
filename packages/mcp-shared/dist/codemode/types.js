/**
 * Type generation for Code Mode.
 *
 * Lightweight Zod schema → TypeScript string conversion that runs in Workers
 * (no dependency on the TypeScript compiler or zod-to-ts).
 *
 * Walks Zod v4 schema internals (_zod.def.type) to produce type strings.
 */
function toCamelCase(str) {
    return str
        .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        .replace(/^[a-z]/, (letter) => letter.toUpperCase());
}
function isZodSchema(val) {
    return val !== null && typeof val === "object" && "_zod" in val;
}
/** Inner schema of a single-wrapper Zod type (optional/nullable/promise/…). */
function innerTypeOf(def) {
    return def.innerType;
}
/**
 * Description text attached to a schema. Zod v4 exposes this through the public
 * `.description` getter (registry-backed), NOT `_zod.description` (which v3 used).
 */
function zodDescription(val) {
    if (!isZodSchema(val))
        return undefined;
    const description = val.description;
    return typeof description === "string" && description.length > 0 ? description : undefined;
}
/** Whether an object field schema is optional (so its key gets a trailing `?`). */
function isOptionalField(val) {
    return (isZodSchema(val) &&
        (val._zod.def.type === "optional" || val._zod.optin === "optional"));
}
/** Scalar Zod kinds whose TS rendering is a fixed keyword. */
const PRIMITIVE_TS = {
    string: "string",
    number: "number",
    int: "number",
    boolean: "boolean",
    bigint: "bigint",
    null: "null",
    undefined: "undefined",
    void: "void",
    any: "any",
    unknown: "unknown",
    never: "never",
    date: "Date",
    nan: "number",
};
/** Single-wrapper kinds that render as their inner type, unchanged. */
const UNWRAP_KINDS = new Set(["pipe", "transform", "default", "catch", "readonly"]);
function renderLiteralValue(value) {
    if (typeof value === "string")
        return `"${value}"`;
    if (typeof value === "number" || typeof value === "boolean")
        return String(value);
    if (value === null)
        return "null";
    return "any";
}
// Zod v4 stores literal members in `def.values` (an array); v3 used `value`.
function literalToTypeString(def) {
    const values = def.values;
    if (Array.isArray(values) && values.length > 0) {
        return values.map(renderLiteralValue).join(" | ");
    }
    if ("value" in def)
        return renderLiteralValue(def.value);
    return "any";
}
function enumToTypeString(def) {
    const entries = def.entries;
    if (entries && typeof entries === "object") {
        return Object.values(entries)
            .map((v) => (typeof v === "string" ? `"${v}"` : String(v)))
            .join(" | ");
    }
    return "string";
}
function arrayToTypeString(def) {
    const inner = zodToTypeString(def.element);
    return inner.includes("|") ? `(${inner})[]` : `${inner}[]`;
}
function unionToTypeString(def) {
    const options = def.options;
    return Array.isArray(options) ? options.map(zodToTypeString).join(" | ") : "any";
}
function recordToTypeString(def) {
    return `Record<string, ${zodToTypeString(def.valueType)}>`;
}
function tupleToTypeString(def) {
    const items = def.items;
    return Array.isArray(items) ? `[${items.map(zodToTypeString).join(", ")}]` : "any[]";
}
function optionalToTypeString(def) {
    return `${zodToTypeString(innerTypeOf(def))} | undefined`;
}
function nullableToTypeString(def) {
    return `${zodToTypeString(innerTypeOf(def))} | null`;
}
function promiseToTypeString(def) {
    return `Promise<${zodToTypeString(innerTypeOf(def))}>`;
}
/** Render `\tkey: type;` field lines from an object shape (shared by object + interface output). */
function renderShapeFields(shape) {
    return Object.entries(shape)
        .map(([key, val]) => {
        const optional = isOptionalField(val) ? "?" : "";
        const description = zodDescription(val);
        const desc = description ? ` // ${description}` : "";
        return `\t${key}${optional}: ${zodToTypeString(val)};${desc}`;
    })
        .join("\n");
}
function objectToTypeString(def) {
    const shape = def.shape;
    if (!shape || typeof shape !== "object")
        return "Record<string, unknown>";
    if (Object.keys(shape).length === 0)
        return "{}";
    return `{\n${renderShapeFields(shape)}\n}`;
}
/** Per-kind renderers for the structural Zod types (the recursive cases). */
const COMPLEX_HANDLERS = {
    literal: literalToTypeString,
    enum: enumToTypeString,
    array: arrayToTypeString,
    object: objectToTypeString,
    optional: optionalToTypeString,
    nullable: nullableToTypeString,
    union: unionToTypeString,
    record: recordToTypeString,
    tuple: tupleToTypeString,
    promise: promiseToTypeString,
};
/**
 * Convert a Zod schema to a TypeScript type string.
 *
 * Exported for unit testing; `generateTypes` is the primary public entry point.
 */
export function zodToTypeString(schema) {
    if (!isZodSchema(schema))
        return "any";
    const def = schema._zod.def;
    const primitive = PRIMITIVE_TS[def.type];
    if (primitive)
        return primitive;
    const handler = COMPLEX_HANDLERS[def.type];
    if (handler)
        return handler(def);
    if (UNWRAP_KINDS.has(def.type))
        return zodToTypeString(innerTypeOf(def));
    return "any";
}
/**
 * Generate TypeScript type definitions from a set of tool definitions.
 * Returns a string containing type declarations and a `declare const codemode` block.
 */
export function generateTypes(tools) {
    let availableTools = "";
    let availableTypes = "";
    for (const tool of tools) {
        const typeName = toCamelCase(tool.name);
        const inputTypeName = `${typeName}Input`;
        let inputType;
        const schema = tool.inputSchema;
        if (isZodSchema(schema)) {
            // Full Zod schema (e.g., z.object({...}))
            inputType = `type ${inputTypeName} = ${zodToTypeString(schema)}`;
        }
        else if (schema && typeof schema === "object") {
            // Shape object (e.g., { query: z.string(), ... })
            const shape = schema;
            inputType =
                Object.keys(shape).length === 0
                    ? `type ${inputTypeName} = {}`
                    : `interface ${inputTypeName} {\n${renderShapeFields(shape)}\n}`;
        }
        else {
            inputType = `type ${inputTypeName} = {}`;
        }
        const outputTypeName = `${typeName}Output`;
        const outputType = `type ${outputTypeName} = any`;
        availableTypes += `\n${inputType}`;
        availableTypes += `\n${outputType}`;
        if (tool.description) {
            availableTools += `\n\t/** ${tool.description.trim()} */`;
        }
        availableTools += `\n\t${tool.name}: (input: ${inputTypeName}) => Promise<${outputTypeName}>;`;
        availableTools += "\n";
    }
    availableTools = `\ndeclare const codemode: {${availableTools}}`;
    // Direct query helpers — injected into the V8 isolate alongside codemode
    const queryHelpers = [
        "",
        "/** Execute a read-only SQL query. Returns rows directly. Faster than codemode.sql_query() for SELECT queries. */",
        "declare function query(sql: string, params?: (string | number | boolean | null)[]): Promise<Record<string, unknown>[]>;",
        "",
        "/** Execute multiple read-only SQL queries in a single round-trip. Returns an array of row arrays. */",
        "declare function queryBatch(queries: { sql: string; params?: (string | number | boolean | null)[] }[]): Promise<Array<Record<string, unknown>[]>>;",
        "",
        "/** Store an array of flat objects into a SQLite table. Creates table if needed, evolves schema for new columns. Returns a summary instead of full data. */",
        "declare function store(",
        "  tableName: string,",
        "  data: Record<string, string | number | boolean | null>[]",
        "): Promise<{ table: string; rows_inserted: number; columns: string[]; created?: boolean; columns_added?: string[] }>;",
    ].join("\n");
    return `${availableTypes}\n${availableTools}\n${queryHelpers}\n`;
}
//# sourceMappingURL=types.js.map