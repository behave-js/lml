# LML v0.1 Semantic Specification

Design premises (SwiftUI parity, LML+MD roles): [`../design-premises.md`](../design-premises.md)

**Layout Markup Language** — slide-body geometry와 paired MD가 함께 layout·semantic 설계를 이룬다.



| Layer | Role |

|-------|------|

| **LML** | slide body geometry — 블록 간 공간 관계, 칸 배치, track |

| **Markdown** | 콘텐츠, layout 규칙(min/max·breakpoint·scroll·조건), 동작·상태·전환, 발표자 노트 — **§3.5–§3.12** |

| **Implementation** | LML+MD 설계를 따름. **스타일**만 자유 |

| **Planned LML syntax** | §12 — parser 미구현 capability의 normative geometry surface |



> **Design premise:** SwiftUI에서 **스타일을 제외한** layout·semantic 표현은 **LML + MD**로 동등하게 문서화할 수 있어야 한다. v0.1 grammar는 이 전제의 **부분 구현**이다.

> **WYSIWYG runtime:** live preview·validation·wireframe 입력은 **LML geometry만** 사용한다. MD는 editor에 보존되지만 preview 측정에는 참여하지 않는다. 설계 완전성 전제와 모순되지 않는다.

> **Semantic anchor:** `md:ref`는 LML 영역과 MD 설명을 잇는 anchor다. MD body가 wireframe에 자동 주입되거나 LML `fit` 측정에 쓰이지 **않는다** (runtime). 설계 문서로서 MD에 layout·동작을 적는 것은 **필수**다.

> LML은 `18.4%`가 KPI인지 **알지 못한다**. 콘텐츠 의미·비즈니스 규칙은 MD에 둔다.



---



## 1. Scope (v0.1)



### In scope



| Category | Items |

|----------|-------|

| Containers | `host`, `page`, `v`, `h`, `z`, `at`, `grid` |

| Leaves | `md`, `space` |

| Sizing | numeric, `%`, `fr`, `fit` |

| Spacing | `gap`, `pad` |

| Alignment | `align`, `justify` |

| Page sizing | `page` width / height (`CanvasSize`, fixed, `%`, `fr`, `fit`) |
| Absolute positioning | `at(...)` direct children of `z` |



### Grammar backlog (v0.1 syntax 미구현 — [design-premises](../design-premises.md) parity 대상)



다음은 **설계에서 제외되는 항목이 아니다.** v0.1 LML **parser**에 아직 없거나, **MD 설계 블록**(§3.5–§3.12)으로만 기록 중인 capability다. **Normative semantics**는 §12; **MD 설계 어휘**는 §3.5–§3.12.



| Capability | SwiftUI / CSS | v0.1 LML parser | 설계 기록 |
|------------|---------------|-----------------|-----------|
| min/max frame | `.frame(min:max:)` | 미구현 | §3.6 MD; §12.2 `frame` / `minmax` |
| conditional layout | `@ViewBuilder if` | 미구현 | §3.7 MD; §12.5 `when` (optional) |
| scroll container | `ScrollView` | 미구현 | §3.8 MD; §12.1 `scroll` |
| sticky / inset | pinned header | 미구현 | §3.8 MD; §12.3 `sticky` |
| breakpoint variant | Environment / `ViewThatFits` | 미구현 | §3.9 MD; multi-`page` |
| transform / zoom | `.scaleEffect` | slot only | §3.10 MD; §12.7 `transform` |
| grid cell span | `GridItem.span` | 미구현 | §12.8 |
| `fill` keyword | — | use `1fr` | — |
| animation curves | decorative motion | — | §10 (style) |



### Out of design doc (style — 구현 자유)



- Style properties (`color`, `font-family`, decorative `background`, `box-shadow`, …)

- Pixel-perfect visual theme



### Runtime-only (설계 문서가 아닌 구현)



- MD body의 WYSIWYG wireframe 자동 주입·LML `fit` intrinsic 측정·live overflow 처리



---



## 2. Document Model



하나의 **slide** (또는 page)는 다음 두 파일로 구성된다.



```

slide.lml    — layout tree

slide.md     — markdown content blocks

```



두 파일은 하나가 다른 하나를 자동 렌더하는 관계가 아니다. `md:title`은 LML 영역과 MD 설명을 잇는 **semantic anchor**이며, AI 또는 후속 구현 도구가 두 파일을 함께 해석할 때 문맥 연결점으로 사용한다.

코어의 `joinSlide` / `parseAndJoin`은 이름 대응을 확인하는 선택적 association·lint·handoff utility다. 결과는 렌더 완료된 slide가 아니며 WYSIWYG의 필수 pipeline에도 포함되지 않는다.



```

LML md:title  ──semantic anchor──▶  MD # title ... (next H1 or EOF)

LML + MD ──AI judgment──▶ screen / speaker notes / analysis / behavior requirements

```



### 2.1 Root rule



- LML document의 semantic root는 explicit **`host`** 또는 legacy **`page`**이다. Page root는 implicit host 안의 page로 해석한다.

- Grammar는 `document = node` — parser는 어떤 node든 syntax tree로 받는다.

- `host`/`page` 외의 node가 root이면 **validator E004** (parse error 아님). Nested `host`는 E004이다. Nested `page`는 direct Host Page들과 Host-Z의 유일한 direct base Page만 예외다.



```lml

v { md:a }   // parse OK → validate E004

```



### 2.2 File pairing



| 규칙 | 설명 |

|------|------|

| Default pairing | 같은 basename — `report.lml` + `report.md` |

| Explicit association | AI/handoff/lint 도구 설정으로 md 경로 지정 가능 (v0.1 구현 선택) |



---



## 3. Markdown Semantic Anchors



### 3.1 Named reference



```lml

md:title

```



- `title`은 **ref_name** — grammar상 identifier; parser는 keyword lexeme도 수용 (reserved → E009)

- **Reserved names forbidden** — LML keyword·param·align/justify value와 동일한 이름 불가 (E009)

- `md:title`은 MD body를 해당 영역에 자동 삽입하라는 명령이 아니다. LML geometry 영역과 MD의 실제 콘텐츠/노트 설명을 연결하는 semantic anchor다.

- Markdown 쪽 대응 블록:



```md

# title

## Market Overview

```

Markdown document root의 ATX H1 `# ref_name`이 named block을 시작한다. CommonMark가 허용하는 0–3칸 들여쓰기와 선택적 closing `#`을 수용하며, heading의 실제 content인 `ref_name`은 `[A-Za-z_][A-Za-z0-9_-]*` 형식이어야 한다. 시작 H1 자체는 block body에 포함하지 않고, 다음 root H1 직전 또는 EOF까지를 body로 추출한다. 닫는 표식은 없다.

- H1은 block 식별자 전용이다. 블록 콘텐츠의 제목은 `##`부터 `######`까지 사용한다.
- root-level ATX H1이 `# ref_name` 형식에 맞지 않거나 root-level Setext H1을 사용하면 Markdown parser error이다. 예를 들어 `# Human Title`, `# 123`은 콘텐츠 H1로 허용하지 않는다.
- 첫 block 전의 H1이 아닌 일반 preamble은 무시한다. `#foo`는 ATX H1이 아니므로 block 경계도 아니다.
- backtick/tilde fenced code block과 CommonMark raw HTML block(type 1–7) 안의 `# ...` 줄은 block 경계로 해석하지 않는다. 닫히지 않은 코드 펜스는 Markdown 규칙대로 EOF까지 계속된다. block quote나 list 등 container 안의 H1도 root block 경계가 아니다.
- 입력 시작의 UTF-8 BOM은 제거하며 LF, CRLF, CR line ending은 내부적으로 LF로 정규화한다.

