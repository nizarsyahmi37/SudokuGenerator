'use client';

import { THEME_KEYS, getTheme, themeLabel, type ModePref } from '../lib/themes';
import { css } from '../lib/palette';
import { useTheme } from './ThemeProvider';
import { useI18n } from './I18nProvider';
import { LOCALES, isLocale } from '../lib/i18n';

const MODES: Array<{ id: ModePref; key: 'settings.light' | 'settings.dark' | 'settings.system' }> = [
    { id: 'light', key: 'settings.light' },
    { id: 'dark', key: 'settings.dark' },
    { id: 'system', key: 'settings.system' },
];

/** Theme, light/dark mode and motion settings. All native form controls, fully keyboard operable. */
export default function SettingsPanel() {
    const { theme, setTheme, modePref, setModePref, mode, effects, setEffects } = useTheme();
    const { t, locale, setLocale } = useI18n();
    return (
        <div className="settings">
            <fieldset className="set-group">
                <legend>{t('settings.theme', { name: themeLabel(theme) })}</legend>
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
                <legend>{t('settings.appearance')}</legend>
                <div className="chips">
                    {MODES.map((m) => (
                        <label key={m.id} className="chip">
                            <input type="radio" className="sr-only" name="mode" value={m.id} checked={modePref === m.id} onChange={() => setModePref(m.id)} />
                            <span>{t(m.key)}</span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className="set-group">
                <label className="check">
                    <input type="checkbox" checked={effects} onChange={(e) => setEffects(e.target.checked)} />
                    <span>{t('settings.effects')}</span>
                </label>
            </div>

            <div className="set-group">
                <label className="field-row" htmlFor="lang-select">
                    <span>{t('settings.language')}</span>
                    <select id="lang-select" value={locale} onChange={(e) => { if (isLocale(e.target.value)) setLocale(e.target.value); }}>
                        {LOCALES.map((l) => <option key={l.id} value={l.id} lang={l.id}>{l.name}</option>)}
                    </select>
                </label>
                <p className="hint">{t('settings.languageNote')}</p>
            </div>
        </div>
    );
}
