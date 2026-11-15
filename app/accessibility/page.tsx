import type { Metadata } from 'next';
import LegalPage from '../../components/LegalPage';
import { SITE } from '../../lib/site';

export const metadata: Metadata = { title: `Accessibility statement · ${SITE.name}` };

export default function AccessibilityPage() {
    return (
        <LegalPage title="Accessibility statement">
            <p>
                We want {SITE.name} to be usable by everyone, including people who use screen readers, a keyboard only, magnification, or who need high contrast or reduced motion.
                We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.
            </p>

            <h2>Where we are</h2>
            <p>
                We believe the game and the book builder meet WCAG 2.2 AA, with the limits listed below. This is our own assessment.
                It is based on automated testing (axe-core, no violations found across several themes in light and dark mode), a programmatic contrast check of every colour pair in all 20 theme and mode combinations,
                and keyboard testing. We have <strong>not yet completed testing with screen readers on every platform</strong>, so there may be problems we have not found.
            </p>

            <h2>What we have done</h2>
            <ul>
                <li><strong>Colour and contrast:</strong> text reaches at least 4.5:1 and borders, focus rings and board lines at least 3:1, in every theme, in both light and dark mode. Colour is never the only way to show something: conflicting numbers also get a dashed outline and an icon.</li>
                <li><strong>Keyboard:</strong> everything works without a mouse. The board is an ARIA grid: arrow keys, Home, End, Page Up and Page Down move, 1 to 9 place a number and Backspace erases. A skip link jumps to the main content, and focus is always visible.</li>
                <li><strong>Screen readers:</strong> the board announces each cell&apos;s row, column, value and whether it is a clue or conflicts. Status changes are announced politely. Controls are real buttons, radio buttons and checkboxes with labels.</li>
                <li><strong>Play aids:</strong> undo and redo, pencil notes and hints that explain the reason in words, so you do not have to rely on seeing a highlight. Progress is saved automatically, and the timer only starts once you first touch the board.</li>
                <li><strong>Motion:</strong> animated backgrounds and particle effects are decorative and start off if your device asks for reduced motion. A setting under Display settings turns them off at any time.</li>
                <li><strong>Display:</strong> light, dark or match-your-device appearance, ten themes, text that scales with your browser settings, a layout that reflows on small screens, and support for higher contrast and forced colours modes.</li>
                <li><strong>Puzzle books and exports:</strong> PDFs are tagged, have a title, a language, a bookmark outline and embedded fonts, and every sudoku grid has a full text description. A large print option makes type bigger with one puzzle per page.</li>
            </ul>

            <h2>Known limits</h2>
            <ul>
                <li>The PDFs are built to the structure PDF/UA asks for, but we have not validated them with a formal PDF/UA checker, so we do not claim PDF/UA conformance.</li>
                <li>PNG and JPG exports are images and cannot carry a text description. Use the PDF export if you need one.</li>
                <li>Sudoku is a visual and spatial puzzle. The board can be read and played with a screen reader, but it is a demanding way to play.</li>
                <li>Third-party ads, when you allow them, are supplied by Google and we do not control their accessibility.</li>
                <li>Decorative parts of printed book covers, such as the large background grid, have low contrast on purpose and carry no information.</li>
            </ul>

            <h2>Tell us about a problem</h2>
            <p>
                If something is hard to use, please tell us what you were trying to do, what happened, and what device, browser and assistive technology you used.
                {SITE.contactEmail
                    ? <> Write to <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>. We aim to reply within 5 working days.</>
                    : <> Use the contact details published wherever this site is offered to you. We aim to reply within 5 working days.</>}
            </p>

            <h2>Formal complaints</h2>
            <p>If you are not happy with our reply, you can contact the body that enforces accessibility law where you live, such as the national equality or digital accessibility authority in your country.</p>
        </LegalPage>
    );
}