> 이 형식은 과거의 `::: name ... :::` 구문을 대체하는 breaking format이다. `:::` 형식에 대한 하위 호환 parsing은 제공하지 않는다.



### 3.2 Inline reference



```lml

md """

## Revenue

**$42M**

"""

```



- named reference와 **동일한 semantic-anchor leaf node** (`MarkdownNode`)로 취급한다.

- inline body는 파서가 추출하여 AST에 literal string으로 저장하지만, 자동 렌더·측정·WYSIWYG preview 대상으로 삼지 않는다.

- v0.1 권장: 슬라이드 단위 문서에서는 **named reference 우선**, inline은 가까운 위치에 AI/handoff 문맥을 두는 보조 형식이다.



### 3.3 Binding rules

다음 규칙은 선택적으로 `joinSlide` / `parseAndJoin` association utility를 호출할 때만 적용한다. `validateLml`과 WYSIWYG의 LML layout validity는 MD 파일의 존재나 일치 여부에 의존하지 않는다.



| 상황 | v0.1 동작 |

|------|-----------|

| `md:name`에 대응하는 `# name` 블록 없음 | **Error** — `E001: unresolved markdown reference 'name'` |

| `# name` 블록이 LML에서 참조되지 않음 | **Warning** — `W001: unused markdown block 'name'` |

| leaf `md:name`을 association 대상으로 두 번 이상 참조 (Page와 leaf가 같은 이름을 공유하는 경우 제외) | **Error** — `E002: duplicate markdown reference 'name'` (optional association) |

| multi-page Host에서 direct Page `md:ref` 중복 | **Error** — `E002: duplicate markdown reference 'name'` (`validateLml`) |

| `md:name`이 reserved name | **Error** — `E009: reserved markdown reference 'name'` |

| 동일 `# name`을 MD에 두 번 정의 | **Error** — Markdown parser error |

| 잘못된 root-level ATX H1 또는 root-level Setext H1 | **Error** — Markdown parser error |



> 선택적 association 결과는 이름 기준 1:1 대응을 사용한다. 이는 MD body의 자동 화면 주입이나 렌더 계약을 뜻하지 않는다.

`page(md:name, ...)`의 `name`도 Page 자체를 설명하는 semantic reference로 association 대상이다. 같은 Page 내부의 leaf `md:name`이 같은 블록을 공유하는 것은 허용하며 중복 참조로 보지 않는다. Page ref와 leaf ref의 이름을 분리하는 편이 문서 의미는 더 명확하다.

**Cross-page leaf ref (E002):** 문서 전체에서 같은 leaf `md:name`을 두 번 이상 쓰면 optional association에서 **E002**다 (위 표). Page metadata `md:ref`와 같은 Page 내부 leaf `md:name`이 동일 `#` 블록을 공유하는 경우만 제외.

**Authoring — distinct refs per slot (enforce unchanged):** 동일 semantic copy·동작을 여러 Page artboard 또는 geometry slot에 둘 때는 **LML anchor·`# name`을 slot/Page마다 다르게** 둔다 (예: [`06-store-flow`](../../examples/06-store-flow/) `catalog_brand` / `detail_brand`; [`07-nourish`](../../examples/07-nourish/) `card_brand` / `ring_brand`). MD body는 반복하거나 prose로 baseline을 cross-reference 한다. 1:1 association 계약(위 표)은 바꾸지 않는다.

**Slot identity (E002 rationale):** leaf `md:ref`는 **geometry slot identity**다 — ref 하나 ↔ LML anchor 하나 ↔ optional association에서 `# name` 하나. domain entity(예: brand) singleton ID가 아니다. cross-page·cross-slot에 같은 copy를 쓰려면 **distinct ref 이름**(예: `brand__today_card_macros`, `card_brand`)과 별도 `#` block(또는 body cross-ref)을 쓴다. leaf ref 중복·ref alias·multi-anchor binding으로 E002를 완화하지 **않는다** — join 1:1, outline/selection identity, slot-level behavior, Page+leaf 예외(위) 경계에 **연쇄 영향**이 있어 단순 규칙 완화가 아님.

**Figma-class markup (design-premises §0):** LML은 Figma **layer instance tree**에 가깝다. “이 subtree는 저 subtree와 같다”는 **MD 동일성**(`structure-note`, baseline cross-ref)으로 적고, LML ref alias로 표현하지 않는다. Figma component·구현 reusable component와 동일 개념이 **아니다**.



### 3.4 Runtime vs design (MD)



**Design (normative):** paired MD는 layout·semantic **설계**를 기록한다. [design-premises](../design-premises.md) — SwiftUI layout·semantic(스타일 제외)과 동등해야 한다.

**Runtime (WYSIWYG v0.1):** MD body는 LML slot에 자동 배치되지 않으며 `fit` 측정·overflow·wireframe render 입력이 **아니다**. 이는 preview engine subset이며 설계 완전성을 부정하지 않는다.

AI·구현이 MD를 화면 콘텐츠로 선택한 경우의 typography·장식적 clipping은 **스타일/구현 자유**다. layout·semantic으로 요구된 영역·규칙·조건·동작은 구현이 **반드시** 따른다.



### 3.5 MD block roles (design vocabulary)



각 `# ref_name` 블록은 LML `md:ref_name` slot과 연결된다. 하나의 ref는 아래 역할을 **조합**할 수 있다.



| Role | SwiftUI (informative) | MD에 기록하는 layout·semantic |

|------|----------------------|------------------------------|

| **content** | `Text`, label, icon glyph | 표시 텍스트·콘텐츠 의미 |

| **layout-constraint** | `.frame(minWidth:maxWidth:)` | min/max width·height, preferred·clamp track |

| **layout-condition** | `@ViewBuilder if` | slot·row·Page artboard의 presence/absence 조건 |

| **scrollport** | `ScrollView`, `List` | 독립 scroll 축, scroll container 경계 |

| **sticky** | pinned header, `safeAreaInset` | viewport/sticky target, scroll container 안에서 고정 |

| **layout-variant** | `@Environment sizeClass`, `ViewThatFits` | breakpoint·size class별 layout 선택 |

| **transform** | `.scaleEffect`, zoom gesture | scale 범위, stage/content 측정 관계 |

| **behavior** | `Button`, navigation, `@State` | tap·shortcut·state transition·validation |

| **structure-note** | (documentation) | DOM/sibling 순서 등 LML tree와 구현 tree 대응 |



**Normative rule:** SwiftUI에서 스타일을 제외하고 layout·semantic에 해당하는 항목은 **반드시** LML geometry **또는** 위 MD role로 `slide.md`에 적는다. v0.1 parser가 모르는 LML syntax는 §12 planned constructs 또는 MD role로 **먼저** 기록한다.

