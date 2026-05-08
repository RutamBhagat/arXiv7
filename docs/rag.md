# Skyclad RAG Plan

This project will not use a hosted RAG product such as Mendable, Vectara,
Pinecone Assistant, or a managed end-to-end file-search layer. The point of the
assignment is to show the ingestion, retrieval, agent decisions, memory,
citations, observability, and evals in this repo.

The implementation target is a citation-grounded, namespace-aware agentic RAG
system:

```text
arXiv metadata/PDF ingest
  -> page-aware PDF text extraction
  -> chunking with paper/page/section metadata
  -> document/citation references extracted as metadata
  -> embeddings
  -> Convex paper/chunk storage
  -> paper/document namespace IDs
  -> Convex vector search baseline
  -> Convex text search candidates
  -> agentic lexical search and document-open tools
  -> citation/reference traversal when needed
  -> namespace-scoped search before answer synthesis
  -> retrieval-tool-side pruning/reranking into a compact evidence pack
  -> Pi agent tool result
  -> cited final answer, clarification, refusal, or unknown
```

## Current Tech Stack

- Primary implementation shell: OpenTUI in `apps/tui` until all core behavior is complete.
- Final presentation shell: TanStack Start in `apps/web`, implemented only after the TUI path is complete and stable.
- Durable backend state: Convex in `packages/backend/convex`.
- Auth: Better Auth for app user/session identity only.
- Agent runtime: Pi through `@mariozechner/pi-agent-core` and
  `@mariozechner/pi-ai`, replacing the generated AI SDK / Convex Agent example
  on the real chat path.
- Package manager/runtime: Bun.
- Workspace: Turborepo packages, with RAG logic planned for a small explicit
  package once duplication is real.
- Corpus: arXiv `cs.AI` papers from the last 90 days, with a small sample mode
  for fast reviewer setup.
- Retrieval storage: Convex tables, vector indexes, and full-text search
  indexes. Convex is used as database/search infrastructure, not as a RAG
  product that hides the pipeline.
- Agentic traversal: Convex queries/actions expose corpus tools that behave like
  `rg`, `sed`, and "go to reference" over stored documents, without requiring a
  live filesystem search path in production.

## Delivery Order (Non-Negotiable)

Build and verify the product in this order:

1. Backend + Pi agent loop + Convex state.
2. OpenTUI end-to-end chat and trace UX.
3. Ingestion, retrieval, traversal, citations, memory, and evals.
4. Only after all of the above are complete: TanStack Start web UI in `apps/web`.

This keeps implementation incremental and avoids splitting effort across two UI
surfaces before core agent behavior is stable.

## Why This RAG Shape

The assignment rules out naive top-k cosine retrieval and hosted RAG-in-a-box.
The strongest small implementation is namespace-first retrieval because exact
technical evidence is usually easier to find after the agent has identified the
right paper, section, reference trail, or date/category slice.

Dense retrieval helps with paraphrases:

```text
"methods for planning with language models"
```

Lexical retrieval helps with exact terms:

```text
"MCTS", "ReAct", "cs.AI", "GPT-4.1", "Algorithm 2"
```

The first non-naive retrieval improvement will be namespace-scoped retrieval:

```text
resolve relevant paper/document namespace -> search/open/traverse inside it
```

This is closer to how Context7 works publicly: first resolve a
Context7-compatible library ID such as `/facebook/react`, then query relevant
docs inside that library. The library ID step is not just a convenience. It is a
high-value narrowing step that prevents unrelated projects from competing in the
same retrieval pool.

For this project, use the same idea:

```text
resolvePaperSet(question)
  -> selected paper ids / arXiv ids / cited-reference targets
  -> searchChunks scoped to those papers
  -> open chunks/pages/neighbors
  -> follow references if needed
```

Do not use chunk-level vector search as the only hard gate before lexical search.
If the vector step misses the exact legal clause, equation, acronym, or cited
paper, the lexical search never gets a chance to recover it. That is the wrong
failure mode for law-like or citation-heavy documents.

Use dense vectors in two safer places:

- document-level discovery over titles, abstracts, summaries, and metadata
- semantic rescue when lexical search has weak/no results

