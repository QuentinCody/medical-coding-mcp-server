/**
 * Next-page cursor normalization (ADR-006 / DRF cursor pagination).
 *
 * Cursor APIs such as CourtListener (Django REST Framework) return `next` as a
 * FULL absolute URL — e.g. `https://www.courtlistener.com/api/rest/v4/search/?cursor=bz0x...`.
 * Re-sending that whole URL back as `cursor=` (URL-encoded) produces a garbage
 * cursor and breaks pagination after page 1. This helper extracts just the
 * cursor token so the next request flows through the server's own adapter
 * (preserving auth headers + base URL) instead of "following" the raw URL.
 */
/**
 * Normalize a raw `next` value into the token to resend.
 *
 * - Bare token (no `?`)            → returned unchanged.
 * - URL-shaped (`...?cursor=ABC`)  → the cursor query param's value (`ABC`).
 * - URL-shaped, no known param     → returned unchanged (last resort).
 *
 * @param cursorParam the request param the caller resends the cursor as; checked
 *   first so it round-trips, then a fallback list of common token params.
 */
export declare function normalizeNextCursor(raw: string, cursorParam?: string): string;
//# sourceMappingURL=next-cursor.d.ts.map