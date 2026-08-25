// lib/fmtdate.js — แสดงวัน-เวลาแบบไทย (ปี พ.ศ. ตามเครื่องผู้ใช้ · เขตเวลาของผู้ใช้)
const D = { day: 'numeric', month: 'short', year: 'numeric' };
const T = { hour: '2-digit', minute: '2-digit' };
export function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('th-TH', D); }
export function fmtTime(iso) { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('th-TH', T); }
// "25 ส.ค. 2569 · 14:32"
export function fmtDT(iso) { const d = fmtDate(iso); return d ? d + ' · ' + fmtTime(iso) + ' น.' : ''; }
// "3 วันก่อน" / "2 ชม.ก่อน" (ไว้ใช้ที่อยากให้สั้น)
export function ago(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'เมื่อสักครู่';
  if (s < 3600) return Math.floor(s / 60) + ' นาทีก่อน';
  if (s < 86400) return Math.floor(s / 3600) + ' ชม.ก่อน';
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' วันก่อน';
  return fmtDate(iso);
}
