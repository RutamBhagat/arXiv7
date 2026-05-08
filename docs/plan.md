# Skyclad Implementation Plan

This plan is ordered to prove the smallest happy path first, then expand one capability at a time until every requirement in `docs/assignment.md` is satisfied. Do not start a later phase until the current phase has a runnable check and visible evidence.

At the start of each phase, re-check current docs and package versions instead of trusting this file. Pi is moving quickly; on May 7, 2026 `npm view` reports `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`, and `@mariozechner/pi-coding-agent` latest as `0.73.0`, while the local BTCA reference still uses older Pi versions.

## References

- Assignment requirements: `docs/assignment.md`
- Project build notes: `docs/guidelines.md`
- RAG/traversal design: `docs/rag.md`
- Pi local examples: `docs/btca-3/apps/server/src/agent/service.ts`, `docs/btca-3/apps/server/src/agent/threads.ts`, `docs/btca-3/apps/server/src/auth/service.ts`, `docs/btca-3/apps/pi-scratch/README.md`
- Convex schema/thread examples: `docs/btca-3/packages/convex/convex/schema.ts`, `packages/backend/convex/schema.ts`, `packages/backend/convex/chat.ts`
- TUI references: `docs/btca-3/apps/cli/src/tui/App.tsx`, `docs/btca-3/apps/cli/src/tui/launch.ts`
- UI references for final port only: `docs/t3-cloneathon/src/components/ChatPageContent.tsx`, `docs/t3-cloneathon/src/components/ChatInput.tsx`, `docs/t3-cloneathon/src/components/ChatSidebar.tsx`, `docs/btca-3/apps/webapp/src/lib/components/AgentChat.svelte`
- Current scaffolds to replace: `packages/backend/convex/agent.ts`, `packages/backend/convex/chat.ts`, `apps/tui/*`, and only in the final phase `apps/web/src/routes/ai.tsx`
- Pi repo/docs: https://github.com/badlogic/pi-mono, https://www.mintlify.com/badlogic/pi-mono/api/agent/core
- OpenClaw Pi integration reference: https://docs.openclaw.ai/pi
- Convex docs checked through Context7: schema/indexes, text search, vector search, actions, Convex Agent component docs for contrast
- TanStack Start docs checked through Context7: route loaders, server functions, API handlers
- arXiv API manual: https://info.arxiv.org/help/api/user-manual.html

## Phase 0 - Research Gate And Repo Orientation

- [ ] Search web for current Pi agent examples, package versions, and any breaking changes before coding.
- [ ] Use Context7 for any library touched in the phase: Convex, TanStack Start, Better Auth, parsing/embedding libraries, or any replacement package.
- [ ] Read the actual execution path before editing: current route, Convex function, schema, package dependencies, and generated files.
- [ ] Decide whether the phase changes runtime behavior, data model, UI state, or scripts, then list affected files in the commit notes.

## Phase 1 - Barebones Pi Agent, No RAG

- [ ] Remove the generated Vercel AI SDK / `@convex-dev/agent` runtime path from the real chat flow instead of wrapping it.
- [ ] Add Pi runtime packages directly to the backend package: `@mariozechner/pi-agent-core` and `@mariozechner/pi-ai`.
- [ ] Create a minimal Pi runner in `packages/backend/convex` or a small `packages/agent` package, modeled after `docs/btca-3/apps/server/src/agent/service.ts`.
- [ ] Implement only one backend action at first: accept `{ threadId, prompt }`, run `agentLoop`, and return/persist the assistant text.
- [ ] Keep tools empty for the first pass so failures are isolated to model auth, Pi event handling, and Convex scheduling.
- [ ] Persist raw Pi messages/events as JSON, even before the trace UI exists.
- [ ] Add a simple manual backend check: one prompt returns one assistant response and one stored run record.

## Phase 2 - Convex Chat State For One Happy Path

