import { sql, type SQL } from "drizzle-orm";
import { customType, index, jsonb, pgTable, text, timestamp, vector } from "drizzle-orm/pg-core";

export const embeddingDimensions = 3072;

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const papers = pgTable("papers", {
  id: text("id").primaryKey(),
  arxivId: text("arxiv_id").notNull().unique(),
  title: text("title").notNull(),
  authors: jsonb("authors").$type<string[]>().notNull(),
  summary: text("summary"),
  sourceUrl: text("source_url").notNull(),
  // used only to resolve a paper namespace from title/authors/summary before doc search
  metadataEmbedding: vector("metadata_embedding", {
    dimensions: embeddingDimensions,
  }),
  ingestedAt: timestamp("ingested_at"),
});

export const paperDocs = pgTable(
  "paper_docs",
  {
    id: text("id").primaryKey(),
    paperId: text("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    sectionTitle: text("section_title").notNull(),
    markdown: text("markdown").notNull(),
    // used inside a resolved paper namespace for semantic section search
    embedding: vector("embedding", { dimensions: embeddingDimensions }),
    // generated lexical index for exact terms, symbols, acronyms, and citations
    searchText: tsvector("search_text").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('english', coalesce(${paperDocs.sectionTitle}, '') || ' ' || coalesce(${paperDocs.markdown}, ''))`,
    ),
  },
  (table) => [index("paper_docs_search_idx").using("gin", table.searchText)],
);

export const ingestionJobs = pgTable("ingestion_jobs", {
  id: text("id").primaryKey(),
  status: text("status", {
    enum: ["ingesting", "completed", "failed"],
  }).notNull(),
  error: text("error"),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
});
