# Context7-Like Function Structure for arXiv Papers

You should expose exactly 2 backend functions:

1. `resolve_paper_id`
2. `query_paper_docs`

They form a strict two-step workflow for most use cases, exactly like Context7.

---

## 1) `resolve_paper_id`

### Purpose

- Maps a human paper reference (title / arXiv ID / arXiv URL) to a canonical paper ID.

### Why it exists

- `query_paper_docs` requires an exact `paperId`. This function is the discovery/normalization step.

### Signature

- `resolve_paper_id({ paperName: string, query: string })`

### Parameters

- `paperName` (required): Paper hint, title, raw arXiv ID, or arXiv URL.
- `query` (required): Task-specific intent for better ranking relevance.

### Behavior / Output Characteristics

- Returns candidate matches with metadata such as:
  - Paper ID (canonical path format)
  - arXiv ID (including version if available)
  - Title
  - Authors
  - Primary category
  - Published/updated timestamps
  - Abstract preview
  - Source URLs (`abs`, `html`, `pdf`)
  - Confidence score

### Selection logic guidance (implementation guidance)

- Prioritize:
  - Exact ID/URL normalization match
  - Exact title match
  - Title + author overlap
  - Relevance to user intent from abstract/title
  - Recency only as tie-breaker

### Canonical paper ID format

- `/arxiv/<arxiv-id>`
- `/arxiv/<arxiv-id>v<version>`

Examples:

- `/arxiv/1706.03762`
- `/arxiv/1706.03762v7`
- `/arxiv/hep-ex/0307015`
- `/arxiv/hep-ex/0307015v1`

Accepted aliases that normalize to canonical `paperId`:

- `arXiv:1706.03762v7`
- `https://arxiv.org/abs/1706.03762v7`
- `https://arxiv.org/html/1706.03762v7`
- `https://arxiv.org/pdf/1706.03762v7`

### Usage constraints

- Must be called before `query_paper_docs` unless the user already provides a valid `paperId` string (`/arxiv/<id>` or `/arxiv/<id>vN`).
- Do not call more than 3 times per question.

---

## 2) `query_paper_docs`

### Purpose

- Retrieves paper-grounded context and snippets for a specific resolved arXiv paper ID.

### Signature

- `query_paper_docs({ paperId: string, query: string })`

### Parameters

- `paperId` (required): Exact canonical paper ID.
- `query` (required): Focused paper question/task.

### Behavior

- Returns paper-grounded snippets relevant to the query against that specific paper corpus/version.
- Retrieval source priority:
  - Pre-ingested chunks (preferred)

  - arXiv HTML (`/html/<id>`)
  - PDF extraction fallback

### Output characteristics

- Snippet list should include:
  - `chunkId`
  - `section` (if detectable)
  - `text`
  - `score`
  - citation metadata (`absUrl`, `htmlUrl`, location hint)

### Usage constraints

- Preferably only after obtaining `paperId` from `resolve_paper_id` (or if user supplied valid `paperId`).
- Do not call more than 3 times per question.

---

## Canonical Flow

1. Call `resolve_paper_id` with paper hint + intent.
2. Choose best match (or versioned match if needed).
3. Call `query_paper_docs` with selected `paperId` + concrete question.

### Exception

- Skip step 1 if user already gave a valid canonical paper ID.

---

## Data Contract Summary

- Functions: exactly 2
- Input style: JSON object with required fields
- Hard dependency: `query_paper_docs` depends on valid `paperId`
- Soft policy: max 3 calls per function per question (instruction-level limit)

---

## Practical Examples

- Resolve:
  - `resolve_paper_id({ paperName: "Attention Is All You Need", query: "transformer architecture overview" })`
- Resolve via URL:
  - `resolve_paper_id({ paperName: "https://arxiv.org/html/1706.03762v7", query: "positional encoding" })`
- Query:
  - `query_paper_docs({ paperId: "/arxiv/1706.03762v7", query: "How is positional encoding defined and why is it needed?" })`

Versioned:

- `query_paper_docs({ paperId: "/arxiv/1706.03762v7", query: "..." })`

Unversioned (latest):

- `query_paper_docs({ paperId: "/arxiv/1706.03762", query: "..." })`

---

## arXiv API Notes (Implementation Grounding)

- Endpoint: `https://export.arxiv.org/api/query`
- Common params: `search_query`, `id_list`, `start`, `max_results`, `sortBy`, `sortOrder`
- Use `id_list` for exact ID/version verification in resolver
- Respect paging and polite request pacing

Version semantics:

- ID without `vN` resolves to latest version
- ID with `vN` resolves to that explicit version

---

## Assignment Alignment

- No hard 90-day restriction is baked into tool contracts.
- Paper is the corpus primitive (one paper = one corpus), which is valid and preferred for this Context7-style design.

## References

- arXiv API User Manual: https://info.arxiv.org/help/api/user-manual.html
- arXiv Identifier Format: https://info.arxiv.org/help/arxiv_identifier.html
- Example HTML paper page: https://arxiv.org/html/1706.03762v7

---

## Optional: If You Later Need MCP

If you later need MCP exposure for agent clients, keep the backend contract unchanged and add a thin MCP adapter layer.

### Recommended approach

1. Keep backend functions as the source of truth:
   - `resolve_paper_id({ paperName, query })`
   - `query_paper_docs({ paperId, query })`
2. Add MCP tools that map 1:1 to these functions:
   - `resolve_paper_id` tool calls backend `resolve_paper_id`
   - `query_paper_docs` tool calls backend `query_paper_docs`
3. Reuse the same JSON input/output schemas to avoid drift across transports.
4. Keep validation and ranking logic in backend services, not inside MCP handlers.

### Suggested MCP naming and namespace

- Namespace example: `mcp__arxiv_docs__`
- Tools:
  - `resolve_paper_id`
  - `query_paper_docs`

### Transport-specific notes

- MCP should only handle:
  - auth/session for MCP clients,
  - request/response serialization,
  - error mapping to tool-friendly messages.
- MCP should not duplicate:
  - resolver ranking logic,
  - retrieval/reranking logic,
  - arXiv ingestion/parsing pipelines.

### Why this design

- You can run the same functionality from:
  - direct backend API calls,
  - internal services/jobs,
  - MCP-based agent clients.
- One implementation path reduces divergence and debugging overhead.
