// lib/eracolor.js — สีหมุดตามช่วงเวลาของเหตุการณ์ (ใช้ร่วมกันทั้งแผนที่และฟอร์มบันทึก)
//
// อ่านปี พ.ศ. จาก when_date ก่อน ไม่มีก็หาเลข 4 หลักใน when_text (รับเลขไทย ๒๔๖๖ ด้วย · เขียน ค.ศ./AD กำกับจึงบวก 543)
// แบ่งเป็นช่วงสีที่ต่างกันชัด ๆ · ไม่ระบุปี = สีเทา

export const ERA_BUCKETS = [
  { key: 'pre',   label: 'ก่อน พ.ศ. 2325 (ก่อนกรุงรัตนโกสินทร์)', max: 2324, color: '#8E44AD' },
  { key: 'r1-4',  label: 'พ.ศ. 2325–2410 (รัชกาลที่ 1–4)',        max: 2410, color: '#E74C3C' },
  { key: 'r5',    label: 'พ.ศ. 2411–2453 (รัชกาลที่ 5)',           max: 2453, color: '#F39C12' },
  { key: 'r6-7',  label: 'พ.ศ. 2454–2477 (รัชกาลที่ 6–7)',         max: 2477, color: '#F1C40F' },
  { key: 'r8-9a', label: 'พ.ศ. 2478–2500',                          max: 2500, color: '#27AE60' },
  { key: 'r9b',   label: 'พ.ศ. 2501–2540',                          max: 2540, color: '#1ABC9C' },
  { key: 'r9c',   label: 'พ.ศ. 2541–2559',                          max: 2559, color: '#3498DB' },
  { key: 'r10',   label: 'พ.ศ. 2560–ปัจจุบัน (รัชกาลที่ 10)',       max: 9999, color: '#2E5BFF' },
];
export const FUTURE_COLOR  = '#FF5FB0';   // เหตุการณ์ในอนาคต (ปีเกินปีปัจจุบัน)
export const UNKNOWN_COLOR = '#9AA3AD';   // ไม่ระบุปี

const TH_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
export const thaiDigitsToArabic = s => String(s ?? '').replace(/[๐-๙]/g, d => String(TH_DIGITS.indexOf(d)));

// ปี พ.ศ. ของเหตุการณ์ หรือ null
export function yearOf(rec) {
  if (rec?.when_date) { const y = new Date(rec.when_date).getFullYear(); if (!isNaN(y)) return y + 543; }
  const txt = thaiDigitsToArabic(rec?.when_text);
  const m = txt.match(/(\d{4})/);
  if (m) {
    let y = parseInt(m[1], 10);
    // ถือเป็น พ.ศ. เว้นแต่เขียน ค.ศ./AD ไว้ หรือเลขต่ำกว่า 1300 (พ.ศ. ต่ำขนาดนั้นไม่มีในประวัติดนตรีไทย)
    if (/ค\.?\s?ศ|คริสต|\bA\.?D\.?\b|\bCE\b/i.test(txt) || y < 1300) y += 543;
    return y;
  }
  return null;
}
export function bucketOf(year) {
  if (year == null) return null;
  const now = new Date().getFullYear() + 543;
  if (year > now) return { key: 'future', label: 'อนาคต (กำหนดการที่จะมาถึง)', color: FUTURE_COLOR };
  return ERA_BUCKETS.find(b => year <= b.max) ?? ERA_BUCKETS[ERA_BUCKETS.length - 1];
}
export function pinColor(rec) { const b = bucketOf(yearOf(rec)); return b ? b.color : UNKNOWN_COLOR; }
export function pinLabel(rec) { const b = bucketOf(yearOf(rec)); return b ? b.label : 'ไม่ระบุปี'; }

// แถบอธิบายสีบนแผนที่
export function legendHtml() {
  const row = (c, t) => `<div style="display:flex;align-items:center;gap:6px;line-height:1.5"><span style="width:11px;height:11px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${c};border:1.5px solid #0F1B2D;flex:none"></span><span>${t}</span></div>`;
  return `<div style="background:rgba(15,27,45,0.92);color:#E8DCC3;border:1px solid rgba(201,168,76,0.4);border-radius:8px;padding:8px 10px;font-size:0.62rem;font-family:'Noto Sans Thai',sans-serif;max-width:230px">
    <div style="font-weight:700;margin-bottom:4px;color:#C9A84C">สีหมุดตามช่วงเวลาเหตุการณ์</div>
    ${ERA_BUCKETS.map(b => row(b.color, b.label)).join('')}
    ${row(FUTURE_COLOR, 'อนาคต')}
    ${row(UNKNOWN_COLOR, 'ไม่ระบุปี')}
    <div style="margin-top:4px;opacity:.75">ตัวเลข = กดเพื่อกางกลุ่มหมุด</div>
  </div>`;
}
