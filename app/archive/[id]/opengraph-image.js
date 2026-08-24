import { ImageResponse } from 'next/og';
import { createElement as h } from 'react';
import { thaiFont, latinFont } from '../../../lib/ogFonts';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const D = (style, ...children) =>
  h('div', { style: { display: 'flex', ...style } }, ...children);

export default async function OgImage({ params }) {
  let what = 'หอจดหมายเหตุดนตรีไทย', who = '', when = '', where = '';
  let photo = null;

  try {
    const res = await fetch(
      `${SB}/rest/v1/archive_records?id=eq.${encodeURIComponent(params.id)}&select=what_text,who_text,when_text,where_text`,
      { headers: { apikey: KEY } }
    );
    const rows = await res.json();
    if (rows?.[0]) {
      what = rows[0].what_text || what; who = rows[0].who_text || '';
      when = rows[0].when_text || ''; where = rows[0].where_text || '';
    }
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
    ? (what.length > 34 ? 50 : what.length > 18 ? 64 : 78)
    : (what.length > 34 ? 54 : what.length > 18 ? 70 : 88);

  const textCol = D(
    { flexDirection: 'column', justifyContent: 'space-between', flex: 1, height: '100%',
      padding: photo ? '48px 54px' : '54px 70px' },
    D({ alignItems: 'center', gap: '14px' },
      D({ width: '38px', height: '38px', borderRadius: '50%', border: '3px solid #C9A84C',
          alignItems: 'center', justifyContent: 'center' },
        D({ width: '13px', height: '13px', borderRadius: '50%', background: '#C9A84C' })),
      D({ color: '#8A9BB5', fontSize: '24px' }, 'หอจดหมายเหตุดนตรีไทย · Thai Music Archive')),
    D({ flexDirection: 'column' },
      when ? D({ color: '#C9A84C', fontSize: '28px', marginBottom: '8px' }, when) : D({}),
      who ? D({ color: '#8A9BB5', fontSize: '34px', marginBottom: '10px' }, who) : D({}),
      D({ color: '#F5F0E8', fontSize: `${whatSize}px`, fontWeight: 700, lineHeight: 1.15 }, what),
      where ? D({ color: '#4C9A84', fontSize: '28px', marginTop: '12px' }, '◆ ' + where) : D({})),
    D({ color: '#8A9BB5', fontSize: '22px' }, 'thaimusicarchive.com')
  );

  const tree = D(
    { width: '100%', height: '100%', position: 'relative', background: '#0F1B2D',
      borderTop: '10px solid #C9A84C', borderBottom: '10px solid #C9A84C',
      fontFamily: 'NotoThai' },
    ...(photo ? [
      h('img', { key: 'p', src: photo, width: 1200, height: 630,
        style: { position: 'absolute', top: 0, left: 0, width: '1200px', height: '630px', objectFit: 'cover' } }),
      D({ position: 'absolute', top: 0, left: 0, width: '1200px', height: '630px',
          background: 'linear-gradient(90deg, rgba(9,17,30,0.97) 0%, rgba(9,17,30,0.93) 42%, rgba(9,17,30,0.55) 72%, rgba(9,17,30,0.30) 100%)' }),
      D({ position: 'relative', width: '790px', height: '630px' }, textCol),
    ] : [textCol])
  );

  return new ImageResponse(tree, {
    ...size,
    fonts: [
      { name: 'NotoThai', data: thaiFont, weight: 700, style: 'normal' },
      { name: 'Latin', data: latinFont, weight: 700, style: 'normal' },
    ],
  });
}
