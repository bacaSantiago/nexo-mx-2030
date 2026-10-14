import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/nexo-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleNexoChat } = await import("@/lib/chat/nexo-chat.server");
        return handleNexoChat(request);
      },
    },
  },
});
