import type { CSSProperties } from "react";
import type { AlignValue, AtParam, Dimension, JustifyValue, Node, PageAxisSize, Param, Spacing, TrackSpec } from "lml-core";
import { expandTrackSpec, resolveGridRowTracks } from "lml-core";

export function getParamNumber(params: readonly Param[], key: "gap"): number | undefined {
  if (!Array.isArray(params)) return undefined;
  const p = params.find((x) => x.key === key);
  return p?.key === "gap" ? p.value : undefined;
}

export function getParamSpacing(params: readonly Param[], key: "pad"): Spacing | undefined {
  if (!Array.isArray(params)) return undefined;
  const p = params.find((x) => x.key === key);
  return p?.key === "pad" ? p.value : undefined;
}

export function getParamPageAxisSize(
  params: readonly Param[],
  key: "w" | "h",
): PageAxisSize | undefined {
  if (!Array.isArray(params)) return undefined;
  const p = params.find((x) => x.key === key);
  if (p && (p.key === "w" || p.key === "h")) return p.value;
  return undefined;
}

export function spacingToCss(spacing: Spacing | undefined): string | number | undefined {
  if (!spacing) return undefined;
  if (spacing.length === 1) return spacing[0];
  if (spacing.length === 2) return `${spacing[0]}px ${spacing[1]}px`;
  if (spacing.length === 3) return `${spacing[0]}px ${spacing[1]}px ${spacing[2]}px`;
  return `${spacing[0]}px ${spacing[1]}px ${spacing[2]}px ${spacing[3]}px`;
}

export function pageAxisToCss(value: PageAxisSize | undefined, fallback: number): string {
  if (!value) return `${fallback}px`;
  switch (value.kind) {
    case "CanvasSize":
    case "Fixed":
      return `${value.value}px`;
    case "Percent":
      return `${value.value}%`;
    case "Fraction":
      return "100%";
    case "Fit":
      return "max-content";
  }
}

export function hostPlacementToCss(
  align: AlignValue | undefined,
  justify: JustifyValue | undefined,
): CSSProperties {
  const horizontal = align === "center" ? "center" : align === "trailing" ? "end" : "start";
  const vertical = justify === "center" ? "center" : justify === "end" ? "end" : "start";
  return { justifyItems: horizontal, alignItems: vertical };
}

function atDimensionToCss(value: AtParam["value"]): string {
  if (value.kind === "Fit") return "max-content";
  return value.kind === "Percent" ? `${value.value}%` : `${value.value}px`;
}

/** Absolute geometry relative to the nearest z content box. */
export function atPositionStyle(params: readonly AtParam[]): CSSProperties {
  const style: CSSProperties = {
    position: "absolute",
    boxSizing: "border-box",
    minWidth: 0,
    minHeight: 0,
  };
  let hasHorizontalEdge = false;
  let hasVerticalEdge = false;
  for (const param of params) {
    const value = atDimensionToCss(param.value);
    switch (param.key) {
      case "top":
        style.top = value;
        hasVerticalEdge = true;
        break;
      case "bottom":
        style.bottom = value;
        hasVerticalEdge = true;
        break;
      case "left":
        style.left = value;
        hasHorizontalEdge = true;
        break;
      case "right":
        style.right = value;
        hasHorizontalEdge = true;
        break;
      case "w":
        style.width = value;
        break;
      case "h":
        style.height = value;
        break;
    }
  }
  if (!hasHorizontalEdge) style.left = 0;
  if (!hasVerticalEdge) style.top = 0;
  return style;
}

/** Main-axis flex style for stack children (implicit default = fit) */
function percentOfAvailable(value: number, gapTotal: number): string {
  if (gapTotal === 0) return `${value}%`;
  return `calc(${value}% - ${(gapTotal * value) / 100}px)`;
}

export function dimensionToFlex(dim: Dimension | undefined, gapTotal = 0): CSSProperties {
  if (!dim) {
    return { flex: "0 0 auto" };
  }
  switch (dim.kind) {
    case "Fraction":
      return { flex: `${dim.value} 1 0`, minWidth: 0, minHeight: 0 };
    case "Fit":
      return { flex: "0 0 auto" };
    case "Fixed":
      return { flex: `0 0 ${dim.value}px` };
    case "Percent":
      return { flex: `0 0 ${percentOfAvailable(dim.value, gapTotal)}` };
    default:
      return { flex: "1 1 0", minWidth: 0, minHeight: 0 };
  }
}

export function alignToCss(align: AlignValue | undefined, axis: "row" | "column"): CSSProperties {
  void axis;
  const map: Record<AlignValue, string> = {
    leading: "flex-start",
    center: "center",
    trailing: "flex-end",
    stretch: "stretch",
  };
  return { alignItems: map[align ?? "leading"] };
}

export function justifyToCss(justify: JustifyValue | undefined): CSSProperties {
  const map: Record<JustifyValue, CSSProperties["justifyContent"]> = {
    start: "flex-start",
    center: "center",
    end: "flex-end",
    between: "space-between",
    around: "space-around",
  };
  return { justifyContent: map[justify ?? "start"] };
}

export function crossAxisStyle(
  axis: "row" | "column",
  options: { fillBoth?: boolean; proposed?: boolean; stretch?: boolean },
): CSSProperties | undefined {
  if (options.fillBoth) {
    return { width: "100%", height: "100%", alignSelf: "stretch", flex: "1 1 0" };
  }
  if (!options.proposed && !options.stretch) return undefined;
  return {
    ...(axis === "column" ? { width: "100%" } : { height: "100%" }),
    ...(options.stretch ? { alignSelf: "stretch" } : {}),
  };
}

export function spacerCrossAxisStyle(): CSSProperties {
  return { alignSelf: "stretch" };
}

/** Spacer geometry without a visual minimum that would override fixed values below 8px. */
export function spacerLayoutStyle(dim: Dimension, gapTotal = 0): CSSProperties {
  return {
    ...dimensionToFlex(dim, gapTotal),
    boxSizing: "border-box",
    minWidth: 0,
    minHeight: 0,
  };
}

export function retainsCrossProposal(node: Pick<Node, "kind">): boolean {
  return node.kind === "VStack" || node.kind === "HStack" || node.kind === "ZStack" || node.kind === "Grid";
}

export function trackToCss(track: Dimension, gapTotal = 0): string {
  switch (track.kind) {
    case "Fixed":
      return `${track.value}px`;
    case "Percent":
      return percentOfAvailable(track.value, gapTotal);
    case "Fraction":
      return `${track.value}fr`;
    case "Fit":
      return "max-content";
  }
}

export interface GridTemplates {
  columns: string;
  rows: string;
  columnCount: number;
  rowCount: number;
}

export function resolveGridTemplates(
  cols: TrackSpec,
  rows: TrackSpec | undefined,
  childCount: number,
  gap: number,
): GridTemplates {
  const columnTracks = expandTrackSpec(cols);
  if (columnTracks.length === 0) {
    return { columns: "", rows: "", columnCount: 0, rowCount: 0 };
  }
  const rowTracks = resolveGridRowTracks(columnTracks.length, childCount, rows);
  const columnGapTotal = gap * Math.max(0, columnTracks.length - 1);
  const rowGapTotal = gap * Math.max(0, rowTracks.length - 1);
  return {
    columns: columnTracks.map((track) => trackToCss(track, columnGapTotal)).join(" "),
    rows: rowTracks.map((track) => trackToCss(track, rowGapTotal)).join(" "),
    columnCount: columnTracks.length,
    rowCount: rowTracks.length,
  };
}
