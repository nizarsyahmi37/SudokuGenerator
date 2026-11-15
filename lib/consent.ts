/**
 * Visitor choice about advertising.
 *  - essential: no ads, no ad scripts, no ad cookies
 *  - ads:       AdSense may personalise ads
 *  - ads-limited: AdSense is asked to serve non-personalised ads only
 * Nothing about ads is loaded until the visitor picks "ads" or "ads-limited".
 */
export type ConsentChoice = 'essential' | 'ads' | 'ads-limited';

const KEY = 'sudoku-consent';
const EVENT = 'sudoku-consent-change';
const VERSION = 1;

const isChoice = (v: unknown): v is ConsentChoice => v === 'essential' || v === 'ads' || v === 'ads-limited';

export function readConsent(): ConsentChoice | null {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { choice?: unknown; v?: unknown };
        return parsed.v === VERSION && isChoice(parsed.choice) ? parsed.choice : null;
    } catch {
        return null;
    }
}

export function writeConsent(choice: ConsentChoice) {
    try { localStorage.setItem(KEY, JSON.stringify({ choice, v: VERSION, at: new Date().toISOString() })); } catch { /* storage unavailable: the choice lasts for this page only */ }
    window.dispatchEvent(new Event(EVENT));
}

export function subscribeConsent(onChange: () => void) {
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener('storage', onChange); };
}

export const consentAllowsAds = (c: ConsentChoice | null) => c === 'ads' || c === 'ads-limited';
