import type {
  Dimension,
  Diagnostic,
  Document,
  GridNode,
  HostNode,
  Node,
  Param,
  ParamKey,
  TrackSpec,
  VStackNode,
  HStackNode,
} from "../spec/ast.js";
import { MAX_TRACK_COUNT } from "../spec/ast.js";

const PAGE_PARAMS = new Set<ParamKey>(["w", "h", "pad"]);
const HOST_PARAMS = new Set<ParamKey>(["align", "justify"]);
const STACK_PARAMS = new Set<ParamKey>(["gap", "pad", "align", "justify"]);
const Z_PARAMS = new Set<ParamKey>(["pad"]);
const AT_PARAMS = new Set<ParamKey>(["top", "bottom", "left", "right", "w", "h"]);
const GRID_PARAMS = new Set<ParamKey>(["cols", "rows", "gap", "pad"]);
const ALIGN_VALUES = new Set(["leading", "center", "trailing", "stretch"]);
const JUSTIFY_VALUES = new Set(["start", "center", "end", "between", "around"]);

/** Reserved names — cannot be used as `md:ref` (E009). */
export const RESERVED_MD_REFS = new Set([
  "host", "page", "v", "h", "z", "at", "grid", "md", "space", "fit", "fill",
  "gap", "pad", "align", "justify", "w", "top", "bottom", "left", "right", "cols", "rows",
  "leading", "center", "trailing", "stretch",
  "start", "end", "between", "around", "fr",
]);

interface LayoutContext {
  definiteWidth: boolean;
  definiteHeight: boolean;
}

type ParentKind = "Host" | "VStack" | "HStack" | "Page" | "ZStack" | "At" | "Grid";
const HOST_LAYOUT_CTX: LayoutContext = { definiteWidth: true, definiteHeight: true };
const PAGE_LAYOUT_CTX: LayoutContext = { definiteWidth: true, definiteHeight: true };
const INDEFINITE_CTX: LayoutContext = { definiteWidth: false, definiteHeight: false };

function error(diagnostics: Diagnostic[], message: string, code: Diagnostic["code"] = "E006"): void {
  diagnostics.push({ severity: "error", code, message });
}

/**
 * Validate both parser-produced documents and structurally compatible public AST values.
 * Runtime guards deliberately turn malformed values into diagnostics instead of throwing.
 */
export function validateLml(document: Document): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if ((document as unknown as { kind?: unknown } | null)?.kind !== "Document") {
    error(diagnostics, "Expected Document kind", "E004");
  }
  const root = (document as unknown as { root?: unknown } | null)?.root;
  if (!isNodeLike(root)) {
    error(diagnostics, "Document root must be a node", "E004");
    return diagnostics;
  }

  if (root.kind !== "Page" && root.kind !== "Host") {
    error(diagnostics, "Root must be a host or page node", "E004");
    validateLayoutNode(root, INDEFINITE_CTX, diagnostics, null, false);
  } else if (root.kind === "Host") {
    validateLayoutNode(root, HOST_LAYOUT_CTX, diagnostics, null, true);
  } else {
    validateLayoutNode(root, PAGE_LAYOUT_CTX, diagnostics, null, true);
  }
  return diagnostics;
}

