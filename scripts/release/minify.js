'use strict';
/* Minifies a COPY of the web app for a release build. Ported from the piano/guitar apps' scripts/release/minify.js.

   BE HONEST ABOUT WHAT THIS IS. A speed bump, not protection: the whole app still ships inside the APK and anyone
   willing to read it can. What it does: comments go (including the ones explaining how Pro and coupons work),
   local names become single letters, whitespace goes, and "unzip the APK, double-click index.html" no longer runs
   the app. Pro is verified with Google Play; trial coupons are shipped as salted hashes only.

   Only ever run on a COPY: www/ stays the files that are edited and tested.

   Classic scripts share globals across files (core.js declares things habits.js uses), so top-level names are NOT
   mangled -- only names inside functions. Android's R8 stays off (see android/app/build.gradle): the Java side is a
   few small files and Capacitor loads its plugins reflectively, which is exactly what shrinking breaks. */
const fs = require('fs');
const path = require('path');
const terser = require('terser');
const CleanCSS = require('clean-css');
const { minify: minifyHtml } = require('html-minifier-terser');

const TERSER = { compress: true, mangle: { toplevel: false }, format: { comments: false } };
const HTML = { removeComments: true, collapseWhitespace: true, conservativeCollapse: true, minifyCSS: false, minifyJS: false };

/* The check, first thing in <head>, ahead of every script. Capacitor injects its bridge before the page's own
   scripts run; opened from disk or any web server there is no window.Capacitor at all. window.stop() matters:
   without it the rest of the page would go on parsing and half-boot under the note. */
function onlyInTheApp() {
  var C = window.Capacitor;
  if (C && typeof C.isNativePlatform === 'function' && C.isNativePlatform()) return;
  window.stop();
  document.documentElement.innerHTML = '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PocketKit</title></head>'
    + '<body style="margin:0;font:16px/1.5 system-ui,sans-serif;background:#111;color:#f2f2f2;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box">'
    + '<div><h1 style="font-size:22px;margin:0 0 8px">PocketKit</h1><p style="margin:0;opacity:.85">This page is the Android app, and only runs inside it.</p></div></body>';
}
const GUARD = '<script>(' + onlyInTheApp.toString() + ')();</script>';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

/* Copies srcDir to outDir with every .js / .css / .html minified. Returns a report. */
async function buildStage(srcDir, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = { files: 0, plain: 0, minified: 0, skipped: [], problems: [] };
  for (const file of walk(srcDir)) {
    const rel = path.relative(srcDir, file), dest = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const ext = path.extname(file).toLowerCase();
    const text = ['.js', '.css', '.html'].includes(ext) ? fs.readFileSync(file, 'utf8') : null;
    if (text === null || /\.min\.js$/.test(file)) { fs.copyFileSync(file, dest); if (text !== null) report.skipped.push(rel); continue; }
    let out;
    if (ext === '.js') {
      const r = await terser.minify(text, TERSER);
      if (r.error || typeof r.code !== 'string') throw new Error('terser failed on ' + rel);
      out = r.code;
      // a real block comment, not text inside a string such as "image/*"
      const STRINGS = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g;
      if (/\/\*/.test(out.replace(STRINGS, '""'))) report.problems.push(rel + ': still contains a /* comment');
    } else if (ext === '.css') {
      const r = new CleanCSS({ level: 1, returnPromise: false }).minify(text);
      if (r.errors && r.errors.length) throw new Error('clean-css failed on ' + rel + ': ' + r.errors.join('; '));
      out = r.styles;
      if (/\/\*/.test(out)) report.problems.push(rel + ': still contains a /* comment');
    } else { // index.html
      out = await minifyHtml(text, HTML);
      const m = out.match(/<head[^>]*>/i);
      if (!m) throw new Error('no <head> to put the in-app check in');
      out = out.replace(m[0], m[0] + GUARD); // straight after <head>, so it runs before anything else
      if (/<!--/.test(out)) report.problems.push(rel + ': an HTML comment survived');
      const head = out.indexOf('<head'), firstScript = out.search(/<script\b/i);
      if (firstScript < 0 || !out.slice(firstScript, firstScript + 400).includes('isNativePlatform') || firstScript < head) report.problems.push(rel + ': the in-app check is not the first script in <head>');
    }
    fs.writeFileSync(dest, out);
    report.files++; report.plain += text.length; report.minified += out.length;
  }
  return report;
}

module.exports = { buildStage, onlyInTheApp, GUARD, TERSER };
