So is the migration complete?

Mostly yes, for the core goal.

Complete:

- Backend owns the real Pi Agent
- Backend owns prompt loop/runtime
- Backend owns transcript/session state in DB
- Backend owns RAG tools
- Backend owns provider auth
- Frontend uses a remote agent adapter
- Frontend streams backend AgentEvents into Pi ChatPanel
- Browser new Agent(...) is gone
- Browser provider-key prompting is bypassed
- Model selection works, limited to openai-codex + google
- Anthropic removed
- ChatGPT uses backend OAuth
- Gemini is the only API-key provider

Not complete / intentionally deferred:

- Session list/load/delete UI is not implemented; only current/new session + URL session load exists.
- Thinking selector is disabled.
- Web bundle still includes Pi AI provider code because pi-web-ui/types pull it in, but the runtime authority is no longer in browser.
- Attachments are disabled.
- Artifacts/browser tools are disabled/not migrated.

So: the authoritative agent runtime migration is complete enough. The remaining work is feature restoration around it, not moving the agent loop.