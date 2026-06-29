import { deriveThesisLabel } from '../src/lib/providers/summary';
import * as assert from 'assert';

console.log("Running direction mapping tests...");

assert.strictEqual(deriveThesisLabel('LONG', 'positive'), 'Supports');
assert.strictEqual(deriveThesisLabel('LONG', 'negative'), 'Threatens');
assert.strictEqual(deriveThesisLabel('SHORT', 'positive'), 'Threatens');
assert.strictEqual(deriveThesisLabel('SHORT', 'negative'), 'Supports');
assert.strictEqual(deriveThesisLabel('LONG', 'neutral'), 'Neutral');
assert.strictEqual(deriveThesisLabel('SHORT', 'neutral'), 'Neutral');
assert.strictEqual(deriveThesisLabel('UNKNOWN', 'positive'), 'Neutral'); // fallback

console.log("All tests passed!");