function validateLayoutNode(
  node: Node,
  ctx: LayoutContext,
  diagnostics: Diagnostic[],
  parentKind: ParentKind | null,
  isRoot: boolean,
  allowPageFromHost = false,
): void {
  switch (node.kind) {
    case "Host": {
      if (!isRoot) error(diagnostics, "host is only valid as the document root", "E004");
      const children = validateContainer(node, HOST_PARAMS, diagnostics);
      validateHostValues(node, diagnostics);
      const directPages = children.filter((child) => child.kind === "Page");
      const directZ = children.filter((child) => child.kind === "ZStack");
      const directPagesShape = directPages.length === children.length && directPages.length > 0;
      const hostZShape = children.length === 1 && directZ.length === 1;
      if (!directPagesShape && !hostZShape) {
        error(diagnostics, "host requires one or more direct pages, or exactly one direct z composition", "E007");
      }
      if (directPagesShape && directPages.length > 1) validateMultiPageRefs(directPages, diagnostics);
      for (const child of children) {
        validateLayoutNode(child, HOST_LAYOUT_CTX, diagnostics, "Host", false, isRoot);
      }
      return;
    }
    case "Page": {
      const explicitHostPage = allowPageFromHost && (parentKind === "Host" || parentKind === "ZStack");
      if (!isRoot && !explicitHostPage) {
        error(diagnostics, "page is only valid as the root, a direct host child, or the base page of a host z", "E004");
      }
      const children = validateContainer(node, PAGE_PARAMS, diagnostics);
      validatePageRef(node, diagnostics);
      if (explicitHostPage && (!findParam(node.params, "w") || !findParam(node.params, "h"))) {
        error(diagnostics, "page under explicit host requires both w and h", "E007");
      }
      if (children.length > 1) {
        error(diagnostics, "page accepts at most one direct child; wrap in v { ... }", "E007");
      }
      const pageCtx = pageContentContext(node, ctx, isRoot);
      for (const child of children) {
        validateLayoutNode(child, pageCtx, diagnostics, "Page", false);
      }
      return;
    }
    case "VStack":
    case "HStack": {
      const children = validateContainer(node, STACK_PARAMS, diagnostics);
      const dimensions = dimensionsOf(node, diagnostics);
      const mainDefinite = node.kind === "VStack" ? ctx.definiteHeight : ctx.definiteWidth;
      if (stackUsesProportionalMainAxis(children, dimensions) && !mainDefinite) {
        error(diagnostics, `${node.kind}: fr/% sizing requires definite main-axis size from parent`);
      }
      if (dimensions) {
        for (const dim of dimensions) validateDimension(dim, diagnostics);
        if (dimensions.length !== children.length) {
          error(
            diagnostics,
            `${node.kind}: dimension count (${dimensions.length}) != child count (${children.length})`,
            "E003",
          );
        }
        for (const child of children) {
          if (child.kind === "Spacer" && child.dimension !== undefined) {
            error(diagnostics, "space(dimension) is not allowed when parent stack assigns positional dimensions");
          }
        }
      }
      for (let i = 0; i < children.length; i += 1) {
        validateLayoutNode(
          children[i],
          stackChildContext(ctx, node.kind, dimensions?.[i]),
          diagnostics,
          node.kind,
          false,
        );
      }
      return;
    }
    case "ZStack": {
      const children = validateContainer(node, Z_PARAMS, diagnostics);
      const hostRootZ = parentKind === "Host" && allowPageFromHost;
      if (hostRootZ) {
        const pages = children.filter((child) => child.kind === "Page");
        if (pages.length !== 1 || children.some((child) => child.kind !== "Page" && child.kind !== "At")) {
          error(diagnostics, "z under host requires exactly one direct page and only direct at overlays", "E007");
        }
      }
      for (const child of children) {
        validateLayoutNode(child, ctx, diagnostics, "ZStack", false, hostRootZ);
      }
      return;
    }
    case "At": {
      const params = normalizeParams(node.params);
      const children = validateContainer(node, AT_PARAMS, diagnostics);
      if (parentKind !== "ZStack") {
        error(diagnostics, "at is only valid as a direct child of z", "E004");
      }
      if (children.length !== 1) {
        error(diagnostics, "at requires exactly one direct child", "E007");
      }
      validateAtValues(params, diagnostics);
      const childCtx = atChildContext(params, ctx);
      for (const child of children) {
        validateLayoutNode(child, childCtx, diagnostics, "At", false);
      }
      return;
    }
    case "Grid": {
      const children = validateContainer(node, GRID_PARAMS, diagnostics);
      const cellContexts = validateGrid(node, children, ctx, diagnostics);
      for (let i = 0; i < children.length; i += 1) {
        validateLayoutNode(children[i], cellContexts[i] ?? INDEFINITE_CTX, diagnostics, "Grid", false);
      }
      return;
    }
    case "Spacer":
      if (parentKind !== "VStack" && parentKind !== "HStack") {
        error(diagnostics, "space is only valid as a direct child of v or h");
      }
      if (node.dimension !== undefined) validateDimension(node.dimension, diagnostics);
      return;
    case "MarkdownRef":
      if (typeof node.ref !== "string" || !MD_REF_PATTERN.test(node.ref)) {
        error(diagnostics, "Markdown reference name must be a valid identifier");
      } else if (RESERVED_MD_REFS.has(node.ref)) {
        error(diagnostics, `Reserved markdown reference name '${node.ref}'`, "E009");
      }
      return;
    case "MarkdownInline":
      if (typeof node.body !== "string") error(diagnostics, "Inline markdown body must be a string");
      if (typeof node.syntheticId !== "string" || node.syntheticId.length === 0) {
        error(diagnostics, "Inline markdown syntheticId must be a non-empty string");
      }
      return;
  }
}

