import type { HomepageLayout, SlotKey } from '../../lib/types';

const keys: SlotKey[] = ['leftTop', 'leftBottom', 'lead', 'latest1', 'latest2', 'latest3', 'latest4'];
type Slots = HomepageLayout['slots'];

export function moveStoryToSlot(slots: Slots, storyId: string | null, target: SlotKey, knownIds: ReadonlySet<string>): Slots {
  if (!keys.includes(target) || (storyId && !knownIds.has(storyId))) return slots;
  if (slots[target] === storyId) return slots;
  const next = { ...slots };
  if (!storyId) { next[target] = null; return next; }
  const origin = keys.find(key => slots[key] === storyId);
  if (origin) next[origin] = slots[target];
  next[target] = storyId;
  return next;
}

export function removeStoryFromLayout(slots: Slots, storyId: string): Slots {
  const next = { ...slots };
  for (const key of keys) if (next[key] === storyId) next[key] = null;
  return next;
}

export function layoutIsComplete(slots: Slots, knownIds: ReadonlySet<string>): boolean {
  const values = keys.map(key => slots[key]);
  return values.every((id): id is string => !!id && knownIds.has(id)) && new Set(values).size === keys.length;
}
