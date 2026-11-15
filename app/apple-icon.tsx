import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
    return new ImageResponse(
        (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#14213d' }}>
                <div style={{ width: 132, height: 132, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '8px solid #fca311', borderRadius: 10, color: '#fff', fontSize: 96, fontWeight: 700 }}>9</div>
            </div>
        ),
        size,
    );
}
