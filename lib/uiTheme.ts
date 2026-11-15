import { contrast, css, ensure, hexNum, mix, readableOn, type RGB } from './palette';
import { DEFAULT_THEME, THEME_KEYS, getTheme, type Mode } from './themes';

export { DEFAULT_THEME };
const WHITE: RGB = [255, 255, 255], BLACK: RGB = [0, 0, 0];
const rgbList = (c: RGB) => c.join(', ');

/**
 * Every colour the game UI uses, as opaque values. Text colours are verified against every
 * background they can sit on (WCAG 1.4.3 AA, 4.5:1), and boundaries/graphics against 3:1 (1.4.11).
 */
export function uiColors(key: string, mode: Mode) {
    const t = getTheme(key, mode);
    const dark = mode === 'dark';
    const page = t.page, card = t.card, ink = t.ink;
    const panel2 = mix(card, ink, 0.08);
    const bgGlow = mix(page, t.filled, dark ? 0.26 : 0.14);

    const err = ensure(dark ? [255, 112, 132] : [190, 24, 50], [page, card], 4.8);
    const ok = ensure(dark ? [52, 211, 153] : [21, 128, 61], [page, card], 4.8);

    const cell = dark ? mix(page, BLACK, 0.25) : card;
    const cellGiven = mix(cell, ink, 0.09);
    const cellPeer = mix(cell, t.filled, 0.18);
    const cellSame = mix(cell, t.filled, 0.34);
    const cellSel = mix(cell, t.primary, 0.34);
    const cellConflict = mix(cell, err, 0.24);
    const cellBgs = [cell, cellGiven, cellPeer, cellSame, cellSel, cellConflict];

    const muted = ensure(t.muted, [page, card, panel2, bgGlow, ...cellBgs], 4.6);
    const a1 = t.primary, a2 = t.filled, a3 = t.accent;
    return {
        t, dark, page, card, ink, muted, panel2, bgGlow, err, ok, a1, a2, a3,
        border: ensure(mix(muted, card, 0.15), [card, page, panel2], 3.1),
        focus: ensure(dark ? mix(a1, WHITE, 0.2) : mix(a1, BLACK, 0.1), [page, card, panel2, ...cellBgs], 4.5),
        cell, cellGiven, cellPeer, cellSame, cellSel, cellConflict,
        digit: ensure(dark ? a1 : a2, cellBgs, 4.8),
        givenText: ensure(ink, cellBgs, 7),
        conflictText: ensure(err, cellBgs, 4.6),
        lineThin: ensure(mix(cell, ink, 0.35), cell, 3.1),
        lineBox: ensure(a2, [cell, cellPeer, cellSame, cellSel], 3.1),
        onA1: readableOn(a1),
        onA2: readableOn(a2),
    };
}

/** The CSS custom properties for one theme + mode. */
export function uiVars(key: string, mode: Mode): Record<string, string> {
    const c = uiColors(key, mode);
    return {
        '--bg': css(c.page), '--bg-glow': css(c.bgGlow), '--panel': css(c.card), '--panel-2': css(c.panel2),
        '--text': css(c.ink), '--muted': css(c.muted), '--border': css(c.border), '--border-soft': css(mix(c.card, c.ink, 0.2)),
        '--a1': css(c.a1), '--a2': css(c.a2), '--a3': css(c.a3), '--a1-rgb': rgbList(c.a1), '--a2-rgb': rgbList(c.a2),
        '--on-a1': css(c.onA1), '--on-a2': css(c.onA2), '--focus': css(c.focus),
        '--cell': css(c.cell), '--cell-given': css(c.cellGiven), '--cell-peer': css(c.cellPeer), '--cell-same': css(c.cellSame),
        '--cell-sel': css(c.cellSel), '--cell-conflict': css(c.cellConflict),
        '--digit': css(c.digit), '--given-text': css(c.givenText), '--conflict-text': css(c.conflictText),
        '--line-thin': css(c.lineThin), '--line-box': css(c.lineBox),
        '--err': css(c.err), '--ok': css(c.ok),
        '--shadow': c.dark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(40, 40, 80, 0.16)',
        'color-scheme': mode,
    };
}

/** Static stylesheet with every theme/mode combination, so the first paint is already themed. */
export function themeCss(): string {
    const block = (sel: string, key: string, mode: Mode) =>
        `${sel}{${Object.entries(uiVars(key, mode)).map(([k, v]) => `${k}:${v}`).join(';')}}`;
    const out: string[] = [block(':root', DEFAULT_THEME, 'dark')];
    out.push(`@media (prefers-color-scheme: light){${block(':root:not([data-mode])', DEFAULT_THEME, 'light')}}`);
    for (const key of THEME_KEYS) for (const mode of ['light', 'dark'] as Mode[]) out.push(block(`html[data-theme="${key}"][data-mode="${mode}"]`, key, mode));
    return out.join('\n');
}

/** Colours for the Phaser particle effects. */
export function fxColors(key: string, mode: Mode) {
    const t = getTheme(key, mode);
    return { accents: [hexNum(t.primary), hexNum(t.filled), hexNum(t.accent)], fx: [hexNum(t.primary), hexNum(t.filled), hexNum(t.accent), 0xfacc15, 0x34d399] };
}

/** Test helper: lowest contrast ratio between text colours and the backgrounds they appear on. */
export function auditTheme(key: string, mode: Mode) {
    const c = uiColors(key, mode);
    const checks: Array<[string, number, number]> = [];
    const add = (name: string, fg: RGB, bgs: RGB[], need: number) => bgs.forEach((b) => checks.push([`${name} on ${css(b)}`, contrast(fg, b), need]));
    const cellBgs = [c.cell, c.cellGiven, c.cellPeer, c.cellSame, c.cellSel, c.cellConflict];
    add('text', c.ink, [c.page, c.card, c.panel2, c.bgGlow], 4.5);
    add('muted', c.muted, [c.page, c.card, c.panel2, c.bgGlow, ...cellBgs], 4.5);
    add('a1', c.a1, [c.page, c.card, c.panel2], 4.5);
    add('a2', c.a2, [c.page, c.card, c.panel2], 4.5);
    add('a3', c.a3, [c.page, c.card, c.panel2], 4.5);
    add('err', c.err, [c.page, c.card], 4.5);
    add('ok', c.ok, [c.page, c.card], 4.5);
    add('digit', c.digit, cellBgs, 4.5);
    add('given', c.givenText, cellBgs, 4.5);
    add('conflict', c.conflictText, cellBgs, 4.5);
    add('focus', c.focus, [c.page, c.card, c.panel2, ...cellBgs], 3);
    add('border', c.border, [c.card, c.page, c.panel2], 3);
    add('line-thin', c.lineThin, [c.cell], 3);
    add('line-box', c.lineBox, [c.cell, c.cellPeer, c.cellSame, c.cellSel], 3);
    add('on-a1', c.onA1, [c.a1], 4.5);
    add('on-a2', c.onA2, [c.a2], 4.5);
    return checks.filter(([, got, need]) => got < need);
}
