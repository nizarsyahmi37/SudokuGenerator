/**
 * Which alphabet a character belongs to, so the right embedded font is used for each run of text.
 * Supported: Latin (base font), Latin Extended, Vietnamese, Cyrillic, Greek, Arabic, Hebrew, Devanagari and Thai.
 * Anything else (Chinese, Japanese, Korean, Armenian, Georgian...) needs a font file the author supplies: the "custom" script.
 */
export type Script = 'latin' | 'latin-ext' | 'vietnamese' | 'cyrillic' | 'greek' | 'arabic' | 'hebrew' | 'devanagari' | 'thai' | 'custom';
export type ExtraScript = Exclude<Script, 'latin' | 'custom'>;
export const EXTRA_SCRIPTS: ExtraScript[] = ['latin-ext', 'vietnamese', 'cyrillic', 'greek', 'arabic', 'hebrew', 'devanagari', 'thai'];
/** Scripts the bundled fonts cover with Noto Sans, since the Latin typefaces have no glyphs for them. */
export const NOTO_SCRIPTS: ExtraScript[] = ['arabic', 'hebrew', 'devanagari', 'thai'];
export const isRtl = (s: Script) => s === 'arabic' || s === 'hebrew';

const VIET = /[ĂăĐđĨĩŨũƠơƯự̀́̃̉Ạ-ỹ₫]/;
const LATIN_EXT = /[Ā-ʯḀ-ỿⱠ-Ɀ꜠-ꟿ]/;
const CYRILLIC = /[Ѐ-ӿ]/;
const GREEK = /[Ͱ-Ͽἀ-῿]/;
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const HEBREW = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
const DEVANAGARI = /[\u0900-\u097F\uA8E0-\uA8FF]/;
const THAI = /[\u0E00-\u0E7F]/;
const LATIN = /^[\u0000-ÿ -⁯€™←-⇿−∕·■-◿]$/u;

/** The script of one character, or null when no embedded font covers it. */
export function scriptOf(ch: string): Script | null {
    if (ARABIC.test(ch)) return 'arabic';
    if (HEBREW.test(ch)) return 'hebrew';
    if (DEVANAGARI.test(ch)) return 'devanagari';
    if (THAI.test(ch)) return 'thai';
    if (VIET.test(ch)) return 'vietnamese';
    if (CYRILLIC.test(ch)) return 'cyrillic';
    if (GREEK.test(ch)) return 'greek';
    if (LATIN_EXT.test(ch)) return 'latin-ext';
    if (LATIN.test(ch)) return 'latin';
    return null;
}

export interface Run { text: string; script: Script }

/**
 * Splits text into runs of one script. Characters no bundled font covers use the author's own font when there is one
 * (`custom`), and otherwise become "?" so they never print as empty boxes.
 */
export function splitRuns(text: string, hasCustom = false): Run[] {
    const runs: Run[] = [];
    let current: Run | null = null;
    for (const ch of text) {
        const s = scriptOf(ch);
        const script: Script = s ?? (hasCustom ? 'custom' : 'latin');
        const out = s || hasCustom ? ch : '?';
        // Spaces, digits and punctuation stay with the surrounding run so words are not split needlessly.
        const neutral = /[\s\d.,;:!?'"()\-–—·•/&%+=*#@_[\]{}<>]/.test(ch);
        // Noto Sans subsets for these scripts have no space or punctuation glyphs, so those stay in the Latin run.
        const stays = neutral && s === 'latin' && !(current && NOTO_SCRIPTS.includes(current.script as ExtraScript));
        if (current && (current.script === script || stays)) current.text += out;
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

/** True when a line reads right to left: its first letter is Arabic or Hebrew. */
export function isRtlText(text: string): boolean {
    for (const ch of text) {
        if (!/\p{L}/u.test(ch)) continue;
        const s = scriptOf(ch);
        return s !== null && isRtl(s);
    }
    return false;
}

/** Names of alphabets that appear in the text but have no bundled font, so they need the author's own font file. */
export function unsupportedIn(...texts: string[]): string[] {
    const names: Array<[string, RegExp]> = [
        ['Chinese, Japanese or Korean', /[぀-ヿ㐀-䶿一-鿿가-힯]/], ['Armenian or Georgian', /[԰-֏Ⴀ-ჿ]/],
        ['Bengali, Tamil or another Indic script', /[\u0980-\u0DFF]/], ['Khmer, Lao or Burmese', /[\u0E80-\u0EFF\u1000-\u109F\u1780-\u17FF]/],
    ];
    const all = texts.join('');
    return names.filter(([, re]) => re.test(all)).map(([n]) => n);
}
