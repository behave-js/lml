import type {
  BoundMarkdown,
  Diagnostic,
  Document,
  MarkdownDocument,
  ResolvedSlide,
} from "../spec/ast.js";
import { parseMarkdownBlocks } from "./parse-md.js";
import { parseLml } from "./parser.js";
import { collectMarkdownRefs, hasErrors, validateLml } from "./validate-lml.js";

export interface JoinResult {
  slide?: ResolvedSlide;
  diagnostics: Diagnostic[];
}

/**
 * Optionally associates LML semantic anchors with named Markdown context.
 * This utility does not render, inject, or measure Markdown content.
 */
export function joinSlide(layout: Document, markdown: MarkdownDocument): JoinResult {
  const diagnostics = validateLml(layout);
  const refs = collectMarkdownRefs(layout);
  const seen = new Set<string>();
  const blockNames = new Set(markdown.blocks.map((b) => b.name));
  const used = new Set<string>();

  for (const ref of refs) {
    if (seen.has(ref)) {
      diagnostics.push({
        severity: "error",
        code: "E002",
        message: `Duplicate markdown reference '${ref}'`,
      });
    }
    seen.add(ref);

    const block = markdown.blocks.find((b) => b.name === ref);
    if (!block) {
      diagnostics.push({
        severity: "error",
        code: "E001",
        message: `Unresolved markdown reference '${ref}'`,
      });
    } else {
      used.add(ref);
    }
  }

  for (const name of blockNames) {
    if (!used.has(name)) {
      diagnostics.push({
        severity: "warning",
        code: "W001",
        message: `Unused markdown block '${name}'`,
      });
    }
  }

  if (hasErrors(diagnostics)) {
    return { diagnostics };
  }

  const bindings = new Map<string, BoundMarkdown>();
  for (const ref of refs) {
    const block = markdown.blocks.find((b) => b.name === ref)!;
    bindings.set(ref, { ref, body: block.body });
  }

  return {
    slide: {
      kind: "ResolvedSlide",
      layout,
      bindings,
    },
    diagnostics,
  };
}

export function parseAndJoin(lmlSource: string, mdSource: string): JoinResult {
  const layout = parseLml(lmlSource);
  const markdown = parseMarkdownBlocks(mdSource);
  return joinSlide(layout, markdown);
}
