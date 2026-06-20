/**
 * Deterministic exhaustive pagination for Code Mode.
 *
 * Agents silently UNDER-COUNT when they fetch only the first page of a paged
 * API and treat it as the whole result. `paginateAll` walks every page to
 * completion (or an explicit, *reported* cap) using one of three predictable
 * strategies — no fragile auto-magic — and returns a {@link Completeness}
 * verdict so the caller always knows whether the set is whole or truncated.
 *
 * This is a PURE host-side helper (no isolate, no network of its own): it takes
 * an injected `fetchPage` so it is fully unit-testable. The isolate-facing
 * `api.getAll(...)` and the `__paginate_proxy` host tool are thin wrappers.
 */
import { inferUpstreamTotal } from "../completeness";
import { normalizeNextCursor } from "./next-cursor";
/** Response keys that commonly hold the primary array of records. */
const ITEM_KEYS = [
    "results",
    "data",
    "records",
    "items",
    "entries",
    "hits",
    "nodes",
    "reports",
    "rows",
    "docs",
];
/** Response keys that commonly hold a next-page cursor/token. */
const NEXT_KEYS = [
    "next",
    "nextPageToken",
    "next_page_token",
    "nextCursor",
    "next_cursor",
    "cursor",
    "after",
    "scroll_id",
];
/** Resolve a dot-path (e.g. "esearchresult.idlist") against an object. */
function getPath(obj, path) {
    let cur = obj;
    for (const key of path.split(".")) {
        if (cur == null || typeof cur !== "object")
            return undefined;
        cur = cur[key];
    }
    return cur;
}
/**
 * Find the primary array of records in a response. Honors an explicit
 * `itemsField` dot-path; otherwise probes common envelope keys plus NCBI's
 * nested `esearchresult.idlist`. Returns the array and the field it came from
 * (so later pages can re-extract from the same place).
 */
export function extractItems(resp, itemsField) {
    if (Array.isArray(resp))
        return { items: resp };
    if (itemsField) {
        const v = getPath(resp, itemsField);
        return { items: Array.isArray(v) ? v : [], field: itemsField };
    }
    if (resp && typeof resp === "object") {
        const root = resp;
        for (const k of ITEM_KEYS) {
            if (Array.isArray(root[k]))
                return { items: root[k], field: k };
        }
        // NCBI E-utilities: { esearchresult: { idlist: [...] } }
        const idlist = getPath(root, "esearchresult.idlist");
        if (Array.isArray(idlist))
            return { items: idlist, field: "esearchresult.idlist" };
    }
    return { items: [] };
}
/** Extract a next-page cursor/token from a response, if present. */
export function extractNextCursor(resp, nextField, cursorParam = "cursor") {
    const read = (key) => {
        const v = getPath(resp, key);
        if (typeof v === "string" && v.length > 0)
            return normalizeNextCursor(v, cursorParam);
        if (typeof v === "number" && Number.isFinite(v))
            return String(v);
        return undefined;
    };
    if (nextField)
        return read(nextField);
    for (const key of NEXT_KEYS) {
        const v = read(key);
        if (v)
            return v;
    }
    return undefined;
}
/** Apply defaults to the loosely-specified options. */
function resolveConfig(opts) {
    return {
        strategy: opts.strategy ?? "offset",
        pageSize: opts.pageSize ?? 100,
        max: opts.max ?? 10000,
        maxPages: opts.maxPages ?? 50,
        offsetParam: opts.offsetParam ?? "offset",
        limitParam: opts.limitParam ?? "limit",
        pageParam: opts.pageParam ?? "page",
        pageSizeParam: opts.pageSizeParam ?? "per_page",
        cursorParam: opts.cursorParam ?? "cursor",
        startPage: opts.startPage ?? 1,
        nextField: opts.nextField,
        itemsField: opts.itemsField,
        sendLimit: opts.limitParam !== undefined,
    };
}
/** Build the query params for the next request given the current cursor state. */
function buildPageParams(cfg, baseParams, state) {
    const params = { ...baseParams };
    if (cfg.strategy === "offset") {
        params[cfg.offsetParam] = state.offset;
        params[cfg.limitParam] = cfg.pageSize;
    }
    else if (cfg.strategy === "page") {
        params[cfg.pageParam] = state.page;
        params[cfg.pageSizeParam] = cfg.pageSize;
    }
    else {
        if (state.cursor)
            params[cfg.cursorParam] = state.cursor;
        if (cfg.sendLimit)
            params[cfg.limitParam] = cfg.pageSize;
    }
    return params;
}
/** Turn the loop's exit conditions into a {@link Completeness} verdict. */
function buildCompleteness(v) {
    if (v.cappedByItems || v.cappedByPages) {
        return {
            complete: false,
            ...(v.total !== undefined ? { total_available: v.total } : {}),
            returned: v.returned,
            truncation: {
                reason: v.cappedByItems ? "row_limit" : "page_limit",
                detail: v.cappedByItems
                    ? `Stopped after accumulating the max of ${v.max} item(s); more records remain.`
                    : `Stopped after the max of ${v.maxPages} page request(s); more records remain.`,
                remedy: `Raise the ${v.cappedByItems ? "max" : "maxPages"} option (or narrow the query) to retrieve the rest.`,
            },
        };
    }
    if (v.exhausted && v.total !== undefined && v.returned < v.total) {
        // Natural stop, yet still short of the reported total → silent under-count.
        return {
            complete: false,
            total_available: v.total,
            returned: v.returned,
            truncation: {
                reason: "page_limit",
                detail: `Upstream reports ${v.total} matching record(s) but pagination yielded ${v.returned}.`,
                remedy: "Check the pagination options (strategy / pageSize / itemsField) — the upstream total was not reached.",
            },
        };
    }
    return {
        complete: true,
        ...(v.total !== undefined ? { total_available: v.total } : {}),
        returned: v.returned,
    };
}
/**
 * Walk every page of a paged endpoint and return the combined records plus a
 * completeness verdict. `fetchPage(params)` performs one request and returns
 * the parsed response body.
 */
