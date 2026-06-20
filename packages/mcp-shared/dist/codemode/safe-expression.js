// Safe expression interpreter for code-mode search tools.
//
// A hand-rolled precedence-climbing evaluator that runs agent-written search
// code WITHOUT new Function() (blocked by the workerd runtime). Extracted from
// search-tool.ts; low-level scanning lives in ./expression-scanner.
import { findTopLevelArrow, findTopLevelChar, findTopLevelOperator, parseArrowParam, parseCallExpressionAt, parseMemberAccess, parseOptionalMemberAccess, parseSpecLookupTokens, readQuotedString, splitTopLevelExpressions, stripOuterParens, unsupportedExpression, } from "./expression-scanner";
/** Parse a comma-separated argument string using the safe expression interpreter. */
function parseArgs(argsStr) {
    if (!argsStr.trim())
        return [];
    return splitTopLevelExpressions(argsStr).map((token) => evaluateCallbackExpression(token, {}));
}
function evaluateMemberAccess(expr, scope) {
    const access = parseMemberAccess(expr);
    if (!access)
        return unsupportedExpression();
    let current = scope[access.root];
    for (const segment of access.segments) {
        if (current == null)
            return undefined;
        current = Reflect.get(Object(current), segment);
    }
    return current;
}
function parseArrowFunction(source) {
    const arrowIdx = findTopLevelArrow(source);
    if (arrowIdx === -1)
        return unsupportedExpression();
    let paramsSource = source.slice(0, arrowIdx).trim();
    const body = source.slice(arrowIdx + 2).trim();
    if (!body || body.startsWith("{"))
        return unsupportedExpression();
    if (paramsSource.startsWith("(") && paramsSource.endsWith(")")) {
        paramsSource = paramsSource.slice(1, -1).trim();
    }
    const params = splitTopLevelExpressions(paramsSource).map(parseArrowParam);
    return {
        invoke: (value, index, array) => {
            const scope = {};
            const providedValues = [value, index, array];
            params.forEach((param, paramIndex) => {
                const paramValue = providedValues[paramIndex];
                if (param.kind === "identifier") {
                    scope[param.name] = paramValue;
                }
                else {
                    const entries = Array.isArray(paramValue) ? paramValue : [];
                    param.names.forEach((name, idx) => {
                        if (name) {
                            scope[name] = entries[idx];
                        }
                    });
                }
            });
            if (params.length === 0) {
                scope._ = value;
            }
            return evaluateCallbackExpression(body, scope);
        },
    };
}
function evaluateObjectLiteral(expr, scope) {
    const body = expr.slice(1, -1).trim();
    if (!body)
        return {};
    const result = {};
    for (const field of splitTopLevelExpressions(body)) {
        const colonIdx = findTopLevelChar(field, ":");
        if (colonIdx === -1) {
            const shorthand = field.trim();
            if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(shorthand)) {
                return unsupportedExpression();
            }
            result[shorthand] = evaluateCallbackExpression(shorthand, scope);
            continue;
        }
        const rawKey = field.slice(0, colonIdx).trim();
        const valueExpr = field.slice(colonIdx + 1).trim();
        let key;
        if (rawKey.startsWith('"') || rawKey.startsWith("'")) {
            key = readQuotedString(rawKey, 0).value;
        }
        else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(rawKey)) {
            key = rawKey;
        }
        else {
            return unsupportedExpression();
        }
        result[key] = evaluateCallbackExpression(valueExpr, scope);
    }
    return result;
}
function applyOptionalMemberAccess(value, expr, start) {
    const parsed = parseOptionalMemberAccess(expr, start);
    if (!parsed)
        return null;
    if (value == null) {
        if (parsed.optional) {
            return {
                value: undefined,
                nextPos: parsed.nextPos,
            };
        }
        return unsupportedExpression();
    }
    return {
        value: Reflect.get(Object(value), parsed.key),
        nextPos: parsed.nextPos,
    };
}
// ── Shared binary-operator precedence engine ───────────────────────────────
// Both evaluators climb the same operator-precedence ladder. Each level finds
// the first top-level occurrence of its operators, splits the expression there,
// and combines the two sides. Splitting at the *first* operator makes evaluation
// right-associative — a long-standing quirk callers depend on (guarded by tests).
const NO_BINARY_MATCH = Symbol("no-binary-match");
const BINARY_NULLISH = { operators: ["??"], apply: (l, r) => l ?? r() };
const BINARY_OR = { operators: ["||"], apply: (l, r) => l || r() };
const BINARY_AND = { operators: ["&&"], apply: (l, r) => l && r() };
const BINARY_EQUALITY = {
    operators: ["===", "!==", "==", "!="],
    apply: (l, r, op) => (op === "===" || op === "==" ? l === r() : l !== r()),
};
const BINARY_RELATIONAL = {
    operators: [">=", "<=", ">", "<"],
    apply: (l, r, op) => {
        const a = Number(l);
        const b = Number(r());
        switch (op) {
            case ">=":
                return a >= b;
            case "<=":
                return a <= b;
            case ">":
                return a > b;
            default:
                return a < b;
        }
    },
};
const BINARY_ADDITIVE = {
    operators: ["+", "-"],
    minIndex: 1,
    apply: (l, r, op) => {
        const right = r();
        if (op === "+") {
            return typeof l === "string" || typeof right === "string"
                ? `${l ?? ""}${right ?? ""}`
                : Number(l) + Number(right);
        }
        return Number(l) - Number(right);
    },
};
const BINARY_MULTIPLICATIVE = {
    operators: ["*", "/"],
    apply: (l, r, op) => (op === "*" ? Number(l) * Number(r()) : Number(l) / Number(r())),
};
/**
 * Walk the precedence levels in order; on the first level whose operator appears
 * at top level (respecting `minIndex`), split and combine via that level's
 * `apply`. Returns NO_BINARY_MATCH when no level matches.
 */
