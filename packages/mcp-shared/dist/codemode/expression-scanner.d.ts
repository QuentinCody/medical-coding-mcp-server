export declare function unsupportedExpression(): never;
export declare function readQuotedString(source: string, start: number): {
    value: string;
    nextPos: number;
};
export declare function parseSpecLookupTokens(expr: string): string[] | null;
export declare function splitTopLevelExpressions(source: string): string[];
export declare function parseCallExpressionAt(expr: string, start?: number): {
    callee: string;
    argsStr: string;
    nextPos: number;
} | null;
export declare function stripOuterParens(expr: string): string;
export declare function findTopLevelArrow(expr: string): number;
export declare function findTopLevelOperator(expr: string, operators: string[]): {
    index: number;
    operator: string;
} | null;
export declare function findTopLevelChar(expr: string, target: string): number;
export declare function parseMemberAccess(expr: string): {
    root: string;
    segments: Array<string | number>;
} | null;
export type ArrowParam = {
    kind: "identifier";
    name: string;
} | {
    kind: "array";
    names: Array<string | null>;
};
export declare function parseArrowParam(source: string): ArrowParam;
export declare function parseOptionalMemberAccess(expr: string, start: number): {
    key: string | number;
    nextPos: number;
    optional: boolean;
} | null;
//# sourceMappingURL=expression-scanner.d.ts.map