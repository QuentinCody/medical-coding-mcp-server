import {afterEach, expect, it, vi} from "vitest";
import {codingFetch} from "./http";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("bounds a stalled response body even when cancellation never settles", async () => {
  vi.useFakeTimers();
  const signal = {current: undefined as AbortSignal | undefined};
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    signal.current = options.signal;
    return new Response(new ReadableStream({pull: () => new Promise(() => {}), cancel: () => new Promise(() => {})}));
  }));
  const result = expect(codingFetch("/api/hcpcs/v3/search", {terms: "x"})).rejects.toMatchObject({status: 502, message: expect.stringContaining("timed out")});
  await vi.advanceTimersByTimeAsync(30_000); await result;
  expect(signal.current?.aborted).toBe(true);
});
it("returns the HTTP failure without waiting for cancellation", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({cancel: () => new Promise(() => {})}), {status: 429})));
  await expect(codingFetch("/api/hcpcs/v3/search", {terms: "x"})).rejects.toMatchObject({status: 429});
});
it("does not follow redirects and rejects malformed UTF-8", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, {status: 302, headers: {Location: "https://example.com"}}))
    .mockResolvedValueOnce(new Response(new Uint8Array([0xc3, 0x28])));
  vi.stubGlobal("fetch", fetcher);
  await expect(codingFetch("/api/hcpcs/v3/search", {terms: "x"})).rejects.toMatchObject({status: 302});
  await expect(codingFetch("/api/hcpcs/v3/search", {terms: "x"})).rejects.toMatchObject({status: 502});
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][1].redirect).toBe("manual");
});
