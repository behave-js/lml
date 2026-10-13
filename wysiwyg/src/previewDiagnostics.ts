import type { Diagnostic } from "lml-core";

/** A geometry preview is safe only when parsing and semantic validation both succeed. */
export function geometryPreviewError(
  parseError: string | null,
  diagnostics: readonly Diagnostic[],
): string | null {
  if (parseError) return parseError;
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length === 0) return null;
  return errors.map((diagnostic) => `[${diagnostic.code}] ${diagnostic.message}`).join("\n");
}
