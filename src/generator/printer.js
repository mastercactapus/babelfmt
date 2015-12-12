
import Buffer from "./buffer";
import _ from "lodash";
import * as t from "babel-types";

export default class Printer extends Buffer {
  constructor() {
    super()
    this.comments = [];

    this._lastNode = null
  }

  comments: Array<BabelNodeComment>;
  _lastNode: ?BabelNode;


  PrintQuote(value: string) {
    this.Write(JSON.stringify(value));
  }

  Write(s: string) {
    super.Write(s)
  }

  PrintBlankLines(node: BabelNode) {
    if (node.loc && this.IsNewLine() && this._lastNode && this._lastNode.loc
      && node.loc.start.line-1 > this._lastNode.loc.end.line) {
        this.Writeln()
    }
    this._lastNode = node
  }

  Print(node: BabelNode, parent: ?BabelNode) {
    if (!this[node.type]) {
      console.error("cannot print unknown type: " + node.type);
      return;
    }
    if (node.leadingComments && node.leadingComments.length) this.PrintComments(node.leadingComments, node)

    this.PrintBlankLines(node)
    this[node.type](node, parent)

    if (node.trailingComments && node.trailingComments.length) this.PrintComments(node.trailingComments, node)
  }

  PrintList(nodes: Array<BabelNode>, parent: ?BabelNode, separator: string = "\n") {
    nodes.forEach((node, index)=>{
      if (index) this.Write(separator);
      this.Print(node, parent);
    });
  }

  PrintComments(comments: Array<BabelNodeComment>, parent: BabelNode): bool {

  }

  BlockComment(node: BabelNodeBlockComment, parent: ?BabelNode) {
    this.Write("/*" + node.value + "*/");
  }
  LineComment(node: BabelNodeLineComment, parent: ?BabelNode) {
    this.Write("//" + node.value + "\n")
  }
  File(node: BabelNodeFile, parent: ?BabelNode) {
    this.comments = node.comments;
    this.Print(node.program, node);
  }
  Program(node: BabelNodeProgram, parent: ?BabelNode) {
    if (node.directives.length){
      this.PrintList(node.directives, node)
      this.Write("\n")
    }
    this.PrintList(node.body, node)
  }
  Directive(node: BabelNodeDirective, parent: ?BabelNode) {
    this.Print(node.value, node)
    this.Write(";") // directives say they need semicolons
  }
  DirectiveLiteral(node: BabelNodeDirectiveLiteral, parent: ?BabelNode) {
    this.PrintQuote(node.value);
  }
  FunctionDeclaration(node: BabelNodeFunctionDeclaration, parent: ?BabelNode) {
    if (node.async) {
      this.Write("async ")
    }
    this.Write("function")
    if (node.generator) {
      this.Write("*")
    }
    this.Space()
    this.Print(node.id, node)
    this.Space()
    this.Write("(")
    this.PrintList(node.params, node, ", ")
    this.Write(")")
    if (node.returnType) {
      this.Print(node.returnType, node)
    }
    this.Space()
    this.Print(node.body, parent)
  }

  NumericLiteral(node: BabelNodeNumericLiteral, parent: ?BabelNode) {
    this.Write(node.value.toString(10))
  }

  Identifier(node: BabelNodeIdentifier, parent: ?BabelNode) {
    this.Write(node.name)
    if (node.typeAnnotation) {
      this.Print(node.typeAnnotation, node)
    }
  }

  BlockStatement(node: BabelNodeBlockStatement, parent: ?BabelNode) {
    var oneLine = IsOneLine(node)
    this.Write("{")

    this.Indent();
    this.Write("\n")
    if (node.directives && node.directives.length) {
      this.PrintList(node.directives, node, "\n")
      this.Write("\n")
    }
    this.PrintList(node.body, node, "\n")
    this.Dedent()
    this.Write("\n")

    this.Write("}")
  }

  VariableDeclaration(node: BabelNodeVariableDeclaration, parent: ?BabelNode) {
    this.Write(node.kind)
    this.Space()
    this.PrintList(node.declarations, node, ", ")
  }

