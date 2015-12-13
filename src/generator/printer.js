
import Buffer from "./buffer";
import _ from "lodash";
import * as t from "babel-types";

function SameLine(nodeA: BabelNode, nodeB: BabelNode): bool {
  if (!nodeA.loc || !nodeB.loc) return true;
  return nodeA.loc.end.line === nodeB.loc.start.line;
}


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

  PrintWhitespace(nodeA: ?BabelNode, nodeB: ?BabelNode, loc: "start"|"end" = "end", skipOne: bool = false, locB:"start"|"end"="start", skipTwo: bool = false) {
    if (!nodeA || !nodeA.loc || !nodeB || !nodeB.loc) return
    var lineB = locB==="start" ? nodeB.loc.start.line : nodeB.loc.end.line;
    var lineA = loc==="start" ? nodeA.loc.start.line : nodeA.loc.end.line;
    if (!skipOne && !this.IsNewLine() && lineA !== lineB) {
      this.Writeln()
    }
    if (!skipTwo && lineB - lineA > 1) {
      this.Writeln()
    }
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

  PrintList(nodes: Array<BabelNode>, parent: ?BabelNode, separator: string = "\n", alignType: string = "") {
    if (nodes.length && parent) {
      if (parent.type === "CallExpression") {
        this.PrintWhitespace(parent.callee, nodes[0], "end", false, "start")
      } else {
        this.PrintWhitespace(parent, nodes[0], "start")
      }
    }
    nodes.forEach((node, index)=>{
      if (alignType) {
        this.Write("", alignType)
      }
      if (index) {
        this.Write(separator);
        this.PrintWhitespace(nodes[index-1], node, "end", separator.indexOf("\n") !== -1 )
      }
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
    if (node.typeParameters) {
      this.Print(node.typeParameters, node)
    }
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
    if (node.optional) {
      this.Write("?")
    }
    if (node.typeAnnotation) {
      this.Print(node.typeAnnotation, node)
    }
  }

  BlockStatement(node: BabelNodeBlockStatement, parent: ?BabelNode) {
    var oneLine = IsOneLine(node)
    this.Write("{")

    var count = node.body.length;
    if (node.directives) count+=node.directives.length;

    if (count === 0) {
      this.Write("}")
      return
    }

    var multiline = true;
    if (count === 1 && node.loc && node.loc.start.line === node.loc.end.line) multiline = false;

    if (multiline) {
      this.Indent();
      this.Writeln()
    } else {
      this.Space()
    }
    if (node.directives && node.directives.length) {
      this.PrintList(node.directives, node, "\n")
      if (node.body.length) this.Writeln()
    }
    this.PrintList(node.body, node, "\n")
    if (multiline) {
      this.Dedent()
      this.Writeln()
    } else {
      this.Space()
    }

    this.Write("}")
  }
  UnaryExpression(node: BabelNodeUnaryExpression, parent: ?BabelNode) {
    var needsSpace = /[a-z]$/.test(node.operator);
    var arg = node.argument;

    if (t.isUpdateExpression(arg) || t.isUnaryExpression(arg)) {
      needsSpace = true;
    }

    if (t.isUnaryExpression(arg) && arg.operator === "!") {
      needsSpace = false;
    }

    this.Write(node.operator)
    if (needsSpace) this.Space();
    this.Print(node.argument, node);
  }
  VariableDeclaration(node: BabelNodeVariableDeclaration, parent: ?BabelNode) {
    this.Write(node.kind)
    this.Space()
    this.PrintList(node.declarations, node, ", ")
  }

  VariableDeclarator(node: BabelNodeVariableDeclarator, parent: ?BabelNode) {
    var indent = false;
    if (this.IsNewLine() && parent && t.isVariableDeclaration(parent)) {
        indent =true;
        this.Indent()
    }
    this.Print(node.id, node)
    if (node.init) {
      this.Space()
      this.WriteAlign("=", "decl")
      this.Space()
      this.Print(node.init, parent)
    }
    if (indent) this.Dedent()
  }

  TypeAnnotation(node: BabelNodeTypeAnnotation, parent: ?BabelNode) {
    this.Write(": ")
    this.Print(node.typeAnnotation, node)
  }
  GenericTypeAnnotation(node: BabelNodeGenericTypeAnnotation, parent: ?BabelNode) {
    this.Print(node.id, node)
    if (node.typeParameters) {
      this.Print(node.typeParameters, node)
    }
  }
  BooleanTypeAnnotation(node: BabelNodeBooleanTypeAnnotation, parent: ?BabelNode) {
    this.Write("boolean")
  }
  TypeParameterInstantiation(node: BabelNodeTypeParameterInstantiation, parent: ?BabelNode) {
    this.Write("<")
    this.PrintList(node.params, node, ", ")
  }
  StringTypeAnnotation(node: BabelNodeStringTypeAnnotation, parent: ?BabelNode) {
    this.Write("string")
  }
  ThisExpression(node: BabelNodeThisExpression, parent: ?BabelNode) {
    this.Write("this")
  }
  NullableTypeAnnotation(node: BabelNodeNullableTypeAnnotation, parent: ?BabelNode) {
    this.Write("?")
    this.Print(node.typeAnnotation, node)
  }
  AssignmentPattern(node: BabelNodeAssignmentPattern, parent: ?BabelNode) {
    this.Print(node.left, node)
    this.Write(" = ")
    this.Print(node.right, node)
  }
  UnionTypeAnnotation(node: BabelNodeUnionTypeAnnotation, parent: ?BabelNode) {
    this.PrintList(node.types, node, "|")
  }
  StringLiteralTypeAnnotation(node: BabelNodeStringLiteralTypeAnnotation, parent: ?BabelNode) {
    this.PrintQuote(node.value)
  }
  ArrowFunctionExpression(node: BabelNodeArrowFunctionExpression, parent: ?BabelNode) {
    if (node.async) {
      this.Write("async ")
    }
    if (node.params.length === 1 && !node.params[0].typeAnnotation) {
      this.Print(node.params[0], node)
    } else {
      this.Write("(")
      this.PrintList(node.params, node, ", ")
      this.Write(")")
    }
    this.Space()
    this.Write("=>")
    this.Space()
    this.Print(node.body, node)
  }

  ArrayExpression(node: BabelNodeArrayExpression, parent: ?BabelNode) {
    this.Write("[")
    if (node.elements.length) this.Space()
    this.Indent()
    this.PrintList(node.elements, node, ", ", "array_element")
    this.Dedent()
    if (node.elements.length) {
      this.Space()
      var lastEl = node.elements[node.elements.length-1];
      this.PrintWhitespace(lastEl, node, "end", false, "end")
    }
    this.Write("]")
  }

  BinaryExpression(node: BabelNodeBinaryExpression, parent: ?BabelNode) {
    this.Print(node.left, node)
    this.Indent()
    if (!SameLine(node.left, node.right)) {
      this.Writeln()
    } else {
      this.Space()
    }
    this.Write(node.operator)
    this.Space()
    this.Print(node.right, node)
    this.Dedent()
  }

  LogicalExpression(node: BabelNodeLogicalExpression, parent: ?BabelNode) {
    this.Print(node.left, node)
    this.Indent()
    if (!SameLine(node.left, node.right)) {
      this.Writeln()
    } else {
      this.Space()
    }
    this.Write(node.operator)
    this.Space()
    this.Print(node.right, node)
    this.Dedent()
  }

  ObjectExpression(node: BabelNodeObjectExpression, parent: ?BabelNode) {
    this.Write("{")
    if (node.properties.length) this.Space()
    this.Indent()
    this.PrintList(node.properties, node, ", ")
    this.Dedent()
    if (node.properties.length) {
      this.Space()
      var lastProp = node.properties[node.properties.length-1];
      this.PrintWhitespace(lastProp, node, "end", false, "end")
    }
    this.Write("}")
  }
  ObjectProperty(node: BabelNodeObjectProperty, parent: ?BabelNode) {
    if (node.decorators && node.decorators.length) {
      this.PrintList(node.decorators, node, "\n")
      this.Writeln()
    }
    if (node.shorthand) {
      this.Print(node.key, node)
      return
    }
    if (node.computed) {
      this.Write("[")
    }
    this.Print(node.key, node)
    if (node.computed) {
      this.Write("]")
    }
    this.WriteAlign(": ", "object_prop")
    this.Print(node.value, node)
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
    this.Indent()

    this.PrintList(node.arguments, node, ", ")
    this.Dedent()

    if (node.arguments.length && !SameLine(node.callee, node.arguments[0])) {
      this.PrintWhitespace(node.arguments[0], node, "end", false, "end", true)
    }
    this.Write(")")
  }

  MemberExpression(node: BabelNodeMemberExpression, parent: ?BabelNode) {
    this.Print(node.object, node)
    if (node.computed) {
      this.Write("[")
      this.Print(node.property, node)
      this.Write("]")
    } else {
      if (!SameLine(node.object, node.property)) {
        this.Writeln()
      }
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
