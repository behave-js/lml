import { useMemo } from "react";
import { compileLmlSource, type CompileResult } from "../editorModel.js";

export function useLmlPreview(lmlSource: string): CompileResult {
  return useMemo(() => compileLmlSource(lmlSource), [lmlSource]);
}
