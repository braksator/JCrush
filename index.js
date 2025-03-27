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
  isBadVarName: (varName) => {
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
  nextVar: (str) => {
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
   * Fixes malformed template literals.
   * @param {string} str - The string to test for template literals
   * @returns {string} - A truncated version of the string with no partial template literals.
   */
  fixTemplateLiteral: (str) => {
    let firstClose = str.indexOf('}'), firstOpen = str.indexOf('${');
    if (firstClose < firstOpen || (firstClose != -1 && firstOpen == -1)) str = str.slice(firstClose + 1);
    let lastOpen = str.lastIndexOf('${');
    return lastOpen != -1 && str.indexOf('}', lastOpen) == -1 ? str.slice(0, lastOpen) : str;
  },

  /**
   * Gets length of string in bytes.
   * @param {string} str - The string to check.
   * @returns {int} - The number of bytes.
   */
  byteLen: (str) => new TextEncoder().encode(str).length,

  /**
   * Works out the string replacement to compress the SVG data.
   * @param {string} str - The string to test for replacements.
   * @returns {object} - A key/value object of find/replace pairs.
   */
  calcReplacements: (str, opts) => {
    // Note: "overhead" is the per-occurence overhead (`++`), and "boilerplate" is the definition overhead (='',).
    let r = {}, len, varName = 'a', found, skipped, savings, res, originalStr, overhead = 4, boilerplate = 4;
    // We need an upper limit.
    for (let i = 0; i < 500; i++) {
      found = 0;
      skipped = 0;
      len = str.length;
      // Run LRS to test the string
      res = LRS.text(str, { ...{ maxRes: 50, minLen: varName.length + overhead, maxLen: 40, minOcc: 2, omit: [], trim: 0, clean: 0, words: 0, break: [], penalty: varName.length + overhead }, ...opts });
      // If we're out of results, bounce out of here
      if (!res) break;
      do {
        if (!res[skipped]) break;
        // Fix malformed substrings
        res[skipped].substring = jcrush.fixTemplateLiteral(res[skipped].substring);
        // Store original string incase replacement is deemed poor
        originalStr = str;
        // Perform the replacement
        str = str.replaceAll(res[skipped].substring, '${' + varName + '}');
        // Estimate the savings
        savings = len - str.length - boilerplate - varName.length - overhead;
        // Output progress
        if (savings > 0) {
          console.log('Replacing', '`' + res[skipped].substring + '`', 'saves', savings, 'chars.');
          // Perform the replacement on our test string
          r[varName] = res[skipped].substring;
          // Get the next identifier
          varName = jcrush.nextVar(varName);
          found = 1
        }
        else {
          // Undo and skip poorly performing replacements
          skipped++;
          str = originalStr;
        }
      } while (savings < 0);
      if (!found) break;
    }
    return r;
  },

  /**
   * Processes Javascript content by deduplicating strings and wrapping it.
   * @param {string} jsCode - The Javascript code as a string.
   * @returns {string} - The transformed Javascript.
   */
  jcrushCode: (jsCode, opts = {}) => {
    // Add default options.
    opts = { ...{ eval: 1, let: 0 }, ...opts };
    // Escape jsCode string.
    jsCode = jsCode.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    // Calculate replacements.
    let r = jcrush.calcReplacements(jsCode, opts);
    if (Object.keys(r).length) {
      // Reformat jsCode for the algorithm
      let codeData = [{val: jsCode, type: 's'}];
      // Loop through each replacement entry
      for (const [varName, searchStr] of Object.entries(r)) {
        // Loop through each segment of the jsCode array backwards
        for (let i = codeData.length - 1; i >= 0; i--) {
          let code = codeData[i];
          if (code.type == 's') {
            let lastIndex = 0, regex = new RegExp(searchStr, 'g'), match, parts = [];
            while ((match = regex.exec(code.val)) !== null) {
              // Add text before the match as a string (type: 's')
              if (match.index > lastIndex) parts.push({ val: code.val.slice(lastIndex, match.index), type: 's' });
              // Add the match as a variable (type: 'v')
              parts.push({ val: varName, type: 'v' });
              lastIndex = regex.lastIndex;
            }
            // Add any remaining text after the last match as a string (type: 's')
            if (lastIndex < code.val.length) parts.push({ val: code.val.slice(lastIndex), type: 's' });
            // Update codeData with the newly processed segments
            codeData.splice(i, 1, ...parts);
          }
        }
      }
      // Glue the jsCode back together
      let newCode = codeData.map(({ val, type }) => type == 's' ? `\`${val}\`` : val).join('+'),
        // Create variable definitions string
        vars = Object.entries(r).map(([varName, value]) => `${varName}=\`${value}\``).join(','),
        // Return the processed JS
        out = (opts.let ? ' let ' : '') + opts.eval ? `${vars};eval(${newCode});` : `${vars};(new Function(${newCode}))();`;
      if (out.length < jsCode.length) {
        console.log(`✅ JCrush reduced code by ${jcrush.byteLen(jsCode) - jcrush.byteLen(out)} bytes.`);
        return out;
      }
    }
    console.log(`⚠️  JCrush could not optimize code. Keeping original.`);
    return jsCode;
  },

  /**
   * Gulp-compatible transform stream.
   * @param {object} opts - (optional) Options.
   * @returns {Transform} - A transform stream for Gulp.
   */
  gulp: (opts = {}) => {
    var { Transform } = require('stream');
    var PluginError = require('plugin-error');
    const PLUGIN_NAME = 'gulp-jcrush';
    return new Transform({
      objectMode: true,
      transform(file, _, cb) {
        if (file.isNull()) return cb(null, file);
        if (file.isStream()) return cb(new PluginError(PLUGIN_NAME, 'Streaming not supported'));
        try {
          file.contents = Buffer.from(jcrush.jcrushCode(file.contents.toString(), opts));
          cb(null, file);
        }
        catch (err) {
          cb(new PluginError(PLUGIN_NAME, err));
        }
      }
    });
  },

  /**
   * CLI function to process files.
   * @param {string} inputFile - Input JS file path.
   * @param {string} outputFile - Output JS file path.
   * @param {object} opts - (optional) Options.
   */
  jcrushFile: async (inputFile, outputFile, opts = {}) => {
    try {
      await fs.writeFile(outputFile, jcrush.jcrushCode(await fs.readFile(inputFile, 'utf8'), opts), 'utf8');
      console.log(`✅ JCrush processed: ${outputFile}`);
    }
    catch (error) {
      console.error('❌ JCrush Error:', error);
    }
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
  });
  // Ensure the arguments are correct
  if (args.length < 2) {
    console.log("Usage: jcrush <input.js> <output.js> [--eval 1|0] [--let 1|0]");
    process.exit(1);
  }
  // Pass options along with input and output file paths
  jcrush.jcrushFile(args[0], args[1], opts);
}