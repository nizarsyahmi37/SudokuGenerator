import type { MetadataRoute } from 'next';
import { BASE_URL, LEGAL_UPDATED_ISO } from '../lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
    const policyDate = new Date(`${LEGAL_UPDATED_ISO}T00:00:00Z`);
    return [
        { url: `${BASE_URL}/`, changeFrequency: 'weekly', priority: 1 },
        { url: `${BASE_URL}/privacy`, lastModified: policyDate, changeFrequency: 'yearly', priority: 0.3 },
        { url: `${BASE_URL}/accessibility`, lastModified: policyDate, changeFrequency: 'yearly', priority: 0.3 },
    ];
}
