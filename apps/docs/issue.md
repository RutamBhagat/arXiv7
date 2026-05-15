Title: apps/web chat send is blocked client-side before /prompt request when AppStorage is not initialized

Summary

In apps/web, typing in the message input and pressing Enter/clicking Send can do nothing, with no request visible in the Network tab.

Current behavior

- User enters message and sends.
- No POST /api/agent/sessions/:id/prompt request is made.
- Chat appears unresponsive.

Root cause

@earendil-works/pi-web-ui’s AgentInterface.sendMessage() performs a client-side provider key check via getAppStorage().providerKeys.get(provider) before calling session.prompt(...).

In apps/web, chat is server-backed, but AppStorage was not initialized originally. This caused client-side failure/gating before network request dispatch.

Even when initialized, this creates split responsibility:

- client-side storage decides whether send can proceed
- server-side auth/session logic decides actual execution

Why this is a design problem

This creates two potential sources of truth, client and server, for send authorization and can go out of sync:

- client may block sends that server would allow
- client may allow sends that server rejects
- failures can happen before request, making debugging harder and UX confusing

Ideal fix

Make the server the single source of truth for send authorization/readiness.

### Proposed changes

1. Remove client-side provider-key gating from AgentInterface.sendMessage(), or make it optional/disabled for server-backed mode.
2. Always attempt session.prompt(...) when input is valid.
3. Let the backend /prompt endpoint enforce auth/model readiness and return explicit errors.
4. Surface backend error responses directly in the UI.

Acceptance criteria

- Sending a message always triggers a network request unless input is empty or actively streaming.
- No hard dependency on setAppStorage() for server-backed send flow.
- Auth/readiness failures come from backend responses and are shown in the UI.
- No silent client-side preflight block prevents request emission.

Temporary workaround currently used

apps/web initializes AppStorage using IndexedDBStorageBackend, stores, and setAppStorage, so current pi-web-ui behavior does not fail early. This restores functionality but does not solve the underlying split-authority design.