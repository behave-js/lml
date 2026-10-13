import { describe, expect, it } from "vitest";
import type { Document } from "../spec/ast.js";
import { Lexer } from "../src/lexer.js";
import { parseAndJoin } from "../src/join.js";
import { parseMarkdownBlocks } from "../src/parse-md.js";
import { parseLml } from "../src/parser.js";
import { validateLml } from "../src/validate-lml.js";
import { DEFAULT_LML, DEFAULT_MD } from "../wysiwyg/src/defaultContent.js";
import { parseWysiwygDocument } from "../wysiwyg/src/types.js";

describe("lexer boundaries", () => {
  it.each([".5", "1.", "1..2"])("rejects non-grammar number %s", (number) => {
    expect(() => parseLml(`page(w: ${number}) {}`)).toThrow();
  });

  it("rejects a numeric lexeme that overflows JavaScript number", () => {
    expect(() => parseLml(`page(w: ${"9".repeat(400)}) {}`)).toThrow(/Invalid number/);
  });

  it("tracks LF, CRLF, comments, columns and offsets exactly once", () => {
    const lf = new Lexer("// x\n(").tokenize();
    const crlf = new Lexer("// x\r\n(").tokenize();
    expect(lf[0].span.start).toEqual({ line: 2, column: 1, offset: 5 });
    expect(crlf[0].span.start).toEqual({ line: 2, column: 1, offset: 6 });
  });
});

describe("parser disambiguation", () => {
  it("parses numeric-leading column and row track lists", () => {
    const doc = parseLml("page { grid(cols: 240 1fr, rows: 120 fit) { md:a md:b } }");
    if (doc.root.kind !== "Page" || doc.root.children[0]?.kind !== "Grid") throw new Error("grid expected");
    expect(doc.root.children[0].params).toContainEqual({
      key: "cols",
      value: { kind: "TrackList", tracks: [{ kind: "Fixed", value: 240 }, { kind: "Fraction", value: 1 }] },
    });
    expect(doc.root.children[0].params).toContainEqual({
      key: "rows",
      value: { kind: "TrackList", tracks: [{ kind: "Fixed", value: 120 }, { kind: "Fit" }] },
    });
  });

  it.each(["03", "3.0"])("rejects non-positive_integer track count lexical form %s", (count) => {
    expect(() => parseLml(`page { grid(cols: ${count}) {} }`)).toThrow(/positive integer/);
  });

  it.each([
    ["0", 0],
    ["03", 3],
    ["3.5", 3.5],
  ] as const)("parses non-legacy numeric page axis %s as Fixed", (size, value) => {
    const doc = parseLml(`page(w: ${size}) {}`);
    if (doc.root.kind !== "Page") throw new Error("page expected");
    expect(doc.root.params).toContainEqual({ key: "w", value: { kind: "Fixed", value } });
  });

  it("parses md:fr so the validator reports E009", () => {
    const diagnostics = validateLml(parseLml("page { md:fr }"));
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: "E009" }));
  });

  it.each(["page() {}", "page { v() {} }", "page { grid() {} }"])(
    "rejects an explicit empty argument list in %s",
    (source) => expect(() => parseLml(source)).toThrow(/must not be empty/),
  );

  it.each(["1fr2fr", "1%2fr"])("requires whitespace between grid tracks in %s", (tracks) => {
    expect(() => parseLml(`page { grid(cols: ${tracks}) {} }`)).toThrow(/whitespace/);
  });

  it("accepts spaces, newlines and comments between grid tracks", () => {
    expect(() => parseLml("page { grid(cols: 1fr // split\n 2fr) {} }")).not.toThrow();
    expect(() => parseLml("page { grid(cols: 1fr\n2fr) {} }")).not.toThrow();
  });
});

