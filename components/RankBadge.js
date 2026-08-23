import { getRank } from '../lib/ranks';

export default function RankBadge({ points, showPoints = false }) {
  const rank = getRank(points);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem',
      background: rank.color + '22', color: rank.color,
      border: `1px solid ${rank.color}55`, whiteSpace: 'nowrap',
    }}>
      <span>{rank.icon}</span> {rank.name}
      {showPoints && <span style={{opacity:0.75,fontFamily:'monospace'}}>· {points ?? 0}</span>}
    </span>
  );
}
