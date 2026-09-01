// lib/perms.js — สารบัญสิทธิ์ทั้งเว็บ ที่เดียว  (Pk 27 ส.ค. 69)
//
//   หน้า /admin แท็บ 🔐 สิทธิ์ อ่านรายการจากไฟล์นี้
//   sql/28_permissions.sql เติมแถวเดียวกันนี้ลงตาราง feature_permissions
//   NotationPlayer / NotationInput เรียก can('<key>') ด้วยคีย์เดียวกัน
//
//   "ประเภทสมาชิก" (เลนส์) ที่กำหนดสิทธิ์แยกกันได้
//     guest    ผู้เยี่ยมชม ยังไม่เข้าสู่ระบบ
//     free     สมาชิกทั่วไป
//     premium  สมาชิกอุปถัมภ์
//     student  นักเรียนในระบบห้องเรียน
//     teacher  ครู
//     (admin / moderator / superuser เปิดทุกอย่างเสมอ ไม่มีให้ติ๊ก)
//
//   คนหนึ่งเป็นได้หลายอย่างพร้อมกัน (ครู + ผู้อุปถัมภ์) — ได้สิทธิ์รวมกันแบบเปิดชนะปิด

export const LENSES = [
  { key: 'guest',   label: 'ผู้เยี่ยมชม', icon: '👤' },
  { key: 'free',    label: 'สมาชิกทั่วไป', icon: '🎓' },
  { key: 'premium', label: 'อุปถัมภ์',    icon: '💎' },
  { key: 'student',  label: 'นักเรียน',   icon: '📚' },
  { key: 'teacher',  label: 'ครู',        icon: '👩‍🏫' },
];
export const LENS_KEYS = LENSES.map(l => l.key);

// ค่าเริ่มต้น: เปิดให้สมาชิกทุกประเภท ปิดเฉพาะผู้เยี่ยมชม
const MEMBERS = { guest: false, free: true, premium: true, student: true, teacher: true };
const ALL     = { guest: true,  free: true, premium: true, student: true, teacher: true };
const PAID    = { guest: false, free: false, premium: true, student: false, teacher: true };
const TEACHER = { guest: false, free: false, premium: false, student: false, teacher: true };
// ปิดทุกประเภท — เปิดให้ "รายคน" ผ่านสิทธิ์พิเศษในแท็บสมาชิก (profiles.grants · sql/45) หรือผู้ดูแลเท่านั้น
const NONE    = { guest: false, free: false, premium: false, student: false, teacher: false };

const r = (key, label, hint, def, extra = {}) => ({ key, label, hint, ...def, ...extra });
// grantable = ให้เป็นรายคนได้ (โผล่เป็นช่องติ๊กในตารางสมาชิก)  · grantLabel = ป้ายสั้น ๆ บนหัวคอลัมน์
const G = (grantLabel) => ({ grantable: true, grantLabel });

