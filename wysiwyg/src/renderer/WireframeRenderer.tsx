import { createContext, useContext, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import type {
  AtNode,
  Dimension,
  GridNode,
  HStackNode,
  HostNode,
  MarkdownRefNode,
  Node,
  PageNode,
  SpacerNode,
  VStackNode,
  ZStackNode,
} from "lml-core";
import { getParam } from "lml-core";
import { extractPageEntries, nodePathKey, sameNodePath, type NodePath, type PageEntry } from "../editorModel.js";
import {
  alignToCss,
  atPositionStyle,
  crossAxisStyle,
  dimensionToFlex,
  getParamNumber,
  getParamPageAxisSize,
  getParamSpacing,
  hostPlacementToCss,
  justifyToCss,
  pageAxisToCss,
  resolveGridTemplates,
  retainsCrossProposal,
  spacingToCss,
  spacerLayoutStyle,
  spacerCrossAxisStyle,
} from "./layout.js";

export interface WireframeRendererProps {
  node: Node;
  selectedPath?: NodePath | null;
  onSelect?: (path: NodePath, node: Node) => void;
  hiddenPaths?: readonly string[];
}

export interface PageGalleryRendererProps {
  pages: readonly PageEntry[];
  selectedPath?: NodePath | null;
  onSelect?: (path: NodePath, node: Node) => void;
  hiddenPaths?: readonly string[];
}

interface SelectionContextValue {
  selectedPath: NodePath | null;
  onSelect?: (path: NodePath, node: Node) => void;
  hiddenPathKeys: ReadonlySet<string>;
}

const SelectionContext = createContext<SelectionContextValue>({ selectedPath: null, hiddenPathKeys: new Set() });

function selectionClass(base: string, selected: boolean): string {
  return selected ? `${base} wf-node-selected` : base;
}

type SelectableAttrs = HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string>;

function useSelectable(node: Node, path: NodePath): { selected: boolean; attrs: SelectableAttrs } {
  const selection = useContext(SelectionContext);
  const selected = sameNodePath(selection.selectedPath, path);
  const activate = (): void => selection.onSelect?.([...path], node);
  const attrs: SelectableAttrs = {
    "data-node-kind": node.kind,
    "data-node-path": nodePathKey(path),
    ...(selection.onSelect ? {
      role: "button",
      tabIndex: 0,
      "aria-label": `Select ${node.kind} at ${nodePathKey(path)}`,
      onClick: (event) => {
        event.stopPropagation();
        activate();
      },
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          activate();
        }
      },
    } : {}),
  };
  return { selected, attrs };
}

export function visibilityStyleForPath(path: NodePath, hiddenPathKeys: ReadonlySet<string>): CSSProperties {
  return hiddenPathKeys.has(nodePathKey(path)) ? { visibility: "hidden" } : {};
}

function useVisibilityStyle(path: NodePath): CSSProperties {
  const { hiddenPathKeys } = useContext(SelectionContext);
  return visibilityStyleForPath(path, hiddenPathKeys);
}

export function isPagePathVisible(path: NodePath, hiddenPathKeys: ReadonlySet<string>): boolean {
  return !hiddenPathKeys.has(nodePathKey(path));
}

export function WireframeRenderer({ node, selectedPath = null, onSelect, hiddenPaths = [] }: WireframeRendererProps) {
  const hiddenPathKeys = new Set(hiddenPaths);
  let view: ReactNode;
  if (node.kind === "Host") {
    const pages = extractPageEntries(node);
    if (pages.length > 1) {
      view = <PageGalleryRenderer pages={pages} selectedPath={selectedPath} onSelect={onSelect} hiddenPaths={hiddenPaths} />;
    } else if (pages[0] && !isPagePathVisible(pages[0].path, hiddenPathKeys)) {
      view = null;
    } else {
      view = <HostView node={node} path={[]} />;
    }
  }
  else if (node.kind === "Page") {
    view = isPagePathVisible([], hiddenPathKeys) ? (
      <div className="wireframe-host wireframe-host-legacy" style={hostPlacementToCss("center", "start")}>
        <PageFrame node={node} path={[]} />
      </div>
    ) : null;
  } else {
    view = (
      <div className="wireframe-error">
        Root must be <code>host</code> or <code>page</code> (E004)
      </div>
    );
  }
  return <SelectionContext.Provider value={{ selectedPath, onSelect, hiddenPathKeys }}>{view}</SelectionContext.Provider>;
}

