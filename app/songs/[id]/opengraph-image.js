import { ImageResponse } from 'next/og';
import { createElement as h } from 'react';
import { thaiFont, latinFont } from '../../../lib/ogFonts';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const D = (style, ...children) =>
  h('div', { style: { display: 'flex', ...style } }, ...children);

export default async function OgImage({ params }) {
  let name = 'หอจดหมายเหตุดนตรีไทย';
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/songs?id=eq.${encodeURIComponent(params.id)}&select=name_th`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } }
    );
    const rows = await res.json();
    if (rows?.[0]?.name_th) name = rows[0].name_th;
  } catch {}

  const fontSize = name.length > 26 ? 76 : name.length > 18 ? 96 : name.length > 10 ? 120 : 142;

  const tree = D(
    { width: '100%', height: '100%', flexDirection: 'column',
      background: '#0F1B2D', padding: '60px 70px', justifyContent: 'space-between',
      borderTop: '10px solid #C9A84C', borderBottom: '10px solid #C9A84C',
      fontFamily: 'NotoThai' },
    D({ alignItems: 'center', gap: '18px' },
      D({ width: '46px', height: '46px', borderRadius: '50%', border: '3px solid #C9A84C',
          alignItems: 'center', justifyContent: 'center' },
        D({ width: '16px', height: '16px', borderRadius: '50%', background: '#C9A84C' })),
      D({ color: '#8A9BB5', fontSize: '30px' }, 'หอจดหมายเหตุดนตรีไทย · Thai Music Archive')),
    D({ flexDirection: 'column' },
      D({ color: '#C9A84C', fontSize: '32px', marginBottom: '6px' }, 'โน้ตเพลง · เล่นเสียงได้จริง'),
      D({ color: '#F5F0E8', fontSize: `${fontSize}px`, fontWeight: 700, lineHeight: 1.12 }, name),
      D({ width: '160px', height: '7px', background: '#C9A84C', marginTop: '18px' })),
    D({ color: '#4C9A84', fontSize: '26px' }, 'thaimusicarchive.com')
  );

  return new ImageResponse(tree, {
    ...size,
    fonts: [
      { name: 'NotoThai', data: thaiFont, weight: 700, style: 'normal' },
      { name: 'Latin', data: latinFont, weight: 700, style: 'normal' },
    ],
  });
}