  VariableDeclarator(node: BabelNodeVariableDeclarator, parent: ?BabelNode) {
    this.Print(node.id, node)
    if (node.init) {
      this.Space()
      this.WriteAlign("=", "decl")
      this.Space()
      this.Print(node.init, parent)
    }
  }

  BooleanLiteral(node: BabelNodeBooleanLiteral, parent: ?BabelNode) {
    this.Write(node.value ? "true" : "false")
  }

  SequenceExpression(node: BabelNodeSequenceExpression, parent: ?BabelNode) {
    this.PrintList(node.expressions, node, ", ")
  }
  AssignmentExpression(node: BabelNodeAssignmentExpression, parent: ?BabelNode) {
    this.Print(node.left, node)
    this.Space()
    this.WriteAlign(node.operator, "assign_" + node.operator)
    this.Space()
    this.Print(node.right, node)
  }

  ReturnStatement(node: BabelNodeReturnStatement, parent: ?BabelNode) {
    this.Write("return");
    if (node.argument) {
      this.Space()
      this.Print(node.argument, node)
    }
  }

  StringLiteral(node: BabelNodeStringLiteral, parent: ?BabelNode) {
    this.PrintQuote(node.value)
  }

  IfStatement(node: BabelNodeIfStatement, parent: ?BabelNode) {
    this.Write("if (")
    this.Print(node.test, node)
    this.Write(") ")
    this.Print(node.consequent, node)
    if (node.alternate) {
      if (!t.isBlockStatement(node.consequent)) {
        this.Write("\nelse ")
      } else {
        this.Write(" else ")
      }

      this.Print(node.alternate, node)
    }
  }

  ExpressionStatement(node: BabelNodeExpressionStatement, parent: ?BabelNode) {
    this.Print(node.expression, node)
  }

  CallExpression(node: BabelNodeCallExpression, parent: ?BabelNode) {
    this.Print(node.callee, node)
    this.Write("(")
    this.PrintList(node.arguments, node, ", ")
    this.Write(")")
  }

  MemberExpression(node: BabelNodeMemberExpression, parent: ?BabelNode) {
    this.Print(node.object, node)
    if (node.computed) {
      this.Write("[")
      this.Print(node.property, node)
      this.Write("]")
    } else {
      this.Write(".")
      this.Print(node.property, node)
    }
  }

  JSXElement(node: BabelNodeJSXElement, parent: ?BabelNode) {
    this.Print(node.openingElement, node)
    if (node.closingElement) {
      if (node.children.length === 1) {
        this.Print(node.children[0], node)
      } else if (node.children.length > 1) {
        this.Indent()
        // this.Write("\n")
        this.PrintList(node.children, node, "\n")
        this.Dedent()
        // this.Write("\n")
      }
      this.Print(node.closingElement, node)
    }
  }

  JSXIdentifier(node: BabelNodeJSXIdentifier, parent: ?BabelNode) {
    this.Write(node.name)
  }
  JSXText(node: BabelNodeJSXText, parent: ?BabelNode) {
    this.Write(node.value.trim())
  }

  JSXAttribute(node: BabelNodeJSXAttribute, parent: ?BabelNode) {
    this.Print(node.name, node)
    if (node.value) {
      this.Write("=")
      this.Print(node.value, node)
    }
  }

  JSXOpeningElement(node: BabelNodeJSXOpeningElement, parent: ?BabelNode) {
    this.Write("<")
    this.Print(node.name, node)
    if (!node.attributes.length) {
      this.Write(node.selfClosing ? "/>" : ">")
      return
    }

    this.Space()

    if (IsOneLine(node)) {
      this.PrintList(node.attributes, node, " ")
    } else {
      this.IndentLock()
      this.PrintList(node.attributes, node, "\n")
      this.DedentLock()
    }

    if (node.selfClosing) {
      this.Write("/>")
    } else {
      this.Write(">")
    }
  }

  JSXClosingElement(node: BabelNodeJSXClosingElement, parent: ?BabelNode) {
    this.Write("</")
    this.Print(node.name, node)
    this.Write(">")
  }

}

function IsOneLine(node: BabelNode): bool {
  if (!node.loc) return true;
  return node.loc.start.line === node.loc.end.line;
}