Reranking is useful, but it adds latency and another dependency. It should come
after the vector-only baseline, namespace-scoped lexical retrieval, and any
hybrid ablation prove where retrieval fails.

RAG does not prevent Codex/Claude Code-style traversal. In fact, the better
shape is to give the Pi agent several corpus-inspection tools:

- semantic vector search for fuzzy matches
- lexical search for exact terms, names, IDs, and quoted phrases
- document open/read for nearby context once a hit is found
- citation/reference traversal for linked documents
- metadata filters for paper, date, category, page range, and section

The distinction is:

```text
RAG index = the searchable memory layer
Agentic search = the loop that decides which search/read/traverse tool to call
```

For code, `rg` works well because files, symbols, imports, and call sites create
a navigable structure. Legal books, statutes, regulations, and case law have a
similar structure: sections cite other sections, cases cite earlier cases, and
answers often require following those links. For those corpora, one-shot vector
search is weaker than an agent that can search, open the source, inspect nearby
sections, follow citations, and then decide whether it has enough evidence.

## Convex Feasibility For Traversal

This is possible with the current Convex stack.

It should not be implemented as a literal hosted `rg` over files. Convex
functions do not need a mounted corpus directory for the app path. Instead,
store the corpus as structured records and expose tools that give the agent the
same workflow:

```text
searchExact("ReAct")
  -> openChunk(chunkId)
  -> openPage(paperId, pageNumber)
  -> listNeighborChunks(chunkId, before: 2, after: 2)
  -> listReferences(chunkId)
  -> openReferencedSource(referenceId)
```

Convex supports each piece directly enough for this assignment:

- Full-text search indexes support relevance-ordered lexical search over chunk
  text with equality filters.
- Vector indexes support semantic search from Convex actions.
- Normal database indexes support exact lookups by paper, chunk order, arXiv id,
  section, and reference target.
- Actions can call external embedding/model APIs and then load matching Convex
  documents by id.
- Queries can fetch documents, pages, neighboring chunks, and citation/reference
  edges for reactive UI display.

The limitation is that Convex full-text search is not a complete `ripgrep`
replacement. It is good for terms and phrases, not arbitrary local regex
workflows. That is acceptable here because the agent needs document research
tools, not general shell access. If literal regex search becomes necessary, add
a local ingestion/debug command for developer inspection, but keep the app path
on Convex indexes.

Recommended Convex traversal tables:

```text
papers
chunks
documentPages
documentReferences
retrievalEvents
```

`documentReferences` is the important addition for law-book-style traversal:

```ts
{
  sourcePaperId: Id<"papers">;
  sourceChunkId?: Id<"chunks">;
  sourcePage?: number;
  rawText: string;
  targetKind: "paper" | "section" | "statute" | "case" | "unknown";
  targetPaperId?: Id<"papers">;
  targetArxivId?: string;
  targetTitle?: string;
  targetSection?: string;
  confidence: number;
}
```

For the arXiv corpus, references can start simple: extract bibliography entries,
arXiv ids, DOI-like strings, and title matches. For a legal corpus, the same
table would store statute sections, regulation numbers, case names, and citation
strings. The agent can then follow references as an explicit tool call instead
of hoping vector search retrieves the cited authority by chance.

## Context7-Inspired Namespace Retrieval

Context7's public client and docs expose a useful pattern even though the
backend ranking, parsing, and crawling engines are private.

Visible flow:

```text
resolve-library-id(query, libraryName)
  -> returns exact library IDs with metadata
query-docs(libraryId, query)
  -> retrieves snippets only inside that library namespace
```

The public API and SDK show:

- `GET /api/v2/libs/search` takes `query` and `libraryName`.
- `GET /api/v2/context` takes `libraryId` and `query`.
- Search results include `id`, `name`, `description`, `totalSnippets`,
  `trustScore`, `benchmarkScore`, and `versions`.
- Context results include snippet `title`, `content`, and `source`.
- Context7 uses freshness checks, version-aware parsing, deduplication,
  benchmark scores, trust scores, and prompt-injection filtering according to
  its public docs.

The directly replicable idea is not the proprietary ranking model. It is the
two-step retrieval contract plus server-side filtering:

```text
1. Resolve the right namespace.
2. Retrieve precise context inside that namespace.
3. Return only the compact evidence needed to answer.
```

