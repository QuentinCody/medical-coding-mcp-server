/**
 * NLM Clinical Tables HCPCS HTTP client (medical-coding server).
 *
 * Base: https://clinicaltables.nlm.nih.gov/api
 * Public, no auth. Same source family the fleet's icd10-codes server uses.
 *
 * Serves HCPCS Level II (public-domain) procedure/supply codes. Note: CPT Category I
 * codes (AMA copyright) are deliberately NOT available here — that is the one coding
 * layer that requires an AMA license, not a public source.
 */

import { restFetch } from "@bio-mcp/shared/http/rest-fetch";
import type { RestFetchOptions } from "@bio-mcp/shared/http/rest-fetch";

const NLM_BASE = "https://clinicaltables.nlm.nih.gov/api";

export interface CodingFetchOptions extends Omit<RestFetchOptions, "retryOn"> {
	baseUrl?: string;
}

/**
 * Fetch from the NLM Clinical Tables API.
 * Responses use the compact array format: [total, [codes], hash|null, [[displayFields],...]].
 */
export async function codingFetch(
	path: string,
	params?: Record<string, unknown>,
	opts?: CodingFetchOptions,
): Promise<Response> {
	const baseUrl = opts?.baseUrl ?? NLM_BASE;
	const headers: Record<string, string> = {
		Accept: "application/json",
		...(opts?.headers ?? {}),
	};

	return restFetch(baseUrl, path, params, {
		...opts,
		headers,
		retryOn: [429, 500, 502, 503],
		retries: opts?.retries ?? 3,
		timeout: opts?.timeout ?? 30_000,
		userAgent:
			"medical-coding-mcp-server/1.0 (bio-mcp; https://github.com/QuentinCody/medical-coding-mcp-server)",
	});
}
