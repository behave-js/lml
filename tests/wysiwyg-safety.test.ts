import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Diagnostic, HostNode } from "../spec/ast.js";
import { geometryPreviewError } from "../wysiwyg/src/previewDiagnostics.js";
import { isPagePathVisible, resolveHostPage, resolveHostPages, visibilityStyleForPath } from "../wysiwyg/src/renderer/WireframeRenderer.js";

describe("WYSIWYG safety boundaries", () => {
  it("aliases only the layout API and keeps Markdown parsing out of the browser graph", () => {
    const viteConfig = readFileSync(new URL("../wysiwyg/vite.config.ts", import.meta.url), "utf8");
    const tsconfig = readFileSync(new URL("../wysiwyg/tsconfig.json", import.meta.url), "utf8");
    const vitestConfig = readFileSync(new URL("../vitest.config.ts", import.meta.url), "utf8");
    const layoutApi = readFileSync(new URL("../src/layout-api.ts", import.meta.url), "utf8");

    expect(viteConfig).toContain("../src/layout-api.ts");
    expect(tsconfig).toContain("../src/layout-api.ts");
    expect(vitestConfig).toContain("./src/layout-api.ts");
    for (const config of [viteConfig, tsconfig, vitestConfig]) {
      expect(config).not.toContain("src/index.ts");
    }
    expect(layoutApi).not.toMatch(/commonmark|parse-md|parseMarkdownBlocks/);
  });

  it("locks both Vite dev and preview servers to port 15111", () => {
    const viteConfig = readFileSync(new URL("../wysiwyg/vite.config.ts", import.meta.url), "utf8");
    expect(viteConfig.match(/port:\s*15111/g)).toHaveLength(2);
    expect(viteConfig.match(/strictPort:\s*true/g)).toHaveLength(2);
  });

  it("renders Markdown leaves as neutral anchors without previewing their bodies", () => {
    const app = readFileSync(new URL("../wysiwyg/src/App.tsx", import.meta.url), "utf8");
    const renderer = readFileSync(new URL("../wysiwyg/src/renderer/WireframeRenderer.tsx", import.meta.url), "utf8");

    expect(app).toMatch(/useLmlPreview\(lml\)/);
    expect(app).not.toMatch(/useLmlPreview\([^)]*\bmd\b/);
    expect(renderer).toContain("semantic anchor · MD 본문 미렌더");
    expect(renderer).toContain("semantic anchor · inline MD 미렌더");
    expect(renderer).not.toMatch(/safePreviewText|node\.body/);
    expect(app).toContain("LML geometry only");
    expect(app).not.toMatch(/<WireframeRenderer[^>]*\bmd=/);
  });

  it("uses non-destructive notices for failed JSON loads and exposes selection plumbing", () => {
    const app = readFileSync(new URL("../wysiwyg/src/App.tsx", import.meta.url), "utf8");
    const renderer = readFileSync(new URL("../wysiwyg/src/renderer/WireframeRenderer.tsx", import.meta.url), "utf8");
    expect(app).not.toMatch(/\balert\s*\(/);
    expect(app).toContain("현재 문서는 유지되었습니다.");
    expect(app).toContain("selectedPath={selectedPath}");
    expect(renderer).toContain("data-node-path");
    expect(renderer).toContain("onSelect?: (path: NodePath, node: Node) => void");
    expect(app).toContain('className="outline-node-toggle"');
    expect(app).toContain("event.stopPropagation()");
    expect(app).toContain("PageGalleryRenderer");
    expect(app).toContain('confirmDiscard(`${template.name} 예제를 불러오기`)');
    expect(app).toContain('setPageVisibility("all")');
    expect(app).toContain('setPageVisibility("selected")');
    expect(app).toContain('setPageVisibility("none")');
    expect(app).toContain("toggleOutlineNode(entry.visibilityKey)");
    expect(app).toContain("hiddenPaths={rendererHiddenPaths}");
    expect(renderer).toContain('visibility: "hidden"');
    expect(renderer).not.toContain('visibility: "visible"');
  });

  it("loads the store template from the canonical example pair without duplicating sources", () => {
    const templates = readFileSync(new URL("../wysiwyg/src/templates.ts", import.meta.url), "utf8");
    expect(templates).toContain('../../examples/06-store-flow/slide.lml?raw');
    expect(templates).toContain('../../examples/06-store-flow/slide.md?raw');
    expect(templates).toContain('id: "store-flow"');
    expect(templates).toContain('visiblePages: ["ref:catalog"]');
    expect(templates).toContain('selectedPage: "ref:catalog"');
    expect(templates).not.toMatch(/host\s*\(.*page\(md:catalog/s);
    expect(templates).not.toMatch(/# catalog\s/);
  });

  it("blocks geometry preview and preserves concrete semantic diagnostics", () => {
    const diagnostics: Diagnostic[] = [{
      severity: "error",
      code: "E007",
      message: "page under explicit host requires both w and h",
    }];
    expect(geometryPreviewError(null, diagnostics)).toBe(
      "[E007] page under explicit host requires both w and h",
    );
    expect(geometryPreviewError("Expected node", diagnostics)).toBe("Expected node");
    expect(geometryPreviewError(null, [])).toBeNull();
  });

  it("rejects malformed standalone Host rendering before page fallback sizing", () => {
    const empty: HostNode = { kind: "Host", params: [], children: [] };
    expect(resolveHostPage(empty)).toEqual({ error: "Host requires exactly one direct page or z child (E007)" });
    const extraChild: HostNode = {
      kind: "Host",
      params: [],
      children: [
        { kind: "Page", params: [], children: [] },
        { kind: "Page", params: [], children: [] },
      ],
    };
    expect(resolveHostPage(extraChild)).toEqual({ error: "Host requires exactly one direct page or z child (E007)" });

    const missingAxis: HostNode = {
      kind: "Host",
      params: [],
      children: [{ kind: "Page", params: [{ key: "w", value: { kind: "Fraction", value: 1 } }], children: [] }],
    };
    expect(resolveHostPage(missingAxis)).toEqual({ error: "Page under explicit host requires both w and h (E007)" });

    const valid: HostNode = {
      kind: "Host",
      params: [],
      children: [{
        kind: "Page",
        params: [
          { key: "w", value: { kind: "Fraction", value: 1 } },
          { key: "h", value: { kind: "Fraction", value: 1 } },
        ],
        children: [],
      }],
    };
    expect(resolveHostPage(valid)).toEqual({ page: valid.children[0] });
    const multi: HostNode = {
      kind: "Host",
      params: [],
      children: [
        { kind: "Page", ref: "one", params: valid.children[0].kind === "Page" ? valid.children[0].params : [], children: [] },
        { kind: "Page", ref: "two", params: valid.children[0].kind === "Page" ? valid.children[0].params : [], children: [] },
      ],
    };
    expect(resolveHostPages(multi)).toEqual(multi.children);

    const hostZ: HostNode = {
      kind: "Host",
      params: [],
      children: [{
        kind: "ZStack",
        params: [],
        children: [
          valid.children[0],
          { kind: "At", params: [], children: [{ kind: "MarkdownRef", ref: "badge" }] },
        ],
      }],
    };
    expect(resolveHostPage(hostZ)).toEqual({ page: valid.children[0], z: hostZ.children[0] });
  });

  it("decorates page bounds without consuming page geometry", () => {
    const css = readFileSync(new URL("../wysiwyg/src/styles.css", import.meta.url), "utf8");
    const pageRule = css.match(/\.wireframe-page\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(pageRule).toContain("outline: 1px solid #ccc");
    expect(pageRule).not.toMatch(/(^|\s)border\s*:/);
  });

  it("uses visibility:hidden rather than removing layout boxes", () => {
    expect(visibilityStyleForPath([0, 1], new Set(["0.1"]))).toEqual({ visibility: "hidden" });
    expect(visibilityStyleForPath([0, 2], new Set(["0.1"]))).toEqual({});
    const renderer = readFileSync(new URL("../wysiwyg/src/renderer/WireframeRenderer.tsx", import.meta.url), "utf8");
    expect(renderer).toContain("const hostVisibility = useVisibilityStyle([])");
    expect(renderer).not.toContain("display: \"none\"");
    expect(renderer).not.toContain('visibility: "visible"');
  });

  it("filters hidden Pages instead of applying non-Page visibility styling", () => {
    expect(isPagePathVisible([0], new Set(["0"]))).toBe(false);
    expect(isPagePathVisible([1], new Set(["0"]))).toBe(true);
    const renderer = readFileSync(new URL("../wysiwyg/src/renderer/WireframeRenderer.tsx", import.meta.url), "utf8");
    expect(renderer).toContain("pages.filter((entry) => isPagePathVisible(entry.path, hiddenPathKeys))");
    expect(renderer).toContain("pages[0] && !isPagePathVisible(pages[0].path, hiddenPathKeys)");
    const pageFrame = renderer.slice(renderer.indexOf("function PageFrame"), renderer.indexOf("function PageView"));
    expect(pageFrame).not.toContain("useVisibilityStyle");
  });

});