- [ ] Replace the generated Convex Agent schema assumptions with explicit tables: `threads`, `messages`, `agentRuns`, `toolEvents`.
- [ ] Keep tables small: thread title/status, message role/text/raw JSON, run status/model/final action, event sequence/raw JSON.
- [ ] Add mutations/queries for `createThread`, `listThreads`, `listMessages`, `sendMessage`, and `listRunEvents`.
- [ ] Use Convex actions for Pi execution because model calls and tool calls are external side effects.
- [ ] Add status transitions: `queued -> running -> completed | failed`.
- [ ] Verify with one end-to-end backend call: create thread, send prompt, store user message, store assistant message, store run events.

## Phase 3 - First OpenTUI + Backend End-To-End Test

- [ ] Implement the smallest `apps/tui` chat flow using explicit Convex queries/mutations.
- [ ] Render thread messages, one input, send action, loading state, and error state in OpenTUI.
- [ ] Do not build full sidebar, trace panel, auth UI, citations, or ingestion yet.
- [ ] Add a local test or scripted check that exercises OpenTUI-to-Convex-to-Pi-to-Convex behavior.
- [ ] Use this as the first real milestone: `bun install`, `bun run dev`, launch TUI, ask "reply with pong", see persisted response.

## Phase 4 - Model Auth And OpenAI Codex OAuth

- [ ] Re-check Pi OAuth docs/source and the BTCA auth implementation in `docs/btca-3/apps/server/src/auth/service.ts`.
- [ ] Add a direct credential layer for model auth; do not mix it with Better Auth user identity.
- [ ] Support API-key providers first if needed for fast local testing.
- [ ] Add OpenAI Codex OAuth using Pi OAuth helpers (`getOAuthProvider`, `getOAuthApiKey`) as a model credential source.
- [ ] Store model credential metadata locally or in Convex only after deciding which data is safe to persist.
- [ ] Add a settings/debug route or CLI command that confirms the active provider/model without exposing tokens.
- [ ] Re-run the Phase 3 chat test using the Codex OAuth-backed provider.

## Phase 5 - Minimal Agent Actions As Pi Tools

- [ ] Add explicit Pi tools one at a time, with TypeBox schemas like the BTCA Pi examples.
- [ ] Start with `finalAnswer` only, returning `{ answer, confidence, citations: [] }`.
- [ ] Add `askClarifyingQuestion` with `{ reason, question }`.
- [ ] Add `refuse` with `{ reason, category }`.
- [ ] Persist each `tool_execution_start` and `tool_execution_end` event in `toolEvents`.
- [ ] Update the system prompt so the model must choose `finalAnswer`, `askClarifyingQuestion`, or `refuse` instead of free-form completion.
- [ ] Verify three prompts: normal answer, ambiguous question, outside-domain refusal.

## Phase 6 - OpenTUI UX Shape (Primary Product Path)

- [ ] Use `docs/btca-3` CLI/TUI patterns for message stream, input ergonomics, and status indicators.
- [ ] Build thread list/navigation, message stream, input composer, and run status indicators in OpenTUI.
- [ ] Keep rendering direct and readable; polish is secondary to trace clarity.
- [ ] Show final action badges: `answer`, `clarify`, `refuse`.
- [ ] Keep file upload/model selectors out until RAG and evals are working.

## Phase 7 - External Tool: arXiv Lookup Or Web Search

- [ ] Search web for current arXiv API behavior and rate guidance before coding.
- [ ] Implement `lookupArxiv` as the first external tool because it matches the corpus and is lower risk than arbitrary web browsing.
- [ ] Use the arXiv API query endpoint with `cat:cs.AI`, `sortBy=submittedDate`, `sortOrder=descending`, paging, and a polite delay for repeated calls.
- [ ] Store tool input/output summaries, not huge raw XML, in `toolEvents`.
- [ ] Verify the agent can decide to call arXiv lookup for "what recent cs.AI papers exist about X?".
- [ ] Add web search only after arXiv lookup works, and keep it constrained to metadata/freshness checks.

## Phase 8 - Corpus Ingestion Skeleton

