import * as Crypto from 'expo-crypto';

export const newId = () => Crypto.randomUUID().replace(/-/g, '').slice(0, 20);

let last = 0;
/** Strictly increasing wall-clock ms — two edits in the same millisecond still order correctly. */
export function monotonicNow(): number {
  const t = Date.now();
  last = t > last ? t : last + 1;
  return last;
}
