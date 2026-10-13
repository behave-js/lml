import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLml } from "../src/parser.js";
import { parseMarkdownBlocks } from "../src/parse-md.js";
import { joinSlide, parseAndJoin } from "../src/join.js";
import { collectMarkdownRefs, hasErrors, validateLml } from "../src/validate-lml.js";
import { getParam } from "../spec/ast.js";

const root = join(import.meta.dirname, "..");
const examples = join(root, "examples");

function readExample(name: string): { lml: string; md: string } {
  const dir = join(examples, name);
  return {
    lml: readFileSync(join(dir, "slide.lml"), "utf8"),
    md: readFileSync(join(dir, "slide.md"), "utf8"),
  };
}

describe("parseLml", () => {
  it("parses page md metadata as a Page property and supports multiple host pages", () => {
    const doc = parseLml(`host {
      page(md:catalog, w: 960, h: 540) { md:catalog_body }
      page(md:cart, w: 960, h: 540) { md:cart_body }
    }`);
    if (doc.root.kind !== "Host") throw new Error("expected Host");
    expect(doc.root.children.map((node) => node.kind === "Page" ? node.ref : undefined)).toEqual(["catalog", "cart"]);
    expect(doc.root.children[0]).toMatchObject({ kind: "Page", ref: "catalog", children: [{ kind: "MarkdownRef", ref: "catalog_body" }] });
    expect(doc.root.children[0]?.kind === "Page" ? doc.root.children[0].params.map((param) => param.key) : []).toEqual(["w", "h"]);
    expect(validateLml(doc)).toEqual([]);
    expect(collectMarkdownRefs(doc)).toEqual(["catalog", "catalog_body", "cart", "cart_body"]);
  });

  it("keeps single unnamed pages compatible and validates multi-page identities", () => {
    expect(validateLml(parseLml(`host { page(w: 960, h: 540) {} }`))).toEqual([]);
    expect(validateLml(parseLml(`page(w: 960, h: 540) {}`))).toEqual([]);
    expect(validateLml(parseLml(`host { page(w: 960, h: 540) {} page(md:two, w: 960, h: 540) {} }`)))
      .toContainEqual(expect.objectContaining({ code: "E007" }));
    expect(validateLml(parseLml(`host { page(md:same, w: 960, h: 540) {} page(md:same, w: 960, h: 540) {} }`)))
      .toContainEqual(expect.objectContaining({ code: "E002" }));
  });

  it("requires page md metadata first and rejects duplicates", () => {
    expect(() => parseLml(`page(w: 960, md:catalog, h: 540) {}`)).toThrow(/first argument/);
    expect(() => parseLml(`page(md:catalog, md:cart, w: 960, h: 540) {}`)).toThrow(/first argument/);
  });

  it("rejects empty and mixed host shapes while preserving Host-Z composition", () => {
    expect(validateLml(parseLml(`host {}`))).toContainEqual(expect.objectContaining({ code: "E007" }));
    expect(validateLml(parseLml(`host { page(w: 960, h: 540) {} z {} }`))).toContainEqual(expect.objectContaining({ code: "E007" }));
    expect(validateLml(parseLml(`host { z { page(md:base, w: 960, h: 540) {} at() { md:badge } } }`))).toEqual([]);
  });

  it("allows a page and leaf to share one semantic block without duplicate join errors", () => {
    const layout = parseLml(`host { page(md:screen, w: 960, h: 540) { md:screen } }`);
    const joined = joinSlide(layout, parseMarkdownBlocks(`# screen\n## Shared context`));
    expect(joined.diagnostics).toEqual([]);
    expect(joined.slide?.bindings.get("screen")?.body).toBe("## Shared context");
  });
  it("parses example 01-market-overview", () => {
    const { lml } = readExample("01-market-overview");
    const doc = parseLml(lml);

    expect(doc.kind).toBe("Document");
    expect(doc.root.kind).toBe("Page");
    if (doc.root.kind !== "Page") return;

    expect(getParam(doc.root.params, "pad")?.value).toEqual([40]);

    const v = doc.root.children[0];
    expect(v.kind).toBe("VStack");
    if (v.kind !== "VStack") return;

    expect(v.children).toHaveLength(2);
    expect(v.children[1].kind).toBe("HStack");
    if (v.children[1].kind !== "HStack") return;

    expect(v.children[1].dimensions).toEqual([
      { kind: "Fraction", value: 2 },
      { kind: "Fraction", value: 1 },
    ]);
  });

  it("parses example 02-title-cover with page w/h and z stack", () => {
    const { lml } = readExample("02-title-cover");
    const doc = parseLml(lml);

    if (doc.root.kind !== "Page") throw new Error("expected Page");
    expect(getParam(doc.root.params, "w")?.value).toEqual({ kind: "CanvasSize", value: 1920 });
    expect(getParam(doc.root.params, "h")?.value).toEqual({ kind: "CanvasSize", value: 1080 });

    const z = doc.root.children[0];
    expect(z.kind).toBe("ZStack");
  });

  it("parses example 03-kpi-dashboard with grid and inline md", () => {
    const { lml } = readExample("03-kpi-dashboard");
    const doc = parseLml(lml);

    if (doc.root.kind !== "Page") throw new Error("expected Page");
    const v = doc.root.children[0];
    expect(v.kind).toBe("VStack");
    if (v.kind !== "VStack") return;

    const header = v.children[0];
    expect(header.kind).toBe("HStack");
    if (header.kind !== "HStack") return;

    expect(header.dimensions).toBeUndefined();
    expect(header.children[2].kind).toBe("MarkdownInline");

    const grid = v.children[1];
    expect(grid.kind).toBe("Grid");
    if (grid.kind !== "Grid") return;

    const cols = getParam(grid.params, "cols");
    expect(cols?.value).toEqual({
      kind: "TrackList",
      tracks: [
        { kind: "Fraction", value: 1 },
        { kind: "Fraction", value: 1 },
        { kind: "Fraction", value: 1 },
      ],
    });
    expect(grid.children).toHaveLength(6);
  });

  it("parses v-root syntax but validator reports E004", () => {
    const doc = parseLml(`v { md:a }`);
    expect(doc.root.kind).toBe("VStack");

    const diagnostics = validateLml(doc);
    expect(diagnostics.some((d) => d.code === "E004")).toBe(true);
  });

  it("reports E003 for dimension mismatch", () => {
    const doc = parseLml(`page { h(1fr) { md:a md:b } }`);
    const diagnostics = validateLml(doc);
    expect(diagnostics.some((d) => d.code === "E003")).toBe(true);
  });

  it("reports E005 for z(gap: 8)", () => {
    const doc = parseLml(`page { z(gap: 8) { md:a } }`);
    const diagnostics = validateLml(doc);
    expect(diagnostics.some((d) => d.code === "E005")).toBe(true);
    expect(diagnostics.some((d) => d.code === "W003")).toBe(false);
  });

  it("parses cols: 3 as TrackCount", () => {
    const doc = parseLml(`page { grid(cols: 3) { md:a md:b md:c } }`);
    if (doc.root.kind !== "Page") throw new Error("expected Page");
    const grid = doc.root.children[0];
    if (grid.kind !== "Grid") throw new Error("expected Grid");
    expect(getParam(grid.params, "cols")?.value).toEqual({ kind: "TrackCount", count: 3 });
  });

  it("reports E007 for page with multiple children", () => {
    const doc = parseLml(`page { md:a md:b }`);
    const diagnostics = validateLml(doc);
    expect(diagnostics.some((d) => d.code === "E007")).toBe(true);
  });

  it("reports E007 for grid without cols", () => {
    const doc = parseLml(`page { grid(gap: 8) { md:a } }`);
    const diagnostics = validateLml(doc);
    expect(diagnostics.some((d) => d.code === "E007")).toBe(true);
  });

  it("reports E008 for duplicate named param", () => {
    const doc = parseLml(`page { v(gap: 10, gap: 20) { md:a } }`);
    const diagnostics = validateLml(doc);
    expect(diagnostics.some((d) => d.code === "E008")).toBe(true);
  });

  it("reports E009 for reserved md ref name", () => {
    const doc = parseLml(`page { md:page }`);
    const diagnostics = validateLml(doc);
    expect(diagnostics.some((d) => d.code === "E009")).toBe(true);
  });

  it("rejects align: top at parse time", () => {
    expect(() => parseLml(`page { h(align: top) { md:a } }`)).toThrow();
  });

  it("reports E006 for 0fr", () => {
    const doc = parseLml(`page { h(0fr) { md:a } }`);
    const diagnostics = validateLml(doc);
    expect(diagnostics.some((d) => d.code === "E006")).toBe(true);
  });

  it("rejects cols: 0 at parse time", () => {
    expect(() => parseLml(`page { grid(cols: 0) { md:a } }`)).toThrow();
  });

  it("reports E006 for space(dimension) when parent has positional dims", () => {
    const doc = parseLml(`page { h(1fr, 1fr) { md:a space(2fr) } }`);
    const diagnostics = validateLml(doc);
    expect(diagnostics.some((d) => d.code === "E006")).toBe(true);
  });

  it("allows bare space when parent has positional dims", () => {
    const doc = parseLml(`page { h(2fr, 1fr) { space md:a } }`);
    const diagnostics = validateLml(doc);
    expect(hasErrors(diagnostics)).toBe(false);
  });

  it("reports E006 for same-axis nested v with fr dimensions", () => {
    const doc = parseLml(`page { v { v(1fr, 1fr) { md:a md:b } } }`);
    const diagnostics = validateLml(doc);
    expect(diagnostics.some((d) => d.code === "E006")).toBe(true);
  });

  it("rejects cols: 3.5 at parse time", () => {
    expect(() => parseLml(`page { grid(cols: 3.5) { md:a md:b md:c } }`)).toThrow();
  });

  it("reports E006 when grid children exceed cell capacity", () => {
    const doc = parseLml(`page { grid(cols: 2, rows: 1) { md:a md:b md:c } }`);
    const diagnostics = validateLml(doc);
    expect(diagnostics.some((d) => d.code === "E006")).toBe(true);
  });

  it("reports E005 for grid(align: leading)", () => {
    const doc = parseLml(`page { grid(cols: 2, align: leading) { md:a md:b } }`);
    const diagnostics = validateLml(doc);
    expect(diagnostics.some((d) => d.code === "E005")).toBe(true);
  });

  it("reports E006 for space under page", () => {
    const doc = parseLml(`page { space }`);
    const diagnostics = validateLml(doc);
    expect(diagnostics.some((d) => d.code === "E006")).toBe(true);
  });

  it("reports E006 for grid with fr rows under fit v child", () => {
    const doc = parseLml(`page { v { grid(cols: 2, rows: 1fr 1fr) { md:a md:b md:c md:d } } }`);
    const diagnostics = validateLml(doc);
    expect(diagnostics.some((d) => d.code === "E006")).toBe(true);
  });

  it("parses at geometry contextually and allows an empty parameter list", () => {
    const doc = parseLml(`page { z { at(top: 12, right: 5%, w: 200, h: fit) { md:badge } at() { md:origin } } }`);
    if (doc.root.kind !== "Page" || doc.root.children[0]?.kind !== "ZStack") throw new Error("expected z");
    const first = doc.root.children[0].children[0];
    if (first.kind !== "At") throw new Error("expected at");
    expect(first.params).toEqual([
      { key: "top", value: { kind: "Fixed", value: 12 } },
      { key: "right", value: { kind: "Percent", value: 5 } },
      { key: "w", value: { kind: "Fixed", value: 200 } },
      { key: "h", value: { kind: "Fit" } },
    ]);
    expect(hasErrors(validateLml(doc))).toBe(false);
  });

  it.each([
    `page { at() { md:a } }`,
    `page { z { at() {} } }`,
    `page { z { at() { md:a md:b } } }`,
    `page { z { at(left: 0, right: 0, w: 10) { md:a } } }`,
    `page { z { at(top: 0, bottom: 0, h: 10) { md:a } } }`,
    `page { z { at() { at() { md:a } } } }`,
  ])("rejects invalid at placement or shape: %s", (source) => {
    expect(hasErrors(validateLml(parseLml(source)))).toBe(true);
  });

  it.each([
    `page { z { at(left: 1fr) { md:a } } }`,
    `page { z { at(w: 1fr) { md:a } } }`,
    `page { z { at { md:a } } }`,
    `page { v(top: 1) { md:a } }`,
  ])("rejects invalid at syntax or units: %s", (source) => {
    expect(() => parseLml(source)).toThrow();
  });

  it("permits nested at only through a nested z", () => {
    const doc = parseLml(`page { z { at() { z { at(left: 4) { md:a } } } } }`);
    expect(hasErrors(validateLml(doc))).toBe(false);
  });

  it("validates the host-z compatibility form and rejects other host-z children", () => {
    const valid = parseLml(`host(align: center) { z { page(w: 960, h: 540) { md:body } at(top: 10, right: 10) { md:badge } } }`);
    expect(hasErrors(validateLml(valid))).toBe(false);
    expect(validateLml(parseLml(`host { z { at() { md:a } } }`))).toContainEqual(expect.objectContaining({ code: "E007" }));
    expect(validateLml(parseLml(`host { z { page(w: 1fr, h: 1fr) {} md:a } }`))).toContainEqual(expect.objectContaining({ code: "E007" }));
    expect(validateLml(parseLml(`host { z { page(w: 1fr, h: 1fr) {} page(w: 1fr, h: 1fr) {} } }`))).toContainEqual(expect.objectContaining({ code: "E007" }));
  });

  it("propagates definite axes from fixed, percent, and paired-edge at geometry", () => {
    for (const source of [
      `page { z { at(w: 200) { h(1fr) { md:a } } } }`,
      `page { z { at(w: 50%) { h(1fr) { md:a } } } }`,
      `page { z { at(left: 0, right: 0) { h(1fr) { md:a } } } }`,
      `page { z { at(h: 200) { v(1fr) { md:a } } } }`,
    ]) expect(validateLml(parseLml(source)).filter((d) => d.code === "E006")).toEqual([]);

    for (const source of [
      `page { z { at(w: fit) { h(1fr) { md:a } } } }`,
      `page { z { at(left: 0) { h(1fr) { md:a } } } }`,
      `host { page(w: fit, h: 400) { z { at(w: 50%) { h(1fr) { md:a } } } } }`,
    ]) expect(validateLml(parseLml(source))).toContainEqual(expect.objectContaining({ code: "E006" }));
  });

  it("treats at and its parameter names as reserved markdown references", () => {
    for (const ref of ["at", "top", "bottom", "left", "right"]) {
      expect(validateLml(parseLml(`page { md:${ref} }`))).toContainEqual(expect.objectContaining({ code: "E009" }));
    }
  });

  it("parses and validates the canonical five-page store flow", () => {
    const { lml, md } = readExample("06-store-flow");
    const document = parseLml(lml);
    expect(document.root.kind).toBe("Host");
    if (document.root.kind !== "Host") return;

    const pages = document.root.children.filter((node) => node.kind === "Page");
    expect(pages).toHaveLength(5);
    expect(pages.map((page) => page.ref)).toEqual([
      "catalog",
      "product_detail",
      "cart",
      "checkout",
      "order_complete",
    ]);
    expect(pages.every((page) => page.children.length === 1)).toBe(true);
    expect(pages.map((page) => [getParam(page.params, "w")?.value, getParam(page.params, "h")?.value]))
      .toEqual(Array.from({ length: 5 }, () => [
        { kind: "CanvasSize", value: 1440 },
        { kind: "CanvasSize", value: 900 },
      ]));
    expect(validateLml(document)).toEqual([]);
    const refs = collectMarkdownRefs(document);
    const blocks = parseMarkdownBlocks(md).blocks;
    expect(new Set(refs).size).toBe(refs.length);
    expect(blocks.map((block) => block.name).sort()).toEqual([...refs].sort());
    expect(parseAndJoin(lml, md).diagnostics).toEqual([]);
  });
});

