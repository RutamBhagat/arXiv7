import { cors } from "@elysiajs/cors";
import { env } from "@skyclad-bun/env/server";
import { Elysia } from "elysia";
import { logger } from "@bogeychan/elysia-logger";

import { agentRoutes } from "./features/agent/routes";
import { ingestRoutes } from "./features/ingest/routes";
import { retrievalRoutes } from "./features/retrieval/routes";

new Elysia()
  .use(logger())
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
    }),
  )
  .get("/", () => "OK")
  .use(agentRoutes)
  .use(ingestRoutes)
  .use(retrievalRoutes)
  .listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
  });
