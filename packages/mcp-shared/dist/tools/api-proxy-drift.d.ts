/**
 * API drift detection for the `__api_proxy` tool.
 *
 * Extracted from `api-proxy.ts` (cohesive, self-contained, and the original file
 * was at the line cap). Given the server's known endpoints (catalog + OpenAPI
 * spec) and a failed request, {@link buildDriftHint} explains WHY it failed —
 * unknown endpoint, parameter mismatch, or an upstream contract change — so the
 * model can self-correct instead of blindly retrying.
 */
import type { ApiCatalog } from "../codemode/catalog";
import type { ResolvedSpec } from "../codemode/openapi-resolver";
type DriftHintKind = "unknown_endpoint" | "contract_changed" | "parameter_mismatch";
export interface DriftHint {
    kind: DriftHintKind;
    message: string;
    suggestions?: Array<{
        method: string;
        path: string;
        summary?: string;
    }>;
    expected_params?: string[];
    known_methods?: string[];
}
export interface KnownEndpoint {
    method: string;
    path: string;
    summary?: string;
    pathParamNames: string[];
    queryParamNames: string[];
}
export declare function buildKnownEndpointIndex(catalog?: ApiCatalog, openApiSpec?: ResolvedSpec): KnownEndpoint[];
export declare function buildDriftHint(method: string, requestPath: string, status: number, knownEndpoints: KnownEndpoint[]): DriftHint | undefined;
export {};
//# sourceMappingURL=api-proxy-drift.d.ts.map