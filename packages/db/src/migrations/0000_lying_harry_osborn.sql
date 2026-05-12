CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "ingestion_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "paper_docs" (
	"id" text PRIMARY KEY NOT NULL,
	"paper_id" text NOT NULL,
	"section_title" text NOT NULL,
	"markdown" text NOT NULL,
	"embedding" vector(1536),
	"search_text" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("paper_docs"."section_title", '') || ' ' || coalesce("paper_docs"."markdown", ''))) STORED,
	"search_text_simple" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce("paper_docs"."section_title", '') || ' ' || coalesce("paper_docs"."markdown", ''))) STORED
);
--> statement-breakpoint
CREATE TABLE "papers" (
	"id" text PRIMARY KEY NOT NULL,
	"arxiv_id" text NOT NULL,
	"title" text NOT NULL,
	"authors" jsonb NOT NULL,
	"summary" text,
	"source_url" text NOT NULL,
	"metadata_embedding" vector(1536),
	"ingested_at" timestamp,
	CONSTRAINT "papers_arxiv_id_unique" UNIQUE("arxiv_id")
);
--> statement-breakpoint
ALTER TABLE "paper_docs" ADD CONSTRAINT "paper_docs_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paper_docs_paper_id_idx" ON "paper_docs" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "paper_docs_embedding_hnsw_idx" ON "paper_docs" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "paper_docs_search_idx" ON "paper_docs" USING gin ("search_text");--> statement-breakpoint
CREATE INDEX "paper_docs_search_simple_idx" ON "paper_docs" USING gin ("search_text_simple");--> statement-breakpoint
CREATE INDEX "papers_metadata_embedding_hnsw_idx" ON "papers" USING hnsw ("metadata_embedding" vector_cosine_ops);