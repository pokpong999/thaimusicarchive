import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }) {
  const [thaiFont, latinFont] = await Promise.all([
    readFile(fileURLToPath(new URL('./NotoSansThai-Bold.ttf', import.meta.url))),
    readFile(fileURLToPath(new URL('./LatinBold.ttf', import.meta.url))),
  ]);

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
  const D = (style, ...children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children } });

  const tree = D(
    { width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: '#0F1B2D', padding: '54px 70px', justifyContent: 'space-between',
      borderTop: '10px solid #C9A84C', borderBottom: '10px solid #C9A84C',
      fontFamily: 'NotoThai, Latin' },
    D({ display: 'flex', alignItems: 'center', gap: '16px' },
      D({ width: '42px', height: '42px', borderRadius: '50%', border: '3px solid #C9A84C',
          display: 'flex', alignItems: 'center', justifyContent: 'center' },
        D({ width: '14px', height: '14px', borderRadius: '50%', background: '#C9A84C' })),
      D({ color: '#8A9BB5', fontSize: '28px' }, 'หอจดหมายเหตุดนตรีไทย - Thai Music Archive')),
    D({ display: 'flex', flexDirection: 'column', gap: '14px' },
      D({ color: '#C9A84C', fontSize: '30px' }, when),
      D({ color: '#8A9BB5', fontSize: '40px' }, who),
      D({ color: '#F5F0E8', fontSize: `${whatSize}px`, fontWeight: 700, lineHeight: 1.15 }, what),
      D({ display: 'flex', alignItems: 'center', gap: '12px' },
        D({ width: '14px', height: '14px', borderRadius: '50% 50% 50% 0',
            background: '#4C9A84', transform: 'rotate(-45deg)' }),
        D({ color: '#4C9A84', fontSize: '34px' }, where))),
    D({ color: '#8A9BB5', fontSize: '24px', opacity: 0.8 }, 'thaimusicarchive.com')
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
