#!/usr/bin/env node
/**
 * verify-ceiling-geometry.mjs — automated geometry check for the ceiling layout engine.
 *
 * Run from the repo root:
 *   node frontend/scripts/verify-ceiling-geometry.mjs
 *
 * Steps:
 *  1. Confirms frontend/src/services/ceilingLayouts.ts is import-free (DOM-free standalone).
 *  2. Compiles it with the project's `npx tsc` to a temp dir
 *     (--target es2020 --module nodenext --moduleResolution nodenext --skipLibCheck).
 *  3. Dynamically imports the compiled module.
 *  4. Sweeps EVERY layout function over
 *       rects   { wide 400x120, tall 120x400, square 300x300, tiny 40x30 }
 *       panelWidth     { 1, 2, 4, 6, 12 }
 *       panelSpacing   { 0, 0.5, 2, 8 }
 *       borderThickness{ 0, 1, 3, 5, 8 }
 *     calling assertRectangular on each result.
 *  5. Asserts degenerate inputs (borderThickness <= 0, panelWidth < 1) return []
 *     instead of throwing, and that assertRectangular itself throws on violations.
 *  6. Asserts the module exports exactly the 8 layout functions + assertRectangular.
 *
 * Exit 0 on success; non-zero with a message naming the failing function/params otherwise.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // frontend/scripts
const frontendDir = resolve(here, '..'); // frontend
const srcFile = join(frontendDir, 'src', 'services', 'ceilingLayouts.ts');

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const LAYOUT_FNS = [
  'layoutLinearPanels',
  'layoutGeometricGrid',
  'layoutBorder',
  'layoutLayered',
  'layoutRecessed',
  'layoutTray',
  'layoutCove',
  'layoutWoodGypsum',
];
const EXPECTED_EXPORTS = [...LAYOUT_FNS, 'assertRectangular'];

// --- 1. import-free source check (DOM-free, standalone) ---
const src = readFileSync(srcFile, 'utf8');
if (/^\s*import[\s('"]/m.test(src)) {
  fail('ceilingLayouts.ts must have zero imports (DOM-free standalone module)');
}
if (/\brequire\s*\(/.test(src)) {
  fail('ceilingLayouts.ts must not use require() (DOM-free standalone module)');
}

// --- 2. compile with the project's tsc ---
const outDir = mkdtempSync(join(tmpdir(), 'ceiling-layouts-'));
try {
  execFileSync(
    'npx',
    [
      'tsc',
      srcFile,
      '--outDir', outDir,
      '--target', 'es2020',
      '--module', 'nodenext',
      '--moduleResolution', 'nodenext',
      '--skipLibCheck',
      '--declaration', 'false',
      '--sourceMap', 'false',
    ],
    { cwd: frontendDir, stdio: 'pipe', encoding: 'utf8' },
  );
} catch (e) {
  const out = `${e.stdout ?? ''}${e.stderr ?? ''}${e.message ?? ''}`;
  fail(`tsc compile failed:\n${out}`);
}

// --- 3. dynamic import ---
let mod;
try {
  mod = await import(pathToFileURL(join(outDir, 'ceilingLayouts.js')).href);
} catch (e) {
  fail(`dynamic import of compiled module failed: ${e.message}`);
}

// --- 6. export surface check (exactly the 8 layouts + assertRectangular) ---
const exported = Object.keys(mod).filter((k) => k !== 'default');
const missing = EXPECTED_EXPORTS.filter((k) => typeof mod[k] !== 'function');
if (missing.length > 0) {
  fail(`missing exports: ${missing.join(', ')}`);
}
const extra = exported.filter((k) => !EXPECTED_EXPORTS.includes(k));
if (extra.length > 0) {
  fail(
    `unexpected extra exports (only the 8 layout functions + assertRectangular may exist): ${extra.join(', ')}`,
  );
}

// --- 4. full parameter sweep ---
const RECTS = {
  wide: { x: 0, y: 0, w: 400, h: 120 },
  tall: { x: 0, y: 0, w: 120, h: 400 },
  square: { x: 0, y: 0, w: 300, h: 300 },
  tiny: { x: 0, y: 0, w: 40, h: 30 },
};
const PANEL_WIDTHS = [1, 2, 4, 6, 12];
const PANEL_SPACINGS = [0, 0.5, 2, 8];
const BORDER_THICKNESSES = [0, 1, 3, 5, 8];

let combos = 0;
for (const name of LAYOUT_FNS) {
  const fn = mod[name];
  for (const [rname, r] of Object.entries(RECTS)) {
    for (const pw of PANEL_WIDTHS) {
      for (const ps of PANEL_SPACINGS) {
        for (const bt of BORDER_THICKNESSES) {
          const label = `rect=${rname} panelWidth=${pw} panelSpacing=${ps} borderThickness=${bt}`;
          let out;
          try {
            out = fn(r, { panelWidth: pw, panelSpacing: ps, borderThickness: bt });
          } catch (e) {
            fail(`${name} threw on ${label}: ${e.message}`);
          }
          if (!Array.isArray(out)) {
            fail(`${name} did not return an array on ${label}`);
          }
          try {
            mod.assertRectangular(out, r);
          } catch (e) {
            fail(`${name} produced invalid geometry on ${label}: ${e.message}`);
          }
          combos++;
        }
      }
    }
  }
}

// --- 5a. degenerate inputs must return [] (never throw, never zero-area) ---
const DEGENERATE = [
  { params: { panelWidth: 0, panelSpacing: 2, borderThickness: 3 }, label: 'panelWidth=0' },
  { params: { panelWidth: 0.5, panelSpacing: 2, borderThickness: 3 }, label: 'panelWidth=0.5' },
  { params: { panelWidth: 4, panelSpacing: 2, borderThickness: 0 }, label: 'borderThickness=0' },
  { params: { panelWidth: 4, panelSpacing: 2, borderThickness: -2 }, label: 'borderThickness=-2' },
];
for (const name of LAYOUT_FNS) {
  for (const d of DEGENERATE) {
    let out;
    try {
      out = mod[name](RECTS.square, d.params);
    } catch (e) {
      fail(`${name} threw on degenerate input (${d.label}) — must return [] instead`);
    }
    if (!Array.isArray(out) || out.length !== 0) {
      fail(
        `${name} returned ${Array.isArray(out) ? out.length : 'non-array'} rects on degenerate input (${d.label}) — must return []`,
      );
    }
  }
}

// --- 5b. assertRectangular must throw on violations ---
const BAD_CASES = [
  { rects: [{ x: 0, y: 0, w: 0, h: 10 }], label: 'zero width' },
  { rects: [{ x: 0, y: 0, w: 10, h: -1 }], label: 'negative height' },
  { rects: [{ x: 0, y: 0, w: NaN, h: 10 }], label: 'NaN width' },
  { rects: [{ x: 0, y: 0, w: 10, h: Infinity }], label: 'infinite height' },
  { rects: [{ x: -5, y: 0, w: 10, h: 10 }], label: 'extends 5px outside bounds' },
  { rects: [{ x: 295, y: 295, w: 10, h: 10 }], label: 'extends past bottom-right corner' },
];
for (const b of BAD_CASES) {
  let threw = false;
  try {
    mod.assertRectangular(b.rects, RECTS.square);
  } catch {
    threw = true;
  }
  if (!threw) {
    fail(`assertRectangular did not throw on invalid rect (${b.label})`);
  }
}

// assertRectangular must accept [] and in-bounds rects without throwing
try {
  mod.assertRectangular([], RECTS.square);
  mod.assertRectangular([{ x: 10, y: 10, w: 50, h: 50 }], RECTS.square);
} catch (e) {
  fail(`assertRectangular threw on valid input: ${e.message}`);
}

rmSync(outDir, { recursive: true, force: true });

console.log(
  `OK: ceiling geometry verified — ${combos} layout combos x ${LAYOUT_FNS.length} functions, ` +
    `${DEGENERATE.length * LAYOUT_FNS.length} degenerate probes, export surface, and assertRectangular behavior all clean.`,
);