describe("defensive semantic validation", () => {
  it("rejects nested pages and still validates every nested child", () => {
    const doc = parseLml("page { page { z { space md:fr } } }");
    const codes = validateLml(doc).map((diagnostic) => diagnostic.code);
    expect(codes).toContain("E004");
    expect(codes).toContain("E006");
    expect(codes).toContain("E009");
  });

  it("validates explicit spacer dimensions", () => {
    const diagnostics = validateLml(parseLml("page { h { space(0fr) } }"));
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: "E006" }));
  });

  it("does not throw on malformed public AST and diagnoses all numeric contracts", () => {
    const malformed = {
      kind: "Document",
      root: {
        kind: "Page",
        params: [
          { key: "w", value: { kind: "CanvasSize", value: 1.5 } },
          { key: "pad", value: [-1] },
        ],
        children: [{
          kind: "Grid",
          params: [
            { key: "gap", value: Number.NaN },
            { key: "cols", value: { kind: "TrackCount", count: Number.POSITIVE_INFINITY } },
            { key: "rows", value: { kind: "TrackList", tracks: [] } },
          ],
          children: [],
        }],
      },
    } as unknown as Document;
    expect(() => validateLml(malformed)).not.toThrow();
    expect(validateLml(malformed).filter((diagnostic) => diagnostic.code === "E006").length).toBeGreaterThanOrEqual(5);
  });

  it("defensively rejects unsupported at units in public AST values", () => {
    const malformed = {
      kind: "Document",
      root: {
        kind: "Page",
        params: [],
        children: [{
          kind: "ZStack",
          params: [],
          children: [{
            kind: "At",
            params: [
              { key: "left", value: { kind: "Fraction", value: 1 } },
              { key: "w", value: { kind: "CanvasSize", value: 100 } },
            ],
            children: [{ kind: "MarkdownRef", ref: "badge" }],
          }],
        }],
      },
    } as unknown as Document;
    expect(() => validateLml(malformed)).not.toThrow();
    expect(validateLml(malformed).filter((diagnostic) => diagnostic.code === "E006").length).toBeGreaterThanOrEqual(2);
  });

  it.each([null, { left: 10 }, "left: 10"])(
    "does not throw when a public At AST has non-array params %#",
    (params) => {
      const malformed = {
        kind: "Document",
        root: {
          kind: "Page",
          params: [],
          children: [{
            kind: "ZStack",
            params: [],
            children: [{
              kind: "At",
              params,
              children: [{
                kind: "HStack",
                dimensions: [{ kind: "Fraction", value: 1 }],
                params: [],
                children: [{ kind: "MarkdownRef", ref: "badge" }],
              }],
            }],
          }],
        },
      } as unknown as Document;
      expect(() => validateLml(malformed)).not.toThrow();
      const diagnostics = validateLml(malformed);
      expect(diagnostics).toContainEqual(expect.objectContaining({ message: "At params must be an array" }));
      expect(diagnostics).toContainEqual(expect.objectContaining({ code: "E006" }));
    },
  );

  it("passes definite fixed grid cell axes into nested stacks", () => {
    const doc = parseLml("page { grid(cols: 300 fit, rows: 200 fit) { h(1fr) { v(1fr) { md:a } } } } ");
    expect(validateLml(doc).filter((diagnostic) => diagnostic.code === "E006")).toEqual([]);
  });

  it("keeps fit grid cell axes indefinite", () => {
    const doc = parseLml("page { grid(cols: fit, rows: fit) { h(1fr) { md:a } } } ");
    expect(validateLml(doc)).toContainEqual(expect.objectContaining({ code: "E006" }));
  });

  it("bounds huge track counts without allocating or throwing", () => {
    const parsed = parseLml("page { grid(cols: 4294967296) {} }");
    expect(() => validateLml(parsed)).not.toThrow();
    expect(validateLml(parsed)).toContainEqual(expect.objectContaining({ code: "E006" }));

    const direct = {
      kind: "Document",
      root: { kind: "Page", params: [], children: [{
        kind: "Grid",
        params: [{ key: "cols", value: { kind: "TrackCount", count: 4294967296 } }],
        children: [],
      }] },
    } as unknown as Document;
    expect(() => validateLml(direct)).not.toThrow();
  });

  it("does not invent an implicit row for an empty grid", () => {
    const diagnostics = validateLml(parseLml("page { v { grid(cols: fit) {} } }"));
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "E006")).toEqual([]);
  });

  it("diagnoses invalid Document and malformed leaf fields without throwing", () => {
    const malformed = {
      kind: "WrongDocument",
      root: {
        kind: "Page",
        params: [],
        children: [{
          kind: "ZStack",
          params: [],
          children: [
            { kind: "MarkdownRef", ref: "" },
            { kind: "MarkdownInline", body: 42, syntheticId: null },
          ],
        }],
      },
    } as unknown as Document;
    expect(() => validateLml(malformed)).not.toThrow();
    expect(validateLml(malformed).filter((diagnostic) => diagnostic.severity === "error").length).toBeGreaterThanOrEqual(4);
  });
});