/** Renders checked pages as independent artboards; page paths remain paths in the original document AST. */
export function PageGalleryRenderer({ pages, selectedPath = null, onSelect, hiddenPaths = [] }: PageGalleryRendererProps) {
  const hiddenPathKeys = new Set(hiddenPaths);
  const visiblePages = pages.filter((entry) => isPagePathVisible(entry.path, hiddenPathKeys));
  return (
    <SelectionContext.Provider value={{ selectedPath, onSelect, hiddenPathKeys }}>
      <div className="wireframe-gallery">
        {visiblePages.map((entry) => <GalleryPage key={entry.key} entry={entry} />)}
      </div>
    </SelectionContext.Provider>
  );
}

function GalleryPage({ entry }: { entry: PageEntry }) {
  const align = entry.host ? getParam(entry.host.params, "align")?.value : "center";
  const justify = entry.host ? getParam(entry.host.params, "justify")?.value : "start";
  const placement = hostPlacementToCss(align, justify);
  const hostVisibility = useVisibilityStyle([]);
  return (
    <section className="wireframe-artboard" data-page-key={entry.key}>
      <header><strong>{entry.ref ? `md:${entry.ref}` : "Page"}</strong><code>{nodePathKey(entry.path)}</code></header>
      <div className="wireframe-artboard-surface">
        {entry.z && entry.host
          ? <HostView node={entry.host} path={[]} />
          : (
            <div className="wireframe-host wireframe-host-page" style={{ ...placement, ...(entry.host ? hostVisibility : {}) }}>
              <PageFrame node={entry.page} path={entry.path} />
            </div>
          )}
      </div>
    </section>
  );
}

export function resolveHostPages(node: HostNode): PageNode[] {
  if (!Array.isArray(node.children)) return [];
  if (node.children.length > 0 && node.children.every((child) => child.kind === "Page")) {
    return node.children as PageNode[];
  }
  const legacy = resolveHostPage(node);
  return "error" in legacy ? [] : [legacy.page];
}

function HostView({ node, path }: { node: HostNode; path: NodePath }) {
  const selectable = useSelectable(node, path);
  const visibility = useVisibilityStyle(path);
  const resolved = resolveHostPage(node);
  if ("error" in resolved) return <div className="wireframe-error">{resolved.error}</div>;
  const page = resolved.page;
  const align = getParam(node.params, "align")?.value;
  const justify = getParam(node.params, "justify")?.value;
  const placement = hostPlacementToCss(align, justify);
  return (
    <div {...selectable.attrs} className={selectionClass("wireframe-host wireframe-host-explicit", selectable.selected)} style={{ ...(resolved.z ? {} : placement), ...visibility }}>
      {resolved.z
        ? <ZStackView node={resolved.z} path={[...path, 0]} crossStyle={{ width: "100%", height: "100%" }} hostPlacement={placement} />
        : <PageFrame node={page} path={[...path, 0]} />}
    </div>
  );
}

export function resolveHostPage(node: HostNode): { page: PageNode; z?: ZStackNode } | { error: string } {
  if (!Array.isArray(node.children) || node.children.length !== 1) {
    return { error: "Host requires exactly one direct page or z child (E007)" };
  }
  const child = node.children[0];
  let page: PageNode;
  let z: ZStackNode | undefined;
  if (child?.kind === "Page") {
    page = child;
  } else if (child?.kind === "ZStack") {
    const pages = child.children.filter((entry: Node): entry is PageNode => entry.kind === "Page");
    if (pages.length !== 1 || child.children.some((entry: Node) => entry.kind !== "Page" && entry.kind !== "At")) {
      return { error: "Z under host requires exactly one direct page and only direct at overlays (E007)" };
    }
    page = pages[0];
    z = child;
  } else {
    return { error: "Host requires exactly one direct page or z child (E007)" };
  }
  if (!getParamPageAxisSize(page.params, "w") || !getParamPageAxisSize(page.params, "h")) {
    return { error: "Page under explicit host requires both w and h (E007)" };
  }
  return { page, ...(z ? { z } : {}) };
}

function PageFrame({ node, path }: { node: PageNode; path: NodePath }) {
  const width = pageAxisToCss(getParamPageAxisSize(node.params, "w"), 960);
  const height = pageAxisToCss(getParamPageAxisSize(node.params, "h"), 540);
  const selectable = useSelectable(node, path);
  return (
    <div {...selectable.attrs} className={selectionClass("wireframe-page", selectable.selected)} style={{ width, height }}>
      <PageView node={node} path={path} />
    </div>
  );
}

