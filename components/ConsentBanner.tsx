'use client';

import Link from 'next/link';
import { useConsent } from './ConsentProvider';
import { useI18n } from './I18nProvider';

/**
 * Asks before any advertising code is loaded. The three answers have equal weight, and the page
 * stays fully usable whatever is chosen. It is a region, not a modal, so it never traps keyboard focus.
 */
export default function ConsentBanner() {
    const { bannerOpen, choose, choice } = useConsent();
    const { t } = useI18n();
    if (!bannerOpen) return null;
    return (
        <section className="consent" role="region" aria-labelledby="consent-title" aria-describedby="consent-text">
            <h2 id="consent-title">{t('consent.title')}</h2>
            <p id="consent-text">
                {t('consent.text')} <Link href="/privacy">{t('consent.policy')}</Link>.
            </p>
            <div className="consent-actions">
                <button type="button" onClick={() => choose('ads')}>{t('consent.allow')}</button>
                <button type="button" onClick={() => choose('ads-limited')}>{t('consent.limited')}</button>
                <button type="button" onClick={() => choose('essential')}>{t('consent.none')}</button>
            </div>
            {choice && <p className="hint">{t('consent.current', { choice: t(choice === 'ads' ? 'consent.c.ads' : choice === 'ads-limited' ? 'consent.c.limited' : 'consent.c.none') })}</p>}
        </section>
    );
}