describe("host and page-axis sizing", () => {
  it("parses, validates and joins an explicit host root", () => {
    const layout = parseLml("host(align: center, justify: start) { page(w: 50%, h: 1fr) { md:a } }");
    expect(layout.root.kind).toBe("Host");
    expect(validateLml(layout).filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(parseAndJoin(
      "host(align: center, justify: start) { page(w: 50%, h: 1fr) { md:a } }",
      "# a\nbody",
    ).slide).toBeDefined();
  });

  it("preserves the legacy positive-integer CanvasSize shape and accepts every new axis form", () => {
    const doc = parseLml("host { page(w: 1440, h: 900) {} }");
    if (doc.root.kind !== "Host" || doc.root.children[0]?.kind !== "Page") throw new Error("host page expected");
    expect(doc.root.children[0].params).toContainEqual({ key: "w", value: { kind: "CanvasSize", value: 1440 } });
    expect(doc.root.children[0].params).toContainEqual({ key: "h", value: { kind: "CanvasSize", value: 900 } });

    for (const source of [
      "host { page(w: 0, h: 1.5) {} }",
      "host { page(w: 125%, h: 2fr) {} }",
      "host { page(w: fit, h: 640) {} }",
    ]) expect(() => parseLml(source)).not.toThrow();
  });

  it("requires valid Page identities for multiple pages and both axes under an explicit host", () => {
    for (const source of [
      "host {}",
      "host { page(w: 1fr, h: 1fr) {} page(w: 1fr, h: 1fr) {} }",
      "host { v {} }",
      "host { page(w: 1fr) {} }",
      "host { page(h: 1fr) {} }",
    ]) {
      expect(validateLml(parseLml(source))).toContainEqual(expect.objectContaining({ code: "E007" }));
    }
    expect(validateLml(parseLml("page {}"))).not.toContainEqual(expect.objectContaining({ code: "E007" }));
  });

  it("diagnoses malformed public Page metadata without throwing", () => {
    const malformed = {
      kind: "Document",
      root: { kind: "Page", ref: 42, params: [], children: [] },
    } as unknown as Document;
    expect(() => validateLml(malformed)).not.toThrow();
    expect(validateLml(malformed)).toContainEqual(expect.objectContaining({ code: "E006" }));
  });

  it("rejects host sizing params, unsupported placement values and nested host/page nodes", () => {
    for (const param of ["w: 10", "h: 10", "gap: 10", "pad: 10"]) {
      expect(validateLml(parseLml(`host(${param}) { page(w: 1fr, h: 1fr) {} }`)))
        .toContainEqual(expect.objectContaining({ code: "E005" }));
    }
    for (const source of [
      "host(align: stretch) { page(w: 1fr, h: 1fr) {} }",
      "host(justify: between) { page(w: 1fr, h: 1fr) {} }",
      "host(justify: around) { page(w: 1fr, h: 1fr) {} }",
    ]) expect(validateLml(parseLml(source))).toContainEqual(expect.objectContaining({ code: "E006" }));
    for (const source of [
      "page { host { page(w: 1fr, h: 1fr) {} } }",
      "host { page(w: 1fr, h: 1fr) { page {} } }",
    ]) expect(validateLml(parseLml(source))).toContainEqual(expect.objectContaining({ code: "E004" }));
  });

  it("accepts every supported host placement value and defaults", () => {
    for (const params of [
      "",
      "(align: leading, justify: start)",
      "(align: center, justify: center)",
      "(align: trailing, justify: end)",
    ]) {
      expect(validateLml(parseLml(`host${params} { page(w: 1fr, h: 1fr) {} }`))
        .filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    }
  });

  it("treats host as a reserved markdown reference", () => {
    expect(validateLml(parseLml("page { md:host }"))).toContainEqual(expect.objectContaining({ code: "E009" }));
  });

  it("propagates definite fixed/percent/fr axes and keeps fit axes indefinite", () => {
    for (const source of [
      "host { page(w: 50%, h: 1fr) { h(1fr) { md:a } } }",
      "host { page(w: 400.5, h: 300) { v(1fr) { md:a } } }",
    ]) expect(validateLml(parseLml(source)).filter((diagnostic) => diagnostic.code === "E006")).toEqual([]);

    expect(validateLml(parseLml("host { page(w: fit, h: 1fr) { h(1fr) { md:a } } }")))
      .toContainEqual(expect.objectContaining({ code: "E006" }));
    expect(validateLml(parseLml("host { page(w: 1fr, h: fit) { v(1fr) { md:a } } }")))
      .toContainEqual(expect.objectContaining({ code: "E006" }));
  });
});

describe("markdown block headings", () => {
  it("uses root-level ATX H1 references as boundaries and closes the final block at EOF", () => {
    expect(parseMarkdownBlocks("intro\n\n# a\n## Title\none\n\n  # b ###\ntwo").blocks).toEqual([
      { name: "a", body: "## Title\none" },
      { name: "b", body: "two" },
    ]);
  });

  it("does not retain the legacy colon-fence block syntax", () => {
    expect(parseMarkdownBlocks("::: legacy\nbody\n:::").blocks).toEqual([]);
  });

  it("removes an initial BOM, normalizes LF/CRLF/CR, and rejects duplicate blocks", () => {
    expect(parseMarkdownBlocks("\uFEFF# a\rone\r# b\r\n## Two\nbody").blocks).toEqual([
      { name: "a", body: "one" },
      { name: "b", body: "## Two\nbody" },
    ]);
    expect(() => parseMarkdownBlocks("# a\r\nx\r\n# a\r\ny")).toThrow(/Duplicate.*line 3/);
  });

  it("rejects malformed root ATX H1s and root Setext H1s", () => {
    for (const source of [
      "# a\n# Human title",
      "# a\n# 123",
      "# a\n# invalid.name",
      "# ",
      "# a\n   # Human title",
      "# a\nHuman title\n===",
      "Prelude\n=",
    ]) {
      expect(() => parseMarkdownBlocks(source)).toThrow(/Invalid root-level heading/);
    }
    expect(parseMarkdownBlocks("#foo\n# a\nbody").blocks[0].body).toBe("body");
    expect(parseMarkdownBlocks("# a\n## Two\n### Three\n#### Four\n##### Five\n###### Six").blocks[0].body)
      .toBe("## Two\n### Three\n#### Four\n##### Five\n###### Six");
  });

  it("only reserves root headings, preserving headings nested in Markdown containers", () => {
    expect(parseMarkdownBlocks("# a\n> # quoted\n\n- # listed").blocks[0].body)
      .toBe("> # quoted\n\n- # listed");
  });

  it("does not treat H1-like lines inside backtick or tilde fences as block boundaries", () => {
    const markdown = [
      "# code",
      "````md",
      "# fake_backtick",
      "~~~",
      "```",
      "# still_code",
      "````",
      "# prose",
      "~~~ text",
      "# fake_tilde",
      "```",
      "~~",
      "# still_tilde",
      "~~~~",
      "# final",
      "done",
    ].join("\n");

    expect(parseMarkdownBlocks(markdown).blocks.map(({ name, body }) => ({ name, body }))).toEqual([
      {
        name: "code",
        body: "````md\n# fake_backtick\n~~~\n```\n# still_code\n````",
      },
      {
        name: "prose",
        body: "~~~ text\n# fake_tilde\n```\n~~\n# still_tilde\n~~~~",
      },
      { name: "final", body: "done" },
    ]);
  });

  it("treats an unclosed Markdown code fence as extending to EOF", () => {
    expect(parseMarkdownBlocks("# a\n```md\n# not_a_block").blocks).toEqual([
      { name: "a", body: "```md\n# not_a_block" },
    ]);
  });

  it("preserves H1-like lines in every CommonMark raw HTML block category", () => {
    const htmlBlocks = [
      "<pre>\n# fake\n</pre>",
      "<!--\n# fake\n-->",
      "<?target\n# fake\n?>",
      "<!DECLARATION\n# fake\n>",
      "<![CDATA[\n# fake\n]]>",
      "<div>\n# fake\n</div>\n",
      "<x-widget data-id=example>\n# fake\n</x-widget>\n",
    ];

    for (const html of htmlBlocks) {
      const markdown = `# html\n${html}\n# after\ndone`;
      expect(parseMarkdownBlocks(markdown).blocks).toEqual([
        { name: "html", body: html.trimEnd() },
        { name: "after", body: "done" },
      ]);
    }
  });
});

describe("WYSIWYG LML-only contract", () => {
  it("parses and validates default LML without consulting MD", () => {
    const diagnostics = validateLml(parseLml(DEFAULT_LML));
    expect(diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  });

  it("keeps JSON version 1 readable", () => {
    expect(parseWysiwygDocument({ version: 1, lml: DEFAULT_LML, md: DEFAULT_MD })).toEqual({
      version: 1,
      lml: DEFAULT_LML,
      md: DEFAULT_MD,
    });
  });

  it("round-trips optional WYS page view state and rejects malformed variants", () => {
    expect(parseWysiwygDocument({
      version: 1,
      lml: DEFAULT_LML,
      md: DEFAULT_MD,
      view: { visiblePages: ["ref:a", "ref:a", "ref:b"], selectedPage: "ref:b" },
    })).toEqual({
      version: 1,
      lml: DEFAULT_LML,
      md: DEFAULT_MD,
      view: { visiblePages: ["ref:a", "ref:b"], selectedPage: "ref:b" },
    });
    expect(() => parseWysiwygDocument({ version: 1, lml: "", md: "", view: { visiblePages: "ref:a" } })).toThrow(/visiblePages/);
    expect(() => parseWysiwygDocument({ version: 1, lml: "", md: "", view: { visiblePages: [], selectedPage: 1 } })).toThrow(/selectedPage/);
    expect(parseWysiwygDocument({
      version: 1,
      lml: DEFAULT_LML,
      md: DEFAULT_MD,
      view: {
        visiblePages: ["ref:a"],
        hiddenNodes: [
          { key: "page:ref%3Aa|0", fingerprint: "a" },
          { key: "page:ref%3Aa|0", fingerprint: "b" },
        ],
      },
    }).view?.hiddenNodes).toEqual([{ key: "page:ref%3Aa|0", fingerprint: "b" }]);
    expect(() => parseWysiwygDocument({
      version: 1,
      lml: "",
      md: "",
      view: { visiblePages: [], hiddenNodes: [{ key: "x" }] },
    })).toThrow(/hiddenNodes/);
  });
});
