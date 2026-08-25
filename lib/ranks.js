// ระบบบรรดาศักดิ์ THMA — หน่วยนับเรียกว่า "ศักดินา" (Pk เคาะ 2026-08-25 · คอลัมน์ในฐานยังชื่อ points)
export const RANKS = [
  { name: 'มหาดเล็ก',  min: 0,    color: '#8A9BB5', icon: '🎓' },
  { name: 'จางวาง',    min: 100,  color: '#7FA8D9', icon: '🎼' },
  { name: 'ขุน',       min: 300,  color: '#4C9A84', icon: '🎖' },
  { name: 'หลวง',      min: 800,  color: '#C9A84C', icon: '🏵' },
  { name: 'พระ',       min: 1800, color: '#E8C96A', icon: '👑' },
  { name: 'พระยา',     min: 3200, color: '#E89A5A', icon: '⚜️' },
  { name: 'เจ้าพระยา', min: 5000, color: '#D4756B', icon: '🔱' },
];

// ศักดินาพิเศษ: มีได้คนเดียวในเว็บ (ฐานข้อมูลล็อกค่า 999999 ไว้ให้เจ้าของเว็บ คนอื่นถูกตัดเพดานที่ 999998)
export const SLAVE = { name: 'ทาส', min: 999999, color: '#B8B8C8', icon: '⛓' };
export const SAKDINA_MAX = 999999;

export function getRank(points) {
  const p = points ?? 0;
  if (p >= SAKDINA_MAX) return SLAVE;
  let rank = RANKS[0];
  for (const r of RANKS) if (p >= r.min) rank = r;
  return rank;
}

export function getNextRank(points) {
  const p = points ?? 0;
  if (p >= SAKDINA_MAX) return null;
  return RANKS.find(r => r.min > p) ?? null;
}
