import { ImageResponse } from 'next/og';
import { createElement as h } from 'react';
import { thaiFont, latinFont } from '../../../lib/ogFonts';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// ดึงข้อมูลแบบมีเวลาจำกัด — ถ้าช้าเกินให้ปล่อยผ่าน จะได้สร้างภาพทันก่อนตัวดึงข้อมูลหมดเวลา
async function fetchT(url, opts = {}, ms = 2500) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); }
  finally { clearTimeout(t); }
}

const D = (style, ...children) =>
  h('div', { style: { display: 'flex', ...style } }, ...children);

export default async function OgImage({ params }) {
  let what = 'หอจดหมายเหตุดนตรีไทย', who = '', when = '', where = '';
  let photo = null;

  try {
    const res = await fetchT(
      `${SB}/rest/v1/archive_records?id=eq.${encodeURIComponent(params.id)}&select=what_text,who_text,when_text,where_text`,
      { headers: { apikey: KEY } }
    );
    const rows = await res.json();
    if (rows?.[0]) {
      what = rows[0].what_text || what; who = rows[0].who_text || '';
      when = rows[0].when_text || ''; where = rows[0].where_text || '';
    }
    const mres = await fetchT(
      `${SB}/rest/v1/archive_media?record_id=eq.${encodeURIComponent(params.id)}&media_type=eq.image&select=id,storage_path&order=id.asc&limit=4`,
      { headers: { apikey: KEY } }
    );
    const media = await mres.json();
    // ไล่ทีละรูปจนกว่าจะได้รูปที่ขนาดเหมาะกับการฝังในภาพแชร์
    for (const m of (Array.isArray(media) ? media : [])) {
      if (!m?.storage_path) continue;
      try {
        const imgRes = await fetchT(`${SB}/storage/v1/object/public/archive-images/${m.storage_path}`, {}, 3500);
        if (!imgRes.ok) continue;
        const buf = Buffer.from(await imgRes.arrayBuffer());
        if (buf.length > 1.6 * 1024 * 1024) continue;   // ใหญ่ไป ข้ามไปรูปถัดไป
        const ct = imgRes.headers.get('content-type') || 'image/jpeg';
        if (!/^image\/(jpeg|png|webp)/.test(ct)) continue;
        photo = `data:${ct};base64,${buf.toString('base64')}`;
        break;
      } catch { /* รูปนี้ใช้ไม่ได้ ลองรูปถัดไป */ }
    }
  } catch {}

  const clip = (t, n) => { t = (t ?? '').trim(); return t.length > n ? t.slice(0, n - 1).trim() + '…' : t; };
  what = clip(what, 58); who = clip(who, 42); when = clip(when, 30); where = clip(where, 40);

  const whatSize = photo
    ? (what.length > 44 ? 38 : what.length > 30 ? 46 : what.length > 16 ? 56 : 68)
    : (what.length > 44 ? 42 : what.length > 30 ? 50 : what.length > 16 ? 62 : 78);

  const build = (photo) => {
  const textCol = D(
    { flexDirection: 'column', justifyContent: 'space-between', flex: 1, height: '100%',
      padding: photo ? '64px 72px 60px' : '64px 84px 60px' },
    D({ alignItems: 'center', gap: '14px' },
      D({ width: '38px', height: '38px', borderRadius: '50%', border: '3px solid #C9A84C',
          alignItems: 'center', justifyContent: 'center' },
        D({ width: '13px', height: '13px', borderRadius: '50%', background: '#C9A84C' })),
      D({ color: '#8A9BB5', fontSize: '24px' }, 'หอจดหมายเหตุดนตรีไทย · Thai Music Archive')),
    D({ flexDirection: 'column' },
      when ? D({ color: '#C9A84C', fontSize: '28px', marginBottom: '8px' }, when) : D({}),
      who ? D({ color: '#8A9BB5', fontSize: '30px', marginBottom: '10px' }, who) : D({}),
      D({ color: '#F5F0E8', fontSize: `${whatSize}px`, fontWeight: 700, lineHeight: 1.22, maxWidth: '100%' }, what),
      where ? D({ color: '#4C9A84', fontSize: '28px', marginTop: '12px' }, '◆ ' + where) : D({})),
    D({ color: '#8A9BB5', fontSize: '22px' }, 'thaimusicarchive.com')
  );

  return D(
    { width: '100%', height: '100%', position: 'relative', background: '#0F1B2D',
      borderTop: '10px solid #C9A84C', borderBottom: '10px solid #C9A84C',
      fontFamily: 'NotoThai' },
    ...(photo ? [
      h('img', { key: 'p', src: photo, width: 1200, height: 630,
        style: { position: 'absolute', top: 0, left: 0, width: '1200px', height: '630px', objectFit: 'cover' } }),
      D({ position: 'absolute', top: 0, left: 0, width: '1200px', height: '630px',
          background: 'linear-gradient(90deg, rgba(9,17,30,0.97) 0%, rgba(9,17,30,0.93) 42%, rgba(9,17,30,0.55) 72%, rgba(9,17,30,0.30) 100%)' }),
      D({ position: 'relative', width: '760px', height: '630px' }, textCol),
    ] : [textCol])
  );
  };
  const tree = build(photo);

  const opts = {
    ...size,
    headers: { 'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800' },
    fonts: [
      { name: 'NotoThai', data: thaiFont, weight: 700, style: 'normal' },
      { name: 'Latin', data: latinFont, weight: 700, style: 'normal' },
    ],
  };
  try {
    return new ImageResponse(tree, opts);
  } catch (e) {
    // กันพลาด: ถ้าฝังรูปไม่สำเร็จ ยังต้องได้ภาพแชร์แบบข้อความล้วน
    return new ImageResponse(build(null), opts);
  }
}