describe("optional Markdown association", () => {
  it("associates all nine examples without errors", () => {
    for (const name of [
      "01-market-overview",
      "02-title-cover",
      "03-kpi-dashboard",
      "04-wysiwyg-system",
      "05-absolute-overlay",
      "06-store-flow",
      "07-nourish",
      "08-vscode-keybindings",
      "09-vscode-explorer",
    ]) {
      const { lml, md } = readExample(name);
      const layout = parseLml(lml);
      const markdown = parseMarkdownBlocks(md);
      const result = joinSlide(layout, markdown);

      expect(hasErrors(result.diagnostics), name).toBe(false);
      expect(result.slide?.bindings.size).toBeGreaterThan(0);
    }
  });

  it("reports E001 for missing markdown block", () => {
    const layout = parseLml(`page { md:missing }`);
    const markdown = parseMarkdownBlocks(`# other\nx`);
    const result = joinSlide(layout, markdown);

    expect(result.slide).toBeUndefined();
    expect(result.diagnostics.some((d) => d.code === "E001")).toBe(true);
  });

  it("reports W001 for unused markdown block", () => {
    const layout = parseLml(`page { md:used }`);
    const markdown = parseMarkdownBlocks(`# used\nx\n\n# unused\ny`);
    const result = joinSlide(layout, markdown);

    expect(result.diagnostics.some((d) => d.code === "W001")).toBe(true);
  });

  it("reports E002 for duplicate leaf markdown reference in join", () => {
    const layout = parseLml(`page { v { md:a md:a } }`);
    const markdown = parseMarkdownBlocks(`# a\nx`);
    const result = joinSlide(layout, markdown);

    expect(validateLml(layout)).toEqual([]);
    expect(result.diagnostics.some((d) => d.code === "E002")).toBe(true);
  });

  it("collects and binds markdown references through at", () => {
    const result = joinSlide(
      parseLml(`page { z { at(top: 8) { md:badge } } }`),
      parseMarkdownBlocks(`# badge\nOverlay`),
    );
    expect(hasErrors(result.diagnostics)).toBe(false);
    expect(result.slide?.bindings.has("badge")).toBe(true);
  });
});
