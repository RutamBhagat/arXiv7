import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getModel, getModels, type AssistantMessage, type KnownProvider, type Model, type ModelThinkingLevel } from "@earendil-works/pi-ai";
import { createAgentSession, parseSkillBlock, SessionManager, SettingsManager, type ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { ChatMessageView } from "../shared/types";
import { createChatAuthStorage } from "../auth/chatgpt-auth";
import { defaultModelId, defaultProviderId, readChatSettings, writeChatSettings } from "./chat-settings";

const appSourceDir = dirname(fileURLToPath(import.meta.url));

export interface SkillInvocationView {
  name: string;
  content: string;
}

export interface ToolInvocationView {
  id: string;
  name: string;
  args?: any;
  result?: any;
  isError?: boolean;
  status: "start" | "end";
}

export interface ChatUsageView {
  cost: number;
  contextWindow: number;
  contextPercent: number | null;
  usingSubscription: boolean;
}

function findAppRoot(): string {
  const candidates = [process.cwd(), appSourceDir];

  for (const start of candidates) {
    let current = start;
    while (true) {
      if (existsSync(join(current, "package.json")) && existsSync(join(current, ".pi"))) {
        return current;
      }

      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  throw new Error("Could not find app root with package.json and .pi directory.");
}

export class ChatClient {
  private readonly appRoot = findAppRoot();
  private readonly agentDir = join(this.appRoot, ".pi");
  private readonly authStorage = createChatAuthStorage();
  private session: any;
  private providerId = defaultProviderId;
  private modelId = defaultModelId;
  private reasoningLevel: ModelThinkingLevel = "medium";

  async loadSettings(): Promise<void> {
    const settings = await readChatSettings();
    this.providerId = settings.providerId;
    this.modelId = settings.modelId;
    this.reasoningLevel = settings.reasoningLevel;
    await this.getSession();
  }

  getAvailableModels() {
    return this.session.modelRegistry
      .getAvailable()
      .filter((model: Model<any>) => model.provider === "openai-codex" || model.provider === "google");
  }

  hasAvailableModels(): boolean {
    return this.getAvailableModels().length > 0;
  }

  getModelId(): string {
    return this.modelId;
  }

  getProviderId(): string {
    return this.providerId;
  }

  getProviderAuthStatus(providerId: string) {
    return this.session.modelRegistry.getProviderAuthStatus(providerId);
  }

  refreshAuth(): void {
    this.authStorage.reload();
    this.session.modelRegistry.refresh();
  }

  async selectFirstAvailableModel(providerId?: string): Promise<boolean> {
    const models = this.getAvailableModels();
    const model = providerId ? models.find((model: Model<any>) => model.provider === providerId) : models[0];
    if (!model) return false;
    await this.setModel(model.provider, model.id, this.reasoningLevel);
    return true;
  }

  getReasoningLevel(): ModelThinkingLevel {
    return this.reasoningLevel;
  }

  private getSelectedModel(): Model<any> {
    return getModel(this.providerId as KnownProvider, this.modelId as never);
  }

  getUsage(): ChatUsageView {
    if (!this.hasAvailableModels()) {
      return { cost: 0, contextWindow: 0, contextPercent: null, usingSubscription: false };
    }

    const stats = this.session.getSessionStats();
    const contextUsage = stats.contextUsage;
    const model = this.session.state.model;
    return {
      cost: stats.cost,
      contextWindow: contextUsage?.contextWindow ?? model?.contextWindow ?? 0,
      contextPercent: contextUsage?.percent ?? null,
      usingSubscription: model ? this.session.modelRegistry.isUsingOAuth(model) : false,
    };
  }

  getLoadedResources(): { skills: string[]; extensions: string[] } {
    const skills = this.session.resourceLoader.getSkills().skills.map((skill: any) => skill.name);
    const extensions = this.session.resourceLoader.getExtensions().extensions.map((extension: any) => {
      if (extension.sourceInfo?.source?.startsWith("npm:")) return extension.sourceInfo.source.slice("npm:".length);
      const nodeModulesIndex = extension.path.split("/").lastIndexOf("node_modules");
      if (nodeModulesIndex >= 0) return extension.path.split("/").slice(nodeModulesIndex + 1, nodeModulesIndex + 3).join("/");
      return dirname(extension.path).split("/").at(-1) ?? extension.path;
    });
    return {
      skills: skills.sort((a: string, b: string) => a.localeCompare(b)),
      extensions: extensions.sort((a: string, b: string) => a.localeCompare(b)),
    };
  }

  getToolDefinition(name: string) {
    return this.session.getToolDefinition(name);
  }

  async bindExtensionUI(uiContext: ExtensionUIContext): Promise<void> {
    const session = await this.getSession();
    await session.bindExtensions({ uiContext });
  }

  private getRequestedSkillName(text: string): string | undefined {
    if (text.startsWith("/skill:")) return undefined;
    const normalized = text.toLowerCase();
    return this.session.resourceLoader.getSkills().skills.find((skill: any) => {
      const name = skill.name.toLowerCase();
      const terms = name.split("-");
      return normalized.includes(name) || terms.some((term: string) => term.length > 3 && normalized.includes(term));
    })?.name;
  }

  async setModel(providerId: string, modelId: string, reasoningLevel: ModelThinkingLevel): Promise<void> {
    this.providerId = providerId;
    this.modelId = modelId;
    this.reasoningLevel = reasoningLevel;
    await writeChatSettings({ providerId, modelId, reasoningLevel });

    if (this.session) {
      this.session.setThinkingLevel(reasoningLevel);
      await this.session.setModel(this.getSelectedModel());
    }
  }

  private async getSession() {
    if (!this.session) {
      const settings = JSON.parse(readFileSync(join(this.agentDir, "settings.json"), "utf8"));
      const result = await createAgentSession({
        cwd: this.appRoot,
        agentDir: this.agentDir,
        authStorage: this.authStorage,
        sessionManager: SessionManager.inMemory(),
        settingsManager: SettingsManager.inMemory(settings),
        model: this.getSelectedModel(),
        thinkingLevel: this.reasoningLevel,
      });
      this.session = result.session;
    }

    return this.session;
  }

  private getAssistantText(message: AssistantMessage): string {
    return message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("");
  }

  private getMessageText(message: any): string {
    if (typeof message.content === "string") return message.content;
    return message.content
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("");
  }

  async sendMessage(
    text: string,
    onDelta: (text: string) => void,
    onSkillInvocation: (skill: SkillInvocationView) => void,
    onToolInvocation: (tool: ToolInvocationView) => void,
  ): Promise<ChatMessageView> {
    if (!this.hasAvailableModels()) {
      throw new Error("No authenticated model. Use /login to configure a provider.");
    }

    const session = await this.getSession();
    const requestedSkillName = this.getRequestedSkillName(text);
    const promptText = requestedSkillName ? `/skill:${requestedSkillName} ${text}` : text;
    let assistantMessage: AssistantMessage | undefined;

    const unsubscribe = session.subscribe((event: any) => {
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        onDelta(event.assistantMessageEvent.delta);
      }
      if (event.type === "tool_execution_start") {
        onToolInvocation({ id: event.toolCallId, name: event.toolName, args: event.args, status: "start" });
      }
      if (event.type === "tool_execution_end") {
        onToolInvocation({ id: event.toolCallId, name: event.toolName, result: event.result, isError: event.isError, status: "end" });
      }
      if (event.type === "message_end" && event.message.role === "user") {
        const skillBlock = parseSkillBlock(this.getMessageText(event.message));
        if (skillBlock) onSkillInvocation({ name: skillBlock.name, content: skillBlock.content });
      }
      if (event.type === "message_end" && event.message.role === "assistant") {
        assistantMessage = event.message;
      }
    });

    try {
      await session.prompt(promptText);
    } finally {
      unsubscribe();
    }

    return {
      role: "assistant",
      content: assistantMessage ? this.getAssistantText(assistantMessage) : "",
    };
  }
}