- [ ] Create an ingestion script that runs without the web UI: `bun run ingest:sample`.
- [ ] Start with 5-10 PDFs or abstracts so ingestion can be debugged quickly.
- [ ] Store paper metadata in Convex: arXiv id, title, authors, abstract, categories, published/updated dates, PDF URL, reference count, ingestion status.
- [ ] Store parse failures explicitly so bad PDFs do not break the whole run.
- [ ] Add `bun run ingest:full` only after sample ingestion is repeatable.
- [ ] Keep a small sample/cached metadata path so reviewers can run setup in under 10 minutes.

## Phase 9 - PDF Parsing And Chunking

- [ ] Search current PDF parsing options before choosing one; prefer a simple maintained TypeScript path unless Python tooling is clearly more reliable.
- [ ] Parse PDFs into page-aware text.
- [ ] Chunk with a direct strategy first: 600-900 tokens, 100-150 overlap, keep page range and section guess.
- [ ] Extract simple reference/citation strings from pages and bibliography sections: arXiv ids, DOI-like strings, bracketed numeric citations, and likely paper titles.
- [ ] Store `documentReferences` in Convex with source paper/chunk/page, raw citation text, resolved target when known, and confidence.
- [ ] Store chunks with parent paper metadata: `paperId`, `chunkIndex`, `text`, `tokenCount`, `pageStart`, `pageEnd`, `sectionGuess`, `referenceIds`.
- [ ] Add a small chunk inspection command that prints chunks for one known paper.
- [ ] Add a small reference inspection command that prints extracted references for one known paper.
- [ ] Do not add semantic chunking, layout-aware extraction, or an external graph database until the baseline has eval evidence.

## Phase 10 - Baseline Retrieval

- [ ] Use Context7 for Convex vector/text search docs before implementing indexes.
- [ ] Add embeddings for chunks with one inexpensive model and document the dimensionality in schema.
- [ ] Add Convex vector index for chunk embeddings.
- [ ] Add Convex text search index for lexical chunk search.
- [ ] Add normal indexes for paper namespace resolution: arXiv id, title, category/date, reference target, and chunk order.
- [ ] Implement `semanticSearchChunks` as the first Pi retrieval tool that takes `{ query, filters?, reason }`.
- [ ] Implement `searchChunks` for Convex full-text lexical search over stored chunks.
- [ ] Implement `resolvePaperSet` to identify likely paper namespaces by arXiv id, title, metadata, references, and optional document-level semantic search.
- [ ] Implement `queryPaperContext` to search/open/traverse inside selected paper namespaces and return a compact evidence pack.
- [ ] Implement `openChunk`, `openPaperPage`, and `listNeighborChunks` so the agent can inspect context around a hit.
- [ ] Implement `listReferences` and `openReference` over `documentReferences` so the agent can follow citation/reference edges.
- [ ] Start with vector-only retrieval to establish the baseline.
- [ ] Verify one answer cites chunks from the sample corpus.
- [ ] Verify one Context7-style namespace run: resolve a paper set, search inside it, open context, and cite the answer.
- [ ] Verify one traversal run: search an exact term, open the best chunk, inspect neighboring chunks, and follow one extracted reference if available.

## Phase 11 - Non-Naive Retrieval

- [ ] Implement one serious improvement beyond top-k cosine before adding more features.
- [ ] Preferred path: namespace-scoped retrieval = `resolvePaperSet` then lexical search/open/traverse within selected papers.
- [ ] Keep `queryPaperContext` as the default exact-answer retrieval tool, and allow bounded agent traversal with `searchChunks`, `openChunk`, `listNeighborChunks`, `listReferences`, and `openReference`.
- [ ] Use vector search for document-level discovery or semantic rescue, not as the default hard gate before lexical search.
- [ ] Add a small traversal policy to the system prompt: search/open/follow references when the first evidence points to another source needed for the answer.
- [ ] Add query rewrite using current thread summary only if namespace-scoped retrieval alone is insufficient.
- [ ] Add hybrid fusion or lightweight reranking only after namespace-scoped retrieval has a measurable baseline.
- [ ] Store `retrievalEvents`: original query, rewritten query if any, vector candidates, lexical candidates, fused/reranked candidates, opened chunks/pages, followed references, selected chunks.
- [ ] Store raw candidates in `retrievalEvents`, but send only selected evidence chunks to the model.
- [ ] Store resolved paper/document namespaces and whether vector search was used for discovery, rescue, fusion, or not used.
- [ ] Run a mini ablation: vector-only vs namespace-scoped lexical/traversal on the same eval cases.
- [ ] Add a diagnostic ablation for vector-first lexical narrowing vs namespace-first lexical/traversal; keep vector-first narrowing only if it wins on exact-answer cases.
- [ ] Add one traversal demo case where the answer requires opening nearby context or following a reference, even if it is not part of the main ablation score yet.

