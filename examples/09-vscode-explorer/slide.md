# explorer
## Explorer · expanded

VS Code **Explorer** view. 초기 artboard는 `explorer`이다. Activity bar에서 Explorer가 활성이고, primary sidebar에 OPEN EDITORS·workspace tree가 펼쳐진 상태다. `utils.ts`가 tree에서 선택되고 editor group에 `main.ts`·`utils.ts` 탭이 열려 있다.

structure-note: 세 artboard(`explorer`, `explorer_collapsed`, `explorer_context_menu`)는 **UI state sketch**다 — Figma state frame 3장. [`06-store-flow`](../06-store-flow/) Page **navigation**과 다르다. 동일 1280×800 desktop shell; Activity bar + sidebar + editor geometry 공유. section collapse·context menu만 `layout-presence`로 구분. **구현:** 단일 view + `openEditorsExpanded` / `collapsedFolders` / `contextTarget` state; Page 전환·라우터 API 없음. LML geometry 복제·각 slot의 distinct ref·MD cross-reference로 동일성을 표현한다.

structure-note: `tree_*`·`open_editor_*` 항목은 **wireframe sample**이다. 실제 workspace file catalog 전체가 아님. expand/collapse·selection·drag-drop 동작은 MD `behavior`; runtime tree·virtual scroll은 구현.

layout-separator: activity bar·sidebar·editor area, tab bar·editor body, section header·tree row 사이 **border** (`1px`). LML `gap: 0`.

scrollport: vertical — `explorer` artboard **sidebar only**. LML 경로: `page(explorer)` → `h(48,260,1fr)` **col 2** → `v(fit,1fr)` → **`explorer_header` 다음** dimensionless `v(gap:0)` (`section_open_editors` … `tree_readme_md` 전부). `explorer_header`는 scrollport **밖**.

scrollport: editor — 없음. `editor_content` 단일 buffer; tab bar `h(fit,fit,1fr,fit)` 고정.

sticky:
  - `explorer_header` — scrollport 밖, sidebar 상단 고정
  - `section_open_editors` · `section_workspace` — scrollport **안**, scroll 중 section label sticky

structure-note: `tree_*`·`open_editor_*` row = `[twistie? | icon | label | decoration?]`. indent = depth × 12px. folder `▼`/`▸` = `tree_*_folder`·`section_*` header. runtime tree = data `map` + virtual scroll; LML slot = **sample anchor only**.

width: sidebar 260px (default; user-resizable — authoritative in MD, 별도 artboard 없음)

# activity_bar
**Explorer(활성)** · Search · Source Control · Run · Extensions · Accounts

Activity bar icon rail. Explorer view가 primary sidebar에 표시된다.

width: 48px

# explorer_header
EXPLORER · New File · New Folder · Refresh · Collapse All

sidebar view title + view actions.

# section_open_editors
▼ OPEN EDITORS

collapsible section header. 펼침 상태.

# open_editor_main
main.ts · modified dot

open editor item. dirty indicator optional.

# open_editor_utils
utils.ts

# section_workspace
▼ LML

workspace root folder name (folder name = repo root).

# tree_src_folder
▼ src

expanded folder. chevron down.

# tree_index_ts
  index.ts

indent level 1.

# tree_utils_ts
  **utils.ts** · selected

현재 tree selection. editor의 active tab과 연동.

# tree_main_ts
  main.ts

# tree_tests_folder
▼ tests

# tree_app_test_ts
  app.test.ts

# tree_package_json
package.json

root-level file.

# tree_readme_md
README.md

# tab_main_ts
main.ts

editor tab. active가 아님 (`utils.ts`가 active).

# tab_utils_ts
**utils.ts** · active · modified

active editor tab.

# tab_group_actions
Split Editor · Close

# editor_content
```typescript
export function formatPath(path: string): string {
  return path.replace(/\\/g, '/');
}
```

`utils.ts` buffer. syntax highlight·line numbers·minimap은 구현 styling.

behavior:
  - section header click → toggle `openEditorsExpanded` / folder `expanded`
  - tree item click → `selectedUri`; single-click file → preview or activate tab (workbench setting)
  - tree item double-click → open file in editor group
  - `explorer_header` Refresh → rescan workspace; Collapse All → all folders collapsed → `explorer_collapsed` artboard와 동일 layout intent
  - drag file row → move/reorder (out of scope for static artboard)

---

# explorer_collapsed
## Explorer · collapsed sections

OPEN EDITORS section과 `src` folder가 접힌 상태. editor에는 `main.ts`만 탭으로 남아 있다.

