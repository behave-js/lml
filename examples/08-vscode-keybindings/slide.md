# keyboard_shortcuts
## Keyboard Shortcuts

VS Code **Keyboard Shortcuts** editor tab. 초기 artboard는 `keyboard_shortcuts`이다. 사용자는 검색·정렬·필터로 명령을 좁히고, 행의 Keybinding 셀을 선택해 `keybinding_edit`으로 전환하거나 toolbar의 Record Keybindings로 `keybinding_record`에 진입한다.

structure-note: 세 artboard(`keyboard_shortcuts`, `keybinding_record`, `keybinding_edit`)는 **UI state sketch**다 — Figma state frame 3장. [`06-store-flow`](../06-store-flow/) Page **navigation**(catalog→cart 등)과 다르다. 동일 1280×800 desktop shell; Activity bar + editor tab + shortcuts table geometry 공유. toolbar 상태·banner·inline editor만 `layout-presence`로 구분. **구현:** 단일 view + `recording` / `editingCommand` state; Page 전환·라우터 API 없음. LML geometry 복제·각 slot의 distinct ref·MD cross-reference로 동일성을 표현한다.

structure-note: `row_*` 9행은 **wireframe sample**이다. 실제 제품 command catalog(수백~수천) 전체가 아님. 검색·정렬·필터 동작은 MD `behavior`; runtime list·virtual scroll은 구현.

layout-separator: activity bar와 editor area, tab bar와 shortcuts body 사이 **border** (`1px`). column/table row 구분도 border. LML `gap: 0`.

scrollport: vertical — table body (`row_*` subtree)만 독립 scroll. toolbar·column header는 sticky.

sticky:
  - `shortcuts_search` toolbar row — tab bar 아래 고정
  - `col_*` header row — toolbar 아래 고정

layout-variant:
  - default (w ≥ 900px): 4-column table — Command | Keybinding | When | Source
  - compact (w < 900px): When 열 접기; Source는 row detail 또는 hover tooltip (authoritative in MD, 별도 artboard 없음)

# activity_bar
Explorer · Search · Source Control · Run · Extensions · **Keyboard Shortcuts(활성)**

Activity bar icon rail. Keyboard Shortcuts는 Settings gear 메뉴 또는 Command Palette `Preferences: Open Keyboard Shortcuts`로 열린 editor tab이므로 activity bar에는 직접 항목이 없을 수 있다 — 여기서는 VS Code shell 맥락용 placeholder.

width: 48px

# tab_keyboard_shortcuts
Keyboard Shortcuts

editor group tab. dirty dot 없음(읽기 전용 JSON이 아닌 UI 편집이지만 tab 자체는 settings view).

# tab_group_actions
Split Editor · Close

editor tab 우측 group actions.

# shortcuts_search
Type to search in keybindings

검색 입력. `@command:` `@keybinding:` `@source:` prefix 필터 지원.

behavior: on input change → `filteredCommands` 갱신; table body scroll top reset

# record_keybindings
Record Keybindings

toolbar toggle. 비활성(기본). 활성화 시 `keybinding_record` artboard로 전환.

behavior: on activate → `recording = true`; on Escape → `recording = false`, `keyboard_shortcuts` 복귀

# sort_keybindings
Sort by Precedence

기본 정렬: command title ascending. precedence 모드에서는 keybinding conflict resolution order 기준.

# filter_keybindings
Filter

`User` / `Default` / `Extension` source filter + `Unassigned` keybinding filter.

# open_keybindings_json
Open Keyboard Shortcuts (JSON)

`keybindings.json`을 side-by-side editor tab으로 연다. User keybinding override 파일.

behavior: on activate → open `keybindings.json` in new editor tab; UI 변경은 JSON에 반영

# col_command
Command

# col_keybinding
Keybinding

# col_when
When

# col_source
Source

# row_open_file
Open File · **Ctrl+O** · — · Default

# row_save
Save · **Ctrl+S** · `!editorReadonly` · Default

# row_find
Find · **Ctrl+F** · `editorFocus` · Default

# row_quick_open
Go to File… · **Ctrl+P** · — · Default

# row_command_palette
Show All Commands · **Ctrl+Shift+P** · — · Default

# row_go_to_line
Go to Line/Column… · **Ctrl+G** · `editorTextFocus` · Default

