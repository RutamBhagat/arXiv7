import { Elysia, t } from "elysia";
import { and, db, eq, sql } from "@skyclad-bun/db";
import { paperDocs, papers } from "@skyclad-bun/db/schema/index";
import { cosineDistance, desc, isNotNull } from "@skyclad-bun/db";

import { embed } from "../ingest/source-ingest";

export const retrievalRoutes = new Elysia({ prefix: "/api/retrieval" })
  .post(
    "/resolve_paper_id",
    async ({ body }) => {
      const searchText = `${body.paperName}\n${body.query}`;
      const queryEmbedding = await embed(searchText);
      const similarity = sql<number>`1 - (${cosineDistance(papers.metadataEmbedding, queryEmbedding)})`;

      const rows = await db
        .select({
          paperId: papers.id,
          arxivId: papers.arxivId,
          title: papers.title,
          authors: papers.authors,
          summary: papers.summary,
          sourceUrl: papers.sourceUrl,
          ingestedAt: papers.ingestedAt,
          confidence: similarity,
        })
        .from(papers)
        .where(isNotNull(papers.metadataEmbedding))
        .orderBy((table) => desc(table.confidence))
        .limit(3);

      return {
        ok: true,
        result: rows,
      };
    },
    {
      body: t.Object({
        paperName: t.String(),
        query: t.String(),
      }),
    },
  )
  .post(
    "/query_paper_docs",
    async ({ body }) => {
      const paper = await db
        .select({ id: papers.id })
        .from(papers)
        .where(eq(papers.id, body.paperId))
        .limit(1);
      if (paper.length === 0) {
        return { ok: false, code: "NOT_INGESTED", result: [], args: body };
      }

      const queryEmbedding = await embed(body.query);
      const rows = await db
        .select({
          chunkId: paperDocs.id,
          section: paperDocs.sectionTitle,
          text: paperDocs.markdown,
          score: sql<number>`1 - (${cosineDistance(paperDocs.embedding, queryEmbedding)})`,
          locationHint: paperDocs.sourceFile,
        })
        .from(paperDocs)
        .where(and(eq(paperDocs.paperId, body.paperId), isNotNull(paperDocs.embedding)))
        .orderBy((table) => desc(table.score))
        .limit(3);

      return { ok: true, result: rows };
    },
    {
      body: t.Object({
        paperId: t.String(),
        query: t.String(),
      }),
    },
  );
