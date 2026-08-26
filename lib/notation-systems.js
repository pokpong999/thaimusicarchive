// lib/notation-systems.js — ระบบบันทึกโน้ต (จำนวน/ความหมายของ "บรรทัด" ในหนึ่งวรรค) (2026-08-26)
//
//   หนึ่งวรรคมีได้ถึง 3 แนว: r · l · x (lib/notation-core.js HANDS)
//   ระบบบันทึกบอกว่าเครื่องนี้ใช้กี่แนว และแต่ละแนวชื่ออะไร — กระดาน เครื่องเล่น และการลงฐานอ่านจากที่นี่ที่เดียว
//   เพิ่มระบบใหม่ = เพิ่มรายการตรงนี้ (ไม่ต้องแก้เอนจิน)
export const SYSTEMS = {
  melody1: {
    label: 'ทำนองรวม (1 บรรทัด)',
    short: 'ทำนองรวม',
    desc: 'บรรทัดเดียว — ฆ้องวงใหญ่ ทำนองหลัก เครื่องเป่า เครื่องสีทั่วไป',
    lines: [{ key: 'r', label: '', tag: '' }],
  },
  hands2: {
    label: 'สองมือ R/L (บน = ขวา · ล่าง = ซ้าย)',
    short: 'สองมือ R/L',
    desc: 'ระนาด ฆ้อง ขิม จะเข้ ที่เขียนแยกมือ — บรรทัดบนมือขวา บรรทัดล่างมือซ้าย',
    lines: [{ key: 'r', label: 'ขวา', tag: 'R' }, { key: 'l', label: 'ซ้าย', tag: 'L' }],
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
// ระบบที่เหมาะกับจำนวนแนวที่มีโน้ตจริง (ใช้ตอนเปิดโน้ตเก่าที่ไม่ได้บันทึกชื่อระบบไว้)
export function systemForLines(n, hint) {
  if (hint && SYSTEMS[hint] && lineCount(hint) === n) return hint;
  if (n >= 3) return 'khim3';
  if (n === 2) return 'hands2';
  return 'melody1';
}
