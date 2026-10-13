import {
  ParseError,
  parseLml,
  validateLml,
  type Diagnostic,
  type Document,
  type Node,
  type HostNode,
  type PageNode,
  type Param,
  type ZStackNode,
} from "lml-core";
import type { HiddenNodeRecord } from "./types.js";

export type CompileStatus = "empty" | "valid" | "invalid";

export interface EditorParseError {
  message: string;
  span?: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };
}

export interface CompileResult {
  document: Document | null;
  diagnostics: Diagnostic[];
  parseError: EditorParseError | null;
  status: CompileStatus;
}

/** Compile only LML. Paired Markdown is deliberately absent from this API. */
export function compileLmlSource(source: string): CompileResult {
  if (!source.trim()) {
    return { document: null, diagnostics: [], parseError: null, status: "empty" };
  }
  try {
    const document = parseLml(source);
    const diagnostics = validateLml(document);
    const status = diagnostics.some((entry) => entry.severity === "error") ? "invalid" : "valid";
    return { document, diagnostics, parseError: null, status };
  } catch (error) {
    const parseError: EditorParseError = {
      message: error instanceof Error ? error.message : String(error),
      ...(error instanceof ParseError && error.span ? { span: error.span } : {}),
    };
    return { document: null, diagnostics: [], parseError, status: "invalid" };
  }
}

export type NodePath = readonly number[];

export interface OutlineEntry {
  path: number[];
  pathKey: string;
  depth: number;
  kind: Node["kind"];
  label: string;
  node: Node;
  visibilityKey: string;
  fingerprint: string;
  ancestorVisibilityKeys: string[];
}

export function nodePathKey(path: NodePath): string {
  return path.length === 0 ? "root" : path.join(".");
}

export function sameNodePath(left: NodePath | null, right: NodePath | null): boolean {
  if (left === null || right === null || left.length !== right.length) return left === right;
  return left.every((part, index) => part === right[index]);
}

function childrenOf(node: Node): readonly Node[] {
  return "children" in node && Array.isArray(node.children) ? node.children : [];
}

export function nodeLabel(node: Node): string {
  if (node.kind === "Page") return node.ref ? `Page · md:${node.ref}` : "Page";
  if (node.kind === "MarkdownRef") return `md:${node.ref}`;
  if (node.kind === "MarkdownInline") return `md:${node.syntheticId}`;
  if (node.kind === "Spacer") return "space";
  return node.kind;
}

export function buildOutline(root: Node): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  const visit = (node: Node, path: number[], scope: string, pagePath: NodePath | null, ancestors: string[]): void => {
    let nodeScope = scope;
    let owningPagePath = pagePath;
    if (node.kind === "Page") {
      nodeScope = `page:${encodeURIComponent(pageEntryKey(node, path))}`;
      owningPagePath = path;
    }
    const relativePath = owningPagePath ? path.slice(owningPagePath.length) : path;
    const visibilityKey = `${nodeScope}|${nodePathKey(relativePath)}`;
    const fingerprint = nodeFingerprint(node);
    entries.push({
      path,
      pathKey: nodePathKey(path),
      depth: path.length,
      kind: node.kind,
      label: nodeLabel(node),
      node,
      visibilityKey,
      fingerprint,
      ancestorVisibilityKeys: ancestors,
    });
    childrenOf(node).forEach((child, index) => visit(
      child,
      [...path, index],
      nodeScope,
      owningPagePath,
      [...ancestors, visibilityKey],
    ));
  };
  visit(root, [], "document", null, []);
  return entries;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalValue(child)]));
}

/** Deterministic shallow signature: child edits do not reset their container visibility. */
export function nodeFingerprint(node: Node): string {
  const own = Object.fromEntries(Object.entries(node).filter(([key]) => key !== "children"));
  return JSON.stringify(canonicalValue(own));
}

function identityScope(key: string): string {
  const separator = key.indexOf("|");
  return separator < 0 ? key : key.slice(0, separator);
}

export function sameHiddenNodes(left: readonly HiddenNodeRecord[], right: readonly HiddenNodeRecord[]): boolean {
  return left.length === right.length && left.every((record, index) => (
    record.key === right[index]?.key && record.fingerprint === right[index]?.fingerprint
  ));
}