function validateContainer(
  node: { params: readonly Param[]; children: readonly Node[]; kind: string },
  allowed: Set<ParamKey>,
  diagnostics: Diagnostic[],
): readonly Node[] {
  const params = normalizeParams(node.params);
  const children = Array.isArray(node.children)
    ? node.children.filter((child): child is Node => {
        if (isNodeLike(child)) return true;
        error(diagnostics, `${node.kind} contains an invalid child node`);
        return false;
      })
    : [];
  if (!Array.isArray(node.params)) error(diagnostics, `${node.kind} params must be an array`);
  if (!Array.isArray(node.children)) error(diagnostics, `${node.kind} children must be an array`);

  validateParams(params, allowed, node.kind, diagnostics);
  validateDuplicateParams(params, diagnostics);
  for (const param of params) validateParamValue(param, diagnostics);
  return children;
}

function normalizeParams(params: unknown): readonly Param[] {
  return Array.isArray(params) ? params as readonly Param[] : [];
}

function findParam(params: readonly Param[], key: ParamKey): Param | undefined {
  return Array.isArray(params) ? params.find((param) => param?.key === key) : undefined;
}

function validateHostValues(node: HostNode, diagnostics: Diagnostic[]): void {
  const align = findParam(node.params, "align");
  if (align?.key === "align" && align.value === "stretch") {
    error(diagnostics, "host align accepts only leading, center, or trailing");
  }
  const justify = findParam(node.params, "justify");
  if (justify?.key === "justify" && (justify.value === "between" || justify.value === "around")) {
    error(diagnostics, "host justify accepts only start, center, or end");
  }
}

const MD_REF_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

function validatePageRef(node: { ref?: unknown }, diagnostics: Diagnostic[]): void {
  if (node.ref === undefined) return;
  if (typeof node.ref !== "string" || !MD_REF_PATTERN.test(node.ref)) {
    error(diagnostics, "Page markdown reference name must be a valid identifier", "E006");
  } else if (RESERVED_MD_REFS.has(node.ref)) {
    error(diagnostics, `Reserved markdown reference name '${node.ref}'`, "E009");
  }
}

function validateMultiPageRefs(pages: readonly Extract<Node, { kind: "Page" }>[], diagnostics: Diagnostic[]): void {
  const seen = new Set<string>();
  for (const page of pages) {
    if (typeof page.ref !== "string" || page.ref.length === 0) {
      error(diagnostics, "Every page in a multi-page host requires a page md:ref", "E007");
      continue;
    }
    if (seen.has(page.ref)) {
      error(diagnostics, `Duplicate page markdown reference '${page.ref}'`, "E002");
    }
    seen.add(page.ref);
  }
}

function validateAtValues(params: readonly Param[], diagnostics: Diagnostic[]): void {
  const left = findParam(params, "left");
  const right = findParam(params, "right");
  const top = findParam(params, "top");
  const bottom = findParam(params, "bottom");
  const width = findParam(params, "w");
  const height = findParam(params, "h");
  if (left && right && width) error(diagnostics, "at cannot combine left, right, and w", "E006");
  if (top && bottom && height) error(diagnostics, "at cannot combine top, bottom, and h", "E006");

  for (const param of params) {
    if (!param || typeof param !== "object" || !("value" in param)) continue;
    const kind = (param.value as { kind?: unknown } | null)?.kind;
    if (param.key === "top" || param.key === "bottom" || param.key === "left" || param.key === "right") {
      if (kind !== "Fixed" && kind !== "Percent") {
        error(diagnostics, `at ${param.key} accepts only fixed or percent values`, "E006");
      }
    } else if ((param.key === "w" || param.key === "h") && kind !== "Fixed" && kind !== "Percent" && kind !== "Fit") {
      error(diagnostics, `at ${param.key} accepts only fixed, percent, or fit values`, "E006");
    }
  }
}

function atChildContext(params: readonly Param[], parentCtx: LayoutContext): LayoutContext {
  const width = findParam(params, "w");
  const height = findParam(params, "h");
  return {
    definiteWidth: atAxisIsDefinite(
      width?.key === "w" ? width.value : undefined,
      !!findParam(params, "left") && !!findParam(params, "right"),
      parentCtx.definiteWidth,
    ),
    definiteHeight: atAxisIsDefinite(
      height?.key === "h" ? height.value : undefined,
      !!findParam(params, "top") && !!findParam(params, "bottom"),
      parentCtx.definiteHeight,
    ),
  };
}

