# LML v0.1 Examples

각 예제는 `slide.lml` + `slide.md` 페어다. **Design premise:** SwiftUI에서 스타일을 제외한 layout·semantic은 LML+MD로 문서화한다 ([`docs/design-premises.md`](../docs/design-premises.md)). `md:ref`는 semantic anchor이며 WYSIWYG wireframe에 MD body를 자동 주입하지 않는다.

아래 ASCII diagrams는 **illustrative layout intent**다. 구현(React/CSS 등)은 설계를 따르고 스타일만 자유다.

| # | Folder | Layout pattern | Features exercised |
|---|--------|----------------|-------------------|
| 1 | [`01-market-overview`](01-market-overview/) | `v` → `h(2fr, 1fr)` → nested `v` + `h` | fr sizing, gap, align, named md refs |
| 2 | [`02-title-cover`](02-title-cover/) | `z` overlay + `v` + `h` + `space` | page w/h, z stack, spacer, justify |
| 3 | [`03-kpi-dashboard`](03-kpi-dashboard/) | `grid(cols: 3)` + inline md + `space(2fr)` | grid, inline md, space, fr |
| 4 | [`04-wysiwyg-system`](04-wysiwyg-system/) | host → named page → editor/preview panels | Workbench chrome layout sketch |
| 5 | [`05-absolute-overlay`](05-absolute-overlay/) | host → `z` → base page + `at(...)` overlays | absolute offsets, paired-edge stretch, source-order layering |
| 6 | [`06-store-flow`](06-store-flow/) | host → 5 named pages → catalog/cart/checkout flow | multi-page artboards, Page refs, MD navigation/state specification |
| 7 | [`07-nourish`](07-nourish/) | host → 4 mobile pages → Nourish variants + sleep home | mobile page size, layout variants, weekly chart card, tab bar |
| 8 | [`08-vscode-keybindings`](08-vscode-keybindings/) | host → 3 desktop pages → VS Code Keyboard Shortcuts UI | activity bar + editor tab, sticky toolbar/header, scrollable table, record/edit states |
| 9 | [`09-vscode-explorer`](09-vscode-explorer/) | host → 3 desktop pages → VS Code Explorer sidebar + editor | activity bar + resizable sidebar, collapsible sections, file tree, editor tabs, context menu overlay |

---

## 1. Market Overview

```
┌────────────────────────────────────────────┐
│ Market Overview                            │
│ FY2026 Market Analysis                     │
├───────────────────────┬────────────────────┤
│                       │ Key Insight        │
│    Main analysis      │                    │
│                       ├─────────┬──────────┤
│                       │ CAGR    │ Margin   │
│                       ├─────────┴──────────┤
│                       │ Commentary         │
└───────────────────────┴────────────────────┘
```

- LML은 KPI 숫자의 의미를 모름 — AI가 `**18.4%**`를 포함한 MD 문맥과 geometry를 함께 읽고 화면 KPI, 발표자 노트, 분석 중 적절한 구현을 판단
- 복잡한 aside 패널을 nested `v` + `h`로 분해

---

## 2. Title Cover

```
┌────────────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓                                        ▓▓│
│▓▓     Enterprise SaaS                     ▓▓│
│▓▓     Strategic Review 2026              ▓▓│
│▓▓                                        ▓▓│
│▓▓                                        ▓▓│
│▓▓  Prepared by Strategy Team   Mar 2026 ▓▓│
└────────────────────────────────────────────┘
```

- `z` — background + foreground overlay
- `space` — title block과 footer 사이 push
- `page(w: 1920, h: 1080)` — legacy-compatible explicit fixed page size

---

## 3. KPI Dashboard

```
┌────────────────────────────────────────────┐
│ ACME          Q1 2026 Snapshot             │
├──────────┬──────────┬──────────────────────┤
│ Revenue  │Customers │ NPS                  │
├──────────┼──────────┼──────────────────────┤
│ Churn    │ ARR      │ Headcount            │
├──────────┴──────────┴──────────────────────┤
│ Highlights          │ Revenue Trend chart  │
└─────────────────────┴──────────────────────┘
```

- `grid(cols: 1fr 1fr 1fr)` — 6-cell KPI grid
- inline `md """ ... """` — header 영역에 붙인 AI/handoff 문맥 (no named block, 자동 렌더 아님)
- `space(2fr)` — logo와 title 사이 가변 공간

---

## 4. WYSIWYG System

**설계 예제:** [`04-wysiwyg-system`](04-wysiwyg-system/)은 Workbench의 chrome geometry와 MD 명세를 기록한다.

실제 workbench UI는 [`wysiwyg/src/App.tsx`](../wysiwyg/src/App.tsx) + `styles.css`에 구현되어 있다. `04-wysiwyg-system` LML+MD는 workbench layout intent를 **하나의 Page artboard**로 설명하는 스케치이며, canvas는 **편집 중인 target document**만 wireframe한다 (E-T1).

