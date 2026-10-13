import * as commonmark from "commonmark";
import type { Node as CommonMarkNode } from "commonmark";
import type { MarkdownBlock, MarkdownDocument } from "../spec/ast.js";
import { ParseError } from "./parser.js";

interface BlockHeading {
  readonly name: string;
  readonly startLine: number;
  readonly endLine: number;
}

const REF_NAME = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
const markdownParser = new commonmark.Parser();

function normalizeMarkdown(source: string): string {
  return source.replace(/^\uFEFF/, "").replace(/\r\n|\r/g, "\n");
}

function blockNameFromAtxH1(line: string): string | undefined {
  const match = /^ {0,3}#(?=$|[ \t])([ \t].*)?$/.exec(line);
  if (!match) return undefined;

  // CommonMark permits an optional closing sequence when whitespace separates it.
  const content = (match[1] ?? "")
    .replace(/[ \t]+#+[ \t]*$/, "")
    .trim();
  return REF_NAME.test(content) ? content : undefined;
}

function rootH1Nodes(document: CommonMarkNode): CommonMarkNode[] {
  const headings: CommonMarkNode[] = [];
  const walker = document.walker();
  let event = walker.next();
  while (event) {
    if (event.entering
      && event.node.type === "heading"
      && event.node.level === 1
      && event.node.parent?.type === "document") {
      headings.push(event.node);
    }
    event = walker.next();
  }
  return headings;
}

export function parseMarkdownBlocks(source: string): MarkdownDocument {
  const normalized = normalizeMarkdown(source);
  const lines = normalized.split("\n");
  const headings: BlockHeading[] = [];
  const names = new Set<string>();

  for (const heading of rootH1Nodes(markdownParser.parse(normalized))) {
    const startLine = heading.sourcepos[0][0];
    const endLine = heading.sourcepos[1][0];
    const name = blockNameFromAtxH1(lines[startLine - 1]);
    if (!name) {
      throw new ParseError(
        `Invalid root-level heading on line ${startLine}; use '# <ref_name>' for a block or '##' through '######' for content`,
      );
    }
    if (names.has(name)) {
      throw new ParseError(`Duplicate markdown block '${name}' on line ${startLine}`);
    }
    names.add(name);
    headings.push({ name, startLine, endLine });
  }

  const blocks: MarkdownBlock[] = headings.map((heading, index) => {
    const nextStartLine = headings[index + 1]?.startLine ?? lines.length + 1;
    return {
      name: heading.name,
      body: lines.slice(heading.endLine, nextStartLine - 1).join("\n").trimEnd(),
    };
  });

  return { kind: "MarkdownDocument", blocks };
}

export function markdownBlockMap(document: MarkdownDocument): Map<string, MarkdownBlock> {
  return new Map(document.blocks.map((block) => [block.name, block]));
}
