'use strict';
/* The release command. Follows the piano/guitar apps' scripts/release/build.js.

     npm run release                  minified, signed .aab for Google Play
     npm run release:phone-test       a DEBUG apk carrying the exact release web bytes and the release R8 shrinking, to install over the debug one
                                      (adb install -r keeps the data on the phone)

   What it does, in order:
     1. copies www/ into the Android project (cap sync);
     2. minifies THAT COPY into release-build/www/ (www/ stays the file that is edited and tested), and checks the
        result: no comments left, every script still parses, the in-app check is first in <head>;
     3. refuses to build an upload that is not safe to ship: the plaintext trial codes must not be anywhere in the
        shipped files, the build must not be debuggable, and android/keystore.properties must exist (an unsigned
        bundle is rejected by Play);
     4. puts the minified files into the Android assets, builds, and ALWAYS puts the plain files back in a finally,
        so a later debug build can never pick up the minified ones.

   A speed bump, not protection: see minify.js. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const { buildStage } = require('./minify.js');

const ROOT = path.resolve(__dirname, '..', '..');
const WWW = path.join(ROOT, 'www');
const OUT = path.join(ROOT, 'release-build', 'www');
const ASSETS = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public');
const ANDROID = path.join(ROOT, 'android');
// By path and QUOTED: a bare name is not found by cmd, and an unquoted absolute path splits at the first space.
const GRADLEW = process.platform === 'win32' ? '"' + path.join(ANDROID, 'gradlew.bat') + '"' : path.join(ANDROID, 'gradlew');

const PHONE_TEST = process.argv.includes('--phone-test');
const say = m => console.log('release: ' + m);
function run(label, cmd, args, opts = {}) {
  say(label + ' ...');
  const r = spawnSync(cmd, args, Object.assign({ stdio: 'inherit', cwd: ROOT, env: process.env }, opts));
  if (r.status !== 0) throw new Error(label + ' failed (exit ' + r.status + ')');
}
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
function copyTree(src, dst) {
  for (const f of walk(src)) {
    const d = path.join(dst, path.relative(src, f));
    fs.mkdirSync(path.dirname(d), { recursive: true });
    fs.copyFileSync(f, d);
  }
}

(async () => {
  const t0 = Date.now();
  try {
    /* 0 */
    require('../copy-privacy.js'); // the in-app privacy policy must match docs/privacy-policy.html
    const gradleText = fs.readFileSync(path.join(ANDROID, 'app', 'build.gradle'), 'utf8');
    const vName = (gradleText.match(/versionNames+"([^"]+)"/) || [])[1], vCode = (gradleText.match(/versionCodes+(d+)/) || [])[1];
    const pkgVer = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
    const appVer = (fs.readFileSync(path.join(WWW, 'js', 'app.js'), 'utf8').match(/APP_VERSION = '([^']+)'/) || [])[1];
    if (vName !== pkgVer || vName !== appVer) throw new Error('version mismatch: build.gradle versionName ' + vName + ', package.json ' + pkgVer + ', app.js APP_VERSION ' + appVer + '. Make all three the same.');
    say('version ' + vName + ' (versionCode ' + vCode + ')' + (PHONE_TEST ? '' : ': check that versionCode is higher than the one already on Google Play'));

    /* 1 */
    run('copying the web app into the Android project', 'npx', ['cap', 'sync', 'android'], { shell: true });

    /* 2 */
    const report = await buildStage(WWW, OUT);
    say('minified ' + report.files + ' files: ' + report.plain + ' -> ' + report.minified + ' chars (' + Math.round(100 * report.minified / report.plain) + '%); skipped as already minified: ' + (report.skipped.join(', ') || 'none'));
    const problems = report.problems.slice();
    for (const f of walk(OUT).filter(f => f.endsWith('.js'))) {
      try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: path.relative(OUT, f) }); }
      catch (e) { problems.push(path.relative(OUT, f) + ' no longer parses: ' + e.message); }
    }
    if (problems.length) throw new Error('the minified app failed its checks:\n  ' + problems.join('\n  '));

    /* 3 */
    const gradle = fs.readFileSync(path.join(ANDROID, 'app', 'build.gradle'), 'utf8');
    if (/debuggable\s+true/.test(gradle)) throw new Error('the release build is debuggable; the debug-only Pro override and dev coupon would work in the shipped app');
    const codesFile = path.join(ROOT, 'coupon-codes.txt');
    if (fs.existsSync(codesFile)) { // the shipped files must contain only hashes, never the codes themselves
      const codes = fs.readFileSync(codesFile, 'utf8').match(/PKT-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}|PKT-DEV-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/g) || [];
      const shipped = walk(OUT).map(f => fs.readFileSync(f, 'utf8')).join('\n');
      const leaked = codes.filter(c => shipped.includes(c));
      if (leaked.length) throw new Error('plaintext coupon codes found in the shipped files (' + leaked.length + '); only hashes may ship');
      say('checked: none of the ' + codes.length + ' plaintext coupon codes is in the shipped files');
    }
    if (!PHONE_TEST && !fs.existsSync(path.join(ANDROID, 'keystore.properties')))
      throw new Error('no android/keystore.properties: the bundle would be UNSIGNED and Play would refuse it. Copy android/keystore.properties.example and point it at your keystore (see RELEASE.md).');

    /* 4 */
    try {
      copyTree(OUT, ASSETS);
      if (PHONE_TEST) {
        run('building a debug apk with the release web bytes and R8 shrinking', GRADLEW, ['assembleDebug', '-Pr8test'], { cwd: ANDROID, shell: true });
        say('apk: android/app/build/outputs/apk/debug/app-debug.apk -- install with adb install -r (keeps the data on the phone)');
      } else {
        run('building the release bundle', GRADLEW, ['bundleRelease'], { cwd: ANDROID, shell: true });
        say('bundle: android/app/build/outputs/bundle/release/app-release.aab');
      }
    } finally {
      copyTree(WWW, ASSETS); // the plain files back, always
      say('put the plain web files back in the Android assets');
    }
    say('done in ' + Math.round((Date.now() - t0) / 1000) + 's');
  } catch (e) {
    console.error('release: STOPPED -- ' + e.message);
    process.exitCode = 1;
  }
})();
