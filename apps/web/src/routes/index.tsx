import { ClientOnly, createFileRoute } from "@tanstack/react-router";

import PiChatApp from "@/components/pi-chat-app.client";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <ClientOnly fallback={<PiChatLoading />}>
      <PiChatApp />
    </ClientOnly>
  );
}

function PiChatLoading() {
  return (
    <div className="flex h-svh w-full items-center justify-center bg-background text-sm text-muted-foreground">
      Loading...
    </div>
  );
}
