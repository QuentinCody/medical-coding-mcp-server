/**
 * The helper surface the safe evaluator calls into. createOpenApiHelpers() in
 * search-tool.ts returns a superset of this; it is declared structurally here to
 * keep the interpreter free of any OpenAPI-spec dependency.
 */
export interface ExpressionHelpers {
    searchPaths(query: string, maxResults?: number): unknown[];
    searchSpec(query: string, maxResults?: number): unknown[];
    listTags(): unknown[];
    listCategories(): unknown[];
    getOperation(idOrPath: string): unknown;
    getEndpoint(path: string, method?: string): unknown;
    describeOperation(idOrPath: string): string;
    describeEndpoint(path: string, method?: string): string;
    spec: unknown;
    SPEC?: unknown;
}
export declare function evaluateCallbackExpression(source: string, scope: Record<string, unknown>): unknown;
export declare function evaluateSafeExpression(expr: string, helpers: ExpressionHelpers): unknown;
/**
 * Execute search code against OpenAPI helpers with the safe interpreter only.
 */
export declare function executeSearchCode(code: string, helpers: ExpressionHelpers): unknown;
//# sourceMappingURL=safe-expression.d.ts.map