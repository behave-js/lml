# workbench
## Workbench page


[`docs/design-premises.md`](../../docs/design-premises.md): SwiftUI layout·semantic(스타일 제외)은 LML+MD로 문서화한다. [`wysiwyg/src/App.tsx`](../../wysiwyg/src/App.tsx) + `styles.css`는 **구현**. 구현 변경 시 이 예제의 LML+MD 설계를 갱신한다 (design-premises §3).

structure-note: Canvas preview는 **편집 중인 target document LML**만 wireframe. 이 artboard는 workbench chrome sketch — self-preview 범위 밖 .

structure-note: App DOM은 `app-shell > header.app-header` + optional `notice` + `main.workbench`이다. 이 LML artboard는 단일 `page(md:workbench)` 스케치를 위해 header·notice·workbench를 `v` row로 inline한다. **region·칸·순서·constraint는 1:1**; parent chain만 다르다.

layout-separator: column/section 구분은 **border** (`source-pane`/`canvas-pane` `border-right`, sidebar `border-bottom`). workbench grid·shell row 사이 **gap 없음**. LML `gap: 0`.

layout-variant:
  - default (w > 980px): 3-column grid — source | canvas | sidebar
  - compact (680px < w ≤ 980px): 2×2 — source+canvas 상단, sidebar 전폭 하단 row (`grid-template-rows: minmax(360px, 1fr) minmax(190px, 34%)`)
  - narrow (w ≤ 680px): stacked column — source → canvas → sidebar (`min-height: 900px` workbench)

layout-width (workbench columns, authoritative):
  - source: minmax(280px, 340px)
  - canvas: minmax(420px, 1fr)
  - sidebar: minmax(250px, 290px)

LML `h(340, 1fr, 290)`은 위 constraint의 nominal sketch이다.

layout-sketch-policy: LML `page(md:workbench)` artboard는 **default breakpoint (w > 980px) sketch만** 그린다. compact/narrow layout tree는 **MD `layout-variant` authoritative** (App `@media`). 이 예제는 variant `page` artboard를 추가하지 않는다.

dirty: `lml !== baseline.lml` OR `md !== baseline.md` OR `view.hiddenNodes` OR `view.visiblePages` OR `view.selectedPage` changed (App `documentName · 변경됨` suffix).

layout-note: App `app-header` `min-height: 58px`; LML header row is `fit` sketch.

# brand_block
## LML Workbench

App `brand-block`: brand mark `L`, 제품명, `document-name`(dirty 시 ` · 변경됨` suffix).

min-width: 210px

# preview_status
`VALID · 0 errors` | `EMPTY` | `INVALID · N error(s)`

App `status-pill`. LML compiler/validator 결과. header에서 brand 다음, template/actions 앞(`margin-right: auto`로 우측 그룹과 분리).

# template_picker
예제 `<select>` + `불러오기`

compact breakpoint에서 `order: 4`; narrow에서 전폭 row.

behavior: on load template → `confirmDiscard` then replace document; see `# new_action`

# new_action
새 문서

behavior: on activate → `confirmDiscard("새 문서를 생성")` then empty document v1, baseline reset, LML tab focus

# reset_action
샘플

behavior: on activate → `confirmDiscard("샘플로 초기화")` then reload default built-in template

# header_divider
App `span.header-divider` — `reset`과 `open` 사이 1px vertical rule (layout-only, no interaction).

# open_action
**열기**

behavior: on activate → `confirmDiscard("다른 문서를 열기")` then hidden file picker (`accept: application/json,.json`); shortcut Ctrl/Cmd+O

# save_action
**저장**

behavior: on activate → download JSON v1 (`lml`, `md`, `view`); shortcut Ctrl/Cmd+S; **always enabled** (no `disabled` when clean — dirty는 ` · 변경됨` 표시와 `confirmDiscard`에만 사용)

# notice
layout-presence: when noticeMessage != null
layout-absence: collapse row; workbench `1fr` row가 남은 높이 수신

success / error / info banner + dismiss `×`. App `{notice && (...)}` between header and workbench.

behavior: on dismiss → noticeMessage = null; cleared also on LML edit, outline visibility toggle, page visibility toolbar actions

# lml_header
## LML / MD Source tabs

LML / MD·노트 tablist + `Ln N, Col M` cursor position.

min-height: 43px (pane-title-row)

# lml_context
layout-presence: always (within source pane)

layout-condition:
  - when activeTab = lml: "Geometry source · 입력 즉시 compiler/validator 실행"
  - when activeTab = md: "실제 콘텐츠/발표자 노트 · geometry 측정 및 렌더링 비대상"

