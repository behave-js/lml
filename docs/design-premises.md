# LML Design Premises

프로젝트 전역 전제. v0.1 grammar·WYSIWYG·예제·구현은 이 전제를 **향해** 맞춘다. v0.1이 전제를 **이미 전부 구현**했다는 뜻은 아니다.

---

## 0. Product intent (Figma-class markup)

LML의 목표는 **Figma를 대체·보완하는 layout markup**이다. 화면 설계를 **인스턴스된 geometry tree**로 남기고, AI·구현자가 layout·semantic을 읽을 수 있게 한다.

**SwiftUI**는 구현 target이 아니라 **layout·semantic vocabulary의 참조 모델**이다. §1 parity는 “SwiftUI로 구현해야 한다”가 아니라 “SwiftUI에서 스타일을 제외한 layout·semantic을 LML+MD로도 기록할 수 있어야 한다”는 뜻이다.

### 0.1 세 층 (LML · MD · 구현)

| 층 | 역할 | Figma 대응 |
|----|------|------------|
| **LML** (`slide.lml`) | geometry **instance** tree — 영역·계층·순서·칸 | frame / auto-layout **layer tree** |
| **MD** (`slide.md`) | 동일성·동작·조건·baseline — slot별 semantic | annotation, spec note, “**XXX와 동일**” |
| **구현** (React / SwiftUI / CSS) | reusable component, styling, runtime data | dev handoff / code component |

설계 source of truth는 **LML+MD**. 구현 컴포넌트는 handoff 이후 레이어이며, LML grammar가 대체하지 않는다.

### 0.2 컴포넌트와 동일성 (sameness)

Figma에서 **component화는 가능**하지만, variant·state·instance 관리에 **authoring 비용**이 큰 편이다. LML도 같은 층위를 택한다.

