
import { parse } from "babylon";
import generate from "./index";
import { readFileSync, writeFileSync } from "fs";
import cli from "commander"


const syntaxPlugins = [
	"decorators", "jsx", "flow", "async-functions", "export-extensions", "exponentiation-operator",
	"class-properties", "function-sent", "async-generators", "do-expressions", "function-bind",
	"object-rest-spread", "class-constructor-call", "trailing-function-commas"
];

cli
.version(require("../package").version)
.usage("[flags] <file ...>")
.option("-d", "display diffs instead of rewriting files")
.option("-l", "list files whos formatting differs from babelfmt's")
.option("-w", "write result to (source) file instead of stdout")
.parse(process.argv);

if (cli.args.length === 0) {// read from stdin

	if (cli.W) {
		console.error("error: cannot use -w with standard input");
		process.exit(1);
	}

	let data = "";
	process.stdin.on("data", buf=>data+=buf.toString())
	process.stdin.on("end",()=>processData("",data));
	process.stdin.resume();
} else {
	cli.args.forEach(file=>processData(file,readFileSync(file).toString()))
}

function processData(filename: string, code: string) {
	var formatted = format(code);
	var isDiff = formatted === code;
	if (cli.L) {
		console.log(filename);
	}
	if (cli.D) {
		// not implemented
	}
	if (cli.W) {
		writeFileSync(filename, formatted);
	} else if (!cli.L) {
		process.stdout.write(formatted);
	}
}

function format(_code: string): string {
	var shebang = "", code = "";
	if (_code[0] === "#") {
		shebang = /^#.*?$/m.exec(code)[0] + "\n";
		code = _code.slice(shebang.length);
	} else {
		code = _code;
	}

	var ast = parse(code, {
		sourceType: "module",
		plugins: syntaxPlugins
	});

	return shebang + generate(ast, {
	comments: true,
	compact: false
}, code).code + "\n";
} 