export async function paginateAll(fetchPage, baseParams = {}, opts = {}) {
    const cfg = resolveConfig(opts);
    const items = [];
    let pages = 0;
    let total;
    let itemsField = cfg.itemsField;
    const startOffset = Number(baseParams[cfg.offsetParam]);
    const state = {
        offset: Number.isFinite(startOffset) ? startOffset : 0,
        page: cfg.startPage,
    };
    let cappedByItems = false;
    let cappedByPages = false;
    let exhausted = false;
    while (true) {
        if (pages >= cfg.maxPages) {
            cappedByPages = true;
            break;
        }
        const resp = await fetchPage(buildPageParams(cfg, baseParams, state));
        pages++;
        if (total === undefined) {
            const t = inferUpstreamTotal(resp);
            if (t !== undefined)
                total = t;
        }
        const ext = extractItems(resp, itemsField);
        if (!itemsField && ext.field)
            itemsField = ext.field; // lock onto the field after page 1
        const pageItems = ext.items;
        for (const it of pageItems) {
            if (items.length >= cfg.max) {
                cappedByItems = true;
                break;
            }
            items.push(it);
        }
        if (cappedByItems)
            break;
        if (cfg.strategy === "cursor") {
            state.cursor = extractNextCursor(resp, cfg.nextField, cfg.cursorParam);
            if (!state.cursor) {
                exhausted = true;
                break;
            }
        }
        else if (pageItems.length < cfg.pageSize) {
            exhausted = true; // a short page means we reached the end
            break;
        }
        else if (total !== undefined && items.length >= total) {
            exhausted = true;
            break;
        }
        else if (cfg.strategy === "offset") {
            state.offset += cfg.pageSize;
        }
        else {
            state.page++;
        }
    }
    return {
        items,
        pages,
        ...(total !== undefined ? { total_available: total } : {}),
        completeness: buildCompleteness({
            cappedByItems,
            cappedByPages,
            exhausted,
            total,
            returned: items.length,
            max: cfg.max,
            maxPages: cfg.maxPages,
        }),
    };
}
//# sourceMappingURL=paginate.js.map