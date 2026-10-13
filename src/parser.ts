import type {
  AlignValue,
  AtNode,
  AtParam,
  Dimension,
  Document,
  GridNode,
  HostNode,
  HStackNode,
  JustifyValue,
  MarkdownInlineNode,
  MarkdownRefNode,
  Node,
  PageAxisSize,
  PageNode,
  Param,
  ParamKey,
  SpacerNode,
  Spacing,
  TrackSpec,
  VStackNode,
  ZStackNode,
} from "../spec/ast.js";
import type { SourceSpan } from "../spec/ast.js";
import { LexError, Lexer, type Token, type TokenType } from "./lexer.js";

export class ParseError extends Error {
  constructor(
    message: string,
    readonly span?: SourceSpan,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

const PARAM_KEYS = new Set<ParamKey>([
  "gap",
  "pad",
  "align",
  "justify",
  "w",
  "h",
  "top",
  "bottom",
  "left",
  "right",
  "cols",
  "rows",
]);

const ALIGN_VALUES = new Set<AlignValue>([
  "leading",
  "center",
  "trailing",
  "stretch",
]);

const JUSTIFY_VALUES = new Set<JustifyValue>([
  "start",
  "center",
  "end",
  "between",
  "around",
]);

interface ParseResult {
  dimensions: Dimension[];
  params: Param[];
}

export function parseLml(source: string): Document {
  const lexer = new Lexer(source);
  let tokens: Token[];
  try {
    tokens = lexer.tokenize();
  } catch (error) {
    if (error instanceof LexError) {
      throw new ParseError(error.message, error.span);
    }
    throw error;
  }

  const parser = new Parser(tokens);
  return parser.parseDocument();
}

class Parser {
  private index = 0;
  private inlineCounter = 0;

  constructor(private readonly tokens: Token[]) {}

  parseDocument(): Document {
    const root = this.parseNode();
    this.expect("eof");
    return { kind: "Document", root };
  }

  private parseNode(): Node {
    const token = this.current();
    switch (token.type) {
      case "host":
        return this.parseHost();
      case "page":
        return this.parsePage();
      case "v":
        return this.parseVStack();
      case "h":
        return this.parseHStack();
      case "z":
        return this.parseZStack();
      case "at":
        return this.parseAt();
      case "grid":
        return this.parseGrid();
      case "md":
        return this.parseMarkdown();
      case "space":
        return this.parseSpacer();
      default:
        throw new ParseError(`Expected node, got '${token.type}'`, token.span);
    }
  }

  private parseHost(): HostNode {
    this.expect("host");
    const { params } = this.parseNamedArgsOnly();
    const children = this.parseBlock();
    return { kind: "Host", params, children };
  }

  private parsePage(): PageNode {
    this.expect("page");
    const { ref, params } = this.parsePageArgs();
    const children = this.parseBlock();
    return { kind: "Page", ...(ref ? { ref } : {}), params, children };
  }

  /** `md:ref` is page metadata, not a Param or child. It is accepted only as the first page argument. */
  private parsePageArgs(): { ref?: string; params: Param[] } {
    if (!this.check("lparen")) return { params: [] };
    this.advance();
    if (this.check("rparen")) {
      throw new ParseError("Explicit argument list must not be empty", this.current().span);
    }
    let ref: string | undefined;
    const params: Param[] = [];
    if (this.check("md")) {
      this.advance();
      this.expect("colon");
      ref = this.parseMdRefName();
      if (this.match("comma")) {
        if (this.check("rparen")) throw new ParseError("Expected page parameter after comma", this.current().span);
      } else {
        this.expect("rparen");
        return { ref, params };
      }
    }
    do {
      if (this.check("md")) {
        throw new ParseError("page md:ref must be the first argument and may appear only once", this.current().span);
      }
      params.push(this.parseNamedArg());
    } while (this.match("comma"));
    this.expect("rparen");
    return { ...(ref ? { ref } : {}), params };
  }

  private parseVStack(): VStackNode {
    this.expect("v");
    const { dimensions, params } = this.parseStackArgs();
    const children = this.parseBlock();
    return {
      kind: "VStack",
      ...(dimensions.length > 0 ? { dimensions } : {}),
      params,
      children,
    };
  }

  private parseHStack(): HStackNode {
    this.expect("h");
    const { dimensions, params } = this.parseStackArgs();
    const children = this.parseBlock();
    return {
      kind: "HStack",
      ...(dimensions.length > 0 ? { dimensions } : {}),
      params,
      children,
    };
  }

  private parseZStack(): ZStackNode {
    this.expect("z");
    const { params } = this.parseNamedArgsOnly();
    const children = this.parseBlock();
    return { kind: "ZStack", params, children };
  }

  private parseAt(): AtNode {
    this.expect("at");
    this.expect("lparen");
    const params: AtParam[] = [];
    if (!this.check("rparen")) {
      do {
        params.push(this.parseAtNamedArg());
      } while (this.match("comma"));
    }
    this.expect("rparen");
    const children = this.parseBlock();
    return { kind: "At", params, children };
  }

  private parseGrid(): GridNode {
    this.expect("grid");
    const { params } = this.parseNamedArgsOnly();
    const children = this.parseBlock();
    return { kind: "Grid", params, children };
  }

  private parseMarkdown(): MarkdownRefNode | MarkdownInlineNode {
    const mdToken = this.expect("md");

    if (this.check("colon")) {
      this.advance();
      const ref = this.parseMdRefName();
      return { kind: "MarkdownRef", ref };
    }

    if (this.check("string")) {
      const stringToken = this.advance();
      this.inlineCounter += 1;
      return {
        kind: "MarkdownInline",
        body: String(stringToken.value),
        syntheticId: `_inline_${this.inlineCounter}`,
      };
    }

    throw new ParseError(
      'Expected ":" reference or """ inline string after "md"',
      mdToken.span,
    );
  }

  private parseSpacer(): SpacerNode {
    this.expect("space");
    if (this.check("lparen")) {
      this.advance();
      const dimension = this.parseDimension();
      this.expect("rparen");
      return { kind: "Spacer", dimension };
    }
    return { kind: "Spacer" };
  }

  private parseBlock(): Node[] {
    this.expect("lbrace");
    const children: Node[] = [];
    while (!this.check("rbrace") && !this.check("eof")) {
      children.push(this.parseNode());
    }
    this.expect("rbrace");
    return children;
  }

  private parseStackArgs(): ParseResult {
    if (!this.check("lparen")) {
      return { dimensions: [], params: [] };
    }

    this.advance();
    const dimensions: Dimension[] = [];
    const params: Param[] = [];

    if (this.check("rparen")) {
      throw new ParseError("Explicit argument list must not be empty", this.current().span);
    }

    do {
      if (this.isDimensionStart()) {
        dimensions.push(this.parseDimension());
      } else {
        params.push(this.parseNamedArg());
      }
    } while (this.match("comma"));

    this.expect("rparen");
    return { dimensions, params };
  }

  private parseNamedArgsOnly(): { params: Param[] } {
    if (!this.check("lparen")) {
      return { params: [] };
    }

    this.advance();
    const params: Param[] = [];

    if (this.check("rparen")) {
      throw new ParseError("Explicit argument list must not be empty", this.current().span);
    }

    do {
      params.push(this.parseNamedArg());
    } while (this.match("comma"));

    this.expect("rparen");
    return { params };
  }

  private parseNamedArg(): Param {
    const keyToken = this.current();
    const key = this.parseParamKey();
    this.expect("colon");
    return this.parseParamValue(key, keyToken.span);
  }

  private parseAtNamedArg(): AtParam {
    const keyToken = this.current();
    const key = this.parseParamKey();
    if (key !== "top" && key !== "bottom" && key !== "left" && key !== "right" && key !== "w" && key !== "h") {
      throw new ParseError(`at does not accept param '${key}'`, keyToken.span);
    }
    this.expect("colon");
    if (key === "top" || key === "bottom" || key === "left" || key === "right") {
      return { key, value: this.parseAtOffset() };
    }
    return { key, value: this.parseAtSize() };
  }

  private parseParamKey(): ParamKey {
    const token = this.current();
    if (token.type === "ident" || token.type === "h") {
      const text = token.type === "h" ? "h" : String(token.value);
      this.advance();
      if (PARAM_KEYS.has(text as ParamKey)) {
        return text as ParamKey;
      }
      throw new ParseError(`Unknown parameter key '${text}'`, token.span);
    }
    throw new ParseError("Expected parameter key", token.span);
  }

  private parseParamValue(key: ParamKey, span: SourceSpan): Param {
    switch (key) {
      case "gap": {
        const value = this.parsePlainNumber();
        return { key, value };
      }
      case "pad": {
        const value = this.parseSpacing();
        return { key, value };
      }
      case "align": {
        const value = this.parseAlignValue();
        return { key, value };
      }
      case "justify": {
        const value = this.parseJustifyValue();
        return { key, value };
      }
      case "w":
      case "h": {
        const value = this.parsePageAxisSize();
        return { key, value };
      }
      case "top":
      case "bottom":
      case "left":
      case "right":
        throw new ParseError(`'${key}' is only valid in at(...)`, span);
      case "cols":
      case "rows": {
        const value = this.parseTrackSpec();
        return { key, value };
      }
      default: {
        const _exhaustive: never = key;
        throw new ParseError(`Unsupported param '${String(_exhaustive)}'`, span);
      }
    }
  }

  private parseSpacing(): Spacing {
    const values: number[] = [this.parsePlainNumber()];

    while (values.length < 4 && this.isPlainNumberStart()) {
      values.push(this.parsePlainNumber());
    }

    if (values.length > 4) {
      throw new ParseError("pad accepts at most 4 values", this.current().span);
    }

    switch (values.length) {
      case 1:
        return [values[0]];
      case 2:
        return [values[0], values[1]];
      case 3:
        return [values[0], values[1], values[2]];
      case 4:
        return [values[0], values[1], values[2], values[3]];
      default:
        throw new ParseError("pad requires 1 to 4 values", this.current().span);
    }
  }

  /**
   * cols/rows precedence (semantic-spec):
   * - single bare NUMBER → TrackCount (e.g. cols: 3)
   * - otherwise → TrackList (e.g. cols: 3fr, cols: 240 1fr)
   */
  private parseTrackSpec(): TrackSpec {
    if (this.check("number") && !this.isDimensionStartAt(this.index + 1)) {
      const token = this.advance();
      const count = Number(token.value);
      if (!this.isRawPositiveInteger(token) || !Number.isSafeInteger(count)) {
        throw new ParseError("Track count must be a positive integer", token.span);
      }
      return { kind: "TrackCount", count };
    }

    const tracks: Dimension[] = [this.parseDimension()];
    while (this.isDimensionStart()) {
      const previous = this.tokens[this.index - 1];
      const next = this.current();
      if (previous && next.span.start.offset === previous.span.end.offset) {
        throw new ParseError("Grid tracks must be separated by whitespace", next.span);
      }
      tracks.push(this.parseDimension());
    }
    return { kind: "TrackList", tracks };
  }

  private parseAlignValue(): AlignValue {
    const token = this.expect("ident");
    const value = String(token.value);
    if (!ALIGN_VALUES.has(value as AlignValue)) {
      throw new ParseError(`Invalid align value '${value}'`, token.span);
    }
    return value as AlignValue;
  }

  private parseJustifyValue(): JustifyValue {
    const token = this.expect("ident");
    const value = String(token.value);
    if (!JUSTIFY_VALUES.has(value as JustifyValue)) {
      throw new ParseError(`Invalid justify value '${value}'`, token.span);
    }
    return value as JustifyValue;
  }

  /** Accept identifier or container keyword lexeme; reserved names → validator E009. */
  private parseMdRefName(): string {
    const token = this.current();
    if (token.type === "ident" && token.value !== undefined) {
      this.advance();
      return String(token.value);
    }
    const keywordRef: Partial<Record<TokenType, string>> = {
      host: "host",
      page: "page",
      v: "v",
      h: "h",
      z: "z",
      at: "at",
      grid: "grid",
      md: "md",
      space: "space",
      fit: "fit",
      fr: "fr",
    };
    const name = keywordRef[token.type];
    if (name) {
      this.advance();
      return name;
    }
    throw new ParseError("Expected markdown reference name", token.span);
  }

  private parsePageAxisSize(): PageAxisSize {
    if (this.check("number")) {
      const token = this.advance();
      if (typeof token.value !== "number") {
        throw new ParseError("Expected page axis size", token.span);
      }
      if (this.isRawPositiveInteger(token)) {
        if (!Number.isSafeInteger(token.value)) {
          throw new ParseError("page w/h integer must be safely representable", token.span);
        }
        return { kind: "CanvasSize", value: token.value };
      }
      return { kind: "Fixed", value: token.value };
    }
    return this.parseDimension();
  }

  private parseAtOffset(): Extract<Dimension, { kind: "Fixed" | "Percent" }> {
    if (this.check("percent")) {
      const token = this.advance();
      return { kind: "Percent", value: Number(token.value) };
    }
    if (this.check("number")) {
      const token = this.advance();
      return { kind: "Fixed", value: Number(token.value) };
    }
    throw new ParseError("at edge expects a number or percentage", this.current().span);
  }

  private parseAtSize(): Extract<Dimension, { kind: "Fixed" | "Percent" | "Fit" }> {
    if (this.check("fit")) {
      this.advance();
      return { kind: "Fit" };
    }
    return this.parseAtOffset();
  }

  private parseDimension(): Dimension {
    if (this.check("fit")) {
      this.advance();
      return { kind: "Fit" };
    }
    if (this.check("fr")) {
      const token = this.advance();
      const value = typeof token.value === "number" ? token.value : 1;
      return { kind: "Fraction", value };
    }
    if (this.check("percent")) {
      const token = this.advance();
      return { kind: "Percent", value: Number(token.value) };
    }
    if (this.check("number")) {
      const token = this.advance();
      if (typeof token.value === "number") {
        return { kind: "Fixed", value: token.value };
      }
    }
    throw new ParseError("Expected dimension", this.current().span);
  }

  private parsePlainNumber(): number {
    const token = this.expect("number");
    if (typeof token.value !== "number") {
      throw new ParseError("Expected plain number", token.span);
    }
    return token.value;
  }

  private isDimensionStart(): boolean {
    return this.isDimensionStartAt(this.index);
  }

  private isDimensionStartAt(index: number): boolean {
    const type = this.tokens[index]?.type;
    return (
      type === "number" ||
      type === "fr" ||
      type === "percent" ||
      type === "fit"
    );
  }

  private isRawPositiveInteger(token: Token): boolean {
    return typeof token.raw === "string" && /^[1-9][0-9]*$/.test(token.raw);
  }

  private isPlainNumberStart(): boolean {
    const token = this.current();
    return token.type === "number" && typeof token.value === "number";
  }

  private current(): Token {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1];
  }

  private advance(): Token {
    const token = this.current();
    if (token.type !== "eof") {
      this.index += 1;
    }
    return token;
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new ParseError(`Expected '${type}', got '${token.type}'`, token.span);
    }
    return this.advance();
  }
}