**Enforced vs vocabulary:** Role 라벨(`behavior:`, `layout-variant:`, `structure-note:`, `min-width:` 등)과 §3.6–§3.12 본문 패턴은 설계 **어휘 힌트**다. v0.1 Markdown parser·`joinSlide`는 role prefix·본문 키를 **파싱·검증하지 않는다**. MD에서 machine-enforced association 규칙은 **§3.3 binding**(E001/E002/W001)뿐이다. Role 조합·분리는 author convention이며, 위 normative rule(기록 의무)과 별개다.



### 3.6 Layout constraints (`layout-constraint`)



SwiftUI `.frame(minWidth:maxWidth:minHeight:maxHeight:)` 및 CSS `minmax()`에 대응.



**MD normative patterns** (slot `# ref` body 예):



```md
# sidebar
## Inspector
min-width: 250px
max-width: 290px
min-height: 145px
```



```md
# source_column
layout-width: minmax(280px, 340px)
```



```md
# outline_section
layout-height: max 42% of sidebar
```



**Rules:**

- 단위: `px`, `%`, `fr` 의미는 LML sizing(§5)과 동일하게 해석한다.
- `minmax(A, B)`는 **track 또는 node box**에 적용 가능; parent definite axis 필요 규칙은 LML과 같다.
- LML track이 nominal value만 가질 때(예: `340`) MD constraint가 **authoritative** min/max이다.
- §12 `frame(...)` LML syntax 도입 시 MD constraint와 **동일 semantic**이어야 하며 중복 시 **일치**해야 한다 (lint 대상).



### 3.7 Conditional layout (`layout-condition`)



SwiftUI `@ViewBuilder if`, optional child, empty state에 대응.



**MD normative patterns:**



```md
# notice
layout-presence: when noticeMessage != null
layout-absence: collapse; workbench receives remaining height
```



```md
# preview_canvas
layout-variant:
  - when previewError: show preview_invalid
  - when layoutRoot && visiblePages.isEmpty: show preview_no_pages
  - when layoutRoot: show preview_gallery
  - else: show preview_empty
```



**Rules:**

- 조건은 **layout tree 변경**(row/slot/artboard presence)을 기술한다. 스타일 전환만은 §10.
- LML에 slot이 **항상** 있고 runtime에 숨기는 경우: MD에 `layout-presence` + `visibility: hidden preserves geometry` (WYSIWYG view state) vs `layout-absence: remove row` (설계상 tree 변경)를 **구분**해 적는다.
- variant artboard는 `page(md:workbench-compact)` 등 **별도 Page** + MD `layout-variant: when width < 980px use ref:workbench-compact`로 기록 가능.



### 3.8 Scroll and sticky (`scrollport`, `sticky`)



SwiftUI `ScrollView`, `List`, pinned section header, `safeAreaInset`에 대응.



**MD normative patterns:**



```md
# outline_tree
scrollport: vertical
scroll-boundary: outline_section
overflow: clip
```



```md
# outline_panel
sticky: top of outline_section
scroll-container: outline_section
```



```md
# diagnostics_panel
scrollport: vertical
flex: 1 within sidebar
```



**Rules:**

- **scrollport** — 어느 subtree가 독립 scroll 축을 갖는지.
- **sticky** — 어떤 heading/toolbar가 어떤 scroll container 안에서 고정되는지.
- §12 `scroll { }` LML container는 동일 semantic의 geometry 표현이다.



### 3.9 Layout variants and breakpoints (`layout-variant`)



SwiftUI `@Environment(\.horizontalSizeClass)`, `ViewThatFits`, compact/regular layout에 대응.



**MD normative patterns:**



```md
# workbench
layout-variant:
  - default: page ref workbench (w >= 980px)
  - compact: page ref workbench-compact (680px <= w < 980px)
  - narrow: page ref workbench-narrow (w < 680px)
```



Host·Page artboard **여러 장** + MD breakpoint table이 **정식** variant 표현이다. 단일 `page` LML만으로 breakpoint geometry를 담을 때는 MD variant 규칙이 **필수**다.



**Rules:**

- breakpoint는 width/height threshold 또는 size class 이름으로 적는다.
- variant마다 **전체 layout tree** 또는 **delta**를 명시한다. delta만 적을 때는 base ref를 명시한다.
- CSS `@media` 규칙은 MD `layout-variant`에 **그대로** 옮긴다 (스타일 변경 제외).



### 3.10 Transform and zoom (`transform`)



SwiftUI `.scaleEffect`, magnify gesture, inverse stage sizing에 대응.



**MD normative patterns:**



```md
# preview_zoom
transform: scale content
scale-range: 25% .. 200%
scale-step: 10%
scale-origin: top left
stage-sizing: inverse of scale (content layout size preserved)
```



**Rules:**

- zoom **control region**은 LML slot; **측정·stage 동작**은 MD `transform` role.
- layout-affecting transform만 기록. decorative animation curve는 §10.



### 3.11 Behavior, state, and navigation (`behavior`)



SwiftUI `Button` action, `@State`, `@Binding`, navigation path에 대응. 예제 06 store-flow MD 패턴을 normative로 승격.



**MD normative patterns:**



```md
# save_action
behavior: on activate → save JSON v1 document
shortcut: Ctrl/Cmd+S
state: dirty → enabled
```



```md
# catalog_product_lamp
behavior: on select → selectedProduct = lamp; navigate to page product_detail
```



**Rules:**

- **state variables**, **transitions**, **guards**, **side effects**를 prose 또는 pseudo-code로 적는다.
- Page `md:ref` 전환은 `navigate to page <ref>` 형식을 권장한다.
- validation failure·empty cart 등 **layout-presence**와 연계 시 §3.7과 같은 블록에 적거나 cross-reference 한다.



### 3.12 Structure notes (`structure-note`)



LML geometry tree와 구현 DOM이 sibling/nesting만 다를 때 (예: header가 `page` 안 vs `workbench` 밖):



```md
# workbench
structure-note: App DOM places app-header as sibling above main.workbench; this LML artboard inlines header as v(52) row for single-page sketch. Layout regions map 1:1; parent chain differs.
```



**Rule:** region·칸·순서·constraint는 **동일**해야 한다. parent chain 차이는 structure-note로만 허용.

**Multi-page layout exploration (not §3.9 breakpoint):** Host 아래 named Page artboard 여러 개가 **동일 baseline data**에 대해 layout 탐색안만 다를 때, 각 Page `# ref` body에 `structure-note:`로 baseline 공유·탐색 범위를 적는다. §3.9 `layout-variant`는 breakpoint/size class용이며 artboard layout exploration과 **다른 개념**이다. Shared baseline용 orphan `# block`(LML 미참조)은 두지 않는다 — optional association에서 **W001**.



---



## 4. Node Semantics

### 4.0 `host`

```lml
host(align: center, justify: start) {
    page(md:catalog, w: 50%, h: 1fr, pad: 16) { ... }
    page(md:cart, w: 50%, h: 1fr, pad: 16) { ... }
}
```

`host`는 환경이 제공하는 실제 available width/height를 받는 최상위 경계다. LML 안에서 host 크기를 지정하지 않으며 `w`, `h`, `gap`, `pad`는 E005이다. Host shape는 (a) 한 개 이상의 direct Page 또는 (b) 정확히 하나의 Host-Z compatibility `z` 중 하나다. Direct Page와 Host-Z 안의 base Page는 `w`와 `h`를 모두 명시해야 한다(E007). Direct Page가 2개 이상이면 모든 Page에 유일한 `md:ref`가 필요하다.

