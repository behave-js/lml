# LML v0.1 AST Reference

Type definitions: [`spec/ast.ts`](../../spec/ast.ts)  
Grammar: [`grammar.ebnf`](grammar.ebnf) · Semantics: [`semantic-spec.md`](semantic-spec.md) · Premises: [`../design-premises.md`](../design-premises.md)

---

## 1. Overview

LML AST는 **slide-body layout tree**를 표현한다. Markdown `#` blocks는 **같은 slide 설계**의 다른 층으로, layout 규칙·조건·동작·콘텐츠를 담는다 ([design-premises](../design-premises.md)).

WYSIWYG live pipeline은 LML AST만 compile·validate·wireframe 한다. MD AST는 editor 보존·handoff·설계 완성에 쓰인다.

```
.lml  ──parse──▶  Document ──validateLml──▶ valid layout
.md   ──parse──▶  MarkdownDocument

Document + MarkdownDocument ──optional association──▶ ResolvedSlide
```

| Layer | AST type | Role |
|-------|----------|------|
| Parse output | `Document` | LML layout tree |
| MD parse | `MarkdownDocument` | `# name` blocks |
| Optional association output | `ResolvedSlide` | reference-resolved layout/MD handoff; rendered slide가 아님 |

설계 전제: SwiftUI layout·semantic(스타일 제외) ≈ LML tree + MD blocks. WYSIWYG preview는 LML subset만 즉시 렌더한다.

---

## 2. Node Hierarchy

```
Document
└─ root: Node                       validator accepts Host or legacy Page (E004)
   └─ ContainerNode | LeafNode
      ├─ HostNode                    kind: "Host"
      ├─ PageNode                    kind: "Page"
      ├─ VStackNode                  kind: "VStack"   + dimensions?
      ├─ HStackNode                  kind: "HStack"   + dimensions?
      ├─ ZStackNode                  kind: "ZStack"
      ├─ AtNode                      kind: "At"
      ├─ GridNode                    kind: "Grid"
      ├─ MarkdownRefNode             kind: "MarkdownRef"
      ├─ MarkdownInlineNode          kind: "MarkdownInline"
      └─ SpacerNode                  kind: "Spacer"
```

### 2.1 `kind` discriminator

모든 node는 string literal `kind` 필드로 구분한다 (TypeScript discriminated union).

```typescript
type Node =
  | HostNode | PageNode | VStackNode | HStackNode | ZStackNode | AtNode | GridNode
  | MarkdownRefNode | MarkdownInlineNode | SpacerNode;
```

---

## 3. Container Nodes

공통 shape:

```typescript
interface ContainerBase {
  params: readonly Param[];
  children: readonly Node[];
}
```

### 3.1 `HostNode`

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `"Host"` | explicit semantic root |
| `params` | `Param[]` | `align`, `justify` placement only |
| `children` | `Node[]` | one or more direct Pages, or exactly one Host-Z (`ZStackNode`) |

Host 자체 크기는 AST에 저장하지 않는다. 환경의 actual available size를 받는다.
Host-Z는 정확히 한 direct Page와 0개 이상의 direct At만 가지며, Page의 w/h는 필수다.

### 3.2 `PageNode`

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `"Page"` | |
| `ref` | `string?` | `page(md:name, ...)` semantic description anchor; AST metadata, not a Param/child |
| `params` | `Param[]` | `w`, `h`, `pad` (`PageAxisSize` for w/h) |
| `children` | `Node[]` | 0–1 child (2+ → E007) |

Host에 direct Page가 2개 이상이면 각 `ref`가 필수이며 Page끼리 유일해야 한다. 단일 direct Page, Host-Z의 단일 Page, legacy Page root에서는 선택 사항이다.

### 3.3 `VStackNode` / `HStackNode`

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `"VStack"` \| `"HStack"` | |
| `params` | `Param[]` | `gap`, `pad`, `align`, `justify` |
| `dimensions` | `Dimension[]?` | positional args; len === children.len |
| `children` | `Node[]` | |

```typescript
// h(2fr, 1fr, gap: 16) { md:main md:aside }
{
  kind: "HStack",
  dimensions: [
    { kind: "Fraction", value: 2 },
    { kind: "Fraction", value: 1 },
  ],
  params: [{ key: "gap", value: 16 }],
  children: [
    { kind: "MarkdownRef", ref: "main" },
    { kind: "MarkdownRef", ref: "aside" },
  ],
}
```

### 3.4 `ZStackNode`

| Field | Type | Notes |
|-------|------|-------|
| `params` | `Param[]` | `pad` only; other params → E005 |
| `children` | `Node[]` | first = bottom, last = top |

