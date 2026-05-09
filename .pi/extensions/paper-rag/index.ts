//@ts-ignore
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
//@ts-ignore
import { Type } from "typebox";

type ResolvePaperIdInput = {
  paperName: string;
  query: string;
};

type QueryPaperDocsInput = {
  paperId: string;
  query: string;
};

const DEFAULT_PAPER_RAG_BASE_URL = "http://localhost:3000";

async function callBackend<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${DEFAULT_PAPER_RAG_BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend error ${response.status}: ${errorText}`);
  }

  return (await response.json()) as T;
}

export default function setup(pi: ExtensionAPI) {
  pi.registerTool({
    name: "resolve_paper_id",
    label: "Resolve Paper ID",
    description:
      "Resolve a paper reference to a canonical paperId and verify whether that paper is indexed in the DB. Use this first unless a trusted paperId is already known.",
    parameters: Type.Object({
      paperName: Type.String(),
      query: Type.String(),
    }),
    //@ts-ignore
    async execute(_toolCallId, params: ResolvePaperIdInput) {
      const result = await callBackend<unknown>("/api/retrieval/resolve_paper_id", params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "query_paper_docs",
    label: "Query Paper Docs",
    description:
      "Retrieve grounded snippets for an already-indexed paperId. If results are not sufficient, optionally retry with a better query by rephrasing the question or using useful clues from retrieved snippets.",
    parameters: Type.Object({
      paperId: Type.String(),
      query: Type.String(),
    }),
    //@ts-ignore
    async execute(_toolCallId, params: QueryPaperDocsInput) {
      const result = await callBackend<unknown>("/api/retrieval/query_paper_docs", params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: {},
      };
    },
  });
}