- `align`: page의 horizontal placement — `leading`(default), `center`, `trailing`; `stretch`는 E006.
- `justify`: page의 vertical placement — `start`(default), `center`, `end`; `between`/`around`는 E006.
- `%`는 page의 size만 결정한다. Host보다 작은 page의 위치는 위 placement 값이 별도로 결정한다.
- Host의 종류, 크기 측정, breakpoint 검사는 LML 범위 밖이다. Host는 page를 임의 축소하지 않으며 fixed 또는 100% 초과 geometry의 overflow를 보존한다.
- Host-Z form은 `host { z { page(w: ..., h: ...) { ... } at(...) { ... } } }`이다. 이 `z`에는 정확히 하나의 direct Page와 0개 이상의 direct At만 허용된다. Host placement는 base Page에 적용되고 `z`는 host를 채우며, At은 host content box 기준이다. Page를 먼저 선언하는 것을 권장한다.
- 여러 direct Page는 서로 겹치는 layer가 아니라 독립 screen/artboard 정의다. 화면 전환과 상태 변화는 MD가 설명하며 LML의 고정 `visible` 속성으로 저장하지 않는다.



### 4.1 `page`



상위 host의 2D 제약을 받는 top-level 2D layout container.



```lml

page(md:catalog, w: 1920, h: 1080, pad: 40) {

    v(gap: 24) { ... }

}

```



| Param | Type | Default | Meaning |

|-------|------|---------|---------|

| `w` | `PageAxisSize` | explicit host에서 required; legacy renderer fallback | page width |

| `h` | `PageAxisSize` | explicit host에서 required; legacy renderer fallback | page height |

| `pad` | spacing | `0` | inner padding (§6) |

`md:catalog`은 named parameter가 아니라 PageNode의 optional `ref` metadata다. 사용할 경우 page argument list의 첫 항목이어야 하며 Page body child나 geometry slot을 만들지 않는다. 다중 direct Page에서는 필수·유일하고, 단일 Page에서는 하위 호환을 위해 생략할 수 있다.



- **Direct children: 0 or 1.** 2개 이상 → **E007**.

- `page`는 최상위 layout container이지만 여러 형제를 배치하는 flow container는 **아님**. `gap`, `align`, `justify` **미지원** (E005).

- `w`/`h`는 fixed numeric, `%`, `fr`, `fit`을 축별로 독립 지원한다. Positive-integer source는 legacy `CanvasSize`; `0`, decimal numeric은 `Fixed` AST를 만든다.
- Direct child는 raw canvas가 아니라 **page content box** 2D proposal을 받는다 (§5.3.0).
- Fixed `0`은 유효하다. 음수 source는 숫자 grammar에 없고, 직접 구성한 음수 Fixed AST는 validator E006이다.

#### 4.1.1 Page sizing philosophy

`page`는 외부와 단절된 고립 논리 캔버스를 기본 가정으로 삼지 않는다. 모니터, 브라우저, 검사 도구 등 **상위 host가 제안한 width/height 제약**을 받는 최상위 레이아웃 컨테이너이며, 그 제약 안에서 content box와 하위 레이아웃을 계산한다. 어떤 종류의 host가 제약을 만들고 언제 바꾸는지는 LML의 범위가 아니다. 이 원칙은 LML, 현재 WYSIWYG 또는 별도의 반응형 검사 도구에 breakpoint 탐지나 host 제어 같은 새 책임을 부여하지 않는다.

개념적으로 `page`의 `w`와 `h`는 `v`/`h` 등 기존 레이어의 sizing 원칙을 각 축에 독립적으로 적용한다. 이를 위해 `responsive: true` 같은 page 전용 boolean이나 별도의 반응형 모드를 발명하지 않는다.

- 사용자가 특정 축에 fixed target-space size를 명시하면 그 숫자를 정확히 사용한다. 예를 들어 `page(w: 1440, h: 900)`은 유효하며 정확히 1440 × 900의 fixed page이다.
- 사용자가 한 축을 명시하지 않았다면 그 축에 임의의 fixed 숫자를 의미 값으로 발명하지 않는다. 다만 생략 자체도 반응형 선언, breakpoint opt-in 또는 특정 sizing mode를 뜻하지 않는다. 그 축의 실제 제약은 host proposal과 해당 도구가 명시한 지원 범위에서 결정된다.
- Markdown 콘텐츠의 측정·서식·overflow 렌더링은 이 page sizing 철학의 대상이 아니다. 이 절은 레이아웃 제약과 축 sizing만 정의한다.

#### 4.1.2 Legacy compatibility / known gap

Legacy Page-root 문서는 계속 유효하며 implicit host로 해석한다. 이 경우에만 `w`/`h` 생략을 허용하고, 현재 WYSIWYG의 renderer default는 host proposal이 없는 preview를 위한 호환 fallback이다. 또한 legacy Page-root preview만 implicit host placement를 `align: center`, `justify: start`로 적용한다. 이는 기존 preview 호환을 위한 예외이며 explicit Host의 기본값 `align: leading`, `justify: start`를 변경하지 않는다. 이 fallback과 placement 예외는 LML 문서가 선언한 fixed size나 반응형 opt-in이 아니다. Explicit Host 아래에서는 이 gap을 숨기지 않도록 두 축을 모두 요구한다.



### 4.2 `v` — vertical stack



자식을 위→아래로 배치한다. main axis = vertical, cross axis = horizontal.



```lml

v(gap: 16, pad: 24, align: leading) {

    md:header

    md:body

}

```



| Param | Default |

|-------|---------|

| `gap` | `0` |

| `pad` | `0` |

| `align` | `leading` (cross = horizontal) |

| `justify` | `start` (main = vertical) |



**Dimensions (optional):** positional args로 각 자식의 main-axis size 지정.



```lml

v(1fr, fit, 2fr) {

    md:a

    md:b

    md:c

}

```



### 4.3 `h` — horizontal stack



자식을 좌→우로 배치한다. main axis = horizontal, cross axis = vertical.



```lml

h(2fr, 1fr, gap: 20, align: leading) {

    md:main

    md:aside

}

```



| Param | Default |

|-------|---------|

| `gap` | `0` |

| `pad` | `0` |

| `align` | `leading` (cross = vertical) |

| `justify` | `start` (main = horizontal) |



### 4.4 `z` — overlay stack



자식을 같은 영역에 겹쳐 쌓는다. **first child = bottom**, last child = top.



```lml

z(pad: 0) {

    md:background

    md:foreground

}

```



| Param | Default |

|-------|---------|

| `pad` | `0` |



- 일반 자식은 부모 `z` content box 전체를 stretch한다. `at` 자식은 이 flow/stretch 규칙에서 제외된다.

- Allowed params: **`pad` only.** 그 외 → **E005**.

- `align`은 **미지원**이다. 절대 위치는 `at(...)`으로 명시한다.

### 4.4.1 `at` — absolute child of `z`

```lml
z(pad: 16) {
    md:background
    at(top: 24, right: 24, w: 180) { md:badge }
    at(left: 40, right: 40, bottom: 28) { md:footer }
}
```

