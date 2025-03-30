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
node jcrush input.js output.js
```

This will process the `input.js` file, deduplicate its strings, and save the output to `output.js`.

#### Optional Command Line Flags

You can modify the behavior of **JCrush** by passing the following options as command-line flags:

```bash
node jcrush input.js output.js --eval 1 --let 0
```

See ***Parameters*** section below for an explanation of these options.

### Gulp Integration

In your `gulpfile.mjs`, use **JCrush** as a Gulp plugin:

#### Step 1: Import **JCrush**

```javascript
import jcrush from 'jcrush';
```

#### Step 2: Create a Gulp Task for JCrush

```javascript
gulp.task('jcrush', function () {
  let opts = { eval: 1, let: 0 }; // Optional - see 'Parameters' section below.
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

- `eval` (Boolean, default: `true`):
  - If `true`, **JCrush** will use `eval()` for executing code strings, which has shorter output.
  - If `false`, **JCrush** will use `new Function()` instead, which may be more secure in some environments.

- `let` (Boolean, default: `false`):
  - If `true`, **JCrush** will use the `let` keyword for variable declarations.
  - If `false`, it will create global variables without preceeding with any keyword, for shorter output.

- `semi` (Boolean, default: `false`):
  - If `true`, **JCrush** will put a semi-colon at the end of the file.
  - If `false`, no semi-colon, for shorter output.

- `strip` (Boolean, default: `true`):
  - If `true`, **JCrush** will strip escaped newlines and any adjacent whitespace from input.
  - If `false`, will retain the input as-is.

- `reps` (Number, default: 0):
  - Used to set a maximum number of compression replacements.

Additionally, you can alter compression behavior:

- `maxLen` (Number, default: 40): The maximum length of substrings to consider.  Setting this higher will slow things down.
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

## Origin

This script is an adaptation of svgTask.js in [Ant Farm Social](https://github.com/antfarmsocial/AntFarmSocial).
That project takes advantage of the [Longest Repeated Strings](https://www.npmjs.com/package/longestrepeatedstrings) package,
as does this one.

---

## Contributing

https://github.com/braksator/jcrush

In lieu of a formal style guide, take care to maintain the existing coding
style.
