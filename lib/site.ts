/** Site identity and ad configuration, read from environment variables at build time. */
export const SITE = {
    name: process.env.NEXT_PUBLIC_SITE_NAME || 'Sudoku',
    /** Who runs the site: the data controller named in the privacy policy. */
    operator: process.env.NEXT_PUBLIC_OPERATOR_NAME || '',
    contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || '',
    url: (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, ''),
};

/** Absolute base URL for canonical links, the sitemap and social cards. Falls back to localhost in development. */
export const BASE_URL = SITE.url || 'http://localhost:3000';

export const SITE_DESCRIPTION = 'Play sudoku at ten difficulty levels graded by solving technique, get hints that explain why, and turn puzzles into a printable or digital puzzle book with solutions.';

export const ADS_ENABLED = Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);

/** Update when the policies change in substance. */
export const LEGAL_UPDATED = '15 November 2026';
export const LEGAL_UPDATED_ISO = '2026-11-15';