`at(...)`은 반드시 `z`의 direct child이며 정확히 한 Node를 감싼다. 가장 가까운 direct `z`의 **padding을 제외한 content box**가 containing block이다. `at()`도 유효하며 원점 `(0, 0)`에서 intrinsic size를 사용한다. At은 정상 flow, stack dimension count, `fr` 분배에 참여하지 않는다. 형제의 source order가 z layering을 결정한다.

| Param | Allowed value | Meaning |
|-------|---------------|---------|
| `top`, `bottom`, `left`, `right` | fixed number, `%` | containing block edge offset |
| `w`, `h` | fixed number, `%`, `fit` | explicit/intrinsic size |

- 숫자는 target-space 단위이며 At 문맥의 positive integer도 `CanvasSize`가 아니라 `Fixed` AST다. `%`는 해당 `z` content-box axis에 대한 비율이다. `fr`과 `CanvasSize`는 At에서 E006이다.
- `left + right`이고 `w`가 없으면 폭을 derive/stretch한다. `top + bottom`이고 `h`가 없으면 높이를 derive/stretch한다. edge pair와 같은 축의 explicit size를 동시에 주면 E006이다.
- 한 edge와 size는 반대편 어느 쪽이든 허용된다. size만 있으면 해당 축 원점은 0이다. 한 edge만 있고 size가 없거나 아무 값도 없으면 intrinsic/shrink-to-fit이다.
- At의 child가 다시 At이면 direct-Z 규칙 위반이다. `at() { z { at(...) { ... } } }`처럼 중간에 새 `z`를 두는 중첩은 허용된다.
- `z`는 overflow를 clip한다. 따라서 content box 밖으로 나간 At 일부는 보이지 않는다.
- definite axis는 fixed size면 definite, percent size나 paired edges면 containing `z` axis가 definite일 때만 definite, `fit`/omitted intrinsic이면 indefinite이다.



### 4.5 `grid`



CSS Grid-like flow. 자식은 **row-major** (좌→우, 위→아래) 순서로 배치.



```lml

grid(cols: 3, gap: 16) {

    md:a  md:b  md:c

    md:d  md:e  md:f

}

```



| Param | Type | Default |

|-------|------|---------|

| `cols` | int \| track+ | **required** (E007 if missing) |

| `rows` | int \| track+ | auto (child count / cols) |

| `gap` | spacing | `0` |

| `pad` | spacing | `0` |



**Track spec vs track count:**

`cols`/`rows` param value는 **TrackSpec** (`TrackCount` \| `TrackList`). layout 계산 전 track **개수**를 분리한다:

```
column_count = TrackCount(N) → N  |  TrackList(xs) → len(xs)
row_count    = TrackCount(N) → N  |  TrackList(xs) → len(xs)
```

**`cols` / `rows` rules:**

- `cols: N` (integer) → TrackCount(N) → N equal `1fr` columns.
- `cols: 1fr 2fr 1fr` → TrackList → `column_count = 3`.
- `rows` omitted → `row_count = ceil(child_count / column_count)`; implicit row tracks = **`repeat(row_count, 1fr)`**.
- 빈 grid는 `child_count = 0`이므로 implicit `row_count = 0`; 가상의 `1fr` row를 만들지 않는다.
- `rows` explicit → `row_count` from TrackSpec as above.
- **Bare integer precedence:** `cols: N` / `rows: N` 단독 lexical positive integer → **TrackCount(N)** (N equal `1fr` tracks). 단일 fixed-width column `240`은 v0.1에서 **표현 불가** (`cols: 240` = 240 columns). `cols: 240 1fr`처럼 뒤에 track이 있으면 numeric-leading **TrackList**이다. v0.2 `240pt` suffix 등 검토.
- `capacity = column_count × row_count`; child count > capacity → **E006**.
- `cols: 0` / `rows: 0` → **parse error** (grammar `positive_integer`).
- 각 축의 track 수는 리소스 안전 상한 **10,000** 이하이다. 더 큰 TrackCount/TrackList는 validator E006이며, validator와 renderer는 해당 값을 비례하는 배열로 확장하지 않는다.
- v0.1: per-cell `align`/`justify` **미지원** (모든 cell stretch).

**Authoring — single-row equal columns:** `rows` 생략 시 implicit row track은 `1fr` (위 규칙). Grid row의 `fr`/`%`는 parent로부터 **definite height**가 필요하다 (§13 step 9 → E006). Parent stack slot이 row axis에서 indefinite(예: `v`의 `fit` 자식)이면 single-row `grid(cols: 1fr …)`도 E006일 수 있다. **한 row의 equal column strip**이 목적이고 parent main axis가 가로이면 `h(1fr, 1fr, …)`가 동일 geometry intent에 해당한다 (parent definite width — explicit `page(w: …)` 등). Multi-row grid는 parent 또는 `rows` explicit으로 row axis definite height를 확보한 뒤 사용한다.

**Definite axis (E006 rationale):** E006 on grid row `fr`/`%` without definite parent height is **intentional** — definite-axis propagation through stack/grid must stay consistent. **Do not** add validator exceptions for single-row `grid` in indefinite slots; authoring cost is **`h(1fr×N)`** instead (see [`07-nourish`](../../examples/07-nourish/) `sleep_home` stats). Same decision class as §3.3 E002: rule relaxation is not a one-line change.

**`cols` forms:**



```lml

grid(cols: 3)              // 3 equal columns (1fr each)

grid(cols: 1fr 2fr 1fr)    // 3 columns with ratio

```



- **Parser precedence:** `cols: 3` → TrackCount(3); `cols: 3fr` → TrackList; `cols: 240 1fr` → TrackList.

- v0.1: cell span / merge **미지원**.



### 4.6 `md` — markdown leaf



```lml

md:identifier

md """ ... """

```



- container가 아닌 **leaf node**.

- sizing은 **부모 container**의 dimensional arg 또는 default rule이 결정.

- named/inline 모두 geometry상의 semantic anchor다. MD body를 자동 렌더하거나 측정하지 않으며, WYSIWYG는 동일한 중립 placeholder로 표시한다.



### 4.7 `space` — flexible empty space

v0.1: **`space`는 `v`/`h`의 direct child로만 허용** — `page`/`z`/`grid` 아래 → **E006**.

Spacer는 main-axis 빈 공간을 배분하며, cross-axis에서는 부모의 `align` 값과 무관하게 항상 slot 전체로 stretch한다. 따라서 기본 `align: leading`, `center`, `trailing`도 Spacer의 cross-axis stretch를 축소하지 않는다.

```lml

h {

    md:logo

    space

    md:date

}

```



- **cross-axis: always stretch** (SwiftUI `Spacer` 모델).

- **Main-axis sizing precedence:**
  1. 부모 `v`/`h`가 positional dimensions **있음** + bare `space` → **해당 child slot** dimension 사용.
  2. 부모 positional dimensions **있음** + `space(dimension)` → **E006** (slot과 explicit dimension 이중 할당).
  3. 부모 positional dimensions **없음** + `space(dimension)` → explicit dimension 사용.
  4. 부모 positional dimensions **없음** + bare `space` → implicit **`1fr`**.



---



## 5. Sizing Model



### 5.1 Dimension vocabulary



| Form | Example | Meaning |