function atAxisIsDefinite(value: unknown, hasEdgePair: boolean, parentAxisDefinite: boolean): boolean {
  if (value && typeof value === "object" && "kind" in value) {
    const axis = value as { kind: unknown; value?: unknown };
    if (axis.kind === "Fixed") return isFiniteNumber(axis.value) && axis.value >= 0;
    if (axis.kind === "Percent") return parentAxisDefinite && isFiniteNumber(axis.value) && axis.value >= 0;
    return false;
  }
  return hasEdgePair && parentAxisDefinite;
}

function pageContentContext(
  page: { params: readonly Param[] },
  hostCtx: LayoutContext,
  legacyRoot: boolean,
): LayoutContext {
  const w = findParam(page.params, "w");
  const h = findParam(page.params, "h");
  return {
    definiteWidth: pageAxisIsDefinite(w?.key === "w" ? w.value : undefined, hostCtx.definiteWidth, legacyRoot),
    definiteHeight: pageAxisIsDefinite(h?.key === "h" ? h.value : undefined, hostCtx.definiteHeight, legacyRoot),
  };
}

function pageAxisIsDefinite(value: unknown, hostAxisDefinite: boolean, omittedUsesLegacyFallback: boolean): boolean {
  if (value === undefined) return omittedUsesLegacyFallback;
  if (!value || typeof value !== "object" || !("kind" in value)) return false;
  const axis = value as { kind: unknown; value?: unknown };
  if (axis.kind === "Fit") return false;
  if (axis.kind === "CanvasSize") {
    return isFiniteNumber(axis.value) && Number.isSafeInteger(axis.value) && axis.value > 0;
  }
  if (axis.kind === "Fixed") return isFiniteNumber(axis.value) && axis.value >= 0;
  if (axis.kind === "Percent") return hostAxisDefinite && isFiniteNumber(axis.value) && axis.value >= 0;
  if (axis.kind === "Fraction") return hostAxisDefinite && isFiniteNumber(axis.value) && axis.value > 0;
  return false;
}

function dimensionsOf(
  node: VStackNode | HStackNode,
  diagnostics: Diagnostic[],
): readonly Dimension[] | undefined {
  if (node.dimensions === undefined) return undefined;
  if (!Array.isArray(node.dimensions)) {
    error(diagnostics, `${node.kind} dimensions must be an array`);
    return undefined;
  }
  return node.dimensions;
}

function stackUsesProportionalMainAxis(
  children: readonly Node[],
  dimensions: readonly Dimension[] | undefined,
): boolean {
  if (dimensions) return dimensions.some(isProportional);
  return children.some(
    (child) => child.kind === "Spacer" && (!child.dimension || isProportional(child.dimension)),
  );
}

function stackChildContext(
  parentCtx: LayoutContext,
  parentKind: "VStack" | "HStack",
  slotDim: Dimension | undefined,
): LayoutContext {
  if (parentKind === "VStack") {
    return {
      definiteWidth: parentCtx.definiteWidth,
      definiteHeight: dimensionIsDefinite(slotDim, parentCtx.definiteHeight),
    };
  }
  return {
    definiteWidth: dimensionIsDefinite(slotDim, parentCtx.definiteWidth),
    definiteHeight: parentCtx.definiteHeight,
  };
}

function dimensionIsDefinite(dim: Dimension | undefined, parentAxisDefinite: boolean): boolean {
  if (!dim || dim.kind === "Fit") return false;
  if (dim.kind === "Fixed") return Number.isFinite(dim.value) && dim.value >= 0;
  return parentAxisDefinite && Number.isFinite(dim.value);
}

