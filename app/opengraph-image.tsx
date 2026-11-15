import { ImageResponse } from 'next/og';
import { SITE } from '../lib/site';

export const alt = `${SITE.name}: play sudoku and make puzzle books`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const DIGITS = ['5', '3', '', '', '7', '', '', '', '', '6', '', '', '1', '9', '5', '', '', '', '', '9', '8', '', '', '', '', '6', ''];

export default function Image() {
    return new ImageResponse(
        (
            <div style={{ width: '100%', height: '100%', display: 'flex', background: '#14213d', color: '#fff', padding: 64 }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, paddingRight: 48 }}>
                    <div style={{ fontSize: 28, letterSpacing: 8, color: '#fca311', fontWeight: 700 }}>PLAY · LEARN · PRINT</div>
                    <div style={{ fontSize: 96, fontWeight: 800, marginTop: 16, lineHeight: 1.05 }}>{SITE.name}</div>
                    <div style={{ fontSize: 34, marginTop: 24, color: '#e5e5e5', lineHeight: 1.35 }}>Ten levels graded by technique, hints that explain why, and printable puzzle books.</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', width: 450, height: 450, alignSelf: 'center', border: '6px solid #fca311' }}>
                    {Array.from({ length: 81 }, (_, i) => (
                        <div key={i} style={{ width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, borderRight: i % 3 === 2 ? '3px solid #fca311' : '1px solid #4a5a82', borderBottom: Math.floor(i / 9) % 3 === 2 ? '3px solid #fca311' : '1px solid #4a5a82' }}>
                            {DIGITS[(i * 7) % DIGITS.length]}
                        </div>
                    ))}
                </div>
            </div>
        ),
        size,
    );
}
