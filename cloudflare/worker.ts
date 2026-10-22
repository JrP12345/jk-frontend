import vinext from "vinext/server/fetch-handler";
import { forwardWebSocket } from "./websocket";

// Preserve vinext's generated named exports and all non-fetch handlers.
export * from "vinext/server/fetch-handler";

const worker = {
  ...vinext,
  async fetch(request: Request, env: { BACKEND_INTERNAL_URL: string }, ctx: ExecutionContext) {
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      return forwardWebSocket(request, env.BACKEND_INTERNAL_URL);
    }
    return vinext.fetch(request, env, ctx);
  },
};

export default worker;
