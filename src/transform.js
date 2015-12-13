import * as t from "babel-types";
export default {
  IfStatement(path: NodePath) {
    var node: BabelNodeIfStatement = path.node;

    if (node.consequent.type !== "BlockStatement") {
      path.get("consequent").replaceWith(t.blockStatement([node.consequent], []))
    }

    if (node.alternate && node.alternate.type !== "BlockStatement" && node.alternate.type !== "IfStatement") {
      path.get("alternate").replaceWith(t.blockStatement([node.alternate], []))
    }
  },
  VariableDeclaration(path: NodePath) {
    // if not export!
    var hasInit = []
    var noInit = []
    var node: BabelNodeVariableDeclaration = path.node;
    if (node.declarations.length < 2) return;
    node.declarations.forEach(decl=>{
      if (decl.init) {
        hasInit.push(decl)
      } else {
        noInit.push(decl)
      }
    })
    if (hasInit.length > 0) {
      node.declarations = noInit
      hasInit.reverse()
      hasInit.forEach(decl=>{
        path.insertAfter(t.VariableDeclaration(node.kind, [decl]))
      })
    }
  }
}
