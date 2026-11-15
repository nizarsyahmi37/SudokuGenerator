'use client';

import { ADS_ENABLED } from '../lib/site';
import { useConsent } from './ConsentProvider';
import { useI18n } from './I18nProvider';

/** Footer control that re-opens the advertising choices. Only exists when ads are configured. */
export default function PrivacyChoicesButton() {
    const { reopen } = useConsent();
    const { t } = useI18n();
    if (!ADS_ENABLED) return null;
    return <button type="button" className="link-button" onClick={reopen}>{t('footer.choices')}</button>;
}
