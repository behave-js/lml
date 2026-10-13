**Language:** [한국어](README.md) | **English**

# LML — Layout Markup Language

LML is a small, text-based format for describing UI and slide **layout geometry**, paired with Markdown for content and design intent. It is useful for sketching layouts, comparing artboards, and handing a layout specification to an AI assistant or developer.

**Status:** v0.1, an experimental but usable layout-notation project. It is not a React/SwiftUI component framework or a production UI renderer.

## The idea

- **LML (`slide.lml`):** instantiated layout tree — regions, nesting, order, columns, spacing, sizing, and overlays.
- **Markdown (`slide.md`):** named content and semantics, interactions, responsive/conditional rules, and implementation notes.
- **Implementation:** React, SwiftUI, CSS, etc. can interpret the paired specification; visual styling is intentionally left to the implementer.

The pair `LML + MD` is the design specification. `md:name` is a **semantic anchor** that connects an LML slot with a Markdown `# name` block; it is not an instruction to automatically render Markdown in the preview.

## Example

`slide.lml`:

```lml
page(w: 1280, h: 720, pad: 32) {
    v(gap: 24) {
        md:header
        h(2fr, 1fr, gap: 20) {
            md:main
            md:sidebar
        }
    }
}
```

`slide.md`:

```md
# header
## Project overview

# main
## Main content
Present the primary information here.

# sidebar
## Details
Supporting information and actions.

layout-variant:
  - Wide: main/sidebar use two columns.
  - Narrow: stack main above sidebar.
```

The LML describes the nominal layout. Markdown can specify responsive transitions and constraints that are not encoded in the v0.1 LML grammar.

## Try it locally

```bash
npm install
npm run wysiwyg
```

The browser-based workbench provides an LML source editor, geometry validation, and a wireframe preview. Its **preview only renders LML geometry**; Markdown remains editable as design/handoff context and does not automatically appear in the preview.

To run checks and build the TypeScript package:

```bash
npm test
npm run build
npm run test:package
```

The local package exports `parseLml`, `validateLml`, `parseMarkdownBlocks`, and `joinSlide` for programmatic use. These are parsing, checking, and optional reference-association utilities, not a full renderer.

## What v0.1 covers

- `host`, `page`, vertical `v`, horizontal `h`, overlay `z`, absolute `at`, and `grid`
- `md:ref`, inline Markdown notes, and `space`
- Fixed dimensions, percentages, `fr`, `fit`, gaps, padding, and alignment
- Multiple page/artboard sketches; semantic or behavior differences documented in MD

**Intentional boundary:** not every responsive or dynamic layout rule has direct LML syntax. State changes, scroll/sticky roles, breakpoints, min/max constraints, and interactions can be described in Markdown. See the design premises and semantic specification for the precise contract.

## Explore the repository

- [Nine LML + Markdown example pairs](examples/README.md) — slides, dashboards, commerce flow, mobile screens, and desktop UI sketches
- [Workbench user guide](wysiwyg/README.md)
- [Design premises](docs/design-premises.md)
- [v0.1 grammar](docs/v0.1/grammar.md) and [formal EBNF](docs/v0.1/grammar.ebnf)
- [v0.1 semantic specification](docs/v0.1/semantic-spec.md) and [AST](docs/v0.1/ast.md)

## License

MIT — see [LICENSE](LICENSE).