function validateGrid(
  node: GridNode,
  children: readonly Node[],
  ctx: LayoutContext,
  diagnostics: Diagnostic[],
): LayoutContext[] {
  const params = Array.isArray(node.params) ? node.params : [];
  const colsParam = params.find((param) => param?.key === "cols") as
    | Extract<Param, { key: "cols" }>
    | undefined;
  if (!colsParam || !isTrackSpecLike(colsParam.value)) {
    if (!colsParam) error(diagnostics, "Grid requires cols parameter", "E007");
    return children.map(() => INDEFINITE_CTX);
  }
  const rowsParam = params.find((param) => param?.key === "rows") as
    | Extract<Param, { key: "rows" }>
    | undefined;
  const colCount = safeTrackSpecCount(colsParam.value);
  if (colCount === 0) return children.map(() => INDEFINITE_CTX);
  const explicitRows = rowsParam && isTrackSpecLike(rowsParam.value) ? rowsParam.value : undefined;
  const rowCount = explicitRows
    ? safeTrackSpecCount(explicitRows)
    : Math.ceil(children.length / colCount);
  if (!Number.isSafeInteger(rowCount) || rowCount < 0 || rowCount > MAX_TRACK_COUNT) {
    error(diagnostics, `Grid row count must not exceed ${MAX_TRACK_COUNT}`);
    return children.map(() => INDEFINITE_CTX);
  }

  if (children.length > colCount * rowCount) {
    error(
      diagnostics,
      `Grid has ${children.length} children but only ${colCount * rowCount} cells (${colCount}×${rowCount})`,
    );
  }
  if (trackSpecUsesProportional(colsParam.value) && !ctx.definiteWidth) {
    error(diagnostics, "Grid column fr/% tracks require definite width from parent");
  }
  if ((explicitRows ? trackSpecUsesProportional(explicitRows) : rowCount > 0) && !ctx.definiteHeight) {
    error(diagnostics, "Grid row fr/% tracks require definite height from parent");
  }

  return children.map((_, index) => ({
    definiteWidth: dimensionIsDefinite(trackAt(colsParam.value, index % colCount), ctx.definiteWidth),
    definiteHeight: dimensionIsDefinite(
      explicitRows ? trackAt(explicitRows, Math.floor(index / colCount)) : { kind: "Fraction", value: 1 },
      ctx.definiteHeight,
    ),
  }));
}

function validateParamValue(param: Param, diagnostics: Diagnostic[]): void {
  if (!param || typeof param !== "object" || typeof param.key !== "string" || !("value" in param)) return;
  const value: unknown = (param as { value: unknown }).value;
  switch (param.key) {
    case "gap":
      if (!isFiniteNumber(value) || value < 0) error(diagnostics, "gap must be a finite non-negative number");
      return;
    case "pad":
      if (
        !Array.isArray(value) ||
        value.length < 1 ||
        value.length > 4 ||
        value.some((part) => !isFiniteNumber(part) || part < 0)
      ) {
        error(diagnostics, "pad must contain 1 to 4 finite non-negative numbers");
      }
      return;
    case "w":
    case "h": {
      const axis = value as { kind?: unknown; value?: unknown } | null;
      if (axis?.kind === "CanvasSize") {
        if (!isFiniteNumber(axis.value) || !Number.isSafeInteger(axis.value) || axis.value <= 0) {
          error(diagnostics, `legacy page ${param.key} CanvasSize must be a positive safe integer`);
        }
      } else {
        validateDimension(value, diagnostics);
      }
      return;
    }
    case "top":
    case "bottom":
    case "left":
    case "right":
      validateDimension(value, diagnostics);
      return;
    case "cols":
    case "rows":
      validateTrackSpec(value, param.key, diagnostics);
      return;
    case "align":
      if (!ALIGN_VALUES.has(value as string)) error(diagnostics, `Invalid align value '${String(value)}'`);
      return;
    case "justify":
      if (!JUSTIFY_VALUES.has(value as string)) error(diagnostics, `Invalid justify value '${String(value)}'`);
      return;
  }
}

function validateTrackSpec(spec: unknown, name: string, diagnostics: Diagnostic[]): void {
  if (!isTrackSpecLike(spec)) {
    error(diagnostics, `${name} must be a track specification`);
    return;
  }
  if (spec.kind === "TrackCount") {
    if (
      !isFiniteNumber(spec.count) ||
      !Number.isSafeInteger(spec.count) ||
      spec.count <= 0 ||
      spec.count > MAX_TRACK_COUNT
    ) {
      error(diagnostics, `${name} must be a positive integer no greater than ${MAX_TRACK_COUNT}`);
    }
    return;
  }
  if (!Array.isArray(spec.tracks) || spec.tracks.length === 0) {
    error(diagnostics, `${name} track list must not be empty`);
    return;
  }
  if (spec.tracks.length > MAX_TRACK_COUNT) {
    error(diagnostics, `${name} track list must not exceed ${MAX_TRACK_COUNT} tracks`);
    return;
  }
  for (const track of spec.tracks) validateDimension(track, diagnostics);
}

