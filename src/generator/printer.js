
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

    var res = _.partition(comments, c=>{
      return _.any(this.comments, {start: c.start})
    })

      var toPrint: Array<BabelNodeComment> = res[0]
      this.comments = res[1]

    toPrint.forEach((c, index)=>{
      var next = parent
      if (index < toPrint.length-1) next= toPrint[index+1]
      if (c.type==="CommentBlock") {
        this.BlockComment(c, parent)
        this.PrintWhitespace(c, next)
      } else if (c.type==="CommentLine") {
        this.LineComment(c, parent)
        this.PrintWhitespace(c, next, "end", true)
      } else {
        console.error("cannot print unknown comment type: " + c.type)
      }
    })
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
  Super(Node: BabelNodeSuper, parent: ?BabelNode) {
    this.Write("super")
  }
  Directive(node: BabelNodeDirective, parent: ?BabelNode) {
    this.Print(node.value, node)
    this.Write(";") // directives say they need semicolons
  }
  DirectiveLiteral(node: BabelNodeDirectiveLiteral, parent: ?BabelNode) {
    this.PrintQuote(node.value);
  }
  ConditionalExpression(node: BabelNodeConditionalExpression, parent: ?BabelNode) {
    var multiline = node.loc && node.loc.start.line !== node.loc.end.line
    this.Print(node.test, node)
    if (multiline) {
      this.Indent()
      this.Writeln()
    } else {
      this.Space()
    }
    this.Write("? ")
    this.Print(node.consequent, node)
    if (multiline) {
      this.Writeln()
    } else {
      this.Space()
    }
    this.Write(": ")
    this.Print(node.alternate, node)

    if (multiline) this.Dedent()
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
    if (node.id) this.Print(node.id, node)
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
    this.Write(">")
  }
  TypeParameterDeclaration(node: BabelNodeTypeParameterDeclaration, parent: ?BabelNode) {
    this.Write("<")
    this.PrintList(node.params, node, ", ")
    this.Write(">")
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

    this.PrintList(node.arguments, node, ", ")

    if (node.arguments.length && !SameLine(node.callee, node.arguments[0])) {
      this.PrintWhitespace(node.arguments[0], node, "end", false, "end", true)
    }
    this.Write(")")
  }

  ObjectMethod(node: BabelNodeObjectMethod, parent: ?BabelNode) {
    if (node.kind === "get") {
      this.Write("get ")
    } else if (node.kind === "set") {
      this.Write("set ")
    } else if (node.async) {
      this.Write("async ")
    }

    if (node.generator) {
      this.Write("*")
    }

    if (node.computed)   this.Write("[")
      this.Print(node.key, node)
    if (node.computed) this.Write("]")
    this.Space()

    this.Write("(")
    this.Indent()
    this.PrintList(node.params, node, ", ")
    this.Dedent()
    this.Write(") ")

    this.Print(node.body, node)

  }

  WhileStatement(node: BabelNodeWhileStatement, parent: ?BabelNode) {
    this.Write("while (")
    this.Indent()
    this.Print(node.test, node)
    this.Dedent()
    this.Write(") ")
    this.Print(node.body, node)
  }

  ImportDeclaration(node: BabelNodeImportDeclaration, parent: ?BabelNode) {
    this.Write("import ")
    if (!node.specifiers.length) {
      this.Print(node.source, node)
      return
    }


    var named = _.filter(node.specifiers, {type: "ImportSpecifier"});
    var def = _.find(node.specifiers, {type: "ImportDefaultSpecifier"});
    var namespace = _.find(node.specifiers, {type: "ImportNamespaceSpecifier"});

    var needComma = false;
    if (def) {
      this.Print(def, node)
      needComma = true;
    }

    if (namespace) {
      if (needComma) this.Write(", ")
      this.Print(namespace, node)
      needComma = true
    }

    if (named.length) {
      if (needComma) this.Write(", ")
      this.Write("{ ")
      this.Indent()
      this.PrintList(named, node, ", ");
      this.Dedent()
      this.Write(" }")
    }

    this.Write(" from ")
    this.Print(node.source, node)
  }

  TryStatement(node: BabelNodeTryStatement, parent: ?BabelNode) {
    this.Write("try ")
    this.Print(node.block, node)
    this.Space()
    this.Print(node.handler, node)
    if (node.finalizer) {
      this.Space()
      this.Write(" finally ")
      this.Print(node.finalizer, node)
    }
  }
  CatchClause(node: BabelNodeCatchClause, parent: ?BabelNode) {
    this.Write("catch (")
    this.Print(node.param, node)
    this.Write(") ")
    this.Print(node.body, node)
  }

  ImportDefaultSpecifier(node: BabelNodeImportDefaultSpecifier, parent: ?BabelNode) {
    this.Print(node.local, node)
  }

  ImportSpecifier(node: BabelNodeImportSpecifier, parent: ?BabelNode) {
    this.Print(node.imported, node)
    if (node.imported.name !== node.local.name) {
      this.Write(" as ")
      this.Print(node.local, node)
    }
  }

  ImportNamespaceSpecifier(node: BabelNodeImportNamespaceSpecifier, parent: ?BabelNode) {
    this.Write("* as ")
    this.Print(node.local, node)
  }

  ExportNamedDeclaration(node: BabelNodeExportNamedDeclaration, parent: ?BabelNode) {
    this.Write("export ")

    if (node.specifiers.length) {
      this.Write("{ ")
      this.Indent()
      this.PrintList(node.specifiers, node, ", ")
      this.Dedent()
      this.Write(" } ")
    } else if (node.declaration) {
      this.Print(node.declaration, node)
    }
    if (node.source) {
      this.Write(" from ")
      this.Print(node.source, node)
    }
  }

  ExportDefaultDeclaration(node: BabelNodeExportDefaultDeclaration, parent: ?BabelNode) {
    this.Write("export default ")
    this.Print(node.declaration, node)
  }

  ExportSpecifier(node: BabelNodeExportSpecifier, parent: ?BabelNode) {
    this.Print(node.local)
    if (node.exported.name !== node.local.name) {
      this.Write(" as ")
      this.Print(node.exported)
    }
  }

  NullLiteral(node: BabelNodeNullLiteral, parent: ?BabelNode) {
    this.Write("null")
  }

  UpdateExpression(node: BabelNodeUpdateExpression, parent: ?BabelNode) {
    if (node.prefix) {
      this.Write(node.operator)
      this.Print(node.argument, node)
    } else {
      this.Print(node.argument, node)
      this.Write(node.operator)
    }
  }

  TypeAlias(node: BabelNodeTypeAlias, parent: ?BabelNode) {
    this.Write("type ")
    this.Print(node.id, node)
    if (node.typeAnnotation) {
      this.Print(node.typeAnnotation, node)
    }
    this.Space()
    this.WriteAlign("= ", "type_alias")
    this.Print(node.right, node)
  }

  DeclareClass(node: BabelNodeDeclareClass, parent: ?BabelNode) {
    this.Write("declare class ")
    this.Print(node.id, node)
    if (node.typeParameters) {
      this.Print(node.typeParameters)
    }
    if (node.extends.length) {
      this.Write(" extends ")
      this.PrintList(node.extends, node, ", ")
    }
    this.Space()
    this.Print(node.body, node)
  }

  InterfaceExtends(node: BabelNodeInterfaceExtends, parent: ?BabelNode) {
    this.Print(node.id, node)
    if (node.typeParameters) {
      this.Print(node.typeParameters, node)
    }
  }

  FunctionExpression(node: BabelNodeFunctionExpression, parent: ?BabelNode) {
    if (node.async) this.Write("async ")
    this.Write("function")
    if (node.generator) this.Write("*")
    this.Space()
    if (node.id) this.Print(node.id, node)
    this.Write("(")
    this.Indent()
    this.PrintList(node.params, node, ", ")
    this.Dedent()
    this.Write(")")
    this.Space()
    this.Print(node.body, node)
  }

  ThrowStatement(node: BabelNodeThrowStatement, parent: ?BabelNode) {
    this.Write("throw ")
    this.Print(node.argument, node)
  }
  NewExpression(node: BabelNodeNewExpression, parent: ?BabelNode) {
    this.Write("new ")
    this.Print(node.callee, node)
    this.Write("(")
    this.PrintList(node.arguments, node, ", ")
    this.Write(")")
  }

  AnyTypeAnnotation(node: BabelNodeAnyTypeAnnotation, parent: ?BabelNode) {
    this.Write("any")
  }
  NullLiteralTypeAnnotation(node: BabelNodeNullLiteralTypeAnnotation, parent: ?BabelNode) {
    this.Write("null")
  }

  DeclareFunction(node: BabelNodeDeclareFunction, parent: ?BabelNode) {
    this.Write("declare function ")
    this.Print(node.id, node)
  }

  DeclareModule(node: BabelNodeDeclareModule, parent: ?BabelNode) {
    this.Write("declare module ")
    this.Print(node.id, node)
    this.Space()
    this.Print(node.body, node)
  }

  DeclareVariable(node: BabelNodeDeclareVariable, parent: ?BabelNode) {
    this.Write("declare var ")
    this.Print(node.id, node)
  }

  ExistentialTypeParam(node: BabelNodeExistentialTypeParam, parent: ?BabelNode) {
    this.Write("*")
  }

  FunctionTypeAnnotation(node: BabelNodeFunctionTypeAnnotation, parent: ?BabelNode) {
    if (node.typeParameters) this.Print(node.typeParameters)
    this.Write("(")
    this.PrintList(node.params, node, ", ");

    if (node.rest) {
      if (node.params.length) {
        this.Write(", ");
      }
      this.Write("...")
      this.Print(node.rest,node)
    }

    this.Write(")")

    if (t.isObjectTypeProperty(parent) || t.isObjectTypeCallProperty(parent) || t.isDeclareFunction(parent)) {
      this.Write(": ")
    } else {
      this.Space()
      this.Write(" => ")
    }
    if (node.returnType) this.Print(node.returnType, node)
  }

  FunctionTypeParam(node: BabelNodeFunctionTypeParam, parent: ?BabelNode) {
    this.Print(node.name, node)
    if (node.optional) this.Write("?")
    this.Write(": ")
    this.Print(node.typeAnnotation)
  }

  ObjectTypeAnnotation(node: BabelNodeObjectTypeAnnotation, parent: ?BabelNode) {
    this.Write("{")
    var props = node.properties.concat(node.callProperties, node.indexers)
    if (props.length) {
      this.Indent()
      this.PrintList(props, node, ";\n")
      this.Write(";")
      this.Dedent()
      this.Writeln()
    }
    this.Write("}")
  }

  ObjectTypeProperty(node: BabelNodeObjectTypeProperty, parent: ?BabelNode) {
    if (node.static) this.Write("static ")
    this.Print(node.key, node)
    if (node.optional) this.Write("?")
    if (!t.isFunctionTypeAnnotation(node.value)) {
      this.Write(": ")
    }
    this.Print(node.value, node);
  }

  ObjectTypeCallProperty(node: BabelNodeObjectTypeCallProperty, parent: ?BabelNode) {
    if (node.static) this.Write("static ")
    this.Print(node.value, node)
  }

  ObjectTypeIndexer(node: BabelNodeObjectTypeIndexer, parent: ?BabelNode) {
    if (node.static) this.Write("static ")
    this.Write("[")
    this.Print(node.id, node)
    this.Write(": ")
    this.Print(node.key, node)
    this.Write("]: ")
    this.Print(node.value, node)
  }

  RegExpLiteral(node: BabelNodeRegExpLiteral, parent: ?BabelNode) {
    this.Write("/" + node.pattern + "/" + node.flags)
  }

  ExportAllDeclaration(node: BabelNodeExportAllDeclaration, parent: ?BabelNode) {
    this.Write("export * from ")
    this.Print(node.source)
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

  ClassDeclaration(node: BabelNodeClassDeclaration, parent: ?BabelNode) {
    if (node.decorators && node.decorators.length) {
      this.PrintList(node.decorators, node)
      this.Writeln()
    }
    this.Write("class ")
    this.Print(node.id, node)
    if (node.typeParameters) {
      this.Print(node.typeParameters, node)
    }
    this.Space()
    if (node.superClass) {
      this.Write("extends ")
      this.Print(node.superClass, node)
      if (node.superTypeParameters) {
        this.Print(node.superTypeParameters, node)
      }
      this.Space()
    }
    this.Print(node.body, node)
  }

  ClassBody(node: BabelNodeClassBody, parent: ?BabelNode) {
    this.Write("{")
    this.Writeln()
    this.Indent()
    this.PrintList(node.body, node)
    this.Dedent()
    this.Writeln()
    this.Write("}")
  }

  ClassMethod(node: BabelNodeClassMethod, parent: ?BabelNode) {
    if (node.static) {
      this.Write("static ")
    }

    if (node.kind === "get") {
      this.Write("get ")
    } else if (node.kind === "set") {
      this.Write("set ")
    } else if (node.async) {
      this.Write("async ")
    }

    if (node.generator) {
      this.Write("*")
    }

    if (node.computed) this.Write("[")
    this.Print(node.key)
    if (node.computed) this.Write("]")

    if (node.typeParameters) {
      this.Print(node.typeParameters, node)
    }

    this.Space()

    this.Write("(")
    this.Indent()
    this.PrintList(node.params, node)
    this.Dedent()
    this.Write(")")

    this.Space()

    this.Print(node.body, node)

  }

  ClassProperty(node: BabelNodeClassProperty, parent: ?BabelNode) {
    if (node.static) {
      this.Write("static ")
    }
    if (node.computed) this.Write("[")
    this.Print(node.key, node)
    if (node.computed) this.Write("]")
    if (node.typeAnnotation) {
      this.Print(node.typeAnnotation, node)
    }
    if (node.value) {
      this.WriteAlign(" = ", "class_prop")
      this.Print(node.value, node)
    }
  }

  NumberTypeAnnotation(node: BabelNodeNumberTypeAnnotation, parent: ?BabelNode) {
    this.Write("number")
  }

  JSXElement(node: BabelNodeJSXElement, parent: ?BabelNode) {
    this.Print(node.openingElement, node)
    if (node.closingElement) {
      if (node.children.length === 1) {
        this.Print(node.children[0], node)
      } else if (node.children.length > 1) {
        this.Indent()
        this.PrintList(node.children, node, "\n")
        this.Dedent()
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
