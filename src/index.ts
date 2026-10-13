export * from "../spec/ast.js";
export { LexError, Lexer, type Token, type TokenType } from "./lexer.js";
export { ParseError, parseLml } from "./parser.js";
export { parseMarkdownBlocks, markdownBlockMap } from "./parse-md.js";
export {
  validateLml,
  collectMarkdownRefs,
  hasErrors,
} from "./validate-lml.js";
// Optional semantic association/lint utility; not the WYSIWYG or render pipeline.
export { joinSlide, parseAndJoin, type JoinResult } from "./join.js";
