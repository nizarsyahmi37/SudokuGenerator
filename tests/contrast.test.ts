import { describe, expect, it } from 'vitest';
import { contrast, ensure, mix } from '../lib/palette';
import { THEME_KEYS, getTheme } from '../lib/themes';
import { auditTheme } from '../lib/uiTheme';

describe('WCAG contrast', () => {
    it('ensure() reaches the requested ratio', () => {
        const bg: [number, number, number] = [240, 240, 240];
        expect(contrast(ensure([200, 200, 200], bg, 4.5), bg)).toBeGreaterThanOrEqual(4.5);
        const dark: [number, number, number] = [10, 10, 30];
        expect(contrast(ensure([40, 40, 80], dark, 7), dark)).toBeGreaterThanOrEqual(7);
    });

    for (const key of THEME_KEYS) {
        for (const mode of ['light', 'dark'] as const) {
            it(`${key} (${mode}): every UI colour pair meets AA`, () => {
                expect(auditTheme(key, mode)).toEqual([]);
            });

            it(`${key} (${mode}): book text and board lines meet AA`, () => {
                const t = getTheme(key, mode);
                const spot = t.motif === 'classic' ? t.accent : t.primary;
                expect(contrast(t.ink, t.page)).toBeGreaterThanOrEqual(4.5);
                expect(contrast(t.muted, t.page)).toBeGreaterThanOrEqual(4.5);
                expect(contrast(spot, t.page)).toBeGreaterThanOrEqual(4.5);
                expect(contrast(ensure(mix(t.page, t.ink, 0.38), t.page, 3.1), t.page)).toBeGreaterThanOrEqual(3);
            });
        }
    }
});
