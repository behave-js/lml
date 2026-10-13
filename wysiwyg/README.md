# LML WYSIWYG Workbench

Vite + React + TypeScript source-driven LML geometry 편집기.

**Project premise:** SwiftUI의 layout·semantic(스타일 제외)은 [LML+MD 설계](../docs/design-premises.md)로 기록한다. 이 Workbench는 편집 중인 대상 문서의 LML geometry만 검증하고 wireframe으로 보여준다.

Live preview는 **LML geometry만** compile·validate·wireframe 한다 (설계 전제와 별개 runtime).

## 현재 동작 범위

| 영역 | 동작 |
|------|------|
| Source | LML/MD 탭, 실시간 편집, Tab/Shift+Tab 들여쓰기, line/column 표시 |
| Canvas | 체크된 Page들을 겹치지 않는 독립 artboard로 표시하고, 숨긴 일반 노드는 geometry를 유지한 채 보이지 않게 처리. 25–200% zoom, canvas/outline 양방향 노드 선택 |
| Outline | 전체 AST 노드마다 checkbox 제공. checkbox는 canvas 표시를, 별도 행 버튼은 선택과 Inspector 대상을 제어 |
| Inspector | 선택 노드 kind/path/parameter/dimension/ref 조회 |
| Diagnostics | parse 위치와 semantic diagnostic 표시. 오류가 있으면 오래된 geometry를 표시하지 않음 |
| Document | JSON v1 새 문서·샘플 초기화·열기·저장, 내장 예제 선택/불러오기, dirty 상태 및 덮어쓰기 확인, `Ctrl/Cmd+O`, `Ctrl/Cmd+S` |

이 단계는 LML source를 편집하는 functional workbench다. Canvas drag/resize를 다시 LML source로 직렬화하는 직접 조작 기능은 아직 포함하지 않는다. 다만 canvas와 outline이 공유하는 stable node path/selection을 마련해 후속 직접 조작의 기반으로 사용한다.

## Workbench geometry 참조

- **설계 예제:** [`examples/04-wysiwyg-system/`](../examples/04-wysiwyg-system/) — workbench chrome의 LML+MD 레이아웃 기록
- **구현:** [`src/App.tsx`](src/App.tsx), [`src/styles.css`](src/styles.css)

설계와 구현이 달라졌다면 관련 LML+MD 예제를 최신 설계 의도에 맞게 갱신한다.

## 내장 예제

상단의 예제 선택기에서 항목을 고르고 `불러오기`를 눌러 명시적으로 적용한다. 편집 중인 문서가 변경된 상태라면 덮어쓰기 확인을 거치며 취소하면 현재 LML, MD, Page view 상태를 유지한다.

- **기본 레이아웃** — 단일 Page 편집 시작점
- **상점 구매 흐름** — 실제 [`examples/06-store-flow`](../examples/06-store-flow/) LML/MD 파일을 raw source로 불러오는 5 Page 예제. 복제된 문자열을 별도로 관리하지 않는다.

모든 checkbox와 표시 명령은 편집기 view 상태만 바꾸며 LML이나 MD를 수정하지 않는다.

- Page를 끄면 해당 artboard 전체가 canvas에서 빠진다.
- Host, V/H/Z, At, Grid, `md:*`, inline MD, Spacer 등 일반 노드를 끄면 CSS `visibility:hidden`처럼 자리와 layout geometry는 유지한 채 subtree만 보이지 않는다.
- 부모를 끄더라도 자식의 직접 checkbox 상태는 보존된다. 자식 행은 `상위 숨김`으로 흐리게 표시되고 부모를 다시 켜면 이전 자식 상태가 복원된다.
- 숨긴 노드도 Outline에서 선택하여 Inspector로 확인할 수 있다.
- `모든 Page 표시`·`선택 Page만`·`모든 Page 숨김`은 Page에만 적용하므로 하위 노드의 숨김 상태를 지우지 않는다. `노드 숨김 초기화`는 반대로 Page 상태를 보존하고 일반 노드만 다시 표시한다.

## LML과 MD의 경계

- Live preview·validation·wireframe **runtime**은 **LML geometry만** 사용한다.
- **설계**는 LML+MD together ([design-premises](../docs/design-premises.md)): MD에 layout 규칙·조건·동작, LML에 geometry tree.
- `md:ref`는 semantic anchor. wireframe에 MD body를 자동 주입하지 않는다.

## JSON v1

```json
{
  "version": 1,
  "lml": "host { page(md:catalog, w: 960, h: 540) { ... } }",
  "md": "# catalog\n## Page description\n...",
  "view": {
    "visiblePages": ["ref:catalog"],
    "selectedPage": "ref:catalog",
    "hiddenNodes": [
      {
        "key": "page:ref%3Acatalog|0",
        "fingerprint": "{\"kind\":\"VStack\",\"params\":[]}"
      }
    ]
  }
}
```

`view`는 optional editor workspace state다. `visiblePages`는 기존 JSON 소비자를 위해 계속 저장하며 `hiddenNodes`는 전체 노드의 숨김 예외만 기록한다. 기록이 없는 노드는 visible이다. 이전 `{version,lml,md}` 또는 Page 상태만 있는 JSON도 그대로 열리며 이 경우 기존 규칙대로 첫 Page만 표시하고 일반 노드는 모두 표시한다.

이름 있는 Page는 `md:ref`를 identity scope로 사용하므로 Page 순서를 바꿔도 그 Page와 하위 노드의 상태가 유지된다. 같은 Page 안에서 노드 삽입이나 순서 변경으로 path가 밀리면 kind·ref·parameter·dimension 등의 shallow fingerprint가 유일할 때만 상태를 이전한다. 현재 path가 우연히 같더라도 동일 fingerprint 후보가 둘 이상이면 모호한 것으로 보고, 잘못된 노드를 숨기지 않도록 기록을 제거한다. Page의 `md:ref`를 바꾸면 새 Page로 취급하며 새 노드는 기본 visible이다. LML이 편집 도중 일시적으로 invalid가 되어도 기존 visibility 상태는 폐기하지 않는다. 선택 Page가 없는 이전 JSON은 표시 중인 첫 Page(모두 숨김이면 문서의 첫 Page)를 선택값으로 정규화하므로 파일을 연 직후 불필요한 dirty 상태가 생기지 않는다.

이 visibility는 runtime 조건, Page transition 또는 LML 속성이 아니다. 실제 연결 관계와 상태 전이는 MD에 설명한다.

잘못된 파일이나 지원하지 않는 version을 열면 inline 오류를 표시하고 현재 편집 상태는 유지한다. MD named block은 CommonMark ATX H1 `# ref_name`으로 시작하며 내부 제목은 `##`부터 사용한다.

## 실행

```bash
cd wysiwyg
npm install
npm run dev
```

또는 저장소 루트에서:

```bash
npm run wysiwyg
```

개발 서버와 `npm run preview`는 모두 `127.0.0.1:15111`을 사용하며, 다른 프로세스가 포트를 사용 중이면 임의 포트로 이동하지 않고 종료한다.

프로덕션 검증:

```bash
npm run typecheck
npm run build
```
