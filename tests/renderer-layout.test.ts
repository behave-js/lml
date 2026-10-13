import { describe, expect, it } from "vitest";
import {
  alignToCss,
  atPositionStyle,
  crossAxisStyle,
  dimensionToFlex,
  justifyToCss,
  hostPlacementToCss,
  pageAxisToCss,
  resolveGridTemplates,
  retainsCrossProposal,
  spacerLayoutStyle,
  spacerCrossAxisStyle,
  trackToCss,
} from "../wysiwyg/src/renderer/layout.js";

describe("WYSIWYG layout helpers", () => {
  it("maps all align and justify values including leading defaults", () => {
    expect(alignToCss(undefined, "column")).toEqual({ alignItems: "flex-start" });
    expect(alignToCss("stretch", "row")).toEqual({ alignItems: "stretch" });
    expect(justifyToCss(undefined)).toEqual({ justifyContent: "flex-start" });
    expect(justifyToCss("center")).toEqual({ justifyContent: "center" });
    expect(justifyToCss("end")).toEqual({ justifyContent: "flex-end" });
    expect(justifyToCss("between")).toEqual({ justifyContent: "space-between" });
    expect(justifyToCss("around")).toEqual({ justifyContent: "space-around" });
  });

  it("resolves percent dimensions against gap-excluded available space", () => {
    expect(dimensionToFlex({ kind: "Percent", value: 25 }, 20).flex).toBe("0 0 calc(25% - 5px)");
    expect(trackToCss({ kind: "Percent", value: 50 }, 12)).toBe("calc(50% - 6px)");
  });

  it("builds explicit rows, implicit rows and intrinsic fit tracks", () => {
    const explicit = resolveGridTemplates(
      { kind: "TrackList", tracks: [{ kind: "Fixed", value: 240 }, { kind: "Fraction", value: 1 }] },
      { kind: "TrackList", tracks: [{ kind: "Fit" }, { kind: "Percent", value: 50 }] },
      4,
      10,
    );
    expect(explicit.columns).toBe("240px 1fr");
    expect(explicit.rows).toBe("max-content calc(50% - 5px)");
    const implicit = resolveGridTemplates({ kind: "TrackCount", count: 2 }, undefined, 5, 8);
    expect(implicit.columns).toBe("1fr 1fr");
    expect(implicit.rows).toBe("1fr 1fr 1fr");
  });

  it("uses zero implicit rows for empty grids and safely rejects oversized counts", () => {
    expect(resolveGridTemplates({ kind: "TrackCount", count: 2 }, undefined, 0, 8).rows).toBe("");
    expect(resolveGridTemplates({ kind: "TrackCount", count: 4294967296 }, undefined, 0, 0)).toEqual({
      columns: "",
      rows: "",
      columnCount: 0,
      rowCount: 0,
    });
    expect(resolveGridTemplates(
      { kind: "TrackList", tracks: Array.from({ length: 10_001 }, () => ({ kind: "Fit" as const })) },
      undefined,
      0,
      0,
    ).columnCount).toBe(0);
  });

  it("retains orthogonal proposals without forcing alignment and always stretches spacers", () => {
    expect(crossAxisStyle("column", { proposed: true })).toEqual({ width: "100%" });
    expect(crossAxisStyle("row", { proposed: true })).toEqual({ height: "100%" });
    expect(crossAxisStyle("column", { stretch: true })).toEqual({ width: "100%", alignSelf: "stretch" });
    expect(spacerCrossAxisStyle()).toEqual({ alignSelf: "stretch" });
    expect(retainsCrossProposal({ kind: "HStack" })).toBe(true);
    expect(retainsCrossProposal({ kind: "VStack" })).toBe(true);
    expect(retainsCrossProposal({ kind: "MarkdownRef" })).toBe(false);
  });

  it("preserves fixed spacer sizes from zero through seven pixels", () => {
    for (let value = 0; value < 8; value += 1) {
      expect(spacerLayoutStyle({ kind: "Fixed", value })).toMatchObject({
        flex: `0 0 ${value}px`,
        minWidth: 0,
        minHeight: 0,
      });
    }
  });

  it("sizes page axes independently from host placement", () => {
    expect(pageAxisToCss({ kind: "CanvasSize", value: 1440 }, 960)).toBe("1440px");
    expect(pageAxisToCss({ kind: "Fixed", value: 0 }, 960)).toBe("0px");
    expect(pageAxisToCss({ kind: "Percent", value: 50 }, 960)).toBe("50%");
    expect(pageAxisToCss({ kind: "Fraction", value: 2 }, 960)).toBe("100%");
    expect(pageAxisToCss({ kind: "Fit" }, 960)).toBe("max-content");
    expect(pageAxisToCss(undefined, 960)).toBe("960px");
    expect(hostPlacementToCss("leading", "start")).toEqual({ justifyItems: "start", alignItems: "start" });
    expect(hostPlacementToCss("center", "center")).toEqual({ justifyItems: "center", alignItems: "center" });
    expect(hostPlacementToCss("trailing", "end")).toEqual({ justifyItems: "end", alignItems: "end" });
    expect(pageAxisToCss({ kind: "Percent", value: 50 }, 960)).toBe("50%");
  });

  it("maps at offsets, sizes, stretching pairs, and origin defaults to CSS", () => {
    expect(atPositionStyle([
      { key: "top", value: { kind: "Fixed", value: 12 } },
      { key: "right", value: { kind: "Percent", value: 5 } },
      { key: "w", value: { kind: "Fixed", value: 200 } },
      { key: "h", value: { kind: "Fit" } },
    ])).toMatchObject({ position: "absolute", top: "12px", right: "5%", width: "200px", height: "max-content" });
    expect(atPositionStyle([
      { key: "left", value: { kind: "Fixed", value: 0 } },
      { key: "right", value: { kind: "Fixed", value: 0 } },
    ])).toMatchObject({ left: "0px", right: "0px", top: 0 });
    expect(atPositionStyle([])).toMatchObject({ left: 0, top: 0 });
  });
});
