/* @flow */

/* eslint quotes: 0 */

import * as t from "babel-types";
import * as util from "../../util";

export function Identifier(node: Object) {
  this.push(node.name);
}

export function RestElement(node: Object) {
  this.push("...");
  this.print(node.argument, node);
}

export {
  RestElement as SpreadElement,
  RestElement as SpreadProperty,
  RestElement as RestProperty,
};

export function ObjectExpression(node: Object) {
  let props = node.properties;

  this.push("{");
  this.printInnerComments(node);

  if (props.length) {
    let bounds = [];
    let align = props.map((prop,idx)=>{
      if (prop.shorthand) return 0;
      if (prop.computed) return 0;

      // same-line props are exempt
      if (idx>0&&props[idx-1].loc.end.line===prop.loc.start.line) {
        return 0;
      }
      if (idx < props.length-1 && props[idx+1].loc.start.line===prop.loc.end.line) {
        return 0;
      }

      if (idx>0 && props[idx-1].loc.end.line!==prop.loc.start.line-1) {
        // more than one newline means reset indentation
        bounds.push(idx);
      }

      if (prop.key.type === "StringLiteral") {
        // add 2
        return prop.key.value.length + 2;
      } else if (prop.key.type === "Identifier") {
        return prop.key.name.length;
      } else {
        return 0;
      }
    })
    
    align = util.groupMaxBoundariesDiff(align, bounds);

    this.space();
    this.printList(props, node, { indent: true, align });
    this.space();
  }

  this.push("}");
}

export { ObjectExpression as ObjectPattern };

export function ObjectMethod(node: Object) {
  this.printJoin(node.decorators, node, { separator: "" });
  this._method(node);
}

export function ObjectProperty(node: Object, parent: Object, opts: Object) {
  this.printJoin(node.decorators, node, { separator: "" });

  if (node.computed) {
    this.push("[");
    this.print(node.key, node);
    this.push("]");
  } else {
    // print `({ foo: foo = 5 } = {})` as `({ foo = 5 } = {});`
    if (t.isAssignmentPattern(node.value) && t.isIdentifier(node.key) && node.key.name === node.value.left.name) {
      this.print(node.value, node);
      return;
    }

    this.print(node.key, node);

    // shorthand!
    if (node.shorthand &&
      (t.isIdentifier(node.key) &&
       t.isIdentifier(node.value) &&
       node.key.name === node.value.name)) {
      return;
    }
  }

  this.push(":");
  this.space();
  if (opts && opts.alignBy) {
    for (let i=0;i<opts.alignBy;i++){
      this.push(" ");
    }
  }
  this.print(node.value, node);
}

export function ArrayExpression(node: Object) {
  let elems = node.elements;
  let len   = elems.length;

  this.push("[");
  this.printInnerComments(node);

  var lastLine = node.loc.start.line;
  var isMultiLine = false;
  if (lastLine!==node.loc.end.line) {
    this.indent();
    isMultiLine = true;
  }

  for (let i = 0; i < elems.length; i++) {
    let elem = elems[i];
    if (elem) {
      if (elem.loc.start.line === lastLine) {
        this.space();
      } else if (elem.loc.start.line === lastLine+1) {
        this.newline();
      } else {
        this.newline();
        this.newline();
      }
      lastLine = elem.loc.end.line;
      this.print(elem, node);
      if (i < len - 1) this.push(",");
    } else {
      // If the array expression ends with a hole, that hole
      // will be ignored by the interpreter, but if it ends with
      // two (or more) holes, we need to write out two (or more)
      // commas so that the resulting code is interpreted with
      // both (all) of the holes.
      this.push(",");
    }
  }

  if (lastLine!==node.loc.end.line) {
    this.dedent();
    this.newline();
  } else if (isMultiLine) {
    this.dedent();
  }

  this.push("]");
}

export { ArrayExpression as ArrayPattern };

export function RegExpLiteral(node: Object) {
  this.push(`/${node.pattern}/${node.flags}`);
}

export function BooleanLiteral(node: Object) {
  this.push(node.value ? "true" : "false");
}

export function NullLiteral() {
  this.push("null");
}

export function NumericLiteral(node: Object) {
  this.push(node.value + "");
}

export function StringLiteral(node: Object) {
  this.push(this._stringLiteral(node.value));
}

export function _stringLiteral(val: string): string {
  val = JSON.stringify(val);

  // escape illegal js but valid json unicode characters
  val = val.replace(/[\u000A\u000D\u2028\u2029]/g, function (c) {
    return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
  });

  if (this.format.quotes === "single") {
    // remove double quotes
    val = val.slice(1, -1);

    // unescape double quotes
    val = val.replace(/\\"/g, '"');

    // escape single quotes
    val = val.replace(/'/g, "\\'");

    // add single quotes
    val = `'${val}'`;
  }

  return val;
}
