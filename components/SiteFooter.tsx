import { SITE } from '../lib/site';
import FooterNav from './FooterNav';

export default function SiteFooter() {
    return (
        <footer className="site-footer panel">
            <FooterNav />
            <p>© {new Date().getFullYear()} {SITE.operator || SITE.name}</p>
        </footer>
    );
}
