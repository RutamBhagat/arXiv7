import { Elysia, t } from "elysia";
import { parseArxivCandidates } from "./arxiv";

export const ingestRoutes = new Elysia({ prefix: "/api/ingest" }).post(
  "/resolve_ingest_target",
  async ({ body }) => {
    const searchQuery = `ti:"${body.paperName}" AND all:"${body.query}"`;
    const apiUrl = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}&start=0&max_results=3&sortBy=relevance&sortOrder=descending`;
    const response = await fetch(apiUrl);

    const rawResponse = await response.text();
    const candidates = parseArxivCandidates(rawResponse);

    return {
      status: response.status,
      ok: response.ok,
      result: candidates,
      args: body,
    };
  },
  {
    body: t.Object({
      paperName: t.String(),
      query: t.String(),
    }),
  },
);
