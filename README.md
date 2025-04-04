[![npm](https://img.shields.io/npm/dt/jcrush.svg)](#)

JCrush
========================

Deduplicates a Javascript file.

> Unlike typical code minification (e.g. terser), JCrush can handle code that contains a lot of big words in strings.  You'll want to run it after your usual minifier.  It will work on text files other than Javascript files, but the resulting file must be interpreted using Javascript.

It will produce a file that looks like:
```javascript
a=`used phrases`,b=`frequently`;eval(`There are `+a+` that appear`+b)
```
It's a bit scary... but it works!
By the way, running JCrush over a sizable js file with the default maximum-compression options is quite slow.

For a CSS equivalent see [Gulp JCrush CSS](https://www.npmjs.com/package/gulp-jcrushcss).

## Installation

This is a Node.JS module available from the Node Package Manager (NPM).

https://www.npmjs.com/package/jcrush

Here's the command to download and install from NPM:

`npm install jcrush -S`

or with Yarn:

`yarn add jcrush`

## Usage

### Command Line

To run **JCrush** from the command line:

```bash
node node_modules/jcrush input.js output.js
```

This will process the `input.js` file, deduplicate its strings, and save the output to `output.js`.

#### Optional Command Line Flags

You can modify the behavior of **JCrush** by passing command-line flags:

```bash
node node_modules/jcrush input.js output.js --semi 1 --let 0
```

See ***Parameters*** section below for an explanation of these options.

### In a Custom Script

Process code in a string:
```javascript
var jcrush = require('jcrush');
var output = jcrush.code(inputCode, opts);
```

Process a file:
```javascript
var jcrush = require('jcrush');
jcrush.file(inputFilename, outputFilename, opts);
```

See ***Parameters*** section below for an explanation of the `opts` object.

### Gulp Integration

In your `gulpfile.mjs`, use **JCrush** as a Gulp plugin:

#### Step 1: Import **JCrush**

```javascript
import jcrush from 'jcrush';
```

#### Step 2: Create a Gulp Task for JCrush

```javascript
gulp.task('jcrush', function () {
  let opts = { let: 0 }; // Optional - see 'Parameters' section below.
  return gulp.src('script.min.js')
    .pipe(jcrush.gulp(opts))
    .pipe(gulp.dest('./'));
});
```

#### Step 3: Run **JCrush** After Minification

To run **JCrush** after your minification tasks, add JCrush in series after other tasks, such as in this example:

```javascript
gulp.task('default', gulp.series(
  gulp.parallel('minify-css', 'minify-js', 'minify-html'), // Run your minification tasks first
  'jcrush' // Then run JCrush
));
```

---

## Parameters

### `opts` (Object, optional)

A configuration object with the following properties:

- `wrap` (String, default: `eval`):
  - If `eval`, **JCrush** will use `eval()` for executing code strings, which has shorter output.
  - If `newFunc`, **JCrush** will use `new Function()` instead, which may be more secure in some environments.
  - If `custom`, **JCrush** will use options `customPre` and `customPost` to wrap the code string.

- `let` (Boolean, default: `false`):
  - If `true`, **JCrush** will use the `let` keyword for variable declarations.
  - If `false`, it will create global variables without preceeding with any keyword, for shorter output.

- `semi` (Boolean, default: `false`):
  - If `true`, **JCrush** will put a semi-colon at the end of the file.
  - If `false`, no semi-colon, for shorter output.

- `strip` (Boolean, default: `true`):
  - If `true`, **JCrush** will strip escaped newlines and any adjacent whitespace from input.
  - If `false`, will retain the input as-is.

- `reps` (Number, default: `0`):
  - Used to set a maximum number of compression replacements.

- `prog` (Boolean, default: `true`):
  - If `true`, **JCrush** will output console messages about each replacement.
  - If `false`, will work silently.

- `fin` (Boolean, default: `true`):
  - If `true`, **JCrush** will output a final console message about bytes saved or failure.
  - If `false`, will remain silent.

- `tpl` (Boolean, default: `false`):
  - If `true`, **JCrush** will use template literal syntax `${...}` for replacements.
  - If `false`, will use string concatenation which may be more optimal with code that already uses a lot of template literals.

- `tplEsc` (Boolean, default: `false`):
  - If `true`, **JCrush** will escape template literals in input.
  - If `false`, won't escape template literals, but will result in error if using `tpl` option with code that contains template literals.

- `resVars` (Array, default: `[]`):
  Supply an array of variable names that JCrush must NOT use for some reason.

- `customPre` (String, default: `''`):
  Supply a custom string to prepend to the main code string. Used when `wrap` is set to `custom`.

- `customPost` (String, default: `''`):
  Supply a custom string to append to the main code string. Used when `wrap` is set to `custom`.


Additionally, you can alter compression behavior:

- `maxLen` (Number, default: `40`): The maximum length of substrings to consider.  Setting this higher will slow things down.
- `omit` (Array, default: `[]`): An array of substrings to omit from deduplication. Can be used to ignore accepted long/frequent words.
- `clean` (Boolean, default: `false`): If `true`, Strips symbols from input.  Keep it `false` to dedupe all code, set it to `true` to focus only on words.
- `words` (Boolean, default: `false`): If `true`, matches whole words which speeds up processing.  When `false` finds more compression opportunities but performs very poorly.
- `trim` (Boolean, default: `false`): If `true`, won't dedupe white space.  When `false` finds more compression opportunities.
- `break` (Array, default: `[]`): An array of substrings *by* which to split input. The break substring won't be matched. This can be used to concatenate an array of texts with a special char.
- `split` (Array, default: `[':', ';', ' ', '"', '.', ',', '{', '}', '(', ')', '[', ']', '=']`): Splits input after specified
strings and may include them in matches as well as any whitespace afterwards. Setting these up properly for your particular input is key
to balancing the effectiveness of compression vs the efficiency of execution time.  The more splits in input the more compression
opportunities are found, whereas fewer splits executes much faster but won't compress as much.
- `escSafe` (Boolean, default: `true`): Will take extra care around escaped characters.  You'll probably want to keep this.

---

## Unnecessary Reprocessing

To prevent unnecessarily reprocessing files consider using [gulp-changed](https://www.npmjs.com/package/gulp-changed),
[gulp-cached](https://www.npmjs.com/package/gulp-cached), or [gulp-newer](https://www.npmjs.com/package/gulp-newer).

For custom scripts, you can add a simple check for file modified times like in this example:

```js
var fs = require('fs');
var path = require('path');
if (!fs.existsSync(outFile) || fs.statSync(inFile).mtime > fs.statSync(outFile).mtime) {
  // JCrush needs to run
}
```

---

## Origin

This script was written for [Ant Farm Social](https://github.com/antfarmsocial/AntFarmSocial)
and takes advantage of the [Longest Repeated Strings](https://www.npmjs.com/package/longestrepeatedstrings) package.

---

## Contributing

https://github.com/braksator/jcrush

In lieu of a formal style guide, take care to maintain the existing coding
style.
