import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }) {
  const fontData = await fetch(
    new URL('../../fonts/NotoSansThai-Bold.ttf', import.meta.url)
  ).then(r => r.arrayBuffer());

  let name = 'หอจดหมายเหตุดนตรีไทย';
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/songs?id=eq.${encodeURIComponent(params.id)}&select=name_th`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } }
    );
    const rows = await res.json();
    if (rows?.[0]?.name_th) name = rows[0].name_th;
  } catch {}

  const fontSize = name.length > 20 ? 68 : name.length > 12 ? 88 : 108;

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: '#0F1B2D', padding: '60px 70px', justifyContent: 'space-between',
        borderTop: '10px solid #C9A84C', borderBottom: '10px solid #C9A84C',
        fontFamily: 'NotoThai',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '50%',
            border: '3px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#C9A84C' }} />
          </div>
          <div style={{ color: '#8A9BB5', fontSize: '30px' }}>หอจดหมายเหตุดนตรีไทย · Thai Music Archive</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ color: '#C9A84C', fontSize: '34px' }}>♪ โน้ตเพลง · เล่นเสียงได้จริง</div>
          <div style={{ color: '#F5F0E8', fontSize: `${fontSize}px`, fontWeight: 700, lineHeight: 1.15 }}>
            {name}
          </div>
        </div>
        <div style={{ color: '#4C9A84', fontSize: '26px' }}>thaimusicarchive.com</div>
      </div>
    ),
    { ...size, fonts: [{ name: 'NotoThai', data: fontData, weight: 700 }] }
  );
}
