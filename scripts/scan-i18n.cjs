#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const clientSrc = path.join(root, 'client', 'src');
const localesDir = path.join(root, 'client', 'src', 'i18n', 'locales');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (/\.(vue|js|ts)$/i.test(entry.name)) acc.push(p);
  }
  return acc;
}

function extractKeysFromContent(content) {
  const keys = new Set();
  const re = /\b\$?t\(\s*['"]([\w.-]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m[1]) keys.add(m[1]);
  }
  return keys;
}

function get(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined), obj);
}

function main() {
  const files = walk(clientSrc);
  const usedKeys = new Set();
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const k of extractKeysFromContent(content)) usedKeys.add(k);
  }

  const locales = ['en', 'es', 'pt', 'fr'];
  const localeData = Object.fromEntries(
    locales.map((l) => [l, JSON.parse(fs.readFileSync(path.join(localesDir, `${l}.json`), 'utf8'))])
  );

  const missing = Object.fromEntries(locales.map((l) => [l, []]));
  for (const key of usedKeys) {
    for (const l of locales) {
      const exists = get(localeData[l], key) !== undefined;
      if (!exists) missing[l].push(key);
    }
  }

  let hasMissing = false;
  for (const l of locales) {
    if (missing[l].length) {
      hasMissing = true;
      console.log(`\n[${l}] Missing ${missing[l].length} key(s):`);
      const uniq = Array.from(new Set(missing[l])).sort();
      for (const k of uniq) console.log(` - ${k}`);
    }
  }
  if (!hasMissing) {
    console.log('All referenced keys exist in all locales.');
  } else {
    console.log('\nTip: add any missing keys to the locale files.');
  }
}

main();


