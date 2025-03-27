[![npm](https://img.shields.io/npm/dt/jcrush.svg)](#)

JCrush
========================

Deduplicates a JavaScript file.

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