function evaluateBinaryChain(expr, levels, evaluate) {
    for (const level of levels) {
        const match = findTopLevelOperator(expr, level.operators);
        if (!match)
            continue;
        if (level.minIndex !== undefined && match.index < level.minIndex)
            continue;
        const left = evaluate(expr.slice(0, match.index));
        const right = () => evaluate(expr.slice(match.index + match.operator.length));
        return level.apply(left, right, match.operator);
    }
    return NO_BINARY_MATCH;
}
const NOT_A_LITERAL = Symbol("not-a-literal");
/** Parse a primitive literal token (string/bool/null/undefined/number) or return NOT_A_LITERAL. */
function evaluatePrimitiveLiteral(expr) {
    if (expr[0] === '"' || expr[0] === "'")
        return readQuotedString(expr, 0).value;
    if (expr === "true")
        return true;
    if (expr === "false")
        return false;
    if (expr === "null")
        return null;
    if (expr === "undefined")
        return undefined;
    if (/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(expr))
        return Number(expr);
    return NOT_A_LITERAL;
}
const NOT_A_CALL = Symbol("not-a-call");
/**
 * Evaluate a complete `receiver.method(args)` call against the callback's
 * supported string methods (includes/startsWith/endsWith). Returns NOT_A_CALL
 * when `expr` isn't a complete call; throws on an unsupported method.
 */
