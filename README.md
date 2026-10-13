**언어:** **한국어** | [English](README.en.md)

# LML — Layout Markup Language

LML은 UI와 슬라이드의 **레이아웃 기하 구조(layout geometry)** 를 텍스트로 기술하는 간결한 형식입니다. 콘텐츠와 설계 의도는 Markdown으로 함께 기록합니다. 레이아웃을 스케치하거나 여러 아트보드를 비교하고, AI 어시스턴트 또는 개발자에게 설계 구조를 전달할 때 활용할 수 있습니다.

**상태:** v0.1. 실험적이지만 실제로 사용 가능한 레이아웃 표기 언어입니다. React/SwiftUI 컴포넌트 프레임워크나 완성된 UI 렌더러는 아닙니다.

## 기본 개념

- **LML (`slide.lml`):** 인스턴스화된 레이아웃 트리 — 영역, 중첩, 순서, 열, 간격, 크기, 오버레이 등을 기술합니다.
- **Markdown (`slide.md`):** 이름이 붙은 콘텐츠와 의미, 상호작용, 반응형·조건부 규칙, 구현 관련 메모를 기록합니다.
- **구현:** React, SwiftUI, CSS 등에서 이 두 파일을 함께 해석할 수 있으며, 시각적 스타일은 구현자가 자유롭게 결정합니다.

**`LML + MD` 한 쌍이 설계 명세**를 이룹니다. `md:name`은 LML 영역과 Markdown의 `# name` 블록을 연결하는 **시맨틱 앵커(semantic anchor)** 입니다. Markdown을 미리보기에 자동 렌더링하라는 명령은 아닙니다.

## 예제

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

LML은 기준이 되는 레이아웃 구조를 기술합니다. v0.1 LML 문법에서 직접 표현하지 않는 반응형 전환이나 제약 조건은 Markdown에 정의할 수 있습니다.

## 로컬에서 실행하기

```bash
npm install
npm run wysiwyg
```

브라우저 기반 워크벤치에서 LML 소스를 편집하고, 기하 구조를 검증하며, 와이어프레임을 미리볼 수 있습니다. **미리보기는 LML의 기하 구조만 렌더링**합니다. Markdown은 설계와 인계를 위한 문맥으로 함께 편집할 수 있지만 미리보기에 자동으로 나타나지는 않습니다.

테스트를 실행하고 TypeScript 패키지를 빌드하려면:

```bash
npm test
npm run build
npm run test:package
```

로컬 패키지는 `parseLml`, `validateLml`, `parseMarkdownBlocks`, `joinSlide`를 제공합니다. 이들은 파싱·검증·선택적인 참조 연결을 위한 유틸리티이며, 완전한 UI 렌더러는 아닙니다.

## v0.1에서 지원하는 것

- `host`, `page`, 세로 `v`, 가로 `h`, 오버레이 `z`, 절대 위치 `at`, `grid`
- `md:ref`, 인라인 Markdown 메모, `space`
- 고정 크기, 백분율, `fr`, `fit`, 간격, 패딩, 정렬
- 여러 페이지·아트보드 스케치와, MD에 기록하는 화면별 의미·동작 차이

**의도적인 경계:** 모든 반응형·동적 레이아웃 규칙을 LML 문법으로 직접 표현하지는 않습니다. 상태 변화, 스크롤·sticky 역할, breakpoint, min/max 제약, 상호작용은 Markdown으로 설명할 수 있습니다. 정확한 설계 계약은 설계 전제와 시맨틱 명세를 참고하세요.

## 저장소 살펴보기

- [LML + Markdown 예제 9쌍](examples/README.md) — 슬라이드, 대시보드, 상거래 플로우, 모바일 화면, 데스크톱 UI 스케치
- [워크벤치 사용 안내](wysiwyg/README.md)
- [설계 전제](docs/design-premises.md)
- [v0.1 문법](docs/v0.1/grammar.md) 및 [EBNF 문법 정의](docs/v0.1/grammar.ebnf)
- [v0.1 시맨틱 명세](docs/v0.1/semantic-spec.md) 및 [AST](docs/v0.1/ast.md)

## 라이선스

MIT — [LICENSE](LICENSE) 참고.
