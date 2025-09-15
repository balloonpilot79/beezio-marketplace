#!/usr/bin/env node
// Lightweight repo secret scanner: searches for common key patterns in the workspace.
const fs = await import('fs');
const path = await import('path');

const ROOT = process.cwd();
const patterns = [
  /sk_live_[0-9a-zA-Z]{24,}/g,
  /sk_test_[0-9a-zA-Z]{24,}/g,
  /pk_live_[0-9a-zA-Z]{24,}/g,
  /pk_test_[0-9a-zA-Z]{24,}/g,
  /whsec_[0-9a-zA-Z]{24,}/g,
  /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/g, // JWT-ish
  // Note: variable-name matches removed to reduce false positives in docs
];

// Files to intentionally ignore (local dev files)
const IGNORE_FILES = ['.env.local', '.env.*.local'];
let found = false;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['.git', 'node_modules', 'dist'].includes(e.name)) continue;
      walk(full);
    } else {
      // skip local-only env files (they may contain keys intentionally)
      const base = path.basename(full);
      if (base === '.env.local' || base.match(/^\.env\..*\.local$/)) continue;
      scanFile(full);
    }
  }
}

function scanFile(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
          console.log(`POTENTIAL_SECRET: ${file} -> ${p}`);
          m.slice(0,3).forEach(v => console.log('  ', v));
          found = true;
        }
    }
  } catch (err) {
    // ignore binary files
  }
}

console.log('Running lightweight secret scan...');
walk(ROOT);
console.log('Scan complete. If any POTENTIAL_SECRET lines appeared, remove/rotate and add to .gitignore.');
if (found) {
  console.error('\nSecret scan detected potential secrets outside allowed local files. Failing.');
  process.exit(1);
} else {
  process.exit(0);
}
