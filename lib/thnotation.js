// แปลงโน้ตไทย Unicode → รหัสฟอนต์ TH Notation (ระบบ ปกป้อง ขำประเสริฐ)
// แถว q-u = สูง, a-j = กลาง, z-m = ต่ำ
const COLS = ['ด','ร','ม','ฟ','ซ','ล','ท'];
const ROW_HIGH = 'qwertyu', ROW_MID = 'asdfghj', ROW_LOW = 'zxcvbnm';
const HIGH = '\u0E4D', LOW = '\u0E3A', LOW2 = '\u0E38';

export function thaiToKeys(text) {
  let out = '';
  const chars = [...(text ?? '')];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const col = COLS.indexOf(c);
    if (col >= 0) {
      const mark = chars[i + 1];
      if (mark === HIGH) { out += ROW_HIGH[col]; i++; }
      else if (mark === LOW || mark === LOW2) { out += ROW_LOW[col]; i++; }
      else out += ROW_MID[col];
    } else if (c === '-') out += '-';
    else if (c === ' ') out += ' ';
    else if (c === '|') out += '|';
  }
  return out;
}

// แปลงทั้งบรรทัด คงช่องว่างและ | ไว้ (สำหรับแสดงต่อเนื่อง — | ใช้ฟอนต์ปกติแยกต่างหาก)
export function lineToKeys(line) { return thaiToKeys(line); }
