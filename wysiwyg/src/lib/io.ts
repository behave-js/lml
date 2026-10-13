import { parseWysiwygDocument, type WysiwygDocument } from "../types.js";

export function downloadJson(doc: WysiwygDocument, filename = "slide.lml.json"): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file: File): Promise<WysiwygDocument> {
  const text = await file.text();
  const raw: unknown = JSON.parse(text);
  return parseWysiwygDocument(raw);
}
