# Skyclad Ventures — AI Engineering Intern Assignment

**Timeline:** 7 days from receipt
**Submission:** Public GitHub repo + README + demo video → `hiring@skycladventures.com`**Stack:** Your choice. We have opinions but no mandates.

---

## Why this exists

We could ask you a hundred LeetCode questions. Instead, we want to see how you think when the problem is open-ended, the spec is incomplete, and the "right" answer depends on tradeoffs you have to surface yourself.

This assignment is intentionally underspecified in places. **Read those gaps as signal, not oversight.** How you handle them is most of what we're evaluating.

---

## The brief

Build an **agentic RAG system** that answers questions over a corpus of technical documents — but with a twist: the system must **decide for itself** when to retrieve, when to ask a clarifying question, when to use a tool, and when to refuse.

A naive RAG pipeline (embed → retrieve top-k → stuff into prompt → answer) will technically run. It will also fail this assignment.

### The corpus

Use the **arXiv papers in the cs.AI category from the last 90 days** (or any equivalent corpus of ~50–200 technical PDFs you can defend the choice of). You decide:

- How to ingest them
- How to chunk them
- How to embed them
- How to store them
- What metadata matters

We will not tell you. The choices you make here are part of what we're grading.

### The system

Your system must support, at minimum:

1. **A conversational interface** — CLI, web, or notebook. UI polish is not graded; clarity is.
2. **An agent loop** that can decide between at least these actions:
    - Retrieve from the corpus
    - Ask the user a clarifying question
    - Call at least one external tool (your choice — web search, code execution, calculator, arXiv API, whatever fits)
    - Refuse / say "I don't know"
    - Answer
3. **Memory** — the agent should remember prior turns within a conversation in a way that meaningfully affects retrieval and answers. Sliding-window-of-last-N-messages is the floor, not the ceiling. Show us you understand the difference between conversation memory, semantic memory, and episodic memory — and which ones matter here.
4. **Retrieval that isn't naive** — at minimum, you must implement *one* technique beyond top-k cosine similarity. Examples: hybrid search, reranking, query rewriting, HyDE, parent-document retrieval, multi-query, self-query. Pick one. Justify it. Show it working.
5. **Evaluation** — a small eval harness with at least 10 questions you wrote yourself, scored against expected behavior. We want to see *how you think about correctness*, not a perfect score. Include at least 2 questions that should cause your agent to refuse or ask for clarification.
6. **Observability** — we should be able to see, for any given query, what the agent decided to do and why. Logs, traces, a debug view — your call. If we can't inspect the agent's reasoning, we can't trust it.

---

## What we're actually grading

In rough order of weight:

### 1. Quality of decisions (40%)

Every meaningful choice in your system — chunking strategy, embedding model, agent framework, memory design, retrieval technique, eval methodology — should be **defended in your README** with at least one sentence on what you considered and why you picked what you picked. "I used LangChain because it's popular" is a failing answer. "I used LangGraph because I needed explicit state and the agent loop has more than 3 nodes" is the floor.

### 2. Depth over breadth (25%)

We would rather see **one technique implemented thoughtfully** (with an ablation showing it actually helped) than five techniques wired together with no evidence any of them matter. If you add reranking, show us the eval scores with and without it. If you add query rewriting, show us a query it fixed.

### 3. Failure modes (15%)

What does your system do when:

- The corpus doesn't contain the answer?
- The user asks something ambiguous?
- The retrieved context contradicts itself?
- The user asks something outside the domain?

We want to see you've thought about this, not just the happy path.

### 4. Code quality (10%)

Readable, organized, typed where it matters, tested where it matters. We don't need 100% coverage. We need to be able to read your code without wincing.

### 5. Communication (10%)

README quality, commit hygiene, demo video clarity. If you can't explain what you built, you didn't build it.

---

## Hard constraints

- **Use any LLM provider you want.** Anthropic, OpenAI, Google, open-weights — your call. If costs are a concern, use a small model and tell us why; we will not penalize you for being frugal.
- **Use any framework you want** — or none. LangGraph, LlamaIndex, Haystack, Pydantic AI, raw API calls, whatever. Justify the choice.
- **Do not use a hosted "RAG-in-a-box" product** (no Mendable, no Vectara end-to-end, no "just use this SaaS"). We want to see *your* engineering.
- **Do not exceed a single weekend's worth of compute spend.** This shouldn't cost more than a few dollars to run. If your design needs more, your design is wrong.

---

## What we are not grading

- Frontend prettiness
- How many features you cram in
- Whether your repo has 47 GitHub Actions workflows
- Whether you used the same stack we'd have used

---

## Submission

Email **`hiring@skycladventures.com`** with the subject line:

> **AI Intern Assignment — [Your Full Name]**
> 

The email must contain:

1. **Public GitHub repo URL** — code, README, evals, everything. Repo must be public; we will not request access.
2. **README** at the repo root, containing:
    - Setup instructions (we should be able to clone and run in under 10 minutes)
    - Architecture overview (a diagram is welcome but not required)
    - **Decisions log** — for each major choice, what you considered and why you picked what you did
    - **What you'd do with another week** — this section is mandatory and weighted
    - Known limitations and failure modes you observed
3. **Demo video** — 5 to 8 minutes, unlisted YouTube or Loom link.
    - Walk us through the architecture (2 min)
    - Show 3 queries: one happy path, one where the agent refuses or clarifies, one edge case (3 min)
    - Walk us through one decision you're proud of and one you're unsure about (2 min)
    - **Show your face on camera for at least part of it.** We hire humans, not repos.

---

## Timeline

- **Day 0:** You receive this assignment.
- **Day 7, 23:59 your local time:** Submission deadline.
- **Within 5 business days of submission:** We respond either way. We promise not to ghost you.

If something genuinely blocks you (illness, exam clash, a family thing) — email us before the deadline. We're reasonable. We're not reasonable about silent no-shows.

---

## A note on AI tools

Use them. Cursor, Claude Code, Copilot, ChatGPT, whatever. We use them every day. **But:**

- You must understand every line of code in your repo. We will ask.
- If your demo video reveals you can't explain your own architecture, the assignment is failed regardless of how well it runs.
- Do not paste this assignment into an LLM and submit what comes out. We have seen it; we can tell. It is the fastest way to a rejection.