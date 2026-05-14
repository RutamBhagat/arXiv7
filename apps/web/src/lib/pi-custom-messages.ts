import type { Message } from "@earendil-works/pi-ai";
import type { AgentMessage, MessageRenderer } from "@earendil-works/pi-web-ui";
import { defaultConvertToLlm, registerMessageRenderer } from "@earendil-works/pi-web-ui";
import { Alert } from "@mariozechner/mini-lit/dist/Alert.js";
import { html } from "lit";

export interface SystemNotificationMessage {
  role: "system-notification";
  message: string;
  variant: "default" | "destructive";
  timestamp: string;
}

declare module "@earendil-works/pi-agent-core" {
  interface CustomAgentMessages {
    "system-notification": SystemNotificationMessage;
  }
}

const systemNotificationRenderer: MessageRenderer<SystemNotificationMessage> = {
  render: (notification) => {
    return html`
      <div class="px-4">
        ${Alert({
          variant: notification.variant,
          children: html`
            <div class="flex flex-col gap-1">
              <div>${notification.message}</div>
              <div class="text-xs opacity-70">
                ${new Date(notification.timestamp).toLocaleTimeString()}
              </div>
            </div>
          `,
        })}
      </div>
    `;
  },
};

export function registerCustomMessageRenderers() {
  registerMessageRenderer("system-notification", systemNotificationRenderer);
}

export function createSystemNotification(
  message: string,
  variant: "default" | "destructive" = "default",
): SystemNotificationMessage {
  return {
    role: "system-notification",
    message,
    variant,
    timestamp: new Date().toISOString(),
  };
}

export function customConvertToLlm(messages: AgentMessage[]): Message[] {
  const processed = messages.map((message): AgentMessage => {
    if (message.role === "system-notification") {
      return {
        role: "user",
        content: `<system>${message.message}</system>`,
        timestamp: Date.now(),
      };
    }

    return message;
  });

  return defaultConvertToLlm(processed);
}
