# LML v0.1 Grammar Reference

Formal grammar: [`grammar.ebnf`](grammar.ebnf)  
Semantics: [`semantic-spec.md`](semantic-spec.md)  
Design premises: [`../design-premises.md`](../design-premises.md)

---

## 1. Overview

LML v0.1 grammar는 **의도적으로 작은 syntax subset**이다.  
**Design premise:** SwiftUI에서 스타일을 제외한 layout·semantic은 **LML + MD**로 문서화 가능해야 한다. v0.1에 없는 capability는 [grammar backlog](semantic-spec.md#grammar-backlog-v01-syntax-미구현--design-premisesmd-parity-대상) + [§3.5–§3.12 MD vocabulary](semantic-spec.md#35-md-block-roles-design-vocabulary) + [§12 planned LML](semantic-spec.md#12-planned-lml-constructs-design-language)이지 설계 불가가 아니다.

| Category | Constructs |
|----------|------------|
| Containers (v0.1) | `host`, `page`, `v`, `h`, `z`, `at`, `grid` |
| Leaves (v0.1) | `md`, `space` |
| Planned (§12) | `scroll`, `frame`, `sticky`, `when`, `transform`, `span`, `minmax` track |
| Args | positional `dimension`, named `key: value` |

**Root rule:** grammar `document = node`; validator accepts explicit `host` or legacy `page` roots (E004 otherwise).

---

## 2. Lexical Structure

### 2.1 Whitespace

Space, tab, CR, LF는 토큰 구분자로 **무시**한다.  
레이아웃 가독성을 위해 자유롭게 사용 가능.

```lml
h(2fr,1fr,gap:16){md:a md:b}
```

### 2.2 Comments

```lml
// line comment until end of line
```

블록 주석은 v0.1 **미지원**.

### 2.3 Identifiers

```
identifier ::= ident_start ident_continue*
ident_start ::= [A-Za-z_]
ident_continue ::= [A-Za-z0-9_-]
```

예: `title`, `main`, `kpi1`, `page-number`

### 2.4 Numbers

```
number            ::= integer ('.' integer)?
integer           ::= [0-9]+
positive_integer  ::= [1-9][0-9]*
```

예: `40`, `1920`, `16.5`. `.5`, `1.`, non-finite 값은 허용하지 않는다. `track_count`/`cols: N`에는 원문이 **positive_integer**인 토큰만 사용한다 (`0`, `03`, `3.0`, `3.5` → parse error).

### 2.5 Keywords

**Node-start keywords** (grammar `node` 시작 lexeme):

```
host   page   v   h   z   at   grid   md   space
```

> `md`, `space`는 container가 **아님** (leaf). 위 목록은 **parser**가 block context에서 node-start keyword로 해석하는 lexeme 집합 (lexer는 context-free).

**Sizing keywords**:

```
fit   fr   %
```

**Named-arg keys** (parser가 arg list context에서 인식; 별도 lexer token type **없음** — `gap`/`h` 등은 context에 따라 param key 또는 node-start):

```
gap   pad   align   justify   w   h   top   bottom   left   right   cols   rows
```

**Align values** (v0.1 — four values; axis determines interpretation):

```
leading   center   trailing   stretch
```

**Justify values**:

```
start   center   end   between   around
```

> Keywords는 node/값 위치에서만 reserved.  
> `md:header`의 `header`는 identifier이며 keyword가 아니다.

### 2.6 String literals

Inline Markdown context/notes:

```lml
md """
## Revenue
**$42M**
"""
```

- 구분자: triple double-quote `"""`
- v0.1: escape **미지원** — literal `"""` inside body 불가
- body는 AI/handoff 문맥용 raw string으로 AST에 저장하며 LML이 자동 렌더하거나 측정하지 않음 (semantic-spec §3.2)

### 2.7 Operators / punctuation

```
{ } ( ) , : @
```

`at`은 node keyword이고, `@` 문자는 향후 anchor 확장을 위한 별도 `AT_SIGN` token으로만 예약되어 현재 grammar에는 포함되지 않는다.

---

## 3. Tokenization

### 3.1 Token list

| Token | Pattern | Example |
|-------|---------|---------|
| `HOST` | `host` | host |
| `PAGE` | `page` | page |
| `VSTACK` | `v` | v |
| `HSTACK` | `h` | h |
| `ZSTACK` | `z` | z |
| `AT` | `at` | at |
| `GRID` | `grid` | grid |
| `MD` | `md` | md |
| `SPACE_KW` | `space` | space |
| `FIT` | `fit` | fit |
| `IDENT` | identifier | title |
| `NUMBER` | number | 240 |
| `FR` | number? `fr` | 2fr, fr |
| `PERCENT` | number `%` | 30% |
| `STRING` | `"""` … `"""` | |
| `AT_SIGN` | `@` | future reserved |
| `{` `}` `(` `)` `,` `:` | punctuation | |

### 3.2 Multi-char tokens (longest match)

```
240     → NUMBER
2fr     → FR(2)
fr      → FR(1)
30%     → PERCENT(30)
md:title → MD + COLON + ref_name token   (see §3.3)
```

**FR token:** `number? "fr"` — `fr` → Fraction(1), `2fr` → Fraction(2), `1.5fr` → Fraction(1.5)

### 3.3 `md:` disambiguation

`md:title`에서 `:`는 **semantic-anchor operator** (named Markdown content/notes와 연결할 ref).

`gap: 16`에서 `:`는 **named param bind**.

Rule:

```
after token MD     → COLON + ref_name token  (semantic anchor; never param bind)
in arg list        → key ":" value  (key = named-arg lexeme, e.g. gap, h, align)
at block level     → node-start keyword → container / leaf
```

`md` 다음 `:`는 항상 semantic-anchor operator다. MD body 자동 주입이나 렌더 명령을 뜻하지 않는다.

**Lexer는 context-free:** `h`/`gap`/`center` 등은 위치 무관 단일 token (`h`, `ident`, …). 별도 `PARAM_KEY`/`HSTACK` 이중 분류 **없음**.  
**Parser가 context-aware:** block level `h` → HStack; arg list `h: 1080` → page height param; `align: center` vs `justify: center` value disambiguation.

### 3.4 `space` vs `SPACE_KW`

`space` alone → spacer leaf node.  
`space(2fr)` → spacer with dimension.  
`space`는 container keyword가 **아님**.

---

## 4. Syntax Rules (informative)

### 4.1 Document

```ebnf
document = node ;   (* validator: root must be host or legacy page → E004 *)
```

### 4.2 Containers & blocks

```lml
page(w: 1920, h: 1080, pad: 40) {
    v(gap: 24) {
        md:header
        h(2fr, 1fr, gap: 16) {
            md:main
            md:aside
        }
    }
}
```

```ebnf
host        = "host" host_args? block ;
page        = "page" page_args? block ;
block       = "{" node* "}" ;
node        = container | markdown | spacer ;
container   = host | page | vstack | hstack | zstack | at | grid ;
at          = "at" at_args block ;
```

### 4.3 Argument lists

Positional dimensions과 named params **혼합 가능**, **순서 무관**:

```lml
h(2fr, 1fr, gap: 16)
h(gap: 16, 2fr, 1fr)
h(align: leading, 1fr, 1fr)
```

```ebnf
arg_list = "(" arg ( "," arg )* ")" ;
arg      = dimension                    (* positional *)
         | param_key ":" param_value ;  (* named *)
host_args = "(" named_arg ( "," named_arg )* ")" ;
page_args = "(" ( page_ref ( "," named_arg )* | named_arg ( "," named_arg )* ) ")" ;
page_ref  = "md" ":" ref_name ;  (* optional Page metadata; first only *)
at_args   = "(" ( at_arg ( "," at_arg )* )? ")" ;
at_arg    = ( "top" | "bottom" | "left" | "right" ) ":" ( NUMBER | PERCENT )
          | ( "w" | "h" ) ":" ( NUMBER | PERCENT | FIT ) ;
```

`host`, `page`, `at`은 positional dimension을 받지 않는다. Page의 optional `md:ref` metadata는 첫 argument로만 올 수 있고 이후 named args와 comma로 구분한다. `at`은 괄호가 필수지만 `at()`은 허용한다. Stack의 `arg_list`에서만 positional/named 혼합이 가능하다.

**Comma:** arg 구분에만 사용.  
`pad: 16 24`처럼 value 내부는 **whitespace** 구분 (comma 아님).

### 4.4 Grid args

v0.1 grid는 **named args only**:

```lml
grid(cols: 3, gap: 16) { ... }
grid(cols: 1fr 2fr 1fr, gap: 16) { ... }
grid(cols: 3, rows: 2, pad: 12) { ... }
```

```ebnf
grid_args = "(" named_arg ( "," named_arg )* ")" ;
```

`cols` required (semantic validation, E007 if missing).

Single-row equal columns in an indefinite-height parent slot: see [semantic-spec §4.5](semantic-spec.md) (*Authoring — single-row equal columns*); `h(1fr, …)` when implicit-row `grid` would E006.

### 4.5 Param values

| Param | Value type | Example |
|-------|------------|---------|
| `gap` | number | `gap: 16` |
| `pad` | spacing_list | `pad: 16 24` |
| `align` | align_value | `align: leading`; Host는 leading/center/trailing만 |
| `justify` | justify_value | `justify: between`; Host는 start/center/end만 |
| `w`, `h` | page_axis_size (page only) | `w: 1920`, `w: 0`, `w: 3.5`, `w: 50%`, `w: 1fr`, `w: fit` |
| At `top`, `bottom`, `left`, `right` | NUMBER \| PERCENT | `top: 24`, `right: 5%` |
| At `w`, `h` | NUMBER \| PERCENT \| FIT | `w: 180`, `h: fit` |
| `cols`, `rows` | integer \| track_list | `cols: 3`, `cols: 1fr 2fr 1fr` |

```ebnf
spacing_list = number | number number | number number number | number number number number ;
track_list   = dimension ( dimension )* ;
track_count  = positive_integer ;
track_spec   = track_count | track_list ;
```

**cols/rows precedence:** single bare lexical **`positive_integer`** → **`track_count` always** (never a lone fixed track); `cols: 240` = 240 columns, not width 240. Numeric-leading multi-token forms (`cols: 240 1fr`, `rows: 120 fit`) and suffixed forms are `track_list`; `03`, `3.0`, `3.5` as a lone value are parse errors.

Track list의 각 dimension token은 whitespace 또는 `//` comment/newline으로 분리해야 한다. `1fr2fr`, `1%2fr`처럼 인접한 token은 parse error다. 일반 괄호 argument list는 하나 이상 필요하므로 `host()`, `page()`, `v()`, `grid()`는 parse error다. `at()`만 zero-param 예외이며 `at` 뒤 괄호 자체는 필수다.

### 4.6 Dimensions

```ebnf
dimension = NUMBER | FR | PERCENT | FIT ;
canvas_size = positive_integer ;   (* legacy AST-preserving page w/h source form *)
page_axis_size = canvas_size | dimension ;
```

| Form | AST kind |
|------|----------|
| `240` | Fixed |
| `30%` | Percent |
| `2fr` | Fraction |
| `fit` | Fit |

**Page numeric precedence:** lexical `positive_integer`는 하위 호환을 위해 `CanvasSize` AST를 emit한다. 그 밖의 numeric (`0`, leading-zero, decimal)은 `Fixed`; `%`/`fr`/`fit`은 기존 Dimension AST를 사용한다. Explicit Host 아래 Page는 semantic validation에서 w/h 둘 다 필요하고, legacy Page root는 생략 가능하다.

**At numeric precedence:** 모든 NUMBER는 lexical form과 무관하게 `Fixed`를 emit한다. edge는 Fixed/Percent, size는 Fixed/Percent/Fit만 허용하며 Fraction/CanvasSize는 유효하지 않다.

### 4.6.1 Host

```lml
host(align: center, justify: start) {
  page(w: 50%, h: 1fr) { ... }
}
```

Host는 named args만 사용하며 size params는 없다. Validator가 한 개 이상의 direct Page 또는 정확히 하나의 `z { Page At* }`, explicit Page의 w/h, `align`의 leading/center/trailing, `justify`의 start/center/end를 강제한다. Direct Page가 2개 이상이면 각 `page(md:ref, ...)` ref는 필수이며 Page끼리 유일해야 한다. 단일 Page/Host-Z/legacy root의 ref는 선택 사항이다. `host()`는 parse error다.

### 4.6.2 Absolute `at`

```lml
z(pad: 16) {
  at(top: 24, right: 24, w: 180) { md:badge }
}
```

At은 반드시 Z의 direct child이고 정확히 한 Node를 갖는다. `left+right` without `w` 및 `top+bottom` without `h`는 containing Z content box에서 derive/stretch한다. 같은 축의 edge pair와 explicit size를 함께 주면 E006이다. At은 flow/`fr` 분배에서 제외되며 source order가 layer 순서다.

### 4.7 Markdown leaves

```lml
md:title

md """
## Hello
"""
```

```ebnf
markdown = "md" ":" ref_name
         | "md" string_literal ;
ref_name = identifier ;   (* parser accepts keyword lexemes; E009 if reserved *)
```

- `{ ... }` 불가 (leaf)
- named form → layout 영역과 별도 MD block을 잇는 semantic anchor; `validateLml`/measurement/WYSIWYG는 MD body를 읽지 않음
- inline string → AI/handoff 문맥으로 보존하고 synthetic id 부여 (implementation: `_inline_1`, …); external association 단계 skip
- 두 form 모두 고정 자동 렌더 규칙이 없으며, AI가 LML과 MD를 함께 읽고 화면·발표자 노트·분석·동작 요구로의 사용을 판단

### 4.8 Spacer

```lml
space
space(2fr)
```

```ebnf
spacer = "space" | "space" "(" dimension ")" ;
```

v0.1 semantic: **`space` valid only as direct child of `v` or `h`** (else E006).

---

## 5. Validation (post-parse)

Grammar가 허용하지만 semantic validation에서 걸러지는 경우:

| Check | Code |
|-------|------|
| Root ≠ host/page, invalid nested Host/Page, or At not directly under Z | E004 |
| positional dim count ≠ child count (`v`,`h`) | E003 |
| Unknown param key for node type | E005 |
| Invalid dimension / spacing value; `0fr`; `fr`/`%` without definite main-axis | E006 |
| At invalid unit or same-axis edge-pair plus explicit size | E006 |
| `cols: 0`, `rows: 0`, `cols: 3.5` | parse error |
| `space` not direct child of `v`/`h` | E006 |
| `space(dimension)` when parent stack has positional dims | E006 |
| Grid fr/% column or row without definite width/height | E006 |
| Grid child count exceeds cell capacity | E006 |
| Disallowed param (e.g. `z(gap:8)`, `page(gap:8)`) | E005 |
| Missing required param/Page ref; invalid multi-Page/Host-Z shape; Page/At child-count violation | E007 |
| Duplicate Page `md:ref` in a multi-page Host | E002 |
| Duplicate named param | E008 |
| Reserved `md:name` | E009 |

`validateLml`은 MD 파일 없이 위 geometry/structure 규칙만 검사한다. 선택적 association utility를 호출할 때에만 unresolved `md:name`은 E001, duplicate `md:name` anchor는 E002, unused MD block은 W001로 보고한다. 이 diagnostics는 WYSIWYG layout validity가 아니다.

### 5.1 Per-node allowed params

| Node | Positional dims | Named params |
|------|-----------------|--------------|
| `host` | — | `align`, `justify`; one or more Pages or one valid Host-Z child |
| `page` | — | optional first `md:ref` metadata; `w`, `h`, `pad` only; **0–1 child** |
| `v`, `h` | optional per-child | `gap`, `pad`, `align`, `justify` |
| `z` | — | `pad` only |
| `at` | — | `top`, `bottom`, `left`, `right`, `w`, `h`; exactly one child; direct child of Z |
| `grid` | — | `cols`* , `rows`, `gap`, `pad` |

\* `cols` semantically required.

---

## 6. Parse Tree Shape

AST types: [`ast.md`](ast.md) · [`spec/ast.ts`](../../spec/ast.ts)

```
Document
└─ root: Node                    validator accepts Host or legacy Page (E004)

HostNode                 →  { params, children: PageNode[] | [host ZStackNode] }
PageNode                 →  { ref?: string, params, children }
VStackNode | HStackNode  →  dimensions?: Dimension[]
ZStackNode               →  { params, children }
AtNode                   →  { params: AtParam[], children: [Node] }
GridNode                 →  { params, children }
MarkdownRefNode          →  { ref: string }
MarkdownInlineNode       →  { body, syntheticId }
SpacerNode               →  { dimension? }
```

---

## 7. Grammar Examples

### 7.1 Minimal slide

```lml
page {
    md:body
}
```

### 7.2 Full composition

```lml
// Market overview slide
page(pad: 40) {
    v(gap: 24) {
        md:header

        h(2fr, 1fr, gap: 20, align: leading) {
            md:analysis

            v(gap: 16) {
                md:insight

                h(1fr, 1fr, gap: 12) {
                    md:cagr
                    md:margin
                }

                md:commentary
            }
        }
    }
}
```

### 7.3 Grid + spacer + inline md

```lml
page(pad: 32) {
    v(gap: 20) {
        h {
            md:logo
            space(2fr)
            md:date
        }

        grid(cols: 1fr 1fr 1fr, gap: 16) {
            md """
            ### A
            **1**
            """
            md:kpi_b
            md:kpi_c
        }
    }
}
```

### 7.4 Overlay

```lml
page {
    z {
        md:background
        md:foreground
    }
}
```

---

## 8. Planned LML constructs (design language — not in v0.1 grammar)

Normative semantics: [semantic-spec §12](semantic-spec.md#12-planned-lml-constructs-design-language).  
MD 설계 어휘: [semantic-spec §3.5–§3.12](semantic-spec.md#35-md-block-roles-design-vocabulary).  
v0.1 `grammar.ebnf`에는 **포함되지 않음**. parser 미구현 시 MD로 동등 기록.

| Construct | Example sketch | SwiftUI |
|-----------|----------------|---------|
| `scroll` | `scroll(axis: vertical) { md:tree }` | `ScrollView` |
| `frame` | `frame(min-w: 280, max-w: 340) { md:x }` | `.frame(min:max:)` |
| `minmax` track | `h(minmax(240, 320), 1fr) { ... }` | flexible track |
| `sticky` | `sticky(edge: top) { md:hdr }` | pinned header |
| `when` | `when(notice) { md:notice }` | `@ViewBuilder if` |
| `transform` | `transform(mode: scale, min: 25%, max: 200%) { ... }` | `.scaleEffect` |
| `span` | `span(cols: 2) { md:wide }` | `GridItem(.span)` |

Reserved keywords (future lexer): `scroll`, `frame`, `sticky`, `when`, `transform`, `span`, `minmax`.

```ebnf
(* planned — not in grammar.ebnf v0.1 *)
scroll       = "scroll" scroll_args block ;
frame        = "frame" frame_args block ;
sticky       = "sticky" sticky_args block ;
when         = "when" "(" ref_name ")" block ;
transform    = "transform" transform_args block ;
span         = "span" span_args block ;
minmax_dimension = "minmax" "(" dimension "," dimension ")" ;
```

Multi-`page` variant artboards는 **이미 v0.1** `host { page(md:a) ... page(md:b) ... }`로 기록 가능. Breakpoint 선택은 MD `layout-variant`(§3.9).

### 8.1 Future `@` anchor (reserved)

```ebnf
anchor_expr = "@" anchor ;
anchor      = anchor_v anchor_h | anchor_h anchor_v ;
anchor_v    = "top" | "middle" | "bottom" ;
anchor_h    = "leading" | "center" | "trailing" ;
```

Lexer `AT_SIGN` token reserved; grammar v0.1 **미포함**.

---

## 9. Implementation Notes

### 9.1 Suggested parser strategy

1. **Lexer** — context-free token stream  
2. **Recursive descent** — `parseNode()`, `parseArgList()`  
3. **AST builder** — separate positional dims from named params  
4. **Validator** — semantic-spec §9 checks  

### 9.2 Error recovery

v0.1: fail-fast (first error stops parse).  
에러 메시지에 line/column 포함 권장.

### 9.3 Test vectors

| Input | Expected |
|-------|----------|
| `page { md:a }` | OK |
| `v { md:a }` | parse OK, validate E004 |
| `page { h(1fr) { md:a md:b } }` | E003 |
| `page { md:missing }` | parse + `validateLml` OK; optional association에서 E001 |
| `page { z(gap: 8) { md:a } }` | parse OK, E005 |
| `page { md:a md:b }` | E007 |
| `grid(gap: 8) { md:a }` | E007 (missing cols) |
| `h(gap: 10, gap: 20) { md:a }` | E008 |
| `md:page` | E009 |
| `grid(cols: 3)` | TrackCount(3), not TrackList |
| `page { z { at(top: 8, right: 5%) { md:a } } }` | OK; At edge AST = Fixed/Percent |
| `page { z { at(left: 0, right: 0, w: 20) { md:a } } }` | E006 |
| `host { z { page(w: 960, h: 540) {} at() { md:a } } }` | OK |

---

*Version: 0.1-draft*  
*Status: Step 3 of 4*