```
┌──────────────────────────────────────────────────────────────┐
│ LML Workbench · VALID · [예제] ········· [새][샘플][열기][저장] │  app-header
├──────────────────────────────────────────────────────────────┤
│ (notice banner — conditional)                                 │
├──────────────┬───────────────────────────┬───────────────────┤
│ LML / MD     │ Canvas · LML geometry only│ Outline           │
│ source tabs  │ zoom · preview states     │ Inspector         │
│              │                           │ Diagnostics       │
└──────────────┴───────────────────────────┴───────────────────┘
  source-pane      canvas-pane                 sidebar
```

- `v(fit, fit, 1fr)` — app-header + optional notice + workbench (§3.7 layout-presence)
- `h(fit, fit, 1fr, fit, fit)` — brand_block, status, spacer, template, header-actions (App flex order)
- `host { page(w: 1fr, h: 1fr) }` — preview host의 두 축을 채우는 명시적 검증 레이아웃
- `h(340, 1fr, 290)` — source / canvas / sidebar nominal sketch ↔ CSS `minmax(280,340) | minmax(420,1fr) | minmax(250,290)` (authoritative constraints in MD)
- source `v(fit, fit, 1fr, fit)` — tabs, context bar, editor, footer
- canvas — toolbar + mutually exclusive preview states (`preview_invalid` / `preview_empty` / `preview_no_pages` / `preview_gallery`)
- sidebar `v(2fr, 1fr, 1.5fr)` — Outline(+toolbar+tree) / Inspector / Diagnostics; min/max/flex/scroll/sticky in MD
- MD — layout-constraint, layout-variant, scrollport, sticky, transform, behavior, structure-note ([semantic-spec §3.5–§3.12](../../docs/v0.1/semantic-spec.md))

---

## 5. Absolute Overlay

```
┌────────────────────────────────────────────┐
│ Absolute Overlay                    [LIVE] │
│                                            │
│ normal-flow page content                   │
│                                            │
│  ───── stretched footer overlay ────────   │
└────────────────────────────────────────────┘
```

- `host { z { page(...) { ... } at(...) { ... } } }` — base Page 한 개와 절대 배치 overlay를 함께 사용
- `at(top: 24, right: 24, w: 180)` — host의 `z` content box 기준 오른쪽 위 고정
- `at(left: 40, right: 40, bottom: 28)` — 명시적 `w` 없이 양쪽 edge로 폭 결정
- `at`은 정상 흐름과 `fr` 분배에서 제외되고, 선언 순서가 앞뒤 레이어 순서를 결정

---

## 6. Store Flow

```text
catalog → product_detail → cart → checkout → order_complete
   ↑                                              │
   └──────────────── continue shopping ──────────┘
```

- 하나의 `host` 아래 `page(md:catalog, ...)`부터 `page(md:order_complete, ...)`까지 5개 독립 artboard를 정의
- 상품명·가격·수량·배송지·결제 표시값은 MD에 두고 LML은 화면별 geometry만 관리
- 담기, 수량 변경, 합계 계산, 검증, 제출 성공·실패와 Page 전환 관계는 MD가 후속 구현을 위한 요구사항으로 설명
- WYSIWYG에서는 모든 Outline 노드의 체크박스로 Page artboard 또는 geometry를 유지한 subtree를 표시·숨기고, Page 전용 표시 명령으로 여러 화면을 비교하지만 MD 동작을 직접 실행하지 않음

---

## 7. Mobile Apps (Nourish + Sleep)

```text
today_card_macros · today_ring_hero · today_split_headline · sleep_home
     (Nourish A)         (Nourish B)        (Nourish C)      (Sleep)
```

```
Nourish variants (390×844)                 Sleep home (390×844)
┌─────────────────────┐                    ┌─────────────────────┐
│ Nourish · TODAY     │                    │ Seize the Day! 🌟   │
│ ○ 1220 cal left     │                    │ July 29, 2026       │
│ macros + meals      │                    │ [Week|7-Night|…]    │
│ [nav] Scan          │                    │ ┌─ stats + chart ─┐ │
└─────────────────────┘                    │ │ AVG SLEEP 63% … │ │
                                           │ │ Thu–Wed bars    │ │
                                           │ └─────────────────┘ │
                                           │ Last Night 7h 48min │
                                           │ [ Go to Sleep   ]   │
                                           │ [Home Metrics …]    │
                                           └─────────────────────┘
```

