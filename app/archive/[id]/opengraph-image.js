import { ImageResponse } from 'next/og';
import { createElement as h } from 'react';
import { thaiFont, latinFont } from '../../../lib/ogFonts';
import { fit, clip, COLORS as C } from '../../../lib/og-layout';

export const runtime = 'nodejs';          // ต้องเป็น Node — Intl.Segmenter ต้องใช้ ICU เต็ม
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET = 'archive-images';

async function fetchT(url, opts = {}, ms = 2500) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); }
  finally { clearTimeout(t); }
}

const D = (style, ...children) => h('div', { style: { display: 'flex', ...style } }, ...children);

const PHOTO_W = 452;
const PAD_X = 62;

export function buildTree({ what, who, when, where, photo }) {
  // ขีดยาวเป็นตัวคั่นหัวเรื่องกับคำขยาย — ให้เป็นจุดขึ้นบรรทัดใหม่แทน
  what  = clip(what, 96).replace(/\s*[—–]\s*/g, ' ') || 'หอจดหมายเหตุดนตรีไทย';
  who   = clip(who, 48);
  when  = clip(when, 42);
  where = clip(where, 52);

  const panelW = photo ? 1200 - PHOTO_W : 1200;
  const textW  = panelW - PAD_X * 2;
  const { size: tSize, lines } = fit(what, {
    max: photo ? 58 : 64, min: 30, width: textW, maxLines: 3,
  });
  const lh = Math.round(tSize * 1.3);

  const panel = D(
    { flexDirection: 'column', justifyContent: 'space-between', width: panelW + 'px',
      height: '100%', padding: `52px ${PAD_X}px 46px`, background: C.navy },
    D({ alignItems: 'center', gap: '13px' },
      D({ width: '34px', height: '34px', borderRadius: '50%', border: `3px solid ${C.gold}`,
          alignItems: 'center', justifyContent: 'center' },
        D({ width: '12px', height: '12px', borderRadius: '50%', background: C.gold })),
      D({ color: C.muted, fontSize: '21px', letterSpacing: '0.3px' },
        'หอจดหมายเหตุดนตรีไทย · Thai Music Archive')),
    // flex:1 + จัดกึ่งกลาง กันหัวเรื่องยาวไปชนหัวกระดาษ
    D({ flexDirection: 'column', flex: 1, justifyContent: 'center',
        paddingTop: '26px', paddingBottom: '22px' },
      // วันที่กับผู้เกี่ยวข้องแยกคนละบรรทัดเสมอ — กันตัวคั่นหล่นบรรทัดเวลาชื่อยาว
      D({ flexDirection: 'column', marginBottom: '16px' },
        when ? D({ color: C.gold, fontSize: '25px', lineHeight: '34px' }, when) : D({}),
        who  ? D({ color: C.muted, fontSize: '25px', lineHeight: '34px' }, who) : D({})),
      D({ flexDirection: 'column' },
        ...lines.map((ln, i) =>
          D({ key: 'l' + i, color: C.cream, fontSize: tSize + 'px', fontWeight: 700,
              lineHeight: lh + 'px', height: lh + 'px' }, ln))),
      where
        ? D({ marginTop: '16px', alignItems: 'center', gap: '9px' },
            D({ width: '9px', height: '9px', background: C.jade, transform: 'rotate(45deg)' }),
            D({ color: C.jade, fontSize: '24px' }, where))
        : D({})),
    D({ color: C.muted, fontSize: '20px', letterSpacing: '0.6px', marginTop: '18px' },
      'thaimusicarchive.com'),
  );

  return D(
    { width: '100%', height: '100%', background: C.navy, fontFamily: 'NotoThai',
      borderTop: `9px solid ${C.gold}`, borderBottom: `9px solid ${C.gold}` },
    panel,
    photo
      ? D({ width: PHOTO_W + 'px', height: '100%', position: 'relative',
            borderLeft: `3px solid ${C.gold}` },
          h('img', { src: photo, width: PHOTO_W, height: 612,
            style: { width: PHOTO_W + 'px', height: '612px', objectFit: 'cover' } }))
      : D({}),
  );
}

export default async function OgImage({ params }) {
  let what = '', who = '', when = '', where = '', photo = null;

  try {
    const res = await fetchT(
      `${SB}/rest/v1/archive_records?id=eq.${encodeURIComponent(params.id)}&select=what_text,who_text,when_text,where_text`,
      { headers: { apikey: KEY } });
    const rows = await res.json();
    if (rows?.[0]) {
      what = rows[0].what_text || ''; who = rows[0].who_text || '';
      when = rows[0].when_text || ''; where = rows[0].where_text || '';
    }
    const mres = await fetchT(
      `${SB}/rest/v1/archive_media?record_id=eq.${encodeURIComponent(params.id)}&media_type=eq.image&select=id,storage_path&order=id.asc&limit=4`,
      { headers: { apikey: KEY } });
    const media = await mres.json();

    // ดึงผ่าน render/image ให้ Supabase ย่อรูปให้ก่อน (เหลือ ~150 KB)
    // ถ้าดึงไฟล์ต้นฉบับ รูปจากกล้อง 2–5 MB จะช้าและถูกข้าม → การ์ดแชร์ไม่มีรูป
    const urlsFor = p => [
      `${SB}/storage/v1/render/image/public/${BUCKET}/${p}?width=904&height=1224&resize=cover&quality=72`,
      `${SB}/storage/v1/object/public/${BUCKET}/${p}`,
    ];
    for (const m of (Array.isArray(media) ? media : [])) {
      if (!m?.storage_path) continue;
      for (const url of urlsFor(m.storage_path)) {
        try {
          const r = await fetchT(url, {}, 6000);
          if (!r.ok) continue;
          const ct = (r.headers.get('content-type') || '').split(';')[0];
          if (!/^image\/(jpeg|png|webp|avif)/.test(ct)) continue;
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length > 5 * 1024 * 1024) continue;
          photo = `data:${ct};base64,${buf.toString('base64')}`;
          break;
        } catch { /* ลิงก์นี้ไม่ได้ ลองแบบถัดไป */ }
      }
      if (photo) break;
    }
  } catch {}

  const opts = {
    ...size,
    headers: { 'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800' },
    fonts: [
      { name: 'NotoThai', data: thaiFont, weight: 700, style: 'normal' },
      { name: 'Latin', data: latinFont, weight: 700, style: 'normal' },
    ],
  };
  try {
    return new ImageResponse(buildTree({ what, who, when, where, photo }), opts);
  } catch (e) {
    // กันพลาด: ฝังรูปไม่สำเร็จ ยังต้องได้ภาพแชร์แบบข้อความล้วน
    return new ImageResponse(buildTree({ what, who, when, where, photo: null }), opts);
  }
}
