import type { Metadata } from 'next';
import LegalPage from '../../components/LegalPage';
import { ADS_ENABLED, SITE } from '../../lib/site';

export const metadata: Metadata = { title: `Privacy and cookie policy · ${SITE.name}` };

export default function PrivacyPage() {
    const who = SITE.operator || `the operator of ${SITE.name}`;
    return (
        <LegalPage title="Privacy and cookie policy">
            <p>
                This policy explains what information {SITE.name} handles when you play sudoku, build puzzle books or export puzzles.
                In short: the game runs in your browser, there are no accounts, and {ADS_ENABLED ? 'ads are shown only if you agree to them' : 'no advertising is currently shown'}.
            </p>

            <h2>Who is responsible</h2>
            <p>
                {who} is responsible for this site.
                {SITE.contactEmail
                    ? <> You can contact us at <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.</>
                    : <> Contact details are published wherever this site is offered to you.</>}
            </p>

            <h2>What stays on your device</h2>
            <ul>
                <li>Puzzles are generated in your browser. Your moves, timer and hints are never sent to us.</li>
                <li>Puzzle books and exported boards (PDF, PNG, JPG) are created on your device, in a background process of your browser, and saved by you. We never receive them.</li>
                <li>We run no analytics and no tracking of what you play or build.</li>
            </ul>

            <h2>Cookies and similar storage</h2>
            <p>The site stores a few small items in your browser&apos;s local storage. They are not shared with anyone and are not used to track you.</p>
            <table>
                <caption className="sr-only">Items stored in your browser</caption>
                <thead><tr><th scope="col">Name</th><th scope="col">Purpose</th><th scope="col">Lasts</th></tr></thead>
                <tbody>
                    <tr><th scope="row">sudoku-theme, sudoku-mode</th><td>Remembers your theme and your light or dark choice.</td><td>Until you clear site data</td></tr>
                    <tr><th scope="row">sudoku-effects</th><td>Remembers whether animated backgrounds are on.</td><td>Until you clear site data</td></tr>
                    {ADS_ENABLED && <tr><th scope="row">sudoku-consent</th><td>Remembers your choice about ads, so we do not ask again on every visit.</td><td>Until you clear site data or change it</td></tr>}
                </tbody>
            </table>
            <p>These items only store your preferences, so they do not need your consent. You can delete them at any time in your browser settings.</p>

            <h2>Advertising</h2>
            {ADS_ENABLED ? (
                <>
                    <p>
                        This site can show ads from Google AdSense. Google and its partners may use cookies and similar identifiers to deliver and measure ads,
                        and, if you allow it, to personalise them. <strong>No ad script is loaded, and no ad cookie is set, until you choose.</strong>
                    </p>
                    <ul>
                        <li><strong>Allow ads:</strong> ads may be personalised.</li>
                        <li><strong>Non-personalised ads only:</strong> ads are not based on your past browsing, though Google may still use some information, for example to limit repeated ads or to prevent fraud.</li>
                        <li><strong>No ads:</strong> nothing from advertisers is loaded.</li>
                    </ul>
                    <p>
                        You can change your choice at any time with <strong>Privacy choices</strong> in the footer. If you withdraw consent, the page reloads so that no further ad requests are made.
                        In some regions (for example the EEA, the UK and Switzerland) Google may also show its own consent message, which applies in addition to ours.
                    </p>
                    <p>More about how Google uses data from sites like this one:</p>
                    <ul>
                        <li><a href="https://policies.google.com/technologies/partner-sites">How Google uses information from sites or apps that use its services</a></li>
                        <li><a href="https://adssettings.google.com">Google Ads Settings</a></li>
                        <li><a href="https://www.aboutads.info/choices/">Digital Advertising Alliance choices</a> and <a href="https://www.youronlinechoices.com/">Your Online Choices</a></li>
                    </ul>
                </>
            ) : (
                <p>This site currently shows no advertising and sets no advertising cookies. If that changes, this policy will be updated first and you will be asked before any ad code is loaded.</p>
            )}

            <h2>Server logs</h2>
            <p>Like most websites, the service that hosts this site may keep technical logs (such as IP address, browser type and the time of a request) for security and reliability. We do not use them to identify you.</p>

            <h2>Your rights</h2>
            <p>
                Depending on where you live (for example under the GDPR, the UK GDPR, the CCPA or Malaysia&apos;s PDPA), you may have rights to access, correct, delete or restrict the use of your personal data,
                to object to it, and to withdraw consent at any time. Because the game keeps your data on your own device, most of this is in your hands: clear your browser&apos;s site data.
                For anything else, contact us using the details above. You may also complain to your local data protection authority.
            </p>

            <h2>Children</h2>
            <p>This site is a general puzzle game and is not directed at children under 13. We do not knowingly collect personal information from children.</p>

            <h2>Changes</h2>
            <p>If we change this policy in a meaningful way, we will update the date above and, where the change affects advertising, ask for your choice again.</p>
        </LegalPage>
    );
}
