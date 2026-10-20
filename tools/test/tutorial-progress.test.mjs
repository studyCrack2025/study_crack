import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../../js/tutorial.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../../tutorial.html', import.meta.url), 'utf8');
const helperStart = source.indexOf('function updateTutorialProgress() {');
const helperEnd = source.indexOf('\nasync function renderStep()', helperStart);
assert.notEqual(helperStart, -1, 'progress updater should exist');
assert.notEqual(helperEnd, -1, 'progress updater should be defined before renderStep');
const helper = source.slice(helperStart, helperEnd);

test('tutorial markup exposes an accessible progress indicator and visible count', () => {
    assert.match(html, /id="tutorialProgress"[^>]*role="progressbar"[^>]*aria-valuemin="1"/);
    assert.match(html, /id="tutorialProgressLabel"/);
    assert.match(source.slice(source.indexOf('async function renderStep()'), source.indexOf('// ── intro 전화번호')), /updateTutorialProgress\(\)/);
});

test('progress indicator reports the first, middle, and final tutorial steps', () => {
    const attributes = {};
    const elements = {
        tutorialProgress: { setAttribute: (name, value) => { attributes[name] = value; } },
        tutorialProgressLabel: { textContent: '' },
        tutorialProgressFill: { style: { width: '' } }
    };
    const context = {
        STEPS: Array.from({ length: 6 }, () => ({})),
        currentStepIdx: 0,
        document: { getElementById: id => elements[id] || null }
    };
    const update = vm.runInNewContext(`${helper}\nupdateTutorialProgress;`, context);

    for (const [index, expected] of [[0, 1], [2, 3], [5, 6]]) {
        context.currentStepIdx = index;
        update();
        assert.equal(elements.tutorialProgressLabel.textContent, `${expected} / 6단계`);
        assert.equal(attributes['aria-valuemax'], '6');
        assert.equal(attributes['aria-valuenow'], String(expected));
        assert.ok(Math.abs(parseFloat(elements.tutorialProgressFill.style.width) - expected / 6 * 100) < 0.001);
    }
});

test('progress updater safely no-ops when the indicator is not present', () => {
    const context = { STEPS: [{}, {}], currentStepIdx: 0, document: { getElementById: () => null } };
    const update = vm.runInNewContext(`${helper}\nupdateTutorialProgress;`, context);
    assert.doesNotThrow(update);
});
