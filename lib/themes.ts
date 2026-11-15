import { ensure, mix, type RGB } from './palette';

export type { RGB };
export type Mode = 'light' | 'dark';
export type ModePref = Mode | 'system';

export interface Theme {
    label: string;
    mode: Mode;
    motif: 'cosmos' | 'forest' | 'ocean' | 'sunset' | 'classic' | 'arctic' | 'cyber' | 'sakura' | 'desert' | 'candy';
    page: RGB; // background / paper
    card: RGB; // raised surface
    ink: RGB; // body text
    muted: RGB; // secondary text
    primary: RGB; // main accent (always readable as text on page and card)
    accent: RGB; // second accent (same guarantee)
    filled: RGB; // third accent (same guarantee)
    given: RGB; // printed clues
}

interface Seed {
    label: string;
    motif: Theme['motif'];
    paper: { light: RGB; dark: RGB };
    primary: RGB;
    accent: RGB;
    filled: RGB;
}

const SEEDS: Record<string, Seed> = {
    cosmos: { label: 'Cosmos', motif: 'cosmos', paper: { light: [243, 241, 255], dark: [11, 14, 40] }, primary: [34, 211, 238], accent: [244, 114, 182], filled: [124, 58, 237] },
    forest: { label: 'Forest', motif: 'forest', paper: { light: [232, 243, 228], dark: [13, 26, 19] }, primary: [45, 106, 79], accent: [217, 119, 6], filled: [45, 130, 90] },
    ocean: { label: 'Ocean', motif: 'ocean', paper: { light: [225, 241, 250], dark: [8, 20, 36] }, primary: [14, 116, 144], accent: [249, 115, 22], filled: [3, 105, 161] },
    sunset: { label: 'Sunset', motif: 'sunset', paper: { light: [255, 241, 224], dark: [34, 12, 26] }, primary: [190, 24, 93], accent: [234, 88, 12], filled: [219, 39, 119] },
    classic: { label: 'Classic', motif: 'classic', paper: { light: [255, 255, 255], dark: [18, 20, 26] }, primary: [31, 36, 48], accent: [36, 87, 214], filled: [36, 87, 214] },
    arctic: { label: 'Arctic', motif: 'arctic', paper: { light: [234, 244, 252], dark: [9, 18, 34] }, primary: [37, 99, 235], accent: [14, 165, 233], filled: [37, 99, 235] },
    cyber: { label: 'Neon City', motif: 'cyber', paper: { light: [250, 244, 255], dark: [16, 9, 34] }, primary: [255, 45, 170], accent: [0, 229, 255], filled: [200, 20, 140] },
    sakura: { label: 'Sakura', motif: 'sakura', paper: { light: [253, 240, 245], dark: [32, 13, 24] }, primary: [219, 80, 130], accent: [201, 76, 76], filled: [200, 60, 115] },
    desert: { label: 'Desert', motif: 'desert', paper: { light: [252, 238, 212], dark: [31, 21, 11] }, primary: [194, 86, 38], accent: [13, 148, 136], filled: [180, 70, 30] },
    candy: { label: 'Candy', motif: 'candy', paper: { light: [255, 238, 249], dark: [29, 11, 35] }, primary: [219, 39, 119], accent: [20, 184, 166], filled: [219, 39, 119] },
};

export const THEME_KEYS = Object.keys(SEEDS);
export const DEFAULT_THEME = 'cosmos';
export const themeLabel = (key: string) => (SEEDS[key] || SEEDS[DEFAULT_THEME]).label;

/** Black on white with no tints, for the print ink-saving mode. */
export const INK_SAVER: Theme = {
    label: 'Ink saver', mode: 'light', motif: 'classic',
    page: [255, 255, 255], card: [255, 255, 255], ink: [0, 0, 0], muted: [70, 70, 70],
    primary: [0, 0, 0], accent: [64, 64, 64], filled: [64, 64, 64], given: [0, 0, 0],
};

const WHITE: RGB = [255, 255, 255], BLACK: RGB = [0, 0, 0];
const cache = new Map<string, Theme>();

/**
 * Builds a palette for a theme in light or dark mode. Every text colour is nudged until it
 * reaches at least 4.5:1 against both the page and the raised surface (WCAG 1.4.3, AA),
 * so a theme can never ship with unreadable text in either mode.
 */
export function getTheme(key: string, mode: Mode): Theme {
    const id = `${key}:${mode}`;
    const hit = cache.get(id);
    if (hit) return hit;
    const s = SEEDS[key] || SEEDS[DEFAULT_THEME];
    const page = s.paper[mode];
    const card: RGB = mode === 'light' ? mix(page, WHITE, 0.65) : mix(page, WHITE, 0.07);
    const ink0 = mode === 'light' ? mix(s.primary, BLACK, 0.8) : mix(s.primary, WHITE, 0.88);
    const panel2 = mix(card, ink0, 0.08); // button / control surface
    const surfaces = [page, card, panel2];
    const ink = ensure(ink0, surfaces, 12);
    const muted = ensure(mix(ink, page, 0.42), surfaces, 4.8);
    const t: Theme = {
        label: s.label, mode, motif: s.motif, page, card, ink, muted,
        primary: ensure(s.primary, surfaces, 4.8),
        accent: ensure(s.accent, surfaces, 4.8),
        filled: ensure(s.filled, surfaces, 4.8),
        given: ink,
    };
    cache.set(id, t);
    return t;
}
