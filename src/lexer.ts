import type { Position, SourceSpan } from "../spec/ast.js";

export type TokenType =
  | "eof"
  | "lparen"
  | "rparen"
  | "lbrace"
  | "rbrace"
  | "comma"
  | "colon"
  | "at"
  | "host"
  | "page"
  | "v"
  | "h"
  | "z"
  | "grid"
  | "md"
  | "space"
  | "fit"
  | "number"
  | "fr"
  | "percent"
  | "ident"
  | "string";

export interface Token {
  type: TokenType;
  value?: string | number;
  /** Exact source lexeme, retained where grammar decisions need lexical form. */
  raw?: string;
  span: SourceSpan;
}

const KEYWORDS: Record<string, TokenType> = {
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
};

export class LexError extends Error {
  constructor(
    message: string,
    readonly span: SourceSpan,
  ) {
    super(message);
    this.name = "LexError";
  }
}

export class Lexer {
  private index = 0;
  private line = 1;
  private column = 1;

  constructor(private readonly source: string) {}

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (true) {
      const token = this.nextToken();
      tokens.push(token);
      if (token.type === "eof") break;
    }
    return tokens;
  }

  nextToken(): Token {
    this.skipWhitespaceAndComments();

    const start = this.position();
    const ch = this.peek();

    if (ch === "") {
      return { type: "eof", span: this.spanFrom(start) };
    }

    switch (ch) {
      case "(":
        this.advance();
        return { type: "lparen", span: this.spanFrom(start) };
      case ")":
        this.advance();
        return { type: "rparen", span: this.spanFrom(start) };
      case "{":
        this.advance();
        return { type: "lbrace", span: this.spanFrom(start) };
      case "}":
        this.advance();
        return { type: "rbrace", span: this.spanFrom(start) };
      case ",":
        this.advance();
        return { type: "comma", span: this.spanFrom(start) };
      case ":":
        this.advance();
        return { type: "colon", span: this.spanFrom(start) };
      case '"':
        return this.readString(start);
      default:
        if (this.isDigit(ch)) {
          return this.readNumber(start);
        }
        if (this.isIdentStart(ch)) {
          return this.readIdentOrKeyword(start);
        }
        throw new LexError(`Unexpected character '${ch}'`, this.spanFrom(start));
    }
  }

  private readString(start: Position): Token {
    if (this.source.slice(this.index, this.index + 3) !== '"""') {
      throw new LexError('Expected """ string literal', this.spanFrom(start));
    }
    this.index += 3;
    this.column += 3;

    const bodyStart = this.index;
    while (this.index < this.source.length) {
      if (this.source.slice(this.index, this.index + 3) === '"""') {
        const body = this.source.slice(bodyStart, this.index);
        this.index += 3;
        this.column += 3;
        return { type: "string", value: body, span: this.spanFrom(start) };
      }
      this.advance();
    }
    throw new LexError("Unterminated string literal", this.spanFrom(start));
  }

  private readNumber(start: Position): Token {
    const numStart = this.index;
    while (this.isDigit(this.peek())) {
      this.advance();
    }
    if (this.peek() === ".") {
      if (!this.isDigit(this.peek(1))) {
        throw new LexError(
          `Invalid number '${this.source.slice(numStart, this.index + 1)}'`,
          this.spanFrom(start),
        );
      }
      this.advance();
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }
    const raw = this.source.slice(numStart, this.index);
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new LexError(`Invalid number '${raw}'`, this.spanFrom(start));
    }

    if (this.peek() === "%") {
      this.advance();
      return { type: "percent", value, raw: `${raw}%`, span: this.spanFrom(start) };
    }

    if (this.source.slice(this.index, this.index + 2) === "fr") {
      this.index += 2;
      this.column += 2;
      return { type: "fr", value, raw: `${raw}fr`, span: this.spanFrom(start) };
    }

    return { type: "number", value, raw, span: this.spanFrom(start) };
  }

  private readIdentOrKeyword(start: Position): Token {
    const identStart = this.index;
    while (this.isIdentContinue(this.peek())) {
      this.advance();
    }
    const text = this.source.slice(identStart, this.index);

    if (text === "fr") {
      return { type: "fr", value: 1, raw: text, span: this.spanFrom(start) };
    }

    const keyword = KEYWORDS[text];
    if (keyword) {
      return { type: keyword, span: this.spanFrom(start) };
    }

    return { type: "ident", value: text, span: this.spanFrom(start) };
  }

  private skipWhitespaceAndComments(): void {
    while (this.index < this.source.length) {
      const ch = this.peek();
      if (ch === " " || ch === "\t") {
        this.advance();
        continue;
      }
      if (ch === "\n" || ch === "\r") {
        this.advance();
        continue;
      }
      if (ch === "/" && this.peek(1) === "/") {
        while (this.peek() !== "" && this.peek() !== "\n" && this.peek() !== "\r") {
          this.advance();
        }
        continue;
      }
      break;
    }
  }

  private peek(offset = 0): string {
    return this.source[this.index + offset] ?? "";
  }

  private advance(): void {
    if (this.peek() === "\r") {
      this.index += this.peek(1) === "\n" ? 2 : 1;
      this.line += 1;
      this.column = 1;
      return;
    }
    if (this.peek() === "\n") {
      this.line += 1;
      this.column = 1;
      this.index += 1;
      return;
    }
    this.column += 1;
    this.index += 1;
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }

  private isIdentContinue(ch: string): boolean {
    return this.isIdentStart(ch) || this.isDigit(ch) || ch === "-";
  }

  private position(): Position {
    return { line: this.line, column: this.column, offset: this.index };
  }

  private spanFrom(start: Position): SourceSpan {
    return { start, end: this.position() };
  }
}
