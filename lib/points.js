// lib/points.js — กติกาการได้ "ศักดินา" ที่เดียวของทั้งเว็บ  (Pk เคาะ 27 ส.ค. 69)
//   หน้า /admin (ตอนอนุมัติ) · หน้า /leaderboard (ตารางเงื่อนไข) · sql/24 (นับใหม่)
//   ต้องอ่านอัตราจากไฟล์นี้ไฟล์เดียว จะได้ไม่มีวันเพี้ยนกันเองอีก
//
//   ประวัติ: ก่อนหน้านี้ทุกประเภทให้ +10 เท่ากันหมด และหน้าทับไม่เคยได้เลย
//   ทำให้บางคนแต้มเกิน บางคนแต้มขาด → sql/24 นับใหม่ทั้งระบบจากผลงานที่อนุมัติจริง

export const POINT_RULES = [
  { key: 'archive', icon: '📜', pts: 10, bonusPts: 5,
    label: 'บันทึกเหตุการณ์ลงหอจดหมายเหตุ',
    bonus: 'แนบรูปประกอบอย่างน้อย 1 รูป',
    note: 'ได้เมื่อผู้ดูแลอนุมัติ' },
  { key: 'song', icon: '🎼', pts: 20,
    label: 'ส่งเพลงใหม่เข้าคลัง',
    note: 'ต้องถึงบรรดาศักดิ์ ขุน (300 ศักดินา) จึงเปิดกระดานโน้ตได้' },
  { key: 'tang', icon: '🎻', pts: 10,
    label: 'ส่งทางเครื่องให้เพลงที่มีอยู่แล้ว',
    note: 'นับแยกตามเครื่องดนตรี · ทางชุดแรกของเพลงที่ตัวเองเป็นคนส่ง นับรวมอยู่ใน 20 แล้ว' },
  { key: 'video', icon: '🎬', pts: 5, label: 'ส่งวิดีโอการบรรเลง' },
  { key: 'audio', icon: '🎙', pts: 5, label: 'ส่งไฟล์เสียงการบรรเลง' },
  { key: 'file', icon: '📄', pts: 0, label: 'อัปโหลดไฟล์โน้ต PDF', note: 'ไม่นับศักดินา' },
  { key: 'nathab', icon: '🥁', pts: 0, label: 'ส่งหน้าทับเข้าคลังกลาง', note: 'ไม่นับศักดินา' },
];

export const PTS = Object.fromEntries(POINT_RULES.map(r => [r.key, r.pts]));
export const ARCHIVE_IMAGE_BONUS = POINT_RULES.find(r => r.key === 'archive').bonusPts;

// แต้มของบันทึกจดหมายเหตุ 1 ชิ้น — มีรูปแนบได้เพิ่ม
export const archivePoints = (hasImage) => PTS.archive + (hasImage ? ARCHIVE_IMAGE_BONUS : 0);

// แต้มของผลงาน 1 ชิ้นตามประเภท (archive ส่งธงรูปมาด้วยได้)
export function pointsFor(key, { hasImage = false } = {}) {
  if (key === 'archive') return archivePoints(hasImage);
  return PTS[key] ?? 0;
}

// ป้ายบนปุ่มอนุมัติ — ประเภทที่ไม่ให้แต้มต้องไม่โฆษณาว่าให้ (เดิมเขียน "+10 ศักดินา" ทุกปุ่ม)
export function awardLabel(key, opts) {
  const p = pointsFor(key, opts);
  return p > 0 ? `✓ อนุมัติ (+${p} ศักดินา)` : '✓ อนุมัติ';
}

// ข้อความอัตราสำหรับตารางเงื่อนไขในทำเนียบ
export function ruleAmount(r) {
  if (!r.pts && !r.bonusPts) return '— ไม่นับ —';
  return r.bonusPts ? `+${r.pts}  (+${r.pts + r.bonusPts} ถ้าแนบรูป)` : `+${r.pts}`;
}
