
import {parse} from "babylon";
import generate from "./babel-generator";
import { readFileSync } from "fs";

var code = readFileSync(process.argv[2]).toString();

var ast = parse(code,{
  sourceType: "module"
});

console.log(generate(ast,{
  comments: true,
  compact: false
}, code).code);
