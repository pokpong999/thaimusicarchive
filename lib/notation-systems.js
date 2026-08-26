// lib/notation-systems.js — ระบบบันทึกโน้ต (จำนวน/ความหมายของ "บรรทัด" ในหนึ่งวรรค) (2026-08-26)
//
//   หนึ่งวรรคมีได้ถึง 3 แนว: r · l · x (lib/notation-core.js HANDS)
//   ระบบบันทึกบอกว่าเครื่องนี้ใช้กี่แนว และแต่ละแนวชื่ออะไร — กระดาน เครื่องเล่น และการลงฐานอ่านจากที่นี่ที่เดียว
//   เพิ่มระบบใหม่ = เพิ่มรายการตรงนี้ (ไม่ต้องแก้เอนจิน)
export const SYSTEMS = {
  melody1: {
    label: 'บรรทัดเดียว',
    short: 'บรรทัดเดียว',
    desc: 'บรรทัดเดียว — ฆ้องวงใหญ่ ทำนองหลัก เครื่องเป่า เครื่องสีทั่วไป',
    lines: [{ key: 'r', label: '', tag: '' }],
  },
  hands2: {
    label: 'แบ่งมือ ซ้าย/ขวา (บน = มือขวา · ล่าง = มือซ้าย)',
    short: 'แบ่งมือ ซ้าย/ขวา',
    desc: 'ระนาด ฆ้อง ขิม จะเข้ ที่เขียนแยกมือ — บรรทัดบน = มือขวา (เสียงสูง) · บรรทัดล่าง = มือซ้าย (เสียงต่ำ)',
    lines: [{ key: 'r', label: 'มือขวา', tag: 'มือขวา' }, { key: 'l', label: 'มือซ้าย', tag: 'มือซ้าย' }],
  },
  ranad_keb: {
    label: 'ทางเก็บระนาดเอก (พิมพ์มือขวา · มือซ้ายคู่แปดให้เอง)',
    short: 'ทางเก็บระนาดเอก',
    desc: 'พิมพ์เฉพาะบรรทัดมือขวา (เสียงสูง) แล้วมือซ้ายจะได้คู่แปดต่ำลง 1 ช่วงเสียงอัตโนมัติ · แก้มือซ้ายเองได้อิสระเมื่อมีลูกที่ไม่เป็นคู่แปด',
    lines: [{ key: 'r', label: 'มือขวา', tag: 'มือขวา' }, { key: 'l', label: 'มือซ้าย', tag: 'มือซ้าย' }],
    // เติมคู่แปดให้แนว l อัตโนมัติจากแนว r (เอนจินอ่านค่านี้)
    autoOctave: { from: 'r', to: 'l', shift: -1 },
  },
  khim3: {
    label: 'ขิม 3 บรรทัด (สูง / กลาง / ต่ำ)',
    short: 'ขิม 3 บรรทัด',
    desc: 'ขิม: บรรทัดบน = เสียงสูง (หย่องซ้าย) · บรรทัดกลาง = หย่องกลาง · บรรทัดล่าง = เสียงต่ำ (หย่องขวา)',
    lines: [
      { key: 'r', label: 'สูง (ซ้าย)', tag: 'สูง' },
      { key: 'l', label: 'กลาง', tag: 'กลาง' },
      { key: 'x', label: 'ต่ำ (ขวา)', tag: 'ต่ำ' },
    ],
  },
  jakhe: {
    label: 'จะเข้ 3 บรรทัด (สายเอก / สายทุ้ม / สายลวด)',
    short: 'จะเข้',
    desc: 'จะเข้: บรรทัดบน = สายเอก · บรรทัดกลาง = สายทุ้ม · บรรทัดล่าง = สายลวด',
    lines: [
      { key: 'r', label: 'สายเอก', tag: 'เอก' },
      { key: 'l', label: 'สายทุ้ม', tag: 'ทุ้ม' },
      { key: 'x', label: 'สายลวด', tag: 'ลวด' },
    ],
  },
  three: {
    label: 'สามบรรทัด (บน / กลาง / ล่าง)',
    short: '3 บรรทัด',
    desc: 'สามแนวทั่วไป — เครื่องที่แยกสามระดับ/สามหย่อง หรือโน้ตที่มีแนวประกอบ',
    lines: [{ key: 'r', label: 'บน', tag: 'บน' }, { key: 'l', label: 'กลาง', tag: 'กลาง' }, { key: 'x', label: 'ล่าง', tag: 'ล่าง' }],
  },
};
export const SYSTEM_KEYS = Object.keys(SYSTEMS);
export const DEFAULT_SYSTEM = 'melody1';
export function systemOf(key) { return SYSTEMS[key] || SYSTEMS[DEFAULT_SYSTEM]; }
export function linesOf(key) { return systemOf(key).lines; }
export function handsOf(key) { return systemOf(key).lines.map(l => l.key); }
export function lineCount(key) { return systemOf(key).lines.length; }
// ระบบที่เติมคู่แปดให้อีกแนวอัตโนมัติ (ทางเก็บระนาดเอก) · null = ไม่มี
export function autoOctaveOf(key) { return systemOf(key).autoOctave || null; }
// ระบบที่เหมาะกับจำนวนแนวที่มีโน้ตจริง (ใช้ตอนเปิดโน้ตเก่าที่ไม่ได้บันทึกชื่อระบบไว้)
export function systemForLines(n, hint) {
  if (hint && SYSTEMS[hint] && lineCount(hint) === n) return hint;
  if (n >= 3) return 'khim3';
  if (n === 2) return 'hands2';
  return 'melody1';
}
