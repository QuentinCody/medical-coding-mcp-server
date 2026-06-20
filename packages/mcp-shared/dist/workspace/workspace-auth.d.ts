/**
 * Authentication for the workspace-do Worker's public `/ws/*` HTTP surface (ADR-006).
 *
 * The cross-script DO-binding path (chembl/dgidb → `WORKSPACE_DO.get(id).fetch`)
 * invokes the Durable Object's own `fetch` directly and BYPASSES the Worker
 * entrypoint entirely, so it is unaffected by this guard. This protects only the
 * internet-reachable HTTP route, which would otherwise be an open relay to
 * cross-workspace staged SQL (`/ws/query`) and destructive `/ws/clear`.
 *
 * FAILS CLOSED: an unset/empty expected token denies every request. Workers have
 * no `process.env.NODE_ENV`, so the decision keys off the binding object only —
 * set `WORKSPACE_AUTH_TOKEN` as a secret (prod) or in `.dev.vars` (local).
 */
/** Length-independent constant-time string compare (no Node Buffer in Workers). */
export declare function timingSafeEqual(a: string, b: string): boolean;
/** Minimal header reader — satisfied by both `Request.headers` and a plain map. */
interface HeaderReader {
    get(name: string): string | null;
}
/**
 * Authorize a request against the expected bearer token. Accepts
 * `Authorization: Bearer <token>` or `x-workspace-token: <token>`. Returns
 * `false` (deny) when the expected token is unset/empty — fail closed.
 */
export declare function isWorkspaceRequestAuthorized(headers: HeaderReader, expectedToken: string | undefined): boolean;
export {};
//# sourceMappingURL=workspace-auth.d.ts.map