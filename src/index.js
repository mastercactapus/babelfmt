
import {parse} from "babylon";
import generate from "./babel-generator";
import { readFileSync, writeFileSync } from "fs";

var code = readFileSync(process.argv[2]).toString();

var shebang = "";
if (code[0] === "#") {
	shebang = /^#.*?$/m.exec(code)[0] + "\n";
	code = code.slice(shebang.length);
}


var ast = parse(code,{
  sourceType: "module"
});

writeFileSync(process.argv[2], shebang + generate(ast,{
  comments: true,
  compact: false
}, code).code + "\n");