|------|---------|---------|

| Numeric | `240` | Fixed size in the parent-proposed target coordinate space |

| Percent | `30%` | 부모 available space의 비율 |

| Fraction | `1fr`, `2fr` | 남은 공간을 비율 배분 |

| Fit | `fit` | layout child representation의 intrinsic size; paired MD body는 측정하지 않음 |



> v0.1: **`fill` keyword 없음.** 남은 공간 차지는 `1fr` 사용.



### 5.2 Dimension count rule



Container에 dimensional positional args가 있으면:



```

dimension_count == child_count  →  OK

dimension_count != child_count  →  Error E003

```



### 5.3 Available space

#### 5.3.0 Page 2D proposal

Page의 각 축은 host available axis를 기준으로 독립 resolve한다: fixed/legacy CanvasSize는 정확한 target-space size, `%`는 host axis의 비율, positive `fr`은 host axis 전체, `fit`은 layout representation의 intrinsic size이다. Fixed 및 100% 초과 크기는 host bounds에 맞춰 임의 축소하지 않는다. `fit` 축은 indefinite이고, 나머지 유효한 축은 host axis가 definite이면 definite이다.

**page direct child** (`v`, `h`, `z`, `grid`, `md` 모두)는 main axis 없이 **2D content-box proposal**을 받는다:

```
proposed_width  = page content width  (page w − pad horizontal)
proposed_height = page content height (page h − pad vertical)
```

`v`/`h`/`z`/`grid`/`md`는 각자 필요한 axis로 해석한다. Stack child main-axis size는 §5.3.0a.

`md` child가 받는 proposal은 semantic-anchor placeholder의 geometry에만 적용한다. Paired 또는 inline MD body는 이 sizing pass에서 읽거나 측정하지 않는다.

> `page(w: 1000, pad: 50) { h(1fr,1fr) … }` — `h` main-axis width = 900 (content width).

#### 5.3.0a Stack `parent_main_size`

Stack (`v`/`h`) child main-axis size:

- page direct stack → content box on stack main axis (`proposed_height` for `v`, `proposed_width` for `h`).
- 그 외 → 부모 positional dimension / sizing pass.

#### 5.3.1 Stack (`v`/`h`) main-axis available

**Stack 전용** (grid는 §5.3.2):

```

available = max(0, parent_main_size − pad_main − gap_total)

gap_total = gap × max(0, child_count − 1)

```

- Percent dimensions는 clamp된 **available** 기준.

#### 5.3.2 Grid available space

Grid는 2D track layout — §5.3.1 공식 **적용하지 않음**:

```

available_width  = max(0, grid_width  − pad_horizontal − gap × max(0, column_count − 1))

available_height = max(0, grid_height − pad_vertical   − gap × max(0, row_count − 1))

```

`column_count` / `row_count` = §4.5. Implicit rows → `repeat(row_count, 1fr)` (§4.5).

Column track `fr`/`%` → §5.4 on `available_width` (requires **definite grid width**, §5.6.1).  
Row track `fr`/`%` → §5.4 on `available_height` (requires **definite grid height**, §5.6.1).  
Column/row `fit` track → §5.4.1 aggregation (not single-child intrinsic).

### 5.3.3 Geometry overflow

`fixed + fit > available`이면 `remaining = 0` — `fr` 배분에 쓸 공간 없음.

이 경우 **child slot 합**이 container available을 초과할 수 있다 (예: `h(800, 800)` in width 1000 → slot 합 1600).

| Kind | Behavior |
|------|----------|
| **Geometry overflow** | **Slot 자체**가 container/page bounds 초과 → slot 크기 **유지**, container/page 경계에서 **clip** (v0.1 default) |

MD body는 slot에 자동 배치되지 않으므로 이 규칙에 content-overflow 분기는 없다. AI가 생성하는 최종 화면 구현의 overflow 정책은 LML v0.1 범위 밖이다.



### 5.4 `fr` allocation algorithm



1. fixed sizes (numeric, `%`) 먼저 resolve

2. `fit`은 layout child representation 또는 neutral placeholder의 intrinsic size 측정 (paired/inline MD body 제외)

3. `remaining = max(0, available − fixed − fit)`

4. `fr` sum으로 remaining 배분 — `2fr 1fr` → 2:1

5. `0fr` → **E006** (validator)

### 5.4.1 Grid `fit` track aggregation

§5.4 step 2 (single-child intrinsic)는 **stack child representation**용. Grid track `fit`은 해당 track에 속한 **모든 cell representation**을 집계하며 MD body는 측정하지 않는다:

```
fit column width  = max(intrinsic_width(cell)  for cells in column)
fit row height    = max(intrinsic_height(cell) for cells in row)
```

집계 후 §5.4 algorithm 적용.

### 5.5 `fit` semantics (stack child)



| Axis | Behavior |

|------|----------|

| Main axis | layout child representation / placeholder intrinsic size |

| Cross axis (representation) | intrinsic unless parent `align: stretch` |

`md` leaf의 intrinsic 대상은 중립 semantic-anchor placeholder이며 named 또는 inline MD body가 아니다.



### 5.6 Definite-size requirements

#### 5.6.1 Stack (`v`/`h`)

`fr`/`%` child dimensions (bare `space` implicit `1fr` 포함)는 stack이 **definite main-axis size**를 가져야 — 없으면 **E006**.

**Definite main-axis** 출처:

1. **Page direct stack** → content box on stack main axis (§5.3.0a).
2. **Parent positional dimension** — `Fixed` / `Fraction` / `Percent` on main axis.
3. **Orthogonal nesting** — parent cross proposal = child main-axis when axes ⊥ (`v` → `h` width).

**Same-axis nesting** (`v` → `v`): `v { v(1fr, 1fr) }` → **E006**.

#### 5.6.2 Grid

Grid는 main axis 없음 — **per-axis** definite size:

| Track | Requires |
|-------|----------|
| column `fr`/`%` (incl. `cols: N` → N×`1fr`) | **definite grid width** from parent |
| row `fr`/`%` (incl. implicit `repeat(n, 1fr)`) | **definite grid height** from parent |

> `v { grid(cols: 1fr 1fr, rows: 1fr 1fr) }` — width OK (cross proposal), height indefinite (fit child) → **E006**.

> `v(fit, 1fr, fit) { … grid … }` — grid row `1fr` OK.

### 5.7 Proposed size (cross-axis)

v0.1 layout pass는 **top-down proposed size** (SwiftUI-style)를 사용한다.

- Stack은 각 자식에게 **cross-axis proposed size = parent content box cross extent**를 전달.
- **Orthogonal** nested stack: cross proposal = child **main-axis** definite (§5.6 case 3).
- `align: leading | center | trailing` — proposed slot **내부** content 배치.

### 5.8 Default child sizing



Dimensional arg가 생략된 container:



| Container | Default per child (main axis) |

|-----------|----------------------------|

| `v`, `h` | **`fit`** |

| `z` | stretch to parent bounds |

| `grid` | stretch to cell |



> SwiftUI analog: `HStack { Logo(); Spacer(); Date() }` — content = fit, spacer = fr.



### 5.9 Min/max constraints



v0.1: **미지원**. v0.2 `frame(max-w: …)`에서 도입.



---



## 6. Spacing



### 6.1 `gap`