- LML v0.1에 **reusable geometry component syntax 없음** = 실수·미구현이 아니라 **Figma layer tree에 가까운 surface**를 의도한 것.
- 같은 subtree를 여러 artboard·slot에 두면 **geometry는 복제**하고, ref는 slot마다 **distinct** (`E002` — [semantic-spec §3.3](v0.1/semantic-spec.md#33-binding-rules)).
- **“이 UI는 저 UI와 같다”**는 LML ref alias가 아니라 **MD 관계**로 적는다:
  - `structure-note:` — 동일 shell·baseline·탐색 범위 ([§3.12](v0.1/semantic-spec.md#312-structure-notes-structure-note))
  - prose cross-reference — “baseline — `# keyboard_shortcuts`”, “`record_*` toolbar는 default와 동일”
- **구현 DRY** (`<ShortcutsToolbar />` 등)는 구현자 자유. LML 복제와 모순되지 않는다.

**읽는 법:** LML subtree 복제 + MD “동일” 선언 = Figma에서 state frame을 복제하고 component note를 남기는 패턴. “컴포넌트가 없다”가 아니라 **동일성의 authoritative 표현이 MD**이다.

---

## 1. SwiftUI parity (layout & semantics)

**SwiftUI에서 스타일을 제외하고 layout·semantics에 쓸 수 있는 표현은, LML + MD 합쳐서 동등하게 표현 가능해야 한다.**

- **LML만**으로 다 표현할 필요는 없다. SwiftUI의 modifier·`if`·Environment·scroll container 역할은 **MD `# 블록`**에 둘 수 있다.
- **스타일**(`color`, `font`, `background` 장식, `shadow`, `border-radius`, decorative gradient 등)은 설계 문서에 **필수 아님**. 구현자가 자유롭게 해석한다.
- **CSS/React 구현**도 동일: layout·semantic 규칙은 `slide.lml` / `slide.md`에 있어야 하고, 순수 visual styling만 구현 자유.

### 1.1 “스타일”과 “layout·semantic” 구분

| 설계에 반드시 기록 (LML 또는 MD) | 구현 자유 (기록 불필요) |
|--------------------------------|-------------------------|
| 영역·계층·순서·칸 배치 | 색·테마·타포·장식 배경 |
| min/max·비율·breakpoint layout 규칙 | box-shadow, border-radius |
| scroll container·sticky **역할** | brand gradient, dot grid 패턴 |
| 조건부 layout (notice 있을 때 row 등) | primary 버튼 색 |
| zoom·transform **동작** (canvas scale 등) | monospace font 선택 |
| 상태별 무엇을 보여줄지 | transition easing curve (장식적) |
| 상호작용·단축키·Page 전환 **요구** | hover 색 |

CSS의 `grid-template-columns`, `minmax`, `max-height: 42%`, `@media` **layout 변경** → **layout·semantic** → LML 또는 MD.

---

## 2. LML + MD = 한 설계 (SwiftUI vocabulary)

SwiftUI는 View tree + modifier + `@ViewBuilder` + Environment를 **한 언어**에 쓴다.  
LML 프로젝트는 **같은 설계**를 **두 파일**로 쓴다 (§0.1).

| SwiftUI (vocabulary) | LML + MD |
|----------------------|----------|
| `VStack` / `HStack` / `ZStack` / `Grid` | LML container (`v`, `h`, `z`, `grid`, …) |
| Custom `View` **재사용** | LML geometry **복제** + MD **동일성** (`structure-note`, cross-ref); 구현 component는 §0.1 |
| `ScrollView`, pinned header, scroll section | LML scrollport node **또는** MD scroll/sticky 규칙 |
| `@ViewBuilder if` / optional child | MD 조건부 layout 규칙 **또는** 별도 Page artboard **또는** (향후) LML 조건 syntax |
| `.frame(minWidth:maxWidth:)` | MD constraint 규칙 **또는** (향후) LML constraint on node/track |
| `@Environment(\.horizontalSizeClass)` / `ViewThatFits` | MD breakpoint·variant 규칙 **또는** `page(md:…)` artboard 여러 장 |
| `.scaleEffect` / zoom gesture | LML zoom **영역** + MD scale·stage 동작 |
| View content | MD `# ref` body |
| Button action, navigation | MD 동작·전환·상태 요구 |
| `.foregroundColor`, decorative `.background` | 구현 styling (자유) |

**표현력 차이가 아니라 표기 분리.** SwiftUI 한 파일 ≈ `slide.lml` + `slide.md`.

---

## 3. 설계 ↔ 구현

| 산출물 | 역할 |
|--------|------|
| `slide.lml` + `slide.md` | layout·semantic **설계 source of truth** |
| React / CSS / SwiftUI 등 | 설계를 따르는 **구현**. 스타일 자유 |
| [`examples/04-wysiwyg-system/`](../examples/04-wysiwyg-system/) | workbench 레이아웃 설계 예제 |
| `wysiwyg/src/App.tsx` | workbench **구현**. 레이아웃 변경 시 `examples/04-wysiwyg-system/`의 LML+MD와 동기화 |

구현이 설계보다 앞서 바뀌면 **관련 LML+MD 설계를 구현에 맞게 갱신한다.**  
설계가 구현보다 앞서면 **구현을 설계에 맞춘다.**

---

## 4. WYSIWYG runtime (설계 전제와 별개)

WYSIWYG live preview는 **LML geometry만** compile·validate·wireframe 한다. MD는 editor에 보존하지만 preview 측정·render 입력이 **아니다**.

이것은 **설계 표현력 전제를 부정하지 않는다.**  
설계는 LML+MD로 완전히 적고, preview engine은 v0.1에서 LML subset만 즉시 그린다.

---

## 5. v0.1 grammar vs 전제

v0.1 grammar는 **의도적으로 작지만**, §1 전제는 **grammar 버전과 무관**하다.

다음은 “영원히 불가”가 아니라 **v0.1 parser 미구현 + LML/MD 설계로는 기록 가능** 또는 **향후 LML syntax 추가** 대상이다.

| SwiftUI / CSS layout·semantic | v0.1 LML parser | 설계 기록 (normative) |
|------------------------------|-----------------|------------------------|
| min/max frame | 미구현 | [§3.6 MD](v0.1/semantic-spec.md#36-layout-constraints-layout-constraint) · [§12.2 LML `frame`](v0.1/semantic-spec.md#122-frame-constraints-and-minmax) |
| `@ViewBuilder if` | 미구현 | [§3.7 MD](v0.1/semantic-spec.md#37-conditional-layout-layout-condition) · [§12.4 `when`](v0.1/semantic-spec.md#124-conditional-children--when-optional-lml-surface) |
| breakpoint layout | 미구현 | [§3.9 MD](v0.1/semantic-spec.md#39-layout-variants-and-breakpoints-layout-variant) · multi-`page` [§12.5](v0.1/semantic-spec.md#125-layout-variants--multi-page-artboards) |
| `ScrollView` | 미구현 | [§3.8 MD](v0.1/semantic-spec.md#38-scroll-and-sticky-scrollport-sticky) · [§12.1 `scroll`](v0.1/semantic-spec.md#121-scroll-container) |
| sticky / safeAreaInset | 미구현 | [§3.8 MD](v0.1/semantic-spec.md#38-scroll-and-sticky-scrollport-sticky) · [§12.3 `sticky`](v0.1/semantic-spec.md#123-sticky) |
| zoom scale behavior | slot only | [§3.10 MD](v0.1/semantic-spec.md#310-transform-and-zoom-transform) · [§12.6 `transform`](v0.1/semantic-spec.md#126-transform-region) |
| grid span | 미구현 | [§12.7](v0.1/semantic-spec.md#127-grid-cell-span) |
| interaction / navigation | MD-primary | [§3.11 behavior](v0.1/semantic-spec.md#311-behavior-state-and-navigation-behavior) |

**스타일만** 설계에서 제외(§10). 나머지는 **반드시 LML 또는 MD에 적을 수 있어야** 하며, v0.1 parser가 모르는 것은 **도구 backlog**이다.

전체 MD role taxonomy: [semantic-spec §3.5](v0.1/semantic-spec.md#35-md-block-roles-design-vocabulary).

---

## 6. 관련 문서

- [Semantic spec v0.1](v0.1/semantic-spec.md) — grammar·validator·**design language (§3.5–§3.12, §12)**
- [Grammar](v0.1/grammar.md) — v0.1 + planned constructs (§8)
- [AST](v0.1/ast.md) — v0.1 + planned nodes (§13)
- [Examples](../examples/README.md)
