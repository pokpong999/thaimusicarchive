// lib/htmlesc.js — แปลงอักขระพิเศษก่อนต่อข้อความผู้ใช้เป็น HTML (กัน stored XSS)
// ใช้กับข้อความที่สมาชิกกรอกทุกครั้งที่จะใส่ลง innerHTML / popupHtml / tooltipHtml
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