/** Retain exact identities, then safely migrate a displaced unique signature within its Page scope. */
export function reconcileHiddenNodes(
  entries: readonly OutlineEntry[],
  requested: readonly HiddenNodeRecord[] | undefined,
): HiddenNodeRecord[] {
  if (!requested?.length) return [];
  const claimed = new Set<string>();
  const result: HiddenNodeRecord[] = [];
  for (const record of requested) {
    const candidates = entries.filter((entry) => (
      identityScope(entry.visibilityKey) === identityScope(record.key) &&
      entry.fingerprint === record.fingerprint &&
      !claimed.has(entry.visibilityKey)
    ));
    // A positional exact hit is not evidence when an identical sibling also exists.
    // Conservatively restore visibility instead of transferring hidden state to a possibly new node.
    const match = candidates.length === 1 ? candidates[0] : undefined;
    if (match && !claimed.has(match.visibilityKey)) {
      claimed.add(match.visibilityKey);
      result.push({ key: match.visibilityKey, fingerprint: match.fingerprint });
    }
  }
  return result.sort((left, right) => left.key.localeCompare(right.key));
}

export function toggleNodeVisibility(
  entries: readonly OutlineEntry[],
  hiddenNodes: readonly HiddenNodeRecord[],
  visibilityKey: string,
): HiddenNodeRecord[] {
  const reconciled = reconcileHiddenNodes(entries, hiddenNodes);
  if (reconciled.some((record) => record.key === visibilityKey)) {
    return reconciled.filter((record) => record.key !== visibilityKey);
  }
  const entry = entries.find((candidate) => candidate.visibilityKey === visibilityKey);
  if (!entry) return reconciled;
  return [...reconciled, { key: entry.visibilityKey, fingerprint: entry.fingerprint }]
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function isNodeDirectlyVisible(entry: OutlineEntry, hiddenNodes: readonly HiddenNodeRecord[]): boolean {
  return !hiddenNodes.some((record) => record.key === entry.visibilityKey);
}

export function isNodeEffectivelyHidden(entry: OutlineEntry, hiddenNodes: readonly HiddenNodeRecord[]): boolean {
  const hidden = new Set(hiddenNodes.map((record) => record.key));
  return hidden.has(entry.visibilityKey) || entry.ancestorVisibilityKeys.some((key) => hidden.has(key));
}

export function hiddenPathKeys(entries: readonly OutlineEntry[], hiddenNodes: readonly HiddenNodeRecord[]): string[] {
  const hidden = new Set(hiddenNodes.map((record) => record.key));
  return entries.filter((entry) => hidden.has(entry.visibilityKey)).map((entry) => entry.pathKey);
}

export function getNodeAtPath(root: Node, path: NodePath): Node | null {
  let current = root;
  for (const part of path) {
    if (!Number.isSafeInteger(part) || part < 0) return null;
    const children = childrenOf(current);
    const child = children[part];
    if (!child) return null;
    current = child;
  }
  return current;
}

/** Keep the nearest surviving ancestor, falling back to the document root. */
export function resolveSelectionPath(root: Node, requested: NodePath | null): number[] {
  if (!requested) return [];
  const candidate = [...requested];
  while (candidate.length > 0 && !getNodeAtPath(root, candidate)) candidate.pop();
  return getNodeAtPath(root, candidate) ? candidate : [];
}

export interface InspectorField {
  label: string;
  value: string;
}

function valueLabel(value: unknown): string {
  if (typeof value === "number" || typeof value === "string") return String(value);
  if (Array.isArray(value)) return value.join(" ");
  if (typeof value !== "object" || value === null) return String(value);
  const typed = value as Record<string, unknown>;
  switch (typed.kind) {
    case "Fixed": return `${typed.value}`;
    case "Percent": return `${typed.value}%`;
    case "Fraction": return `${typed.value}fr`;
    case "Fit": return "fit";
    case "CanvasSize": return `${typed.value}`;
    case "TrackCount": return String(typed.count);
    case "TrackList": return Array.isArray(typed.tracks) ? typed.tracks.map(valueLabel).join(" ") : "";
    default: return JSON.stringify(value);
  }
}

export function inspectNode(node: Node, path: NodePath): InspectorField[] {
  const fields: InspectorField[] = [
    { label: "Kind", value: node.kind },
    { label: "Path", value: nodePathKey(path) },
  ];
  if (node.kind === "Page" && node.ref) fields.push({ label: "MD Reference", value: node.ref });
  if (node.kind === "MarkdownRef") fields.push({ label: "Reference", value: node.ref });
  if (node.kind === "MarkdownInline") fields.push({ label: "Reference", value: node.syntheticId });
  if (node.kind === "Spacer" && node.dimension) fields.push({ label: "Size", value: valueLabel(node.dimension) });
  if ("params" in node) {
    for (const param of node.params as readonly Param[]) fields.push({ label: param.key, value: valueLabel(param.value) });
  }
  if ("dimensions" in node && node.dimensions) {
    fields.push({ label: "Children", value: node.dimensions.map(valueLabel).join(" · ") });
  }
  return fields;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export function cursorPosition(source: string, offset: number): CursorPosition {
  const prefix = source.slice(0, Math.max(0, Math.min(source.length, offset)));
  const lines = prefix.split(/\r\n?|\n/);
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

export interface TextEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Apply editor-style Tab/Shift+Tab indentation without browser focus escape. */
export function applyTabIndent(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  outdent: boolean,
  tabSize = 2,
): TextEdit {
  const start = Math.max(0, Math.min(value.length, selectionStart));
  const end = Math.max(start, Math.min(value.length, selectionEnd));
  const indent = " ".repeat(tabSize);
  if (start === end && !outdent) {
    return {
      value: `${value.slice(0, start)}${indent}${value.slice(end)}`,
      selectionStart: start + tabSize,
      selectionEnd: start + tabSize,
    };
  }

  const blockStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const includesTrailingLine = end > blockStart && value[end - 1] === "\n";
  const blockEnd = includesTrailingLine ? end - 1 : end;
  const block = value.slice(blockStart, blockEnd);
  const lines = block.split("\n");
  let firstDelta = 0;
  let totalDelta = 0;
  const edited = lines.map((line, index) => {
    if (!outdent) {
      if (index === 0) firstDelta = tabSize;
      totalDelta += tabSize;
      return indent + line;
    }
    const removable = Math.min(tabSize, line.match(/^ */)?.[0].length ?? 0);
    if (index === 0) firstDelta = -removable;
    totalDelta -= removable;
    return line.slice(removable);
  }).join("\n");
  return {
    value: `${value.slice(0, blockStart)}${edited}${value.slice(blockEnd)}`,
    selectionStart: Math.max(blockStart, start + firstDelta),
    selectionEnd: Math.max(blockStart, end + totalDelta),
  };
}

export function clampZoom(value: number): number {
  return Math.max(25, Math.min(200, Math.round(value)));
}

export interface PageEntry {
  /** Stable workspace identity: semantic ref when available, otherwise deterministic AST path. */
  key: string;
  ref?: string;
  path: number[];
  page: PageNode;
  host?: HostNode;
  /** Present only for the backward-compatible Host -> Z -> Page composition. */
  z?: ZStackNode;
}

function pageEntryKey(page: PageNode, path: NodePath): string {
  return page.ref ? `ref:${page.ref}` : `path:${nodePathKey(path)}`;
}

export function pageVisibilityEntry(outline: readonly OutlineEntry[], page: PageEntry): OutlineEntry | undefined {
  return outline.find((entry) => entry.kind === "Page" && sameNodePath(entry.path, page.path));
}

/** Upgrade legacy visiblePages into Page hidden records, while preserving explicit node records. */
export function initializeHiddenNodes(
  outline: readonly OutlineEntry[],
  pages: readonly PageEntry[],
  requested: readonly HiddenNodeRecord[] | undefined,
  visiblePages: readonly string[] | undefined,
): HiddenNodeRecord[] {
  const base = reconcileHiddenNodes(outline, requested);
  if (requested !== undefined) return base;
  const visible = new Set(reconcileVisiblePages(pages, visiblePages));
  const pageHidden = pages.flatMap((page) => {
    const entry = pageVisibilityEntry(outline, page);
    return !visible.has(page.key) && entry ? [{ key: entry.visibilityKey, fingerprint: entry.fingerprint }] : [];
  });
  return reconcileHiddenNodes(outline, [...base, ...pageHidden]);
}

export interface NormalizedWorkspaceView {
  hiddenNodes: HiddenNodeRecord[];
  visiblePages: string[];
  selectedPage?: string;
}

/** Canonicalize legacy and current workspace view state so opening a document starts clean. */
export function normalizeWorkspaceView(
  outline: readonly OutlineEntry[],
  pages: readonly PageEntry[],
  requestedHidden: readonly HiddenNodeRecord[] | undefined,
  requestedVisiblePages: readonly string[] | undefined,
  requestedSelectedPage: string | undefined,
): NormalizedWorkspaceView {
  const hiddenNodes = initializeHiddenNodes(outline, pages, requestedHidden, requestedVisiblePages);
  const visiblePages = visiblePageKeysFromHidden(outline, pages, hiddenNodes);
  const available = new Set(pages.map((page) => page.key));
  const selectedPage = requestedSelectedPage && available.has(requestedSelectedPage)
    ? requestedSelectedPage
    : visiblePages[0] ?? pages[0]?.key;
  return { hiddenNodes, visiblePages, ...(selectedPage ? { selectedPage } : {}) };
}

export function visiblePageKeysFromHidden(
  outline: readonly OutlineEntry[],
  pages: readonly PageEntry[],
  hiddenNodes: readonly HiddenNodeRecord[],
): string[] {
  const hidden = new Set(hiddenNodes.map((record) => record.key));
  return pages.filter((page) => {
    const entry = pageVisibilityEntry(outline, page);
    return !!entry && !hidden.has(entry.visibilityKey);
  }).map((page) => page.key);
}

export function applyPageVisibilityToHidden(
  outline: readonly OutlineEntry[],
  pages: readonly PageEntry[],
  hiddenNodes: readonly HiddenNodeRecord[],
  action: PageVisibilityAction,
  selectedPage: string | undefined,
): { hiddenNodes: HiddenNodeRecord[]; selectedPage?: string } {
  const reconciled = reconcileHiddenNodes(outline, hiddenNodes);
  const pageEntries = new Map(pages.flatMap((page) => {
    const entry = pageVisibilityEntry(outline, page);
    return entry ? [[page.key, entry] as const] : [];
  }));
  const pageVisibilityKeys = new Set([...pageEntries.values()].map((entry) => entry.visibilityKey));
  const nonPages = reconciled.filter((record) => !pageVisibilityKeys.has(record.key));
  const keys = pages.map((page) => page.key);
  const selected = selectedPage && keys.includes(selectedPage) ? selectedPage : keys[0];
  const shouldHide = (key: string): boolean => action === "none" || (action === "selected" && key !== selected);
  const hiddenPages = pages.flatMap((page) => {
    const entry = pageEntries.get(page.key);
    return entry && shouldHide(page.key) ? [{ key: entry.visibilityKey, fingerprint: entry.fingerprint }] : [];
  });
  return {
    hiddenNodes: reconcileHiddenNodes(outline, [...nonPages, ...hiddenPages]),
    ...(selected ? { selectedPage: selected } : {}),
  };
}

export function clearNonPageHiddenNodes(
  outline: readonly OutlineEntry[],
  hiddenNodes: readonly HiddenNodeRecord[],
): HiddenNodeRecord[] {
  const pageKeys = new Set(outline.filter((entry) => entry.kind === "Page").map((entry) => entry.visibilityKey));
  return reconcileHiddenNodes(outline, hiddenNodes).filter((record) => pageKeys.has(record.key));
}

/** Extract independent page artboards while retaining their original AST paths. */
export function extractPageEntries(root: Node): PageEntry[] {
  if (root.kind === "Page") return [{ key: pageEntryKey(root, []), ...(root.ref ? { ref: root.ref } : {}), path: [], page: root }];
  if (root.kind !== "Host" || !Array.isArray(root.children)) return [];
  const directPages = root.children
    .map((child, index) => ({ child, index }))
    .filter((entry): entry is { child: PageNode; index: number } => entry.child.kind === "Page")
    .map(({ child, index }) => ({
      key: pageEntryKey(child, [index]),
      ...(child.ref ? { ref: child.ref } : {}),
      path: [index],
      page: child,
      host: root,
    }));
  if (directPages.length === root.children.length && directPages.length > 0) return directPages;
  if (root.children.length === 1 && root.children[0]?.kind === "ZStack") {
    const z = root.children[0];
    const pageIndex = z.children.findIndex((child: Node) => child.kind === "Page");
    const page = z.children[pageIndex];
    if (page?.kind === "Page") {
      const path = [0, pageIndex];
      return [{ key: pageEntryKey(page, path), ...(page.ref ? { ref: page.ref } : {}), path, page, host: root, z }];
    }
  }
  return [];
}

/** Undefined means a new workspace (first page visible); an array, including [], is an explicit view state. */
export function reconcileVisiblePages(entries: readonly PageEntry[], requested: readonly string[] | undefined): string[] {
  if (requested === undefined) return entries[0] ? [entries[0].key] : [];
  const available = new Set(entries.map((entry) => entry.key));
  return [...new Set(requested)].filter((key) => available.has(key));
}

export type PageVisibilityAction = "all" | "selected" | "none";

export interface PageViewSelection {
  visiblePages: string[];
  selectedPage?: string;
}

/** Apply canvas-only Page visibility commands after dropping stale workspace keys. */
export function applyPageVisibility(
  entries: readonly PageEntry[],
  action: PageVisibilityAction,
  selectedPage: string | undefined,
): PageViewSelection {
  const keys = entries.map((entry) => entry.key);
  const selected = selectedPage && keys.includes(selectedPage) ? selectedPage : keys[0];
  if (action === "all") {
    return { visiblePages: keys, ...(selected ? { selectedPage: selected } : {}) };
  }
  if (action === "selected") {
    return { visiblePages: selected ? [selected] : [], ...(selected ? { selectedPage: selected } : {}) };
  }
  return { visiblePages: [], ...(selected ? { selectedPage: selected } : {}) };
}

export function pageEntryForPath(entries: readonly PageEntry[], path: NodePath | null): PageEntry | undefined {
  if (!path) return undefined;
  return entries.find((entry) => entry.path.every((part, index) => path[index] === part));
}
