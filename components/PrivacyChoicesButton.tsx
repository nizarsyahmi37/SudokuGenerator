'use client';

import { ADS_ENABLED } from '../lib/site';
import { useConsent } from './ConsentProvider';

/** Footer control that re-opens the advertising choices. Only exists when ads are configured. */
export default function PrivacyChoicesButton() {
    const { reopen } = useConsent();
    if (!ADS_ENABLED) return null;
    return <button type="button" className="link-button" onClick={reopen}>Privacy choices</button>;
}
