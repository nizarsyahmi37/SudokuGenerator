import { seeded } from '../rng';

const ADJECTIVES = ['Amber', 'Quiet', 'Silver', 'Hidden', 'Gentle', 'Crooked', 'Bright', 'Hollow', 'Velvet', 'Distant', 'Patient', 'Brisk', 'Mossy', 'Copper', 'Wandering', 'Sleepy', 'Lucky', 'Frosted', 'Rustic', 'Golden', 'Narrow', 'Windy', 'Clever', 'Lonely'];
const NOUNS = ['Fox', 'Harbor', 'Lantern', 'Orchard', 'Compass', 'Meadow', 'Kettle', 'Bridge', 'Thistle', 'Anchor', 'Cabin', 'Willow', 'Pebble', 'Key', 'Garden', 'Falcon', 'Ledger', 'Tower', 'Brook', 'Clock', 'Mirror', 'Ferry', 'Maple', 'Lighthouse'];

/** How many distinct names exist, which is more than the most puzzles a book can hold. */
export const TITLE_COUNT = ADJECTIVES.length * NOUNS.length;

/**
 * A name for each of `count` puzzles, such as "The Amber Fox". Names never repeat inside a book, and the same seed
 * always gives the same names, so a book can be rebuilt exactly.
 */
export function puzzleTitles(seed: string, count: number): string[] {
    const all: string[] = [];
    for (const a of ADJECTIVES) for (const n of NOUNS) all.push(`The ${a} ${n}`);
    const rand = seeded(`${seed}|titles`);
    for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, Math.min(count, all.length));
}
