/**
 * Re-applies the upstream fix from expo/expo#50244 to @expo/metro-config.
 *
 * On Expo SDK 57, `expo start --web` (web.output = "static" | "server") fails with:
 *   AssertionError: Worker chunk not found for: .../expo-sqlite/web/worker.ts
 * because lazy development bundles resolve web-worker modules without adding them
 * to the graph. The fix (landed in @expo/metro-config 58.0.4+) skips worker chunks
 * when `includeAsyncPaths` is set, letting the dev server serve the worker by URL.
 *
 * This script is idempotent and safe: it no-ops when the guard is already present,
 * when the target package is missing, or when the pattern no longer matches.
 * It runs automatically via the "postinstall" npm script.
 */
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  '@expo',
  'metro-config',
  'build',
  'serializer',
  'serializeChunks.js'
);

if (!fs.existsSync(target)) {
  console.log('[patch-expo-metro-worker] @expo/metro-config not found, skipping.');
  process.exit(0);
}

let source = fs.readFileSync(target, 'utf8');

const alreadyPatched =
  source.includes('expo/expo#50244') ||
  /if\s*\(\s*isWorker\s*&&\s*options\.includeAsyncPaths\s*\)/.test(source);

if (alreadyPatched) {
  console.log('[patch-expo-metro-worker] Worker chunk guard already present, nothing to do.');
  process.exit(0);
}

const pattern = /(\(isWorker \|\| splitChunks\)\) \{\r?\n)([ \t]*)(const asyncChunks = gatherChunks\()/;

if (!pattern.test(source)) {
  console.warn(
    '[patch-expo-metro-worker] Target pattern not found (package may have changed). No changes made.'
  );
  process.exit(0);
}

source = source.replace(pattern, (match, opening, indent, rest) => {
  return (
    opening +
    indent +
    '// [expo/expo#50244] Skip worker chunks in lazy dev bundles (web.output static/server).\n' +
    indent +
    'if (isWorker && options.includeAsyncPaths) {\n' +
    indent +
    '    continue;\n' +
    indent +
    '}\n' +
    indent +
    rest
  );
});

fs.writeFileSync(target, source);
console.log('[patch-expo-metro-worker] Applied worker chunk guard to @expo/metro-config.');
