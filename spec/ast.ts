/**
 * LML v0.1 — Abstract Syntax Tree Types
 *
 * @see docs/v0.1/semantic-spec.md
 * @see docs/v0.1/grammar.ebnf
 * @see docs/v0.1/ast.md
 */

// ---------------------------------------------------------------------------
// Source locations
// ---------------------------------------------------------------------------

export interface Position {
  /** 1-based line number */
  line: number;
  /** 1-based column number (UTF-16 code unit) */
  column: number;
  /** 0-based byte/char offset from document start */
  offset: number;
}

export interface SourceSpan {
  start: Position;
  end: Position;
}

/** Wraps an AST node with its source range (parser-produced). */
export interface Located<T> {
  node: T;
  span: SourceSpan;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

/** Root of a parsed `.lml` file. Validator accepts Host or legacy Page roots (E004). */
export interface Document {
  readonly kind: "Document";
  readonly root: Node;
}

// ---------------------------------------------------------------------------
// Node union
// ---------------------------------------------------------------------------

export type Node = ContainerNode | LeafNode;

export type ContainerNode =
  | HostNode
  | PageNode
  | VStackNode
  | HStackNode
  | ZStackNode
  | GridNode
  | AtNode;

export type LeafNode = MarkdownNode | SpacerNode;

export type NodeKind = Node["kind"];

// ---------------------------------------------------------------------------
// Container nodes
// ---------------------------------------------------------------------------

interface ContainerBase {
  readonly params: readonly Param[];
  readonly children: readonly Node[];
}

/** Environment-sized root containing one or more independent pages (or a legacy host-Z composition). */
export interface HostNode extends ContainerBase {
  readonly kind: "Host";
}

/** Page canvas. May be an explicit Host child or a legacy semantic root. */
export interface PageNode extends ContainerBase {
  readonly kind: "Page";
  /** Optional semantic description anchor. Required and unique when a Host has multiple direct pages. */
  readonly ref?: string;
}

/** Vertical stack — main axis: vertical. */
export interface VStackNode extends ContainerBase {
  readonly kind: "VStack";
  /** Per-child main-axis sizing. Length must equal `children.length` when present (E003). */
  readonly dimensions?: readonly Dimension[];
}

/** Horizontal stack — main axis: horizontal. */
export interface HStackNode extends ContainerBase {
  readonly kind: "HStack";
  /** Per-child main-axis sizing. Length must equal `children.length` when present (E003). */
  readonly dimensions?: readonly Dimension[];
}

/** Overlay stack — establishes the containing block for normal overlays and `at` children. */
export interface ZStackNode extends ContainerBase {
  readonly kind: "ZStack";
}

/** Optional absolute-positioning escape hatch; valid only as a direct child of ZStack. */
export interface AtNode extends ContainerBase {
  readonly kind: "At";
  readonly params: readonly AtParam[];
}

/** Grid — row-major cell placement. */
export interface GridNode extends ContainerBase {
  readonly kind: "Grid";
}

// ---------------------------------------------------------------------------
// Leaf nodes
// ---------------------------------------------------------------------------

/** Semantic anchor from a layout region to a named `# name` block in the paired `.md` file. */
export interface MarkdownRefNode {
  readonly kind: "MarkdownRef";
  readonly ref: string;
}

/** Inline Markdown context for AI/handoff; not rendered or measured by LML. */
export interface MarkdownInlineNode {
  readonly kind: "MarkdownInline";
  /** Raw Markdown source extracted from `""" ... """`. */
  readonly body: string;
  /** Parser-assigned synthetic id (e.g. `_inline_1`). Not validated against `.md`. */
  readonly syntheticId: string;
}

export type MarkdownNode = MarkdownRefNode | MarkdownInlineNode;

/** Flexible empty space between siblings (Spacer). */
export interface SpacerNode {
  readonly kind: "Spacer";
  /** Defaults to `{ kind: 'Fraction', value: 1 }` when omitted. */
  readonly dimension?: Dimension;
}

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

export type Dimension =
  | FixedDimension
  | PercentDimension
  | FractionDimension
  | FitDimension;

export type DimensionKind = Dimension["kind"];

/** Numeric logical unit — e.g. `240` */
export interface FixedDimension {
  readonly kind: "Fixed";
  readonly value: number;
}

/** Percentage of parent available space — e.g. `30%` */
export interface PercentDimension {
  readonly kind: "Percent";
  readonly value: number;
}

/** Fractional share of remaining space — e.g. `2fr` */
export interface FractionDimension {
  readonly kind: "Fraction";
  readonly value: number;
}

/** Layout child representation/placeholder intrinsic size; never paired Markdown body size. */
export interface FitDimension {
  readonly kind: "Fit";
}

/** Legacy fixed page-axis size — positive finite safe integer target-space pixels. */
export interface CanvasSize {
  readonly kind: "CanvasSize";
  readonly value: number;
}

/** Per-axis page sizing; CanvasSize preserves the legacy positive-integer AST shape. */
export type PageAxisSize = CanvasSize | Dimension;

// ---------------------------------------------------------------------------
// Parameters (named args)
// ---------------------------------------------------------------------------

export type Param =
  | GapParam
  | PadParam
  | AlignParam
  | JustifyParam
  | WidthParam
  | HeightParam
  | TopParam
  | BottomParam
  | LeftParam
  | RightParam
  | ColsParam
  | RowsParam;

export type ParamKey = Param["key"];

export interface GapParam {
  readonly key: "gap";
  readonly value: number;
}

/**
 * Padding shorthand — 1 to 4 values (CSS-compatible).
 * `[16]` | `[16,24]` | `[16,24,12]` | `[16,24,12,20]`
 */
export interface PadParam {
  readonly key: "pad";
  readonly value: Spacing;
}

export interface AlignParam {
  readonly key: "align";
  readonly value: AlignValue;
}

export interface JustifyParam {
  readonly key: "justify";
  readonly value: JustifyValue;
}

export interface WidthParam {
  readonly key: "w";
  readonly value: PageAxisSize;
}

export interface HeightParam {
  readonly key: "h";
  readonly value: PageAxisSize;
}

/** Absolute edge offset: fixed target-space unit or percentage of the containing Z content box. */
export type AtOffset = FixedDimension | PercentDimension;

/** Absolute size: fixed, percent, or intrinsic. Fraction/CanvasSize are invalid for At. */
export type AtSize = FixedDimension | PercentDimension | FitDimension;

export interface TopParam {
  readonly key: "top";
  readonly value: AtOffset;
}

export interface BottomParam {
  readonly key: "bottom";
  readonly value: AtOffset;
}

export interface LeftParam {
  readonly key: "left";
  readonly value: AtOffset;
}

export interface RightParam {
  readonly key: "right";
  readonly value: AtOffset;
}

export interface AtWidthParam {
  readonly key: "w";
  readonly value: AtSize;
}

export interface AtHeightParam {
  readonly key: "h";
  readonly value: AtSize;
}

export type AtParam = TopParam | BottomParam | LeftParam | RightParam | AtWidthParam | AtHeightParam;

export interface ColsParam {
  readonly key: "cols";
  readonly value: TrackSpec;
}

export interface RowsParam {
  readonly key: "rows";
  readonly value: TrackSpec;
}

/** 1–4 non-negative numbers; interpretation follows CSS padding rules. */
export type Spacing = readonly [number] | readonly [number, number] | readonly [number, number, number] | readonly [number, number, number, number];

/** v0.1: four values; axis determines interpretation (v cross=horizontal, h cross=vertical). */
export type AlignValue =
  | "leading"
  | "center"
  | "trailing"
  | "stretch";

export type JustifyValue =
  | "start"
  | "center"
  | "end"
  | "between"
  | "around";

/** Grid track definition — integer shorthand or explicit track list. */
export type TrackSpec =
  | TrackCountSpec
  | TrackListSpec;

/** `cols: 3` → three equal `1fr` columns; validator caps count at MAX_TRACK_COUNT. */
export interface TrackCountSpec {
  readonly kind: "TrackCount";
  readonly count: number;
}

/** Non-empty explicit track list, e.g. `cols: 1fr 2fr 1fr` or `cols: 240 1fr`. */
export interface TrackListSpec {
  readonly kind: "TrackList";
  readonly tracks: readonly Dimension[];
}

/** Semantic resource bound for explicit/implicit grid axes. */
export const MAX_TRACK_COUNT = 10_000;

// ---------------------------------------------------------------------------
// Markdown side (paired `.md` file)
// ---------------------------------------------------------------------------

/** A block extracted from a `# name` heading through the next block heading or EOF. */
export interface MarkdownBlock {
  readonly name: string;
  readonly body: string;
  readonly span?: SourceSpan;
}

/** Parsed `.md` companion file. */
export interface MarkdownDocument {
  readonly kind: "MarkdownDocument";
  readonly blocks: readonly MarkdownBlock[];
}

// ---------------------------------------------------------------------------
// Joined / resolved model (post-validation)
// ---------------------------------------------------------------------------

/** Markdown block associated with an LML `md:ref` anchor for optional handoff/lint. */
export interface BoundMarkdown {
  readonly ref: string;
  readonly body: string;
}

/**
 * Reference-resolved LML/Markdown association for optional handoff/lint.
 * Despite the compatibility name, this is not a rendered slide and does not inject MD into layout.
 */
export interface ResolvedSlide {
  readonly kind: "ResolvedSlide";
  readonly layout: Document;
  readonly bindings: ReadonlyMap<string, BoundMarkdown>;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export type Severity = "error" | "warning";

export type DiagnosticCode =
  | "E001" // unresolved md ref
  | "E002" // duplicate md ref
  | "E003" // dimension count mismatch
  | "E004" // invalid root or Host/Page/At nesting
  | "E005" // unknown / disallowed param
  | "E006" // invalid dimension / spacing / canvas size / At geometry
  | "E007" // missing required param / invalid Host-Z shape / Page or At child count
  | "E008" // duplicate named param
  | "E009" // reserved markdown ref name
  | "W001"; // unused markdown block

export interface Diagnostic {
  readonly severity: Severity;
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly span?: SourceSpan;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isContainerNode(node: Node): node is ContainerNode {
  return (
    node.kind === "Host" ||
    node.kind === "Page" ||
    node.kind === "VStack" ||
    node.kind === "HStack" ||
    node.kind === "ZStack" ||
    node.kind === "Grid" ||
    node.kind === "At"
  );
}

export function isLeafNode(node: Node): node is LeafNode {
  return node.kind === "MarkdownRef" || node.kind === "MarkdownInline" || node.kind === "Spacer";
}

export function isStackNode(node: Node): node is VStackNode | HStackNode {
  return node.kind === "VStack" || node.kind === "HStack";
}

export function isMarkdownRef(node: MarkdownNode): node is MarkdownRefNode {
  return node.kind === "MarkdownRef";
}

export function isMarkdownInline(node: MarkdownNode): node is MarkdownInlineNode {
  return node.kind === "MarkdownInline";
}

// ---------------------------------------------------------------------------
// Visitor (optional traversal helper)
// ---------------------------------------------------------------------------

export interface AstVisitor<T = void> {
  visitDocument?(doc: Document): T;
  visitHost?(node: HostNode): T;
  visitPage?(node: PageNode): T;
  visitVStack?(node: VStackNode): T;
  visitHStack?(node: HStackNode): T;
  visitZStack?(node: ZStackNode): T;
  visitAt?(node: AtNode): T;
  visitGrid?(node: GridNode): T;
  visitMarkdownRef?(node: MarkdownRefNode): T;
  visitMarkdownInline?(node: MarkdownInlineNode): T;
  visitSpacer?(node: SpacerNode): T;
}

/** Walk `root` depth-first, pre-order. */
export function walkAst(root: Document | Node, visitor: AstVisitor): void {
  const visit = (node: Node): void => {
    switch (node.kind) {
      case "Host":
        visitor.visitHost?.(node);
        break;
      case "Page":
        visitor.visitPage?.(node);
        break;
      case "VStack":
        visitor.visitVStack?.(node);
        break;
      case "HStack":
        visitor.visitHStack?.(node);
        break;
      case "ZStack":
        visitor.visitZStack?.(node);
        break;
      case "At":
        visitor.visitAt?.(node);
        break;
      case "Grid":
        visitor.visitGrid?.(node);
        break;
      case "MarkdownRef":
        visitor.visitMarkdownRef?.(node);
        break;
      case "MarkdownInline":
        visitor.visitMarkdownInline?.(node);
        break;
      case "Spacer":
        visitor.visitSpacer?.(node);
        break;
    }
    if (isContainerNode(node)) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };

  if (root.kind === "Document") {
    visitor.visitDocument?.(root);
    visit(root.root);
  } else {
    visit(root);
  }
}

// ---------------------------------------------------------------------------
// Param helpers
// ---------------------------------------------------------------------------

export function getParam<K extends ParamKey>(
  params: readonly Param[],
  key: K,
): Extract<Param, { key: K }> | undefined {
  return params.find((p): p is Extract<Param, { key: K }> => p.key === key);
}

/** Track count from `cols: 3` or `cols: 1fr 2fr 1fr`. */
export function trackSpecCount(spec: TrackSpec): number {
  const count = spec.kind === "TrackCount"
    ? spec.count
    : Array.isArray(spec.tracks) ? spec.tracks.length : 0;
  return Number.isSafeInteger(count) && count > 0 && count <= MAX_TRACK_COUNT ? count : 0;
}

/** Implicit rows when `rows` omitted — `repeat(row_count, 1fr)`. */
export function resolveGridRowTracks(
  columnCount: number,
  childCount: number,
  rowsSpec?: TrackSpec,
): readonly Dimension[] {
  if (rowsSpec) return expandTrackSpec(rowsSpec);
  if (
    !Number.isSafeInteger(columnCount) || columnCount <= 0 || columnCount > MAX_TRACK_COUNT ||
    !Number.isSafeInteger(childCount) || childCount < 0
  ) return [];
  const rowCount = Math.ceil(childCount / columnCount);
  if (!Number.isSafeInteger(rowCount) || rowCount < 0 || rowCount > MAX_TRACK_COUNT) return [];
  return Array.from({ length: rowCount }, (): FractionDimension => ({
    kind: "Fraction",
    value: 1,
  }));
}

/** Expand `cols: 3` to `[1fr, 1fr, 1fr]`; leaves TrackList as-is. */
export function expandTrackSpec(spec: TrackSpec): readonly Dimension[] {
  if (spec.kind === "TrackCount") {
    if (!Number.isSafeInteger(spec.count) || spec.count <= 0 || spec.count > MAX_TRACK_COUNT) {
      return [];
    }
    return Array.from({ length: spec.count }, (): FractionDimension => ({
      kind: "Fraction",
      value: 1,
    }));
  }
  if (!Array.isArray(spec.tracks) || spec.tracks.length === 0 || spec.tracks.length > MAX_TRACK_COUNT) {
    return [];
  }
  return spec.tracks;
}

/** Default spacer dimension when omitted in source. */
export const DEFAULT_SPACER_DIMENSION: FractionDimension = { kind: "Fraction", value: 1 };