function evaluateCallbackCall(expr, scope) {
    const call = parseCallExpressionAt(expr);
    if (!call || call.nextPos !== expr.length)
        return NOT_A_CALL;
    const lastDot = call.callee.lastIndexOf(".");
    if (lastDot === -1)
        return unsupportedExpression();
    const receiver = evaluateCallbackExpression(call.callee.slice(0, lastDot), scope);
    const method = call.callee.slice(lastDot + 1);
    const args = splitTopLevelExpressions(call.argsStr).map((part) => evaluateCallbackExpression(part, scope));
    if (method === "includes" && receiver != null) {
        return receiver.includes(...args);
    }
    if (method === "startsWith" && typeof receiver === "string") {
        return receiver.startsWith(String(args[0] ?? ""));
    }
    if (method === "endsWith" && typeof receiver === "string") {
        return receiver.endsWith(String(args[0] ?? ""));
    }
    return unsupportedExpression();
}
export function evaluateCallbackExpression(source, scope) {
    const expr = stripOuterParens(source);
    if (!expr)
        return undefined;
    if (expr.startsWith("{") && expr.endsWith("}")) {
        return evaluateObjectLiteral(expr, scope);
    }
    const evaluate = (sub) => evaluateCallbackExpression(sub, scope);
    // Order preserved from the original: high-precedence binary ops, then a bare
    // method call, then literals, then lower-precedence arithmetic, then members.
    const high = evaluateBinaryChain(expr, [BINARY_NULLISH, BINARY_OR, BINARY_AND, BINARY_EQUALITY], evaluate);
    if (high !== NO_BINARY_MATCH)
        return high;
    const called = evaluateCallbackCall(expr, scope);
    if (called !== NOT_A_CALL)
        return called;
    const literal = evaluatePrimitiveLiteral(expr);
    if (literal !== NOT_A_LITERAL)
        return literal;
    const low = evaluateBinaryChain(expr, [BINARY_RELATIONAL, BINARY_ADDITIVE, BINARY_MULTIPLICATIVE], evaluate);
    if (low !== NO_BINARY_MATCH)
        return low;
    return evaluateMemberAccess(expr, scope);
}
function evaluateArrayMethod(value, method, argsStr) {
    if (method === "length") {
        return Array.isArray(value) || typeof value === "string"
            ? value.length
            : unsupportedExpression();
    }
    if (method === "map" || method === "filter" || method === "find") {
        if (!Array.isArray(value))
            return unsupportedExpression();
        const callback = parseArrowFunction(argsStr);
        if (method === "map") {
            return value.map((entry, index, array) => callback.invoke(entry, index, array));
        }
        if (method === "filter") {
            return value.filter((entry, index, array) => Boolean(callback.invoke(entry, index, array)));
        }
        return value.find((entry, index, array) => Boolean(callback.invoke(entry, index, array)));
    }
    if (method === "slice") {
        if (!Array.isArray(value) && typeof value !== "string") {
            return unsupportedExpression();
        }
        const args = argsStr.trim() ? parseArgs(argsStr) : [];
        return value.slice(typeof args[0] === "number" ? args[0] : undefined, typeof args[1] === "number" ? args[1] : undefined);
    }
    return unsupportedExpression();
}
/** Build the helper-function lookup the safe interpreter exposes as call targets. */
function buildSafeHelperFns(helpers) {
    return {
        searchPaths: (q, m) => helpers.searchPaths(String(q ?? ""), Number(m) || 10),
        searchSpec: (q, m) => helpers.searchSpec(String(q ?? ""), Number(m) || 10),
        listTags: () => helpers.listTags(),
        listCategories: () => helpers.listCategories(),
        getOperation: (id) => helpers.getOperation(String(id ?? "")),
        getEndpoint: (p, m) => helpers.getEndpoint(String(p ?? ""), m ? String(m) : undefined),
        describeOperation: (id) => helpers.describeOperation(String(id ?? "")),
        describeEndpoint: (p, m) => helpers.describeEndpoint(String(p ?? ""), m ? String(m) : undefined),
    };
}
/** Evaluate Object.entries/keys/values over a single safe-expression argument. */
function evaluateObjectStatic(callee, argsStr, helpers) {
    const args = splitTopLevelExpressions(argsStr);
    if (args.length !== 1)
        return unsupportedExpression();
    const target = evaluateSafeExpression(args[0], helpers);
    if (target == null || typeof target !== "object")
        return unsupportedExpression();
    if (callee === "Object.keys")
        return Object.keys(target);
    if (callee === "Object.values")
        return Object.values(target);
    return Object.entries(target);
}
/**
 * Resolve the base value a safe expression starts from: a helper-function call,
 * an Object.* static, or a `spec`/`SPEC` property lookup. Returns the value plus
 * the position where any trailing member chain begins.
 */