### 3.5 `AtNode`

```typescript
interface AtNode extends ContainerBase {
  kind: "At";
  params: readonly AtParam[];
  children: readonly Node[]; // validator: exactly one
}

type AtOffset = FixedDimension | PercentDimension;
type AtSize = FixedDimension | PercentDimension | FitDimension;
type AtParam =
  | { key: "top" | "bottom" | "left" | "right"; value: AtOffset }
  | { key: "w" | "h"; value: AtSize };
```

At은 ZStack의 direct child이며 가장 가까운 Z content box를 containing block으로 사용한다. 숫자 source는 Page와 달리 항상 Fixed다. Edge pair without size는 축을 derive하고, edge pair plus same-axis size는 E006이다. `children`은 정확히 하나여야 한다(E007).

### 3.6 `GridNode`

| Field | Type | Notes |
|-------|------|-------|
| `params` | `Param[]` | `cols`* , `rows`, `gap`, `pad` |
| `children` | `Node[]` | row-major order |

`cols` param value:

```typescript
type TrackSpec =
  | { kind: "TrackCount"; count: 3 }           // cols: 3
  | { kind: "TrackList"; tracks: Dimension[] }; // cols: 1fr 2fr 1fr
```

---

## 4. Leaf Nodes

### 4.1 `MarkdownRefNode`

```lml
md:title
```

```typescript
{ kind: "MarkdownRef", ref: "title" }
```

- LML 영역과 `MarkdownDocument.blocks`의 설명을 잇는 semantic anchor이며 자동 콘텐츠 주입 명령이 아님
- 선택적 association 단계에서만 `ref` 이름으로 매칭; 미해결 → E001, 중복 anchor → E002
- `validateLml`, geometry measurement, WYSIWYG preview는 MD block이나 body를 읽지 않음

### 4.2 `MarkdownInlineNode`

```lml
md """
## Revenue
**$42M**
"""
```

```typescript
{
  kind: "MarkdownInline",
  body: "## Revenue\n**$42M**",
  syntheticId: "_inline_1",
}
```

- `.md` 파일 association은 하지 않고 body를 가까운 위치에 보존
- `body`는 AI/handoff 문맥이며 자동 렌더·측정·WYSIWYG preview 입력이 아님

### 4.3 `SpacerNode`

```lml
space
space(2fr)
```

```typescript
{ kind: "Spacer" }
{ kind: "Spacer", dimension: { kind: "Fraction", value: 2 } }
```

- 부모 positional dims **없음** + bare `space` → implicit `1fr`
- 부모 positional dims **없음** + `space(dimension)` → explicit dimension
- v0.1: **direct child of `v`/`h` only** (else E006)
- 부모 positional dims **있음** + bare `space` → parent child slot
- 부모 positional dims **있음** + `space(dimension)` → E006
- cross-axis는 부모 `align` 값과 무관하게 항상 stretch

---

## 5. Dimensions

```typescript
type Dimension =
  | { kind: "Fixed"; value: number }      // 240
  | { kind: "Percent"; value: number }  // 30
  | { kind: "Fraction"; value: number }   // 2  (from "2fr")
  | { kind: "Fit" };

type CanvasSize = { kind: "CanvasSize"; value: number };  // page w/h positive safe integer only
type PageAxisSize = CanvasSize | Dimension;
```

| Source | AST |
|--------|-----|
| `240` | `{ kind: "Fixed", value: 240 }` |
| `30%` | `{ kind: "Percent", value: 30 }` |
| `2fr` | `{ kind: "Fraction", value: 2 }` |
| `fit` | `{ kind: "Fit" }` |

Page axis source의 positive integer는 기존 `CanvasSize` shape를 유지한다. `0`/decimal numeric은 `Fixed`, suffixed `%`/`fr`와 `fit`은 해당 Dimension shape를 사용한다.

AtNode의 좁은 `AtParam` w/h는 `AtSize`로 제한된다. 따라서 At의 positive integer도 Fixed이고 Fraction/CanvasSize는 parser에서 거부되며, 직접 구성한 잘못된 AST는 validator E006이다.

---

## 6. Parameters

```typescript
type Param =
  | { key: "gap"; value: number }
  | { key: "pad"; value: Spacing }
  | { key: "align"; value: AlignValue }
  | { key: "justify"; value: JustifyValue }
  | { key: "w"; value: PageAxisSize }
  | { key: "h"; value: PageAxisSize }
  | { key: "top"; value: AtOffset }
  | { key: "bottom"; value: AtOffset }
  | { key: "left"; value: AtOffset }
  | { key: "right"; value: AtOffset }
  | { key: "cols"; value: TrackSpec }
  | { key: "rows"; value: TrackSpec };
```

