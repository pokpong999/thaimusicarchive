// lib/ownership.js — ใครเป็น "เจ้าของโน้ต" ชุดนี้ · ใครพิมพ์/ดาวน์โหลดได้  (Pk 1 ก.ย. 69)
//
//   กติกา: "ให้ปริ้นได้เฉพาะโน้ตที่เขียนเอง โน้ตคนอื่นดูได้อย่างเดียว"
//   - เจ้าของ = คนที่บันทึกโน้ตทางนี้ (song_melody.submitted_by) หรือคนที่ส่งเพลงเข้าคลัง (songs.contributed_by)
//   - ผู้ดูแล (admin/moderator) พิมพ์ได้ทุกเพลง
//   - สิทธิ์รายฟีเจอร์ 'print' / 'export' (แท็บ 🔐 ในหน้าผู้ดูแล) ยังทำงานซ้อนอยู่เหมือนเดิม
//     → ต้องเป็นเจ้าของ "และ" มีสิทธิ์นั้น (ยกเว้นผู้ดูแล)
//
//   ฟังก์ชันล้วน ไม่แตะ React/Supabase — ทดสอบใน Node ได้

// เจ้าของโน้ตชุดนี้คือใคร (uid) — โน้ตหลายวรรคอาจมีผู้บันทึกหลายคน คืนทั้งหมด
export function noteOwners(verses, song) {
  const ids = new Set();
  (verses ?? []).forEach(v => { if (v && v.submitted_by) ids.add(String(v.submitted_by)); });
  if (song?.contributed_by) ids.add(String(song.contributed_by));
  return [...ids];
}

export function isNoteOwner({ userId, verses, song }) {
  if (!userId) return false;
  return noteOwners(verses, song).includes(String(userId));
}

// สรุปสิทธิ์พิมพ์/ดาวน์โหลดของคนนี้กับโน้ตชุดนี้
//   คืน { owner, print, export, reason }  · reason = ข้อความสำหรับบอกผู้ใช้เมื่อทำไม่ได้
export function printRights({ userId, isAdmin = false, verses, song, can = () => true }) {
  const owner = isNoteOwner({ userId, verses, song });
  if (isAdmin) return { owner, print: true, export: true, reason: '' };
  if (!owner) {
    return { owner: false, print: false, export: false,
      reason: userId
        ? 'พิมพ์/ดาวน์โหลดได้เฉพาะโน้ตที่คุณบันทึกเอง — โน้ตของสมาชิกท่านอื่นเปิดดูได้อย่างเดียว'
        : 'เข้าสู่ระบบแล้วพิมพ์/ดาวน์โหลดได้เฉพาะโน้ตที่คุณบันทึกเอง' };
  }
  const p = !!can('print'), x = !!can('export');
  return { owner: true, print: p, export: x,
    reason: (p || x) ? '' : 'การพิมพ์และดาวน์โหลดเปิดสำหรับสมาชิกอุปถัมภ์' };
}
