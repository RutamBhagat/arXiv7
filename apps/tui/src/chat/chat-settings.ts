import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getModels, type ModelThinkingLevel } from "@earendil-works/pi-ai";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const settingsPath = join(appRoot, ".data/chat-settings.json");

export const defaultProviderId = "openai-codex";
export const defaultReasoningLevel: ModelThinkingLevel = "medium";

export function getDefaultModelId(): string {
  const model = getModels(defaultProviderId).at(-1);
  if (!model) throw new Error(`No models found for default provider: ${defaultProviderId}`);
  return model.id;
}

export interface ChatSettings {
  providerId: string;
  modelId: string;
  reasoningLevel: ModelThinkingLevel;
}

export async function readChatSettings(): Promise<ChatSettings> {
  try {
    const settings = JSON.parse(await readFile(settingsPath, "utf8")) as Partial<ChatSettings>;
    return {
      providerId: settings.providerId ?? defaultProviderId,
      modelId: settings.modelId ?? getDefaultModelId(),
      reasoningLevel: settings.reasoningLevel ?? defaultReasoningLevel,
    };
  } catch {
    return {
      providerId: defaultProviderId,
      modelId: getDefaultModelId(),
      reasoningLevel: defaultReasoningLevel,
    };
  }
}

export async function writeChatSettings(settings: ChatSettings): Promise<void> {
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}
