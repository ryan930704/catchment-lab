import assert from 'node:assert/strict';
import test from 'node:test';
import { findGardenArea, PRESETS, simulate } from '../src/model.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} ≠ ${expected}`);

test('each preset conserves water per interval and normalizes its storm total', () => {
  for (const site of Object.values(PRESETS)) {
    const result = simulate(site);
    let previous = 0;
    for (const step of result.rows) {
      close(previous + step.runoff, step.infiltrated + step.stored + step.overflow);
      assert.ok(step.stored <= result.capacity);
      assert.ok(step.infiltrated <= site.soil * site.area / 12);
      previous = step.stored;
    }
    close(result.rows.reduce((sum, row) => sum + row.rainMm, 0), site.rain);
    close(result.runoff, result.infiltrated + result.stored + result.overflow);
    close(result.runoff, site.rain * (0.95 * site.roof + 0.80 * site.paving));
  }
});

test('no garden discharges all runoff and a dry site stays dry', () => {
  const bare = simulate({ ...PRESETS.school, area: 0 });
  close(bare.runoff, bare.overflow);
  assert.equal(bare.capture, 0);
  const dry = { ...PRESETS.school, rain: 0 };
  const dryOutput = simulate(dry);
  assert.equal(dryOutput.overflow, 0);
  assert.equal(dryOutput.firstOverflow, null);
  assert.equal(findGardenArea(dry, 0.75), null);
});

test('an early burst and steady rain can yield different overflow for the same total', () => {
  const early = PRESETS.courtyard;
  const steady = simulate({ ...early, pattern: 'steady' });
  const burst = simulate(early);
  close(steady.runoff, burst.runoff);
  assert.ok(Math.abs(steady.overflow - burst.overflow) > 1);
});

test('sizing returns a minimal whole area or null for an unreachable target', () => {
  for (const site of Object.values(PRESETS)) {
    for (const target of [0.5, 0.75, 0.9, 1]) {
      const area = findGardenArea(site, target);
      assert.ok(Number.isInteger(area) && area > 0);
      assert.ok(simulate({ ...site, area }).capture + 1e-10 >= target);
      assert.ok(simulate({ ...site, area: area - 1 }).capture + 1e-10 < target);
    }
  }
  assert.equal(findGardenArea({ ...PRESETS.school, soil: 0, depth: 0 }, 0.5), null);
});
