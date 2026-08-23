import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }) {
  const fontData = await fetch(
    new URL('../../fonts/NotoSansThai-Bold.ttf', import.meta.url)
  ).then(r => r.arrayBuffer());

  let what = 'หอจดหมายเหตุดนตรีไทย', who = '', when = '', where = '';
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/archive_records?id=eq.${encodeURIComponent(params.id)}&select=what_text,who_text,when_text,where_text`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } }
    );
    const rows = await res.json();
    if (rows?.[0]) {
      what = rows[0].what_text; who = rows[0].who_text;
      when = rows[0].when_text; where = rows[0].where_text;
    }
  } catch {}

  const whatSize = what.length > 34 ? 54 : what.length > 18 ? 70 : 88;

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: '#0F1B2D', padding: '54px 70px', justifyContent: 'space-between',
        borderTop: '10px solid #C9A84C', borderBottom: '10px solid #C9A84C',
        fontFamily: 'NotoThai',
      }}>
        {/* หัว: โลโก้เว็บ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '50%',
            border: '3px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#C9A84C' }} />
          </div>
          <div style={{ color: '#8A9BB5', fontSize: '28px' }}>หอจดหมายเหตุดนตรีไทย · Thai Music Archive</div>
        </div>

        {/* เนื้อหา: เมื่อไหร่ (เล็ก) → ใคร → ทำอะไร (เด่น) → ที่ไหน */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ color: '#C9A84C', fontSize: '30px' }}>🕰 {when}</div>
          <div style={{ color: '#8A9BB5', fontSize: '40px' }}>{who}</div>
          <div style={{ color: '#F5F0E8', fontSize: `${whatSize}px`, fontWeight: 700, lineHeight: 1.15 }}>
            {what}
          </div>
          <div style={{ color: '#4C9A84', fontSize: '34px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            📍 {where}
          </div>
        </div>

        {/* ท้าย */}
        <div style={{ color: '#8A9BB5', fontSize: '24px', opacity: 0.8 }}>thaimusicarchive.com</div>
      </div>
    ),
    { ...size, fonts: [{ name: 'NotoThai', data: fontData, weight: 700 }] }
  );
}
