'use strict';
/* docs/privacy-policy.html is the one source (host it for the Play listing); the app ships a copy so Settings can open it offline. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
fs.copyFileSync(path.join(ROOT, 'docs', 'privacy-policy.html'), path.join(ROOT, 'www', 'privacy-policy.html'));
console.log('copied docs/privacy-policy.html -> www/privacy-policy.html');
