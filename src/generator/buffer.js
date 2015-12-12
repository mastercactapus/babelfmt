/* @flow */
import _ from "lodash";

declare class BufferPosition {
  Line: number;
  Column: number;
}

declare class BufferToken {
  prev: ?BufferNode;
  next: ?BufferNode;
  startOfLine: ?bool;
  endOfLine: ?bool;
  alignType: ?string;
  padRight: ?bool;
  padLeft: ?bool;
  indent: ?number;
  value: string;
}

export default class Buffer {
  constructor() {
    this._indentFormat = "  ";
    this.Reset()
  }

  _head: BufferToken;
  _tail: BufferToken;
  _indentFormat: string;
  _indent: number;
  _line: number;
  _col: number;

  Reset() {
    this._indent = 0
    this._line = 0
    this._col = 0
    this._len = 0
    this._head = {indent:0,value:""}
    this._tail = this._head
  }

  Line(): number {
    return this._line
  }

  Indent() {
    this._indent++;
  }

  Dedent() {
    this._indent--;
  }

  WriteBuffer(b: Buffer) {
    this.Write(b.String());
  }

  Space() {
    this._tail.padRight = true;
  }

  push(t: BufferToken) {
    if (t.value === "" && this._tail.value === "" && this._tail.startOfLine === true) {
      this._tail.endOfLine = true;
      return
    }
    if (t.value.match(/\s$/)) {
      t.value = t.value.replace(/\s+$/, "")
      t.padRight = true;
    }
    if (t.value.match(/^\s/)) {
      t.value = t.value.replace(/^\s+/, "")
      t.padLeft = true;
    }


    if (this._tail.endOfLine) {
      t.startOfLine = true;
    }
    if (t.startOfLine) {
      this._tail.endOfLine = true;
    }
    t.indent = this._indent;
    this._tail.next = t;
    t.prev = this._tail;
    this._tail = t;
    if (this._tail.startOfLine) {
      this._line++;
      this._col=0;
      this._len++;
    }
    this._len += this._tail.value.length + (this._tail.indent*this._indentFormat.length);
  }

  IsNewLine(): bool {
    return !!this._tail.endOfLine;
  }

  // same types on adjacent lines will be aligned in a grid
  WriteAlign(s: string, alignType: string) {
    this.Write(s, alignType)
  }

  Writeln(s: ?string, alignType: ?string) {
    if (s) {
      var parts = s.split("\n")
      if (parts.length > 1) {
        parts.forEach(part=>this.Writeln(part))
        return;
      }
    }
    this.push({value: s||"", endOfLine: true, alignType})
  }
  Write(s: string, alignType: ?string) {
    if (s === "\n") {
      this.Writeln("", alignType)
      return;
    }
    var parts = s.split("\n");
    if (parts.length > 1) {
      parts.slice(0,-1).forEach(part=>this.Writeln(part, alignType))
      this.push({value: _.last(parts), alignType})
      return
    }
    this.push({value: s, alignType})
  }

  removeToken(t: BufferToken) {
    if (t.prev) {
      t.prev.next = t.next;
    }
    if (t.next) {
      t.next.prev = t.prev;
    }
    t.prev= null;
    t.next= null;
    if (this._tail === t) {
      this._tail = t.prev;
    }
  }

  TrimNewlines() {
    if (this._tail.value==="") {
      this.removeToken(this._tail)
    }
    this._tail.endOfLine = false;
  }

  String(): string {
    var buf = ""
    var t = this._head
    while (t) {
      if (t.startOfLine && t.value!="") {
        buf+=_.repeat(this._indentFormat, t.indent)
      }
      if (t.startOfLine && t.value && (t.value[0]=== "(" ||t.value[0]==="[")   ) {
        // add semicolon in front of [ or ( on new line
        buf+=";"
      }

      if (t.padLeft && !t.startOfLine && !t.prev.padRight) {
        buf+=" "
      }
      buf+=t.value
      if (t.padRight && !t.endOfLine) {
        buf+=" "
      }

      if (t.endOfLine) buf+="\n"
      t=t.next
    }
    return buf;
  }
}
