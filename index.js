#!/usr/bin/env node
'use strict';

/**
 * @file
 * JCrush - A Javascript deduplicator & compressor.
 */

var fs = require('fs').promises;
var LRS = require('longestrepeatedstrings');

const jcrush = module.exports = {

  /**
   * Determines if a generated variable name is no good.
   * @param {string} varName - The variable name as a string.
   * @returns {bool} - True if the variable name is a reserved word.
   */
  isBadVarName: varName => {
    try {
      // Try using the string as a variable name
      eval(`let ${varName} = 1`);
      return false; // If no error, it's a valid variable name
    }
    catch (e) {
      return true; // If there's an error, it's a bad variable name
    }
  },

  /**
   * Generate the next alphanumeric identifier in the sequence.
   * @param {string} str - The identifier as a string.
   * @returns {string} - The next identifier.
   */
  nextVar: str => {
    // Position of char to change
    var change = str.length - 1,
      // The value of that char
      changeChar = str[change],
      // Number of zeros to append when flipping
      zeros = 0;
    // Iterate backwards while there's a z (flipping)
    while (changeChar == 'z') {
      // Increase the length of appended zeros
      zeros++;
      // Move the char to change back
      changeChar = str[--change];
    }
    // Full flip - string increases in length
    if (changeChar == undefined) str = 'a' + Array(str.length + 1).join("0");
    // Normal increment with partial flip and 9->a handling
    else str = str.slice(0, change) + (changeChar == '9' ? 'a' : String.fromCharCode(str.charCodeAt(change) + 1)) + '0'.repeat(zeros)
    return jcrush.isBadVarName(str) ? jcrush.nextVar(str) : str;
  },

  /**
   * Gets length of string in bytes.
   * @param {string} str - The string to check.
   * @returns {int} - The number of bytes.
   */
  byteLen: str => new TextEncoder().encode(str).length,

  /**
   * Finds a unique break control string that does not appear in text.
   * @param {string} str - The text to check.
   * @returns {string} - The break string.
   */
  getBreak: str => {
    let control = "•";
    while (str.includes(control)) control += "•"
    return control;
  },

  /**
   * Determines the optimal way to quote a string while minimizing escaping.
   * - Prefers double quotes if no `"` exists.
   * - Prefers single quotes if no `'` exists.
   * - Prefers backticks if no template literals (`${}`) or backticks exist.
   * - If all contain conflicts, selects the quote type requiring the least escaping.
   *
   * @param {string} val - The string to be quoted.
   * @returns {string} - The quoted string with minimal escaping.
   */
  quoteVal: val => {
    // Test all three options with escaping
    let dq = `"${val.replace(/(?<!\\)"/g, '\\"')}"`,
        sq = `'${val.replace(/(?<!\\)'/g, "\\'")}'`,
        bt = `\`${val.replace(/`/g, '\\`').replace(/(?<!\\)\$\{/g, '\\${').replace(/(?<!\\)\}/g, '\\}')}\``;
    // Return the shortest
    return (dq.length <= sq.length && dq.length <= bt.length) ? dq : sq.length <= bt.length ? sq : bt;
  },

  /**
   * Fixes malformed template literals
   * @param {string} str - The string to check.
   * @returns {string} - The corrected string.
   */
  fixTemplateLiteral: str => {
    let firstClose = str.indexOf('}'), firstOpen = str.indexOf('${');
    if (firstClose < firstOpen || (firstClose != -1 && firstOpen == -1)) str = str.slice(firstClose + 1);
    let lastOpen = str.lastIndexOf('${');
    return lastOpen != -1 && str.indexOf('}', lastOpen) == -1 ? str.slice(0, lastOpen) : str;
  },

  /**
   * Processes Javascript content by deduplicating strings and wrapping it.
   * @param {string} jsCode - The Javascript code as a string.
   * @returns {string} - The transformed Javascript.
   */
  code: (jsCode, opts = {}) => {
    // Add default options
    let jsCodeBkp = jsCode;
    opts = { ...{ wrap: 'eval', let: 0, semi: 0, break: [], split: [':', ';', ' ', '"', '.', ',', '{', '}', '(', ')', '[', ']', '='],
      maxLen: 40, minOcc: 2, omit: [], trim: 0, clean: 0, escSafe: 1, words: 0, strip: 1, reps: 0, prog: 1, fin: 1, tpl: 0,
      escTpl: 0, resVars: [] }, ...opts };
    // Strip escaped newlines and any whitespace adjacent to them.
    if (opts.strip) jsCode = jsCode.replace(/\s*\\n\s*/g, '');
    if (opts.escTpl) jsCode = jsCode.replace(/`/g, '\\`').replace(/(?<!\\)\$\{/g, '\\${').replace(/(?<!\\)\}/g, '\\}');
    // Note: "overhead" is the max per-occurence overhead (++), and "boilerplate" is the definition overhead (=,)
    let originalSize = jcrush.byteLen(jsCode), codeData = [{val: jsCode, type: 's'}], c, lastIndex, regex, match, parts, searchStr, estimate,
      quotedSearchStr, breakString = jcrush.getBreak(jsCode), r, varName = 'a', skipped = 0, overhead = 2, tplOverhead = 0, boilerplate = 2, reps = {}, vars,
      saving, quotedSearchStrLen, repCount = 0, tplBraces = 0, tplSearchStr;
    // Pass the break string into the options
    opts.break.push(breakString);
    if (opts.tpl) {
      if (/(?<!\\)\$\{/.test(jsCode)) {
        opts.fin && console.log(`⚠️  Input contains template literal syntax which is not compatible with "opts.tpl: true" and "opts.tplEsc: false".`);
        return jsCodeBkp;
      }
      overhead = 0;
      tplOverhead = 3;
      tplBraces = 2;
    }
    let penaltyCalc = overhead + tplBraces + 1;
    // Keep this loop going while there are results
    do {
      // Run LRS to test the string
      try {
        r = LRS.text(jsCode, { ...{ maxRes: 999 + skipped, minLen: varName.length + penaltyCalc, penalty: varName.length + penaltyCalc}, ...opts });
      }
      catch (err) {
        console.error(err);
      }
      if (skipped >= r.length) break; // All done
      estimate = 0;
      while (skipped < r.length && estimate < 1) {
        searchStr = r[skipped].substring;
        if (opts.tpl) searchStr = jcrush.fixTemplateLiteral(searchStr);
        if (!jsCode.includes(searchStr)) {
          // Could it be overescaped?
          let unesc = JSON.parse(`"${searchStr}"`);
          if (!jsCode.includes(searchStr)) {
            console.warn("Could not replace:", jcrush.quoteVal(searchStr));
            skipped++;
            continue;
          }
          else searchStr = unesc;
        }
        quotedSearchStr = jcrush.quoteVal(searchStr);
        tplSearchStr = '${' + searchStr + '}';
        quotedSearchStrLen = jcrush.byteLen(quotedSearchStr);
        // Note: The estimate will underestimate the saving by one char in cases where the duplicate strings are adjacent to each other
        estimate = (quotedSearchStrLen - varName.length - overhead - tplOverhead) * r[skipped].count - (varName.length + quotedSearchStrLen + boilerplate);
        estimate < 1 && skipped++;
      }
      if (estimate < 1 || skipped >= r.length) continue; // Next loop pls
      for (let i = codeData.length - 1; i >= 0; i--) {
        c = codeData[i];
        if (c.type == 's') {
          lastIndex = 0, regex = new RegExp(searchStr.replace(/[.*+?^=!:${}()|\[\]\/\\]/g, '\\$&'), 'g'), parts = [];
          while ((match = regex.exec(c.val)) !== null) {
            // Add text before the match as a string (type: 's')
            if (match.index > lastIndex) parts.push({ val: c.val.slice(lastIndex, match.index), type: 's' });
            // Add the match as a variable (type: 'v')
            parts.push({ val: varName, type: 'v' });
            lastIndex = regex.lastIndex;
          }
          // Add any remaining text after the last match as a string (type: 's')
          if (lastIndex < c.val.length) parts.push({ val: c.val.slice(lastIndex), type: 's' });
          // Update codeData with the newly processed segments
          codeData.splice(i, 1, ...parts);
        }
      }
      // Store the replacement
      reps[varName] = opts.tpl ? searchStr : quotedSearchStr;
      repCount++;
      // Report progress
      opts.prog && console.log(repCount + ')', 'Replacing', r[skipped].count, 'instances of', quotedSearchStr, 'saves', estimate, 'chars.');
      // Get the next identifier
      do {
        varName = jcrush.nextVar(varName);
      } while (opts.resVars.includes(varName));
      // Update jsCode for further dedupe testing
      jsCode = codeData.map(({ val, type }) => type == 's' ? val : opts.tpl ? `\${${val}}` : breakString).join('');
      // Don't maintain segments in template mode
      if (opts.tpl) codeData = [{val: jsCode, type: 's'}];

    } while (r && (!opts.reps || opts.reps > repCount));
    // Glue the code back together
    jsCode = opts.tpl ? '`' + codeData.map(({ val, type }) => type == 's' ? val : `\${${val}}`).join('') + '`'
      : codeData.map(({ val, type }) => type == 's' ? jcrush.quoteVal(val) : val).join('+');
    // Create variable definitions string
    vars = Object.entries(reps).map(([varName, value]) => varName + '=' + value).join(',');
    // Return the processed JS
    opts.customPre = opts.customPre ? opts.customPre : opts.wrap == 'eval' ? 'eval(' : '(new Function(';
    opts.customPost = opts.customPost ? opts.customPost : opts.wrap == 'eval' ? ')' : '))()';
    let out = (opts.let ? 'let ' : '') + vars + ';' + opts.customPre + jsCode + opts.customPost + (opts.semi ? ';' : '');
    saving = originalSize - jcrush.byteLen(out);
    if (saving > 0) {
      opts.fin && console.log(`✅ JCrush reduced code by ${saving} bytes.`);
      return out;
    }
    opts.fin && console.log(`⚠️  After adding overhead JCrush could not optimize code. Keeping original.`);
    return jsCodeBkp;
  },

  /**
   * CLI function to process files.
   * @param {string} inputFile - Input JS file path.
   * @param {string} outputFile - Output JS file path.
   * @param {object} opts - (optional) Options.
   */
  file: async (inputFile, outputFile, opts = {}) => {
    try {
      await fs.writeFile(outputFile, jcrush.code(await fs.readFile(inputFile, 'utf8'), opts), 'utf8');
      console.log(`✅ JCrush processed: ${outputFile}`);
    }
    catch (error) {
      console.error('❌ JCrush Error:', error);
    }
  },

  /**
   * Gulp-compatible transform stream.
   * @param {object} opts - (optional) Options.
   * @returns {Transform} - A transform stream for Gulp.
   */
  gulp: (opts = {}) => {
    let { Transform } = require('stream'), PluginError = require('plugin-error');
    const PLUGIN_NAME = 'gulp-jcrush';
    return new Transform({
      objectMode: true,
      transform(file, _, cb) {
        if (file.isNull()) return cb(null, file);
        if (file.isStream()) return cb(new PluginError(PLUGIN_NAME, 'Streaming not supported'));
        try {
          file.contents = Buffer.from(jcrush.code(file.contents.toString(), opts));
          cb(null, file);
        }
        catch (err) {
          cb(new PluginError(PLUGIN_NAME, err));
        }
      }
    });
  }

};

// CLI Usage
if (require.main === module) {
  let args = process.argv.slice(2), opts = {};
  args.forEach((arg, index) => {
    if (arg.startsWith('--')) {
      let key = arg.slice(2), value = args[index + 1];
      if (value === '1' || value === '0') opts[key] = value === '1';
      else if (value && !value.startsWith('--')) opts[key] = value;
      else opts[key] = true;
    }
  });
  if (args.length < 2) {
    console.log("Usage: jcrush <input.js> <output.js> [--let 1|0] [--semi 1|0] ...");
    console.log("See README file for full list of arguments.");
    process.exit(1);
  }
  jcrush.file(args[0], args[1], opts);
}