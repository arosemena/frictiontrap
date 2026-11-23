import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeDomain,
  extractWebHostname,
  hostMatchesRule,
  findMatchingRule,
} from '../shared/domains.js';
import {
  generateMathProblem,
  generateChallengeSet,
  isCorrectAnswer,
} from '../shared/math.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// 1. Manifest & file references check
const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.ok(fs.existsSync(path.join(rootDir, manifest.background.service_worker)));
assert.ok(fs.existsSync(path.join(rootDir, manifest.action.default_popup)));
assert.ok(fs.existsSync(path.join(rootDir, manifest.options_page)));
for (const iconPath of Object.values(manifest.icons)) {
  assert.ok(fs.existsSync(path.join(rootDir, iconPath)), `Missing icon: ${iconPath}`);
}

// 2. Domain normalization & matching
assert.equal(normalizeDomain('https://x.com/home'), 'x.com');
assert.equal(normalizeDomain('www.twitter.com'), 'twitter.com');
assert.equal(normalizeDomain('  Reddit.com/r/programming '), 'reddit.com');
assert.equal(normalizeDomain('mobile.x.com'), 'mobile.x.com');
assert.equal(normalizeDomain('not a domain'), null);
assert.equal(normalizeDomain('localhost'), null);
assert.equal(normalizeDomain(''), null);

assert.equal(extractWebHostname('https://x.com/explore'), 'x.com');
assert.equal(extractWebHostname('chrome://extensions'), null);
assert.equal(extractWebHostname('chrome-extension://abc/gate.html'), null);

assert.equal(hostMatchesRule('x.com', 'x.com'), true);
assert.equal(hostMatchesRule('mobile.x.com', 'x.com'), true);
assert.equal(hostMatchesRule('notx.com', 'x.com'), false);

assert.equal(findMatchingRule('https://mobile.x.com/home', ['x.com', 'twitter.com']), 'x.com');
assert.equal(findMatchingRule('https://example.com', ['x.com', 'twitter.com']), null);

// 3. Math generation & verification
for (const difficulty of ['easy', 'medium', 'hard']) {
  const set = generateChallengeSet(5, difficulty);
  assert.equal(set.length, 5);
  for (const p of set) {
    assert.equal(typeof p.expression, 'string');
    assert.equal(Number.isInteger(p.answer), true);
    assert.equal(isCorrectAnswer(String(p.answer), p.answer), true);
    assert.equal(isCorrectAnswer(`  ${p.answer}  `, p.answer), true);
    assert.equal(isCorrectAnswer(String(p.answer + 1), p.answer), false);
    assert.equal(isCorrectAnswer('abc', p.answer), false);
    assert.equal(isCorrectAnswer('', p.answer), false);
  }
}

// Verify exact math evaluation on 50 random problems per difficulty
function evaluateExpression(expr) {
  const jsExpr = expr.replace(/×/g, '*').replace(/−/g, '-').replace(/÷/g, '/');
  return Function(`"use strict"; return (${jsExpr});`)();
}

for (const difficulty of ['easy', 'medium', 'hard']) {
  for (let i = 0; i < 50; i += 1) {
    const p = generateMathProblem(difficulty);
    assert.doesNotMatch(p.expression, /[×÷]/, `Unexpected operator in ${p.expression}`);
    assert.equal(
      evaluateExpression(p.expression),
      p.answer,
      `Mismatch for ${difficulty}: ${p.expression} !== ${p.answer}`
    );
  }
}

console.log('All FrictionTrap tests passed.');