## Phase 12 - RAG Answering With Citations

- [ ] Update `finalAnswer` to require citations: `{ paperId, chunkId, pageRange, quote? }`.
- [ ] Group retrieved, opened, neighbor, and reference-followed chunks by parent paper before prompting so answers cite papers coherently.
- [ ] Add guardrails: if retrieval is weak or contradictory, choose clarify/refuse/unknown instead of forcing an answer.
- [ ] Render citations in the chat UI with paper title, arXiv id, page range, and chunk preview.
- [ ] Verify four cases: answerable question, not-in-corpus question, contradictory/insufficient context question, traversal-backed answer.

## Phase 13 - Memory That Affects Retrieval

- [ ] Add conversation memory: recent thread messages used as normal Pi context.
- [ ] Add semantic memory: short rolling thread summary plus entities/retrieval hints.
- [ ] Add episodic memory: structured per-thread facts such as selected papers, cited references, comparison targets, open citation trails, and unresolved clarifications.
- [ ] Store memory directly on `threads` as JSON fields; avoid a separate abstraction until duplication is real.
- [ ] Update memory after each completed run.
- [ ] Use memory to rewrite follow-up retrieval queries and resume reference traversal when the user says "that law/paper/section" or "the cited source".
- [ ] Verify with a follow-up question that omits the paper/topic but retrieves or follows the right reference because of memory.

## Phase 14 - Observability In OpenTUI

- [ ] Build a trace/debug view in OpenTUI tied to the selected assistant message or run.
- [ ] Show tool calls in order with status, reason, input summary, output summary, and errors.
- [ ] Show retrieval details: query, candidates, scores, selected chunks, opened chunks/pages, neighboring-context expansions, followed references, and citations.
- [ ] Show which evidence was sent to the model versus stored only for trace/debug.
- [ ] Show run metadata: model, provider, duration, token/cost if Pi exposes usage.
- [ ] Do not expose hidden chain-of-thought; expose decisions and evidence.
- [ ] Add demo-ready traces for one happy-path run, one traversal-backed run, and one refusal/clarification run.

## Phase 15 - Evaluation Harness

- [ ] Create `packages/evals` or `packages/backend/evals` with at least 10 cases.
- [ ] Include at least 6 answerable corpus questions.
- [ ] Include at least 2 refusal / "I don't know" cases.
- [ ] Include at least 2 clarification cases.
- [ ] Include one memory-dependent follow-up case.
- [ ] Include one traversal-dependent case where the first retrieved source cites or points to another source needed for the answer.
- [ ] Score behavior type, retrieval relevance, traversal quality when applicable, citation quality, faithfulness, completeness, model-context tokens, tool call count, and duration.
- [ ] Save results to JSON/Markdown and optionally Convex `evalRuns` / `evalResults`.
- [ ] Add `bun run eval`.
- [ ] Run vector-only vs namespace-scoped lexical/traversal ablation and record the result.
- [ ] Optionally run vector-first lexical narrowing vs namespace-first lexical/traversal as a diagnostic case.
- [ ] Optionally compare compact evidence-pack output against raw candidate output to show context-bloat reduction.
- [ ] Record the traversal case separately if it does not fit the vector-only vs namespace-first ablation cleanly.