min-height: 31px

# lml_editor
Tab/Shift+Tab 들여쓰기 textarea. **LML 변경만** compiler와 canvas에 전달; MD 편집은 preview 비대상.

flex: 1 within source pane
min-height: 160px

```lml
host(align: leading, justify: start) {
page(w: 1fr, h: 1fr, pad: 32) {
    v(fit, 1fr, gap: 20) {
        md:title
        h(2fr, 1fr, gap: 16) {
            md:content
            md:aside
        }
    }
}
}
```

# lml_footer
char count, `Tab 2 spaces` 안내.

# preview_header
## Canvas
LML geometry only

Canvas pane title row (`pane-title-row`, gap 10px). Subtitle은 App `canvas-toolbar` 내 `span`.

# preview_zoom
25–200% zoom control (− / value / +).

transform: scale content within gallery stage
scale-range: 25% .. 200%
scale-step: 10%
scale-origin: top left
behavior: center button → reset 100%; stage-sizing inverse of scale (`width/height: 100/zoom`)

# preview_invalid
layout-presence: when previewError
layout-absence: remove from canvas scrollport

scrollport-boundary: App `.canvas-scroll` direct child ( **outside** zoom stage).

`Geometry preview paused` + error pre. **이전 geometry를 canvas에 남기지 않음.**

# preview_empty
layout-presence: when !previewError && !compiledDocument

scrollport-boundary: App `.canvas-scroll` direct child ( **outside** zoom stage).

`빈 LML 문서` — LML 탭에서 layout source 입력 안내.

# preview_no_pages
layout-presence: when !previewError && layoutRoot && visiblePages.isEmpty

scrollport-boundary: inside App `canvas-zoom-stage` > `canvas-transform` (with gallery path).

`표시된 Page가 없습니다` — Outline Page checkbox 안내.

# preview_gallery
layout-presence: when !previewError && layoutRoot && visiblePages.notEmpty

Page gallery wireframe (`PageGalleryRenderer`), outline hidden paths 반영, canvas/outline selection sync.

scrollport-boundary: inside App `canvas-zoom-stage` > `canvas-transform`.

scrollport: vertical (parent `.canvas-scroll`)
overflow: auto
padding: 28px (narrow breakpoint: 18px)

transform: zoom stage wraps gallery (see preview_zoom)

LML inner `v { preview_no_pages; preview_gallery }` = App zoom-stage subtree. MD `layout-presence`로 **한 번에 하나**만 표시.

```text
┌──────────────────────────────────────────────┐
│ md:title                                     │
├─────────────────────────────┬────────────────┤
│                             │                │
│         md:content          │    md:aside    │
│                             │                │
└─────────────────────────────┴────────────────┘
```

# outline_panel
## Outline
N/M Pages · K hidden

sidebar section heading row.

sticky: top of outline_section
scroll-container: outline_section

layout-height: max 42% of sidebar
min-height: 190px

# outline_toolbar
`모든 Page 표시` / `선택 Page만` / `모든 Page 숨김` / `노드 숨김 초기화`

layout: grid 2 columns × 2 rows (`page-visibility-toolbar`)

sticky: top 38px within outline_section
scroll-container: outline_section

behavior:
  - all → show every Page on canvas
  - selected → show selected Page only
  - none → hide all Pages on canvas
  - reset → clear non-Page hidden nodes

Outline checkbox는 canvas **표시** 상태만 변경. Page 숨김 → artboard 제거; 일반 노드 숨김 → geometry 유지, subtree 비표시.

# outline_tree
AST tree rows, per-node visibility checkbox, canvas/outline selection 동기화.

scrollport: shares outline_section vertical scroll with toolbar (toolbar sticky)

layout-presence: when outline.length > 0
layout-absence: show `"유효한 AST가 없습니다."` (`sidebar-empty`)

layout-condition: when node hidden by ancestor → row label `"상위 숨김"` (opacity/strike styles are §10)

# inspector_panel
## Inspector

선택 노드 kind, path, parameter, dimension, semantic ref.

min-height: 145px

empty: "Canvas 또는 Outline에서 노드를 선택하세요."

# diagnostics_panel
## Diagnostics

parse line/column + semantic diagnostic list.

flex: 1 within sidebar remainder (below outline + inspector)
min-height: 160px

scrollport: vertical when content overflows sidebar

empty ok: "검사 결과 이상 없음"

---

Workbench는 source-driven 편집기이다. canvas drag/resize-to-LML 직렬화는 **후속 product scope** (설계 언어 gap 아님).