// ── สารบัญ ──────────────────────────────────────────────────────────
export const PERM_SECTIONS = [
  {
    section: 'เครื่องเล่นโน้ต — เสียงและระบบเสียง',
    rows: [
      r('player_real',    'เลือกเสียงเครื่องดนตรีจริง',   'ปิด = ได้ยินเสียงสังเคราะห์อย่างเดียว', ALL),
      r('player_tuning',  'เปลี่ยนระบบเสียง (เสียงตั้ง)',  'ตารางความถี่จริงของแต่ละสำนัก', MEMBERS),
      // ★ เปลี่ยนบันไดเสียง: ซ่อนจากทุกคน เปิดเฉพาะผู้ที่ได้รับอนุญาตรายคน (Pk 1 ก.ย. 69)
      r('player_tang',    'เปลี่ยนทาง (บันไดเสียง)',       'ทางใน ทางเพียงออล่าง ฯลฯ · เปิดรายคนได้ในแท็บสมาชิก', NONE, G('🎼 เปลี่ยนทาง')),
      r('player_ensemble','เลือกวง / ระบบที่จดโน้ต',       'ปี่พาทย์ หรือ เครื่องสาย — เสียงเท่ากันแต่จดต่างกัน', MEMBERS),
      r('player_sabat',   'ปรับความถี่สะบัด',              'ระยะห่างของไม้สะบัด', MEMBERS),
    ],
  },
  {
    section: 'เครื่องเล่นโน้ต — จังหวะและหน้าทับ',
    rows: [
      r('player_perc',     'เปิดเสียงเครื่องประกอบจังหวะ', 'สวิตช์ใหญ่ — ปิดอันนี้แล้วหน้าทับกับชุดกลองปิดตามทั้งหมด', ALL),
      r('player_ching',    'เปิด–ปิดฉิ่ง',                  'ฉิ่ง–ฉับ ประกอบทำนอง', ALL),
      r('player_nathab',   'เลือกหน้าทับ',                  'ปรบไก่ สองไม้ และหน้าทับในคลัง · ต้องเปิดสวิตช์ใหญ่ด้วย', MEMBERS),
      r('player_drum',     'เลือกชุดกลอง',                  'ตะโพน กลองแขก กลองสองหน้า ฯลฯ · ต้องเปิดสวิตช์ใหญ่ด้วย', MEMBERS),
      r('player_level',    'เปลี่ยนอัตรา',                  'สามชั้น สองชั้น ชั้นเดียว', MEMBERS),
      r('player_tempo',    'ปรับความเร็ว',                  'แถบเลื่อนช้า–เร็ว', ALL),
      r('player_thonthot', 'ตั้งจังหวะถอน / ทอด',           'เร่งขึ้นทั้งท่อน แล้วจบท่อนแบบถอนหรือทอด', MEMBERS),
      r('player_repeat',   'ตั้งเที่ยวกลับ / วนซ้ำ',        'เที่ยวเดียวจบ · กลับต้น · วนไปเรื่อย ๆ', ALL),
    ],
  },
  {
    section: 'เครื่องเล่นโน้ต — การแสดงผล',
    rows: [
      r('player_hands',  'ดูสองบรรทัด แยกมือซ้าย–ขวา', null, ALL),
      r('player_khim',   'ดูสามบรรทัด (ขิม)',           null, ALL),
      r('player_vocal',  'ดูโน้ตขับร้อง (มีเนื้อร้อง)',  null, ALL),
      r('player_staff',  'ดูโน้ตสากล 5 เส้น',            null, MEMBERS),
      r('player_layout', 'ปรับจำนวนห้องต่อบรรทัด',       null, ALL),
      r('staff_chord',   'โน้ตสากล: รวมสองมือเป็นคู่เสียง', null, MEMBERS),
    ],
  },
  {
    section: 'กระดานเขียนโน้ต — เสียงและทาง',
    rows: [
      r('board_tuning',   'เปลี่ยนระบบเสียงบนกระดาน',  null, MEMBERS),
      r('board_tang',     'เปลี่ยนทางบนกระดาน',         'เปิดรายคนได้ในแท็บสมาชิก (ช่องเดียวกับเครื่องเล่น)', NONE, G('🎼 เปลี่ยนทาง')),
      r('board_notens',   'เลือกระบบที่จด (ปี่พาทย์ / เครื่องสาย)', null, MEMBERS),
      r('board_tangview', 'เลือกวิธีเปลี่ยนทาง (ตรึงโน้ต / ย้ายโน้ตจริง)', 'เปิดรายคนได้ในแท็บสมาชิก', NONE, G('🎼 เปลี่ยนทาง')),
      r('board_system',   'เปลี่ยนระบบบรรทัด (1 / 2 / 3 บรรทัด)', null, MEMBERS),
      r('board_sound',    'เปิดเสียงขณะพิมพ์',           null, ALL),
    ],
  },
  {
    section: 'กระดานเขียนโน้ต — จังหวะ',
    rows: [
      r('board_ching',  'เปิด–ปิดฉิ่งบนกระดาน',      null, ALL),
      r('board_nathab', 'เลือกหน้าทับและกลองบนกระดาน', null, MEMBERS),
      r('board_bpm',    'ปรับความเร็วบนกระดาน',       null, ALL),
    ],
  },
  {
    section: 'กระดานเขียนโน้ต — เครื่องหมายและเครื่องมือ',
    rows: [
      r('board_kro',     'ใส่เครื่องหมายกรอ',        null, MEMBERS),
      r('board_damp',    'ใส่ประคบ',                 null, MEMBERS),
      r('board_sabat',   'ใส่สะบัด',                 null, MEMBERS),
      r('board_verse',   'แบ่ง / รวมวรรค · เพิ่ม–ลดห้อง', null, MEMBERS),
      r('board_paste',   'วางโน้ตที่มีอยู่แล้ว',      null, MEMBERS),
      r('board_import',  'นำเข้าจากไฟล์ (PDF · รูป · MusicXML)', null, PAID),
      r('board_clear',   'ล้างกระดานทั้งหมด',         null, MEMBERS),
    ],
  },
  {
    section: 'หน้าทับและคลังกลาง',
    rows: [
      r('song_nathab_edit', 'ตั้งหน้าทับประจำเพลง',      'แผง 🥁 ในหน้าเพลง', MEMBERS),
      r('nathab_write',     'เขียนหน้าทับเข้าคลังกลาง',  null, MEMBERS),
      r('page_nathab',      'เข้าหน้าคลังหน้าทับ',       null, ALL),
    ],
  },
  {
    section: 'ห้องเรียนและการบ้าน',
    rows: [
      r('classroom_create',  'เปิดห้องเรียน',            'ปกติเปิดให้เฉพาะครู', TEACHER),
      r('classroom_join',    'เข้าห้องเรียนด้วยรหัส',    null, { guest: false, free: true, premium: true, student: true, teacher: false }),
      r('homework_submit',   'ส่งการบ้านให้ครู',         null, { guest: false, free: false, premium: false, student: true, teacher: false }),
      r('homework_review',   'ตรวจการบ้าน ให้เกรด',      null, TEACHER),
    ],
  },
  {
    section: 'ส่งออกและพิมพ์',
    rows: [
      r('export', 'ดาวน์โหลดไฟล์โน้ต', null, PAID),
      r('print',  'พิมพ์ฉบับกระดาษ',   null, PAID),
      r('cite',   'คัดลอกรูปแบบอ้างอิง', null, ALL),
    ],
  },
];

