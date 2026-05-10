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
          locationHint: paperDocs.id,
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
  )
  .post(
    "/query_paper_docs_hybrid",
    async ({ body }) => {
      const queryEmbedding = await embed(body.query);

      const semanticRows = await db
        .select({
          chunkId: paperDocs.id,
          section: paperDocs.sectionTitle,
          text: paperDocs.markdown,
          semanticScore: sql<number>`1 - (${cosineDistance(paperDocs.embedding, queryEmbedding)})`,
          lexicalScore: sql<number>`0`,
        })
        .from(paperDocs)
        .where(and(eq(paperDocs.paperId, body.paperId), isNotNull(paperDocs.embedding)))
        .orderBy((table) => desc(table.semanticScore))
        .limit(5);

      const lexicalRows = await db
        .select({
          chunkId: paperDocs.id,
          section: paperDocs.sectionTitle,
          text: paperDocs.markdown,
          semanticScore: sql<number>`0`,
          lexicalScore: sql<number>`ts_rank_cd(${paperDocs.searchText}, websearch_to_tsquery('english', ${body.query}))`,
        })
        .from(paperDocs)
        .where(
          and(
            eq(paperDocs.paperId, body.paperId),
            sql`${paperDocs.searchText} @@ websearch_to_tsquery('english', ${body.query})`,
          ),
        )
        .orderBy((table) => desc(table.lexicalScore))
        .limit(5);

      const merged = [...semanticRows, ...lexicalRows];
      const byChunk = new Map<string, (typeof merged)[number]>();
      for (const row of merged) if (!byChunk.has(row.chunkId)) byChunk.set(row.chunkId, row);

      return { ok: true, result: Array.from(byChunk.values()).slice(0, 5) };
    },
    {
      body: t.Object({
        paperId: t.String(),
        query: t.String(),
      }),
    },
  );
