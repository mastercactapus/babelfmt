import detectIndent from "detect-indent";
import Whitespace from "./whitespace";
import SourceMap from "./source-map";
import Position from "./position";
import * as messages from "babel-messages";
import Printer from "./printer";

/**
 * Babel's code generator, turns an ast into code, maintaining sourcemaps,
 * user preferences, and valid output.
 */

export class CodeGenerator extends Printer {
  constructor(ast, opts, code) {
    opts = opts || {};

    let comments = ast.comments || [];
    let tokens   = ast.tokens || [];
    let format   = CodeGenerator.normalizeOptions(code, opts, tokens);

    let position = new Position;

    super(position, format);

    this.comments = comments;
    this.position = position;
    this.tokens   = tokens;
    this.format   = format;
    this.opts     = opts;
    this.ast      = ast;

    this.whitespace = new Whitespace(tokens);
    this.map        = new SourceMap(position, opts, code);
  }

  calculateLines(ast) {
    var gen = new CodeGenerator(ast, this.opts);
    var res = gen.generate();
    return res.code.split("\n").length;
  }
  calculateLength(ast) {
    var gen = new CodeGenerator(ast, this.opts);
    var res = gen.generate();
    return res.code.length;
  }

  format: {
    shouldPrintComment: boolean;
    retainLines: boolean;
    comments: boolean;
    auxiliaryCommentBefore: string;
    auxiliaryCommentAfter: string;
    compact: boolean | "auto";
    quotes: "single" | "double";
    concise: boolean;
    indent: {
      adjustMultilineComment: boolean;
      style: string;
      base: number;
    }
  };

  auxiliaryCommentBefore: string;
  auxiliaryCommentAfter: string;
  whitespace: Whitespace;
  position: Position;
  map: SourceMap;
  comments: Array<Object>;
  tokens: Array<Object>;
  opts: Object;
  ast: Object;

  /**
   * Normalize generator options, setting defaults.
   *
   * - Detects code indentation.
   * - If `opts.compact = "auto"` and the code is over 100KB, `compact` will be set to `true`.

   */

  static normalizeOptions(code, opts, tokens) {
    let style = "  ";
    if (code) {
      let indent = detectIndent(code).indent;
      if (indent && indent !== " ") style = indent;
    }

    let format = {
      auxiliaryCommentBefore: opts.auxiliaryCommentBefore,
      auxiliaryCommentAfter: opts.auxiliaryCommentAfter,
      shouldPrintComment: opts.shouldPrintComment,
      retainLines: opts.retainLines,
      comments: opts.comments == null || opts.comments,
      compact: opts.compact,
      concise: opts.concise,
      quotes: CodeGenerator.findCommonStringDelimiter(code, tokens),
      indent: {
        adjustMultilineComment: true,
        style: style,
        base: 0
      }
    };

    if (format.compact === "auto") {
      format.compact = code.length > 100000; // 100KB

      if (format.compact) {
        console.error("[BABEL] " + messages.get("codeGeneratorDeopt", opts.filename, "100KB"));
      }
    }

    if (format.compact) {
      format.indent.adjustMultilineComment = false;
    }

    return format;
  }

  /**
   * Determine if input code uses more single or double quotes.
   */
  static findCommonStringDelimiter(code, tokens) {
    if (!code) return "double";
    let occurences = {
      single: 0,
      double: 0
    };

    let checked = 0;

    for (let i = 0; i < tokens.length; i++) {
      let token = tokens[i];
      if (token.type.label !== "string") continue;

      let raw = code.slice(token.start, token.end);
      if (raw[0] === "'") {
        occurences.single++;
      } else {
        occurences.double++;
      }

      checked++;
      if (checked >= 3) break;
    }
    if (occurences.single > occurences.double) {
      return "single";
    } else {
      return "double";
    }
  }

  /**
   * Generate code and sourcemap from ast.
   *
   * Appends comments that weren't attached to any node to the end of the generated output.
   */

  generate() {
    this.print(this.ast);
    this.printAuxAfterComment();

    return {
      map:  this.map.get(),
      code: this.get()
    };
  }
}

export default function (ast: Object, opts: Object, code: string): Object {
  let gen = new CodeGenerator(ast, opts, code);
  return gen.generate();
}
