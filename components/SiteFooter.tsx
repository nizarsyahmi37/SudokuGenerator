import Link from 'next/link';
import { ADS_ENABLED, SITE } from '../lib/site';
import PrivacyChoicesButton from './PrivacyChoicesButton';

export default function SiteFooter() {
    return (
        <footer className="site-footer">
            <nav aria-label="Legal and help">
                <ul>
                    <li><Link href="/privacy">Privacy and cookies</Link></li>
                    <li><Link href="/accessibility">Accessibility</Link></li>
                    {ADS_ENABLED && <li><PrivacyChoicesButton /></li>}
                </ul>
            </nav>
            <p>© {new Date().getFullYear()} {SITE.operator || SITE.name}</p>
        </footer>
    );
}
