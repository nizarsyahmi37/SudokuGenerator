/** Site identity and ad configuration, read from environment variables at build time. */
export const SITE = {
    name: process.env.NEXT_PUBLIC_SITE_NAME || 'Sudoku',
    /** Who runs the site: the data controller named in the privacy policy. */
    operator: process.env.NEXT_PUBLIC_OPERATOR_NAME || '',
    contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || '',
    url: process.env.NEXT_PUBLIC_SITE_URL || '',
};

export const ADS_ENABLED = Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);

/** Update when the policies change in substance. */
export const LEGAL_UPDATED = '15 November 2026';
