'use client';

import Link from 'next/link';
import { ADS_ENABLED } from '../lib/site';
import PrivacyChoicesButton from './PrivacyChoicesButton';
import { useI18n } from './I18nProvider';

/** The footer's links, in the language the visitor chose. */
export default function FooterNav() {
    const { t } = useI18n();
    return (
        <nav aria-label={t('footer.nav')}>
            <ul>
                <li><Link href="/privacy">{t('footer.privacy')}</Link></li>
                <li><Link href="/accessibility">{t('footer.accessibility')}</Link></li>
                {ADS_ENABLED && <li><PrivacyChoicesButton /></li>}
            </ul>
        </nav>
    );
}
