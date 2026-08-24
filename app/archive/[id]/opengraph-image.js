import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { thaiFont, latinFont } from '../../../lib/ogFonts';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function OgImage({ params }) {
  let what = 'หอจดหมายเหตุดนตรีไทย', who = '', when = '', where = '';
  let photo = null; // data URI

  try {
    const res = await fetch(
      `${SB}/rest/v1/archive_records?id=eq.${encodeURIComponent(params.id)}&select=what_text,who_text,when_text,where_text`,
      { headers: { apikey: KEY } }
    );
    const rows = await res.json();
    if (rows?.[0]) {
      what = rows[0].what_text; who = rows[0].who_text;
      when = rows[0].when_text; where = rows[0].where_text;
    }
    // รูปแรกของเหตุการณ์
    const mres = await fetch(
      `${SB}/rest/v1/archive_media?record_id=eq.${encodeURIComponent(params.id)}&media_type=eq.image&select=storage_path&limit=1`,
      { headers: { apikey: KEY } }
    );
    const media = await mres.json();
    if (media?.[0]?.storage_path) {
      const imgRes = await fetch(`${SB}/storage/v1/object/public/archive-images/${media[0].storage_path}`);
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer());
        if (buf.length < 4 * 1024 * 1024) {
          const ct = imgRes.headers.get('content-type') || 'image/jpeg';
          photo = `data:${ct};base64,${buf.toString('base64')}`;
        }
      }
    }
  } catch {}

  const whatSize = photo
    ? (what.length > 30 ? 44 : what.length > 16 ? 56 : 68)
    : (what.length > 34 ? 54 : what.length > 18 ? 70 : 88);
  const D = (style, ...children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children } });

  const textCol = D(
    { flexDirection: 'column', justifyContent: 'space-between', flex: 1,
      padding: photo ? '48px 54px 44px 54px' : '54px 70px' },
    D({ alignItems: 'center', gap: '14px' },
      D({ width: '38px', height: '38px', borderRadius: '50%', border: '3px solid #C9A84C',
          alignItems: 'center', justifyContent: 'center' },
        D({ width: '13px', height: '13px', borderRadius: '50%', background: '#C9A84C' })),
      D({ color: '#8A9BB5', fontSize: photo ? '22px' : '28px' }, 'หอจดหมายเหตุดนตรีไทย - Thai Music Archive')),
    D({ flexDirection: 'column', gap: '12px' },
      D({ color: '#C9A84C', fontSize: photo ? '26px' : '30px' }, when),
      D({ color: '#8A9BB5', fontSize: photo ? '32px' : '40px' }, who),
      D({ color: '#F5F0E8', fontSize: `${whatSize}px`, fontWeight: 700, lineHeight: 1.15 }, what),
      D({ alignItems: 'center', gap: '10px' },
        D({ width: '13px', height: '13px', borderRadius: '50% 50% 50% 0',
            background: '#4C9A84', transform: 'rotate(-45deg)' }),
        D({ color: '#4C9A84', fontSize: photo ? '26px' : '34px' }, where))),
    D({ color: '#8A9BB5', fontSize: '22px', opacity: 0.8 }, 'thaimusicarchive.com')
  );

  const tree = D(
    { width: '100%', height: '100%', background: '#0F1B2D',
      borderTop: '10px solid #C9A84C', borderBottom: '10px solid #C9A84C' },
    ...(photo ? [
      { type: 'img', props: { src: photo, width: 470, height: 610,
        style: { objectFit: 'cover', width: '470px', height: '610px' } } },
      textCol,
    ] : [textCol])
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
