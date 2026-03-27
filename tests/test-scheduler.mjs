import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf-8');

// Extract the script content from index.html
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!scriptMatch) throw new Error('Could not find scheduler script in index.html');

// Execute the script to populate globalThis.Scheduler
new Function(scriptMatch[1])();
const Scheduler = globalThis.Scheduler;

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// --- decideTableFormats tests ---

test('2 players, 1 table → 1× singles', () => {
  const formats = Scheduler.decideTableFormats(2, 1);
  assert.deepStrictEqual(formats, [2]);
});

test('3 players, 1 table → 1× 2v1', () => {
  const formats = Scheduler.decideTableFormats(3, 1);
  assert.deepStrictEqual(formats, [3]);
});

test('4 players, 1 table → 1× doubles', () => {
  const formats = Scheduler.decideTableFormats(4, 1);
  assert.deepStrictEqual(formats, [4]);
});

test('4 players, 2 tables → 1× doubles (uses fewer tables)', () => {
  const formats = Scheduler.decideTableFormats(4, 2);
  assert.deepStrictEqual(formats, [4]);
});

test('5 players, 2 tables → 1× 2v1 + 1× singles', () => {
  const formats = Scheduler.decideTableFormats(5, 2);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [3, 2]);
});

test('6 players, 2 tables → 1× doubles + 1× singles', () => {
  const formats = Scheduler.decideTableFormats(6, 2);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [4, 2]);
});

test('7 players, 2 tables → 1× doubles + 1× 2v1', () => {
  const formats = Scheduler.decideTableFormats(7, 2);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [4, 3]);
});

test('8 players, 2 tables → 2× doubles', () => {
  const formats = Scheduler.decideTableFormats(8, 2);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [4, 4]);
});

test('7 players, 3 tables → uses only 2 tables', () => {
  const formats = Scheduler.decideTableFormats(7, 3);
  assert.strictEqual(formats.length, 2);
  assert.strictEqual(formats.reduce((a, b) => a + b, 0), 7);
});

// --- Runner ---

async function run() {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  PASS: ${t.name}`);
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${t.name}`);
      console.log(`        ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
