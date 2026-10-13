/** JSON save/load format for wysiwyg workspace */
export interface WysiwygDocument {
  version: 1;
  lml: string;
  /** Reference only — does not affect wireframe preview */
  md: string;
  /** Editor-only artboard visibility/selection. It never changes LML runtime semantics. */
  view?: WysiwygViewState;
}

export interface WysiwygViewState {
  visiblePages: string[];
  selectedPage?: string;
  /** Editor-only hidden exceptions. Missing records mean visible. */
  hiddenNodes?: HiddenNodeRecord[];
}

export interface HiddenNodeRecord {
  key: string;
  fingerprint: string;
}

export const WYSIWYG_JSON_VERSION = 1 as const;

export function createEmptyDocument(): WysiwygDocument {
  return { version: WYSIWYG_JSON_VERSION, lml: "", md: "" };
}

export function parseWysiwygDocument(raw: unknown): WysiwygDocument {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid JSON: expected object");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) {
    throw new Error(`Unsupported version: ${String(obj.version)}`);
  }
  if (typeof obj.lml !== "string" || typeof obj.md !== "string") {
    throw new Error("Invalid JSON: lml and md must be strings");
  }
  let view: WysiwygViewState | undefined;
  if (obj.view !== undefined) {
    if (typeof obj.view !== "object" || obj.view === null) throw new Error("Invalid JSON: view must be an object");
    const rawView = obj.view as Record<string, unknown>;
    if (!Array.isArray(rawView.visiblePages) || rawView.visiblePages.some((value) => typeof value !== "string")) {
      throw new Error("Invalid JSON: view.visiblePages must be a string array");
    }
    if (rawView.selectedPage !== undefined && typeof rawView.selectedPage !== "string") {
      throw new Error("Invalid JSON: view.selectedPage must be a string");
    }
    if (rawView.hiddenNodes !== undefined && (
      !Array.isArray(rawView.hiddenNodes) || rawView.hiddenNodes.some((value) => (
        typeof value !== "object" || value === null ||
        typeof (value as Record<string, unknown>).key !== "string" ||
        typeof (value as Record<string, unknown>).fingerprint !== "string"
      ))
    )) {
      throw new Error("Invalid JSON: view.hiddenNodes must be an array of { key, fingerprint }");
    }
    const hiddenNodes = rawView.hiddenNodes as HiddenNodeRecord[] | undefined;
    const dedupedHiddenNodes = hiddenNodes
      ? [...new Map(hiddenNodes.map((record) => [record.key, { key: record.key, fingerprint: record.fingerprint }])).values()]
        .sort((left, right) => left.key.localeCompare(right.key))
      : undefined;
    view = {
      visiblePages: [...new Set(rawView.visiblePages as string[])],
      ...(typeof rawView.selectedPage === "string" ? { selectedPage: rawView.selectedPage } : {}),
      ...(dedupedHiddenNodes ? { hiddenNodes: dedupedHiddenNodes } : {}),
    };
  }
  return { version: 1, lml: obj.lml, md: obj.md, ...(view ? { view } : {}) };
}
