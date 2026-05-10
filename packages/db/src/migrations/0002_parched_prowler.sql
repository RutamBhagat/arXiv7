DROP INDEX "paper_docs_paper_doc_index_unique";--> statement-breakpoint
DROP INDEX "paper_docs_paper_source_file_unique";--> statement-breakpoint
DROP INDEX "paper_docs_paper_order_idx";--> statement-breakpoint
DROP INDEX "paper_docs_paper_kind_idx";--> statement-breakpoint
ALTER TABLE "paper_docs" DROP COLUMN "doc_index";--> statement-breakpoint
ALTER TABLE "paper_docs" DROP COLUMN "section_path";--> statement-breakpoint
ALTER TABLE "paper_docs" DROP COLUMN "section_level";--> statement-breakpoint
ALTER TABLE "paper_docs" DROP COLUMN "section_kind";--> statement-breakpoint
ALTER TABLE "paper_docs" DROP COLUMN "source_file";