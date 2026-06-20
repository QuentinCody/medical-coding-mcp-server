/**
 * NLM Clinical Tables (HCPCS) adapter for Code Mode. No auth required.
 */

import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { codingFetch } from "./http";

export function createMedicalCodingApiFetch(): ApiFetchFn {
	return async (request) => {
		const response = await codingFetch(request.path, request.params);

		if (!response.ok) {
			let errorBody: string;
			try {
				errorBody = await response.text();
			} catch {
				errorBody = response.statusText;
			}
			const error = new Error(`HTTP ${response.status}: ${errorBody.slice(0, 200)}`) as Error & {
				status: number;
				data: unknown;
			};
			error.status = response.status;
			error.data = errorBody;
			throw error;
		}

		const contentType = response.headers.get("content-type") || "";
		if (!contentType.includes("json")) {
			const text = await response.text();
			return { status: response.status, data: text };
		}

		const data: unknown = await response.json();
		return { status: response.status, data };
	};
}
