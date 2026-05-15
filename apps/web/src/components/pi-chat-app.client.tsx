import "@tanstack/react-start/client-only";

import { Button } from "@skyclad-bun/ui/components/button";
import { Input } from "@skyclad-bun/ui/components/input";
import { Check, MessageSquare, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChatPanel, ModelSelector } from "@earendil-works/pi-web-ui";
import {
  createSession,
  deleteSession,
  listSessions,
  loadSessionSnapshot,
  RemoteChatSession,
  toAgent,
  type ServerSessionListItem,
  type ServerSessionSnapshot,
} from "./remote-chat-session";

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
  const [sessions, setSessions] = useState<ServerSessionListItem[]>([]);

  const refreshSessions = useCallback(async () => {
    setSessions(await listSessions());
  }, []);

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
        void refreshSessions();
      }
    });

    await chatPanel.setAgent(toAgent(sessionRef.current.session), {
      onApiKeyRequired: async () => true,
      onModelSelect: () => {
        const session = sessionRef.current.session;
        if (!session) return;

        void ModelSelector.open(
          session.state.model,
          (model) => {
            session.state.model = model;
            chatPanel.agentInterface?.requestUpdate();
          },
          ["openai-codex", "google"],
        );
      },
    });

    if (chatPanel.agentInterface) {
      chatPanel.agentInterface.enableAttachments = false;
      chatPanel.agentInterface.enableModelSelector = true;
      chatPanel.agentInterface.enableThinkingSelector = true;
      chatPanel.agentInterface.requestUpdate();
    }

    chatPanel.requestUpdate();
  }, [refreshSessions]);

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
    await refreshSessions();
  }, [bindSession, refreshSessions]);

  const loadSession = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      const snapshot = await loadSessionSnapshot(sessionId);
      updateUrl(snapshot.sessionId);
      await bindSession(snapshot);
    } finally {
      setIsLoading(false);
    }
  }, [bindSession]);

  const removeSession = useCallback(async (sessionId: string) => {
    await deleteSession(sessionId);

    if (sessionRef.current.session?.sessionId !== sessionId) {
      await refreshSessions();
      return;
    }

    const remainingSessions = await listSessions();
    setSessions(remainingSessions);

    if (remainingSessions[0]) {
      await loadSession(remainingSessions[0].sessionId);
      return;
    }

    await startNewSession();
  }, [loadSession, refreshSessions, startNewSession]);

  const commitTitle = useCallback(async () => {
    const nextTitle = draftTitle.trim();
    const session = sessionRef.current.session;
    if (nextTitle && session && nextTitle !== sessionRef.current.currentTitle) {
      await session.setSessionName(nextTitle);
      sessionRef.current.currentTitle = nextTitle;
      setCurrentTitle(nextTitle);
      await refreshSessions();
    }
    setIsEditingTitle(false);
  }, [draftTitle, refreshSessions]);

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
        await refreshSessions();
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
  }, [bindSession, refreshSessions]);

  const sessionList = sessions.length ? (
    sessions.map((session) => {
      const isCurrent = session.sessionId === sessionRef.current.session?.sessionId;
      const title = session.title || "Untitled session";

      return (
        <div
          key={session.sessionId}
          className={
            isCurrent
              ? "flex items-center gap-1 bg-muted"
              : "flex items-center gap-1"
          }
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-0 flex-1 justify-start"
            title={title}
            onClick={() => void loadSession(session.sessionId)}
          >
            <MessageSquare />
            <span className="truncate">{title}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Delete session"
            onClick={() => void removeSession(session.sessionId)}
          >
            <Trash2 />
          </Button>
        </div>
      );
    })
  ) : (
    <div className="px-3 py-2 text-xs text-muted-foreground">No saved sessions</div>
  );

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

      <main className="relative flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-border">
          <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
            Sessions
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">{sessionList}</div>
        </aside>
        <div className="relative flex min-w-0 flex-1 flex-col">
          {isLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background text-sm text-muted-foreground">
              Loading...
            </div>
          ) : null}
          <div ref={panelHostRef} className="flex min-h-0 flex-1 flex-col" />
        </div>
      </main>
    </div>
  );
}
