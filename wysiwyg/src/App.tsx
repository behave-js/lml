import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  applyPageVisibilityToHidden,
  applyTabIndent,
  buildOutline,
  clampZoom,
  clearNonPageHiddenNodes,
  compileLmlSource,
  cursorPosition,
  extractPageEntries,
  getNodeAtPath,
  hiddenPathKeys,
  inspectNode,
  isNodeDirectlyVisible,
  isNodeEffectivelyHidden,
  normalizeWorkspaceView,
  pageEntryForPath,
  reconcileHiddenNodes,
  resolveSelectionPath,
  sameHiddenNodes,
  sameNodePath,
  toggleNodeVisibility,
  visiblePageKeysFromHidden,
  type NodePath,
} from "./editorModel.js";
import { useLmlPreview } from "./hooks/useLmlPreview.js";
import { downloadJson, readJsonFile } from "./lib/io.js";
import { geometryPreviewError } from "./previewDiagnostics.js";
import { PageGalleryRenderer } from "./renderer/WireframeRenderer.js";
import { BUILT_IN_TEMPLATES, DEFAULT_TEMPLATE, findTemplate } from "./templates.js";
import { createEmptyDocument, type HiddenNodeRecord, type WysiwygDocument } from "./types.js";

type SourceTab = "lml" | "md";
type Notice = { kind: "success" | "error" | "info"; text: string };

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function compileBaseline(source: string) {
  const result = compileLmlSource(source);
  const root = result.document?.root;
  return root?.kind === "Host" || root?.kind === "Page" ? root : null;
}

function documentSelectionPath(document: WysiwygDocument): NodePath {
  const root = compileBaseline(document.lml);
  if (!root) return [];
  const pages = extractPageEntries(root);
  const outline = buildOutline(root);
  const view = normalizeWorkspaceView(outline, pages, document.view?.hiddenNodes, document.view?.visiblePages, document.view?.selectedPage);
  return pages.find((page) => page.key === view.selectedPage)?.path ?? [];
}

function documentWorkspaceView(document: WysiwygDocument) {
  const root = compileBaseline(document.lml);
  if (!root) return { hiddenNodes: document.view?.hiddenNodes ?? [], visiblePages: document.view?.visiblePages ?? [], selectedPage: document.view?.selectedPage };
  const outline = buildOutline(root);
  const pages = extractPageEntries(root);
  return normalizeWorkspaceView(outline, pages, document.view?.hiddenNodes, document.view?.visiblePages, document.view?.selectedPage);
}

