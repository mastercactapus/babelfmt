
import {parse} from "babylon";
import generate from "./babel-generator";
import { readFileSync, writeFileSync } from "fs";

var code = readFileSync(process.argv[2]).toString();

var ast = parse(code,{
  sourceType: "module"
});

writeFileSync(process.argv[2], generate(ast,{
  comments: true,
  compact: false
}, code).code + "\n");
