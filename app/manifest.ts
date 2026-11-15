import type { MetadataRoute } from 'next';
import { SITE, SITE_DESCRIPTION } from '../lib/site';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: `${SITE.name}: play and make puzzle books`,
        short_name: SITE.name,
        description: SITE_DESCRIPTION,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#14213d',
        theme_color: '#14213d',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
    };
}
