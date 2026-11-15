export type RGB = [number, number, number];

const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
export const luminance = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);

/** WCAG 2.x contrast ratio between two opaque colours (1 to 21). */
export function contrast(a: RGB, b: RGB) {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
export const isDark = (c: RGB) => luminance(c) < 0.18;

const WHITE: RGB = [255, 255, 255], BLACK: RGB = [0, 0, 0];

/**
 * Nudges `fg` towards black or white (whichever direction can reach the target) until it
 * meets `ratio` against every background in `bgs`. Hue is kept as far as possible.
 */
export function ensure(fg: RGB, bgs: RGB | RGB[], ratio: number): RGB {
    const list = Array.isArray(bgs[0]) ? (bgs as RGB[]) : [bgs as RGB];
    const ok = (c: RGB) => list.every((b) => contrast(c, b) >= ratio);
    if (ok(fg)) return fg;
    // Move towards whichever of black or white can give the better worst-case contrast (matters on mid-tone backgrounds).
    const worst = (t: RGB) => Math.min(...list.map((b) => contrast(t, b)));
    const target = worst(BLACK) >= worst(WHITE) ? BLACK : WHITE;
    for (let t = 0.04; t <= 1.0001; t += 0.04) { const c = mix(fg, target, t); if (ok(c)) return c; }
    return target;
}

/** Black or white, whichever reads better on `bg` (always at least 4.5:1 on mid-tones). */
export const readableOn = (bg: RGB): RGB => (contrast([255, 255, 255], bg) >= contrast([17, 17, 17], bg) ? [255, 255, 255] : [17, 17, 17]);

export const css = (c: RGB) => `rgb(${c.join(', ')})`;
export const hexNum = (c: RGB) => (c[0] << 16) | (c[1] << 8) | c[2];
