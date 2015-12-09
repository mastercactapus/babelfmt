# babelfmt

A `gofmt`-inspired formatter for javascript.

## Usage

Usage is pretty simple, run with `--help` to show info. If no paths are specified, code will be read from stdin.

```

  Usage: babelfmt [flags] [path ...]

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
    -d             display diffs instead of rewriting files
    -l             list files whos formatting differs from babelfmt's
    -w             write result to (source) file instead of stdout

```

### Testing

To test the changes without writing you can use the `-d` flag:

```bash
$ babelfmt -d test.js
===================================================================
--- test.js	
+++ babelfmt/test.js	
@@ -1,1 +1,1 @@
-var foo=1;
+var foo = 1;
```

You can also use stdin to test code formatting (press `CTRL+d` when you are done):

```bash
$ babelfmt -d
var foo=1
[CTRL+d]
===================================================================
--- <standard input>	
+++ babelfmt/<standard input>	
@@ -1,1 +1,1 @@
-var foo=1
+var foo = 1;
```
