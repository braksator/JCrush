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
    let dq = `"${val.replace(/"/g, '\\"')}"`,
        sq = `'${val.replace(/'/g, "\\'")}'`,
        bt = `\`${val.replace(/`/g, '\\`').replace(/\$\{/g, '\\${').replace(/\}/g, '\\}')}\``;
    // Return the shortest
    return (dq.length <= sq.length && dq.length <= bt.length) ? dq : sq.length <= bt.length ? sq : bt;
  },

  /**
   * Processes Javascript content by deduplicating strings and wrapping it.
   * @param {string} jsCode - The Javascript code as a string.
   * @returns {string} - The transformed Javascript.
   */
  code: (jsCode, opts = {}) => {
    // Add default options
    opts = { ...{ eval: 1, let: 0, semi: 0, break: [], split: [':', ';', ' ', '"', '.', ',', '{', '}', '(', ')', '[', ']', '='],
      maxLen: 40, minOcc: 2, omit: [], trim: 0, clean: 0, escSafe: 1, words: 0 }, ...opts };
    // Escape jsCode string
    jsCode = jsCode.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    // Note: "overhead" is the max per-occurence overhead (++), and "boilerplate" is the definition overhead (=,)
    let originalSize = jcrush.byteLen(jsCode), codeData = [{val: jsCode, type: 's'}], c, lastIndex, regex, match, parts, searchStr, estimate,
      quotedSearchStr, breakString = jcrush.getBreak(jsCode), r, varName = 'a', skipped = 0, overhead = 2, boilerplate = 2, reps = {}, vars,
      saving, quotedSearchStrLen;
    // Pass the break string into the options
    opts.break.push(breakString);
    // Keep this loop going while there are results
    do {
      // Run LRS to test the string
      try {
        r = LRS.text(jsCode, { ...{ maxRes: 999 + skipped, minLen: varName.length + overhead + 1, penalty: varName.length + overhead + 1 }, ...opts });
      }
      catch (err) {
        console.error(err);
      }
      if (skipped >= r.length) break; // All done
      estimate = 0;
      while (skipped < r.length && estimate < 1) {
        searchStr = r[skipped].substring;
        quotedSearchStr = jcrush.quoteVal(searchStr);
        quotedSearchStrLen = jcrush.byteLen(quotedSearchStr);
        // Note: The estimate will underestimate the saving by one char in cases where the duplicate strings are adjacent to each other
        estimate = (quotedSearchStrLen - varName.length - overhead) * r[skipped].count - (varName.length + quotedSearchStrLen + boilerplate);
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
      // Report progress
      console.log('Replacing', r[skipped].count, 'instances of', quotedSearchStr, 'saves', estimate, 'chars.');
      // Store the replacement
      reps[varName] = quotedSearchStr;
      // Get the next identifier
      varName = jcrush.nextVar(varName);
      // Update jsCode for further dedupe testing
      jsCode = codeData.map(({ val, type }) => type == 's' ? val : breakString).join(breakString);
    } while (r);
    // Glue the code back together
    jsCode = codeData.map(({ val, type }) => type == 's' ? jcrush.quoteVal(val) : val).join('+');
    // Create variable definitions string
    vars = Object.entries(reps).map(([varName, value]) => varName + '=' + value).join(',');
    // Return the processed JS
    out = (opts.let ? 'let ' : '') + (opts.eval ? `${vars};eval(${jsCode})` : `${vars};(new Function(${jsCode}))()`) + (opts.semi ? ';' : '');
    saving = originalSize - jcrush.byteLen(out);
    if (saving > 0) {
      console.log(`✅ JCrush reduced code by ${saving} bytes.`);
      return out;
    }
    console.log(`⚠️  After adding overhead JCrush could not optimize code. Keeping original.`);
    return jsCode;
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
  var args = process.argv.slice(2), opts = {};
  args.forEach((arg, index) => {
    if (arg === '--eval' && args[index + 1] !== undefined)
      opts.eval = parseInt(args[index + 1]) ? 1 : 0;
    else if (arg === '--let' && args[index + 1] !== undefined)
      opts.let = parseInt(args[index + 1]) ? 1 : 0;
    else if (arg === '--semi' && args[index + 1] !== undefined)
      opts.semi = parseInt(args[index + 1]) ? 1 : 0;
  });
  // Ensure the arguments are correct
  if (args.length < 2) {
    console.log("Usage: jcrush <input.js> <output.js> [--eval 1|0] [--let 1|0] [--semi 1|0]");
    process.exit(1);
  }
  // Pass options along with input and output file paths
  jcrush.file(args[0], args[1], opts);
}