export const PERM_ROWS = PERM_SECTIONS.flatMap(s => s.rows.map(row => ({ ...row, section: s.section })));
export const PERM_BY_KEY = Object.fromEntries(PERM_ROWS.map(r0 => [r0.key, r0]));

// ── สิทธิ์พิเศษรายคน (profiles.grants text[] · sql/45) ──────────────
//   กลุ่ม = คีย์หลายตัวที่ติ๊กครั้งเดียวได้พร้อมกัน (เปลี่ยนทางในเครื่องเล่น + บนกระดาน = ช่องเดียว)
export const GRANT_GROUPS = (() => {
  const m = new Map();
  PERM_ROWS.filter(r0 => r0.grantable).forEach(r0 => {
    const g = m.get(r0.grantLabel) || { label: r0.grantLabel, keys: [] };
    g.keys.push(r0.key); m.set(r0.grantLabel, g);
  });
  return [...m.values()];
})();
export const GRANTABLE_KEYS = GRANT_GROUPS.flatMap(g => g.keys);
export const hasGrant = (grants, key) => Array.isArray(grants) && grants.includes(key);
// กลุ่มนี้เปิดให้คนนี้ครบทุกคีย์ไหม
export const hasGrantGroup = (grants, group) => group.keys.every(k => hasGrant(grants, k));

// ── ปุ่มจริงบนกระดานที่แต่ละสิทธิ์คุมอยู่ ─────────────────────────
//   กระดานเป็น HTML ที่เอนจินสร้างเอง จึงคุมด้วย selector แทนการแก้ในเอนจิน
export const BOARD_GATES = {
  board_tuning:   ['[data-f="tuning"]'],
  board_tang:     ['[data-f="tang"]'],
  board_notens:   ['[data-f="notens"]'],
  board_tangview: ['[data-f="tangview"]'],
  board_system:   ['[data-f="system"]'],
  board_sound:    ['[data-a="snd"]'],
  board_ching:    ['[data-f="ching"]', '[data-f="chingmode"]'],
  board_nathab:   ['[data-t="drumwrap"]'],
  board_bpm:      ['.thn-rng'],
  board_kro:      ['[data-a="kro"]', '[data-f="krogap"]'],
  board_damp:     ['[data-a="damp"]'],
  board_sabat:    ['[data-a="sabat"]'],
  board_verse:    ['[data-a="hong-"]', '[data-a="hong+"]', '[data-a="splitverse"]', '[data-a="mergeverse"]'],
  board_paste:    ['.thn-panel.paste'],
  board_clear:    ['[data-a="clr"]'],
};

// ซ่อนปุ่มบนกระดานตามสิทธิ์ — คืนจำนวนที่ซ่อน (ไว้ให้เทสต์ตรวจ)
export function applyBoardGates(root, can) {
  if (!root || typeof can !== 'function') return 0;
  let hidden = 0;
  for (const [key, sels] of Object.entries(BOARD_GATES)) {
    const ok = can(key);
    for (const sel of sels) {
      for (const el of root.querySelectorAll(sel)) {
        // ซ่อนทั้งกล่องที่ห่อไว้ ไม่ใช่เฉพาะตัว select เปล่า ๆ
        const box = el.closest('label.thn-pick, label.thn-chk') || el;
        box.style.display = ok ? '' : 'none';
        if (!ok) hidden++;
      }
    }
  }
  return hidden;
}
