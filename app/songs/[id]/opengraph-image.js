import { ImageResponse } from 'next/og';
import { createElement as h } from 'react';
import { thaiFont, latinFont } from '../../../lib/ogFonts';
import { fit, clip, COLORS as C } from '../../../lib/og-layout';

export const runtime = 'nodejs';          // ต้องเป็น Node — Intl.Segmenter ต้องใช้ ICU เต็ม
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function fetchT(url, opts = {}, ms = 2500) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); }
  finally { clearTimeout(t); }
}

const D = (style, ...children) => h('div', { style: { display: 'flex', ...style } }, ...children);

export function buildTree({ name, type, style, verses }) {
  name = clip(name, 72) || 'หอจดหมายเหตุดนตรีไทย';
  const PAD = 84;
  const { size: tSize, lines } = fit(name, {
    max: 96, min: 40, width: 1200 - PAD * 2, maxLines: 3,
  });
  const lh = Math.round(tSize * 1.26);

  const tags = [type, style].filter(Boolean).map(t => clip(t, 30));

  return D(
    { width: '100%', height: '100%', flexDirection: 'column', background: C.navy,
      padding: `56px ${PAD}px 52px`, justifyContent: 'space-between',
      borderTop: '10px solid ' + C.gold, borderBottom: '10px solid ' + C.gold,
      fontFamily: 'NotoThai' },
    D({ alignItems: 'center', gap: '15px' },
      D({ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid ' + C.gold,
          alignItems: 'center', justifyContent: 'center' },
        D({ width: '14px', height: '14px', borderRadius: '50%', background: C.gold })),
      D({ color: C.muted, fontSize: '25px' }, 'หอจดหมายเหตุดนตรีไทย · Thai Music Archive')),

    D({ flexDirection: 'column', flex: 1, justifyContent: 'center',
        paddingTop: '18px', paddingBottom: '18px' },
      D({ color: C.gold, fontSize: '28px', marginBottom: '14px' }, 'โน้ตเพลง · เล่นเสียงได้จริง'),
      D({ flexDirection: 'column' },
        ...lines.map((ln, i) =>
          D({ key: 'l' + i, color: C.cream, fontSize: tSize + 'px', fontWeight: 700,
              lineHeight: lh + 'px', height: lh + 'px' }, ln))),
      // ชื่อยาว 3 บรรทัดแล้วพื้นที่ไม่พอ — ตัดเส้นคั่นออกดีกว่าปล่อยให้ชนป้ายด้านล่าง
      lines.length <= 2
        ? D({ width: '150px', height: '6px', background: C.gold, marginTop: '20px' })
        : D({})),

    D({ alignItems: 'center', gap: '14px' },
      ...tags.map((t, i) => D({ key: 't' + i, color: C.jade, fontSize: '24px',
        border: '1px solid rgba(76,154,132,0.55)', borderRadius: '6px', padding: '4px 14px' }, t)),
      verses ? D({ color: C.muted, fontSize: '24px' }, verses + ' วรรค') : D({}),
      D({ flex: 1 }),
      D({ color: C.muted, fontSize: '22px' }, 'thaimusicarchive.com')),
  );
}

export default async function OgImage({ params }) {
  let row = null;
  try {
    const res = await fetchT(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/songs?id=eq.${encodeURIComponent(params.id)}&select=name_th,type,style,total_verses`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } });
    const rows = await res.json();
    row = rows?.[0] ?? null;
  } catch {}

  return new ImageResponse(buildTree({
    name: row?.name_th ?? '', type: row?.type ?? '', style: row?.style ?? '',
    verses: row?.total_verses ?? null,
  }), {
    ...size,
    headers: { 'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800' },
    fonts: [
      { name: 'NotoThai', data: thaiFont, weight: 700, style: 'normal' },
      { name: 'Latin', data: latinFont, weight: 700, style: 'normal' },
    ],
  });
}
