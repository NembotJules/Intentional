#!/usr/bin/env node
/**
 * Patches react-native-css-interop for Metro >= 0.83.
 *
 * When Tailwind recompiles, css-interop emits a haste "change" event in Metro's old
 * shape ({ eventsQueue }). Newer Metro reads { changes: { addedFiles, modifiedFiles,
 * removedFiles }, rootDir } and crashes the dev server with
 * "Cannot read properties of undefined (reading 'addedFiles')".
 * This adds the new fields alongside the old ones so both Metro versions work.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../node_modules/react-native-css-interop/dist/metro/index.js');
if (!fs.existsSync(file)) process.exit(0);

const content = fs.readFileSync(file, 'utf8');
const marker = '/* intentional: metro-change-shape */';
if (content.includes(marker)) process.exit(0);

const needle = 'haste.emit("change", {';
if (!content.includes(needle)) {
  console.warn('patch-css-interop-metro: emit call not found, skipping');
  process.exit(0);
}

const patched = content.replace(
  needle,
  `${needle} ${marker}
                changes: {
                    addedFiles: [],
                    modifiedFiles: [[path_1.default.relative(process.cwd(), filePath), { isSymlink: false, modifiedTime: Date.now() }]],
                    removedFiles: [],
                },
                rootDir: process.cwd(),
                logger: null,`
);
fs.writeFileSync(file, patched);
console.log('Patched react-native-css-interop for Metro >= 0.83 change events');
