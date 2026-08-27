// lib/notif.js — อ่านข้อความของ "การแจ้งเตือน" ให้ได้เสมอ ไม่ว่าฐานจะเก็บชื่อคอลัมน์ว่าอะไร
//   (Pk รายงาน 27 ส.ค. 69: กระดิ่งแจ้งเตือนขึ้นแต่จุดกับเวลา ไม่มีข้อความเลย)
//   สาเหตุ: หน้าเว็บอ่านคอลัมน์ชื่อ title/body ตรง ๆ แต่แถวที่ trigger ในฐานสร้างไว้
//   อาจใช้ชื่อคอลัมน์อื่น (message/text/detail…) หรือไม่มีข้อความเลย มีแต่ประเภท
//   วิธีแก้: ไล่หาข้อความจากหลายชื่อ → ถ้าไม่เจอค่อยประกอบประโยคจาก "ประเภท" ให้อ่านรู้เรื่อง

const TEXT_KEYS = ['title', 'message', 'text', 'body', 'detail', 'content', 'description', 'summary', 'headline'];
const SUB_KEYS = ['body', 'detail', 'message', 'description', 'content', 'note', 'summary'];
// คีย์ที่เป็นข้อมูลระบบ ไม่ใช่ข้อความให้คนอ่าน
const META = new Set(['id', 'user_id', 'sender_id', 'actor_id', 'target_id', 'record_id', 'song_id', 'ref_id',
  'created_at', 'updated_at', 'read_at', 'read', 'is_read', 'seen', 'link', 'url', 'href', 'kind', 'type', 'category']);

export const KIND_LABEL = {
  pending: 'มีของใหม่รอตรวจ',
  approved: 'ผลงานของคุณได้รับอนุมัติแล้ว',
  rejected: 'ผลงานของคุณไม่ผ่านการตรวจ',
  comment: 'มีคนแสดงความเห็นในผลงานของคุณ',
  reply: 'มีคนตอบความเห็นของคุณ',
  points: 'คุณได้รับศักดินาเพิ่ม',
  rank: 'บรรดาศักดิ์ของคุณเลื่อนขั้น',
  song: 'เพลงใหม่รอตรวจ',
  song_submission: 'เพลงใหม่รอตรวจ',
  archive: 'บันทึกจดหมายเหตุรอตรวจ',
  archive_record: 'บันทึกจดหมายเหตุรอตรวจ',
  video: 'วิดีโอเพลงรอตรวจ',
  song_video: 'วิดีโอเพลงรอตรวจ',
  audio: 'ไฟล์เสียงรอตรวจ',
  song_audio: 'ไฟล์เสียงรอตรวจ',
  file: 'ไฟล์โน้ต PDF รอตรวจ',
  song_file: 'ไฟล์โน้ต PDF รอตรวจ',
  tang: 'ทางเครื่องรอตรวจ',
  melody_submission: 'ทางเครื่องรอตรวจ',
  nathab: 'หน้าทับใหม่รอตรวจ',
  nathab_pending: 'หน้าทับใหม่รอตรวจ',
};
export const KIND_ICON = {
  pending: '🔔', approved: '✓', rejected: '✕', comment: '💬', reply: '💬',
  points: '🎖', rank: '🎖', song: '🎼', song_submission: '🎼', melody_submission: '🎻', tang: '🎻',
  archive: '📜', archive_record: '📜', video: '🎬', song_video: '🎬',
  audio: '🎙', song_audio: '🎙', file: '📄', song_file: '📄', nathab: '🥁', nathab_pending: '🥁',
};

const clean = v => (typeof v === 'string' ? v.trim() : '');
const kindOf = n => clean(n?.kind) || clean(n?.type) || clean(n?.category);

// ข้อความบรรทัดแรก — ต้องได้อะไรสักอย่างเสมอ
export function notifText(n) {
  if (!n) return 'การแจ้งเตือน';
  for (const k of TEXT_KEYS) { const v = clean(n[k]); if (v) return v; }
  // เผื่อ trigger เก็บไว้ในคอลัมน์ชื่อแปลก ๆ ที่เราไม่รู้จัก — หยิบข้อความแรกที่ดูเป็นภาษาคนมาแสดง
  for (const [k, v] of Object.entries(n)) {
    if (META.has(k)) continue;
    const s = clean(v);
    if (s && s.length <= 200 && !/^https?:\/\//.test(s) && !/^[0-9a-f-]{20,}$/i.test(s)) return s;
  }
  const kind = kindOf(n);
  return KIND_LABEL[kind] || (kind ? `การแจ้งเตือน: ${kind}` : 'การแจ้งเตือน');
}

// บรรทัดรอง (ถ้ามี) — ต้องไม่ซ้ำกับบรรทัดแรก
export function notifSub(n) {
  if (!n) return '';
  const head = notifText(n);
  for (const k of SUB_KEYS) { const v = clean(n[k]); if (v && v !== head) return v; }
  return '';
}

export const notifIcon = n => KIND_ICON[kindOf(n)] ?? '🔔';
export const notifRead = n => !!(n?.read ?? n?.is_read ?? n?.seen ?? false);

// ลิงก์ปลายทาง — ถ้าฐานไม่ได้เก็บ link ไว้ ก็เดาจากประเภทให้พอไปถูกที่
export function notifLink(n) {
  const direct = clean(n?.link) || clean(n?.url) || clean(n?.href);
  if (direct) return direct;
  const kind = kindOf(n);
  const id = n?.target_id ?? n?.record_id ?? n?.ref_id ?? null;
  if (/archive/.test(kind) && id) return `/archive/${id}`;
  if (/song|video|audio|file|melody|tang/.test(kind) && (n?.song_id ?? null)) return `/songs/${n.song_id}`;
  if (/pending|nathab|song_submission|melody_submission/.test(kind)) return '/admin';
  if (/approved|points|rank|rejected/.test(kind)) return '/dashboard';
  return '#';
}