형제 node 간 간격. `v`, `h`, `grid` param.



### 6.2 `pad`



Container inner padding. CSS-compatible shorthand (1–4 values).



---



## 7. Alignment



### 7.1 `align` — cross-axis



| Value | Horizontal axis (in `v`) | Vertical axis (in `h`) |

|-------|--------------------------|------------------------|

| `leading` | left | top |

| `center` | center | middle |

| `trailing` | right | bottom |

| `stretch` | fill width | fill height |



### 7.2 `justify` — main-axis



| Value | Behavior |

|-------|----------|

| `start` | leading edge (default) |

| `center` | 중앙 |

| `end` | trailing edge |

| `between` | first/last edge, 중간 equal space |

| `around` | each side half space |



---



## 8. Layout Tree Example



```lml

page(pad: 40) {

    v(gap: 24) {

        md:header

        h(2fr, 1fr, gap: 20) {

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



---



## 9. Error Codes (v0.1)



| Code | Severity | Condition |

|------|----------|-----------|

| E001 | Error | Unresolved `md:name` (optional association only) |

| E002 | Error | Duplicate leaf `md:name` in optional association, or duplicate direct-Page `md:ref` in multi-page `validateLml` |

| E003 | Error | Dimension count ≠ child count |

| E004 | Error | Root is neither `host` nor legacy `page`; invalid nested Host/Page; At not directly under Z |

| E005 | Error | Unknown / disallowed param for node type |

| E006 | Error | Invalid dimension; `0fr`; stack/grid fr/% without definite axis; invalid/overconstrained At geometry; `space` rules; grid overflow |

| E007 | Error | Missing required param/Page ref; invalid multi-Page or Host-Z shape; explicit-host Page missing w/h; Page/At child-count violation |

| E008 | Error | Duplicate named parameter |

| E009 | Error | Reserved `md:name` reference |

| W001 | Warning | Unused markdown block (optional association only) |



---



## 10. Non-goals (Explicit — style only)



**설계 문서(LML+MD)에서 normative로 요구하지 않는 것** — 구현자 styling 자유:



- Visual style: `color`, `font-family`, `font-size`, decorative `background`, `box-shadow`, `border-radius`, gradient, theme tokens
- Decorative motion: transition easing curve, hover tint (layout-presence를 바꾸지 않는 경우)
- Semantic UI component library names (`Title`, `KPI`, …) — LML `md:ref` + MD content로 대체
- Deprecated `fill` keyword — use `1fr`



**Non-goal이 아닌 것** (§3.5–§3.12, §12): min/max constraint, scroll/sticky **역할**, conditional layout, breakpoint variant, zoom **동작**, interaction/state/navigation.



---



## 11. Validation Pipeline



`validateLml`은 MD 파일 없이 LML geometry만 검사한다. WYSIWYG의 live validity와 wireframe도 이 단계만 사용한다:



1. Root is explicit `host` or legacy `page`; Host/Page/At nesting rules hold (E004)

2. `md:*` semantic-anchor name이 reserved가 아님 (E009). MD block 존재 여부나 body는 검사하지 않음

3. Dimension counts match (E003)

4. Param keys valid for node type (E005), no duplicates (E008)

5. Host has one or more direct Pages or a valid Host-Z; explicit Page has both w/h; multi-Page refs are present/unique; At has exactly one child; other required params present (E007/E002)

6. 직접 구성 AST의 page w/h `CanvasSize`가 positive finite safe integer가 아니거나, page-axis `Dimension` 및 gap/pad가 각 numeric 제약을 위반하면 E006

7. 모든 dimension은 finite; Fraction > 0, Fixed/Percent ≥ 0, TrackList nonempty, TrackCount positive finite safe integer (E006). Source의 잘못된 track count는 parse error

8. Stack `fr`/`%`/implicit spacer without definite main-axis (E006)

9. Grid column/row `fr`/`%` without definite width/height (E006)

10. `space` only under `v`/`h`; `space(dimension)` forbidden when parent stack has positional dims (E006)

11. Grid child count ≤ column_count × row_count (E006)

12. Grid TrackCount/TrackList length ≤ 10,000 (E006); empty grid의 implicit row count는 0

13. At edge/size units, same-axis overconstraint, and definite-axis propagation are valid (E006)

선택적으로 `joinSlide` / `parseAndJoin`을 호출하면 별도의 association diagnostics를 계산한다:

1. LML의 같은 leaf `md:name` anchor 중복 → E002 (Page ref와 leaf ref가 같은 이름을 공유하는 경우는 제외)
2. 대응 MD block 없음 → E001
3. 어느 anchor에서도 사용하지 않은 MD block → W001

이 association 결과와 `ResolvedSlide`는 AI/handoff를 위한 reference-resolved 자료이며, WYSIWYG layout validation 또는 자동 렌더 성공 여부가 아니다.



---



## 12. Planned LML constructs (design language)



**Status:** normative **design-language** semantics. v0.1 lexer/parser/validator는 §1 Grammar backlog 항목을 **구현하지 않을 수 있다**. parser 미구현 시 **동등한 MD role**(§3.5–§3.12)로 먼저 기록한다. parser 구현 시 MD와 **동일 semantic**이어야 한다.



### 12.1 `scroll` container



SwiftUI `ScrollView`, `List` scroll axis, CSS `overflow: auto` scrollport.



```lml
scroll(axis: vertical, pad: 8) {
    md:outline_tree
}
```



| Param | Type | Default | Meaning |
|-------|------|---------|---------|
| `axis` | `vertical` \| `horizontal` | `vertical` | independent scroll axis |
| `pad` | spacing | — | inner padding (§6.2) |
| `gap` | number | — | **invalid** (E005) — use inner `v`/`h` |



**Semantics:**

- `scroll`는 **single-axis** scroll container. orthogonal axis는 parent definite size를 따른다.
- Content subtree는 scroll **content box**에서 측정; viewport는 parent가 할당한 box.
- `fr` child는 scrollport **viewport** definite main-axis가 있을 때만 (CSS flex-in-scroll 규칙과 동일 intent).
- MD `scrollport` role(§3.8)과 1:1 대응. 둘 다 있으면 **일치**해야 한다.



### 12.2 `frame` constraints and `minmax`



SwiftUI `.frame(minWidth:maxWidth:minHeight:maxHeight:)`, CSS `minmax()`, `min-width`/`max-height`.



**Wrapper form (any single child):**



```lml
frame(min-w: 280, max-w: 340, min-h: 145) {
    md:sidebar
}
```



**Named params on stack/page node (alternative surface):**



```lml
v(min-h: 145, max-h: 42%) {
    md:diagnostics
}
```



| Param | Type | Applies to |
|-------|------|------------|
| `min-w`, `max-w`, `min-h`, `max-h` | `Dimension` | node box on corresponding axis |
| `w`, `h` | `Dimension` | preferred size when no parent track overrides |



**Track `minmax` dimension (grid / stack positional):**



```lml
grid(cols: minmax(280, 340) 1fr, gap: 16) { ... }
h(minmax(240, 320), 1fr, gap: 12) { ... }
```



```ebnf
minmax_dimension ::= "minmax" "(" dimension "," dimension ")" ;
dimension        ::= NUMBER | FR | PERCENT | FIT | minmax_dimension ;
```



**Semantics:**

- Clamping은 layout pass **after** parent definite axis propagation, **before** overflow clip (unless MD scrollport says clip).
- `min-w` > `max-w` (same axis) → E006.
- MD `layout-constraint` role(§3.6)과 동일. LML nominal track + MD min/max가 공존하면 **lint** 대상.



### 12.3 `sticky`



SwiftUI pinned section header, CSS `position: sticky`.



```lml
scroll(axis: vertical) {
    sticky(edge: top) {
        md:outline_header
    }
    md:outline_tree
}
```



| Param | Type | Meaning |
|-------|------|---------|
| `edge` | `top` \| `bottom` | sticky edge within **nearest scroll ancestor** |



**Semantics:**

- `sticky` node는 scroll container의 **direct or nested** child; scroll ancestor는 `scroll` 또는 MD-declared scrollport boundary.
- Sticky box는 flow layout을 유지하고 scroll offset에 따라 edge에 고정.
- MD `sticky` role(§3.8)과 1:1 대응.



### 12.4 Conditional children — `when` (optional LML surface)



SwiftUI `@ViewBuilder if`, optional View.



```lml
v(gap: 8) {
    when(notice) {
        md:notice
    }
    md:workbench
}
```



| Form | Meaning |
|------|---------|
| `when(ref)` block | slot **present in layout tree** when MD `# ref`의 `layout-presence` 조건 true |
| `when(ref)` absent | MD `layout-absence` — subtree removed; siblings reflow |



