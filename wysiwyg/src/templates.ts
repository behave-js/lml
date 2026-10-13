import storeFlowLml from "../../examples/06-store-flow/slide.lml?raw";
import storeFlowMd from "../../examples/06-store-flow/slide.md?raw";
import { DEFAULT_LML, DEFAULT_MD } from "./defaultContent.js";
import type { WysiwygDocument } from "./types.js";

export interface BuiltInTemplate {
  id: "starter" | "store-flow";
  name: string;
  description: string;
  document: WysiwygDocument;
}

export const BUILT_IN_TEMPLATES: readonly BuiltInTemplate[] = [
  {
    id: "starter",
    name: "기본 레이아웃",
    description: "단일 Page로 LML geometry 편집을 시작합니다.",
    document: {
      version: 1,
      lml: DEFAULT_LML,
      md: DEFAULT_MD,
      view: { visiblePages: ["ref:overview"], selectedPage: "ref:overview" },
    },
  },
  {
    id: "store-flow",
    name: "상점 구매 흐름",
    description: "상품 목록부터 주문 완료까지 5개 Page를 비교합니다.",
    document: {
      version: 1,
      lml: storeFlowLml,
      md: storeFlowMd,
      view: { visiblePages: ["ref:catalog"], selectedPage: "ref:catalog" },
    },
  },
] as const;

export const DEFAULT_TEMPLATE = BUILT_IN_TEMPLATES[0];

export function findTemplate(id: string): BuiltInTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((template) => template.id === id);
}
