import { describe, expect, it } from "vitest";
import {
  applyTabIndent,
  applyPageVisibility,
  applyPageVisibilityToHidden,
  buildOutline,
  clampZoom,
  clearNonPageHiddenNodes,
  compileLmlSource,
  cursorPosition,
  extractPageEntries,
  getNodeAtPath,
  inspectNode,
  initializeHiddenNodes,
  isNodeDirectlyVisible,
  isNodeEffectivelyHidden,
  normalizeWorkspaceView,
  nodePathKey,
  pageEntryForPath,
  reconcileVisiblePages,
  reconcileHiddenNodes,
  resolveSelectionPath,
  sameNodePath,
  toggleNodeVisibility,
  visiblePageKeysFromHidden,
} from "../wysiwyg/src/editorModel.js";

const VALID_SOURCE = `host(align: center, justify: center) {
  page(w: 960, h: 540) {
    z {
      v(1fr, fit) {
        md:title
        space
      }
      at(top: 12, right: 5%, w: 160, h: fit) { md:badge }
    }
  }
}`;

describe("WYSIWYG editor model", () => {
  it("extracts independent page artboards with original paths and stable keys", () => {
    const root = compileLmlSource(`host {
      page(md:first, w: 960, h: 540) { md:a }
      page(md:second, w: 960, h: 540) { md:b }
    }`).document!.root;
    const pages = extractPageEntries(root);
    expect(pages.map(({ key, path, ref }) => ({ key, path, ref }))).toEqual([
      { key: "ref:first", path: [0], ref: "first" },
      { key: "ref:second", path: [1], ref: "second" },
    ]);
    expect(pageEntryForPath(pages, [1, 0])?.key).toBe("ref:second");
    expect(pageEntryForPath(pages, [])).toBeUndefined();
  });

  it("reconciles page visibility without forcing an explicitly empty selection", () => {
    const root = compileLmlSource(`host {
      page(md:first, w: 960, h: 540) {}
      page(md:second, w: 960, h: 540) {}
    }`).document!.root;
    const pages = extractPageEntries(root);
    expect(reconcileVisiblePages(pages, undefined)).toEqual(["ref:first"]);
    expect(reconcileVisiblePages(pages, [])).toEqual([]);
    expect(reconcileVisiblePages(pages, ["ref:second", "gone", "ref:second"])).toEqual(["ref:second"]);
    const reordered = [pages[1], pages[0]];
    expect(reconcileVisiblePages(reordered, ["ref:first"])).toEqual(["ref:first"]);
  });

  it("applies Page visibility commands without retaining stale workspace keys", () => {
    const root = compileLmlSource(`host {
      page(md:first, w: 960, h: 540) {}
      page(md:second, w: 960, h: 540) {}
    }`).document!.root;
    const pages = extractPageEntries(root);

    expect(applyPageVisibility(pages, "all", "ref:second")).toEqual({
      visiblePages: ["ref:first", "ref:second"],
      selectedPage: "ref:second",
    });
    expect(applyPageVisibility(pages, "selected", "ref:second")).toEqual({
      visiblePages: ["ref:second"],
      selectedPage: "ref:second",
    });
    expect(applyPageVisibility(pages, "selected", "ref:gone")).toEqual({
      visiblePages: ["ref:first"],
      selectedPage: "ref:first",
    });
    expect(applyPageVisibility(pages, "none", "ref:gone")).toEqual({
      visiblePages: [],
      selectedPage: "ref:first",
    });
    expect(applyPageVisibility([], "all", "ref:gone")).toEqual({ visiblePages: [] });
  });

  it("extracts standalone and legacy Host-Z pages", () => {
    const standalone = compileLmlSource(`page(md:only, w: 960, h: 540) {}`).document!.root;
    expect(extractPageEntries(standalone).map((entry) => [entry.key, entry.path])).toEqual([["ref:only", []]]);
    const hostZ = compileLmlSource(`host { z { page(w: 960, h: 540) {} at() { md:a } } }`).document!.root;
    const entries = extractPageEntries(hostZ);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ key: "path:0.0", path: [0, 0] });
    expect(entries[0].z?.kind).toBe("ZStack");
  });
  it("compiles LML alone and reports explicit status", () => {
    const valid = compileLmlSource(VALID_SOURCE);
    expect(valid.status).toBe("valid");
    expect(valid.document?.root.kind).toBe("Host");
    expect(valid.parseError).toBeNull();
    expect(valid.diagnostics).toEqual([]);

    const semanticError = compileLmlSource("v { md:title }");
    expect(semanticError.status).toBe("invalid");
    expect(semanticError.document?.root.kind).toBe("VStack");
    expect(semanticError.diagnostics.some((entry) => entry.code === "E004")).toBe(true);

    expect(compileLmlSource("  \n")).toMatchObject({ status: "empty", document: null, parseError: null });
  });

  it("preserves parser line and column for diagnostics", () => {
    const result = compileLmlSource("page(w: 960, h: 540) {\n  nope\n}");
    expect(result.status).toBe("invalid");
    expect(result.document).toBeNull();
    expect(result.parseError?.span?.start).toMatchObject({ line: 2, column: 3 });
    expect(result.parseError?.message).toContain("Expected node");
  });

  it("builds stable preorder paths and resolves disappeared selections", () => {
    const result = compileLmlSource(VALID_SOURCE);
    const root = result.document!.root;
    const outline = buildOutline(root);
    expect(outline.map((entry) => `${entry.pathKey}:${entry.label}`)).toEqual([
      "root:Host",
      "0:Page",
      "0.0:ZStack",
      "0.0.0:VStack",
      "0.0.0.0:md:title",
      "0.0.0.1:space",
      "0.0.1:At",
      "0.0.1.0:md:badge",
    ]);
    expect(nodePathKey([0, 0, 1])).toBe("0.0.1");
    expect(getNodeAtPath(root, [0, 0, 1])?.kind).toBe("At");
    expect(resolveSelectionPath(root, [0, 0, 1, 5])).toEqual([0, 0, 1]);
    expect(resolveSelectionPath(root, [9, 2])).toEqual([]);
    expect(sameNodePath([0, 1], [0, 1])).toBe(true);
    expect(sameNodePath([0], [1])).toBe(false);
  });

  it("assigns every node a visibility identity and preserves child state under a hidden parent", () => {
    const root = compileLmlSource(`host { page(md:p, w: 960, h: 540) {
      z {
        v { h { md:a space } grid(cols: 1) { md """note""" } }
        at() { md:b }
      }
    } }`).document!.root;
    const outline = buildOutline(root);
    expect(new Set(outline.map((entry) => entry.kind))).toEqual(new Set([
      "Host", "Page", "ZStack", "VStack", "HStack", "Grid", "At", "MarkdownRef", "MarkdownInline", "Spacer",
    ]));
    expect(new Set(outline.map((entry) => entry.visibilityKey)).size).toBe(outline.length);

    const parent = outline.find((entry) => entry.kind === "VStack")!;
    const child = outline.find((entry) => entry.kind === "MarkdownRef" && entry.node.kind === "MarkdownRef" && entry.node.ref === "a")!;
    let hidden = toggleNodeVisibility(outline, [], parent.visibilityKey);
    expect(isNodeDirectlyVisible(parent, hidden)).toBe(false);
    expect(isNodeDirectlyVisible(child, hidden)).toBe(true);
    expect(isNodeEffectivelyHidden(child, hidden)).toBe(true);
    hidden = toggleNodeVisibility(outline, hidden, child.visibilityKey);
    hidden = toggleNodeVisibility(outline, hidden, parent.visibilityKey);
    expect(isNodeDirectlyVisible(parent, hidden)).toBe(true);
    expect(isNodeDirectlyVisible(child, hidden)).toBe(false);
  });

  it("reconciles displaced nodes only by a unique fingerprint inside the same Page", () => {
    const oldRoot = compileLmlSource(`host { page(md:p, w: 960, h: 540) { v { md:a md:b } } }`).document!.root;
    const oldOutline = buildOutline(oldRoot);
    const oldB = oldOutline.find((entry) => entry.node.kind === "MarkdownRef" && entry.node.ref === "b")!;
    const hidden = toggleNodeVisibility(oldOutline, [], oldB.visibilityKey);

    const insertedRoot = compileLmlSource(`host { page(md:p, w: 960, h: 540) { v { space md:a md:b } } }`).document!.root;
    const insertedOutline = buildOutline(insertedRoot);
    const migrated = reconcileHiddenNodes(insertedOutline, hidden);
    const newB = insertedOutline.find((entry) => entry.node.kind === "MarkdownRef" && entry.node.ref === "b")!;
    expect(migrated).toEqual([{ key: newB.visibilityKey, fingerprint: newB.fingerprint }]);

    const removedRoot = compileLmlSource(`host { page(md:p, w: 960, h: 540) { v { md:a } } }`).document!.root;
    expect(reconcileHiddenNodes(buildOutline(removedRoot), hidden)).toEqual([]);

    const ambiguousOld = buildOutline(compileLmlSource(`host { page(md:p, w: 960, h: 540) { v { md:a } } }`).document!.root);
    const oldA = ambiguousOld.find((entry) => entry.node.kind === "MarkdownRef")!;
    const ambiguousHidden = toggleNodeVisibility(ambiguousOld, [], oldA.visibilityKey);
    const ambiguousNew = buildOutline(compileLmlSource(`host { page(md:p, w: 960, h: 540) { v { space md:a md:a } } }`).document!.root);
    expect(reconcileHiddenNodes(ambiguousNew, ambiguousHidden)).toEqual([]);

    const exactCollision = buildOutline(compileLmlSource(`host { page(md:p, w: 960, h: 540) { v { md:a md:a } } }`).document!.root);
    expect(reconcileHiddenNodes(exactCollision, ambiguousHidden)).toEqual([]);
  });

  it("keeps named Page visibility across reorder but treats a Page ref rename as new identity", () => {
    const beforeRoot = compileLmlSource(`host {
      page(md:first, w: 960, h: 540) { md:a }
      page(md:second, w: 960, h: 540) { md:b }
    }`).document!.root;
    const beforeOutline = buildOutline(beforeRoot);
    const beforePages = extractPageEntries(beforeRoot);
    const second = beforeOutline.find((entry) => entry.kind === "Page" && entry.node.kind === "Page" && entry.node.ref === "second")!;
    const child = beforeOutline.find((entry) => entry.node.kind === "MarkdownRef" && entry.node.ref === "b")!;
    const hidden = [
      ...toggleNodeVisibility(beforeOutline, [], second.visibilityKey),
      { key: child.visibilityKey, fingerprint: child.fingerprint },
    ];
    const reorderedRoot = compileLmlSource(`host {
      page(md:second, w: 960, h: 540) { md:b }
      page(md:first, w: 960, h: 540) { md:a }
    }`).document!.root;
    const reorderedOutline = buildOutline(reorderedRoot);
    expect(reconcileHiddenNodes(reorderedOutline, hidden)).toHaveLength(2);
    expect(visiblePageKeysFromHidden(reorderedOutline, extractPageEntries(reorderedRoot), hidden)).toEqual(["ref:first"]);

    const renamedRoot = compileLmlSource(`host {
      page(md:first, w: 960, h: 540) { md:a }
      page(md:renamed, w: 960, h: 540) { md:b }
    }`).document!.root;
    expect(reconcileHiddenNodes(buildOutline(renamedRoot), hidden)).toEqual([]);
    expect(beforePages).toHaveLength(2);
  });

  it("upgrades legacy Page visibility and Page bulk controls preserve hidden descendants", () => {
    const root = compileLmlSource(`host {
      page(md:first, w: 960, h: 540) { md:a }
      page(md:second, w: 960, h: 540) { md:b }
    }`).document!.root;
    const outline = buildOutline(root);
    const pages = extractPageEntries(root);
    const legacy = initializeHiddenNodes(outline, pages, undefined, ["ref:first"]);
    expect(visiblePageKeysFromHidden(outline, pages, legacy)).toEqual(["ref:first"]);
    const child = outline.find((entry) => entry.node.kind === "MarkdownRef" && entry.node.ref === "a")!;
    const withChild = toggleNodeVisibility(outline, legacy, child.visibilityKey);
    const all = applyPageVisibilityToHidden(outline, pages, withChild, "all", "ref:first");
    expect(visiblePageKeysFromHidden(outline, pages, all.hiddenNodes)).toEqual(["ref:first", "ref:second"]);
    expect(all.hiddenNodes.some((record) => record.key === child.visibilityKey)).toBe(true);
    const none = applyPageVisibilityToHidden(outline, pages, all.hiddenNodes, "none", "ref:first");
    expect(visiblePageKeysFromHidden(outline, pages, none.hiddenNodes)).toEqual([]);
    expect(clearNonPageHiddenNodes(outline, none.hiddenNodes).every((record) => record.key.includes("page:") && record.key.endsWith("|root"))).toBe(true);
  });

  it("normalizes legacy workspace selection to a clean coherent fallback", () => {
    const root = compileLmlSource(`host {
      page(md:first, w: 960, h: 540) { md:a }
      page(md:second, w: 960, h: 540) { md:b }
    }`).document!.root;
    const outline = buildOutline(root);
    const pages = extractPageEntries(root);
    const noView = normalizeWorkspaceView(outline, pages, undefined, undefined, undefined);
    expect(noView.visiblePages).toEqual(["ref:first"]);
    expect(noView.selectedPage).toBe("ref:first");
    const explicitEmpty = normalizeWorkspaceView(outline, pages, undefined, [], undefined);
    expect(explicitEmpty.visiblePages).toEqual([]);
    expect(explicitEmpty.selectedPage).toBe("ref:first");
    expect(normalizeWorkspaceView(
      outline,
      pages,
      explicitEmpty.hiddenNodes,
      explicitEmpty.visiblePages,
      explicitEmpty.selectedPage,
    )).toEqual(explicitEmpty);
  });

  it("describes selected nodes without Markdown body content", () => {
    const root = compileLmlSource(VALID_SOURCE).document!.root;
    const at = getNodeAtPath(root, [0, 0, 1])!;
    expect(inspectNode(at, [0, 0, 1])).toEqual([
      { label: "Kind", value: "At" },
      { label: "Path", value: "0.0.1" },
      { label: "top", value: "12" },
      { label: "right", value: "5%" },
      { label: "w", value: "160" },
      { label: "h", value: "fit" },
    ]);
  });

  it("tracks cursor positions across newline conventions", () => {
    expect(cursorPosition("alpha\r\nbeta", 9)).toEqual({ line: 2, column: 3 });
    expect(cursorPosition("a\nb", 99)).toEqual({ line: 2, column: 2 });
    expect(cursorPosition("", -10)).toEqual({ line: 1, column: 1 });
  });

  it("supports Tab insertion and multi-line indent/outdent", () => {
    expect(applyTabIndent("ab", 1, 1, false)).toEqual({ value: "a  b", selectionStart: 3, selectionEnd: 3 });
    expect(applyTabIndent("a\nb", 0, 3, false)).toEqual({ value: "  a\n  b", selectionStart: 2, selectionEnd: 7 });
    expect(applyTabIndent("  a\n b", 0, 6, true)).toEqual({ value: "a\nb", selectionStart: 0, selectionEnd: 3 });
  });

  it("keeps zoom in the usable canvas range", () => {
    expect(clampZoom(5)).toBe(25);
    expect(clampZoom(111.6)).toBe(112);
    expect(clampZoom(999)).toBe(200);
  });
});
