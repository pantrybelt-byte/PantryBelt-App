#!/usr/bin/env node
/**
 * tools/bumpVersion.js — Atomic version bump for AccessBelt
 *
 * Usage:
 *   node tools/bumpVersion.js patch    # 1.0.3 → 1.0.4, versionCode/buildNumber ++
 *   node tools/bumpVersion.js minor    # 1.0.3 → 1.1.0
 *   node tools/bumpVersion.js major    # 1.0.3 → 2.0.0
 *
 * Edits app.config.js in place. Reads the current version from the file
 * itself (not package.json) so there is one source of truth for native builds.
 */

const fs   = require('fs');
const path = require('path');

const BUMP_TYPE = process.argv[2] || 'patch';
if (!['major', 'minor', 'patch'].includes(BUMP_TYPE)) {
    console.error(`Usage: node tools/bumpVersion.js [major|minor|patch]`);
    process.exit(1);
}

const CONFIG_PATH = path.join(__dirname, '..', 'app.config.js');
let src = fs.readFileSync(CONFIG_PATH, 'utf8');

// ── Version string ────────────────────────────────────────────────────────────
const versionMatch = src.match(/version:\s*['"](\d+)\.(\d+)\.(\d+)['"]/);
if (!versionMatch) {
    console.error('Could not find version: "X.Y.Z" in app.config.js');
    process.exit(1);
}

let [, major, minor, patch] = versionMatch.map(Number);
if      (BUMP_TYPE === 'major') { major++; minor = 0; patch = 0; }
else if (BUMP_TYPE === 'minor') { minor++;             patch = 0; }
else                            {                     patch++;   }
const newVersion = `${major}.${minor}.${patch}`;
src = src.replace(/version:\s*(['"])(\d+\.\d+\.\d+)\1/, `version: '${newVersion}'`);
src = src.replace(/runtimeVersion:\s*(['"])(\d+\.\d+\.\d+)\1/, `runtimeVersion: '${newVersion}'`);

// ── Android versionCode ────────────────────────────────────────────────────────
const vcMatch = src.match(/versionCode:\s*(\d+)/);
if (!vcMatch) { console.warn('⚠  versionCode not found — skipping.'); }
else {
    const newVc = Number(vcMatch[1]) + 1;
    src = src.replace(/versionCode:\s*\d+/, `versionCode: ${newVc}`);
    console.log(`  versionCode: ${vcMatch[1]} → ${newVc}`);
}

// ── iOS buildNumber ───────────────────────────────────────────────────────────
const bnMatch = src.match(/buildNumber:\s*['"](\d+)['"]/);
if (!bnMatch) { console.warn('⚠  buildNumber not found — skipping.'); }
else {
    const newBn = Number(bnMatch[1]) + 1;
    src = src.replace(/buildNumber:\s*['"]\d+['"]/, `buildNumber: '${newBn}'`);
    console.log(`  buildNumber: ${bnMatch[1]} → ${newBn}`);
}

fs.writeFileSync(CONFIG_PATH, src, 'utf8');

console.log(`\n✅ Version bumped: ${versionMatch[0].match(/\d+\.\d+\.\d+/)?.[0]} → ${newVersion} (${BUMP_TYPE})`);
console.log(`   Next step: git commit -m "chore: bump version to ${newVersion}"\n`);