# row_toggle_terminal
Toggle Terminal · **Ctrl+`** · — · Default

# row_format_document
Format Document · **Shift+Alt+F** · `editorHasDocumentFormattingProvider && editorTextFocus && !editorReadonly` · Default

# row_toggle_sidebar
Toggle Primary Side Bar Visibility · **Ctrl+B** · — · Default

behavior: row click → select command; keybinding cell double-click → `keybinding_edit` with `editingCommand` = 해당 행 command; context menu → Change Keybinding / Remove Keybinding / Copy Command ID / Reset Keybinding

---

# keybinding_record
## Keyboard Shortcuts · recording

`record_keybindings` 활성 상태. 상단 banner가 keystroke capture 모드를 표시한다.

layout-presence: `record_banner` when `recording = true`
layout-absence: `keyboard_shortcuts` artboard에서는 banner row 제거

# record_activity_bar
Explorer · Search · Source Control · Run · Extensions

# record_tab_keyboard_shortcuts
Keyboard Shortcuts

# record_tab_group_actions
Split Editor · Close

# record_banner
Recording keystrokes. Press **Escape** to exit · **Listening…**

info banner. Escape 시 `recording = false`, `keyboard_shortcuts` 복귀.

layout-presence: when `recording = true`

# record_shortcuts_search
Type to search in keybindings

# record_keybindings_active
**Record Keybindings** · active

toggle on 상태. accent/highlight (§10 style).

# record_sort_keybindings
Sort by Precedence

# record_filter_keybindings
Filter

# record_open_keybindings_json
Open Keyboard Shortcuts (JSON)

# record_col_command
Command

# record_col_keybinding
Keybinding

# record_col_when
When

# record_col_source
Source

# record_row_open_file
Open File · **Ctrl+O** · — · Default

# record_row_save
Save · **Ctrl+S** · `!editorReadonly` · Default

# record_row_find
Find · **Ctrl+F** · `editorFocus` · Default

# record_row_quick_open
Go to File… · **Ctrl+P** · — · Default

# record_row_command_palette
Show All Commands · **Ctrl+Shift+P** · — · Default

# record_row_go_to_line
Go to Line/Column… · **Ctrl+G** · `editorTextFocus` · Default

# record_row_toggle_terminal
Toggle Terminal · **Ctrl+`** · — · Default

# record_row_format_document
Format Document · **Shift+Alt+F** · `editorHasDocumentFormattingProvider && editorTextFocus && !editorReadonly` · Default

# record_row_toggle_sidebar
Toggle Primary Side Bar Visibility · **Ctrl+B** · — · Default

behavior: recording 중 table row click → 해당 command에 누른 chord 할당; chord가 기존 binding과 충돌하면 conflict prompt(별도 dialog — 이 예제 artboard 범위 밖); 성공 시 User source로 갱신하고 `keyboard_shortcuts` 복귀

---

# keybinding_edit
## Keyboard Shortcuts · inline edit

`row_format_document` keybinding 셀 편집 중. chord input overlay가 해당 행 위에 표시된다.

초기 진입: `keyboard_shortcuts`에서 Format Document keybinding double-click.

# edit_activity_bar
Explorer · Search · Source Control · Run · Extensions

# edit_tab_keyboard_shortcuts
Keyboard Shortcuts

# edit_tab_group_actions
Split Editor · Close

# edit_shortcuts_search
Type to search in keybindings

# edit_record_keybindings
Record Keybindings

# edit_sort_keybindings
Sort by Precedence

# edit_filter_keybindings
Filter

# edit_open_keybindings_json
Open Keyboard Shortcuts (JSON)

# edit_col_command
Command

# edit_col_keybinding
Keybinding

# edit_col_when
When

# edit_col_source
Source

# edit_row_open_file
Open File · Ctrl+O · — · Default

# edit_row_save
Save · Ctrl+S · `!editorReadonly` · Default

# edit_row_find
Find · Ctrl+F · `editorFocus` · Default

# edit_row_quick_open
Go to File… · Ctrl+P · — · Default

# edit_row_command_palette
Show All Commands · Ctrl+Shift+P · — · Default

# edit_row_go_to_line
Go to Line/Column… · Ctrl+G · `editorTextFocus` · Default

# edit_row_toggle_terminal
Toggle Terminal · Ctrl+` · — · Default

# edit_row_format_document
Format Document · **Press desired key combination…** · `editorHasDocumentFormattingProvider && editorTextFocus && !editorReadonly` · Default

편집 중 행 highlight. 기존 `Shift+Alt+F`는 input 대기 상태로 비워진다.

# edit_chord_input
Press desired key combination… · Enter to assign · Escape to cancel

`at` overlay — `edit_row_format_document` keybinding cell 위 inline chord capture.

behavior:
  - Enter + valid chord → assign User keybinding; `keyboard_shortcuts` 복귀
  - Escape → cancel edit; restore previous keybinding display
  - chord conflict → show conflict list dialog (out of scope for this artboard)

# edit_row_toggle_sidebar
Toggle Primary Side Bar Visibility · Ctrl+B · — · Default