## Phase 16 - Full Corpus

- [ ] Run `ingest:full` for 50-200 defensible cs.AI papers from the last 90 days.
- [ ] Record exact date window used. As of this planning date, "last 90 days" means papers from February 6, 2026 through May 7, 2026.
- [ ] If arXiv volume or parsing time is high, choose 50-100 papers and justify the subset.
- [ ] Store ingestion counts: fetched, downloaded, parsed, chunked, references extracted/resolved, embedded, skipped.
- [ ] Run evals against the full corpus and compare to sample-corpus behavior.

## Phase 17 - Auth, Sessions, And Thread-Specific Logic (TUI Path First)

- [ ] Use Better Auth for app user/session identity only after the anonymous/local TUI happy path works.
- [ ] Connect Better Auth user ids to Convex thread ownership.
- [ ] Scope threads, messages, runs, eval visibility, and credentials by user where needed.
- [ ] Add thread title generation after messages and memory are stable.
- [ ] Add thread rename/delete/archive only after core chat and traces work.
- [ ] Add per-thread retrieval hints and selected corpus filters.

## Phase 18 - README And Decision Log While Building

- [ ] Update README decisions as each major decision lands, not at the end.
- [ ] Explain why Pi replaced AI SDK / Convex Agent runtime: explicit agent loop, tool lifecycle events, provider flexibility, own RAG logic.
- [ ] Explain why Convex is used for durable reactive state, not as a RAG-in-a-box.
- [ ] Explain why agentic traversal is implemented as Convex search/open/reference tools instead of literal hosted `rg` or an external graph database.
- [ ] Explain corpus selection, chunking, embedding model, retrieval improvement, memory design, eval design, and known failures.
- [ ] Include setup that works in under 10 minutes: `bun install`, `bun run dev`, `bun run ingest:sample`, `bun run eval`.
- [ ] Include "what I would do with another week" as required by the assignment.

## Phase 19 - Demo Script (OpenTUI-First)

- [ ] Prepare a 5-8 minute demo.
- [ ] Architecture walkthrough: Pi agent, Convex state, ingestion/retrieval, evals.
- [ ] Query 1: happy path answer with citations.
- [ ] Query 2: ambiguous prompt that asks a clarifying question.
- [ ] Query 3: traversal-backed prompt where the agent searches, opens context, follows a reference, then answers or says evidence is insufficient.
- [ ] Query 4 if time allows: outside-corpus prompt that refuses or says unknown.
- [ ] Show OpenTUI trace/debug view for one run.
- [ ] Explain one decision that worked and one decision that remains uncertain.

## Phase 20 - Final TanStack Start UI Port (After Everything Else Is Complete)

- [ ] Start this phase only after Phases 1-19 are complete and stable in OpenTUI.
- [ ] Port stable flows from OpenTUI to `apps/web` (TanStack Start) without changing backend contracts.
- [ ] Implement web chat page, thread list, citations, and trace panel as a direct presentation layer over completed backend behavior.
- [ ] Keep behavior parity checks between OpenTUI and web while porting.
- [ ] Do not introduce new product features during the port; only adapt interaction and layout.

## Phase 21 - Brownie Points After Requirements Are Done

- [ ] Add a clean eval results page with behavior labels, citation links, and ablation summary.
- [ ] Add retrieval tuning controls in a debug-only panel: vector-only, namespace-first, vector-first lexical narrowing, namespace+rerank, hybrid fusion.
- [ ] Add source inspection view for papers/chunks used in an answer.
- [ ] Add reference trail inspection: source chunk -> extracted reference -> resolved target -> opened target context.
- [ ] Add cached sample corpus fixture with deterministic evals.
- [ ] Add richer paper metadata filters: author, date range, category, paper id.
- [ ] Add lightweight reranking if namespace-first retrieval already has baseline evidence and still needs better ordering.
- [ ] Add web search as freshness verification, clearly separated from corpus-grounded answers.
- [ ] Add demo-quality observability screenshots to README.
