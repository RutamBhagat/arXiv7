# Convex Function Structure for arXiv HTML-Only Ingestion

This document is ingestion-only.

You should expose exactly 2 ingestion backend functions:
1. `resolve_ingest_target` (optional when direct URL is provided)
2. `ingest_paper_html`

Retrieval-side contracts are defined in `docs/context7-specific-rag.md`.

---

## 1) `resolve_ingest_target`

### Purpose

- Maps a human paper reference (title / arXiv ID / arXiv URL) to a canonical ingestion target when user does not provide a direct HTML URL.
- Determines whether HTML ingestion is possible for that target.

### Why it exists

- This is a discovery helper only.
- If the user already gives `https://arxiv.org/html/<id>`, you can skip this function.

### Signature

- `resolve_ingest_target({ paperName: string, query: string })`

### Parameters

- `paperName` (required): Title hint, raw arXiv ID, or arXiv URL.
- `query` (required): User intent used as relevance signal when title search is needed.

### Behavior / Output characteristics

- Returns candidate matches with metadata:
  - `paperId` in canonical form `/arxiv/<id>` or `/arxiv/<id>vN`
  - `arxivId`
  - `title`
  - `authors`
  - `updatedAt`
  - `absUrl`
  - `htmlUrl`
  - `htmlAvailable` (boolean)
  - `confidence`

### Selection logic guidance

- Prioritize in this order:
  - Exact URL/ID normalization hit
  - Exact title match
  - Title + author overlap
  - Title/abstract relevance to `query`
  - Recency as tie-breaker only

### URL normalization rules

Accepted inputs that normalize to canonical paper ID:

- `arXiv:1706.03762v7`
- `1706.03762v7`
- `https://arxiv.org/abs/1706.03762v7`
- `https://arxiv.org/html/1706.03762v7`
- `https://arxiv.org/pdf/1706.03762v7`

Canonical forms:

- `/arxiv/1706.03762`
- `/arxiv/1706.03762v7`

---

## 2) `ingest_paper_html`

### Purpose

- Triggers HTML-only ingestion for a resolved paper target.

### Why it exists

- Keeps ingestion explicit, asynchronous, and retryable without coupling it to retrieval queries.

### Signature

- `ingest_paper_html({ htmlUrl: string })`

### Parameters

- `htmlUrl` (required): arXiv HTML URL in format `https://arxiv.org/html/<id>` or `https://arxiv.org/html/<id>vN`.

Validation:

- Must be a valid arXiv HTML URL.

### Behavior

1. Normalize and validate `htmlUrl`.
2. Derive canonical `paperId` from URL.
3. Check ingestion state in DB.
4. If already ingested for same `paperId`, return existing corpus metadata.
5. If missing, enqueue background ingestion job and return immediately.

### Output characteristics

- `paperId`
- `status`: `already_ingested | queued | ingesting | failed`
- `jobId` (nullable; optional if you do not expose job tracking yet)
- `htmlUrl`
- `message`

### HTML-only policy

- Ingestion source is strictly `https://arxiv.org/html/<id>`.
- No PDF fallback in this design.
- If HTML is unavailable, return a clear error with remediation text.

### Version policy

- Versioned URLs (`.../<id>vN`) are immutable corpus targets.
- Unversioned URLs (`.../<id>`) resolve to latest version at ingestion time.
- Recommended DB key: `paperId` (includes version when present).

---

## Canonical Runtime Flows

### Ingestion flow

1. Call `resolve_ingest_target` with title/id/url.
2. Choose target (explicit version preferred when user gave one).
3. Convert to `htmlUrl` and call `ingest_paper_html`.
4. Receive immediate status (`already_ingested` or `queued`).

Fast path:

1. User provides direct `htmlUrl`.
2. Call `ingest_paper_html({ htmlUrl })`.

## Convex Execution Model (Background Ingestion)

- Use `httpAction` routes as ingress (`convex/http.ts`).
- Parse request in `httpAction` and call internal mutation/action.
- For async ingestion, schedule internal action via `ctx.scheduler.runAfter(0, internal....)` and return HTTP response immediately.

Why this fits your requirement:

- Agent is not kept waiting on full ingestion.
- Ingestion work runs in background workflow.

Note on guarantees:

- Scheduled mutations: exactly-once execution.
- Scheduled actions: at-most-once execution (design idempotency and optional retry orchestration in your own state machine).

---

## arXiv API Notes (Used by Ingestion Resolver)

- Metadata endpoint: `https://export.arxiv.org/api/query`
- Useful params: `search_query`, `id_list`, `start`, `max_results`, `sortBy`, `sortOrder`
- Version semantics:
  - `id_list=<id>` returns latest version.
  - `id_list=<id>vN` returns that specific version.
- Respect polite pacing for repeated API requests.

---

## Practical Examples

- Resolve ingestion from HTML URL:
  - `resolve_ingest_target({ paperName: "https://arxiv.org/html/1706.03762v7", query: "transformer" })`
- Ingest exact version:
  - `ingest_paper_html({ htmlUrl: "https://arxiv.org/html/1706.03762v7" })`
- Ingest latest for unversioned ID:
  - `ingest_paper_html({ htmlUrl: "https://arxiv.org/html/1706.03762" })`
- Retrieval behavior is intentionally out of scope in this document.

---

## References

- arXiv API User Manual: https://info.arxiv.org/help/api/user-manual.html
- arXiv Identifier Format: https://info.arxiv.org/help/arxiv_identifier.html
- Example arXiv HTML page: https://arxiv.org/html/1706.03762v7
- Convex HTTP Actions: https://docs.convex.dev/functions/http-actions
- Convex Actions: https://docs.convex.dev/functions/actions
- Convex Scheduled Functions: https://docs.convex.dev/scheduling/scheduled-functions