Apply that to papers:

```text
resolvePaperSet(query)
  -> paper ids, arXiv ids, titles, dates, categories, confidence
queryPaperContext(paperIds, query)
  -> lexical hits, opened chunks/pages, neighbors, references, citations
```

For law books, the namespace may be a title, chapter, statute, case, regulation,
or jurisdiction. For arXiv papers, the namespace is usually a paper, paper set,
category/date slice, or reference trail.

This is better than vector-first chunk narrowing when exact evidence matters.
Vectors can help discover likely papers, but they should not decide the final
lexical search space alone.

The newer Context7 context-bloat change adds another useful rule: do not ask the
main LLM to repeatedly call retrieval tools and manually filter large candidate
sets. Put the filtering work inside the retrieval tool. For this project,
`queryPaperContext` should return a compact evidence pack:

```ts
{
  namespaces: Array<{ paperId: string; title: string; confidence: number }>;
  evidence: Array<{
    chunkId: string;
    paperId: string;
    pageRange: string;
    title: string;
    text: string;
    reason: string;
  }>;
  openedContext: Array<{ chunkId: string; whyOpened: string }>;
  followedReferences: Array<{ referenceId: string; status: "resolved" | "unresolved" }>;
}
```

The agent trace should still store raw candidates for debugging, but the model
should only receive the small selected evidence set. That is how we get
Context7-like token efficiency without hiding the engineering.

## Corpus

Primary corpus:

- arXiv category: `cs.AI`
- Date window: last 90 days from the ingestion run
- Target size: 50-200 papers
- Fast sample: 5-10 papers or cached metadata/PDF text for reviewer setup

Stored paper fields:

```ts
{
  arxivId: string;
  title: string;
  authors: string[];
  abstract: string;
  categories: string[];
  publishedAt: number;
  updatedAt: number;
  pdfUrl: string;
  referenceCount: number;
  ingestionStatus: "pending" | "parsed" | "chunked" | "embedded" | "failed";
  ingestionError?: string;
}
```

The external tool should start with arXiv lookup because it is domain-specific,
low risk, and directly defensible for this corpus. General web search can be
added later only for freshness checks, not as a replacement for corpus-grounded
answers.

## Ingestion

The ingestion path should run outside the UI:

```bash
bun run ingest:sample
bun run ingest:full
```

Steps:

1. Fetch arXiv metadata for `cs.AI`.
2. Download PDFs for selected papers.
3. Parse PDF text with page boundaries preserved.
4. Chunk text.
5. Store paper and chunk metadata in Convex.
6. Embed chunks.
7. Record counts and failures.

Parse failures should be stored, not swallowed. A bad PDF should skip that
paper and let the rest of the corpus continue.

## Chunking

Use direct page/section-aware chunking first:

- Prefer heading and page boundaries.
- Fall back to token windows when headings are unreliable.
- Target 600-900 tokens per chunk.
- Use 100-150 token overlap.
- Keep page range and section guess on every chunk.

Stored chunk fields:

```ts
{
  paperId: Id<"papers">;
  chunkIndex: number;
  text: string;
  tokenCount: number;
  pageStart: number;
  pageEnd: number;
  sectionGuess?: string;
  referenceIds: Id<"documentReferences">[];
  embedding: number[];
}
```

Chunk metadata matters because final answers need citations reviewers can
inspect. The answer should cite a paper, page range, and chunk/source preview,
not just a raw vector hit.

## Retrieval

Retrieval is not only one vector-search call. The Pi agent should have
document-research tools similar to how coding agents search a repo, open a file,
inspect nearby lines, and then search again.

However, do not force the main LLM to do every filtering step itself. The
retrieval tools should perform bounded internal search/open/reference traversal
and return compact evidence. This avoids Context7-style context bloat where
repeated tool calls fill the context window with candidates the model later
discards.

Corpus tools should include:

```text
resolvePaperSet(query, filters?)
queryPaperContext(paperIds, query)
searchChunks(query, filters?)
semanticSearchChunks(query, filters?)
hybridSearchChunks(query, filters?)
openChunk(chunkId)
openPaperPage(paperId, pageNumber)
listNeighborChunks(chunkId, before, after)
listReferences(sourceId)
openReference(referenceId)
```