- `page(w: 390, h: 844)` — iPhone-class mobile artboard
- Nourish — mockup의 **세 가지 Today 레이아웃 탐색안** + sleep tracking **weekly home dashboard**
- Nourish variant A — ring + headline row, macros inside card, bottom nav pill + scan FAB
- Nourish variant B — hero ring center, macros below card, full-width scan CTA
- Nourish variant C — large remaining headline + small ring, dot macro list, full-width scan CTA
- Sleep home — greeting + period tabs, 4-stat row (`h(1fr×4)`) + week chart card, last-night summary + Go to Sleep CTA, bottom tab bar
- 칼로리·매크로·수면 metric·탭·CTA 동작은 MD에, LML은 geometry만 관리
- **Authoring (semantic-spec §3.3):** cross-page 동일 semantic → slot/Page마다 distinct ref (`card_*`, `ring_*`, …); leaf ref 재사용 시 join **E002**
- **Authoring (semantic-spec §4.5):** single-row stat strip in parent `fit` slot → `h(1fr, …)`; implicit-row `grid`는 parent row-axis indefinite 시 **E006** ([`07-nourish/slide.lml`](07-nourish/slide.lml) `sleep_home` stats)

---

## 8. VS Code Keyboard Shortcuts

```text
keyboard_shortcuts → keybinding_record → keybinding_edit
   (default list)      (record mode)       (inline chord edit)
```

```
┌──┬────────────────────────────────────────────────────────────┐
│▓▓│ Keyboard Shortcuts                                      ×  │
│▓▓├────────────────────────────────────────────────────────────┤
│▓▓│ 🔍 Type to search…        [⏺ Record] [↕] [Filter] [{}]   │
│▓▓├──────────────┬─────────────┬──────────────────┬──────────┤
│▓▓│ Command      │ Keybinding  │ When             │ Source   │
│▓▓├──────────────┼─────────────┼──────────────────┼──────────┤
│▓▓│ Open File    │ Ctrl+O      │                  │ Default  │
│▓▓│ Save         │ Ctrl+S      │ !editorReadonly  │ Default  │
│▓▓│ Find         │ Ctrl+F      │ editorFocus      │ Default  │
│▓▓│ …            │             │                  │          │
└──┴────────────────────────────────────────────────────────────┘
  activity bar + editor tab + shortcuts table (scroll body)
```

- `page(w: 1280, h: 800)` — desktop editor window artboard
- `h(48, 1fr)` — activity bar rail + editor area (tab bar + shortcuts panel)
- toolbar `h(fit, 1fr, fit, fit, fit)` — search + record/sort/filter/json actions
- table `h(2.2fr, 1fr, 1.6fr, fit)` — Command / Keybinding / When / Source columns
- `v(fit, fit, 1fr)` — toolbar + column header + scrollable row list (`scrollport` in MD)
- `keybinding_record` — recording banner + active Record toggle
- `keybinding_edit` — `z` + `at` chord input overlay on editing row
- 명령·단축키·when clause·source·편집/캡처 동작은 MD에, LML은 geometry만 관리
- 세 Page의 shell 복제 + MD `structure-note` 동일 shell — [design-premises §0.2](../docs/design-premises.md) (Figma state frame + “XXX와 동일” annotation)

---

## 9. VS Code Explorer

```text
explorer → explorer_collapsed → explorer_context_menu
 (expanded tree)   (collapsed sections)   (right-click menu)
```

```
┌──┬──────────────────┬─────────────────────────────────────────┐
│▓▓│ EXPLORER    …    │ main.ts · utils.ts*              …      │
│▓▓│ ▼ OPEN EDITORS   ├─────────────────────────────────────────┤
│▓▓│   main.ts        │                                         │
│▓▓│   utils.ts       │  editor buffer (active tab)             │
│▓▓│ ▼ LML            │                                         │
│▓▓│   ▼ src          │                                         │
│▓▓│     index.ts     │                                         │
│▓▓│     utils.ts*    │                                         │
│▓▓│     main.ts      │                                         │
│▓▓│   ▼ tests        │                                         │
│▓▓│     app.test.ts  │                                         │
│▓▓│   package.json   │                                         │
└──┴──────────────────┴─────────────────────────────────────────┘
  activity bar + sidebar (260px) + editor group
```

- `page(w: 1280, h: 800)` — desktop editor window artboard
- `h(48, 260, 1fr)` — activity bar rail + Explorer sidebar + editor area
- sidebar `v(fit, 1fr)` — view header + scrollable tree (`scrollport` in MD)
- collapsible `section_open_editors` · folder rows — expand/collapse는 MD `layout-presence`
- `explorer_collapsed` — OPEN EDITORS·`src` folder 접힘; editor tab 1개
- `explorer_context_menu` — `z` + `at` context menu overlay on `utils.ts` row
- 파일명·workspace tree·selection·tab·context action은 MD에, LML은 geometry만 관리
- 세 Page shell 복제 + MD `structure-note` — [design-premises §0.2](../docs/design-premises.md)

---

## Related

- [Semantic spec](../docs/v0.1/semantic-spec.md)
- [Grammar](../docs/v0.1/grammar.md)
- [AST](../docs/v0.1/ast.md)
