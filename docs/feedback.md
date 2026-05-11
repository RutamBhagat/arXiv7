• Short answer: no, they do not expect a LangSmith-style eval specifically. They expect an eval harness.

  From docs/assignment.md, the actual requirement is:

  - docs/assignment.md:47: at least 10 self-written questions, scored against expected behavior
  - include at least 2 cases that should trigger refusal or clarification
  - docs/assignment.md:48: observability so they can inspect what the agent decided and why

  That can be a plain script, JSON fixtures, markdown table, or custom CLI output. LangSmith is optional, not implied.

  My read on your approach:

  1. You are not disqualified just because the frontend is mostly Pi CLI
      - The brief explicitly says conversational interface can be CLI/web/notebook.
      - It also explicitly says frontend prettiness is not graded.
      - Using Pi as the interaction shell is fine.
  2. You are not disqualified for focusing on backend engineering over "LLM vibes"
      - In fact, that probably helps if you can show why your retrieval/chunking choices improved results.
      - Your hybrid retrieval route in apps/server/src/features/retrieval/routes.ts is exactly the kind of non-naive retrieval they asked for.
      - The manual chunking/math-preservation argument is defensible if you demonstrate that it materially improved answer quality.
  3. The real risk is not your architecture. It is legibility.
      - If most of the agent loop, clarification behavior, tool selection, and memory live inside Pi, reviewers need to understand what is yours versus what Pi gives
        you.
      - If they cannot inspect the reasoning path, they may conclude the core assignment is outsourced to the shell.
      - That is the main danger.
  4. Your current README is a bigger problem than your technical approach
      - README.md is still the starter template.
      - The assignment requires setup, architecture, decisions log, limitations, evals, and “what I’d do with another week.”
      - As submitted now, that would hurt badly, regardless of how good the backend is.

  What I think they will likely think if you present it well:

  - Positive: custom ingestion discipline, chunk quality, math preservation, corpus-specific retrieval, and direct backend ownership all signal real engineering
    judgment.
  - Neutral to positive: Pi CLI as the interface is acceptable.
  - Negative if unclear: “the actual agent is mostly a third-party tool and the candidate mainly built retrieval endpoints.”

  So the question is not “will they reject this stack?”
  The question is “can you prove the assignment’s required behaviors are inspectable and intentionally designed?”

  What you need to make explicit in the README/demo:

  1. State the architecture honestly
      - Pi handles conversation runtime and tool invocation.
      - Your code owns corpus construction, chunking policy, metadata strategy, retrieval design, paper resolution, ingestion flow, and backend APIs.
      - If memory/clarification/refusal logic is partly enforced through Pi extension prompts/guards, say that directly and show where.
  2. Show the required agent behaviors with evidence
      - retrieve
      - clarify
      - tool use
      - refuse
      - answer
  3. Show observability
      - one trace or transcript where the agent first clarifies, then resolves paper id, then queries paper docs, then answers
      - one refusal case
      - one wrong retrieval or weak retrieval case and what the logs showed
  4. Ship a dead simple eval harness
      - no LangSmith needed
      - a sample/evals.json plus a bun run eval script is enough
      - each test should define:
          - user query
          - expected behavior class: answer | clarify | refuse
          - expected paper or corpus target if relevant
          - pass/fail notes
  5. Defend the manual chunking without sounding emotional
      - “I rejected PDF-to-markdown bulk conversion because it degraded formula fidelity and produced chunk boundaries that harmed retrieval precision.”
      - “I spent the time preserving math and section semantics because this corpus is technical, and retrieval quality depends on exact notation.”
      - That is a strong engineering argument.
  6. Be explicit about the ingestion limitation
      - arXiv API rate limiting forced partial manual acquisition/metadata generation
      - explain the impact
      - explain what you would automate with another week
      - this is not disqualifying if disclosed clearly

  My blunt assessment:

  - No, this approach is not inherently disqualifying.
  - Yes, it is enough for an interview if you package it correctly.
  - No, it is probably not enough as-is if the repo still looks like “starter app + clever backend + undocumented Pi magic.”

  If I were reviewing this, I would not reject you for using Pi CLI. I would reject only if:

  - I cannot tell what the agent is doing and why
  - the eval story is missing
  - the README does not defend the choices
  - the core “agentic” behavior appears to belong mostly to an external framework you cannot explain

  The strongest positioning for you is:

  - “I intentionally prioritized retrieval correctness and corpus fidelity over flashy agent scaffolding.”
  - “The agent surface is thin; the hard part is trustworthy paper resolution and grounded retrieval.”
  - “Here is the evidence that the chunking and hybrid retrieval improved outcomes.”
  - “Here are the failure modes and where the system refuses or asks for clarification.”

  If you want, I can help you next with one of these:

  1. rewrite the root README.md so it matches the assignment exactly
  2. design a minimal eval harness that satisfies the brief without LangSmith
  3. audit your current repo against the assignment and list the missing interview-critical pieces

  ---

  › tldr top most priority things to work on


• 1. Replace the root README.md
     It is still template content. This is the biggest submission risk.
     It needs:

  - setup in under 10 minutes
  - architecture overview
  - decisions log
  - eval methodology
  - known limitations/failure modes
  - “what I’d do with another week”

  2. Add the eval harness
     This is a hard requirement from docs/assignment.md:47.
     Minimum:

  - 10 questions
  - expected behavior per question: answer | clarify | refuse
  - at least 2 clarify/refuse cases
  - simple scored output

  3. Make observability obvious
     This is a hard requirement from docs/assignment.md:48.
     You need a reviewer to see:

  - what the agent decided
  - what tool it called
  - why it clarified/refused/retrieved
    If Pi already exposes this, document it and show it in the demo. If not, add a minimal trace/log view.

  4. Prove the agentic behaviors are yours and inspectable
     Biggest architecture risk.
     Be explicit about:

  - what Pi does
  - what your extension does
  - what your backend does
  - where clarification/refusal/tool-use logic lives
    If this is fuzzy, they may think the core assignment lives inside Pi, not your repo.

  5. Document and defend the chunking/retrieval choices
     This is likely your strongest differentiator.
     Show:

  - why math-preserving chunks matter
  - why hybrid retrieval helped
  - at least one before/after or ablation example
    Without this, your best work is invisible.

  6. Prepare the demo around 3 flows

  - happy path
  - clarification or refusal
  - edge case / failure mode
    The demo is where you can convert “weird architecture” into “clear engineering judgment.”

  If you want the strictest priority order: README -> eval harness -> observability -> architecture explanation -> demo prep.