export function App() {
  const [lml, setLml] = useState(DEFAULT_TEMPLATE.document.lml);
  const [md, setMd] = useState(DEFAULT_TEMPLATE.document.md);
  const [baseline, setBaseline] = useState(DEFAULT_TEMPLATE.document);
  const [documentName, setDocumentName] = useState(DEFAULT_TEMPLATE.name);
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE.id);
  const [activeTab, setActiveTab] = useState<SourceTab>("lml");
  const [cursorOffset, setCursorOffset] = useState(0);
  const [notice, setNotice] = useState<Notice | null>({ kind: "info", text: "샘플 문서가 준비되었습니다." });
  const [zoom, setZoom] = useState(100);
  const [selectedPath, setSelectedPath] = useState<NodePath | null>(() => documentSelectionPath(DEFAULT_TEMPLATE.document));
  const [hiddenNodes, setHiddenNodes] = useState<HiddenNodeRecord[]>(() => documentWorkspaceView(DEFAULT_TEMPLATE.document).hiddenNodes);
  const [selectedPageKey, setSelectedPageKey] = useState<string | undefined>(() => documentWorkspaceView(DEFAULT_TEMPLATE.document).selectedPage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const preview = useLmlPreview(lml);
  const { document: compiledDocument, diagnostics, parseError, status } = preview;
  const errors = diagnostics.filter((entry) => entry.severity === "error");
  const previewError = geometryPreviewError(parseError?.message ?? null, diagnostics);
  const layoutRoot = !previewError && compiledDocument && (compiledDocument.root.kind === "Host" || compiledDocument.root.kind === "Page")
    ? compiledDocument.root
    : null;
  const activeSource = activeTab === "lml" ? lml : md;
  const cursor = cursorPosition(activeSource, cursorOffset);

  const outline = useMemo(
    () => layoutRoot ? buildOutline(layoutRoot) : [],
    [layoutRoot],
  );
  const pageEntries = useMemo(() => layoutRoot ? extractPageEntries(layoutRoot) : [], [layoutRoot]);
  const currentHiddenNodes = useMemo(
    () => layoutRoot ? reconcileHiddenNodes(outline, hiddenNodes) : hiddenNodes,
    [hiddenNodes, layoutRoot, outline],
  );
  const visiblePageKeys = useMemo(
    () => visiblePageKeysFromHidden(outline, pageEntries, currentHiddenNodes),
    [outline, pageEntries, currentHiddenNodes],
  );
  const visiblePages = useMemo(
    () => pageEntries.filter((entry) => visiblePageKeys.includes(entry.key)),
    [pageEntries, visiblePageKeys],
  );
  const baselineView = useMemo(() => {
    const compiled = compileBaseline(baseline.lml);
    if (!compiled) return { hidden: baseline.view?.hiddenNodes ?? [], visible: baseline.view?.visiblePages ?? [], selected: baseline.view?.selectedPage };
    const baselineOutline = buildOutline(compiled);
    const entries = extractPageEntries(compiled);
    const normalized = normalizeWorkspaceView(baselineOutline, entries, baseline.view?.hiddenNodes, baseline.view?.visiblePages, baseline.view?.selectedPage);
    return { hidden: normalized.hiddenNodes, visible: normalized.visiblePages, selected: normalized.selectedPage };
  }, [baseline]);
  const currentVisible = visiblePageKeys;
  const dirty = lml !== baseline.lml || md !== baseline.md ||
    !sameHiddenNodes(currentHiddenNodes, baselineView.hidden) ||
    !sameStrings(currentVisible, baselineView.visible) || selectedPageKey !== baselineView.selected;
  const selectedNode = layoutRoot && selectedPath ? getNodeAtPath(layoutRoot, selectedPath) : null;
  const inspector = selectedNode && selectedPath ? inspectNode(selectedNode, selectedPath) : [];
  const rendererHiddenPaths = useMemo(
    () => hiddenPathKeys(outline, currentHiddenNodes),
    [outline, currentHiddenNodes],
  );

  useEffect(() => {
    if (!layoutRoot) {
      setSelectedPath(null);
      return;
    }
    setSelectedPath((current) => {
      const next = resolveSelectionPath(layoutRoot, current);
      return sameNodePath(current, next) ? current : next;
    });
  }, [layoutRoot]);

  useEffect(() => {
    if (!layoutRoot) return;
    setHiddenNodes((current) => {
      const next = reconcileHiddenNodes(outline, current);
      return sameHiddenNodes(current, next) ? current : next;
    });
    setSelectedPageKey((current) => pageEntries.some((entry) => entry.key === current)
      ? current
      : pageEntries[0]?.key);
  }, [layoutRoot, outline, pageEntries]);

  const saveDocument = useCallback(() => {
    const doc: WysiwygDocument = {
      version: 1,
      lml,
      md,
      view: {
        visiblePages: currentVisible,
        ...(selectedPageKey ? { selectedPage: selectedPageKey } : {}),
        hiddenNodes: currentHiddenNodes,
      },
    };
    downloadJson(doc);
    setBaseline(doc);
    setNotice({ kind: "success", text: "현재 LML과 MD를 JSON v1으로 저장했습니다." });
  }, [currentHiddenNodes, currentVisible, lml, md, selectedPageKey]);

  const openDocument = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveDocument();
      } else if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        openDocument();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [openDocument, saveDocument]);

  const replaceDocument = useCallback((doc: WysiwygDocument, name: string, message: string) => {
    const view = documentWorkspaceView(doc);
    setLml(doc.lml);
    setMd(doc.md);
    setBaseline(doc);
    setDocumentName(name);
    setActiveTab("lml");
    setSelectedPath(documentSelectionPath(doc));
    setHiddenNodes(view.hiddenNodes);
    setSelectedPageKey(view.selectedPage);
    setCursorOffset(0);
    setNotice({ kind: "success", text: message });
  }, []);

  const selectNode = useCallback((path: NodePath) => {
    setSelectedPath(path);
    const page = pageEntryForPath(pageEntries, path);
    if (page) setSelectedPageKey(page.key);
  }, [pageEntries]);

  const toggleOutlineNode = useCallback((visibilityKey: string) => {
    setHiddenNodes((current) => toggleNodeVisibility(outline, current, visibilityKey));
    setNotice(null);
  }, [outline]);

  const confirmDiscard = useCallback((action: string): boolean => (
    !dirty || window.confirm(`저장하지 않은 변경이 있습니다. ${action}할까요?`)
  ), [dirty]);

  const handleNew = useCallback(() => {
    if (!confirmDiscard("새 문서를 생성")) return;
    replaceDocument(createEmptyDocument(), "Untitled", "빈 문서를 만들었습니다.");
  }, [confirmDiscard, replaceDocument]);

  const handleReset = useCallback(() => {
    if (!confirmDiscard("샘플로 초기화")) return;
    setSelectedTemplateId(DEFAULT_TEMPLATE.id);
    replaceDocument(DEFAULT_TEMPLATE.document, DEFAULT_TEMPLATE.name, "기본 샘플로 초기화했습니다.");
  }, [confirmDiscard, replaceDocument]);

  const handleTemplateLoad = useCallback(() => {
    const template = findTemplate(selectedTemplateId);
    if (!template || !confirmDiscard(`${template.name} 예제를 불러오기`)) return;
    replaceDocument(template.document, template.name, `${template.name} 예제를 불러왔습니다.`);
  }, [confirmDiscard, replaceDocument, selectedTemplateId]);

  const setPageVisibility = useCallback((action: "all" | "selected" | "none") => {
    const next = applyPageVisibilityToHidden(outline, pageEntries, hiddenNodes, action, selectedPageKey);
    setHiddenNodes(next.hiddenNodes);
    setSelectedPageKey(next.selectedPage);
    setNotice(null);
  }, [hiddenNodes, outline, pageEntries, selectedPageKey]);

  const resetNodeVisibility = useCallback(() => {
    setHiddenNodes((current) => clearNonPageHiddenNodes(outline, current));
    setNotice(null);
  }, [outline]);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!confirmDiscard("다른 문서를 열기")) {
      event.target.value = "";
      return;
    }
    try {
      const doc = await readJsonFile(file);
      replaceDocument(doc, file.name.replace(/\.json$/i, ""), `${file.name}을 불러왔습니다.`);
    } catch (error) {
      setNotice({
        kind: "error",
        text: `${error instanceof Error ? error.message : String(error)} · 현재 문서는 유지되었습니다.`,
      });
    }
    event.target.value = "";
  }, [confirmDiscard, replaceDocument]);

  const setSource = useCallback((value: string) => {
    if (activeTab === "lml") setLml(value);
    else setMd(value);
    setNotice(null);
  }, [activeTab]);

  const handleEditorKeyDown = useCallback((event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const target = event.currentTarget;
    const edit = applyTabIndent(target.value, target.selectionStart, target.selectionEnd, event.shiftKey);
    setSource(edit.value);
    requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(edit.selectionStart, edit.selectionEnd);
      setCursorOffset(edit.selectionEnd);
    });
  }, [setSource]);

  const statusLabel = status === "valid"
    ? "VALID · 0 errors"
    : status === "empty"
      ? "EMPTY"
      : `INVALID · ${parseError ? 1 : errors.length} error${(parseError ? 1 : errors.length) === 1 ? "" : "s"}`;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <span className="brand-mark">L</span>
          <div>
            <h1>LML Workbench</h1>
            <span className="document-name">{documentName}{dirty ? " · 변경됨" : ""}</span>
          </div>
        </div>
        <span className={`status-pill status-${status}`} aria-live="polite">{statusLabel}</span>
        <div className="template-picker" aria-label="내장 예제 선택">
          <label htmlFor="template-select">예제</label>
          <select
            id="template-select"
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value as typeof selectedTemplateId)}
          >
            {BUILT_IN_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
          <button type="button" onClick={handleTemplateLoad}>불러오기</button>
        </div>
        <div className="header-actions">
          <button type="button" onClick={handleNew}>새 문서</button>
          <button type="button" onClick={handleReset}>샘플</button>
          <span className="header-divider" />
          <button type="button" onClick={openDocument} title="Ctrl/Cmd+O">열기</button>
          <button type="button" className="primary-button" onClick={saveDocument} title="Ctrl/Cmd+S">저장</button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={handleFileChange} />
        </div>
      </header>

      {notice && (
        <div className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          <span>{notice.text}</span>
          <button type="button" aria-label="알림 닫기" onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      <main className="workbench">
        <section className="source-pane" aria-label="Source editor">
          <div className="pane-title-row">
            <div className="source-tabs" role="tablist" aria-label="Source type">
              <button type="button" role="tab" aria-selected={activeTab === "lml"} className={activeTab === "lml" ? "active" : ""} onClick={() => { setActiveTab("lml"); setCursorOffset(0); }}>LML</button>
              <button type="button" role="tab" aria-selected={activeTab === "md"} className={activeTab === "md" ? "active" : ""} onClick={() => { setActiveTab("md"); setCursorOffset(0); }}>MD · 노트</button>
            </div>
            <span className="cursor-position">Ln {cursor.line}, Col {cursor.column}</span>
          </div>
          <div className="source-context">
            {activeTab === "lml"
              ? "Geometry source · 입력 즉시 compiler/validator 실행"
              : "실제 콘텐츠/발표자 노트 · geometry 측정 및 렌더링 비대상"}
          </div>
          <textarea
            ref={editorRef}
            className={`source-editor source-editor-${activeTab}`}
            value={activeSource}
            onChange={(event) => { setSource(event.target.value); setCursorOffset(event.target.selectionStart); }}
            onSelect={(event) => setCursorOffset(event.currentTarget.selectionStart)}
            onKeyDown={handleEditorKeyDown}
            spellCheck={false}
            aria-label={activeTab === "lml" ? "LML source" : "Markdown notes"}
            placeholder={activeTab === "lml" ? "host { page(w: 1fr, h: 1fr) { ... } }" : "# title\n## 실제 콘텐츠 또는 노트"}
          />
          <footer className="source-footer">
            <span>{activeSource.length.toLocaleString()} chars</span>
            <span>Tab 2 spaces</span>
          </footer>
        </section>

        <section className="canvas-pane" aria-label="Geometry canvas">
          <div className="pane-title-row canvas-toolbar">
            <div>
              <h2>Canvas</h2>
              <span>LML geometry only</span>
            </div>
            <div className="zoom-controls" aria-label="Zoom controls">
              <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => clampZoom(value - 10))}>−</button>
              <button type="button" className="zoom-value" onClick={() => setZoom(100)}>{zoom}%</button>
              <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => clampZoom(value + 10))}>+</button>
            </div>
          </div>
          <div className="canvas-scroll">
            {previewError && (
              <div className="canvas-empty canvas-invalid">
                <strong>Geometry preview paused</strong>
                <p>유효한 LML이 될 때까지 이전 geometry를 표시하지 않습니다.</p>
                <pre>{previewError}</pre>
              </div>
            )}
            {!previewError && layoutRoot && (
              <div className="canvas-zoom-stage" style={{ width: `${100 / (zoom / 100)}%`, height: `${100 / (zoom / 100)}%` }}>
                <div className="canvas-transform" style={{ transform: `scale(${zoom / 100})` }}>
                  {visiblePages.length > 0
                    ? <PageGalleryRenderer pages={visiblePages} hiddenPaths={rendererHiddenPaths} selectedPath={selectedPath} onSelect={(path) => selectNode(path)} />
                    : <div className="canvas-empty"><strong>표시된 Page가 없습니다.</strong><p>Outline에서 Page 체크박스를 선택하세요.</p></div>}
                </div>
              </div>
            )}
            {!previewError && !compiledDocument && (
              <div className="canvas-empty"><strong>빈 LML 문서</strong><p>LML 탭에서 layout source를 입력하세요.</p></div>
            )}
          </div>
        </section>

        <aside className="sidebar" aria-label="Document details">
          <section className="sidebar-section outline-section">
            <div className="sidebar-heading"><h2>Outline</h2><span>{currentVisible.length}/{pageEntries.length} Pages · {currentHiddenNodes.length} hidden</span></div>
            {pageEntries.length > 0 && (
              <div className="page-visibility-toolbar" role="group" aria-label="Page canvas 표시">
                <button type="button" onClick={() => setPageVisibility("all")}>모든 Page 표시</button>
                <button type="button" onClick={() => setPageVisibility("selected")}>선택 Page만</button>
                <button type="button" onClick={() => setPageVisibility("none")}>모든 Page 숨김</button>
                <button type="button" onClick={resetNodeVisibility}>노드 숨김 초기화</button>
              </div>
            )}
            {outline.length > 0 ? (
              <ul className="outline-tree">
                {outline.map((entry) => {
                  const directlyVisible = isNodeDirectlyVisible(entry, currentHiddenNodes);
                  const hiddenByAncestor = directlyVisible && isNodeEffectivelyHidden(entry, currentHiddenNodes);
                  return (
                  <li key={entry.pathKey} className={`outline-row${!directlyVisible ? " outline-row-hidden" : ""}${hiddenByAncestor ? " outline-row-ancestor-hidden" : ""}`}>
                    <input
                      className="outline-node-toggle"
                      style={{ left: 8 + entry.depth * 14 }}
                      type="checkbox"
                      checked={directlyVisible}
                      aria-label={`${entry.label} canvas 표시`}
                      title={hiddenByAncestor ? "상위 노드가 숨겨져 있습니다. 이 노드의 직접 표시 상태는 유지됩니다." : `${entry.label} 표시 상태`}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleOutlineNode(entry.visibilityKey)}
                    />
                    <button
                      type="button"
                      className={sameNodePath(selectedPath, entry.path) ? "selected" : ""}
                      style={{ paddingLeft: 32 + entry.depth * 14 }}
                      onClick={() => selectNode(entry.path)}
                    >
                      <span className={`node-icon node-${entry.kind.toLowerCase()}`} />
                      <span>{entry.label}</span>
                      <code>{entry.pathKey}</code>
                    </button>
                  </li>
                );})}
              </ul>
            ) : <p className="sidebar-empty">유효한 AST가 없습니다.</p>}
          </section>

          <section className="sidebar-section inspector-section">
            <div className="sidebar-heading"><h2>Inspector</h2></div>
            {selectedNode ? (
              <dl className="inspector-grid">
                {inspector.map((field, index) => (
                  <div key={`${field.label}-${index}`}><dt>{field.label}</dt><dd>{field.value}</dd></div>
                ))}
              </dl>
            ) : <p className="sidebar-empty">Canvas 또는 Outline에서 노드를 선택하세요.</p>}
          </section>

          <section className="sidebar-section diagnostics-section">
            <div className="sidebar-heading"><h2>Diagnostics</h2><span>{(parseError ? 1 : 0) + diagnostics.length}</span></div>
            {!parseError && diagnostics.length === 0 && <p className="diagnostic-ok">검사 결과 이상 없음</p>}
            {parseError && (
              <article className="diagnostic diagnostic-error">
                <strong>Parse</strong>
                {parseError.span && <code>{parseError.span.start.line}:{parseError.span.start.column}</code>}
                <p>{parseError.message}</p>
              </article>
            )}
            {diagnostics.map((entry, index) => (
              <article key={`${entry.code}-${index}`} className={`diagnostic diagnostic-${entry.severity}`}>
                <strong>{entry.code}</strong>
                {entry.span && <code>{entry.span.start.line}:{entry.span.start.column}</code>}
                <p>{entry.message}</p>
              </article>
            ))}
          </section>
        </aside>
      </main>
    </div>
  );
}