### 6.1 Spacing (pad)

```typescript
type Spacing =
  | [number]                    // all sides
  | [number, number]            // vertical, horizontal
  | [number, number, number]    // top, horizontal, bottom
  | [number, number, number, number]; // top, right, bottom, left
```

TrackCount와 TrackList length의 semantic maximum은 `MAX_TRACK_COUNT = 10_000`이다. 빈 grid에서 `rows`가 생략되면 resolved implicit row list도 비어 있다.

모든 spacing 값과 `gap`은 finite non-negative number이다. 직접 구성한 AST도 validator가 같은 계약을 적용한다.

예: `pad: 16 24` → `{ key: "pad", value: [16, 24] }`

### 6.2 Align / Justify

```typescript
type AlignValue =
  | "leading" | "center" | "trailing" | "stretch";

type JustifyValue =
  | "start" | "center" | "end" | "between" | "around";
```

---

## 7. Source Locations

```typescript
interface SourceSpan {
  start: Position;  // line, column, offset
  end: Position;
}

interface Located<T> {
  node: T;
  span: SourceSpan;
}
```

- Parser는 `Located<Node>` 형태로 span 부여 권장
- LML validation과 optional association diagnostics에 `span` 포함 가능 (E001–E009, W001)

---

## 8. Markdown AST (companion file)

```typescript
interface MarkdownBlock {
  name: string;
  body: string;
  span?: SourceSpan;
}

interface MarkdownDocument {
  kind: "MarkdownDocument";
  blocks: readonly MarkdownBlock[];
}
```

각 `MarkdownBlock`은 Markdown root의 `# name` ATX heading 다음 줄부터 다음 root block heading 직전 또는 EOF까지를 `body`로 가진다. CommonMark의 0–3칸 들여쓰기와 closing `#`을 수용한다. Root H1은 block 식별자 전용이므로 body의 제목은 `##`부터 사용하고 root Setext H1은 거부한다. fenced code, raw HTML, block quote, list 안의 H1 모양 줄은 경계가 아니며, 첫 block 전의 일반 preamble은 무시한다. 입력 시작 BOM 제거와 LF/CRLF/CR의 LF 정규화를 수행하며, 과거 `::: name ... :::` 구문은 parsing하지 않는다.

