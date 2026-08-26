// lib/portfolio.js — แฟ้มผลงาน (portfolio): กระดาษ · แม่แบบชุดอักษร · ตัวช่วยอ่านข้อมูล (2026-08-25)
//   แนวคิด: จดหมายเหตุ = ไดอารี่ที่วันหนึ่งกลายเป็นแฟ้มผลงาน — สมาชิกเลือกบันทึกเหตุการณ์ + ไดอารี่ มาเรียงเป็นเล่ม
//   ออกเป็น PDF ผ่านหน้าพิมพ์ของเบราว์เซอร์ (@page size ตามกระดาษ/แนวที่เลือก) — ไม่ต้องมีเซิร์ฟเวอร์สร้าง PDF
import { supabase } from './supabase';

// ขนาดกระดาษ (มม.) แนวตั้ง
export const PAPERS = {
  A4:     { label: 'A4 (210 × 297 มม.)',   w: 210,   h: 297 },
  A5:     { label: 'A5 (148 × 210 มม.)',   w: 148,   h: 210 },
  B5:     { label: 'B5 (176 × 250 มม.)',   w: 176,   h: 250 },
  Letter: { label: 'Letter (8.5 × 11 นิ้ว)', w: 215.9, h: 279.4 },
};
export const ORIENTATIONS = { portrait: 'แนวตั้ง', landscape: 'แนวนอน' };
export function paperSize(paper, orientation) {
  const p = PAPERS[paper] ?? PAPERS.A4;
  return orientation === 'landscape' ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}

// ── แม่แบบชุดอักษร 3 ชุด ──
//   ทุกชุดใช้ฟอนต์ไทยจาก Google Fonts (โหลดเฉพาะหน้าแฟ้ม) · สี/เส้น/เครื่องประดับต่างกันตามอารมณ์
export const TEMPLATES = {
  court: {
    name: 'ราชสำนัก', icon: '👑',
    desc: 'กระดาษสีครีม กรอบทองคู่ หัวเรื่องอักษรไทยประดิษฐ์ (Charm) เนื้อความ Pridi — เหมาะกับบันทึกครู งานไหว้ครู พิธี',
    fonts: 'Charm:wght@400;700&family=Pridi:wght@300;400;600',
    swatch: ['#f6eed9', '#b08d3c', '#2b2115'],
  },
  academic: {
    name: 'วิชาการ', icon: '🎓',
    desc: 'ขาว-ดำ เรียบ เส้นบาง หัวเรื่อง Taviraj เนื้อความ Sarabun ใส่เลขลำดับ — เหมาะยื่นพอร์ตเข้ามหาวิทยาลัย / ประกวด',
    fonts: 'Taviraj:wght@400;600;700&family=Sarabun:wght@400;600',
    swatch: ['#ffffff', '#111111', '#7a7a7a'],
  },
  modern: {
    name: 'ทันสมัย', icon: '✨',
    desc: 'ปกกรมท่าตัวอักษรทองใหญ่ แถบสีข้างรายการ หัวเรื่อง Kanit เนื้อความ Bai Jamjuree — เหมาะเด็กรุ่นใหม่ วงดนตรี โรงเรียน',
    fonts: 'Kanit:wght@400;600;700&family=Bai+Jamjuree:wght@400;500;600',
    swatch: ['#0f1a2b', '#c9a84c', '#ffffff'],
  },
};
export const TEMPLATE_KEYS = Object.keys(TEMPLATES);
export function fontsHref(keys = TEMPLATE_KEYS) {
  const fam = keys.map(k => TEMPLATES[k]?.fonts).filter(Boolean).join('&family=');
  return `https://fonts.googleapis.com/css2?family=${fam}&display=swap`;
}

// ── รูป ──
export function imageUrl(bucket, path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
export const diaryImageUrl = p => imageUrl('diary-images', p);
export const archiveImageUrl = p => imageUrl('archive-images', p);

// ── วันที่ไทย (พ.ศ.) ──
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MONTHS_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export function parseDate(s) {
  if (!s) return null;
  const d = typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  return isNaN(d) ? null : d;
}
export function thaiDate(s, { long = false, weekday = false } = {}) {
  const d = parseDate(s);
  if (!d) return '';
  const m = long ? TH_MONTHS[d.getMonth()] : TH_MONTHS_S[d.getMonth()];
  const out = `${d.getDate()} ${m} ${d.getFullYear() + 543}`;
  return weekday ? `วัน${TH_DAYS[d.getDay()]}ที่ ${out}` : out;
}
export function thaiMonth(s) { const d = parseDate(s); return d ? `${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}` : ''; }
export function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

// ── ช่วงเวลาของเล่ม (จากรายการ) ──
export function itemDate(it) {
  return it?.t === 'diary' ? it.entry_date : (it?.when_date || it?.created_at || null);
}
export function dateRange(items) {
  const ds = (items ?? []).map(itemDate).map(parseDate).filter(Boolean).sort((a, b) => a - b);
  if (!ds.length) return '';
  const a = thaiDate(ds[0]), b = thaiDate(ds[ds.length - 1]);
  return a === b ? a : `${a} – ${b}`;
}

// ── เขียนต่อเนื่อง (streak) จากวันที่ของไดอารี่ ──
export function diaryStreak(dates) {
  const set = new Set((dates ?? []).map(d => String(d).slice(0, 10)));
  if (!set.size) return 0;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (!set.has(iso(d))) d.setDate(d.getDate() - 1);          // วันนี้ยังไม่เขียน → นับจากเมื่อวาน
  let n = 0;
  while (set.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ── โหลดเล่ม (ผ่านฟังก์ชัน thma_portfolio_view: เจ้าของ หรือเล่มที่เผยแพร่) ──
export async function loadPortfolioView(id) {
  const { data, error } = await supabase.rpc('thma_portfolio_view', { p_id: Number(id) });
  if (error) throw error;
  return data;   // null = ไม่มี/ไม่มีสิทธิ์
}
