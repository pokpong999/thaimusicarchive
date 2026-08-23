// ระบบบรรดาศักดิ์ THMA
export const RANKS = [
  { name: 'มหาดเล็ก',  min: 0,    color: '#8A9BB5', icon: '🎓' },
  { name: 'จางวาง',    min: 100,  color: '#7FA8D9', icon: '🎼' },
  { name: 'ขุน',       min: 300,  color: '#4C9A84', icon: '🎖' },
  { name: 'หลวง',      min: 800,  color: '#C9A84C', icon: '🏵' },
  { name: 'พระ',       min: 1800, color: '#E8C96A', icon: '👑' },
  { name: 'พระยา',     min: 3200, color: '#E89A5A', icon: '⚜️' },
  { name: 'เจ้าพระยา', min: 5000, color: '#D4756B', icon: '🔱' },
];

export function getRank(points) {
  const p = points ?? 0;
  let rank = RANKS[0];
  for (const r of RANKS) if (p >= r.min) rank = r;
  return rank;
}

export function getNextRank(points) {
  const p = points ?? 0;
  return RANKS.find(r => r.min > p) ?? null;
}