**Design roles (normative vocabulary):** `body`는 자유 prose이나, layout·semantic 설계는 [semantic-spec §3.5–§3.12](semantic-spec.md#35-md-block-roles-design-vocabulary)의 role별 패턴(`min-width:`, `layout-presence:`, `scrollport:`, `layout-variant:`, `behavior:`, …)으로 기록한다. v0.1 MD parser는 role 키를 **구조적으로 파싱하지 않음** — association·lint·구현 도구가 body를 해석한다.

### Join model

아래 이름은 API 호환성을 위해 유지한다. `ResolvedSlide`는 화면 렌더가 끝난 slide가 아니라 optional **reference-resolved association**이다.

```typescript
interface BoundMarkdown {
  ref: string;
  body: string;
}

interface ResolvedSlide {
  kind: "ResolvedSlide";
  layout: Document;
  bindings: ReadonlyMap<string, BoundMarkdown>;
}
```

Optional association algorithm (informative):

1. Walk the layout and collect both `PageNode.ref` metadata and `MarkdownRefNode.ref` leaf values
2. When a Page and a leaf use the same ref, treat them as one shared semantic association; repeated leaf refs remain E002
3. Validate multi-Page identity separately: duplicate direct-Page refs are validator E002
4. For each effective ref, lookup the Markdown block by name → missing E001
5. Report MD blocks not used by either Page metadata or a leaf as W001
6. Build one `ResolvedSlide.bindings` entry per effective ref as semantic handoff data

`MarkdownInlineNode`는 bindings에 **포함하지 않음**. Page/leaf가 같은 ref를 공유해도 `bindings`는 ref-keyed `Map`이므로 하나의 binding만 생성한다.

이 utility는 MD body의 화면 배치, layout fit, overflow 또는 렌더링 방식을 결정하지 않는다.

---

## 9. Diagnostics

```typescript
interface Diagnostic {
  severity: "error" | "warning";
  code: DiagnosticCode;
  message: string;
  span?: SourceSpan;
}
```

| Code | When |
|------|------|
| E001 | `PageNode.ref` 또는 `MarkdownRefNode.ref`가 optional association에서 unresolved |
| E002 | Duplicate leaf `MarkdownRefNode.ref` in optional association, 또는 duplicate direct-Page `PageNode.ref` in multi-Page validation |
| E003 | `dimensions.length !== children.length` |
| E004 | Root ≠ Host/Page; invalid nested Host/Page; At not directly under Z |
| E005 | Unknown / disallowed param for node kind |
| E006 | Invalid dimension; `0fr`; stack/grid fr/% without definite axis; invalid/overconstrained At geometry; spacer/grid violations |
| E007 | Missing required param/ref / invalid multi-Page or Host-Z shape / explicit-host Page missing w/h / Page or At child-count violation |
| E008 | Duplicate named parameter |
| E009 | Reserved `md:name` |
| W001 | MD block never referenced in optional association |

---

## 10. Full Example

### Source

```lml
page(pad: 40) {
    v(gap: 24) {
        md:header
        h(2fr, 1fr, gap: 16) {
            md:main
            md:aside
        }
    }
}
```

### AST (JSON)

```json
{
  "kind": "Document",
  "root": {
    "kind": "Page",
    "params": [{ "key": "pad", "value": [40] }],
    "children": [
      {
        "kind": "VStack",
        "params": [{ "key": "gap", "value": 24 }],
        "children": [
          { "kind": "MarkdownRef", "ref": "header" },
          {
            "kind": "HStack",
            "dimensions": [
              { "kind": "Fraction", "value": 2 },
              { "kind": "Fraction", "value": 1 }
            ],
            "params": [{ "key": "gap", "value": 16 }],
            "children": [
              { "kind": "MarkdownRef", "ref": "main" },
              { "kind": "MarkdownRef", "ref": "aside" }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## 11. Utilities (spec/ast.ts)

| Export | Purpose |
|--------|---------|
| `isContainerNode` | Type guard |
| `isLeafNode` | Type guard |
| `isStackNode` | VStack \| HStack guard |
| `isMarkdownRef` / `isMarkdownInline` | Markdown guards |
| `walkAst` | Depth-first pre-order traversal |
| `getParam` | Find named param by key |
| `trackSpecCount` | `cols: 3` → 3; `cols: 1fr 2fr` → 2 |
| `expandTrackSpec` | `cols: 3` → `[1fr, 1fr, 1fr]` |
| `resolveGridRowTracks` | implicit rows → `repeat(n, 1fr)` |
| `DEFAULT_SPACER_DIMENSION` | `{ kind: "Fraction", value: 1 }` |
| `MAX_TRACK_COUNT` | Per-axis semantic resource bound (`10_000`) |

---

## 12. Design Decisions

| Decision | Rationale |
|----------|-----------|
| `dimensions` on stack nodes, not on children | Positional args belong to container (grammar §4.3) |
| `MarkdownRef` / `MarkdownInline` separate kinds | External block association과 inline context 보존 방식이 다름 |
| `TrackCount` vs `TrackList` | Preserve source form; expand at layout time |
| `AtParam` contextual subset | Preserve shared w/h API while excluding CanvasSize/Fraction from absolute geometry |
| `Spacing` as fixed-length tuple | Type-safe 1–4 value pad shorthand |
| `readonly` on AST fields | AST is immutable after parse |
| No style/theme in AST | LML = geometry only; MD = layout rules + content (semantic-spec §10 style non-goals) |

---

## 13. Planned AST extensions (informative — §12)



v0.1 `spec/ast.ts`에는 **없음**. [semantic-spec §12](semantic-spec.md#12-planned-lml-constructs-design-language) 도입 시 추가 예정.



| Planned node / type | `kind` | Notes |
|---------------------|--------|-------|
| `ScrollNode` | `"Scroll"` | `axis`, `pad`; single scrollport |
| `FrameNode` | `"Frame"` | wrapper; `min-w`/`max-w`/`min-h`/`max-h` params |
| `StickyNode` | `"Sticky"` | `edge: top \| bottom`; scroll ancestor link |
| `WhenNode` | `"When"` | `ref: string`; conditional single child |
| `TransformNode` | `"Transform"` | `mode`, `min`, `max`, `step`, `origin` |
| `SpanNode` | `"Span"` | grid span wrapper; `cols`/`rows` count |
| `MinMaxDimension` | dimension kind | `{ kind: "MinMax", min, max }` on tracks / frame |

Planned stack/page params extend `Param` union with constraint keys (`min-w`, `max-w`, …). Validator rules mirror §12 semantics and MD equivalence.

---

*Version: 0.1-draft*  
*Status: Step 3 of 4*
