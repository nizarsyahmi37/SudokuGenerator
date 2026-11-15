'use client';

import { useI18n } from './I18nProvider';

export default function SkipLink() {
    const { t } = useI18n();
    return <a className="skip-link" href="#main">{t('skip')}</a>;
}