function validateDimension(dim: unknown, diagnostics: Diagnostic[]): void {
  if (!dim || typeof dim !== "object" || !("kind" in dim)) {
    error(diagnostics, "Invalid dimension value");
    return;
  }
  const candidate = dim as { kind: unknown; value?: unknown };
  if (candidate.kind === "Fit") return;
  if (candidate.kind !== "Fixed" && candidate.kind !== "Percent" && candidate.kind !== "Fraction") {
    error(diagnostics, `Invalid dimension kind '${String(candidate.kind)}'`);
    return;
  }
  if (!isFiniteNumber(candidate.value)) {
    error(diagnostics, `${candidate.kind} dimension must be finite`);
  } else if (candidate.kind === "Fraction" && candidate.value <= 0) {
    error(diagnostics, "Fraction value must be greater than 0");
  } else if ((candidate.kind === "Fixed" || candidate.kind === "Percent") && candidate.value < 0) {
    error(diagnostics, `${candidate.kind} dimension must be non-negative`);
  }
}

function validateParams(
  params: readonly Param[],
  allowed: Set<ParamKey>,
  nodeKind: string,
  diagnostics: Diagnostic[],
): void {
  for (const param of params) {
    if (!param || typeof param !== "object" || typeof param.key !== "string") {
      error(diagnostics, `${nodeKind} contains an invalid parameter`);
    } else if (!allowed.has(param.key as ParamKey)) {
      error(diagnostics, `${nodeKind} does not accept param '${param.key}'`, "E005");
    }
  }
}

function validateDuplicateParams(params: readonly Param[], diagnostics: Diagnostic[]): void {
  const seen = new Set<string>();
  for (const param of params) {
    if (!param || typeof param !== "object" || typeof param.key !== "string") continue;
    if (seen.has(param.key)) error(diagnostics, `Duplicate named parameter '${param.key}'`, "E008");
    seen.add(param.key);
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isProportional(dim: unknown): boolean {
  return !!dim && typeof dim === "object" &&
    ((dim as { kind?: unknown }).kind === "Fraction" || (dim as { kind?: unknown }).kind === "Percent");
}

function isTrackSpecLike(value: unknown): value is TrackSpec {
  return !!value && typeof value === "object" &&
    ((value as { kind?: unknown }).kind === "TrackCount" || (value as { kind?: unknown }).kind === "TrackList");
}

function safeTrackSpecCount(spec: TrackSpec): number {
  const count = spec.kind === "TrackCount"
    ? spec.count
    : Array.isArray(spec.tracks) ? spec.tracks.length : 0;
  return Number.isSafeInteger(count) && count > 0 && count <= MAX_TRACK_COUNT ? count : 0;
}

function trackAt(spec: TrackSpec, index: number): Dimension | undefined {
  if (spec.kind === "TrackCount") return { kind: "Fraction", value: 1 };
  return Array.isArray(spec.tracks) ? spec.tracks[index] : undefined;
}

function trackSpecUsesProportional(spec: TrackSpec): boolean {
  if (spec.kind === "TrackCount") return safeTrackSpecCount(spec) > 0;
  return Array.isArray(spec.tracks) && spec.tracks.some(isProportional);
}

function isNodeLike(value: unknown): value is Node {
  if (!value || typeof value !== "object") return false;
  return new Set([
    "Host", "Page", "VStack", "HStack", "ZStack", "At", "Grid", "MarkdownRef", "MarkdownInline", "Spacer",
  ]).has(String((value as { kind?: unknown }).kind));
}

export function collectMarkdownRefs(document: Document): string[] {
  const occurrences: Array<{ ref: string; source: "page" | "leaf" }> = [];
  const root = (document as unknown as { root?: unknown } | null)?.root;
  const visit = (value: unknown): void => {
    if (!isNodeLike(value)) return;
    if (value.kind === "MarkdownRef" && typeof value.ref === "string") occurrences.push({ ref: value.ref, source: "leaf" });
    if (value.kind === "Page" && typeof value.ref === "string") occurrences.push({ ref: value.ref, source: "page" });
    if ("children" in value && Array.isArray(value.children)) {
      for (const child of value.children) visit(child);
    }
  };
  visit(root);
  const leafNames = new Set(occurrences.filter((item) => item.source === "leaf").map((item) => item.ref));
  return occurrences
    .filter((item) => item.source === "leaf" || !leafNames.has(item.ref))
    .map((item) => item.ref);
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