The default exact-answer path should use `queryPaperContext`. Internally, that
tool can traverse:

```text
user question
  -> resolve likely paper/document namespace
  -> search exact cited term inside that namespace
  -> open best chunk
  -> inspect neighboring chunks
  -> follow referenced paper/section
  -> run semantic search on the expanded issue
  -> answer with citations or say evidence is insufficient
```

For broad discovery questions, the agent may skip namespace resolution and use
wide lexical/vector search. For exact questions, namespace resolution should
happen before answer synthesis.

Tool output rule:

```text
store full candidates in retrievalEvents
send only selected evidence to the model
```

### Baseline

Start with vector-only retrieval so there is a measurable baseline:

```text
query -> embedding -> Convex vectorSearch -> top chunks
```

Convex vector search runs from actions, so retrieval that calls external
embedding APIs should live in an action or in code called by an action.

### Namespace-Scoped Improvement

Namespace-scoped retrieval is the first required improvement beyond naive top-k
cosine:

```text
query
  -> resolve likely paper/document namespaces
  -> text search within those namespaces
  -> vector search as semantic rescue or sidecar candidates
  -> fuse scores only when broad search is needed
  -> select top 8-12
```

Use a simple rank-based fusion first:

```ts
score = 1 / (60 + vectorRank) + 1 / (60 + textRank);
```

If a chunk appears in only one candidate list, it still gets that side's score.
This keeps exact-match-only and semantic-only hits visible without adding
complicated weighting.

Avoid this pipeline as the default:

```text
vector top N -> lexical search only inside those chunks
```

That makes vector recall the irreversible bottleneck. It is acceptable only as a
debug experiment or when searching inside a vector-discovered paper namespace,
not as the general retrieval policy.

### Reranking

Add reranking only after vector-only and namespace-scoped retrieval results are
recorded.

Preferred direct version:

```text
namespace-scoped candidates -> rerank query/chunk pairs -> top 8
```

Possible rerankers:

- `BAAI/bge-reranker-v2-m3` for a self-hosted/open model path.
- A small LLM-as-reranker pass if local reranker setup costs too much time.

Do not ship reranking as a hidden magic step. Store the before/after candidate
order in `retrievalEvents` so the demo can show what changed.

## Agent Actions

The Pi agent should choose among explicit actions rather than always retrieving.

Initial tools/actions:

- `resolvePaperSet`: identify likely paper namespaces by title, arXiv id,
  metadata, references, and optional document-level semantic search.
- `queryPaperContext`: search/open/traverse within selected paper namespaces
  and return a compact evidence pack.
- `hybridSearchChunks`: retrieve likely chunks with vector + text search.
- `searchChunks`: lexical search for exact terms and quoted phrases.
- `openChunk`: read one stored chunk by id.
- `listNeighborChunks`: read nearby chunks from the same paper.
- `listReferences`: list extracted citations/references from a chunk, page, or
  paper.
- `openReference`: open the resolved target for a citation/reference.
- `lookupArxiv`: fetch recent arXiv metadata for freshness or discovery.
- `finalAnswer`: return a cited answer.
- `askClarifyingQuestion`: ask one concrete clarification.
- `refuse`: refuse or say unknown when the request is outside scope or weakly
  supported.

The generated AI SDK / `@convex-dev/agent` example should be removed from the
real chat path. Pi is used because it exposes an explicit agent loop and tool
events that can be normalized into app traces.

Default model-facing flow:

```text
resolvePaperSet -> queryPaperContext -> finalAnswer | clarify | refuse
```

Lower-level search/open/reference tools can still exist, but they should be used
sparingly by the main agent and more often by `queryPaperContext` internally.

## Memory

Memory must affect retrieval, not only display old chat messages.

Use three direct forms:

- Conversation memory: recent messages are passed to the Pi context.
- Semantic memory: a short rolling thread summary with topic/entities.
- Episodic memory: structured per-thread facts such as selected papers,
  comparison targets, unresolved clarifications, and active filters.

Store memory fields directly on `threads` until a separate table is clearly
needed.

Follow-up retrieval should use memory to rewrite incomplete user questions:

```text
User: "How does it compare to ReAct?"
Memory: selected paper = "Tree Search for Language Model Agents"
Retrieval query: "Tree Search for Language Model Agents comparison with ReAct"
```