function PageView({ node, path }: { node: PageNode; path: NodePath }) {
  const pad = spacingToCss(getParamSpacing(node.params, "pad"));
  return (
    <div
      className="wf-page"
      style={{
        boxSizing: "border-box",
        width: "100%",
        height: "100%",
        padding: pad,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {node.children.map((child, i) => (
        <div key={i} style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <NodeView node={child} path={[...path, i]} axis="column" index={i} dimensions={undefined} fillBoth />
        </div>
      ))}
    </div>
  );
}

interface NodeViewProps {
  node: Node;
  path: NodePath;
  axis: "row" | "column";
  index: number;
  dimensions?: readonly Dimension[];
  /** Stretch only when the parent explicitly requests it. */
  stretchCross?: boolean;
  /** Retain the parent's cross-axis proposal for nested layout containers. */
  proposeCross?: boolean;
  /** Page, grid and ZStack cells propose both axes and fill their bounds. */
  fillBoth?: boolean;
  /** Gaps are excluded before percentage dimensions are resolved. */
  gapTotal?: number;
}

function NodeView({ node, path, axis, index, dimensions, stretchCross, proposeCross, fillBoth, gapTotal = 0 }: NodeViewProps) {
  const childDim = dimensions?.[index];
  const crossStyle = crossAxisStyle(axis, { fillBoth, proposed: proposeCross, stretch: stretchCross });

  switch (node.kind) {
    case "VStack":
      return <VStackView node={node} path={path} outerFlex={childDim} outerGapTotal={gapTotal} crossStyle={crossStyle} />;
    case "HStack":
      return <HStackView node={node} path={path} outerFlex={childDim} outerGapTotal={gapTotal} crossStyle={crossStyle} />;
    case "ZStack":
      return <ZStackView node={node} path={path} outerFlex={childDim} outerGapTotal={gapTotal} crossStyle={crossStyle} />;
    case "At":
      return <AtView node={node} path={path} />;
    case "Grid":
      return <GridView node={node} path={path} outerFlex={childDim} outerGapTotal={gapTotal} crossStyle={crossStyle} />;
    case "MarkdownRef":
      return <MdSlot node={node} path={path} outerFlex={childDim} outerGapTotal={gapTotal} crossStyle={crossStyle} />;
    case "MarkdownInline":
      return <MdInlineSlot node={node} path={path} outerFlex={childDim} outerGapTotal={gapTotal} crossStyle={crossStyle} />;
    case "Spacer":
      return <SpacerView node={node} path={path} outerFlex={childDim} outerGapTotal={gapTotal} crossStyle={crossStyle} />;
    default:
      return null;
  }
}

function outerStyle(dim: Dimension | undefined, gapTotal = 0): CSSProperties {
  return { ...dimensionToFlex(dim, gapTotal), boxSizing: "border-box", minHeight: 0, minWidth: 0 };
}

function VStackView({
  node,
  path,
  outerFlex,
  outerGapTotal,
  crossStyle,
}: {
  node: VStackNode;
  path: NodePath;
  outerFlex?: Dimension;
  outerGapTotal?: number;
  crossStyle?: CSSProperties;
}) {
  const gap = getParamNumber(node.params, "gap");
  const pad = spacingToCss(getParamSpacing(node.params, "pad"));
  const align = getParam(node.params, "align")?.value;
  const justify = getParam(node.params, "justify")?.value;
  const childGapTotal = (gap ?? 0) * Math.max(0, node.children.length - 1);
  const selectable = useSelectable(node, path);
  const visibility = useVisibilityStyle(path);
  return (
    <div
      {...selectable.attrs}
      className={selectionClass("wf-vstack", selectable.selected)}
      style={{
        ...outerStyle(outerFlex, outerGapTotal),
        ...crossStyle,
        display: "flex",
        flexDirection: "column",
        gap,
        padding: pad,
        overflow: "hidden",
        ...alignToCss(align, "column"),
        ...justifyToCss(justify),
        ...visibility,
      }}
    >
      {node.children.map((child, i) => (
        <NodeView
          key={i}
          node={child}
          path={[...path, i]}
          axis="column"
          index={i}
          dimensions={node.dimensions}
          stretchCross={align === "stretch"}
          proposeCross={retainsCrossProposal(child)}
          gapTotal={childGapTotal}
        />
      ))}
    </div>
  );
}

function HStackView({
  node,
  path,
  outerFlex,
  outerGapTotal,
  crossStyle,
}: {
  node: HStackNode;
  path: NodePath;
  outerFlex?: Dimension;
  outerGapTotal?: number;
  crossStyle?: CSSProperties;
}) {
  const gap = getParamNumber(node.params, "gap");
  const pad = spacingToCss(getParamSpacing(node.params, "pad"));
  const align = getParam(node.params, "align")?.value;
  const justify = getParam(node.params, "justify")?.value;
  const childGapTotal = (gap ?? 0) * Math.max(0, node.children.length - 1);
  const selectable = useSelectable(node, path);
  const visibility = useVisibilityStyle(path);
  return (
    <div
      {...selectable.attrs}
      className={selectionClass("wf-hstack", selectable.selected)}
      style={{
        ...outerStyle(outerFlex, outerGapTotal),
        ...crossStyle,
        display: "flex",
        flexDirection: "row",
        gap,
        padding: pad,
        overflow: "hidden",
        ...alignToCss(align, "row"),
        ...justifyToCss(justify),
        ...visibility,
      }}
    >
      {node.children.map((child, i) => (
        <NodeView
          key={i}
          node={child}
          path={[...path, i]}
          axis="row"
          index={i}
          dimensions={node.dimensions}
          stretchCross={align === "stretch"}
          proposeCross={retainsCrossProposal(child)}
          gapTotal={childGapTotal}
        />
      ))}
    </div>
  );
}

function ZStackView({
  node,
  path,
  outerFlex,
  outerGapTotal,
  crossStyle,
  hostPlacement,
}: {
  node: ZStackNode;
  path: NodePath;
  outerFlex?: Dimension;
  outerGapTotal?: number;
  crossStyle?: CSSProperties;
  hostPlacement?: CSSProperties;
}) {
  const pad = spacingToCss(getParamSpacing(node.params, "pad"));
  const selectable = useSelectable(node, path);
  const visibility = useVisibilityStyle(path);
  return (
    <div
      {...selectable.attrs}
      className={selectionClass("wf-zstack", selectable.selected)}
      style={{
        ...outerStyle(outerFlex, outerGapTotal),
        ...crossStyle,
        padding: pad,
        overflow: "hidden",
        ...visibility,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", minWidth: 0, minHeight: 0 }}>
        {node.children.map((child, i) => {
          const childPath = [...path, i];
          if (child.kind === "At") return <AtView key={i} node={child} path={childPath} />;
          if (child.kind === "Page" && hostPlacement) {
            return (
              <div key={i} style={{ position: "absolute", inset: 0, display: "grid", ...hostPlacement }}>
                <PageFrame node={child} path={childPath} />
              </div>
            );
          }
          return (
            <div key={i} style={{ position: "absolute", inset: 0, display: "flex", minWidth: 0, minHeight: 0 }}>
              <NodeView node={child} path={childPath} axis="column" index={i} fillBoth />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AtView({ node, path }: { node: AtNode; path: NodePath }) {
  const selectable = useSelectable(node, path);
  const visibility = useVisibilityStyle(path);
  const child = node.children[0];
  if (!child) return null;
  const width = getParam(node.params, "w")?.value;
  const height = getParam(node.params, "h")?.value;
  const widthBounded = (width && width.kind !== "Fit") || (!!getParam(node.params, "left") && !!getParam(node.params, "right"));
  const heightBounded = (height && height.kind !== "Fit") || (!!getParam(node.params, "top") && !!getParam(node.params, "bottom"));
  return (
    <div {...selectable.attrs} className={selectionClass("wf-at", selectable.selected)} style={{ ...atPositionStyle(node.params), display: "flex", flexDirection: "column", ...visibility }}>
      <NodeView
        node={child}
        path={[...path, 0]}
        axis="column"
        index={0}
        dimensions={heightBounded ? [{ kind: "Fraction", value: 1 }] : undefined}
        proposeCross={!!widthBounded}
      />
    </div>
  );
}

function GridView({
  node,
  path,
  outerFlex,
  outerGapTotal,
  crossStyle,
}: {
  node: GridNode;
  path: NodePath;
  outerFlex?: Dimension;
  outerGapTotal?: number;
  crossStyle?: CSSProperties;
}) {
  const gap = getParamNumber(node.params, "gap") ?? 0;
  const pad = spacingToCss(getParamSpacing(node.params, "pad"));
  const colsParam = getParam(node.params, "cols");
  const rowsParam = getParam(node.params, "rows");
  const fallbackCols = { kind: "TrackCount" as const, count: 1 };
  const templates = resolveGridTemplates(
    colsParam?.value ?? fallbackCols,
    rowsParam?.value,
    node.children.length,
    gap,
  );
  const selectable = useSelectable(node, path);
  const visibility = useVisibilityStyle(path);

  return (
    <div
      {...selectable.attrs}
      className={selectionClass("wf-grid", selectable.selected)}
      style={{
        ...outerStyle(outerFlex, outerGapTotal),
        ...crossStyle,
        display: "grid",
        gridTemplateColumns: templates.columns,
        gridTemplateRows: templates.rows,
        gap,
        padding: pad,
        overflow: "hidden",
        alignContent: "stretch",
        ...visibility,
      }}
    >
      {node.children.map((child, i) => (
        <div key={i} style={{ minWidth: 0, minHeight: 0, overflow: "hidden", display: "flex" }}>
          <NodeView node={child} path={[...path, i]} axis="row" index={i} fillBoth />
        </div>
      ))}
    </div>
  );
}

function MdSlot({
  node,
  path,
  outerFlex,
  outerGapTotal,
  crossStyle,
}: {
  node: MarkdownRefNode;
  path: NodePath;
  outerFlex?: Dimension;
  outerGapTotal?: number;
  crossStyle?: CSSProperties;
}) {
  return (
    <SlotBox node={node} path={path} label={`md:${String(node.ref ?? "")}`} outerFlex={outerFlex} outerGapTotal={outerGapTotal} crossStyle={crossStyle}>
      <span className="wf-slot-hint">semantic anchor · MD 본문 미렌더</span>
    </SlotBox>
  );
}

function MdInlineSlot({
  node,
  path,
  outerFlex,
  outerGapTotal,
  crossStyle,
}: {
  node: Extract<Node, { kind: "MarkdownInline" }>;
  path: NodePath;
  outerFlex?: Dimension;
  outerGapTotal?: number;
  crossStyle?: CSSProperties;
}) {
  return (
    <SlotBox node={node} path={path} label="md (inline)" outerFlex={outerFlex} outerGapTotal={outerGapTotal} crossStyle={crossStyle}>
      <span className="wf-slot-hint">semantic anchor · inline MD 미렌더</span>
    </SlotBox>
  );
}

function SpacerView({
  node,
  path,
  outerFlex,
  outerGapTotal,
  crossStyle,
}: {
  node: SpacerNode;
  path: NodePath;
  outerFlex?: Dimension;
  outerGapTotal?: number;
  crossStyle?: CSSProperties;
}) {
  // Parent positional slot wins; implicit 1fr only when parent assigns no per-child dims.
  const dim =
    outerFlex ?? node.dimension ?? ({ kind: "Fraction" as const, value: 1 } as Dimension);
  const selectable = useSelectable(node, path);
  const visibility = useVisibilityStyle(path);
  return (
    <div
      {...selectable.attrs}
      className={selectionClass("wf-spacer", selectable.selected)}
      style={{
        ...spacerLayoutStyle(dim, outerGapTotal),
        ...crossStyle,
        ...spacerCrossAxisStyle(),
        background: "repeating-linear-gradient(45deg, #e8e8e8 0, #e8e8e8 2px, #f4f4f4 2px, #f4f4f4 6px)",
        ...visibility,
      }}
      title="space"
    />
  );
}

function SlotBox({
  node,
  path,
  label,
  outerFlex,
  outerGapTotal,
  crossStyle,
  children,
}: {
  node: Node;
  path: NodePath;
  label: string;
  outerFlex?: Dimension;
  outerGapTotal?: number;
  crossStyle?: CSSProperties;
  children?: ReactNode;
}) {
  const selectable = useSelectable(node, path);
  const visibility = useVisibilityStyle(path);
  return (
    <div
      {...selectable.attrs}
      className={selectionClass("wf-slot", selectable.selected)}
      style={{
        ...outerStyle(outerFlex, outerGapTotal),
        ...crossStyle,
        border: "1px dashed #888",
        background: "#fafafa",
        padding: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        ...visibility,
      }}
    >
      <span className="wf-slot-label">{label}</span>
      {children}
    </div>
  );
}
