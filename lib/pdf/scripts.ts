/**
 * Which alphabet a character belongs to, so the right embedded font is used for each run of text.
 * Supported: Latin (base font), Latin Extended, Vietnamese, Cyrillic and Greek.
 */
export type Script = 'latin' | 'latin-ext' | 'vietnamese' | 'cyrillic' | 'greek';
export const EXTRA_SCRIPTS: Exclude<Script, 'latin'>[] = ['latin-ext', 'vietnamese', 'cyrillic', 'greek'];

const VIET = /[ĂăĐđĨĩŨũƠơƯự̀́̃̉Ạ-ỹ₫]/;
const LATIN_EXT = /[Ā-ʯḀ-ỿⱠ-Ɀ꜠-ꟿ]/;
const CYRILLIC = /[Ѐ-ӿ]/;
const GREEK = /[Ͱ-Ͽἀ-῿]/;
const LATIN = /^[\u0000-ÿ -⁯€™←-⇿−∕·■-◿]$/u;

/** The script of one character, or null when no embedded font covers it. */
export function scriptOf(ch: string): Script | null {
    if (VIET.test(ch)) return 'vietnamese';
    if (CYRILLIC.test(ch)) return 'cyrillic';
    if (GREEK.test(ch)) return 'greek';
    if (LATIN_EXT.test(ch)) return 'latin-ext';
    if (LATIN.test(ch)) return 'latin';
    return null;
}

export interface Run { text: string; script: Script }

/** Splits text into runs of one script. Characters no font covers become "?" so they never print as empty boxes. */
export function splitRuns(text: string): Run[] {
    const runs: Run[] = [];
    let current: Run | null = null;
    for (const ch of text) {
        const s = scriptOf(ch);
        const script: Script = s ?? 'latin';
        const out = s ? ch : '?';
        // Spaces, digits and punctuation stay with the surrounding run so words are not split needlessly.
        const neutral = /[\s\d.,;:!?'"()\-–—·•/&%+=*#@_[\]{}<>]/.test(ch);
        if (current && (current.script === script || (neutral && s === 'latin'))) current.text += out;
        else { current = { text: out, script }; runs.push(current); }
    }
    return runs;
}

/** The extra scripts that a set of texts needs, so only those fonts are downloaded. */
export function scriptsIn(...texts: string[]): Script[] {
    const found = new Set<Script>();
    for (const t of texts) for (const ch of t) { const s = scriptOf(ch); if (s && s !== 'latin') found.add(s); }
    return [...found];
}

/** Names of alphabets that appear in the text but have no embedded font yet. */
export function unsupportedIn(...texts: string[]): string[] {
    const names: Array<[string, RegExp]> = [
        ['Arabic', /[؀-ۿݐ-ݿ]/], ['Hebrew', /[֐-׿]/], ['Devanagari', /[ऀ-ॿ]/], ['Thai', /[฀-๿]/],
        ['Chinese, Japanese or Korean', /[぀-ヿ㐀-䶿一-鿿가-힯]/], ['Armenian or Georgian', /[԰-֏Ⴀ-ჿ]/],
    ];
    const all = texts.join('');
    return names.filter(([, re]) => re.test(all)).map(([n]) => n);
}
