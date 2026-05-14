import "@tanstack/react-start/client-only";

import { Button } from "@skyclad-bun/ui/components/button";
import { Input } from "@skyclad-bun/ui/components/input";
import { Check, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { env } from "@skyclad-bun/env/web";
import { ChatPanel } from "@earendil-works/pi-web-ui";
import type { Agent } from "@earendil-works/pi-agent-core";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

type ServerModel = {
  provider: string;
  id: string;
  name?: string;
};

type ServerSessionSnapshot = {
  sessionId: string;
  sessionFile?: string;
  title: string;
  model: ServerModel | undefined;
  thinkingLevel: ThinkingLevel;
  messages: Array<{ role?: string; content?: unknown }>;
  isStreaming: boolean;
};

type RemoteSessionState = {
  systemPrompt: string;
  model: ServerModel | undefined;
  thinkingLevel: ThinkingLevel;
  messages: Array<{ role?: string; content?: unknown }>;
  tools: unknown[];
  isStreaming: boolean;
  streamingMessage?: unknown;
  pendingToolCalls: ReadonlySet<string>;
};

type RemoteSessionEvent = {
  type: string;
  [key: string]: unknown;
};

class RemoteChatSession {
  public state: RemoteSessionState;
  public streamFn?: unknown;
  public getApiKey?: unknown;

  private listeners = new Set<
    (event: RemoteSessionEvent) => void | Promise<void>
  >();
  private eventSource?: EventSource;

  constructor(
    public sessionId: string,
    snapshot: ServerSessionSnapshot,
  ) {
    this.state = {
      systemPrompt: "",
      model: snapshot.model,
      thinkingLevel: snapshot.thinkingLevel,
      messages: [...snapshot.messages],
      tools: [],
      isStreaming: snapshot.isStreaming,
      streamingMessage: undefined,
      pendingToolCalls: new Set(),
    };

    this.connect();
  }

  subscribe(listener: (event: RemoteSessionEvent) => void | Promise<void>) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async prompt(text: string) {
    this.state.isStreaming = true;
    return await this.request<ServerSessionSnapshot>(
      `/sessions/${encodeURIComponent(this.sessionId)}/prompt`,
      {
        method: "POST",
        body: JSON.stringify({ text }),
      },
    );
  }

  async abort() {
    return await this.request<ServerSessionSnapshot>(
      `/sessions/${encodeURIComponent(this.sessionId)}/abort`,
      {
        method: "POST",
      },
    );
  }

  async waitForIdle() {
    return await this.request<ServerSessionSnapshot>(
      `/sessions/${encodeURIComponent(this.sessionId)}/idle`,
      {
        method: "POST",
      },
    );
  }

  async setSessionName(title: string) {
    return await this.request<ServerSessionSnapshot>(
      `/sessions/${encodeURIComponent(this.sessionId)}/title`,
      {
        method: "PATCH",
        body: JSON.stringify({ title }),
      },
    );
  }

  dispose() {
    this.eventSource?.close();
    this.eventSource = undefined;
    this.listeners.clear();
  }

  private async request<T>(path: string, init: RequestInit) {
    const response = await fetch(`${env.VITE_SERVER_URL}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as T;
    if (this.isSessionSnapshot(data)) {
      this.applySnapshot(data);
    }
    return data;
  }

  private connect() {
    this.eventSource = new EventSource(
      `${env.VITE_SERVER_URL}/sessions/${encodeURIComponent(this.sessionId)}/events`,
    );

    this.eventSource.addEventListener("event", (rawEvent) => {
      const event = JSON.parse(
        (rawEvent as MessageEvent<string>).data,
      ) as RemoteSessionEvent;
      this.applyEvent(event);
      void this.emit(event);
    });

    this.eventSource.addEventListener("snapshot", (rawEvent) => {
      const snapshot = JSON.parse(
        (rawEvent as MessageEvent<string>).data,
      ) as ServerSessionSnapshot;
      this.applySnapshot(snapshot);
      void this.emit({ type: "snapshot", snapshot });
    });
  }

  private applyEvent(event: RemoteSessionEvent) {
    if (event.type === "agent_start" || event.type === "turn_start") {
      this.state.isStreaming = true;
      return;
    }

    if (event.type === "message_start") {
      const message = event.message as { role?: string } | undefined;
      if (message?.role && message.role !== "assistant") {
        this.state.messages = [
          ...this.state.messages,
          event.message as { role?: string; content?: unknown },
        ];
      }
      return;
    }

    if (event.type === "message_update") {
      this.state.isStreaming = true;
      this.state.streamingMessage = event.message;
      return;
    }

    if (event.type === "agent_end") {
      this.state.isStreaming = false;
      this.state.streamingMessage = undefined;
    }
  }

  private applySnapshot(snapshot: ServerSessionSnapshot) {
    this.sessionId = snapshot.sessionId;
    this.state.model = snapshot.model;
    this.state.thinkingLevel = snapshot.thinkingLevel;
    this.state.messages = [...snapshot.messages];
    this.state.isStreaming = snapshot.isStreaming;
    if (!snapshot.isStreaming) {
      this.state.streamingMessage = undefined;
    }
  }

  private async emit(event: RemoteSessionEvent) {
    for (const listener of this.listeners) {
      await listener(event);
    }
  }

  private isSessionSnapshot(value: unknown): value is ServerSessionSnapshot {
    return (
      typeof value === "object" &&
      value !== null &&
      "sessionId" in value &&
      "messages" in value
    );
  }
}

function updateUrl(sessionId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("session", sessionId);
  window.history.replaceState({}, "", url);
}

function clearSessionUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("session");
  window.history.replaceState({}, "", url);
}

async function createSession(sessionId?: string) {
  if (sessionId) {
    try {
      const response = await fetch(
        `${env.VITE_SERVER_URL}/sessions/${encodeURIComponent(sessionId)}`,
      );
      if (response.ok) {
        return (await response.json()) as ServerSessionSnapshot;
      }
    } catch {
      // fall through and create a new session
    }
  }

  const response = await fetch(`${env.VITE_SERVER_URL}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as ServerSessionSnapshot;
}

export default function PiChatApp() {
  const panelHostRef = useRef<HTMLDivElement | null>(null);
  const chatPanelRef = useRef<ChatPanel | null>(null);
  const sessionRef = useRef<{
    session?: RemoteChatSession;
    currentTitle: string;
  }>({ currentTitle: "" });

  const [currentTitle, setCurrentTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const bindSession = useCallback(async (snapshot: ServerSessionSnapshot) => {
    const chatPanel = chatPanelRef.current;
    if (!chatPanel) return;

    sessionRef.current.session?.dispose();
    sessionRef.current.session = new RemoteChatSession(
      snapshot.sessionId,
      snapshot,
    );
    sessionRef.current.currentTitle = snapshot.title || "";
    setCurrentTitle(snapshot.title || "");

    sessionRef.current.session.subscribe((event) => {
      if (event.type === "snapshot") {
        const nextSnapshot = event.snapshot as ServerSessionSnapshot;
        sessionRef.current.currentTitle = nextSnapshot.title || "";
        setCurrentTitle(nextSnapshot.title || "");
        if (nextSnapshot.sessionId) {
          updateUrl(nextSnapshot.sessionId);
        }
      }
    });

    await chatPanel.setAgent(sessionRef.current.session as unknown as Agent, {
      onApiKeyRequired: async () => true,
      onModelSelect: () => {},
    });

    if (chatPanel.agentInterface) {
      chatPanel.agentInterface.enableAttachments = false;
      chatPanel.agentInterface.enableModelSelector = false;
      chatPanel.agentInterface.enableThinkingSelector = false;
      chatPanel.agentInterface.requestUpdate();
    }

    chatPanel.requestUpdate();
  }, []);

  const startNewSession = useCallback(async () => {
    clearSessionUrl();
    sessionRef.current.currentTitle = "";
    sessionRef.current.session?.dispose();
    sessionRef.current.session = undefined;
    setCurrentTitle("");
    setDraftTitle("");
    setIsEditingTitle(false);

    const snapshot = await createSession();
    updateUrl(snapshot.sessionId);
    await bindSession(snapshot);
  }, [bindSession]);

  const commitTitle = useCallback(async () => {
    const nextTitle = draftTitle.trim();
    const session = sessionRef.current.session;
    if (nextTitle && session && nextTitle !== sessionRef.current.currentTitle) {
      await session.setSessionName(nextTitle);
      sessionRef.current.currentTitle = nextTitle;
      setCurrentTitle(nextTitle);
    }
    setIsEditingTitle(false);
  }, [draftTitle]);

  const cancelTitleEdit = useCallback(() => {
    setDraftTitle(sessionRef.current.currentTitle);
    setIsEditingTitle(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const chatPanel = new ChatPanel();
    chatPanel.classList.add("min-h-0", "flex-1");
    chatPanelRef.current = chatPanel;
    panelHostRef.current?.append(chatPanel);

    const init = async () => {
      try {
        const sessionId = new URLSearchParams(window.location.search).get(
          "session",
        );
        const snapshot = await createSession(sessionId || undefined);
        if (snapshot.sessionId !== sessionId) {
          updateUrl(snapshot.sessionId);
        }
        await bindSession(snapshot);
      } catch (error) {
        console.error("Failed to initialize Pi chat:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
      sessionRef.current.session?.abort();
      sessionRef.current.session?.dispose();
      chatPanel.remove();
      chatPanelRef.current = null;
    };
  }, [bindSession]);

  const titleEditor = isEditingTitle ? (
    <div className="flex min-w-0 items-center gap-1">
      <Input
        value={draftTitle}
        className="h-7 w-56"
        autoFocus
        onChange={(event) => setDraftTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void commitTitle();
          if (event.key === "Escape") cancelTitleEdit();
        }}
      />
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        title="Save title"
        onClick={() => void commitTitle()}
      >
        <Check />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        title="Cancel title edit"
        onClick={cancelTitleEdit}
      >
        <X />
      </Button>
    </div>
  ) : currentTitle ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="max-w-[min(32rem,45vw)] truncate text-sm font-medium"
      title="Edit title"
      onClick={() => {
        setDraftTitle(currentTitle);
        setIsEditingTitle(true);
      }}
    >
      {currentTitle}
    </Button>
  ) : (
    <div className="truncate px-2 text-sm font-semibold">Pi Chat</div>
  );

  return (
    <div className="flex h-svh w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-border">
        <div className="flex min-w-0 items-center gap-1 px-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="New session"
            onClick={() => void startNewSession()}
          >
            <Plus />
          </Button>
          {titleEditor}
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background text-sm text-muted-foreground">
            Loading...
          </div>
        ) : null}
        <div ref={panelHostRef} className="flex min-h-0 flex-1 flex-col" />
      </main>
    </div>
  );
}
