# Medical Coding MCP Server

This is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. It lets MCP clients (Claude Desktop, Claude Code, Continue, etc.) query the upstream Medical Coding API in natural language. It is part of the [Bio MCP](../../README.md) monorepo.

## Connect

Configured production endpoint (the October 3 changes below are locally verified and have not been deployed):

```
https://medical-coding-mcp-server.quentincody.workers.dev/mcp
```

Add it to your MCP client (Claude Desktop → Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "medical-coding": {
      "command": "npx",
      "args": ["mcp-remote", "https://medical-coding-mcp-server.quentincody.workers.dev/mcp"]
    }
  }
}
```

For local development the server runs at `http://localhost:8901/mcp` (start it with `./scripts/dev-servers.sh medical-coding`):

```json
{
  "mcpServers": {
    "medical-coding-local": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8901/mcp"]
    }
  }
}
```

## Tools

- `coding_search` — discover available API operations (Code Mode catalog search, 4 endpoints)
- `coding_execute` — **Code Mode**: write JavaScript in a V8 isolate (`api.get()` / `searchSpec()`) instead of issuing tool calls one by one
- `coding_query_data` — run SQL over large responses auto-staged into a per-session SQLite database
- `coding_get_schema` — inspect the inferred schema of a staged dataset

Complete tool responses over 30 KiB, including composed output and errors, are auto-staged into a queryable SQLite database; the tools return a `data_access_id` you can query with SQL.

Every tool returns both a human-readable `content` summary and a structured `structuredContent` payload.

## Development

```bash
./scripts/dev-servers.sh medical-coding            # run locally (port 8901)
pnpm --filter medical-coding-mcp-server run deploy   # deploy to Cloudflare Workers
```

See [`docs/adding-mcp-servers.md`](../../docs/adding-mcp-servers.md) and the root [README](../../README.md) for the full architecture (Code Mode, staging, portals).

---

*Auto-generated baseline README — refine with server-specific detail as needed.*

## HCPCS dates, exact lookup and result limits

The catalog now exposes four read-only operations:

- `/hcpcs/v3/search`: existing native compact-array response, with caller-selected
  fields and aliases retained. `cf` is supported, including non-text code fields.
- `/hcpcs/search`: local single-page wrapper with original arrays, row-aligned
  date/flag fields, source context and explicit limits. Accepts `terms`, `count`
  (default 25), `offset` and `q`.
- `/hcpcs/code/{code}`: local exact identifier lookup for a letter plus four
  digits. It constrains the upstream search and post-filters exact matches,
  preserving the complete candidate response separately.
- `/fhir/R4/ValueSet/hcpcs/$expand`: documented NLM FHIR representation, routed to
  the site's `/fhir` prefix. JSON output, `filter`, `count` and repeated `property`
  values are supported. Native resource version/expansion context is retained
  when present; no unverified version selector or pagination is added.

```js
return await api.get('/hcpcs/code/J0135');
```

Contextual results preserve `add_dt`, `term_dt`, `act_eff_dt`, `obsolete`, `is_noc`
and `long_desc` exactly as returned. Missing fields are listed explicitly;
missing values are not converted into “active” status. These are code-level
fields, not a dataset release date. The adapter makes no historical-validity,
coverage or reimbursement determination. Prefix/text search alone is not an
exact code lookup, and a missing exact match does not establish global absence.

NLM documents a **500-record page maximum**, **7,500-record retrieval window**
(`offset + count`), and **10,000 reported-total ceiling**. It warns that reported
totals can undercount actual results. `maxList` does not paginate; this adapter
rejects ambiguous combinations with `count`/`offset`. Contextual results always
mark exhaustive completeness as unproven. Next-offset/count values are candidates
for a subsequent request, not evidence that another page exists or that paging
produces a stable snapshot. Preserve the native arrays and provenance when staged.

The compact response does not establish its dataset release. `_hcpcs.dataset_version`
is therefore null. A separately labeled documentation observation records that
NLM's index advertised **October 2026** when reviewed on October 3, 2026; it is not
asserted as the release of subsequent responses. API `v3` is also not a code-set
release. Do not use this server as an authoritative historical code-set snapshot.

Requests use a fixed NLM host, no redirects, 30-second timeout and 4 MiB response
cap. Both tool aliases are registered (`coding_*` and `mcp_coding_*`), with 30 KiB
staging across search, Code Mode, SQL and schema tools. The timeout covers both headers and body; cancellation cannot hold an error open. Search the catalog for complete examples.

Sources: [HCPCS API contract](https://clinicaltables.nlm.nih.gov/apidoc/hcpcs/v3/doc.html),
[NLM source-version index](https://clinicaltables.nlm.nih.gov/index.html),
[FHIR expansion contract](https://clinicaltables.nlm.nih.gov/valueSetExpand.html),
[provider change history](https://clinicaltables.nlm.nih.gov/CHANGELOG_for_users.html).
The FHIR option is an existing capability, not a verified new 2026 feature.
Native compact arrays and FHIR resources remain intact. Contextual `rows` also
carry `row_json`, which retains exact JSON field types and display arrays in
SQLite. NLM's observed dates include strings, numbers and nulls; flags include
strings such as `"false"`. Date/flag columns use SQLite BLOB affinity to retain
numeric versus text values; `row_json` also distinguishes JSON booleans from
SQLite's numeric boolean convention. `display_fields` is a convenience SQL view;
use `json_extract(row_json, '$.display_fields')` for the exact array. The original
full response remains in `payloads.root_json`; follow `content_chunks` when the
root is a `__CHUNKED__:` reference.

All native search and FHIR outputs retain conservative completeness metadata,
including small inline responses and staged envelopes. The reported source total
is never promoted into a verified exact count. No deployment was performed for
these changes.

October 3 local acceptance passes 61 server tests and eight native cases through
both aliases: 2,225 returned observations per alias, including 1,055 contextual
rows compared through SQLite. Three published workflows, error/paging behavior,
full FHIR recovery and 80,000-byte Unicode output/SQL recovery pass. This is
sampled native/local acceptance; production and historical snapshots are unverified.

<!-- license-and-data-terms:start -->
## License and data terms

The code in this repository is licensed under the Apache License 2.0 (see `LICENSE`).
If you use it in your work, please cite it (see `CITATION.cff`). Citation is requested, not required.

The license covers the code only. Data that this server returns comes from NLM Clinical Tables HCPCS and stays under the terms of that source: HCPCS Level II public domain.
You are responsible for your use of the data under those terms.
<!-- license-and-data-terms:end -->
