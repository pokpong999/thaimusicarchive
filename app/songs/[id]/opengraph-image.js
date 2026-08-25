import { ImageResponse } from 'next/og';
import { createElement as h } from 'react';
import { thaiFont, latinFont } from '../../../lib/ogFonts';

// ═══ เครื่องจัดบรรทัดข้อความไทย (ฝังในไฟล์นี้เลย — ไม่ต้องมี lib/og-layout.js) ═══
//
// ปัญหาที่แก้: ภาพแชร์เดิมปล่อยให้ตัวเรนเดอร์ตัดบรรทัดเอง ภาษาไทยไม่มีช่องว่าง
// ระหว่างคำ ผลคือขาดกลางคำ เช่น "เผยแพร่วัฒนธรรมดนตรีม / อญ" ซึ่งดูไม่เป็นมืออาชีพ
//
// วิธีทำงาน
//   1. ใช้ Intl.Segmenter('th') หาขอบเขตคำ (ICU มีพจนานุกรมไทยในตัว · ต้องรันบน Node)
//   2. ให้คะแนน "ความน่าตัด" ของแต่ละรอยต่อ — ตัดตรงช่องว่างหรือหลังคำเชื่อมดีที่สุด
//      ตัดกลางคำประสมแย่ที่สุด
//   3. เลือกชุดจุดตัดที่รวมโทษต่ำสุดด้วย dynamic programming (แนวเดียวกับ TeX)
//   4. ลองหลายขนาดตัวอักษร แล้วเลือกขนาดที่ได้สมดุลระหว่าง "ตัวใหญ่" กับ "จุดตัดสวย"

const ZERO = /[ัิ-ฺ็-๎]/;   // สระบน-ล่าง วรรณยุกต์ ไม่กินความกว้าง
const LEAD = /[เ-ไ]/;                       // เ แ โ ใ ไ — ห้ามตัดหลังตัวนี้
const NOSTART = /[ๆฯ๚๛)\]}"',.!?:;]/;  // ห้ามขึ้นบรรทัดด้วยตัวนี้
const THAI = /[฀-๿]/;

// คำเชื่อม/บุพบท — ขึ้นบรรทัดใหม่ถัดจากคำพวกนี้ได้เป็นธรรมชาติเหมือนตัดตรงช่องว่าง
// (ไม่ใส่ การ/ความ/ผู้ เพราะเป็นคำนำหน้า ตัดหลังมันแล้วอ่านสะดุด)
const AFTER_OK = new Set(['ที่','ซึ่ง','อัน','และ','หรือ','แต่','กับ','แก่','แด่','ต่อ',
  'ของ','ใน','บน','ใต้','จาก','โดย','ด้วย','เพื่อ','ตาม','เมื่อ','ถ้า','ให้','ว่า',
  'คือ','เป็น','อยู่','ณ','ทั้ง','ระหว่าง','สำหรับ','เกี่ยวกับ','พร้อม','รวม','ถึง']);

