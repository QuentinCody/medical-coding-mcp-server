export const ORIGIN = "https://clinicaltables.nlm.nih.gov";
export function fail(message: string, status = 400): never { throw Object.assign(new Error(message), {status}); }
export async function codingFetch(path: string, params: Record<string, unknown>): Promise<unknown> {
  if (!["/api/hcpcs/v3/search", "/fhir/R4/ValueSet/hcpcs/$expand"].includes(path)) fail("Unsupported HCPCS upstream path");
  const url = new URL(path, ORIGIN);
  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item === undefined || item === null) continue;
      if (!["string", "number", "boolean"].includes(typeof item) || String(item).length > 2000) fail("Unsupported HCPCS query value");
      url.searchParams.append(key, String(item));
    }
  }
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let response: Response | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error("NLM HCPCS request timed out"), {status: 502}));
    }, 30_000);
  });
  const read = async () => {
    response = await fetch(url, {headers: {Accept: "application/json"}, redirect: "manual", signal: controller.signal});
    if (controller.signal.aborted) fail("NLM HCPCS request timed out", 502);
    if (!response.ok) fail(`NLM HCPCS HTTP ${response.status}`, response.status);
    reader = response.body?.getReader(); if (!reader) fail("Empty NLM response", 502);
    return await readCodingJson(reader, controller.signal);
  };
  try { return await Promise.race([read(), deadline]); }
  catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    fail("NLM HCPCS response unreadable or request failed", 502);
  } finally {
    clearTimeout(timer); controller.abort();
    // Cancellation may itself stall; it must not hold an error/timeout open.
    if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
    else if (response?.body) void response.body.cancel().catch(() => {});
  }
}

async function readCodingJson(reader: ReadableStreamDefaultReader<Uint8Array>, signal: AbortSignal): Promise<unknown> {
  const decoder = new TextDecoder("utf-8", {fatal: true, ignoreBOM: false}); let bytes = 0; let text = "";
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    if (signal.aborted) fail("NLM HCPCS request timed out", 502);
    bytes += chunk.value.byteLength; if (bytes > 4 * 1024 * 1024) fail("NLM response exceeds 4 MiB", 502);
    text += decoder.decode(chunk.value, {stream: true});
  }
  text += decoder.decode();
  try { return JSON.parse(text); } catch { fail("NLM returned invalid JSON", 502); }
}
