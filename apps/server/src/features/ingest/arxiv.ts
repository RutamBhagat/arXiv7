import { XMLParser } from "fast-xml-parser";

type ArxivCandidate = {
  arxiv_id: string;
  title: string;
  authors: string[];
};

export function parseArxivCandidates(rawResponse: string): ArxivCandidate[] {
  const parser = new XMLParser({
    ignoreDeclaration: true,
    parseTagValue: false,
    isArray: (tagName) => tagName === "entry" || tagName === "author",
  });

  const parsedResponse = parser.parse(rawResponse) as {
    feed?: {
      entry?: Array<{
        id: string;
        title: string;
        author: Array<{ name: string }>;
      }>;
    };
  };

  const entries = parsedResponse.feed?.entry;
  if (!entries) return [];

  return entries.map((entry) => {
    const arxivId = entry.id
      .replace("http://arxiv.org/abs/", "")
      .replace("https://arxiv.org/abs/", "");
    const authors = entry.author.map((author) => author.name);

    return {
      arxiv_id: arxivId,
      title: entry.title,
      authors,
    };
  });
}