function chw(c) {
  if (ZERO.test(c)) return 0;
  if (c === ' ') return 0.26;
  if (/[0-9]/.test(c)) return 0.56;
  if (/[A-Z]/.test(c)) return 0.62;
  if (/[a-z]/.test(c)) return 0.52;
  if (/[.,;:!?'"()\[\]\-–—·]/.test(c)) return 0.32;
  return 0.62;                                        // อักษรไทย
}
const measure = (s, size) => [...s].reduce((a, c) => a + chw(c), 0) * size;

// ฟอนต์ไม่มีอักขระ … จึงใช้จุดสามจุด ไม่งั้นดูเหมือนข้อความถูกตัดทิ้งเฉย ๆ
const clip = (t, n) => {
  t = (t ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 3).trim() + '...' : t;
};

let SEG = null;
try { SEG = new Intl.Segmenter('th', { granularity: 'word' }); } catch (e) { SEG = null; }

const baseLen = w => [...w].filter(c => !ZERO.test(c)).length;

// แตกข้อความเป็นชิ้น พร้อมบอกว่ารอยต่อก่อนหน้าชิ้นนี้เป็นช่องว่างหรือไม่
function pieces(text) {
  const out = [];
  const chunks = text.match(/[“”"][^“”"]*[“”"]|\S+/g) ?? [];
  chunks.forEach((ch, ci) => {
    // ข้อความในเครื่องหมายคำพูด และคำที่ไม่ใช่ไทย เก็บเป็นก้อนเดียว ไม่ให้ฉีก
    if (/^[“”"]/.test(ch) || !SEG || !THAI.test(ch)) { out.push({ t: ch, space: ci > 0 }); return; }
    let first = true;
    for (const sg of SEG.segment(ch)) {
      const t = sg.segment;
      if (!t.trim()) continue;
      out.push({ t, space: first && ci > 0 });
      first = false;
    }
  });
  return out;
}

function breakPenalty(ps, i) {
  const p = ps[i];
  if (!p) return 0;
  if (p.space) return 0;                              // ตัดตรงช่องว่าง = ดีที่สุด
  const prev = ps[i - 1];
  if (prev && AFTER_OK.has(prev.t)) return 0;         // ตัดหลังคำเชื่อม = อ่านลื่นพอกัน
  let c = 8;                                          // ตัดกลางข้อความไทยที่ไม่มีช่องว่าง
  const a = prev ? baseLen(prev.t) : 9, b = baseLen(p.t);
  if (Math.min(a, b) <= 3) c += 34;                   // ชิ้นสั้นสองข้าง = เสี่ยงขาดกลางคำประสม
  else if (Math.min(a, b) <= 5) c += 12;
  if (NOSTART.test(p.t[0])) c += 60;
  if (prev && LEAD.test(prev.t[prev.t.length - 1])) c += 60;
  return c;
}

function joinPieces(ps, i, j) {
  let s = '';
  for (let k = i; k < j; k++) s += (k > i && ps[k].space ? ' ' : '') + ps[k].t;
  return s;
}

function layout(text, size, max) {
  const ps = pieces(text);
  const n = ps.length;
  if (!n) return { lines: [''], cost: 0 };
  const W = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) W[i + 1] = W[i] + measure((i > 0 && ps[i].space ? ' ' : '') + ps[i].t, size);

  const best = new Array(n + 1).fill(Infinity);
  const from = new Array(n + 1).fill(0);
  best[0] = 0;
  for (let j = 1; j <= n; j++) {
    for (let i = 0; i < j; i++) {
      if (!isFinite(best[i])) continue;
      let w = W[j] - W[i];
      if (i > 0 && ps[i].space) w -= measure(' ', size);   // ช่องว่างต้นบรรทัดไม่นับ
      if (w > max && j - i > 1) continue;                  // ยาวเกิน (ชิ้นเดียวยอมให้ล้น)
      const slack = Math.max(0, max - w) / max;
      // บรรทัดสุดท้ายสั้นได้ ไม่ถือเป็นความผิด (หลักการจัดบรรทัดของงานพิมพ์)
      let badness = j === n ? 0 : slack * slack * 60;
      // ...แต่ถ้าสั้นจนเหลือคำโดดบรรทัดเดียว เช่น "เถา" มันดูไม่สวย ให้เสียคะแนน
      const frac = w / max;
      if (j === n && i > 0 && frac < 0.4) badness += (0.4 - frac) * 220;
      const cost = best[i] + badness + breakPenalty(ps, i) + (w > max ? 1000 : 0);
      if (cost < best[j]) { best[j] = cost; from[j] = i; }
    }
  }
  const cuts = []; let j = n;
  while (j > 0) { cuts.unshift([from[j], j]); j = from[j]; }
  return { lines: cuts.map(([a, b]) => joinPieces(ps, a, b)), cost: best[n] };
}

// ไม่ได้เอาตัวใหญ่ที่สุดเสมอไป — ถ้าย่อลงนิดเดียวแล้วได้จุดตัดที่อ่านลื่นกว่ามาก ให้ย่อ
const SIZE_COST = 7;   // ราคาที่ยอมจ่ายต่อการลดขนาด 1 ขั้น เทียบกับโทษจุดตัด
function fit(text, { max, min, width, maxLines }) {
  let pick = null;
  for (let size = max; size >= min; size -= 2) {
    const r = layout(text, size, width);
    if (r.lines.length > maxLines) continue;
    if (!r.lines.every(l => measure(l, size) <= width + 1)) continue;
    const score = r.cost + ((max - size) / 2) * SIZE_COST;
    if (!pick || score < pick.score) pick = { size, lines: r.lines, score };
    if (r.cost <= 1 && r.lines.length === 1) break;    // บรรทัดเดียวจบสวย ไม่ต้องย่ออีก
  }
  return pick ?? { size: min, lines: layout(text, min, width).lines.slice(0, maxLines) };
}

const COLORS = {
  navy: '#0F1B2D', gold: '#C9A84C', cream: '#F5F0E8', muted: '#8A9BB5', jade: '#4C9A84',
};

const C = COLORS;



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