**Semantics:**

- 조건 **expression**은 MD `behavior` / `layout-condition`에 normative; LML `when(ref)`는 ref-named 조건에 대한 **geometry shorthand**.
- Parser 미구현 시 MD-only(§3.7)로 충분.



### 12.5 Layout variants — multi-`page` artboards



SwiftUI `@Environment(\.horizontalSizeClass)`, `ViewThatFits`.



```lml
host {
    page(md:workbench, w: 100%, h: 100%) { ... }
    page(md:workbench-compact, w: 100%, h: 100%) { ... }
}
```



**Semantics:**

- Direct Pages는 **variant artboards**; runtime **한 번에 하나** active (MD `layout-variant` §3.9).
- Variant 간 slot ref 이름은 **stable**하게 유지 (동일 semantic region).
- Breakpoint threshold는 MD normative; LML은 geometry만 variant별로 다르게 적는다.



### 12.6 `transform` region



SwiftUI `.scaleEffect`, magnify gesture, inverse stage sizing.



```lml
transform(mode: scale, min: 25%, max: 200%, step: 10%) {
    md:preview_canvas
}
```



| Param | Type | Meaning |
|-------|------|---------|
| `mode` | `scale` | content scale; control chrome excluded unless nested |
| `min`, `max`, `step` | number or `%` | scale range |
| `origin` | `top-left` \| `center` | transform origin (layout semantic) |



**Semantics:**

- **Layout-affecting:** stage/content 측정 관계 (inverse stage sizing). Decorative animation curve는 §10.
- MD `transform` role(§3.10)과 1:1 대응.



### 12.7 Grid cell span



SwiftUI `GridItem(.span)`, CSS `grid-column: span N`.



```lml
grid(cols: 3, gap: 16) {
    md:a
    span(cols: 2) { md:b }
    md:c
}
```



| Param | Meaning |
|-------|---------|
| `cols`, `rows` | span count along grid axis |



**Semantics:** span child occupies contiguous cells in row-major order; overflow → E006.



### 12.8 Interaction and navigation (MD-primary)



Button action, `@State`, navigation path는 **MD `behavior` role**(§3.11)이 primary. LML은 **tap target region** (`md:ref` slot)만 제공. 향후 `on(...)` param은 고려 대상이나 v0.1 planned surface **아님**.



### 12.9 Implementation note



Planned constructs 도입 시: `grammar.ebnf`, `grammar.md`, `ast.md`, `spec/ast.ts`, validator, measurement를 **함께** 갱신한다. MD-only 설계와의 **semantic equivalence** 테스트를 권장한다.



---



## Appendix A: SwiftUI / CSS Mapping (informative)



### A.1 v0.1 LML containers



| LML | SwiftUI | CSS (approx) |

|-----|---------|--------------|

| `host` | root `WindowGroup` / scene size | viewport host |

| `page` | artboard / screen canvas | sized root frame |

| `v` | `VStack` | `flex-direction: column` |

| `h` | `HStack` | `flex-direction: row` |

| `z` | `ZStack` | stacked layers |

| `at(...)` | positioned overlay in `ZStack` | `position: absolute` + inset/size |

| `grid` | `Grid` / `LazyVGrid` | `display: grid` |

| `space` | `Spacer()` | flexible grow slot |

| `md:ref` | labeled content region | named slot / region id |

| implicit child | intrinsic content | `flex: 0 0 auto` |

| `fr` | proportional flex | `flex-grow: N` / `fr` track |

| `fit` | intrinsic / ideal size | `fit-content` |



### A.2 MD design roles (§3.5–§3.12)



| MD role | SwiftUI | CSS (layout·semantic) |

|---------|---------|------------------------|

| `layout-constraint` | `.frame(min:max:)` | `min-width`, `max-height`, `minmax()` |

| `layout-condition` | `@ViewBuilder if` | conditional display / DOM presence |

| `scrollport` | `ScrollView` | `overflow: auto`, scroll container |

| `sticky` | pinned header | `position: sticky` |

| `layout-variant` | `@Environment sizeClass`, `ViewThatFits` | `@media` layout rules |

| `transform` | `.scaleEffect` | `transform: scale()` (layout stage) |

| `behavior` | `Button`, `@State`, `NavigationPath` | event handlers, routing |

| `structure-note` | (documentation) | DOM vs sketch tree mapping |

| `content` | `Text`, labels | text content (not placement) |



### A.3 Planned LML (§12)



| Planned LML | SwiftUI | MD equivalent |

|-------------|---------|---------------|

| `scroll(axis: …)` | `ScrollView` | `scrollport:` |

| `frame(min-w: …)` | `.frame(min:max:)` | `min-width:` / `layout-width: minmax` |

| `minmax(a, b)` track | flexible frame | `minmax()` |

| `sticky(edge: …)` | pinned section | `sticky:` |

| `when(ref) { }` | `@ViewBuilder if` | `layout-presence:` |

| multi-`page` host | size-class layouts | `layout-variant:` |

| `transform(mode: scale, …)` | `.scaleEffect` | `transform:` / `scale-range:` |

| `span(cols: N)` | `GridItem(.span)` | `grid-column: span N` |



Figma: `z` → stacking context; `at` → absolute child outside Auto Layout flow. 표는 구현 참고용이며 import/export 계약은 아니다.



---



## Related Documents



| Document | Description |

|----------|-------------|

| [`grammar.ebnf`](grammar.ebnf) | Formal EBNF grammar |

| [`grammar.md`](grammar.md) | Lexical rules, disambiguation, parser notes |

| [`ast.md`](ast.md) | AST shape reference; planned nodes §13 |

| [`../design-premises.md`](../design-premises.md) | SwiftUI parity premises |

| [`spec/ast.ts`](../../spec/ast.ts) | TypeScript AST type definitions |



---



*Version: 0.1-draft*