structure-note: desktop shell — baseline `# explorer`. `collapsed_*` = 동일 shell; OPEN EDITORS·`src` child만 `layout-presence`/`layout-absence`로 다름. **구현:** 단일 view + `openEditorsExpanded=false` · `collapsedFolders` includes `src` — Page navigation 아님 (#13).

scrollport: vertical — `explorer_collapsed` sidebar: `collapsed_explorer_header` **제외**, 그 아래 dimensionless `v(gap:0)` (`collapsed_section_open_editors` … `collapsed_tree_readme_md`).

layout-presence: `collapsed_section_open_editors` — chevron right, child rows absent
layout-absence: `explorer` artboard의 `open_editor_*` subtree
layout-presence: `collapsed_tree_src_folder` — collapsed; `tree_index_ts`·`tree_utils_ts`·`tree_main_ts` absent
layout-absence: `explorer` artboard의 `tree_src_folder` child file rows

초기 진입: `explorer`에서 Collapse All 또는 section/folder header toggle.

# collapsed_activity_bar
**Explorer(활성)** · Search · Source Control · Run · Extensions · Accounts

동일 — `# activity_bar`

# collapsed_explorer_header
EXPLORER · New File · New Folder · Refresh · Collapse All

# collapsed_section_open_editors
▸ OPEN EDITORS

collapsed. child rows hidden.

# collapsed_section_workspace
▼ LML

# collapsed_tree_src_folder
▸ src

collapsed folder.

# collapsed_tree_tests_folder
▼ tests

# collapsed_tree_app_test_ts
  app.test.ts

# collapsed_tree_package_json
package.json

# collapsed_tree_readme_md
README.md

# collapsed_tab_main_ts
**main.ts** · active

# collapsed_tab_group_actions
Split Editor · Close

# collapsed_editor_content
```typescript
import { formatPath } from './utils';

console.log(formatPath(process.cwd()));
```

`main.ts` buffer.

behavior: section/folder header click → expand → `explorer` artboard와 동일 expanded layout intent

---

# explorer_context_menu
## Explorer · context menu

`utils.ts` tree row에서 context menu(우클릭)가 열린 상태.

structure-note: desktop shell — baseline `# explorer`. `menu_*` = 동일 shell; `context_menu` `at` overlay만 추가. **구현:** 단일 view + `contextTarget=utils.ts` — Page navigation 아님 (#13).

scrollport: vertical — `explorer_context_menu` sidebar: `menu_explorer_header` **제외**, 그 아래 dimensionless `v(gap:0)` (context menu overlay는 scrollport 안 `z` on `menu_tree_utils_ts`).

초기 진입: `explorer`에서 `tree_utils_ts` context menu.

# menu_activity_bar
**Explorer(활성)** · Search · Source Control · Run · Extensions · Accounts

동일 — `# activity_bar`

# menu_explorer_header
EXPLORER · New File · New Folder · Refresh · Collapse All

# menu_section_open_editors
▼ OPEN EDITORS

# menu_open_editor_main
main.ts

# menu_open_editor_utils
utils.ts

# menu_section_workspace
▼ LML

# menu_tree_src_folder
▼ src

# menu_tree_index_ts
  index.ts

# menu_tree_utils_ts
  **utils.ts** · context target

context menu anchor row. highlight.

# menu_tree_main_ts
  main.ts

# menu_tree_tests_folder
▼ tests

# menu_tree_app_test_ts
  app.test.ts

# menu_tree_package_json
package.json

# menu_tree_readme_md
README.md

# context_menu
Open to the Side · Open With… · Reveal in File Explorer · Cut · Copy · Paste · Copy Path · Copy Relative Path · Rename… · Delete

`at` overlay — `menu_tree_utils_ts` **row 전체** hit target 기준. `left: 24` = parent folder indent + label 시작 (LML sketch).

behavior:
  - context menu anchor = **full row** (twistie·icon·label 포함), label cell만 아님
  - Rename… → inline input on row (별도 artboard 없음 — MD behavior only)
  - Delete → confirmation dialog (out of scope)
  - Cut/Copy/Paste → clipboard + file ops
  - Escape or outside click → dismiss menu; `explorer` 복귀
  - menu item activate → command execution; menu close

# menu_tab_main_ts
main.ts

# menu_tab_utils_ts
**utils.ts** · active

# menu_tab_group_actions
Split Editor · Close

# menu_editor_content
```typescript
export function formatPath(path: string): string {
  return path.replace(/\\/g, '/');
}
```
