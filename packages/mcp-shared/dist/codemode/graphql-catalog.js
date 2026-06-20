function unwrapGqlType(type) {
    let required = false;
    let isList = false;
    let current = type;
    if (current.kind === "NON_NULL") {
        required = true;
        current = current.ofType || current;
    }
    if (current.kind === "LIST") {
        isList = true;
        current = current.ofType || current;
        if (current.kind === "NON_NULL") {
            current = current.ofType || current;
        }
    }
    return { typeName: current.name || "any", required, isList };
}
function gqlTypeToParamType(type) {
    const { typeName, isList } = unwrapGqlType(type);
    if (isList)
        return "array";
    switch (typeName) {
        case "Int":
        case "Float":
            return "number";
        case "Boolean":
            return "boolean";
        default:
            return "string";
    }
}
function gqlTypeToShapeString(type) {
    const { typeName, isList } = unwrapGqlType(type);
    const scalar = typeName === "Int" || typeName === "Float"
        ? "number"
        : typeName === "Boolean"
            ? "boolean"
            : typeName === "String" || typeName === "ID"
                ? "string"
                : typeName;
    return isList ? `Array<${scalar}>` : scalar;
}
/**
 * Convert a GraphQL introspection result to an ApiCatalog.
 * Each query becomes a virtual GET endpoint, each mutation a POST endpoint.
 * Arguments are mapped to queryParams for discoverability.
 */
export function graphQlToCatalog(introspection, options) {
    const diagnostics = [];
    const endpoints = [];
    // Navigate to __schema
    const root = introspection;
    const schema = root.__schema ||
        root.data?.__schema;
    if (!schema) {
        return {
            catalog: {
                name: options.name,
                baseUrl: options.baseUrl,
                endpointCount: 0,
                endpoints: [],
            },
            diagnostics: [{ level: "error", message: "No __schema found in introspection result" }],
        };
    }
    const types = schema.types;
    if (!types) {
        return {
            catalog: { name: options.name, baseUrl: options.baseUrl, endpointCount: 0, endpoints: [] },
            diagnostics: [{ level: "error", message: "No types found in schema" }],
        };
    }
    const queryTypeName = schema.queryType?.name;
    const mutationTypeName = schema.mutationType?.name;
    // Process queries
    if (queryTypeName) {
        const queryType = types.find((t) => t.name === queryTypeName);
        const fields = queryType?.fields;
        if (fields) {
            for (const field of fields) {
                if (field.name.startsWith("__"))
                    continue; // Skip introspection fields
                const queryParams = field.args.length > 0
                    ? field.args.map((arg) => ({
                        name: arg.name,
                        type: gqlTypeToParamType(arg.type),
                        required: unwrapGqlType(arg.type).required,
                        description: arg.description || arg.name,
                        ...(arg.defaultValue != null ? { default: arg.defaultValue } : {}),
                    }))
                    : undefined;
                const requiredArgs = field.args
                    .filter((a) => unwrapGqlType(a.type).required)
                    .map((a) => `${a.name}: $${a.name}`)
                    .join(", ");
                endpoints.push({
                    method: "POST",
                    path: "/graphql",
                    summary: `Query: ${field.name}${field.description ? ` — ${field.description}` : ""}`,
                    ...(field.description ? { description: field.description } : {}),
                    category: "queries",
                    ...(queryParams ? { queryParams } : {}),
                    body: { contentType: "application/json", description: "GraphQL query" },
                    responseShape: gqlTypeToShapeString(field.type),
                    usageHint: `api.post('/graphql', { query: '{ ${field.name}${requiredArgs ? `(${requiredArgs})` : ""} { ... } }' })`,
                    ...(field.isDeprecated ? { deprecated: true } : {}),
                });
            }
        }
    }
    // Process mutations
    if (mutationTypeName) {
        const mutationType = types.find((t) => t.name === mutationTypeName);
        const fields = mutationType?.fields;
        if (fields) {
            for (const field of fields) {
                if (field.name.startsWith("__"))
                    continue;
                endpoints.push({
                    method: "POST",
                    path: "/graphql",
                    summary: `Mutation: ${field.name}${field.description ? ` — ${field.description}` : ""}`,
                    ...(field.description ? { description: field.description } : {}),
                    category: "mutations",
                    body: { contentType: "application/json", description: "GraphQL mutation" },
                    responseShape: gqlTypeToShapeString(field.type),
                    ...(field.isDeprecated ? { deprecated: true } : {}),
                });
            }
        }
    }
    if (endpoints.length === 0) {
        diagnostics.push({ level: "warn", message: "No queries or mutations found in schema" });
    }
    const catalog = {
        name: options.name,
        baseUrl: options.baseUrl,
        endpointCount: endpoints.length,
        ...(options.auth ? { auth: options.auth } : {}),
        notes: options.notes ||
            "GraphQL API. All operations use POST /graphql with { query: '...' } body. " +
                "Use api.post('/graphql', { query: '...' }) in Code Mode.",
        endpoints,
    };
    return { catalog, diagnostics };
}
//# sourceMappingURL=graphql-catalog.js.map