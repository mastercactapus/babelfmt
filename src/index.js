
import { parse } from "babylon";
import generate from "./babel-generator";
import { readFileSync, writeFileSync } from "fs";

var code = readFileSync(process.argv[2]).toString();

var syntaxPlugins = [
	"decorators", "jsx", "flow", "async-functions", "export-extensions", "exponentiation-operator",
	"class-properties", "function-sent", "async-generators", "do-expressions", "function-bind",
	"object-rest-spread", "class-constructor-call", "trailing-function-commas"
];

var shebang = "";
if (code[0] === "#") {
	shebang = /^#.*?$/m.exec(code)[0] + "\n";
	code = code.slice(shebang.length);
}

var ast = parse(code, {
	sourceType: "module",
	plugins: syntaxPlugins
});

writeFileSync(process.argv[2], shebang + generate(ast, {
	comments: true,
	compact: false
}, code).code + "\n");
