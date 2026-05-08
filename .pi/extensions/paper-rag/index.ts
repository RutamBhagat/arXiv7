//@ts-ignore
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
//@ts-ignore
import { Type } from "typebox";

type ResolveIngestTargetInput = {
  paperName: string;
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
    name: "resolve_ingest_target",
    label: "Resolve Ingest Target",
    description:
      "Resolve a paper reference to an arXiv HTML ingestion target. NOTE: Do not retry if you encounter 429 status code",
    parameters: Type.Object({
      paperName: Type.String(),
      query: Type.String(),
    }),
    //@ts-ignore
    async execute(_toolCallId, params: ResolveIngestTargetInput) {
      const result = await callBackend<unknown>("/api/ingest/resolve_ingest_target", params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: {},
      };
    },
  });
}
