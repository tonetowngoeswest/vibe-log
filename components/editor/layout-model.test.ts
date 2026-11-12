import assert from 'node:assert/strict';
import test from 'node:test';
import type { HomepageLayout, SlotKey } from '../../lib/types';
import { layoutIsComplete, moveStoryToSlot, removeStoryFromLayout } from './layout-model';

const keys: SlotKey[] = ['leftTop', 'leftBottom', 'lead', 'latest1', 'latest2', 'latest3', 'latest4'];
const slots = Object.fromEntries(keys.map((key, index) => [key, `story-${index}`])) as HomepageLayout['slots'];
const known = new Set([...Object.values(slots) as string[], 'archive-story']);

test('moving between every pair of occupied slots swaps stories without duplicates or mutation', () => {
  for (const origin of keys) for (const target of keys) {
    const before = structuredClone(slots);
    const result = moveStoryToSlot(slots, slots[origin], target, known);
    assert.equal(result[target], slots[origin]);
    assert.equal(result[origin], slots[target]);
    assert.deepEqual(new Set(Object.values(result)), new Set(Object.values(slots)));
    assert.deepEqual(slots, before);
    assert.ok(layoutIsComplete(result, known));
  }
});

test('an archived story can replace any slot, returning the displaced story to the pool', () => {
  for (const target of keys) {
    const replaced = slots[target];
    const result = moveStoryToSlot(slots, 'archive-story', target, known);
    assert.equal(result[target], 'archive-story');
    assert.ok(!Object.values(result).includes(replaced));
    assert.equal(new Set(Object.values(result)).size, 7);
    assert.ok(layoutIsComplete(result, known));
  }
});

test('removing any homepage story creates an incomplete draft that can be refilled', () => {
  for (const target of keys) {
    const result = removeStoryFromLayout(slots, slots[target]!);
    assert.equal(result[target], null);
    assert.ok(!layoutIsComplete(result, known));
    assert.ok(layoutIsComplete(moveStoryToSlot(result, 'archive-story', target, known), known));
  }
});

test('keyboard empty selection and moving into an empty slot behave like dragging', () => {
  const empty = moveStoryToSlot(slots, null, 'lead', known);
  assert.equal(empty.lead, null);
  const moved = moveStoryToSlot(empty, slots.leftTop, 'lead', known);
  assert.equal(moved.lead, slots.leftTop);
  assert.equal(moved.leftTop, null);
  assert.ok(!layoutIsComplete(moved, known));
});

test('unknown or duplicated stories cannot form a publishable layout', () => {
  assert.equal(moveStoryToSlot(slots, 'unknown-id', 'lead', known), slots);
  assert.ok(!layoutIsComplete({ ...slots, lead: slots.leftTop }, known));
  assert.ok(!layoutIsComplete({ ...slots, lead: 'unknown-id' }, known));
  assert.ok(!layoutIsComplete({ ...slots, lead: null }, known));
});