## Citations And Answering

The final answer should be generated from selected chunks only.

Answer rules:

- Cite every factual claim that depends on the corpus.
- Prefer citations at the sentence or paragraph level.
- Say "I do not know from the indexed corpus" when evidence is missing.
- Ask a clarification when the user query is underspecified.
- Refuse when the request is outside the allowed domain or cannot be grounded.

Citation shape:

```ts
{
  paperId: Id<"papers">;
  chunkId: Id<"chunks">;
  title: string;
  arxivId: string;
  pageRange: string;
  quote?: string;
}
```

The UI should render citations with paper title, arXiv id, page range, and a
short chunk preview.

## Observability

Every agent run should leave enough trace data to debug decisions without
exposing hidden chain-of-thought.

Store:

- original user prompt
- selected action
- tool call sequence
- retrieval query
- rewritten retrieval query, if any
- resolved paper/document namespaces and confidence
- vector candidates and scores/ranks
- text candidates and scores/ranks
- whether vector candidates were used for discovery, rescue, fusion, or not used
- fused candidates and selected chunks
- opened chunks/pages and neighboring-context expansions
- followed references and whether they resolved
- reranked candidates, if reranking is enabled
- final citations
- status, duration, model, and errors

Minimum tables:

- `agentRuns`
- `toolEvents`
- `retrievalEvents`

The trace UI should answer:

```text
Why did the agent retrieve?
Which paper/document namespace did it choose?
What query did it search?
What did retrieval return?
Which chunks were used?
Which source did it open next?
Which references did it follow?
Why did it answer, clarify, refuse, or say unknown?
```

## Evaluation

Create at least 10 eval cases before tuning retrieval too far.

Required mix:

- 6 answerable corpus questions
- 2 refusal or unknown cases
- 2 clarification cases
- 1 memory-dependent follow-up case
- 1 traversal-dependent case where the first hit cites or points to another
  source needed for the answer

Score:

- behavior type: answer, clarify, refuse, unknown
- retrieval relevance
- traversal quality, when references or neighboring chunks are needed
- citation quality
- faithfulness to cited chunks
- completeness
- context tokens sent to the model
- retrieval/tool call count
- duration

Run at least this ablation:

```text
vector-only vs namespace-scoped lexical/traversal
```

If reranking is added:

```text
vector-only vs namespace-scoped lexical/traversal vs namespace+rerank
```

Optional diagnostic ablation:

```text
vector-first lexical narrowing vs namespace-first lexical/traversal
```

Only keep vector-first lexical narrowing if it wins on exact-answer and
traversal-dependent eval cases. The expected risk is lower recall because dense
search can silently exclude the chunk that lexical search would have found.

The README should include the result even if the score is imperfect. The
assignment rewards defended decisions and visible failure modes more than a
polished black box.

## Implementation Order

1. Replace the generated chat runtime with a minimal Pi agent loop.
2. Add explicit Convex tables for threads, messages, runs, and tool events.
3. Build one working chat path without RAG.
4. Add arXiv lookup as the first external tool.
5. Add ingestion sample mode.
6. Add PDF parsing and chunk storage.
7. Extract simple document references and citation strings.
8. Add vector-only retrieval.
9. Add `resolvePaperSet` and `queryPaperContext`.
10. Add lexical search, open chunk/page, neighbor chunk, and reference traversal
   tools.
11. Add citations.
12. Add namespace-scoped lexical/traversal ablation against vector-only.
13. Add hybrid fusion or reranking only if evals show a gap.
14. Add memory-based query rewriting.
15. Add observability UI.
16. Add eval harness and README decision log.

This order keeps the agent loop and state model proven before retrieval becomes
complex.

## Explicit Non-Goals

- No hosted RAG-in-a-box.
- No hidden managed file-search product.
- No arbitrary shell/code sandbox in the first version.
- No GraphRAG until the simpler retrieval baseline proves it is needed.
- No external graph database in the first version; model citation/reference
  edges directly in Convex first.
- No chunk-level vector-first lexical narrowing as the default retrieval policy.
- No semantic chunking framework until page-aware chunking has eval evidence.
- No compatibility wrapper around the generated AI SDK example.
