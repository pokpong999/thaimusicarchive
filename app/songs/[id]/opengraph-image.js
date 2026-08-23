import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }) {
  const [thaiFont, latinFont] = await Promise.all([
    readFile(path.join(process.cwd(), 'assets', 'NotoSansThai-Bold.ttf')),
    readFile(path.join(process.cwd(), 'assets', 'LatinBold.ttf')),
  ]);

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
  const D = (style, ...children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children } });

  const tree = D(
    { width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: '#0F1B2D', padding: '60px 70px', justifyContent: 'space-between',
      borderTop: '10px solid #C9A84C', borderBottom: '10px solid #C9A84C',
      fontFamily: 'NotoThai, Latin' },
    D({ display: 'flex', alignItems: 'center', gap: '18px' },
      D({ width: '46px', height: '46px', borderRadius: '50%', border: '3px solid #C9A84C',
          display: 'flex', alignItems: 'center', justifyContent: 'center' },
        D({ width: '16px', height: '16px', borderRadius: '50%', background: '#C9A84C' })),
      D({ color: '#8A9BB5', fontSize: '30px' }, 'หอจดหมายเหตุดนตรีไทย - Thai Music Archive')),
    D({ display: 'flex', flexDirection: 'column', gap: '10px' },
      D({ color: '#C9A84C', fontSize: '34px' }, 'โน้ตเพลง - เล่นเสียงได้จริง'),
      D({ color: '#F5F0E8', fontSize: `${fontSize}px`, fontWeight: 700, lineHeight: 1.15 }, name)),
    D({ color: '#4C9A84', fontSize: '26px' }, 'thaimusicarchive.com')
  );

  const svg = await satori(tree, {
    width: size.width, height: size.height,
    fonts: [
      { name: 'NotoThai', data: thaiFont, weight: 700 },
      { name: 'Latin', data: latinFont, weight: 700 },
    ],
  });
  const png = new Resvg(svg).render().asPng();
  return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' } });
}
