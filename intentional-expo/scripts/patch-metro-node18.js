#!/usr/bin/env node
/**
 * Patches metro-config for Node 18: toReversed() was added in Node 20 (ES2023).
 * Run at postinstall so "npm start" works on Node 18.
 */
const fs = require('fs');
const path = require('path');

const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
if (nodeMajor >= 20) return process.exit(0);

const file = path.join(__dirname, '../node_modules/metro-config/src/loadConfig.js');
if (!fs.existsSync(file)) return process.exit(0);

let content = fs.readFileSync(file, 'utf8');
const before = content;
content = content.replace(/configs\.toReversed\(\)/g, 'configs.slice().reverse()');
content = content.replace(/reversedConfigs\.toReversed\(\)/g, 'reversedConfigs.slice().reverse()');
if (content === before) return process.exit(0);
fs.writeFileSync(file, content);
console.log('Patched metro-config for Node 18 (toReversed -> slice().reverse())');
process.exit(0);
