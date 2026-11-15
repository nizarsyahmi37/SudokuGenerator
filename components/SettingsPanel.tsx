'use client';

import { THEME_KEYS, getTheme, themeLabel, type ModePref } from '../lib/themes';
import { css } from '../lib/palette';
import { useTheme } from './ThemeProvider';

const MODES: Array<{ id: ModePref; label: string }> = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'system', label: 'Match device' },
];

/** Theme, light/dark mode and motion settings. All native form controls, fully keyboard operable. */
export default function SettingsPanel() {
    const { theme, setTheme, modePref, setModePref, mode, effects, setEffects } = useTheme();
    return (
        <div className="settings">
            <fieldset className="set-group">
                <legend>Theme · {themeLabel(theme)}</legend>
                <div className="tp-row">
                    {THEME_KEYS.map((k) => {
                        const t = getTheme(k, mode);
                        return (
                            <label key={k} className="tp">
                                <input type="radio" className="sr-only" name="theme" value={k} checked={theme === k} onChange={() => setTheme(k)} />
                                <span className="tp-dot" style={{ background: `linear-gradient(135deg, ${css(t.page)} 50%, ${css(t.primary)} 50%)`, borderColor: css(t.accent) }} aria-hidden="true" />
                                <span className="sr-only">{themeLabel(k)}</span>
                            </label>
                        );
                    })}
                </div>
            </fieldset>

            <fieldset className="set-group">
                <legend>Appearance</legend>
                <div className="chips">
                    {MODES.map((m) => (
                        <label key={m.id} className="chip">
                            <input type="radio" className="sr-only" name="mode" value={m.id} checked={modePref === m.id} onChange={() => setModePref(m.id)} />
                            <span>{m.label}</span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className="set-group">
                <label className="check">
                    <input type="checkbox" checked={effects} onChange={(e) => setEffects(e.target.checked)} />
                    <span>Animated background and effects</span>
                </label>
            </div>
        </div>
    );
}
