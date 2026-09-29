import { createHash } from 'node:crypto';

const digest = (name: string) => createHash('sha256').update(`feedants-seed:${name}`).digest();

/**
 * A stable UUID derived from a name, so every service computes the same IDs for the same
 * seed record without talking to each other. Laid out as a v4 UUID so any validator accepts it.
 */
export function seedId(name: string): string {
  const b = digest(name);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = b.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A stable number in [0, 1) derived from a name — deterministic "randomness" for demo values. */
export function seedRandom(name: string): number {
  return digest(name).readUInt32BE(0) / 2 ** 32;
}