function resolveSafeCallBase(normalized, helpers) {
    const baseCall = parseCallExpressionAt(normalized);
    if (baseCall) {
        const helperFns = buildSafeHelperFns(helpers);
        if (helperFns[baseCall.callee]) {
            const args = baseCall.argsStr.trim() ? parseArgs(baseCall.argsStr) : [];
            return { value: helperFns[baseCall.callee](...args), pos: baseCall.nextPos };
        }
        if (baseCall.callee === "Object.entries" ||
            baseCall.callee === "Object.keys" ||
            baseCall.callee === "Object.values") {
            return { value: evaluateObjectStatic(baseCall.callee, baseCall.argsStr, helpers), pos: baseCall.nextPos };
        }
        return unsupportedExpression();
    }
    const lookupTokens = parseSpecLookupTokens(normalized);
    if (!lookupTokens)
        return unsupportedExpression();
    let current = helpers.spec;
    for (let i = 0; i < lookupTokens.length; i++) {
        if (current == null)
            return unsupportedExpression();
        const next = Reflect.get(Object(current), lookupTokens[i]);
        if (next === undefined && i < lookupTokens.length - 1)
            return unsupportedExpression();
        current = next;
    }
    return { value: current, pos: normalized.length };
}
/** Apply a trailing `.prop` / `[i]` / `?.x` / `.method(...)` chain to a resolved base value. */
function applySafeMemberChain(start, normalized, startPos) {
    let current = start;
    let pos = startPos;
    while (pos < normalized.length) {
        while (pos < normalized.length && /\s/.test(normalized[pos]))
            pos++;
        if (pos >= normalized.length)
            break;
        if (normalized[pos] !== "." &&
            normalized[pos] !== "[" &&
            !normalized.startsWith("?.", pos) &&
            !normalized.startsWith("?.[", pos)) {
            return unsupportedExpression();
        }
        const optionalAccess = applyOptionalMemberAccess(current, normalized, pos);
        if (optionalAccess &&
            (optionalAccess.nextPos >= normalized.length || normalized[optionalAccess.nextPos] !== "(")) {
            current = optionalAccess.value;
            pos = optionalAccess.nextPos;
            continue;
        }
        if (normalized[pos] !== "." && !normalized.startsWith("?.", pos)) {
            return unsupportedExpression();
        }
        pos++;
        const identifier = normalized.slice(pos).match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
        if (!identifier)
            return unsupportedExpression();
        const methodOrProperty = identifier[0];
        pos += methodOrProperty.length;
        while (pos < normalized.length && /\s/.test(normalized[pos]))
            pos++;
        if (normalized[pos] === "(") {
            const call = parseCallExpressionAt(normalized, pos - methodOrProperty.length);
            if (!call || call.callee !== methodOrProperty)
                return unsupportedExpression();
            current = evaluateArrayMethod(current, methodOrProperty, call.argsStr);
            pos = call.nextPos;
            continue;
        }
        if (current == null)
            return unsupportedExpression();
        current = Reflect.get(Object(current), methodOrProperty);
    }
    return current;
}
export function evaluateSafeExpression(expr, helpers) {
    const normalized = stripOuterParens(expr);
    const evaluate = (sub) => evaluateSafeExpression(sub, helpers);
    const binary = evaluateBinaryChain(normalized, [
        BINARY_NULLISH,
        BINARY_OR,
        BINARY_AND,
        BINARY_EQUALITY,
        BINARY_RELATIONAL,
        BINARY_ADDITIVE,
        BINARY_MULTIPLICATIVE,
    ], evaluate);
    if (binary !== NO_BINARY_MATCH)
        return binary;
    const literal = evaluatePrimitiveLiteral(normalized);
    if (literal !== NOT_A_LITERAL)
        return literal;
    const base = resolveSafeCallBase(normalized, helpers);
    return applySafeMemberChain(base.value, normalized, base.pos);
}
/**
 * Interpret common search helper calls without using new Function().
 * Supports patterns like: `return searchPaths("query")`, `searchPaths("query")`,
 * `return listTags()`, `return describeOperation("id")`, etc.
 *
 * Returns the result on success, or throws if the expression is not
 * a pattern this mini-interpreter can handle (caller should fall back
 * to new Function()).
 */
function interpretSearchCode(code, helpers) {
    // Strip optional "return " prefix so multiline calls like
    // `searchPaths(\n  "studies",\n  5\n)` still parse cleanly.
    const expr = code.replace(/^return\s+/, "").replace(/;$/, "").trim();
    if (!expr) {
        return unsupportedExpression();
    }
    return evaluateSafeExpression(expr, helpers);
}
/**
 * Execute search code against OpenAPI helpers with the safe interpreter only.
 */
export function executeSearchCode(code, helpers) {
    return interpretSearchCode(code, helpers);
}
//# sourceMappingURL=safe-expression.js.map