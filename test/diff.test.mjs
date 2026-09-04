/**
 * Reporting only what changed.
 *
 * The fix-measure loop is the main way this tool is used, and the second
 * measurement used to re-send everything that had not moved — text that is then
 * re-sent again on every later turn of the conversation. Measured on a real
 * page: 413 tokens down to 44 when nothing changed.
 *
 * The saving is the smaller half. After a fix, the question is not "what is on
 * this page" but "did my fix work", and a diff answers that one directly.
 *
 * What makes it dangerous is a fingerprint that is too specific: if the identity
 * of a finding includes something that wiggles between runs, everything looks
 * new every time and the diff quietly becomes a full report that also claims
 * things were fixed and re-broken.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, fingerprints } from '../src/findings.mjs';

test('the same finding keeps its identity across two runs', () => {
  const a = { sel: 'span.title', text: 'Hoş geldiniz', ratio: 3.9, fontSize: '16px' };
  const b = { sel: 'span.title', text: 'Hoş geldiniz', ratio: 3.9, fontSize: '16px' };
  assert.equal(fingerprint('lowContrast', a), fingerprint('lowContrast', b));
});

test('a different element with the same text is a different finding', () => {
  const a = fingerprint('lowContrast', { sel: 'span.a', text: 'Devam', ratio: 3.9 });
  const b = fingerprint('lowContrast', { sel: 'span.b', text: 'Devam', ratio: 3.9 });
  assert.notEqual(a, b);
});

test('the same element under two different checks stays two findings', () => {
  const el = { sel: 'button.cta', text: 'Kaydet', size: '30x30' };
  assert.notEqual(fingerprint('smallTargets', el), fingerprint('buttonIssues', el));
});

test('a fixed contrast ratio changes the fingerprint, so the old one reads as CLOSED', () => {
  const before = fingerprint('lowContrast', { sel: 's', text: 'x', ratio: 3.9 });
  const after = fingerprint('lowContrast', { sel: 's', text: 'x', ratio: 4.8 });
  assert.notEqual(before, after, 'a fix has to show up as a change');
});

test('the theme baseline is not a finding and never enters the diff', () => {
  const f = fingerprints({
    lowContrast: [{ sel: 'a', text: 't', ratio: 3 }],
    themeSignature: [{ sel: 'b' }, { sel: 'c' }],
    imagesWithoutAlt: 2,
  });
  assert.equal(f.size, 1, 'only real findings are diffed');
});

test('an empty inspection produces an empty set rather than throwing', () => {
  assert.equal(fingerprints({}).size, 0);
  assert.equal(fingerprints(null).size, 0);
});

test('two inspections of an unchanged page produce identical sets', () => {
  const d = {
    lowContrast: [{ sel: 'a', text: 'bir', ratio: 4.1 }, { sel: 'b', text: 'iki', ratio: 3.2 }],
    smallTargets: [{ sel: 'c', text: 'Ara', size: '23x36' }],
  };
  const first = fingerprints(d);
  const second = fingerprints(JSON.parse(JSON.stringify(d)));
  assert.deepEqual([...first].sort(), [...second].sort());
});
