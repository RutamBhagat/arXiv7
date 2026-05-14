import { Elysia, t } from "elysia";

import {
  abortAgent,
  createAgent,
  getAgent,
  getSessionTitle,
  setSessionTitle,
  streamPrompt,
  toPersistableState,
} from "./session-manager";

function encodeSse(data: unknown) {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function snapshot(sessionId: string) {
  const agent = getAgent(sessionId);
  if (!agent) return undefined;

  return {
    sessionId,
    title: getSessionTitle(sessionId),
    state: toPersistableState(agent),
    isStreaming: agent.state.isStreaming,
  };
}

function generateTitle(messages: Array<{ role?: string; content?: unknown }>) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage) return "";

  const content = firstUserMessage.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .filter((item): item is { type: "text"; text?: string } => item.type === "text")
            .map((item) => item.text || "")
            .join(" ")
        : "";

  const trimmed = text.trim();
  if (!trimmed) return "";

  const sentenceEnd = trimmed.search(/[.!?]/);
  if (sentenceEnd > 0 && sentenceEnd <= 50) {
    return trimmed.substring(0, sentenceEnd + 1);
  }

  return trimmed.length <= 50 ? trimmed : `${trimmed.substring(0, 47)}...`;
}

function shouldSaveSession(messages: Array<{ role?: string }>) {
  const hasUserMessage = messages.some((message) => message.role === "user");
  const hasAssistantMessage = messages.some((message) => message.role === "assistant");

  return hasUserMessage && hasAssistantMessage;
}

function updateGeneratedTitle(sessionId: string) {
  if (getSessionTitle(sessionId)) return;

  const agent = getAgent(sessionId);
  if (!agent) return;

  const messages = agent.state.messages as Array<{ role?: string; content?: unknown }>;
  if (!shouldSaveSession(messages)) return;

  const title = generateTitle(messages);
  if (title) setSessionTitle(sessionId, title);
}

export const agentRoutes = new Elysia({ prefix: "/api/agent" })
  .post("/sessions", () => {
    const sessionId = crypto.randomUUID();
    const agent = createAgent(sessionId);

    return {
      sessionId,
      title: getSessionTitle(sessionId),
      state: toPersistableState(agent),
      isStreaming: agent.state.isStreaming,
    };
  })
  .get("/sessions/:sessionId", ({ params, set }) => {
    const currentSnapshot = snapshot(params.sessionId);
    if (!currentSnapshot) {
      set.status = 404;
      return { error: "session_not_found" };
    }

    return currentSnapshot;
  })
  .post(
    "/sessions/:sessionId/prompt",
    ({ params, body, set }) => {
      const agent = getAgent(params.sessionId);
      if (!agent) {
        set.status = 404;
        return { error: "session_not_found" };
      }

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            await streamPrompt(agent, body.message as any, async (event) => {
              controller.enqueue(encodeSse(event));
            });

            updateGeneratedTitle(params.sessionId);
            controller.enqueue(encodeSse({
              type: "snapshot",
              snapshot: {
                sessionId: params.sessionId,
                title: getSessionTitle(params.sessionId),
                state: toPersistableState(agent),
                isStreaming: agent.state.isStreaming,
              },
            }));
            controller.enqueue(encodeSse({ type: "done" }));
          } catch (error) {
            controller.enqueue(
              encodeSse({
                type: "server_error",
                error: error instanceof Error ? error.message : String(error),
              }),
            );
          } finally {
            controller.close();
          }
        },
      });

      set.headers["content-type"] = "text/event-stream; charset=utf-8";
      set.headers["cache-control"] = "no-cache, no-transform";
      set.headers.connection = "keep-alive";

      return stream;
    },
    {
      body: t.Object({
        message: t.Any(),
      }),
    },
  )
  .post("/sessions/:sessionId/abort", ({ params, set }) => {
    if (!getAgent(params.sessionId)) {
      set.status = 404;
      return { error: "session_not_found" };
    }

    abortAgent(params.sessionId);
    return { ok: true };
  })
  .patch(
    "/sessions/:sessionId/title",
    ({ params, body, set }) => {
      if (!setSessionTitle(params.sessionId, body.title)) {
        set.status = 404;
        return { error: "session_not_found" };
      }

      return snapshot(params.sessionId)!;
    },
    {
      body: t.Object({
        title: t.String(),
      }),
    },
  )
  .patch(
    "/sessions/:sessionId/state",
    ({ params, body, set }) => {
      const agent = getAgent(params.sessionId);
      if (!agent) {
        set.status = 404;
        return { error: "session_not_found" };
      }

      if (body.model) agent.state.model = body.model as any;
      if (body.thinkingLevel) agent.state.thinkingLevel = body.thinkingLevel as any;
      if (typeof body.systemPrompt === "string") {
        agent.state.systemPrompt = body.systemPrompt;
      }

      return {
        ok: true,
        sessionId: params.sessionId,
        title: getSessionTitle(params.sessionId),
        state: toPersistableState(agent),
        isStreaming: agent.state.isStreaming,
      };
    },
    {
      body: t.Object({
        model: t.Optional(t.Any()),
        thinkingLevel: t.Optional(t.String()),
        systemPrompt: t.Optional(t.String()),
      }),
    },
  );
